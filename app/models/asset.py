from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(30), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    ticks = relationship("MarketTick", back_populates="asset", cascade="all, delete-orphan", lazy="selectin")
    signals = relationship("PredictiveSignal", back_populates="asset", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Asset {self.symbol} ({self.asset_type})>"
