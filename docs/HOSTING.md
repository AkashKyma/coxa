# Coxa Fan OS — Hosting & Deployment Guide

This document describes how to host the full Coxa MERN setup in production: one **Express API**, four **React (Vite) web apps**, and **MongoDB**.

---

## 1. Architecture overview

```
                         ┌─────────────────────────────────────────┐
                         │           MongoDB Atlas / VPS           │
                         │              (database)                 │
                         └───────────────────┬─────────────────────┘
                                             │ MONGODB_URI
                         ┌───────────────────▼─────────────────────┐
                         │         coxa-backend (Node/Express)      │
                         │              /api/*  :5000                 │
                         └───────────────────┬─────────────────────┘
              ┌──────────────┬───────────────┼──────────────┬──────────────┐
              │              │               │              │              │
     club-auth.web    club.web        fan-auth.web    fan.web      (future apps)
     (static SPA)   (static SPA)    (static SPA)   (static SPA)
```

| Component | Repo path | Dev port | Production role |
|-----------|-----------|----------|-----------------|
| **API** | `backend/` | 5000 | Long-running Node process |
| **club-auth** | `apps/club-auth/` | 5173 | Static SPA — staff login |
| **club-dashboard** | `apps/club-dashboard/` | 5174 | Static SPA — club admin |
| **fan-auth** | `apps/fan-auth/` | 5175 | Static SPA — fan login/signup |
| **fan-dashboard** | `apps/fan-dashboard/` | 5176 | Static SPA — fan portal |
| **RBAC package** | `packages/rbac/` | — | Bundled via backend workspace |

**Build outputs**

| App | Build command | Output folder |
|-----|---------------|---------------|
| club-auth | `npm run build --workspace=club-auth` | `apps/club-auth/dist/` |
| club-dashboard | `npm run build --workspace=club-dashboard` | `apps/club-dashboard/dist/` |
| fan-auth | `npm run build --workspace=fan-auth` | `apps/fan-auth/dist/` |
| fan-dashboard | `npm run build --workspace=fan-dashboard` | `apps/fan-dashboard/dist/` |

Backend has no compile step — run `node src/server.js` directly.

---

## 2. Recommended production URLs

Use separate subdomains for clarity and cookie/security boundaries.

| App | Example URL | Audience |
|-----|-------------|----------|
| API | `https://api.coxa.example` | All frontends |
| club-auth | `https://club-auth.coxa.example` | Staff |
| club-dashboard | `https://club.coxa.example` | Club admin / staff |
| fan-auth | `https://fan-auth.coxa.example` | Fans |
| fan-dashboard | `https://fan.coxa.example` | Fans / members |

Alternative: path-based routing on one domain (`coxa.example/club`, `/fan`, etc.) — works but auth cookies and CORS are harder to manage. **Subdomains are recommended.**

---

## 3. Environment variables

Copy `.env.example` to `.env` at the **repo root**. The backend loads it from `backend/src/server.js`.

### 3.1 Backend (required)

| Variable | Example | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/coxa` | MongoDB connection string |
| `API_PORT` | `5000` | Port the API listens on |
| `NODE_ENV` | `production` | Set to `production` in live environments |
| `DEFAULT_TENANT_ID` | `coxa-club-001` | Default tenant for MVP single-club setup |

### 3.2 CORS (required for production)

Set each deployed frontend origin in Elastic Beanstalk / server environment (see §3.1 table in updated doc — `CLUB_AUTH_URL`, etc.).

**Important:** The backend accepts **multiple origins** via `CLUB_AUTH_URL`, `CLUB_DASHBOARD_URL`, `FAN_AUTH_URL`, `FAN_DASHBOARD_URL`, and `POS_APP_URL` (see `backend/src/server.js`). Set each to the full HTTPS origin of the deployed SPA.

Example production `.env` / Elastic Beanstalk environment properties:

```env
CLUB_AUTH_URL=https://club-auth.coxa.example
CLUB_DASHBOARD_URL=https://club.coxa.example
FAN_AUTH_URL=https://fan-auth.coxa.example
FAN_DASHBOARD_URL=https://fan.coxa.example
POS_APP_URL=https://pos.coxa.example
```

### 3.3 Frontend build-time variables

Set these **when building** each Vite app (they are baked into the static bundle).

| Variable | Used by | Example |
|----------|---------|---------|
| `VITE_API_URL` | All web apps | `https://api.coxa.example` |
| `VITE_AUTH_URL` | club-dashboard, fan-dashboard | Auth app URL |
| `VITE_DASHBOARD_URL` | club-auth, fan-auth | Dashboard URL after login |
| `VITE_TENANT_ID` | fan-dashboard, pos-app | `coxa-club-001` |

If `VITE_API_URL` is empty, the app calls `/api` on the **same origin** — use this when Nginx proxies `/api` to the backend on each site.

**Build example (club-dashboard with external API):**

```bash
VITE_API_URL=https://api.coxa.example npm run build --workspace=club-dashboard
```

**Build example (same-origin proxy — no VITE_API_URL):**

```bash
npm run build --workspace=club-dashboard
```

---

## 4. MongoDB hosting

