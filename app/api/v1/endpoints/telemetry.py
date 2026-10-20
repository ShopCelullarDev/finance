from typing import Any, Dict
from fastapi import APIRouter, status

from app.services.ingestion.manager import ingestion_manager

router = APIRouter()


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
