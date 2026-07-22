#!/bin/bash
set -e
echo "=== Waiting for Multiwoven server to become healthy ==="
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' multiwoven-server 2>/dev/null || echo "not_found")
  echo "  [$i/15] multiwoven-server: $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo "  Multiwoven server is healthy!"
    break
  fi
  sleep 10
done

echo ""
echo "=== Starting Multiwoven worker + UI ==="
cd /home/ubuntu/coxa-1touch
docker compose -f docker-compose.multiwoven.yml --env-file .env.cdp up -d 2>&1

echo ""
echo "=== Dagster webserver logs ==="
docker logs coxa-1touch-dagster-webserver-1 2>&1 | tail -8
echo "Dagster port 3030:"
nc -zv localhost 3030 2>&1 || echo "  Dagster port 3030 not open"

echo ""
echo "=== Final container status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1

echo ""
echo "=== Disk ==="
df -h /
