#!/bin/bash
docker exec tracardi-api bash -c "
python3 << 'PYEOF'
import asyncio
import traceback

async def test_login():
    try:
        from tracardi.service.storage.driver.elastic import user as user_db
        from tracardi.context import ServerContext, get_context
        
        # Switch to staging context (same as token endpoint does)
        with ServerContext(get_context().switch_context(production=False)):
            print('Trying to get user...')
            user = await user_db.get_by_credentials(email='admin', password='admin')
            print('User:', user)
    except Exception as e:
        print('ERROR:', type(e).__name__, str(e))
        traceback.print_exc()

asyncio.run(test_login())
PYEOF
"
