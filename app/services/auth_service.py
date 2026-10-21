import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.redis import redis_pool
from app.core.security import get_password_hash, verify_password
from app.models.user import User


class AuthService:
    """Servicio integral de seguridad: autenticación, rate-limiting en Redis y tokens duales."""

    @staticmethod
    def _hash_token(token: str) -> str:
        """Calcula un hash SHA-256 del token para usar como clave en Redis sin almacenar el JWT plano."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    async def check_login_rate_limit(cls, client_ip: str, identifier: str) -> Tuple[bool, int]:
        """Comprueba el límite de intentos de inicio de sesión utilizando Redis con ventana deslizante.
        
        Retorna (permitido: bool, intentos_restantes: int).
        """
        key = f"ratelimit:login:{client_ip}:{identifier.lower()}"
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            attempts = await client.get(key)
            current_attempts = int(attempts) if attempts else 0
            
            if current_attempts >= settings.RATE_LIMIT_LOGIN_ATTEMPTS:
                return False, 0
                
            return True, settings.RATE_LIMIT_LOGIN_ATTEMPTS - current_attempts
        except Exception as e:
            print(f"[AuthService - WARNING] Fallo al consultar rate limit en Redis: {e}")
            return True, settings.RATE_LIMIT_LOGIN_ATTEMPTS
        finally:
            await client.aclose()

    @classmethod
    async def record_login_failure(cls, client_ip: str, identifier: str) -> int:
        """Registra un intento fallido en Redis incrementando el contador con expiración automática."""
        key = f"ratelimit:login:{client_ip}:{identifier.lower()}"
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            attempts = await client.incr(key)
            if attempts == 1:
                await client.expire(key, settings.RATE_LIMIT_WINDOW_SECONDS)
            return attempts
        except Exception as e:
            print(f"[AuthService - WARNING] Fallo al registrar intento fallido en Redis: {e}")
            return 1
        finally:
            await client.aclose()

    @classmethod
    async def reset_login_rate_limit(cls, client_ip: str, identifier: str) -> None:
        """Limpia el contador de rate limit tras un login exitoso."""
        key = f"ratelimit:login:{client_ip}:{identifier.lower()}"
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            await client.delete(key)
        except Exception as e:
            print(f"[AuthService - WARNING] Fallo al reiniciar rate limit en Redis: {e}")
        finally:
            await client.aclose()

    @classmethod
    async def store_refresh_token(cls, user_id: str, refresh_token: str) -> None:
        """Almacena el hash del Refresh Token en Redis con TTL de 7 días para control de revocación."""
        token_hash = cls._hash_token(refresh_token)
        key = f"auth:refresh_token:{user_id}:{token_hash}"
        ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            await client.set(key, "valid", ex=ttl_seconds)
        finally:
            await client.aclose()

    @classmethod
    async def is_refresh_token_valid(cls, user_id: str, refresh_token: str) -> bool:
        """Verifica si el Refresh Token está activo y no ha sido revocado en Redis."""
        token_hash = cls._hash_token(refresh_token)
        key = f"auth:refresh_token:{user_id}:{token_hash}"
        
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            val = await client.get(key)
            return val is not None
        finally:
            await client.aclose()

    @classmethod
    async def revoke_refresh_token(cls, user_id: str, refresh_token: str) -> None:
        """Revoca un Refresh Token específico (cierre de sesión del dispositivo)."""
        token_hash = cls._hash_token(refresh_token)
        key = f"auth:refresh_token:{user_id}:{token_hash}"
        
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            await client.delete(key)
        finally:
            await client.aclose()

    @classmethod
    async def revoke_all_user_tokens(cls, user_id: str) -> None:
        """Revoca todos los tokens activos de un usuario (cierre de sesión global)."""
        pattern = f"auth:refresh_token:{user_id}:*"
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            keys = await client.keys(pattern)
            if keys:
                await client.delete(*keys)
        finally:
            await client.aclose()

    @classmethod
    async def create_ws_ticket(cls, user_id: str, expires_in: int = 60) -> str:
        """Genera un ticket efímero de un solo uso para autenticar una conexión WebSocket."""
        ticket = secrets.token_urlsafe(32)
        key = f"auth:ws_ticket:{ticket}"
        
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            await client.set(key, str(user_id), ex=expires_in)
            return ticket
        finally:
            await client.aclose()

    @classmethod
    async def validate_and_consume_ws_ticket(cls, ticket: str) -> Optional[str]:
        """Valida y consume inmediatamente el ticket efímero de WebSocket (Single-Use Token)."""
        key = f"auth:ws_ticket:{ticket}"
        client = aioredis.Redis(connection_pool=redis_pool)
        try:
            user_id = await client.get(key)
            if user_id:
                await client.delete(key)  # Consumir de un solo uso
                return user_id.decode("utf-8") if isinstance(user_id, bytes) else str(user_id)
            return None
        finally:
            await client.aclose()

    @classmethod
    async def authenticate_user(
        cls, session: AsyncSession, username_or_email: str, password: str, client_ip: str
    ) -> Tuple[Optional[User], Optional[str]]:
        """Autentica a un usuario verificando credenciales, bloqueos y actualizando métricas de seguridad.
        
        Retorna (usuario_o_none, mensaje_error_si_falla).
        """
        # 1. Comprobar rate limit en Redis
        allowed, remaining = await cls.check_login_rate_limit(client_ip, username_or_email)
        if not allowed:
            return None, "Demasiados intentos fallidos. Acceso temporalmente bloqueado por seguridad (espera 5 minutos)."

        # 2. Buscar usuario por username o email
        query = text("""
            SELECT id, username, email, hashed_password, role, is_active, 
                   failed_login_attempts, locked_until, created_at, last_login_at
            FROM users
            WHERE LOWER(username) = LOWER(:ident) OR LOWER(email) = LOWER(:ident)
        """)
        result = await session.execute(query, {"ident": username_or_email.strip()})
        row = result.first()

        if not row:
            await cls.record_login_failure(client_ip, username_or_email)
            return None, "Credenciales de acceso no válidas."

        # Mapear objeto User
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

        # 3. Comprobar si la cuenta está inactiva
        if not user.is_active:
            return None, "Esta cuenta ha sido desactivada por el administrador."

        # 4. Comprobar si está bloqueada en base de datos
        if user.is_locked():
            return None, f"Cuenta bloqueada temporalmente hasta {user.locked_until.strftime('%H:%M:%S UTC')}."

        # 5. Verificar contraseña con Bcrypt pre-hasheado
        if not verify_password(password, user.hashed_password):
            failed = user.failed_login_attempts + 1
            locked_until = None
            if failed >= settings.RATE_LIMIT_LOGIN_ATTEMPTS:
                locked_until = datetime.now(timezone.utc) + timedelta(seconds=settings.RATE_LIMIT_WINDOW_SECONDS)
                print(f"[AUTH - SECURITY ALERT] Cuenta '{user.username}' bloqueada por 5 min tras {failed} intentos.")

            update_sql = text("""
                UPDATE users 
                SET failed_login_attempts = :f, locked_until = :l
                WHERE id = :uid
            """)
            await session.execute(update_sql, {"f": failed, "l": locked_until, "uid": user.id})
            await session.commit()
            
            await cls.record_login_failure(client_ip, username_or_email)
            return None, "Credenciales de acceso no válidas."

        # 6. Éxito: Reiniciar contadores y actualizar last_login_at
        now = datetime.now(timezone.utc)
        update_sql = text("""
            UPDATE users 
            SET failed_login_attempts = 0, locked_until = NULL, last_login_at = :now
            WHERE id = :uid
        """)
        await session.execute(update_sql, {"now": now, "uid": user.id})
        await session.commit()
        
        await cls.reset_login_rate_limit(client_ip, username_or_email)
        user.last_login_at = now
        user.failed_login_attempts = 0
        user.locked_until = None

        return user, None
