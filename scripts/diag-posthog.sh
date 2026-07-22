#!/bin/bash
echo "=== Processes inside PostHog container ==="
sudo docker exec coxa-1touch-posthog-1 ps aux | grep -E 'gunicorn|nginx|python' | head -10
echo ""
echo "=== Memory usage ==="
free -h
echo ""
echo "=== PostHog direct health ==="
curl -sf -o /dev/null -w '%{http_code}' http://localhost:8000/_health; echo ''
echo ""
echo "=== Caddy logs (last 10) ==="
sudo docker logs caddy-ssl 2>&1 | tail -10
echo ""
echo "DIAG_DONE"
