#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Coxa CDP Startup Script — Run on EC2
# Starts Phase 1 (RudderStack + PostHog) and Phase 2 (ClickHouse + Cube + Dagster)
# Usage: bash cdp-startup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "════════════════════════════════════════════════════"
echo "  Coxa CDP Startup — Phase 1 + Phase 2"
echo "════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Check docker ──────────────────────────────────────────────────
info "Checking Docker..."
if ! command -v docker &>/dev/null; then
  err "Docker not found. Installing..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  warn "Docker installed. Re-run this script as 'newgrp docker && bash cdp-startup.sh'"
  exit 1
fi
log "Docker: $(docker --version)"

# ─── Step 2: Check docker-compose.cdp.yml exists ──────────────────────────
COMPOSE_FILE="/home/ubuntu/coxa/docker-compose.cdp.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  warn "docker-compose.cdp.yml not found at $COMPOSE_FILE"
  info "Searching for it..."
  COMPOSE_FILE=$(find /home /root /opt /srv -name "docker-compose.cdp.yml" 2>/dev/null | head -1)
  if [ -z "$COMPOSE_FILE" ]; then
    err "docker-compose.cdp.yml not found anywhere."
    echo ""
    echo "  Clone the repo first:"
    echo "  git clone https://github.com/your-org/coxa.git /home/ubuntu/coxa"
    exit 1
  fi
fi
COXA_DIR=$(dirname "$COMPOSE_FILE")
log "Found: $COMPOSE_FILE"

# ─── Step 3: Create .env for CDP if not exists ────────────────────────────
ENV_FILE="$COXA_DIR/.env.cdp"
if [ ! -f "$ENV_FILE" ]; then
  info "Creating $ENV_FILE..."
  # Detect current public IP for env values
  PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com || curl -sf https://api.ipify.org || echo "REPLACE_WITH_EC2_IP")
  cat > "$ENV_FILE" << EOF
# ── Phase 1: RudderStack ──────────────────────────────────────────────────────
RUDDERSTACK_DB_PASSWORD=rudder_secure_password_2024
RUDDERSTACK_WORKSPACE_TOKEN=local-self-hosted
RUDDERSTACK_WEBHOOK_SECRET=COXA_RUDDERSTACK_WEBHOOK_SECRET_CHANGE_ME

# ── Phase 1: PostHog ──────────────────────────────────────────────────────────
POSTHOG_DB_PASSWORD=posthog_secure_password_2024
POSTHOG_SECRET_KEY=coxa-posthog-prod-secret-change-this-now
POSTHOG_SITE_URL=https://posthog.service.coxa.live
POSTHOG_ENCRYPTION_SALT_KEYS=00beef1234beef1234beef1234beef12

# ── Phase 2: ClickHouse ───────────────────────────────────────────────────────
CLICKHOUSE_USER=coxa
CLICKHOUSE_PASSWORD=coxa_dev_password
CLICKHOUSE_DATABASE=coxa

# ── Phase 2: Cube Semantic Layer ──────────────────────────────────────────────
CUBE_API_SECRET=coxa-cube-dev-secret-change-in-prod

# ── Phase 2: Dagster ──────────────────────────────────────────────────────────
DAGSTER_DB_PASSWORD=dagster_dev_password
EOF
  log "Created $ENV_FILE"
else
  log ".env.cdp already exists"
  # Ensure Phase 2 vars are present (append if missing)
  for var in CLICKHOUSE_USER CLICKHOUSE_PASSWORD CLICKHOUSE_DATABASE CUBE_API_SECRET DAGSTER_DB_PASSWORD; do
    if ! grep -q "^${var}=" "$ENV_FILE"; then
      warn "Adding missing Phase 2 var: $var"
    fi
  done
  grep -q "^CLICKHOUSE_USER="    "$ENV_FILE" || echo "CLICKHOUSE_USER=coxa"                              >> "$ENV_FILE"
  grep -q "^CLICKHOUSE_PASSWORD=" "$ENV_FILE" || echo "CLICKHOUSE_PASSWORD=coxa_dev_password"            >> "$ENV_FILE"
  grep -q "^CLICKHOUSE_DATABASE=" "$ENV_FILE" || echo "CLICKHOUSE_DATABASE=coxa"                         >> "$ENV_FILE"
  grep -q "^CUBE_API_SECRET="    "$ENV_FILE" || echo "CUBE_API_SECRET=coxa-cube-dev-secret-change-in-prod" >> "$ENV_FILE"
  grep -q "^DAGSTER_DB_PASSWORD=" "$ENV_FILE" || echo "DAGSTER_DB_PASSWORD=dagster_dev_password"          >> "$ENV_FILE"
