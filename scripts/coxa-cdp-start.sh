#!/bin/bash
# Coxa CDP boot script — starts all services (Phase 1-4)
LOG=/var/log/coxa-boot.log
exec >> "$LOG" 2>&1
echo "[$(date)] Starting Coxa CDP services"

# Wait for Docker daemon
for i in $(seq 1 20); do
  docker info >/dev/null 2>&1 && break
  echo "  waiting for Docker ($i)..."
  sleep 3
done

cd /home/ubuntu/coxa-1touch

# Phase 1+2
docker compose -f docker-compose.cdp.yml --env-file .env.cdp up -d 2>&1
echo "[$(date)] Phase 1+2 (RudderStack, PostHog, ClickHouse, Cube, Dagster) started"

# Phase 3 — Tracardi
docker compose -f docker-compose.tracardi.yml --env-file .env.cdp up -d 2>&1
echo "[$(date)] Phase 3 (Tracardi) started"

# Phase 4 — Multiwoven
docker compose -f docker-compose.multiwoven.yml --env-file .env.cdp up -d 2>&1
echo "[$(date)] Phase 4 (Multiwoven) started"

echo "[$(date)] All CDP services started successfully"
