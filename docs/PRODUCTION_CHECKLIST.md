# Coxa CDP — Production Go-Live Checklist

## 🔴 BLOCKERS — Must fix before any production traffic

### 1. Rotate the OpenAI API Key (IMMEDIATE)
The key `sk-proj-tax4-...` was committed to `backend/.env.elb.example` in git history.  
**Action:** Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys), revoke that key, generate a new one, and set it in the ELB environment — never in source files.

### 2. Generate real secrets (replace ALL `<CHANGE_ME_...>` values)

Run these commands and put the outputs in your deployment secrets manager (AWS Secrets Manager / Parameter Store):

```bash
# JWT (backend)
openssl rand -hex 64

# RudderStack Webhook Secret (match in RudderStack source settings)
openssl rand -hex 32

# Cube API Secret (use same value in backend env + EC2 .env.cdp)
openssl rand -hex 32

# PostHog Secret Key
openssl rand -hex 32

# PostHog Encryption Salt (exactly 32 hex chars)
openssl rand -hex 16

# ClickHouse password (use same value in .env.cdp + workspaceConfig.json)
openssl rand -hex 24

# All DB passwords (RudderStack, PostHog, Dagster, Multiwoven)
openssl rand -hex 24  # run once per service
```

### 3. Update CORS origins in backend `.env`

Replace localhost values with real production domains:
```
CLUB_AUTH_URL=https://auth.coxa.live
CLUB_DASHBOARD_URL=https://club.coxa.live
FAN_AUTH_URL=https://id.coxa.live
FAN_DASHBOARD_URL=https://fan.coxa.live
FANBOX_DASHBOARD_URL=https://fanbox.coxa.live
POS_APP_URL=https://pos.coxa.live
```

### 4. Switch MongoDB to production cluster

In `backend/.env`:
```
MONGODB_URI=mongodb+srv://...@cms.imbxra8.mongodb.net/coxa-production
```
Currently points to `coxa-staging`.

### 5. Update `workspaceConfig.json` with real secrets

`infrastructure/rudderstack/workspaceConfig.json` has hardcoded values that must match production:
- `"password": "coxa_dev_password"` → set to your production ClickHouse password
- `"X-RudderStack-Secret" → "COXA_RUDDERSTACK_WEBHOOK_SECRET_CHANGE_ME"` → set to real webhook secret

---

## 🟡 IMPORTANT — Fix before first real users

### 6. Pin Docker image tags on EC2

In `docker-compose.cdp.yml`, replace all `:latest` tags with pinned versions:
```yaml
posthog/posthog:1.x.x      # check latest stable at hub.docker.com/r/posthog/posthog
cubejs/cube:1.x.x
rudderlabs/rudder-server:latest  → pin to a release tag
```

### 7. Disable Cube Playground in production

Already env-var-controlled as of this update. Ensure `.env.cdp` on EC2 has:
```
CUBEJS_DEV_MODE=false
```

### 8. Set frontend env vars for each deployed app

Each Vite frontend needs a `.env.production` or environment injected at build time:

**fanbox-dashboard:**
```
VITE_API_URL=https://api.coxa.live
VITE_RUDDERSTACK_WRITE_KEY=rws_2cb392007d9b69839f418856bfa09a7d2e296419
VITE_RUDDERSTACK_DATA_PLANE_URL=http://3.217.225.85:8080
VITE_POSTHOG_KEY=phc_A4Gnk9ev6nQJ8TfXoAq48DusKakeCBpgJNagZbp9ek3b
VITE_POSTHOG_HOST=https://posthog.service.coxa.live
```

**club-dashboard:**
```
VITE_API_URL=https://api.coxa.live
VITE_AUTH_URL=https://auth.coxa.live
VITE_RUDDERSTACK_WRITE_KEY=rws_2cb392007d9b69839f418856bfa09a7d2e296419
VITE_RUDDERSTACK_DATA_PLANE_URL=http://3.217.225.85:8080
VITE_POSTHOG_KEY=phc_A4Gnk9ev6nQJ8TfXoAq48DusKakeCBpgJNagZbp9ek3b
VITE_POSTHOG_HOST=https://posthog.service.coxa.live
```

### 9. Set `RUDDERSTACK_WORKSPACE_TOKEN` in EC2 `.env.cdp`

Currently a placeholder. Get it from your RudderStack workspace settings page.

---

## 🟢 ALREADY DONE — Confirmed production-grade

- ✅ Node.js cluster mode (auto-restart crashed workers, graceful shutdown on SIGTERM)
- ✅ ClickHouse → MongoDB fallback in all ML + segment services
- ✅ RudderStack → MongoDB fallback in event pipeline
- ✅ PostHog graceful shutdown on drain
- ✅ ClickHouse client closed on shutdown
- ✅ Background seed job disabled in `NODE_ENV=production`
- ✅ Elastic IP attached to EC2 — `3.217.225.85` is static
- ✅ Route 53 DNS: `posthog.service.coxa.live → 3.217.225.85`
- ✅ HTTPS via Caddy with Let's Encrypt auto-cert
- ✅ All Phase 1–4 services running on EC2 (RudderStack, PostHog, ClickHouse, Cube, Dagster, Tracardi, Multiwoven)
- ✅ Docker log rotation configured (50MB max, 3 files)
- ✅ Systemd service `coxa-cdp.service` auto-starts all phases on EC2 reboot
- ✅ Security group ports: 80, 443, 8080, 8686, 3050, 8095, 4000 open
- ✅ EBS volume expanded to 58GB

---

## EC2 Service URLs (Current)

| Service | URL | Status |
|---|---|---|
| PostHog | https://posthog.service.coxa.live | ✅ Live |
| RudderStack data-plane | http://3.217.225.85:8080 | ✅ Live |
| ClickHouse HTTP | http://3.217.225.85:8123 (internal) | ✅ Live |
| Cube API | http://3.217.225.85:4000 | ✅ Live |
| Dagster UI | http://3.217.225.85:3030 (internal) | ✅ Live |
| Tracardi CDP | http://3.217.225.85:8686 | ✅ Live |
| Multiwoven UI | http://3.217.225.85:8095 | ✅ Live |