fi

# ─── Step 4: Start services ────────────────────────────────────────────────
info "Starting all CDP services (Phase 1 + Phase 2)..."
cd "$COXA_DIR"

docker compose -f docker-compose.cdp.yml --env-file .env.cdp pull 2>&1 | tail -3
docker compose -f docker-compose.cdp.yml --env-file .env.cdp up -d 2>&1

log "Services started"

# ─── Step 5: Wait for health ───────────────────────────────────────────────
echo ""
info "Waiting for services to become healthy (up to 5 minutes)..."

wait_for() {
  local name=$1 url=$2 max=$3
  for i in $(seq 1 $max); do
    if curl -sf "$url" &>/dev/null; then
      log "$name is UP"
      return 0
    fi
    printf "."
    sleep 5
  done
  echo ""
  warn "$name not ready after $((max * 5))s — check: docker logs $name"
  return 1
}

# Phase 1 health checks
wait_for "RudderStack Transformer" "http://localhost:9090/health"  12
wait_for "RudderStack Data-Plane"  "http://localhost:8080/health"  24
wait_for "PostHog"                 "http://localhost:8000/_health" 36

# Phase 2 health checks
wait_for "ClickHouse"  "http://localhost:8123/ping" 24
wait_for "Cube"        "http://localhost:4000/livez" 24
# Dagster webserver — probe TCP port 3030
DAGSTER_UP=false
for i in $(seq 1 24); do
  if nc -z localhost 3030 2>/dev/null; then
    log "Dagster is UP"
    DAGSTER_UP=true
    break
  fi
  printf "."
  sleep 5
done
if [ "$DAGSTER_UP" = false ]; then
  warn "Dagster not ready after 120s — check: docker logs dagster-webserver"
fi

# ─── Step 6: Show running containers ──────────────────────────────────────
echo ""
info "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ─── Step 7: Get PostHog project key (after first login) ──────────────────
PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com 2>/dev/null || echo "EC2_PUBLIC_IP")
echo ""
echo "════════════════════════════════════════════════════"
echo "  NEXT STEPS"
echo "════════════════════════════════════════════════════"
echo ""
echo "  ── Phase 1 ──────────────────────────────────────"
echo "  1. Open PostHog: https://posthog.service.coxa.live"
echo "     (or http://$PUBLIC_IP:8000 directly)"
echo ""
echo "  2. Create your PostHog account (one-time setup)"
echo "     Email: admin@coxa.io  (or any you prefer)"
echo ""
echo "  3. After login: Settings → Project → Project API Key"
echo "     Copy the key (starts with phc_...)"
echo ""
echo "  4. RudderStack data-plane: http://$PUBLIC_IP:8080"
echo "     Write key (web):     rws_2cb392007d9b69839f418856bfa09a7d2e296419"
echo "     Write key (backend): rbs_36b0b76d1de95af77a05ca30fc46328cf70b07af"
echo ""
echo "  ── Phase 2 ──────────────────────────────────────"
echo "  5. ClickHouse HTTP: http://localhost:8123/ping  (internal only)"
echo "     ClickHouse TCP:  localhost:9000"
echo "     Database: coxa   User: coxa"
echo ""
echo "  6. Cube Semantic Layer: http://localhost:4000  (internal only)"
echo "     Playground: http://localhost:3000"
echo "     API Secret: (set in .env.cdp as CUBE_API_SECRET)"
echo ""
echo "  7. Dagster UI: http://localhost:3030  (internal only)"
echo "     Pipelines: mv_refresh (30min), fan_360_refresh (hourly), ml_scoring (2am daily)"
echo ""
echo "  8. Test ClickHouse:"
echo "     curl http://localhost:8123/?query=SELECT+version()"
echo ""
