from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class BaseConnector(ABC):
    """Clase base abstracta para todos los conectores de ingesta de datos."""

    def __init__(self, name: str):
        self.name: str = name
        self.is_running: bool = False
        self.events_count: int = 0
        self.error_count: int = 0
        self.last_event_time: Optional[datetime] = None
        self.started_at: Optional[datetime] = None

    @abstractmethod
    async def start(self) -> None:
        """Inicia el bucle asíncrono de recolección."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Detiene de forma segura el conector y libera sockets/recursos."""
        pass

    def record_event(self) -> None:
        """Registra la recepción exitosa de un evento/tick."""
        self.events_count += 1
        self.last_event_time = datetime.now(timezone.utc)

    def record_error(self) -> None:
        """Registra un error o desconexión en el conector."""
        self.error_count += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Retorna telemetría en tiempo real sobre el estado del conector."""
        now = datetime.now(timezone.utc)
        uptime_seconds = (now - self.started_at).total_seconds() if self.started_at else 0
        throughput = (self.events_count / uptime_seconds) if uptime_seconds > 0 else 0.0

        return {
            "name": self.name,
            "is_running": self.is_running,
            "events_count": self.events_count,
            "error_count": self.error_count,
            "throughput_eps": round(throughput, 2),
            "last_event_time": self.last_event_time.isoformat() if self.last_event_time else None,
            "uptime_seconds": round(uptime_seconds, 1),
        }
