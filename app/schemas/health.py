from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., examples=["ok", "degraded", "error"])
    environment: str = Field(..., examples=["development", "production"])
    database_connected: bool = Field(...)
    redis_connected: bool = Field(...)
    timestamp: datetime = Field(...)
