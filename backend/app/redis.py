import redis.asyncio as aioredis
from app.config import settings

# Global Redis client
# decode_responses=True means Redis returns strings instead of bytes
redis_client = aioredis.from_url(
    settings.REDIS_URL,
    decode_responses=True
)

async def get_redis():
    return redis_client