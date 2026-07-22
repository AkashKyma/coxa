#!/bin/bash
docker exec tracardi-api python3 << 'PYEOF'
from tracardi.config import redis_config
print("host:", redis_config.host)
print("port:", redis_config.port)
print("password:", repr(redis_config.redis_password))
try:
    print("full_url:", redis_config.get_redis_with_password())
except Exception as e:
    print("no get_redis_with_password:", e)
PYEOF
