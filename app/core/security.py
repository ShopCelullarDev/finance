import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt

from app.core.config import settings


def _prehash_password(password: str) -> bytes:
    """Pre-hashea con SHA-256 para evitar el límite de 72 bytes de bcrypt y ataques por longitud."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")


def get_password_hash(password: str) -> str:
    """Genera hash de contraseña utilizando SHA-256 + Bcrypt con 12 rondas de sal."""
    digest = _prehash_password(password)
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(digest, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash almacenado."""
    try:
        digest = _prehash_password(plain_password)
        return bcrypt.checkpw(digest, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str, role: str = "trader", extra_claims: Optional[Dict[str, Any]] = None) -> str:
    """Crea un Access Token JWT de corta vida (por defecto 15 minutos)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: str) -> str:
    """Crea un Refresh Token JWT de larga vida (por defecto 7 días)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload: Dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "iat": now,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decodifica y valida la firma y expiración de un token JWT."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
