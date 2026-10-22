from fastapi import APIRouter

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

# Inclusión de submódulos
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación & Seguridad"])
api_router.include_router(health.router, tags=["Sistema & Salud"])
api_router.include_router(assets.router, prefix="/assets", tags=["Catálogo de Activos"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetría de Ingestores"])
api_router.include_router(signals.router, prefix="/signals", tags=["Señales Predictivas"])
api_router.include_router(backtest.router, prefix="/backtest", tags=["Backtesting & Walk-Forward"])
api_router.include_router(paper_trading.router, prefix="/paper", tags=["Paper Trading & Portfolio"])
api_router.include_router(news.router, prefix="/news", tags=["Noticias & NLP"])
api_router.include_router(websockets.router, prefix="/ws", tags=["WebSockets Gateway"])



