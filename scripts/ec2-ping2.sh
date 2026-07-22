#!/bin/bash
docker exec tracardi-api bash -c "
python3 << 'PYEOF'
import traceback
try:
    from tracardi.config import redis_config
    print('Redis host:', redis_config.host)
    print('Redis port:', redis_config.port)
    print('Redis password:', repr(redis_config.redis_password))
    from tracardi.service.storage.redis_client import RedisClient
    c = RedisClient()
    print('ping:', c.ping())
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
    traceback.print_exc()
PYEOF
"
