import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
from typing import Callable, Dict, List, Optional
import websockets

from app.services.ingestion.base import BaseConnector
from app.services.ingestion.batch_buffer import AsyncTickBuffer


class BinanceWSConnector(BaseConnector):
    """
    Conector WebSocket persistente para streams en tiempo real de Binance (Vector 1).
    Captura precios, volumen 24h y spreads de compra/venta con reconexión automática.
    """

    DEFAULT_SYMBOLS_MAP = {
        "BTCUSDT": "BTC/USDT",
        "ETHUSDT": "ETH/USDT",
        "SOLUSDT": "SOL/USDT",
        "BNBUSDT": "BNB/USDT",
        "XRPUSDT": "XRP/USDT",
    }

    def __init__(
        self,
        asset_id_map: Dict[str, int],  # Mapeo: 'BTC/USDT' -> id en tabla assets
        tick_buffer: AsyncTickBuffer,
        on_tick_callback: Optional[Callable[[Dict], asyncio.Future]] = None,
        symbols_map: Optional[Dict[str, str]] = None,
    ):
        super().__init__(name="BINANCE_WSS")
        self.asset_id_map = asset_id_map
        self.tick_buffer = tick_buffer
        self.on_tick_callback = on_tick_callback
        self.symbols_map = symbols_map or self.DEFAULT_SYMBOLS_MAP
        self._task: Optional[asyncio.Task] = None

    def _build_stream_url(self) -> str:
        streams = [f"{sym.lower()}@ticker" for sym in self.symbols_map.keys()]
        return f"wss://stream.binance.com:9443/stream?streams={'/'.join(streams)}"

    async def start(self) -> None:
        """Inicia la tarea en segundo plano que mantiene la conexión WebSocket."""
        if self.is_running:
            return
        self.is_running = True
        self.started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._connection_loop())

    async def stop(self) -> None:
        """Detiene de forma limpia el socket y cancela la tarea."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print(f"[{self.name}] Conector detenido.")

    async def _connection_loop(self) -> None:
        """Bucle resiliente con reconexión automática y backoff exponencial."""
        url = self._build_stream_url()
        retry_delay = 1.0

        while self.is_running:
            try:
                print(f"[{self.name}] Conectando a Binance Stream: {url[:50]}...")
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    print(f"[{self.name}] Conexión WebSocket establecida con éxito.")
                    retry_delay = 1.0  # Reiniciar retardo de reconexión tras éxito

                    while self.is_running:
                        message = await ws.recv()
                        await self._process_message(message)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.record_error()
                print(f"[{self.name} - WARNING] Error en conexión: {e}. Reconectando en {retry_delay:.1f}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 30.0)

    async def _process_message(self, raw_msg: str | bytes) -> None:
        """Parsea el mensaje JSON de Binance y lo normaliza."""
        try:
            payload = json.loads(raw_msg)
            data = payload.get("data", {})
            binance_symbol = data.get("s")

            if not binance_symbol or binance_symbol not in self.symbols_map:
                return

            canonical_symbol = self.symbols_map[binance_symbol]
            asset_id = self.asset_id_map.get(canonical_symbol)

            if not asset_id:
                # Activo no encontrado en base de datos
                return

            event_time_ms = data.get("E", int(datetime.now(timezone.utc).timestamp() * 1000))
            event_time = datetime.fromtimestamp(event_time_ms / 1000.0, tz=timezone.utc)

            price = Decimal(str(data.get("c", "0")))
            volume_24h = Decimal(str(data.get("v", "0"))) if data.get("v") else None

            best_bid = Decimal(str(data.get("b", "0"))) if data.get("b") else None
            best_ask = Decimal(str(data.get("a", "0"))) if data.get("a") else None
            spread = (best_ask - best_bid) if (best_bid and best_ask and best_ask >= best_bid) else None

            # 1. Normalización para Hipertabla market_ticks
            tick_dict = {
                "time": event_time,
                "asset_id": asset_id,
                "source": "BINANCE",
                "price": price,
                "volume_24h": volume_24h,
                "bid_ask_spread": spread,
            }

            # 2. Agregar al buffer para inserción por lotes en TimescaleDB
            await self.tick_buffer.add_tick(tick_dict)
            self.record_event()

            # 3. Disparar callback (ej: difusión en Redis Pub/Sub)
            if self.on_tick_callback:
                ws_payload = {
                    "symbol": canonical_symbol,
                    "asset_id": asset_id,
                    "source": "BINANCE",
                    "price": float(price),
                    "volume_24h": float(volume_24h) if volume_24h else None,
                    "bid_ask_spread": float(spread) if spread else None,
                    "time": event_time.isoformat(),
                }
                await self.on_tick_callback(ws_payload)

        except Exception as e:
            self.record_error()
            print(f"[{self.name} - ERROR] Error al parsear tick: {e}")
