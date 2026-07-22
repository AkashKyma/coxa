#!/bin/bash
docker exec tracardi-api python3 << 'PYEOF'
import asyncio
import traceback

async def test():
    try:
        from tracardi.config import redis_config
        print("Redis host:", redis_config.host)
        print("Redis port:", redis_config.port)  
        print("Redis password:", repr(redis_config.redis_password))
        
        from tracardi.service.storage.redis_client import RedisClient
        client = RedisClient()
        result = client.ping()
        print("Ping result:", result)
    except Exception as e:
        print("ERROR:", type(e).__name__, str(e))
        traceback.print_exc()

asyncio.run(test())
PYEOF
