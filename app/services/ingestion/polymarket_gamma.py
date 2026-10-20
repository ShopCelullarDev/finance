import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.services.ingestion.base import BaseConnector


class PolymarketGammaConnector(BaseConnector):
    """
    Conector para Polymarket Gamma API (Vector 1 - Mercados Predictivos).
    Recopila probabilidades de mercado, eventos macroeconómicos y sentimiento de traders.
    """

    def __init__(
        self,
        poll_interval: float = 60.0,
        api_url: Optional[str] = None,
    ):
        super().__init__(name="POLYMARKET_GAMMA")
        self.api_url = (api_url or settings.POLYMARKET_GAMMA_API_URL).rstrip("/")
        self.poll_interval = poll_interval
        self._task: Optional[asyncio.Task] = None
        self._cached_markets: List[Dict[str, Any]] = []

    async def start(self) -> None:
        """Inicia el sondeo periódico de eventos y mercados predictivos."""
        if self.is_running:
            return
        self.is_running = True
        self.started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Detiene el conector."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print(f"[{self.name}] Conector detenido.")

    async def fetch_active_markets(self, limit: int = 15) -> List[Dict[str, Any]]:
        """Consulta la API de Gamma y extrae mercados predictivos activos."""
        endpoint = f"{self.api_url}/events"
        params = {
            "limit": limit,
            "active": "true",
            "closed": "false",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(endpoint, params=params)
            response.raise_for_status()
            events = response.json()

        normalized_events = []
        for ev in events:
            title = ev.get("title", "")
            description = ev.get("description", "")
            volume = ev.get("volume", 0)
            markets = ev.get("markets", [])

            market_summary = []
            for m in markets:
                question = m.get("question", "")
                outcome_prices = m.get("outcomePrices")  # Ej: '["0.65", "0.35"]'
                outcomes = m.get("outcomes")              # Ej: '["Yes", "No"]'
                market_summary.append({
                    "question": question,
                    "outcomes": outcomes,
                    "prices": outcome_prices,
                })

            normalized_events.append({
                "id": ev.get("id"),
                "title": title,
                "description": description[:120] if description else "",
                "volume": volume,
                "markets": market_summary,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

        self.record_event()
        self._cached_markets = normalized_events
        return normalized_events

    async def _poll_loop(self) -> None:
        """Bucle en segundo plano de consulta periódica."""
        while self.is_running:
            try:
                await self.fetch_active_markets()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.record_error()
                print(f"[{self.name} - WARNING] Error al consultar Polymarket: {e}")

            await asyncio.sleep(self.poll_interval)

    def get_latest_markets(self) -> List[Dict[str, Any]]:
        """Retorna los últimos mercados en memoria."""
        return self._cached_markets
