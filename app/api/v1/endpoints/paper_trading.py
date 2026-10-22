from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.asset import Asset
from app.models.market_tick import MarketTick
from app.models.paper_trading import PaperAccount, PaperEquitySnapshot, PaperPosition
from app.schemas.paper_trading import (
    ClosePositionRequest,
    OpenPositionRequest,
    PaperAccountResponse,
    PaperEquitySnapshotResponse,
    PaperPositionResponse,
    PositionSizingCalculationRequest,
    PositionSizingResponse,
    OrderDispatcherConfigRequest,
)
from app.services.trading.portfolio_manager import PortfolioManager
from app.services.trading.order_dispatcher import order_dispatcher

router = APIRouter()
portfolio_manager = PortfolioManager()



async def _resolve_latest_price(db: AsyncSession, symbol: str, fallback_price: Optional[float] = None) -> float:
    """Obtiene el precio más reciente de mercado desde la hipertabla de ticks."""
    if fallback_price is not None and fallback_price > 0:
        return fallback_price

    tick_stmt = (
        select(MarketTick.price)
        .join(Asset, MarketTick.asset_id == Asset.id)
        .where(Asset.symbol == symbol)
        .order_by(desc(MarketTick.time))
        .limit(1)
    )
    res = await db.execute(tick_stmt)
    latest_price = res.scalar_one_or_none()
    if latest_price is not None and float(latest_price) > 0:
        return float(latest_price)

    # Fallback predeterminado por activo si aún no hay ticks cargados
    fallbacks = {
        "BTC/USDT": 67500.0,
        "ETH/USDT": 2650.0,
        "SOL/USDT": 155.0,
        "BNB/USDT": 590.0,
        "XRP/USDT": 0.55,
    }
    return fallbacks.get(symbol, 100.0)


