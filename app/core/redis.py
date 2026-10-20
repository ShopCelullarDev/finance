from typing import AsyncGenerator
import redis.asyncio as aioredis
from app.core.config import settings

# Pool de conexiones Redis asíncrono
redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=20,
    decode_responses=True,
)


def get_redis_client() -> aioredis.Redis:
    """Obtiene una instancia del cliente Redis."""
    return aioredis.Redis(connection_pool=redis_pool)


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """Inyector de dependencia FastAPI para cliente Redis."""
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()
