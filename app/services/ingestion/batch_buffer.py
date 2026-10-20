import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import insert

from app.core.database import AsyncSessionLocal
from app.models.market_tick import MarketTick


class AsyncTickBuffer:
    """
    Buffer asíncrono en memoria para acumulación e inserción masiva (bulk insert)
    en la hipertabla market_ticks de TimescaleDB.
    """

    def __init__(self, batch_size: int = 50, flush_interval: float = 1.0):
        self.batch_size: int = batch_size
        self.flush_interval: float = flush_interval
        self._buffer: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._is_running: bool = False
        self._flush_task: asyncio.Task | None = None
        self.total_inserted: int = 0
        self.total_batches: int = 0
        self.failed_inserts: int = 0

    async def start(self) -> None:
        """Inicia el ciclo periódico de vaciado (flush) a TimescaleDB."""
        if self._is_running:
            return
        self._is_running = True
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def stop(self) -> None:
        """Detiene el buffer y vacía los registros pendientes."""
        self._is_running = False
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        # Vaciado final de remanentes
        await self.flush()

    async def add_tick(self, tick_data: Dict[str, Any]) -> None:
        """Añade un tick al buffer. Si se alcanza el batch_size, dispara un flush."""
        async with self._lock:
            self._buffer.append(tick_data)
            should_flush = len(self._buffer) >= self.batch_size

        if should_flush:
            await self.flush()

    async def flush(self) -> int:
        """Inserta en bloque todos los ticks acumulados en TimescaleDB."""
        async with self._lock:
            if not self._buffer:
                return 0
            items_to_insert = self._buffer[:]
            self._buffer.clear()

        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    stmt = insert(MarketTick).values(items_to_insert)
                    await session.execute(stmt)

            count = len(items_to_insert)
            self.total_inserted += count
            self.total_batches += 1
            return count
        except Exception as e:
            self.failed_inserts += len(items_to_insert)
            print(f"[AsyncTickBuffer - ERROR] Fallo al insertar lote de {len(items_to_insert)} ticks: {e}")
            # Reinsertar al inicio del buffer si fue error transitorio
            async with self._lock:
                self._buffer = items_to_insert + self._buffer
            return 0

    async def _flush_loop(self) -> None:
        """Bucle periódico en segundo plano que garantiza vaciado cada flush_interval."""
        while self._is_running:
            try:
                await asyncio.sleep(self.flush_interval)
                await self.flush()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[AsyncTickBuffer - Loop Exception] {e}")

    def get_stats(self) -> Dict[str, Any]:
        return {
            "current_buffer_size": len(self._buffer),
            "total_inserted": self.total_inserted,
            "total_batches": self.total_batches,
            "failed_inserts": self.failed_inserts,
        }
