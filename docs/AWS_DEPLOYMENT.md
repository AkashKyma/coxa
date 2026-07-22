# Coxa — AWS Deployment Guide (Amplify + Elastic Beanstalk)

This guide walks through hosting the Coxa monorepo on AWS:

| Layer | AWS service | What it hosts |
|-------|-------------|---------------|
| **Database** | MongoDB Atlas (recommended) | MongoDB |
| **API** | **Elastic Beanstalk** (Node.js 20) | `backend/` Express API |
| **Frontends** | **Amplify Hosting** (4 apps) | club-auth, club-dashboard, fan-auth, fan-dashboard |

Optional later: deploy **pos-app** as a 5th Amplify app using the same pattern.

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Domain & URL plan](#3-domain--url-plan)
4. [MongoDB Atlas](#4-mongodb-atlas)
5. [Elastic Beanstalk — API](#5-elastic-beanstalk--api)
6. [Amplify — frontends](#6-amplify--frontends)
7. [Environment variables reference](#7-environment-variables-reference)
8. [Seed & smoke tests](#8-seed--smoke-tests)
9. [Custom domains & HTTPS](#9-custom-domains--https)
10. [CI/CD (optional)](#10-cicd-optional)
11. [Updates & rollbacks](#11-updates--rollbacks)
12. [Troubleshooting](#12-troubleshooting)
13. [Cost & security checklist](#13-cost--security-checklist)

---

## 1. Architecture

```
                         ┌─────────────────────────────┐
                         │      MongoDB Atlas          │
                         └──────────────┬──────────────┘
                                        │ MONGODB_URI
┌───────────────────────────────────────▼───────────────────────────────────────┐
│  Elastic Beanstalk — Node.js 20                                               │
│  https://api.yourdomain.com  →  GET /api/health                               │
└───────────────────────────────────────┬───────────────────────────────────────┘
          ▲ CORS + HTTPS API calls      │
          │                             │
┌─────────┴─────────┬─────────────────┴──────────────┬──────────────────────┐
│ Amplify Hosting   │ Amplify Hosting                │ Amplify Hosting      │
│ club-auth         │ club-dashboard                 │ fan-auth             │
│ fan-dashboard     │                                │                      │
└───────────────────┴────────────────────────────────┴──────────────────────┘
```

**Why this split?**

- **Amplify** is ideal for static Vite/React SPAs (build → `dist/` → CDN + HTTPS + SPA redirects).
- **Elastic Beanstalk** runs the long-lived Node API with health checks and easy env-var management.
- **MongoDB Atlas** keeps the database managed (backups, IP allowlists) outside EB.

---

## 2. Prerequisites

| Item | Requirement |
|------|-------------|
| AWS account | With permissions for Amplify, Elastic Beanstalk, IAM, Route 53 (optional) |
| Node.js | 20+ locally (matches `engines` in root `package.json`) |
| Git repo | GitHub, GitLab, or Bitbucket connected to AWS |
| MongoDB Atlas | Free tier or dedicated cluster |
| Domain (recommended) | e.g. `yourdomain.com` in Route 53 or external DNS |

**Local tools (optional but helpful):**

```bash
# AWS CLI
aws --version

# Elastic Beanstalk CLI
pip install awsebcli
eb --version
```

**Repo layout reminder:**

```
coxa/
├── backend/              # API (deployed to EB)
├── apps/club-auth/       # Amplify app #1
├── apps/club-dashboard/  # Amplify app #2
├── apps/fan-auth/        # Amplify app #3
├── apps/fan-dashboard/   # Amplify app #4
├── packages/ui/          # Shared — must install from monorepo root
├── Procfile              # EB start command
└── .ebextensions/        # EB health check config
```

---

## 3. Domain & URL plan

Use **HTTPS subdomains** (recommended):

| App | Example URL | Amplify / EB |
|-----|-------------|--------------|
| API | `https://api.yourdomain.com` | Elastic Beanstalk |
| club-auth | `https://club-auth.yourdomain.com` | Amplify |
| club-dashboard | `https://club.yourdomain.com` | Amplify |
| fan-auth | `https://fan-auth.yourdomain.com` | Amplify |
| fan-dashboard | `https://fan.yourdomain.com` | Amplify |

You can use default AWS URLs during setup (`*.amplifyapp.com`, `*.elasticbeanstalk.com`) and add custom domains later.

---

## 4. MongoDB Atlas

### 4.1 Create cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) → **Create cluster**.
2. Choose region **close to your Elastic Beanstalk region** (e.g. `us-east-1`).
3. Create a database user (username + strong password).
4. Note the connection string:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/coxa?retryWrites=true&w=majority
   ```

### 4.2 Network access

Elastic Beanstalk instances use **dynamic outbound IPs**. Options:

| Approach | When to use |
|----------|-------------|
| **Allow access from anywhere** (`0.0.0.0/0`) | Fastest for staging — tighten later |
| **Atlas + AWS peering / PrivateLink** | Production hardening |
| **Fixed NAT Gateway + single IP** | Production with known egress IP |

For first deploy: Atlas → **Network Access** → **Add IP Address** → `0.0.0.0/0` (temporary), then restrict once you have a NAT IP.

### 4.3 Seed database (once)

From your laptop (with Atlas access):

```bash
cp .env.example .env
# Edit MONGODB_URI to Atlas connection string
npm ci
npm run seed
```

Or after EB is live, SSH in (see [§8](#8-seed--smoke-tests)).

---

## 5. Elastic Beanstalk — API

### 5.1 What gets deployed

- Entire monorepo (workspaces needed for `@coxa/rbac`).
- Start command: `Procfile` → `npm run start:backend` → `node backend/src/server.js`.
- The API listens on **`PORT`** (set by EB) or `API_PORT` fallback.

### 5.2 Option A — AWS Console (first time)

1. Open **AWS Console** → **Elastic Beanstalk** → **Create application**.
2. **Application name:** `coxa`
3. **Environment name:** `coxa-api-prod`
4. **Platform:** Node.js 20 running on 64bit Amazon Linux 2023
5. **Application code:** Upload your code  
   - Zip the repo **without** `node_modules` (see [§5.4](#54-deploy-with-eb-cli-recommended)).
6. **Presets:** Single instance (dev/staging) or High availability (production).
7. Click **Create environment** — wait ~5–10 minutes.

### 5.3 Configure environment variables

**Elastic Beanstalk** → your environment → **Configuration** → **Software** → **Edit** → **Environment properties**:

| Key | Example value |
|-----|---------------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | long random string (32+ chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `DEFAULT_TENANT_ID` | `coxa-club-001` |
| `CLUB_AUTH_URL` | `https://club-auth.yourdomain.com` |
| `CLUB_DASHBOARD_URL` | `https://club.yourdomain.com` |
| `FAN_AUTH_URL` | `https://fan-auth.yourdomain.com` |
| `FAN_DASHBOARD_URL` | `https://fan.yourdomain.com` |
| `POS_APP_URL` | `https://pos.yourdomain.com` (if using POS) |

> **Do not** commit `.env` to git. Use EB environment properties only.

**Health check** is preconfigured via `.ebextensions/01_node.config`:

- Path: `/api/health`
- Expected HTTP 200

Apply configuration → environment will restart.

### 5.4 Deploy with EB CLI (recommended)

From repo root:

```bash
# One-time init
eb init -p "Node.js 20 running on 64bit Amazon Linux 2023" coxa --region us-east-1

# Create environment (first time)
eb create coxa-api-prod --single

# Set env vars (example — repeat for each key)
eb setenv NODE_ENV=production MONGODB_URI="mongodb+srv://..." JWT_SECRET="your-secret"

# Deploy updates
eb deploy

# View logs
eb logs
eb ssh   # shell on instance
```

The repo includes:

- `Procfile` — start command
- `.ebextensions/01_node.config` — health check
- `.ebignore` — excludes `dist/`, `.env`, docs from upload

### 5.5 Verify API

```bash
curl https://<your-eb-url>/api/health
```

Expected:

```json
{
  "status": "ok",
  "stack": "MERN",
  "service": "coxa-backend",
  "version": "0.2.0",
  "modules": ["retail", "cdp", "loyalty", "personalization", "ticketing"]
}
```

Save your API URL as **`https://api.yourdomain.com`** (or EB default URL) for Amplify builds.

### 5.6 HTTPS on Elastic Beanstalk

1. **Certificate:** AWS Certificate Manager (ACM) in **same region** as EB → request cert for `api.yourdomain.com`.
2. **Load balancer:** EB → Configuration → Load balancer → add **HTTPS listener** on 443 with ACM cert.
3. **DNS:** Route 53 alias or CNAME `api.yourdomain.com` → EB environment URL.

---

## 6. Amplify — frontends

Create **one Amplify app per SPA** (4 total). Each app uses the **monorepo root** for `npm ci` because of `@coxa/ui` and workspaces.

### 6.1 Connect repository

For each frontend:

1. **AWS Amplify** → **Create new app** → **Host web app**.
2. Connect Git provider → select **coxa** repository.
3. **Important:** Enable **monorepo** and set **App root directory** (see table below).

| Amplify app name | App root directory |
|------------------|-------------------|
| `coxa-club-auth` | `apps/club-auth` |
| `coxa-club-dashboard` | `apps/club-dashboard` |
| `coxa-fan-auth` | `apps/fan-auth` |
| `coxa-fan-dashboard` | `apps/fan-dashboard` |

### 6.2 Build settings

If Amplify does not auto-detect, paste the build spec for each app. Example for **club-dashboard** (`amplify.yml` in `apps/club-dashboard/`):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd ../.. && npm ci
    build:
      commands:
        - cd ../.. && npm run build:club-dashboard
  artifacts:
    baseDirectory: dist
    files:
      - "**/*"
  cache:
    paths:
      - ../../node_modules/**/*
```

Copy the matching file from `infrastructure/amplify/` in this repo, or use:

| App | Build command (from repo root) |
|-----|--------------------------------|
| club-auth | `npm run build:club-auth` |
| club-dashboard | `npm run build:club-dashboard` |
| fan-auth | `npm run build:fan-auth` |
| fan-dashboard | `npm run build:fan-dashboard` |

### 6.3 Environment variables (Amplify Console)

Set under **App settings → Environment variables** for **each** app. These are injected at **build time** (`VITE_*`).

#### club-auth

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_DASHBOARD_URL` | `https://club.yourdomain.com` |

#### club-dashboard

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_AUTH_URL` | `https://club-auth.yourdomain.com` |

#### fan-auth

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_DASHBOARD_URL` | `https://fan.yourdomain.com` |

#### fan-dashboard

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_AUTH_URL` | `https://fan-auth.yourdomain.com` |
| `VITE_TENANT_ID` | `coxa-club-001` |

> After changing `VITE_*` variables, **redeploy** (Amplify rebuilds the static bundle).

### 6.4 SPA routing (required)

React Router needs all paths to serve `index.html`.

**Amplify Console** → app → **Hosting** → **Rewrites and redirects** → add:

| Source | Target | Type |
|--------|--------|------|
| `</^[^.]+$|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | 200 (Rewrite) |

Or use the simplified rule (Amplify UI):

- Source: `/<*>`
- Target: `/index.html`
- Status: **404-200** (rewrite)

Apply the same rule to **all four** Amplify apps.

Reference JSON: `infrastructure/amplify/spa-redirect.json`

### 6.5 Deploy & verify

1. Save build settings → Amplify runs first build (~3–8 min).
2. Open the `*.amplifyapp.com` URL for each app.
3. Confirm login redirects and API calls hit `https://api.yourdomain.com` (browser DevTools → Network).

### 6.6 Update Elastic Beanstalk CORS after Amplify URLs are known

Once Amplify gives you URLs (or custom domains are live), update EB env vars so CORS matches **exact origins** (including `https://`, no trailing slash):

```
CLUB_AUTH_URL=https://main.d1234abcd.amplifyapp.com
...
```

Then redeploy EB or apply config.

---

## 7. Environment variables reference

### Backend (Elastic Beanstalk)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_SECRET` | Yes | Strong secret for production |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `NODE_ENV` | Yes | `production` |
| `DEFAULT_TENANT_ID` | Yes | e.g. `coxa-club-001` |
| `CLUB_AUTH_URL` | Yes | Full origin for CORS |
| `CLUB_DASHBOARD_URL` | Yes | Full origin for CORS |
| `FAN_AUTH_URL` | Yes | Full origin for CORS |
| `FAN_DASHBOARD_URL` | Yes | Full origin for CORS |
| `POS_APP_URL` | If using POS | Full origin for CORS |
| `PORT` | Auto | Set by Elastic Beanstalk |

### Frontends (Amplify — build time)

| Variable | Apps | Description |
|----------|------|-------------|
| `VITE_API_URL` | All | Backend base URL |
| `VITE_AUTH_URL` | club-dashboard, fan-dashboard | Login app URL |
| `VITE_DASHBOARD_URL` | club-auth, fan-auth | Dashboard URL after login |
| `VITE_TENANT_ID` | fan-dashboard, pos-app | Tenant header |

---

## 8. Seed & smoke tests

### Seed production DB (one time)

**Option A — local machine:**

```bash
MONGODB_URI="mongodb+srv://..." npm run seed
```

**Option B — on EB instance:**

```bash
eb ssh
cd /var/app/current
npm run seed
exit
```

### Smoke test checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | `GET https://api.../api/health` | `{ "status": "ok" }` |
| 2 | Open club-auth → login | Redirect to club-dashboard |
| 3 | club-dashboard loads users/roles | No CORS errors |
| 4 | fan-auth → login | Redirect to fan-dashboard |
| 5 | fan-dashboard tickets / shop | API calls succeed |

Demo logins (after seed): `admin@coxa.local` / `fan@coxa.local` — password `CoxaDemo123!`

---

## 9. Custom domains & HTTPS

### Amplify custom domain

1. Amplify app → **Domain management** → **Add domain**.
2. Enter `yourdomain.com` → assign subdomains:

   - `club-auth.yourdomain.com` → club-auth branch
   - `club.yourdomain.com` → club-dashboard branch
   - etc.

3. Amplify shows **CNAME** records — add in Route 53 or your DNS provider.
4. Amplify provisions SSL automatically.

### API custom domain

1. ACM certificate for `api.yourdomain.com` (region = EB region).
2. EB load balancer HTTPS listener.
3. Route 53 **A alias** to EB environment.

---

## 10. CI/CD (optional)

### Amplify

- Connected branch (e.g. `main`) auto-builds on push.
- Use **branch previews** for staging (`develop` → separate Amplify branches).

### Elastic Beanstalk

**Option A — EB CLI in GitHub Actions:**

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - "packages/rbac/**"
      - "package.json"
      - "Procfile"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - name: Deploy to EB
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: coxa
          environment_name: coxa-api-prod
          region: us-east-1
          version_label: ${{ github.sha }}
          deployment_package: deploy.zip
```

Package `deploy.zip` must include repo files minus `.ebignore` entries.

**Option B — manual:** `eb deploy` from your machine.

---

## 11. Updates & rollbacks

### Frontends (Amplify)

- Push to connected branch → automatic build.
- Rollback: Amplify → **Deployments** → redeploy previous successful build.

### API (Elastic Beanstalk)

```bash
eb deploy              # new version
eb deploy --version <label>   # or rollback in Console → Application versions
```

### Full release order

1. Deploy API first (backward-compatible changes).
2. Update EB CORS if new frontend URLs added.
3. Rebuild Amplify apps if `VITE_*` URLs changed.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| EB health **Severe** | App crash / no `/api/health` | `eb logs` — check MongoDB URI |
| **502 Bad Gateway** | Node not listening on `PORT` | API uses `PORT` from EB (see `backend/src/server.js`) |
| **CORS error** | Frontend origin not in EB env | Set `CLUB_*_URL` / `FAN_*_URL` to exact Amplify URL |
| Amplify build fails `Cannot find @coxa/ui` | Build not from monorepo root | Use `cd ../.. && npm ci` in preBuild |
| Blank page on refresh | Missing SPA rewrite | Add [§6.4](#64-spa-routing-required) redirect |
| API 404 from frontend | Wrong `VITE_API_URL` at build | Fix env in Amplify → **Redeploy** |
| MongoDB connection timeout | Atlas IP block | Allow EB egress IP or `0.0.0.0/0` temporarily |
| `npm ci` fails on EB | Wrong platform / old Node | Use Node.js 20 platform |
| Login redirect wrong host | Missing `VITE_DASHBOARD_URL` / `VITE_AUTH_URL` | Set in Amplify env → rebuild |

**Useful commands:**

```bash
eb status
eb health
eb logs --stream
aws amplify list-apps
```

---

## 13. Cost & security checklist

### Cost (rough MVP)

| Service | Estimate |
|---------|----------|
| Amplify (4 apps, low traffic) | Free tier / ~$1–5/mo each |
| Elastic Beanstalk (single t3.small) | ~$15–30/mo + load balancer |
| MongoDB Atlas M0 | Free |
| Route 53 hosted zone | ~$0.50/mo |

### Security checklist

- [ ] `JWT_SECRET` — unique, 32+ random characters in EB only
- [ ] `NODE_ENV=production`
- [ ] MongoDB Atlas — auth + IP allowlist (tighten from `0.0.0.0/0`)
- [ ] CORS — only your Amplify/custom domains
- [ ] HTTPS everywhere (Amplify + EB ACM)
- [ ] No `.env` in git; use EB / Amplify env UI
- [ ] Rotate demo passwords before public launch
- [ ] Enable EB **enhanced health reporting** (included in `.ebextensions`)

---

## Quick reference

```bash
# Local production build test
npm ci
VITE_API_URL=https://api.yourdomain.com npm run build:club-dashboard

# EB deploy
eb deploy

# Health
curl https://api.yourdomain.com/api/health

# Seed
MONGODB_URI="mongodb+srv://..." npm run seed
```

See also: [HOSTING.md](./HOSTING.md) for generic VPS/Nginx options and architecture overview.

---

*Document version: 1.0 — Amplify Hosting + Elastic Beanstalk + MongoDB Atlas.*