### Option A — MongoDB Atlas (recommended)

1. Create a free or dedicated cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user with read/write on the `coxa` database.
3. Allow network access:
   - **Atlas only:** add your API server IP (or `0.0.0.0/0` temporarily for testing — tighten for production).
4. Copy the connection string into `MONGODB_URI`.
5. Run seed once from a machine that can reach Atlas:

   ```bash
   npm run seed
   ```

### Option B — Self-hosted MongoDB on VPS

- Install MongoDB 7+ on the same or a separate server.
- Bind to private network only; do not expose `27017` publicly.
- Use `MONGODB_URI=mongodb://user:pass@10.0.0.5:27017/coxa?authSource=admin`.

### Backups

- **Atlas:** enable continuous backup / snapshots on paid tiers.
- **Self-hosted:** `mongodump` on a schedule; store off-server.

---

## 5. Build for production

From the **repo root**, on Node.js 20+:

```bash
npm ci                    # clean install from package-lock.json
npm run build             # builds all 4 web apps → dist/ in each app
```

Verify backend starts locally against production DB (read-only check):

```bash
NODE_ENV=production npm run start:backend
curl http://localhost:5000/api/health
```

---

## 6. Deployment options

### Option 1 — Single VPS (Nginx + PM2) — good for MVP

**Stack:** Ubuntu 22.04+, Nginx, PM2, Node 20, MongoDB Atlas.

```
Internet
   │
   ▼
Nginx :443
   ├── club-auth.coxa.example     → /var/www/coxa/club-auth/
   ├── club.coxa.example          → /var/www/coxa/club-dashboard/
   ├── fan-auth.coxa.example      → /var/www/coxa/fan-auth/
   ├── fan.coxa.example           → /var/www/coxa/fan-dashboard/
   └── api.coxa.example           → proxy → localhost:5000
```

**Steps**

