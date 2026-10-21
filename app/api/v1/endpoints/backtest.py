import json
import os
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.services.ai.backtester import backtester

router = APIRouter()

RESULTS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "services", "ai", "models", "backtest_results.json"
)


@router.get(
    "/latest",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Obtener Último Reporte de Backtest y Matriz Walk-Forward",
    description="Recupera las métricas de rendimiento financiero y consistencia out-of-sample más recientes.",
)
async def get_latest_backtest() -> Dict[str, Any]:
    if os.path.exists(RESULTS_FILE):
        try:
            with open(RESULTS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al leer resultados de backtest: {e}")

    # Si no existe, ejecutar un backtest inicial
    try:
        results = await backtester.run_backtest(max_ticks=8000, min_ml_confidence=52.0, walk_forward_folds=4)
        os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
        with open(RESULTS_FILE, "w") as f:
            json.dump(results, f, indent=2)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ejecutando backtest: {e}")


@router.post(
    "/run",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Disparar Nuevo Backtest Vectorizado",
    description="Ejecuta una simulación completa sobre el activo especificado con comisiones, slippage y matriz Walk-Forward.",
)
async def run_new_backtest(
    symbol: str = Query("BTC/USDT", description="Par a testear"),
    initial_capital: float = Query(10000.0, ge=100.0, le=10000000.0, description="Capital inicial en USDT"),
    max_ticks: int = Query(15000, ge=1000, le=50000, description="Cantidad de ticks históricos"),
    min_confidence: float = Query(52.0, ge=40.0, le=95.0, description="Umbral mínimo de confianza ML"),
    folds: int = Query(4, ge=2, le=10, description="Ventanas para la matriz Walk-Forward"),
) -> Dict[str, Any]:
    try:
        bt = backtester
        if symbol != bt.asset_symbol or initial_capital != bt.initial_capital:
            from app.services.ai.backtester import VectorizedBacktester
            bt = VectorizedBacktester(asset_symbol=symbol, initial_capital=initial_capital)

        results = await bt.run_backtest(
            max_ticks=max_ticks,
            min_ml_confidence=min_confidence,
            walk_forward_folds=folds,
        )

        os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
        with open(RESULTS_FILE, "w") as f:
            json.dump(results, f, indent=2)

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la simulación de backtesting: {e}")
