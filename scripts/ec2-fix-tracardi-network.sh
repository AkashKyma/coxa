#!/bin/bash
# Fix Tracardi Redis connectivity issue
# tracardi-redis needs to be on the same network as tracardi-api

set -e

echo "=== Connecting tracardi-redis to coxa_services network ==="
docker network connect coxa_services tracardi-redis 2>/dev/null && echo "Connected" || echo "Already connected or error"

echo "=== Connecting tracardi-es to coxa_services network ==="
docker network connect coxa_services tracardi-es 2>/dev/null && echo "Connected" || echo "Already connected or error"

echo "=== Connecting tracardi-worker to coxa_services network ==="
docker network connect coxa_services tracardi-worker 2>/dev/null && echo "Connected" || echo "Already connected or error"

echo "=== Restarting tracardi-api to pick up new network routes ==="
docker restart tracardi-api

echo "=== Waiting 10 seconds for tracardi-api to be ready ==="
sleep 10

echo "=== Testing token endpoint ==="
curl -s -X POST http://localhost:8686/user/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" | head -c 500

echo ""
echo "=== Testing HTTPS endpoint ==="
curl -sk https://tracardi-api.service.coxa.live/ | head -c 200

echo ""
echo "=== Done ==="
