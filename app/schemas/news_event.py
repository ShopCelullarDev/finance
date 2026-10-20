from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NewsEventBase(BaseModel):
    source: str = Field(..., max_length=100, examples=["REUTERS", "BLOOMBERG"])
    title: str
    url: Optional[str] = None
    sentiment_score: Optional[Decimal] = Field(None, max_digits=4, decimal_places=3, examples=[0.750])
    affected_assets: Optional[List[str]] = Field(default_factory=list, examples=[["BTC", "ETH"]])


class NewsEventCreate(NewsEventBase):
    published_at: datetime


class NewsEventResponse(NewsEventBase):
    id: int
    published_at: datetime

    model_config = ConfigDict(from_attributes=True)
