from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class PaperAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    initial_balance: float
    current_balance: float
    allocated_margin: float
    unrealized_pnl: float
    total_equity: float
    realized_pnl: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    profit_factor: float
    open_positions_count: int
    created_at: datetime
    updated_at: datetime


class PaperPositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    asset_id: int
    symbol: str
    side: str
    status: str
    size: float
    entry_price: float
    current_price: float
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    trailing_stop_active: bool
    trailing_stop_price: Optional[float] = None
    margin_used: float
    unrealized_pnl: float
    realized_pnl: float
    return_pct: float
    entry_fee: float
    exit_fee: float
    slippage_incurred: float
    opened_at: datetime
    closed_at: Optional[datetime] = None
    close_reason: Optional[str] = None
    signal_id: Optional[int] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class PaperEquitySnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time: datetime
    total_equity: float
    cash_balance: float
    allocated_margin: float
    unrealized_pnl: float
    realized_pnl: float
    open_positions_count: int


class OpenPositionRequest(BaseModel):
    symbol: str = Field(..., description="Símbolo del activo (ej: BTC/USDT)")
    side: str = Field("BUY", description="Dirección: 'BUY' o 'SELL'")
    risk_pct: Optional[float] = Field(1.0, ge=0.1, le=10.0, description="Porcentaje de riesgo del capital (ej: 1.0%)")
    stop_loss: Optional[float] = Field(None, description="Precio de stop loss (si es None, se calcula por ATR)")
    take_profit: Optional[float] = Field(None, description="Precio de take profit (si es None, se calcula por ATR)")
    explicit_size: Optional[float] = Field(None, gt=0, description="Tamaño explícito en unidades (omite cálculo ATR)")
    signal_id: Optional[int] = Field(None, description="ID de la señal predictiva originaria")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Metadatos contextuales del trade")


class ClosePositionRequest(BaseModel):
    close_reason: Optional[str] = Field("MANUAL_EXIT", description="Causa del cierre")


class PositionSizingCalculationRequest(BaseModel):
    symbol: str
    side: str = "BUY"
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_pct: float = 1.0


class PositionSizingResponse(BaseModel):
    symbol: str
    side: str
    entry_price: float
    stop_loss: float
    take_profit: float
    recommended_size: float
    required_margin: float
    risk_amount_usdt: float
    risk_pct: float
    reward_risk_ratio: float
    estimated_entry_fee: float
    is_affordable: bool
    notes: str


class OrderDispatcherConfigRequest(BaseModel):
    auto_trade_enabled: Optional[bool] = Field(None, description="Habilitar o pausar el auto-trading")
    min_confidence: Optional[float] = Field(None, ge=40.0, le=95.0, description="Umbral mínimo de confianza (ej: 55.0)")
    risk_per_trade_pct: Optional[float] = Field(None, ge=0.1, le=10.0, description="Riesgo porcentual por trade (ej: 1.0)")
    trade_amount_usd: Optional[float] = Field(None, ge=10.0, le=1000000.0, description="Monto en USD asignado para tradear (ej: 1000.0)")
    target_profit_pct: Optional[float] = Field(None, ge=0.5, le=50.0, description="% de profit objetivo a alcanzar por trade (ej: 5.0)")
    asset_selection_mode: Optional[str] = Field(None, description="Modo de selección: 'AUTOMATIC' (IA) o 'SPECIFIC'")
    selected_symbol: Optional[str] = Field(None, description="Símbolo específico si el modo es 'SPECIFIC' (ej: 'BTC/USDT')")
    compound_interest_enabled: Optional[bool] = Field(None, description="Habilitar reinversión automática tipo interés compuesto")
    require_ml_agreement: Optional[bool] = Field(None, description="Exigir acuerdo de clase con clasificador ML")
    require_ofi_confluence: Optional[bool] = Field(None, description="Exigir confluencia con Order Flow Imbalance")
    avoid_squeeze_regime: Optional[bool] = Field(None, description="Evitar operar durante régimen de Volatility Squeeze")
    default_taker_slippage_bps: Optional[float] = Field(None, ge=0.0, le=50.0, description="Deslizamiento estimado en bps (ej: 1.5)")
    allowed_symbols: Optional[List[str]] = Field(None, description="Lista blanca de pares a auto-operar")


