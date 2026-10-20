from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class MarketTick(Base):
    __tablename__ = "market_ticks"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    source = Column(String(50), primary_key=True, nullable=False)
    price = Column(Numeric(18, 8), nullable=False)
    volume_24h = Column(Numeric(24, 8), nullable=True)
    bid_ask_spread = Column(Numeric(10, 6), nullable=True)

    # Relación hacia el activo
    asset = relationship("Asset", back_populates="ticks")

    def __repr__(self) -> str:
        return f"<MarketTick {self.source} asset_id={self.asset_id} price={self.price} at {self.time}>"
