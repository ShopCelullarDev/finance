from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, examples=["trader_pro"])
    email: EmailStr = Field(..., examples=["trader@terminal.private"])
    role: str = Field(default="trader", examples=["admin", "trader"])
    is_active: bool = Field(default=True)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, description="Contraseña maestra (mínimo 8 caracteres)")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserResponse(UserBase):
    id: UUID
    failed_login_attempts: int
    locked_until: Optional[datetime] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username_or_email: str = Field(..., description="Nombre de usuario o dirección de correo electrónico")
    password: str = Field(..., description="Contraseña en texto plano para verificación")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Segundos de validez del access token")
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Token de refresco de larga duración")


class WSTicketResponse(BaseModel):
    ticket: str = Field(..., description="Ticket efímero de autenticación de un solo uso para WebSocket")
    expires_in: int = Field(default=60, description="Segundos de validez del ticket (60s)")
