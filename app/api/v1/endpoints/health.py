from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Verificación de Salud del Sistema",
    description="Comprueba la conectividad activa con TimescaleDB y Redis.",
)
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> HealthResponse:
    # 1. Comprobar TimescaleDB
    db_connected = False
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            db_connected = True
    except Exception:
        db_connected = False

    # 2. Comprobar Redis
    redis_connected = False
    try:
        pong = await redis_client.ping()
        if pong:
            redis_connected = True
    except Exception:
        redis_connected = False

    overall_status = "ok" if (db_connected and redis_connected) else "degraded"

    return HealthResponse(
        status=overall_status,
        environment=settings.ENVIRONMENT,
        database_connected=db_connected,
        redis_connected=redis_connected,
        timestamp=datetime.now(timezone.utc),
    )
