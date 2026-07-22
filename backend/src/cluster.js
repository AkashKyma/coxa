/**
 * Coxa cluster primary — fork N HTTP workers + a single MCP sidecar.
 *
 * Why a cluster?
 *   Node.js is single-threaded. Each worker process owns one event loop and
 *   one CPU core. With N cores per EB instance we'd otherwise leave N-1 cores
 *   idle. Clustering multiplies throughput linearly with cores until the bound
 *   becomes Mongo / Redis / network instead of CPU.
 *
 * Why a primary?
 *   - Single owner for cross-cutting concerns: MCP sidecar, graceful shutdown,
 *     worker restart-on-crash. None of these should run N times.
 *   - SO_REUSEPORT-style load balancing: node:cluster round-robins TCP accepts
 *     across workers on Linux, so nginx still sees a single :PORT to proxy to.
 *
 * Topology per EB instance:
 *
 *   start.cjs (PROC_TYPE=web)
 *      └─► cluster.js (primary)
 *           ├─► server.js  (worker #1, listens on :$PORT via cluster)
 *           ├─► server.js  (worker #2)
 *           ├─► server.js  (worker #N)   ← WEB_CONCURRENCY or os.availableParallelism()
 *           └─► mcp/server.js (sidecar, only if MCP_ENABLED!=false)
 *
 * Scaling beyond one instance is EB's job (auto scaling group + ALB).
 * See backend/src/CLUSTERING.md for the full topology + EB knobs.
 */

import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Worker count: explicit env wins, else one per logical CPU.
// Cap at 16 to keep Mongo connection fan-out predictable on big instance types.
const desired = Number(process.env.WEB_CONCURRENCY) || availableParallelism();
const WORKERS = Math.max(1, Math.min(desired, 16));

if (cluster.isPrimary) {
  console.log(`[cluster] primary pid=${process.pid} forking ${WORKERS} workers (cores=${availableParallelism()})`);

  // Workers run server.js — set via cluster.setupPrimary so the child process
  // executes the HTTP server instead of re-running this file.
  cluster.setupPrimary({
    exec: join(__dirname, "server.js"),
    // serialization "advanced" lets us pass objects bigger than the default
    // buffer if we ever need to broadcast config to workers.
    serialization: "advanced",
  });

  for (let i = 0; i < WORKERS; i++) cluster.fork();

  // ── Restart-on-crash with exponential backoff ──────────────────────────
  // Track per-pid crash timestamps so a flapping worker doesn't burn CPU in
  // a tight fork loop. Reset the counter if a worker stays up for >60s.
  const crashHistory = new Map(); // workerId -> [timestamps]
  const MAX_CRASHES_PER_MIN = 5;

  cluster.on("exit", (worker, code, signal) => {
    const id = worker.id;
    const now = Date.now();
    const recent = (crashHistory.get(id) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    crashHistory.set(id, recent);

    if (shuttingDown) {
      console.log(`[cluster] worker ${worker.process.pid} exited during shutdown (code=${code}, signal=${signal})`);
      return;
    }

    if (recent.length > MAX_CRASHES_PER_MIN) {
      console.error(`[cluster] worker ${worker.process.pid} crashed ${recent.length}x in last 60s — backing off 5s`);
      setTimeout(() => cluster.fork(), 5_000);
    } else {
      console.warn(`[cluster] worker ${worker.process.pid} exited (code=${code}, signal=${signal}) — replacing`);
      cluster.fork();
    }
  });

  // ── MCP sidecar (spawned once from primary, never per-worker) ──────────
  const mcpEnabled = process.env.MCP_ENABLED !== "false";
  let mcpProc = null;
  if (mcpEnabled) mcpProc = spawnMcp();

  // ── Graceful shutdown ──────────────────────────────────────────────────
  // SIGTERM is what EB/systemd send during deploys. We:
  //   1. Stop accepting new fork events.
  //   2. Forward SIGTERM to every worker so they finish in-flight requests.
  //   3. Kill the MCP sidecar.
  //   4. Wait up to 30s then exit.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[cluster] received ${signal} — draining workers (timeout 30s)`);

    for (const id in cluster.workers) {
      cluster.workers[id]?.send("shutdown");
      cluster.workers[id]?.process.kill("SIGTERM");
    }
    mcpProc?.kill("SIGTERM");

    const deadline = setTimeout(() => {
      console.warn("[cluster] drain timeout — forcing exit");
      process.exit(1);
    }, 30_000);
    deadline.unref();

    const checkDone = setInterval(() => {
      if (Object.keys(cluster.workers).length === 0) {
        clearInterval(checkDone);
        clearTimeout(deadline);
        console.log("[cluster] all workers drained — exit 0");
        process.exit(0);
      }
    }, 250);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function spawnMcp() {
  const mcpScript = join(__dirname, "mcp", "server.js");
  const mcpEnv = {
    ...process.env,
    MCP_API_URL:
      process.env.MCP_API_URL ?? `http://localhost:${process.env.PORT ?? 8080}`,
    MCP_TENANT_ID:
      process.env.MCP_TENANT_ID ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001",
    // In production use HTTP transport so MCP isn't tied to the primary's stdio.
    MCP_TRANSPORT:
      process.env.MCP_TRANSPORT ??
      (process.env.NODE_ENV === "production" ? "http" : "stdio"),
  };

  const proc = spawn(process.execPath, [mcpScript], {
    env: mcpEnv,
    stdio: ["pipe", "pipe", "inherit"],
    detached: false,
  });

  proc.on("error", (err) => console.error("[coxa-mcp] failed to start:", err.message));
  proc.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.warn(`[coxa-mcp] exited (code=${code}) — not restarting`);
    }
  });
  proc.stdout?.on("data", (d) => process.stderr.write(`[coxa-mcp] ${d}`));

  const transport = mcpEnv.MCP_TRANSPORT;
  const mcpPort = process.env.MCP_PORT ?? 3100;
  if (transport === "http") {
    console.log(`[coxa-mcp] HTTP transport → http://localhost:${mcpPort}/mcp`);
  } else {
    console.log("[coxa-mcp] stdio transport started");
  }
  return proc;
}
