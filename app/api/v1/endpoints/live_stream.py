import asyncio
import json
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.core.redis import redis_pool
from app.models.user import User

router = APIRouter()

LIVE_CHANNELS = (
    "ticks:stream",
    "ticks:BTC/USDT",
    "ticks:ETH/USDT",
    "ticks:SOL/USDT",
    "signals:stream",
    "news:feed",
)


def _text(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode()
    return str(value)


@router.get("/live", summary="Canal en vivo por HTTP")
async def live_stream(
    request: Request,
    _user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Reenvía Redis al navegador. El proxy público no abre WebSocket; este canal sí atraviesa."""

    async def events():
        # Algunos proxies no sueltan la respuesta hasta llenar un bloque.
        yield ":" + (" " * 2048) + "\n\n"
        client = aioredis.Redis(connection_pool=redis_pool)
        pubsub = client.pubsub()
        await pubsub.subscribe(*LIVE_CHANNELS)
        try:
            hello = {
                "type": "connection_established",
                "active_subscriptions": list(LIVE_CHANNELS),
            }
            yield f"data: {json.dumps(hello)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
                if message and message.get("type") == "message":
                    raw = message.get("data")
                    raw_text = _text(raw)
                    try:
                        parsed = json.loads(raw_text)
                    except Exception:
                        parsed = raw_text
                    payload = {"channel": _text(message.get("channel")), "data": parsed}
                    yield f"data: {json.dumps(payload)}\n\n"
        finally:
            await pubsub.unsubscribe(*LIVE_CHANNELS)
            await pubsub.aclose()
            await client.aclose()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
