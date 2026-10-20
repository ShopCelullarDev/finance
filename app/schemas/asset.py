from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AssetBase(BaseModel):
    symbol: str = Field(..., max_length=20, examples=["BTC/USDT", "SPY"])
    name: str = Field(..., max_length=100, examples=["Bitcoin / Tether", "SPDR S&P 500"])
    asset_type: str = Field(..., max_length=30, examples=["CRYPTO", "INDEX", "COMMODITY"])
    is_active: bool = Field(default=True)


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    is_active: Optional[bool] = None


class AssetResponse(AssetBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
