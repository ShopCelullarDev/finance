from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, status
from sqlalchemy import text
import redis.asyncio as aioredis

from app.core.database import engine
from app.core.redis import redis_pool
from app.services.ingestion.manager import ingestion_manager

router = APIRouter()


def _category_for(name: str) -> str:
    upper = name.upper()
    if "BINANCE" in upper:
        return "Vector 1: Exchanges"
    if "POLYMARKET" in upper:
        return "Vector 1: Prediction"
    return "Ingesta"


async def _probe_database() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def _probe_redis() -> bool:
    client = aioredis.Redis(connection_pool=redis_pool)
    try:
        await client.ping()
        return True
    except Exception:
        return False
    finally:
        await client.aclose()


@router.get(
    "/overview",
    status_code=status.HTTP_200_OK,
    summary="Resumen Global de Telemetría del Sistema",
    description="Estado real de base, Redis y conectores arrancados en este proceso. No inventa fuentes.",
)
async def get_overview_telemetry() -> Dict[str, Any]:
    raw_ingestion = ingestion_manager.get_telemetry()
    buffer_stats = raw_ingestion.get("buffer_stats", {})
    connectors = raw_ingestion.get("connectors", [])

    sources = []
    for conn in connectors:
        name = str(conn.get("name") or "Conector")
        sources.append({
            "id": name.lower().replace(" ", "_"),
            "name": name,
            "category": _category_for(name),
            "status": "ONLINE" if conn.get("is_running") else "OFFLINE",
            "latency_ms": None,
            "last_event_at": conn.get("last_event_time"),
            "error_count": conn.get("error_count", 0),
            "rate_per_second": conn.get("throughput_eps", 0.0),
            "total_events": conn.get("events_count", 0),
        })

    return {
        "database_connected": await _probe_database(),
        "redis_connected": await _probe_redis(),
        "ticks_ingested_total": int(buffer_stats.get("total_inserted") or 0),
        "signals_generated_total": None,
        "active_websocket_clients": None,
        "hypertable_chunks_total": None,
        "compressed_chunks": None,
        "sources": sources,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/ingestion",
    status_code=status.HTTP_200_OK,
    summary="Telemetría de Ingestores en Tiempo Real",
    description="Retorna el estado de conectividad, throughput (EPS), eventos procesados y estado del buffer.",
)
async def get_ingestion_telemetry() -> Dict[str, Any]:
    return ingestion_manager.get_telemetry()


@router.post(
    "/ingestion/start",
    status_code=status.HTTP_200_OK,
    summary="Iniciar Ingestores de Datos",
    description="Inicia la recolección en tiempo real de Binance WebSocket y Polymarket.",
)
async def start_ingestion() -> Dict[str, Any]:
    await ingestion_manager.start()
    return {"message": "Ingestores iniciados con éxito", "status": ingestion_manager.get_telemetry()}


@router.post(
    "/ingestion/stop",
    status_code=status.HTTP_200_OK,
    summary="Detener Ingestores de Datos",
    description="Detiene los sockets y vacía el buffer de persistencia.",
)
async def stop_ingestion() -> Dict[str, Any]:
    await ingestion_manager.stop()
    return {"message": "Ingestores detenidos con éxito", "status": ingestion_manager.get_telemetry()}
