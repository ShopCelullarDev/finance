import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PaperAccount(Base):
    __tablename__ = "paper_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(50), nullable=False, default="Cuenta Principal Paper Trading")
    account_type = Column(String(20), nullable=False, default="SIMULATED", index=True)  # 'SIMULATED' (Ficticio) o 'REAL' (En Vivo)
    initial_balance = Column(Numeric(18, 4), nullable=False, default=10000.0000)
    current_balance = Column(Numeric(18, 4), nullable=False, default=10000.0000)
    allocated_margin = Column(Numeric(18, 4), nullable=False, default=0.0000)
    realized_pnl = Column(Numeric(18, 4), nullable=False, default=0.0000)
    total_trades = Column(Integer, nullable=False, default=0)
    winning_trades = Column(Integer, nullable=False, default=0)
    losing_trades = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones
    positions = relationship("PaperPosition", back_populates="account", cascade="all, delete-orphan")
    snapshots = relationship("PaperEquitySnapshot", back_populates="account", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<PaperAccount {self.name} balance=${self.current_balance} margin=${self.allocated_margin}>"


class PaperPosition(Base):
    __tablename__ = "paper_positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("paper_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)  # 'BUY' (Long) o 'SELL' (Short)
    status = Column(String(20), nullable=False, default="OPEN", index=True)  # 'OPEN', 'CLOSED', 'CANCELLED'
    size = Column(Numeric(18, 8), nullable=False)
    entry_price = Column(Numeric(18, 8), nullable=False)
    current_price = Column(Numeric(18, 8), nullable=False)
    exit_price = Column(Numeric(18, 8), nullable=True)
    stop_loss = Column(Numeric(18, 8), nullable=True)
    take_profit = Column(Numeric(18, 8), nullable=True)
    trailing_stop_active = Column(Boolean, nullable=False, default=False)
    trailing_stop_price = Column(Numeric(18, 8), nullable=True)
    margin_used = Column(Numeric(18, 4), nullable=False)
    unrealized_pnl = Column(Numeric(18, 4), nullable=False, default=0.0000)
    realized_pnl = Column(Numeric(18, 4), nullable=False, default=0.0000)
    return_pct = Column(Numeric(8, 4), nullable=False, default=0.0000)
    entry_fee = Column(Numeric(18, 4), nullable=False, default=0.0000)
    exit_fee = Column(Numeric(18, 4), nullable=False, default=0.0000)
    slippage_incurred = Column(Numeric(18, 8), nullable=False, default=0.0000)
    opened_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    close_reason = Column(String(50), nullable=True)
    signal_id = Column(BigInteger, nullable=True)
    extra_metadata = Column("metadata", JSONB, nullable=True)

    # Relaciones
    account = relationship("PaperAccount", back_populates="positions")
    asset = relationship("Asset")

    def __repr__(self) -> str:
        return f"<PaperPosition {self.side} {self.symbol} size={self.size} status={self.status} pnl={self.unrealized_pnl}>"


class PaperEquitySnapshot(Base):
    __tablename__ = "paper_equity_snapshots"

    time = Column(
        DateTime(timezone=True),
        primary_key=True,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    account_id = Column(UUID(as_uuid=True), ForeignKey("paper_accounts.id", ondelete="CASCADE"), primary_key=True, nullable=False, index=True)
    total_equity = Column(Numeric(18, 4), nullable=False)
    cash_balance = Column(Numeric(18, 4), nullable=False)
    allocated_margin = Column(Numeric(18, 4), nullable=False)
    unrealized_pnl = Column(Numeric(18, 4), nullable=False)
    realized_pnl = Column(Numeric(18, 4), nullable=False)
    open_positions_count = Column(Integer, nullable=False, default=0)

    # Relaciones
    account = relationship("PaperAccount", back_populates="snapshots")

    def __repr__(self) -> str:
        return f"<PaperEquitySnapshot time={self.time} equity=${self.total_equity}>"
