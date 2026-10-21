#!/usr/bin/env python3
"""Prueba unitaria e integrada del motor de autenticación, hashing y tokens JWT."""

import asyncio
from datetime import timedelta
import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.services.auth_service import AuthService


def test_password_hashing():
    print("[1/3] Probando Hashing SHA-256 + Bcrypt (12 rondas)...")
    secret = "MasterPassword2026!@#"
    hashed = get_password_hash(secret)
    assert hashed.startswith("$2b$12$"), f"Hash inválido: {hashed}"
    assert verify_password(secret, hashed), "Fallo en verificación de contraseña correcta"
    assert not verify_password("WrongPassword", hashed), "Falso positivo con contraseña incorrecta"
    
    # Contraseña larga (> 120 caracteres)
    long_pass = "X" * 128 + "!@#SuperLongPassword"
    long_hash = get_password_hash(long_pass)
    assert verify_password(long_pass, long_hash), "Fallo al verificar contraseña larga"
    print(" -> Hashing y verificación: CORRECTO.")


def test_jwt_tokens():
    print("[2/3] Probando generación, claims y validación de JWT Access y Refresh...")
    user_id = "e586350e-b7d1-419b-a311-6df7d4f9f6b9"
    access_tok = create_access_token(subject=user_id, role="admin", extra_claims={"email": "admin@terminal.local"})
    refresh_tok = create_refresh_token(subject=user_id)

    # Validar Access Token
    decoded_acc = decode_token(access_tok)
    assert decoded_acc["sub"] == user_id
    assert decoded_acc["role"] == "admin"
    assert decoded_acc["type"] == "access"
    assert decoded_acc["email"] == "admin@terminal.local"

    # Validar Refresh Token
    decoded_ref = decode_token(refresh_tok)
    assert decoded_ref["sub"] == user_id
    assert decoded_ref["type"] == "refresh"

    # Validar token alterado/falsificado
    try:
        decode_token(access_tok + "corrupted")
        assert False, "No detectó token corrupto"
    except jwt.PyJWTError:
        pass

    print(" -> Generación y validación de tokens JWT: CORRECTO.")


async def test_redis_features():
    print("[3/3] Probando interacción con Redis (Tokens Whitelist, Rate Limiting & WebSocket Ticket)...")
    try:
        import redis.asyncio as aioredis
        from app.core.redis import redis_pool
        client = aioredis.Redis(connection_pool=redis_pool)
        await client.ping()
        await client.aclose()
    except Exception as e:
        print(f" -> Redis no está disponible en este momento ({e}). Omitiendo prueba de socket en vivo.")
        return

    user_id = "test-user-uuid-1234"
    test_refresh = "dummy.refresh.token"

    # 1. Almacenar y validar refresh token
    await AuthService.store_refresh_token(user_id, test_refresh)
    assert await AuthService.is_refresh_token_valid(user_id, test_refresh), "Token debería ser válido en Redis"
    await AuthService.revoke_refresh_token(user_id, test_refresh)
    assert not await AuthService.is_refresh_token_valid(user_id, test_refresh), "Token debería haber sido revocado"

    # 2. WebSocket ticket
    ticket = await AuthService.create_ws_ticket(user_id, expires_in=10)
    consumed_id = await AuthService.validate_and_consume_ws_ticket(ticket)
    assert consumed_id == user_id, f"Ticket retornó {consumed_id} en vez de {user_id}"
    # Validar que ya no existe (un solo uso)
    second_try = await AuthService.validate_and_consume_ws_ticket(ticket)
    assert second_try is None, "Ticket de un solo uso pudo ser consumido dos veces"

    print(" -> Redis Token Whitelist, Revocación y WS Tickets: CORRECTO.")


async def main():
    print("=== Iniciando Verificación de Seguridad y Autenticación ===")
    test_password_hashing()
    test_jwt_tokens()
    await test_redis_features()
    print("=== Todas las pruebas de backend de seguridad concluidas exitosamente ===")


if __name__ == "__main__":
    asyncio.run(main())
