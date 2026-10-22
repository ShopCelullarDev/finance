import asyncio
import json
from typing import Optional, Set
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
import jwt
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.redis import redis_pool
from app.core.security import decode_token
from app.services.auth_service import AuthService

router = APIRouter()


@router.websocket("/live")
async def websocket_live_gateway(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    ticket: Optional[str] = Query(None),
):
    """
    Gateway de WebSockets en tiempo real para la Terminal del Trader y Dashboard.
    Requiere autenticación obligatoria mediante JWT Access Token (?token=...) o ticket efímero (?ticket=...).
    """
    authenticated_user_id: Optional[str] = None

    # 1. Validar ticket efímero de un solo uso
    if ticket:
        authenticated_user_id = await AuthService.validate_and_consume_ws_ticket(ticket)

    # 2. Si no hay ticket, validar Access Token JWT (Query param o Cookie httpOnly)
    if not authenticated_user_id:
        effective_token = token or websocket.cookies.get("access_token")
        if effective_token:
            try:
                payload = decode_token(effective_token)
                if payload.get("type") == "access":
                    authenticated_user_id = payload.get("sub")
            except jwt.PyJWTError:
                authenticated_user_id = None

    # 3. Si el Access Token expiró o no está, intentar validar mediante Refresh Token en cookies
    if not authenticated_user_id:
        cookie_refresh = websocket.cookies.get("refresh_token")
        if cookie_refresh:
            try:
                payload = decode_token(cookie_refresh)
                if payload.get("type") == "refresh":
                    sub = payload.get("sub")
                    is_valid = await AuthService.verify_refresh_token(sub, cookie_refresh)
                    if is_valid:
                        authenticated_user_id = sub
            except jwt.PyJWTError:
                authenticated_user_id = None

    # 4. En entorno local / development, permitir fallback a cuenta autorizada si no se especificó credencial
    if not authenticated_user_id and settings.ENVIRONMENT == "development":
        authenticated_user_id = "04a9744f-19fe-4a0a-b20d-193d6dda700e"

    # 5. Rechazar conexión no autorizada con código WS 1008
    if not authenticated_user_id:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Acceso denegado: Se requiere autenticación válida (token o ticket).",
        )
        return

    await websocket.accept()
    subscribed_channels: Set[str] = set()

    # Canal predeterminado para feeds globales
    default_channels = ["ticks:stream", "signals:stream", "news:feed"]
    subscribed_channels.update(default_channels)

    redis_client = aioredis.Redis(connection_pool=redis_pool)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(*subscribed_channels)

    # Enviar mensaje de bienvenida
    await websocket.send_json({
        "type": "connection_established",
        "message": "Conectado al Gateway de Tiempo Real del Motor Predictivo",
        "active_subscriptions": list(subscribed_channels),
    })

    # Tarea 1: Escuchar Redis y reenviar al WebSocket
    async def forward_redis_to_ws():
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    channel = message.get("channel")
                    data = message.get("data")
                    try:
                        parsed_payload = json.loads(data) if isinstance(data, str) else data
                    except Exception:
                        parsed_payload = data

                    await websocket.send_json({
                        "channel": channel,
                        "data": parsed_payload,
                    })
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[WebSocket Gateway - Forwarder Error] {e}")

    forwarder_task = asyncio.create_task(forward_redis_to_ws())

    # Tarea 2: Recibir comandos del cliente WebSocket (suscripciones dinámicas)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                cmd = json.loads(raw_text)
                action = cmd.get("action")

                if action == "subscribe":
                    channels_to_add = cmd.get("channels", [])
                    new_channels = [c for c in channels_to_add if c not in subscribed_channels]
                    if new_channels:
                        await pubsub.subscribe(*new_channels)
                        subscribed_channels.update(new_channels)
                        await websocket.send_json({
                            "type": "subscribed",
                            "channels": list(subscribed_channels),
                        })

                elif action == "unsubscribe":
                    channels_to_remove = cmd.get("channels", [])
                    active_remove = [c for c in channels_to_remove if c in subscribed_channels]
                    if active_remove:
                        await pubsub.unsubscribe(*active_remove)
                        subscribed_channels.difference_update(active_remove)
                        await websocket.send_json({
                            "type": "unsubscribed",
                            "channels": list(subscribed_channels),
                        })

                elif action == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Payload JSON inválido."})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Gateway - Client Exception] {e}")
    finally:
        forwarder_task.cancel()
        try:
            await forwarder_task
        except asyncio.CancelledError:
            pass

        if subscribed_channels:
            await pubsub.unsubscribe(*subscribed_channels)
        await pubsub.close()
        await redis_client.aclose()
