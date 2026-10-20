from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.asset import Asset
from app.models.predictive_signal import PredictiveSignal
from app.schemas.predictive_signal import PredictiveSignalResponse
from app.services.ai.signal_engine import signal_engine

router = APIRouter()


@router.get(
    "/",
    response_model=List[PredictiveSignalResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Señales Predictivas Recientes",
    description="Recupera las señales generadas por el motor cuantitativo de IA con soporte de filtrado.",
)
async def list_signals(
    symbol: Optional[str] = Query(None, description="Filtrar por ticker (ej: BTC/USDT)"),
    action: Optional[str] = Query(None, description="Filtrar por acción (BUY, STRONG_BUY, SELL, HOLD)"),
    timeframe: Optional[str] = Query(None, description="Filtrar por marco temporal (1m, 5m, 1h, 1d)"),
    limit: int = Query(25, ge=1, le=100, description="Cantidad máxima de señales a retornar"),
    db: AsyncSession = Depends(get_db),
) -> List[PredictiveSignal]:
    query = select(PredictiveSignal).order_by(desc(PredictiveSignal.generated_at))

    if symbol:
        asset_stmt = select(Asset.id).where(Asset.symbol == symbol)
        asset_res = await db.execute(asset_stmt)
        asset_id = asset_res.scalar_one_or_none()
        if not asset_id:
            raise HTTPException(status_code=404, detail=f"Activo '{symbol}' no encontrado.")
        query = query.where(PredictiveSignal.asset_id == asset_id)

    if action:
        query = query.where(PredictiveSignal.action_suggested == action.upper())
    if timeframe:
        query = query.where(PredictiveSignal.timeframe == timeframe)

    query = query.limit(limit)
    res = await db.execute(query)
    return list(res.scalars().all())


@router.post(
    "/evaluate/{symbol:path}",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Disparar Evaluación Cuantitativa de un Activo",
    description="Ejecuta de inmediato el motor de IA para correlacionar ticks y noticias del activo.",
)
async def evaluate_signal(
    symbol: str,
    timeframe: str = Query("5m", description="Timeframe a evaluar"),
    macro_bias: float = Query(0.0, ge=-1.0, le=1.0, description="Sesgo macro opcional"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    asset_stmt = select(Asset).where(Asset.symbol == symbol)
    asset_res = await db.execute(asset_stmt)
    asset = asset_res.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail=f"Activo con símbolo '{symbol}' no existe.")

    signal = await signal_engine.evaluate_asset_signal(
        asset=asset,
        timeframe=timeframe,
        macro_bias=macro_bias,
    )

    if not signal:
        raise HTTPException(
            status_code=400,
            detail=f"No hay suficientes ticks recientes para generar una señal sobre '{symbol}'.",
        )

    return signal
