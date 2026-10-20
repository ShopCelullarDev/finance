from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.redis import redis_pool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Ciclo de vida de la aplicación: inicialización y apagado de conexiones."""
    # 1. Startup: Verificar conexión a TimescaleDB
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("[Startup] Conexión a TimescaleDB establecida con éxito.")
    except Exception as e:
        print(f"[Startup - WARNING] Error al conectar a TimescaleDB: {e}")

    # 2. Startup: Inicializar pool de Redis
    try:
        import redis.asyncio as aioredis
        client = aioredis.Redis(connection_pool=redis_pool)
        await client.ping()
        await client.aclose()
        print("[Startup] Conexión a Redis establecida con éxito.")
    except Exception as e:
        print(f"[Startup - WARNING] Error al conectar a Redis: {e}")

    # 3. Startup: Iniciar IngestionManager (Vector 1: Exchanges y Mercados Predictivos)
    try:
        from app.services.ingestion.manager import ingestion_manager
        await ingestion_manager.start()
        print("[Startup] IngestionManager Vector 1 iniciado con éxito.")
    except Exception as e:
        print(f"[Startup - WARNING] Error al iniciar IngestionManager: {e}")

    yield

    # Shutdown: Cerrar IngestionManager, pools y conexiones
    print("[Shutdown] Cerrando IngestionManager y pools de conexiones...")
    try:
        from app.services.ingestion.manager import ingestion_manager
        await ingestion_manager.stop()
    except Exception as e:
        print(f"[Shutdown - WARNING] Error al detener IngestionManager: {e}")

    await engine.dispose()
    await redis_pool.disconnect()
    print("[Shutdown] Conexiones finalizadas limpiamente.")



app = FastAPI(
    title="Motor Predictivo de Tendencias Web (Cripto & Macro)",
    description=(
        "API asíncrona de alta frecuencia para ingesta de datos de mercado, "
        "análisis de sentimiento NLP en noticias y generación de señales predictivas con IA."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# Configuración de CORS para Terminal Frontend y Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint raíz de salud
app.include_router(health_router, prefix="", tags=["Salud Directa"])

# Rutas bajo versión /api/v1
app.include_router(api_router, prefix="/api/v1")

# Gateway de WebSockets directo en /ws/live
from app.api.v1.endpoints.websockets import router as ws_router
app.include_router(ws_router, prefix="/ws", tags=["WebSockets"])



@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Market Predictive Engine API is running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "api_v1": "/api/v1",
    }