1. **Server setup**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nginx
   sudo npm install -g pm2
   ```

2. **Deploy code**

   ```bash
   git clone <repo> /opt/coxa
   cd /opt/coxa
   npm ci
   cp .env.example .env   # edit with production values
   npm run build
   ```

3. **Start API with PM2**

   ```bash
   cd /opt/coxa
   pm2 start backend/src/server.js --name coxa-api
   pm2 save
   pm2 startup
   ```

4. **Copy static files**

   ```bash
   sudo mkdir -p /var/www/coxa
   sudo cp -r apps/club-auth/dist      /var/www/coxa/club-auth
   sudo cp -r apps/club-dashboard/dist /var/www/coxa/club-dashboard
   sudo cp -r apps/fan-auth/dist       /var/www/coxa/fan-auth
   sudo cp -r apps/fan-dashboard/dist  /var/www/coxa/fan-dashboard
   ```

5. **Nginx — SPA + API proxy example**

   ```nginx
   # /etc/nginx/sites-available/coxa-api
   server {
       listen 443 ssl http2;
       server_name api.coxa.example;

       ssl_certificate     /etc/letsencrypt/live/coxa.example/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/coxa.example/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   # /etc/nginx/sites-available/coxa-club-dashboard
   server {
       listen 443 ssl http2;
       server_name club.coxa.example;

       ssl_certificate     /etc/letsencrypt/live/coxa.example/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/coxa.example/privkey.pem;

       root /var/www/coxa/club-dashboard;
       index index.html;

       # Optional: same-origin API proxy (leave VITE_API_URL empty at build)
       location /api/ {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

   Repeat the SPA block for `club-auth`, `fan-auth`, and `fan-dashboard` with their roots and server names.

6. **SSL** — Certbot:

   ```bash
   sudo certbot --nginx -d api.coxa.example -d club.coxa.example \
     -d club-auth.coxa.example -d fan.coxa.example -d fan-auth.coxa.example
   ```

7. **Seed (once)**

   ```bash
   cd /opt/coxa && npm run seed
   ```

---

### Option 2 — AWS (Amplify + Elastic Beanstalk) — recommended for AWS teams

| Layer | Service | Docs |
|-------|---------|------|
| **Frontends** (4 SPAs) | AWS Amplify Hosting | [docs/AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) §6 |
| **API** | AWS Elastic Beanstalk (Node 20) | [docs/AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) §5 |
| **MongoDB** | MongoDB Atlas | [docs/AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) §4 |

The repo includes `Procfile`, `.ebextensions/`, `.ebignore`, and `infrastructure/amplify/` build specs.

---

### Option 3 — Split hosting (other clouds)

| Layer | Suggested providers | Notes |
|-------|---------------------|-------|
| **MongoDB** | MongoDB Atlas | Managed backups, scaling |
| **API** | Railway, Render, Fly.io, AWS ECS, DigitalOcean App Platform | Set `MONGODB_URI`, `NODE_ENV=production`, CORS URLs |
| **Frontends** | Cloudflare Pages, Vercel, Netlify, S3 + CloudFront | Deploy each `apps/*/dist` as a separate project |

**API deploy (Render / Railway example)**

- Root directory: `backend` (or monorepo root with start command)
- Build command: `npm ci` (from repo root if using workspaces)
- Start command: `npm run start:backend` or `node backend/src/server.js`
- Env: `MONGODB_URI`, `NODE_ENV=production`, CORS URLs

**Frontend deploy (one project per app)**

| Project | Root / build | Output |
|---------|--------------|--------|
| club-auth | `apps/club-auth` → `npm run build` | `dist` |
| club-dashboard | `apps/club-dashboard` → `npm run build` | `dist` |
| fan-auth | `apps/fan-auth` → `npm run build` | `dist` |
| fan-dashboard | `apps/fan-dashboard` → `npm run build` | `dist` |

Set `VITE_API_URL=https://api.coxa.example` in each platform’s environment variables before build.

Configure **SPA fallback** (`/* → index.html`) on every static host.

---

### Option 3 — Windows / IIS (your current dev OS)

For production, Linux + Nginx is simpler. If you must host on Windows Server:

- **API:** IIS with iisnode, or run PM2 / `node backend/src/server.js` as a Windows Service (NSSM).
- **Frontends:** IIS static sites pointing to each `dist/` folder; URL Rewrite for SPA routing.
- **MongoDB:** Use Atlas (recommended) rather than local MongoDB on Windows.

---

## 7. Process management & restarts

| Tool | Use case |
|------|----------|
| **PM2** | VPS — auto-restart, logs, cluster mode later |
| **systemd** | Linux service unit for `coxa-api` |
| **Platform** | Railway/Render manage restarts automatically |

**PM2 useful commands**

```bash
pm2 logs coxa-api
pm2 restart coxa-api
pm2 status
```

---

## 8. Health checks & monitoring

| Check | URL | Expected |
|-------|-----|----------|
| API health | `GET /api/health` | `{ "status": "ok", ... }` |
| MongoDB | API startup logs | `[mongodb] connected` |

Point uptime monitors (UptimeRobot, Better Stack, etc.) at `/api/health`.

Log aggregation: PM2 logs, or ship stdout to CloudWatch / Datadog / Loki when you scale.

---

## 9. CI/CD outline (GitHub Actions example)

```yaml
# .github/workflows/deploy.yml (conceptual)
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: https://api.coxa.example
      - run: npm run start:backend &
      - run: sleep 3 && curl -f http://localhost:5000/api/health
      # Upload dist/ artifacts or rsync to VPS / deploy to Pages
```

Adjust deploy step for your host (SSH + rsync, Render deploy hook, S3 sync, etc.).

---

## 10. Security checklist (production)

- [ ] `NODE_ENV=production`
- [ ] MongoDB: auth enabled, IP allowlist, no public `27017`
- [ ] CORS: only your four frontend URLs (not `*`)
- [ ] HTTPS everywhere (TLS 1.2+)
- [ ] Secrets in env vars / secret manager — never in git
- [ ] Run `npm audit` periodically
- [ ] Rate limiting on `/api` (add middleware before go-live)
- [ ] Auth/JWT on protected routes (when implemented)
- [ ] Firewall: only 80/443 public; API port internal if behind Nginx

---

## 11. Release / update procedure

1. Pull latest code on server or trigger CI.
2. `npm ci`
3. `npm run build` (with production `VITE_API_URL` if needed).
4. Copy new `dist/` folders to web roots.
5. `pm2 restart coxa-api` (or platform redeploy).
6. Verify `/api/health` and spot-check each web app.
7. Run migrations/seeds only when explicitly required (`npm run seed` is idempotent for demo users).

---

## 12. Port reference (development)

| Service | Port |
|---------|------|
| API | 5000 |
| club-auth | 5173 |
| club-dashboard | 5174 |
| fan-auth | 5175 |
| fan-dashboard | 5176 |
| MongoDB (local) | 27017 |

In production, browsers only talk to **443**; internal API port stays on the server loopback.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| API won't start | Wrong `MONGODB_URI` or network block | Test URI with `mongosh`; check Atlas IP allowlist |
| CORS error in browser | Origin not in EB env vars | Set `CLUB_*_URL` / `FAN_*_URL` to exact Amplify URL |
| Blank page after deploy | SPA routing | Configure `try_files` / fallback to `index.html` |
| API 404 from frontend | Wrong `VITE_API_URL` at build time | Rebuild with correct env or use same-origin `/api` proxy |
| Empty users/roles | DB not seeded | `npm run seed` against production DB (once) |
| `npm ci` fails in backend only | Workspace layout | Run `npm ci` from **repo root**, not `backend/` alone |

---

## 14. What is not hosted yet

These are boilerplate or backend-only today; no separate deploy unit required until built:

- Auth flows (club-auth / fan-auth) — UI only, no login API
- Permissions enforcement — roles only in `@coxa/rbac`
- Legacy scaffolds under `apps/pos-app`, `apps/fan-app`, etc. (not in active use)

---

## 15. Quick reference commands

```bash
# Local development
npm install
npm run seed
npm run dev

# Production build (all frontends)
npm run build

# Start API only
npm run start:backend

# Health check
curl https://api.coxa.example/api/health
```

---

*Document version: 0.1 — matches Coxa monorepo MERN boilerplate (1 API, 4 web apps, MongoDB Atlas–ready).*
