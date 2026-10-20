from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class PredictiveSignalBase(BaseModel):
    asset_id: int
    timeframe: str = Field(..., max_length=10, examples=["1m", "5m", "1h", "1d"])
    action_suggested: str = Field(..., max_length=20, examples=["STRONG_BUY", "BUY", "HOLD", "SELL"])
    confidence_score: Decimal = Field(..., max_digits=5, decimal_places=2, examples=[87.50])
    entry_price: Optional[Decimal] = Field(None, max_digits=18, decimal_places=8)
    stop_loss: Optional[Decimal] = Field(None, max_digits=18, decimal_places=8)
    take_profit: Optional[Decimal] = Field(None, max_digits=18, decimal_places=8)
    trigger_factors: Dict[str, Any] = Field(
        ...,
        examples=[{
            "nlp_sentiment": {"score": 0.85, "weight": 0.35},
            "smart_money_flow": {"bias": "BULLISH", "weight": 0.30}
        }]
    )


class PredictiveSignalCreate(PredictiveSignalBase):
    generated_at: datetime


class PredictiveSignalResponse(PredictiveSignalBase):
    id: int
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
