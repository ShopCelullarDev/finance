from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    WSTicketResponse,
)
from app.services.auth_service import AuthService

router = APIRouter()


def _cookie_secure(request: Request) -> bool:
    """La cookie Secure solo viaja por HTTPS público. El salto interno a la API es HTTP."""
    forwarded = request.headers.get("x-forwarded-proto", "")
    proto = forwarded.split(",")[0].strip().lower() if forwarded else request.url.scheme
    return proto == "https"


def _get_client_ip(request: Request) -> str:
    """Extrae la dirección IP del cliente considerando posibles proxies reversos."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", response_model=TokenResponse, summary="Iniciar Sesión Privada y Obtener Tokens")
async def login(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Autentica con usuario/contraseña, aplica rate-limiting en Redis y genera tokens duales."""
    client_ip = _get_client_ip(request)
    user, error_msg = await AuthService.authenticate_user(
        db, login_data.username_or_email, login_data.password, client_ip
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_msg or "Credenciales de acceso no válidas.",
        )

    # Generar Access y Refresh Tokens
    user_id_str = str(user.id)
    access_token = create_access_token(subject=user_id_str, role=user.role)
    refresh_token = create_refresh_token(subject=user_id_str)

    # Persistir hash en Redis para control de revocación
    await AuthService.store_refresh_token(user_id_str, refresh_token)

    # Configurar cookies seguras httpOnly
    secure_cookie = _cookie_secure(request)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse, summary="Renovar Access Token mediante Refresh Token")
async def refresh_token(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
):
    """Rota y renueva el Access Token validando el Refresh Token activo en Redis."""
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token no proporcionado.",
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tipo de token inválido para refresco.",
            )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sujeto de token no válido.",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expirado o firma inválida.",
        )

    # Validar que el token no haya sido revocado en Redis
    is_valid = await AuthService.is_refresh_token_valid(user_id_str, token)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión revocada o cerrada previamente. Inicie sesión nuevamente.",
        )

    # Obtener usuario actualizado de la base de datos
    query = text("""
        SELECT id, username, email, hashed_password, role, is_active, 
               failed_login_attempts, locked_until, created_at, last_login_at
        FROM users WHERE id = :uid
    """)
    result = await db.execute(query, {"uid": UUID(user_id_str)})
    row = result.first()
    if not row or not row.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o cuenta deshabilitada.",
        )

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
        last_login_at=row.last_login_at,
    )

    # Rotación de tokens: Revocar el anterior y emitir un nuevo par
    await AuthService.revoke_refresh_token(user_id_str, token)
    new_access_token = create_access_token(subject=user_id_str, role=user.role)
    new_refresh_token = create_refresh_token(subject=user_id_str)
    await AuthService.store_refresh_token(user_id_str, new_refresh_token)

    secure_cookie = _cookie_secure(request)
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", summary="Cerrar Sesión e Invalidar Tokens en Redis")
async def logout(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Revoca el Refresh Token en Redis y elimina las cookies de sesión."""
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if current_user and token:
        await AuthService.revoke_refresh_token(str(current_user.id), token)

    # Limpiar cookies en el navegador
    secure_cookie = _cookie_secure(request)
    response.delete_cookie(key="access_token", path="/", secure=secure_cookie, httponly=True, samesite="lax")
    response.delete_cookie(key="refresh_token", path="/", secure=secure_cookie, httponly=True, samesite="lax")

    return {"message": "Sesión cerrada correctamente y tokens invalidados."}


@router.get("/me", response_model=UserResponse, summary="Obtener Perfil del Usuario Autenticado")
async def get_me(current_user: User = Depends(get_current_user)):
    """Retorna los datos del usuario actualmente autenticado."""
    return UserResponse.model_validate(current_user)


@router.post("/ws-ticket", response_model=WSTicketResponse, summary="Generar Ticket Efímero para WebSocket")
async def create_ws_ticket(current_user: User = Depends(get_current_user)):
    """Genera un ticket de un solo uso con 60 segundos de validez para conectar a /ws/live."""
    ticket = await AuthService.create_ws_ticket(str(current_user.id), expires_in=60)
    return WSTicketResponse(ticket=ticket, expires_in=60)