@router.get(
    "/account",
    response_model=PaperAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Resumen de Cuenta de Paper Trading",
    description="Devuelve el balance, margen, PnL flotante, capital total y KPIs consolidados.",
)
async def get_paper_account(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    account = await portfolio_manager.get_or_create_default_account(db)
    summary = await portfolio_manager.get_account_summary(db, account.id)
    return summary


@router.get(
    "/positions/open",
    response_model=List[PaperPositionResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Posiciones Abiertas",
    description="Devuelve todas las posiciones activas con su PnL flotante y trailing stop.",
)
async def list_open_positions(
    db: AsyncSession = Depends(get_db),
) -> List[PaperPosition]:
    account = await portfolio_manager.get_or_create_default_account(db)
    return await portfolio_manager.get_open_positions(db, account.id)


@router.get(
    "/positions/history",
    response_model=List[PaperPositionResponse],
    status_code=status.HTTP_200_OK,
    summary="Historial de Trades Cerrados",
    description="Devuelve el libro de órdenes y transacciones liquidadas para auditoría.",
)
async def list_closed_positions(
    limit: int = Query(50, ge=1, le=200, description="Cantidad máxima de trades"),
    db: AsyncSession = Depends(get_db),
) -> List[PaperPosition]:
    account = await portfolio_manager.get_or_create_default_account(db)
    return await portfolio_manager.get_closed_positions(db, account.id, limit=limit)


@router.get(
    "/equity-curve",
    response_model=List[PaperEquitySnapshotResponse],
    status_code=status.HTTP_200_OK,
    summary="Curva de Capital (Equity Curve)",
    description="Recupera la serie temporal de snapshots de capital para renderizar el gráfico.",
)
async def get_equity_curve(
    limit: int = Query(100, ge=10, le=500, description="Puntos de la curva"),
    db: AsyncSession = Depends(get_db),
) -> List[PaperEquitySnapshot]:
    account = await portfolio_manager.get_or_create_default_account(db)
    return await portfolio_manager.get_equity_curve(db, account.id, limit=limit)


@router.post(
    "/calculate-sizing",
    response_model=PositionSizingResponse,
    status_code=status.HTTP_200_OK,
    summary="Simular Dimensionamiento de Posición (Position Sizing)",
    description="Calcula tamaño óptimo, margen requerido y relación R/R antes de colocar la orden.",
)
async def calculate_position_sizing(
    req: PositionSizingCalculationRequest,
    db: AsyncSession = Depends(get_db),
) -> PositionSizingResponse:
    account = await portfolio_manager.get_or_create_default_account(db)
    return await portfolio_manager.calculate_sizing_for_order(
        db=db,
        account_id=account.id,
        symbol=req.symbol,
        side=req.side,
        entry_price=req.entry_price,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
        risk_pct=req.risk_pct,
    )


@router.post(
    "/positions/open",
    response_model=PaperPositionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir Posición Simulada",
    description="Ejecuta una orden simulada con dimensionamiento de riesgo institucional y deducción de margen.",
)
async def open_simulated_position(
    req: OpenPositionRequest,
    price: Optional[float] = Query(None, description="Precio de mercado (opcional, si es None se toma el último tick)"),
    db: AsyncSession = Depends(get_db),
) -> PaperPosition:
    account = await portfolio_manager.get_or_create_default_account(db)
    market_price = await _resolve_latest_price(db, req.symbol, fallback_price=price)

    try:
        position = await portfolio_manager.open_position(
            db=db,
            account_id=account.id,
            req=req,
            current_market_price=market_price,
        )
        return position
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error abriendo posición: {e}")


@router.post(
    "/positions/{position_id}/close",
    response_model=PaperPositionResponse,
    status_code=status.HTTP_200_OK,
    summary="Cerrar Posición Manualmente",
    description="Liquida una posición abierta, calcula PnL neto y libera el margen a la cartera.",
)
async def close_simulated_position(
    position_id: UUID,
    req: Optional[ClosePositionRequest] = None,
    exit_price: Optional[float] = Query(None, description="Precio de salida explícito (opcional)"),
    db: AsyncSession = Depends(get_db),
) -> PaperPosition:
    # Buscar símbolo de la posición para resolver precio de salida si no se provee
    pos_stmt = select(PaperPosition).where(PaperPosition.id == position_id)
    pos_res = await db.execute(pos_stmt)
    pos = pos_res.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail=f"Posición {position_id} no encontrada.")

    final_exit_price = await _resolve_latest_price(db, pos.symbol, fallback_price=exit_price)
    reason = req.close_reason if req and req.close_reason else "MANUAL_EXIT"

    try:
        closed_position = await portfolio_manager.close_position(
            db=db,
            position_id=position_id,
            exit_price=final_exit_price,
            reason=reason,
        )
        return closed_position
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error cerrando posición: {e}")


@router.post(
    "/account/reset",
    response_model=PaperAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Reiniciar Cuenta de Paper Trading",
    description="Restaura la cuenta de paper trading a su balance inicial de $10,000 USDT y limpia estadísticas.",
)
async def reset_paper_account(
    initial_balance: float = Query(10000.0, ge=100.0, le=1000000.0, description="Saldo inicial en USDT"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    account = await portfolio_manager.get_or_create_default_account(db)
    await portfolio_manager.reset_account(db, account.id, initial_balance=initial_balance)
    return await portfolio_manager.get_account_summary(db, account.id)


# -----------------------------------------------------------------------------
# Control y Telemetría del Order Dispatcher (Fase 7.2 & 7.3)
# -----------------------------------------------------------------------------

@router.get(
    "/dispatcher/status",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Estado del Despachador Automático",
    description="Devuelve telemetría, estadísticas de señales filtradas/ejecutadas y parámetros de confluencia.",
)
async def get_dispatcher_status() -> Dict[str, Any]:
    return order_dispatcher.get_status()


@router.post(
    "/dispatcher/start",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Iniciar Worker de Auto-Ejecución",
    description="Activa la escucha de signals:stream y ticks:stream en segundo plano.",
)
async def start_dispatcher() -> Dict[str, Any]:
    await order_dispatcher.start()
    return order_dispatcher.get_status()


@router.post(
    "/dispatcher/stop",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Detener Worker de Auto-Ejecución",
    description="Pausa la escucha y auto-ejecución de órdenes simuladas.",
)
async def stop_dispatcher() -> Dict[str, Any]:
    await order_dispatcher.stop()
    return order_dispatcher.get_status()


@router.post(
    "/dispatcher/config",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Configurar Parámetros del Despachador",
    description="Permite ajustar umbral de confianza, riesgo por trade, slippage o pausar el auto-trading.",
)
async def update_dispatcher_config(
    cfg: OrderDispatcherConfigRequest,
) -> Dict[str, Any]:
    return order_dispatcher.update_config(
        auto_trade_enabled=cfg.auto_trade_enabled,
        min_confidence=cfg.min_confidence,
        risk_per_trade_pct=cfg.risk_per_trade_pct,
        trade_amount_usd=cfg.trade_amount_usd,
        target_profit_pct=cfg.target_profit_pct,
        asset_selection_mode=cfg.asset_selection_mode,
        selected_symbol=cfg.selected_symbol,
        compound_interest_enabled=cfg.compound_interest_enabled,
        require_ml_agreement=cfg.require_ml_agreement,
        require_ofi_confluence=cfg.require_ofi_confluence,
        avoid_squeeze_regime=cfg.avoid_squeeze_regime,
        default_taker_slippage_bps=cfg.default_taker_slippage_bps,
        allowed_symbols=cfg.allowed_symbols,
    )

