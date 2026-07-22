#!/bin/bash
set -e

echo "=== NETWORK MEMBERSHIP ==="
echo "tracardi-api networks:"
docker inspect tracardi-api | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; nets=list(d['NetworkSettings']['Networks'].keys()); print(nets)"

echo "tracardi-gui networks:"
docker inspect tracardi-gui | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; nets=list(d['NetworkSettings']['Networks'].keys()); print(nets)"

echo "caddy (posthog-proxy) networks:"
docker inspect coxa-1touch-posthog-proxy-1 | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; nets=list(d['NetworkSettings']['Networks'].keys()); print(nets)"

echo ""
echo "=== TRACARDI ENV ==="
docker inspect tracardi-api | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; [print(e) for e in d['Config']['Env'] if 'REDIS' in e or 'ELASTIC' in e or 'HOST' in e]"

echo ""
echo "=== REDIS PING TEST ==="
docker exec tracardi-redis redis-cli ping

echo ""
echo "=== TRACARDI API TOKEN (direct) ==="
curl -s -X POST http://localhost:8686/user/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" | head -c 300

echo ""
echo "=== ALL NETWORKS ==="
docker network ls
