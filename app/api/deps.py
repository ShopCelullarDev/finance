from typing import Optional
from uuid import UUID
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

# Extractor de Bearer Token
security_bearer = HTTPBearer(auto_error=False)


async def get_token_from_request(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[str]:
    """Extrae el token JWT del header 'Authorization: Bearer ...' o de la cookie httpOnly."""
    if bearer and bearer.credentials:
        return bearer.credentials
    if access_token_cookie:
        return access_token_cookie
    return None


async def get_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Valida el Access Token y recupera el usuario correspondiente desde la base de datos."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación inválidas o sesión expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    query = text("""
        SELECT id, username, email, hashed_password, role, is_active, 
               failed_login_attempts, locked_until, created_at, last_login_at
        FROM users
        WHERE id = :uid
    """)
    result = await db.execute(query, {"uid": user_id})
    row = result.first()

    if not row:
        raise credentials_exception

    user = User(
        id=row.id,
        username=row.username,
        email=row.email,
        hashed_password=row.hashed_password,
        role=row.role,
        is_active=row.is_active,
        failed_login_attempts=row.failed_login_attempts,
        locked_until=row.locked_until,
        created_at=row.created_at,
        last_login_at=row.last_login_at
    )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta de usuario inactiva o deshabilitada.",
        )

    return user


async def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Garantiza que el usuario autenticado cuente con privilegios de administrador ('admin')."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Se requieren privilegios de Administrador.",
        )
    return current_user
