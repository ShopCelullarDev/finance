import asyncio
import json
from typing import Any, Dict, List, Optional
import redis.asyncio as aioredis
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_pool
from app.models.asset import Asset
from app.services.ingestion.base import BaseConnector
from app.services.ingestion.batch_buffer import AsyncTickBuffer
from app.services.ingestion.binance_ws import BinanceWSConnector
from app.services.ingestion.polymarket_gamma import PolymarketGammaConnector


class IngestionManager:
    """
    Orquestador principal de Ingesta (Vector 1: Exchanges y Mercados Predictivos).
    Coordina la recolección en tiempo real, publicación en Redis Pub/Sub y
    persistencia en bloques hacia TimescaleDB.
    """

    def __init__(self):
        self.tick_buffer = AsyncTickBuffer(batch_size=50, flush_interval=1.0)
        self.connectors: List[BaseConnector] = []
        self.asset_id_map: Dict[str, int] = {}
        self.redis_client: Optional[aioredis.Redis] = None
        self._is_running: bool = False

    async def initialize_assets_cache(self) -> None:
        """Carga en memoria los activos activos desde la base de datos."""
        async with AsyncSessionLocal() as session:
            stmt = select(Asset).where(Asset.is_active == True)
            result = await session.execute(stmt)
            assets = result.scalars().all()
            self.asset_id_map = {asset.symbol: asset.id for asset in assets}
            print(f"[IngestionManager] Caché de activos inicializada: {len(self.asset_id_map)} símbolos mapeados.")

    async def _on_tick_received(self, tick_payload: Dict[str, Any]) -> None:
        """
        Callback ejecutado en cada tick recibido:
        Publica el mensaje en canales de Redis Pub/Sub para clientes WebSockets.
        """
        if not self.redis_client:
            return

        try:
            symbol = tick_payload.get("symbol")
            payload_str = json.dumps(tick_payload)

            # Publicar en canal específico del activo (ej: ticks:BTC/USDT)
            channel = f"ticks:{symbol}"
            await self.redis_client.publish(channel, payload_str)

            # Publicar en canal global para ticker tapes
            await self.redis_client.publish("ticks:stream", payload_str)
        except Exception as e:
            print(f"[IngestionManager - PubSub ERROR] Fallo al publicar tick en Redis: {e}")

    async def start(self) -> None:
        """Inicia el buffer, los conectores y la conexión a Redis."""
        if self._is_running:
            return
        self._is_running = True

        print("[IngestionManager] Iniciando orquestador de ingesta...")
        await self.initialize_assets_cache()

        # 1. Iniciar cliente Redis
        self.redis_client = aioredis.Redis(connection_pool=redis_pool)

        # 2. Iniciar buffer de persistencia
        await self.tick_buffer.start()

        # 3. Inicializar conectores de Vector 1
        binance_conn = BinanceWSConnector(
            asset_id_map=self.asset_id_map,
            tick_buffer=self.tick_buffer,
            on_tick_callback=self._on_tick_received,
        )
        polymarket_conn = PolymarketGammaConnector(poll_interval=120.0)

        self.connectors = [binance_conn, polymarket_conn]

        # 4. Iniciar todos los conectores
        for conn in self.connectors:
            await conn.start()

        print(f"[IngestionManager] Orquestador activo con {len(self.connectors)} conectores.")

    async def stop(self) -> None:
        """Detiene de forma limpia todos los conectores y vacía el buffer."""
        self._is_running = False
        print("[IngestionManager] Deteniendo conectores de ingesta...")

        for conn in self.connectors:
            await conn.stop()

        await self.tick_buffer.stop()

        if self.redis_client:
            await self.redis_client.aclose()

        print("[IngestionManager] Ingesta detenida completamente.")

    def get_telemetry(self) -> Dict[str, Any]:
        """Retorna telemetría completa de conectores y buffer para el Panel de Monitoreo."""
        return {
            "manager_running": self._is_running,
            "tracked_assets_count": len(self.asset_id_map),
            "buffer_stats": self.tick_buffer.get_stats(),
            "connectors": [conn.get_metrics() for conn in self.connectors],
        }


# Instancia singleton del orquestador de ingesta
ingestion_manager = IngestionManager()
