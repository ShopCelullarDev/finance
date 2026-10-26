from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.v1.endpoints import (
    assets,
    auth,
    backtest,
    health,
    news,
    paper_trading,
    signals,
    telemetry,
    websockets,
)

api_router = APIRouter()
# Lectura y escritura de mercado exigen sesión. Salud, login y el socket
# (que valida ticket aparte) quedan fuera de esta dependencia.
_session = [Depends(get_current_user)]

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación & Seguridad"])
api_router.include_router(health.router, tags=["Sistema & Salud"])
api_router.include_router(assets.router, prefix="/assets", tags=["Catálogo de Activos"], dependencies=_session)
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetría de Ingestores"], dependencies=_session)
api_router.include_router(signals.router, prefix="/signals", tags=["Señales Predictivas"], dependencies=_session)
api_router.include_router(backtest.router, prefix="/backtest", tags=["Backtesting & Walk-Forward"], dependencies=_session)
api_router.include_router(paper_trading.router, prefix="/paper", tags=["Paper Trading & Portfolio"], dependencies=_session)
api_router.include_router(news.router, prefix="/news", tags=["Noticias & NLP"], dependencies=_session)
api_router.include_router(websockets.router, prefix="/ws", tags=["WebSockets Gateway"])



