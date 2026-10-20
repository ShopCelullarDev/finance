from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MarketTickBase(BaseModel):
    asset_id: int
    source: str = Field(..., max_length=50, examples=["BINANCE", "KRAKEN"])
    price: Decimal = Field(..., max_digits=18, decimal_places=8)
    volume_24h: Optional[Decimal] = Field(None, max_digits=24, decimal_places=8)
    bid_ask_spread: Optional[Decimal] = Field(None, max_digits=10, decimal_places=6)


class MarketTickCreate(MarketTickBase):
    time: datetime


class MarketTickResponse(MarketTickBase):
    time: datetime

    model_config = ConfigDict(from_attributes=True)
