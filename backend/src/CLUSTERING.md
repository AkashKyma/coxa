# Coxa Backend — Clustering & Scale

Target: **100k concurrent users on match days** (~5k–15k RPS, bursty).

## Topology

```
                          ┌──────────────────────────┐
                          │   Application Load       │
   internet ────────────► │   Balancer (ALB)         │
                          │   idle timeout 120s      │
                          └────────────┬─────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼──────────┐  ┌──────────▼──────────┐   ┌─────────▼──────────┐
   │ EB instance #1      │  │ EB instance #2      │   │ EB instance #N     │
   │   nginx :80 → :8080 │  │   nginx :80 → :8080 │   │   nginx :80 → :8080│
   │     │               │  │     │               │   │     │              │
   │     ▼               │  │     ▼               │   │     ▼              │
   │ start.cjs (web)     │  │ start.cjs (web)     │   │ start.cjs (web)    │
   │     │               │  │     │               │   │     │              │
   │     ▼               │  │     ▼               │   │     ▼              │
   │ cluster.js primary  │  │ cluster.js primary  │   │ cluster.js primary │
   │  ├─ worker (CPU 1)  │  │  ├─ worker (CPU 1)  │   │  ├─ worker (CPU 1) │
   │  ├─ worker (CPU 2)  │  │  ├─ worker (CPU 2)  │   │  ├─ worker (CPU 2) │
   │  ├─ worker (CPU N)  │  │  ├─ worker (CPU N)  │   │  ├─ worker (CPU N) │
   │  └─ mcp/server.js   │  │  └─ mcp/server.js   │   │  └─ mcp/server.js  │
   └─────────┬───────────┘  └──────────┬──────────┘   └─────────┬──────────┘
             │                         │                        │
             └─────────────────┬───────┴────────────────────────┘
                               │
                ┌──────────────┴────────────────────┐
                │                                   │
       ┌────────▼─────────┐               ┌─────────▼────────┐
       │ MongoDB Atlas    │               │ ElastiCache       │
       │  (M30+ pooled)   │               │ Redis (TLS)       │
       └──────────────────┘               └───────────────────┘
```

## Layers of scale

| Layer | Lever | File |
|---|---|---|
| In-process | `WEB_CONCURRENCY` (default = CPUs, cap 16) | `backend/src/cluster.js` |
| Per-instance | EC2 instance type (`t3.xlarge` → `c7i.2xlarge`) | `.ebextensions/01_node.config` |
| Horizontal | EB Auto Scaling group (`MinSize=2`, `MaxSize=20`) | `.ebextensions/01_node.config` |
| DB | `MONGO_POOL_SIZE` per worker × workers × instances | `backend/src/config/db.js` |
| Cache / queue | Redis (`REDIS_URL`, TLS via `rediss://`) | `backend/src/lib/redis.js` |
| ALB ↔ node | keep-alive 120s ALB → 65s nginx → 75s node | `.ebextensions` + `server.js` |

## Why a primary + N workers, not just N standalone processes?

`node:cluster` gives us:

1. **Round-robin load balancing** across workers on a single shared port — nginx still proxies to one `127.0.0.1:8080`.
2. **One owner** for cross-cutting work (MCP sidecar, graceful drain). Running these per-worker would spawn N MCP servers and N SIGTERM handlers fighting each other.
3. **Crash isolation** — a worker that throws unhandled gets replaced; the rest keep serving.

## Connection-budget math

Effective Mongo connections = `workers × instances × MONGO_POOL_SIZE`.

| Workers/inst | Instances | Pool | Total | Atlas tier |
|---|---|---|---|---|
| 4 | 2 | 25 | 200 | M10 fine |
| 8 | 10 | 25 | **2000** | M30 (3000 cap) |
| 8 | 20 | 25 | 4000 | needs M40 |

If you scale beyond ~2000 connections, either bump Atlas or drop `MONGO_POOL_SIZE`. Real production target: keep average open ≤ 50% of cap so failovers have headroom.

## Match-day pre-flight checklist

1. **Pre-warm**: bump `MinSize` to your expected baseline (e.g. 8) the day before. ASG warm-up + image pull takes 3–5min, you don't want that lag inside the spike.
2. **Load test first**: k6 or Artillery against staging at 2× expected RPS. Watch event-loop lag (`process._getActiveHandles().length`, or pino-http p99 latency).
3. **Mongo**: verify Atlas alerting on connections > 70%, opcounters, queue length.
4. **Redis**: ElastiCache serverless auto-scales, but keep an eye on `EngineCPUUtilization` — clustering won't save you if Redis is the bottleneck.
5. **Deploy freeze**: rolling deploys take ~10min per 25% batch; don't ship code an hour before kickoff.
6. **CloudWatch alarms**: 5xx rate, target response time p95, ASG desired vs. healthy.

## Local dev

Clustering is *disabled* in dev — `WEB_CONCURRENCY=1` in `.env.example`, and `npm run dev` calls `nodemon src/server.js` directly (bypasses `cluster.js`). This keeps hot-reload snappy and stack traces clean.

To smoke-test the cluster locally:

```bash
WEB_CONCURRENCY=4 node backend/src/cluster.js
```

## What's NOT in this commit (yet)

- **`backend/src/worker.js`** — BullMQ consumers (not deployed; use `npm run start:worker` locally when implemented).
- **Auth caching** — `optionalAuth`/`requireAuth` still hits Mongo on every request. Once Redis is wired you should cache the user doc with `AUTH_CACHE_TTL=90s`.
- **Redis-backed rate limiter** — `express-rate-limit` is declared but unused. When you add it, use `rate-limit-redis` so limits are enforced globally across workers and instances.
- **Read replicas** — `MONGODB_READ_URI` is wired into `.env.example` but `db.js` only opens one mongoose connection. Hot read paths (leaderboards, fan lookups) should use a `mongoose.createConnection(MONGODB_READ_URI)` and target read-only secondaries.
