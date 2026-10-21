import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="trader", nullable=False)  # 'admin' o 'trader'
    is_active = Column(Boolean, default=True, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    def is_locked(self) -> bool:
        """Determina si la cuenta está temporalmente bloqueada por intentos fallidos."""
        if self.locked_until and self.locked_until > datetime.now(self.locked_until.tzinfo):
            return True
        return False

    def __repr__(self) -> str:
        return f"<User {self.username} (role={self.role})>"
