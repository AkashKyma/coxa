#!/bin/bash
# Test Redis + Tracardi token generation

echo "=== Redis direct test ==="
docker exec tracardi-api python3 -c "
import redis
r = redis.Redis(host='172.19.0.2', port=6379, decode_responses=True)
print('Redis ping:', r.ping())
"

echo ""
echo "=== Check Tracardi token module ==="
docker exec tracardi-api python3 -c "
import os
print('REDIS_HOST env:', os.environ.get('REDIS_HOST'))
"

echo ""
echo "=== Find auth.py in Tracardi ==="
docker exec tracardi-api find /app -name '*.py' | xargs grep -l 'Redis authentication\|token_secret\|TOKEN_SECRET' 2>/dev/null | head -5

echo ""
echo "=== Check what Tracardi does with Redis for tokens ==="
docker exec tracardi-api grep -r "Redis authentication" /app 2>/dev/null | head -5
docker exec tracardi-api grep -r "token_secret\|TOKEN_SECRET\|secret_key" /app 2>/dev/null | grep -i redis | head -10
