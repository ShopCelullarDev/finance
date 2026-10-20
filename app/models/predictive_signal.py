from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class PredictiveSignal(Base):
    __tablename__ = "predictive_signals"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    generated_at = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    timeframe = Column(String(10), nullable=False)
    action_suggested = Column(String(20), nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=False)
    entry_price = Column(Numeric(18, 8), nullable=True)
    stop_loss = Column(Numeric(18, 8), nullable=True)
    take_profit = Column(Numeric(18, 8), nullable=True)
    trigger_factors = Column(JSONB, nullable=False)

    # Relación hacia el activo
    asset = relationship("Asset", back_populates="signals")

    def __repr__(self) -> str:
        return f"<PredictiveSignal {self.action_suggested} ({self.timeframe}) confidence={self.confidence_score}%>"
