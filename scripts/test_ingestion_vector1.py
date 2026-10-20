import asyncio
import json
import sys
from decimal import Decimal
import redis.asyncio as aioredis
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.market_tick import MarketTick
from app.services.ingestion.manager import IngestionManager
from app.services.ingestion.polymarket_gamma import PolymarketGammaConnector


async def test_redis_subscriber(received_ticks: list, stop_event: asyncio.Event):
    """Escucha el canal de Redis Pub/Sub para validar que los ticks se transmiten en caliente."""
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe("ticks:stream")
    print("[* Redis Subscriber] Suscrito a canal 'ticks:stream'...")

    try:
        while not stop_event.is_set():
            try:
                msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=1.0)
                if msg and msg.get("type") == "message":
                    data = json.loads(msg["data"])
                    received_ticks.append(data)
                    print(f"  [Redis Pub/Sub Tick] {data['symbol']} | Price: ${data['price']:,.2f} | Spread: {data.get('bid_ask_spread')} | Time: {data['time']}")
            except asyncio.TimeoutError:
                continue
    finally:
        await pubsub.unsubscribe("ticks:stream")
        await client.aclose()


async def main():
    print("=" * 70)
    print("VALIDACIÓN EN VIVO: INGESTA VECTOR 1 (BINANCE WS + POLYMARKET + REDIS + TIMESCALEDB)")
    print("=" * 70)

    # 1. Probar conector de Polymarket Gamma API
    print("\n[PASO 1] Probando conector de Polymarket Gamma API...")
    poly = PolymarketGammaConnector()
    try:
        markets = await poly.fetch_active_markets(limit=5)
        print(f"[+] Polymarket OK! Obtenidos {len(markets)} mercados predictivos:")
        for m in markets[:3]:
            print(f"    - Evento: {m['title'][:60]}... (Volumen: ${m['volume']:,.0f})")
    except Exception as e:
        print(f"[!] Aviso Polymarket: {e} (Continuando con streaming de Binance...)")

    # 2. Iniciar IngestionManager y captura en vivo
    print("\n[PASO 2] Iniciando IngestionManager y captura WebSocket de Binance...")
    manager = IngestionManager()
    await manager.start()

    received_redis_ticks = []
    stop_event = asyncio.Event()

    # Iniciar listener de Redis en segundo plano
    sub_task = asyncio.create_task(test_redis_subscriber(received_redis_ticks, stop_event))

    # Dejar correr durante 12 segundos para capturar ticks reales del mercado
    print("[*] Capturando ticks en tiempo real durante 12 segundos...")
    await asyncio.sleep(12)

    # Detener listener y manager
    print("\n[*] Finalizando captura y vaciando buffer...")
    stop_event.set()
    await sub_task
    await manager.stop()

    # 3. Comprobar telemetría
    telemetry = manager.get_telemetry()
    print("\n[PASO 3] Telemetría del IngestionManager:")
    print(f"    - Activos monitoreados: {telemetry['tracked_assets_count']}")
    print(f"    - Ticks insertados en buffer: {telemetry['buffer_stats']['total_inserted']}")
    print(f"    - Lotes insertados: {telemetry['buffer_stats']['total_batches']}")
    for c in telemetry["connectors"]:
        print(f"    - Conector [{c['name']}]: {c['events_count']} eventos, {c['throughput_eps']} EPS, Errores: {c['error_count']}")

    # 4. Validar persistencia en hipertabla market_ticks de TimescaleDB
    print("\n[PASO 4] Verificando persistencia en TimescaleDB (market_ticks)...")
    async with AsyncSessionLocal() as session:
        stmt = select(
            func.count(MarketTick.time),
            func.min(MarketTick.price),
            func.max(MarketTick.price),
            func.max(MarketTick.time)
        )
        res = await session.execute(stmt)
        count, min_p, max_p, last_t = res.one()

        print(f"[+] Registros en market_ticks: {count}")
        print(f"[+] Rango de precios capturados: Min ${min_p:,.2f} - Max ${max_p:,.2f}")
        print(f"[+] Último tick registrado: {last_t}")

        assert count > 0, "Debe haberse persistido al menos 1 tick en TimescaleDB"

    assert len(received_redis_ticks) > 0, "Debe haberse recibido al menos 1 tick vía Redis Pub/Sub"

    print("\n" + "=" * 70)
    print(">>> [SUCCESS] VALIDACIÓN VECTOR 1 COMPLETADA CON ÉXITO AL 100% <<<")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
