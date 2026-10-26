"""
Test Suite para la Fase 7.2 & 7.3: Suscriptor de Señales en Vivo y Auto-Ejecución (Order Dispatcher)
Verifica:
1. Filtros cuantitativos de confluencia (Confianza ML, OFI, Régimen de Mercado).
2. Auto-ejecución end-to-end de señales vía Redis Pub/Sub (signals:stream).
3. Prevención de duplicidad de posiciones.
4. Monitoreo tick a tick (ticks:stream) con activación de Trailing Stop y salida automática por Take Profit.
5. Endpoints REST de FastAPI (/api/v1/paper/dispatcher/*).
"""

import asyncio
import json
from datetime import datetime, timezone
import httpx
import redis.asyncio as aioredis
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_pool
from app.main import app
from scripts.test_support import install_test_session
from app.models.paper_trading import PaperAccount, PaperPosition
from app.services.trading.order_dispatcher import OrderDispatcher
from app.services.trading.portfolio_manager import PortfolioManager


async def run_tests():
    print("=" * 70)
    print("TEST SUITE: FASE 7.2 & 7.3 - ORDER DISPATCHER & AUTO-EXECUTION")
    print("=" * 70)

    pm = PortfolioManager()
    dispatcher = OrderDispatcher(
        portfolio_manager=pm,
        auto_trade_enabled=True,
        min_confidence=55.0,
        risk_per_trade_pct=1.0,
        require_ml_agreement=True,
        require_ofi_confluence=True,
        avoid_squeeze_regime=True,
        default_taker_slippage_bps=1.5,
    )

    # Iniciar conexión a Redis
    redis_client = aioredis.Redis(connection_pool=redis_pool)

    # -------------------------------------------------------------
    # 1. Reiniciar Cuenta de Paper Trading a Estado Inicial
    # -------------------------------------------------------------
    print("\n--- 1. Preparando entorno de pruebas limpio ---")
    async with AsyncSessionLocal() as db:
        account = await pm.get_or_create_default_account(db)
        await pm.reset_account(db, account.id, initial_balance=10000.0)
        summary = await pm.get_account_summary(db, account.id)
        assert summary["current_balance"] == 10000.0
        assert summary["open_positions_count"] == 0
        print(f"  [+] Cartera reiniciada: Saldo=${summary['current_balance']:.2f}, Posiciones Abiertas=0")

    # Iniciar worker de Order Dispatcher
    await dispatcher.start()
    await asyncio.sleep(0.1)
    status_info = dispatcher.get_status()
    assert status_info["is_running"] is True
    print("  [+] OrderDispatcher worker iniciado y suscrito a 'signals:stream' y 'ticks:stream'.")

    # -------------------------------------------------------------
    # 2. Prueba de Filtros Cuantitativos de Confluencia
    # -------------------------------------------------------------
    print("\n--- 2. Probando Filtros de Confluencia Institucional ---")

    # Filtro A: Confianza baja (50.0% < 55.0%)
    low_conf_signal = {
        "id": 1001,
        "symbol": "BTC/USDT",
        "action": "BUY",
        "confidence_score": 50.0,
        "entry_price": 65000.0,
        "stop_loss": 63500.0,
        "take_profit": 68300.0,
        "trigger_factors": {},
    }
    await redis_client.publish("signals:stream", json.dumps(low_conf_signal))
    await asyncio.sleep(0.15)
    assert dispatcher.signals_filtered == 1
    assert "CONFIDENCE_BELOW_THRESHOLD" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro A: Señal con baja confianza (50%) rechazada correctamente.")

    # Filtro B: Acción HOLD
    hold_signal = {
        "id": 1002,
        "symbol": "BTC/USDT",
        "action": "HOLD",
        "confidence_score": 65.0,
        "entry_price": 65000.0,
        "trigger_factors": {},
    }
    await redis_client.publish("signals:stream", json.dumps(hold_signal))
    await asyncio.sleep(0.15)
    assert dispatcher.signals_filtered == 2
    assert "HOLD_ACTION_IGNORED" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro B: Señal HOLD ignorada correctamente.")

    # Filtro C: Régimen de Volatility Squeeze
    squeeze_signal = {
        "id": 1003,
        "symbol": "BTC/USDT",
        "action": "BUY",
        "confidence_score": 68.0,
        "entry_price": 65000.0,
        "stop_loss": 63500.0,
        "take_profit": 68300.0,
        "trigger_factors": {
            "regime_detection": {"regime": "VOLATILITY_SQUEEZE"},
        },
    }
    await redis_client.publish("signals:stream", json.dumps(squeeze_signal))
    await asyncio.sleep(0.15)
    assert dispatcher.signals_filtered == 3
    assert "VOLATILITY_SQUEEZE_REGIME_FILTER" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro C: Régimen de Squeeze rechazado correctamente.")

    # Filtro D: Divergencia con Machine Learning Supervisado (Regla BUY vs ML SELL)
    ml_divergence_signal = {
        "id": 1004,
        "symbol": "BTC/USDT",
        "action": "BUY",
        "confidence_score": 70.0,
        "entry_price": 65000.0,
        "stop_loss": 63500.0,
        "take_profit": 68300.0,
        "trigger_factors": {
            "ml_supervised": {"predicted_class": "SELL"},
        },
    }
    await redis_client.publish("signals:stream", json.dumps(ml_divergence_signal))
    await asyncio.sleep(0.15)
    assert dispatcher.signals_filtered == 4
    assert "ML_DIVERGENCE" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro D: Divergencia ML (Reglas BUY vs ML SELL) rechazada correctamente.")

    # Filtro E: OFI con presión contraria (Regla BUY vs OFI = -0.45)
    ofi_contrary_signal = {
        "id": 1005,
        "symbol": "BTC/USDT",
        "action": "BUY",
        "confidence_score": 72.0,
        "entry_price": 65000.0,
        "stop_loss": 63500.0,
        "take_profit": 68300.0,
        "trigger_factors": {
            "order_flow": {"ofi_score": -0.45},
            "ml_supervised": {"predicted_class": "BUY"},
        },
    }
    await redis_client.publish("signals:stream", json.dumps(ofi_contrary_signal))
    await asyncio.sleep(0.15)
    assert dispatcher.signals_filtered == 5
    assert "OFI_CONTRARY_PRESSURE" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro E: Presión de venta institucional contraria rechazada correctamente.")

    # -------------------------------------------------------------
    # 3. Auto-Ejecución End-to-End con Alta Confluencia
    # -------------------------------------------------------------
    print("\n--- 3. Probando Auto-Ejecución End-to-End con Alta Confluencia ---")
    valid_signal = {
        "id": 1006,
        "symbol": "BTC/USDT",
        "action": "STRONG_BUY",
        "confidence_score": 74.5,
        "entry_price": 65000.0,
        "stop_loss": 63500.0,
        "take_profit": 68300.0,
        "trigger_factors": {
            "ml_supervised": {"predicted_class": "BUY"},
            "order_flow": {"ofi_score": 0.42, "flow_bias": "STRONG_BUY_PRESSURE"},
            "regime_detection": {"regime": "TRENDING_EXPANSION"},
            "multi_timeframe": {"status": "FULL_CONFLUENCE"},
        },
    }

    # Publicar en canal Redis
    print("  [*] Publicando señal con alta confluencia institucional en Redis Pub/Sub...")
    await redis_client.publish("signals:stream", json.dumps(valid_signal))
    for _ in range(30):
        if dispatcher.orders_dispatched >= 1 or len(dispatcher.recent_activity) > 5:
            break
        await asyncio.sleep(0.1)

    print("  [DEBUG] Recent activity:", list(dispatcher.recent_activity))
    assert dispatcher.orders_dispatched == 1, f"Se esperaba 1 orden despachada, obtenida {dispatcher.orders_dispatched}"
    print(f"  [+] Despacho registrado: orders_dispatched={dispatcher.orders_dispatched}")

    # Verificar en base de datos
    async with AsyncSessionLocal() as db:
        open_positions = await pm.get_open_positions(db, account.id)
        assert len(open_positions) == 1
        pos = open_positions[0]
        print(f"  [+] Posición auto-abierta en DB: ID={pos.id}, {pos.side} {pos.size} {pos.symbol} @ ${pos.entry_price:.2f}")
        assert pos.symbol == "BTC/USDT"
        assert pos.side == "BUY"
        assert pos.status == "OPEN"
        assert pos.signal_id == 1006
        # Verificar slippage aplicado: 65,000 + 1.5 bps = 65,009.75
        expected_slippage_price = 65000.0 * (1.0 + (1.5 / 10000.0))
        assert abs(float(pos.entry_price) - expected_slippage_price) < 0.1, f"Precio con slippage esperado ~{expected_slippage_price}, obtenido {pos.entry_price}"
        print(f"  [+] Slippage institucional (1.5 bps) aplicado con precisión: ${pos.entry_price:.2f}")

    # Filtro F: Prevención de duplicidad (intentar mandar la misma señal nuevamente)
    print("\n  [*] Probando filtro de duplicidad ante señal idéntica...")
    await redis_client.publish("signals:stream", json.dumps(valid_signal))
    for _ in range(20):
        if "POSITION_ALREADY_OPEN" in dispatcher.recent_activity[-1].get("reason", ""):
            break
        await asyncio.sleep(0.1)
    assert dispatcher.orders_dispatched == 1
    assert "POSITION_ALREADY_OPEN" in dispatcher.recent_activity[-1]["reason"]
    print("  [+] Filtro F: Prevención de orden duplicada verificada exitosamente.")

    # -------------------------------------------------------------
    # 4. Monitoreo Tick a Tick, Trailing Stop y Salida por Take Profit
    # -------------------------------------------------------------
    print("\n--- 4. Probando Monitoreo Tick a Tick en Vivo (Fase 7.3) ---")

    # A) Tick intermedio con subida (+2.6%): 66,700 USDT -> Debe activar Trailing Stop a Breakeven
    print("  [*] Emitiendo tick a 66,700 (+2.6%) en ticks:stream...")
    tick_mid = {"symbol": "BTC/USDT", "price": 66700.0, "time": datetime.now(timezone.utc).isoformat()}
    await redis_client.publish("ticks:stream", json.dumps(tick_mid))

    pos = None
    for _ in range(20):
        async with AsyncSessionLocal() as db:
            open_positions = await pm.get_open_positions(db, account.id)
            if open_positions and open_positions[0].trailing_stop_active:
                pos = open_positions[0]
                break
        await asyncio.sleep(0.1)

    assert pos is not None, "La posición no activó el Trailing Stop"
    print(f"  [+] Marcado a mercado: PnL flotante=${pos.unrealized_pnl:.2f} ({pos.return_pct:.2f}%)")
    print(f"  [+] Trailing Stop activado: {pos.trailing_stop_active}, Nivel: ${pos.trailing_stop_price}")
    assert pos.trailing_stop_active is True
    assert pos.trailing_stop_price is not None
    assert float(pos.trailing_stop_price) >= 65000.0

    # B) Tick final superando Take Profit: 68,350 USDT (TP está en 68,300)
    print("\n  [*] Emitiendo tick a 68,350 USDT superando Take Profit en ticks:stream...")
    tick_exit = {"symbol": "BTC/USDT", "price": 68350.0, "time": datetime.now(timezone.utc).isoformat()}
    await redis_client.publish("ticks:stream", json.dumps(tick_exit))

    for _ in range(25):
        async with AsyncSessionLocal() as db:
            open_positions = await pm.get_open_positions(db, account.id)
            if len(open_positions) == 0:
                break
        await asyncio.sleep(0.1)

    # Verificar que la posición fue cerrada automáticamente por Take Profit
    async with AsyncSessionLocal() as db:
        open_positions = await pm.get_open_positions(db, account.id)
        assert len(open_positions) == 0, f"Deberían haber 0 posiciones abiertas, hay {len(open_positions)}"


        closed_positions = await pm.get_closed_positions(db, account.id, limit=5)
        assert len(closed_positions) >= 1
        closed_trade = closed_positions[0]
        print(f"  [+] Posición cerrada automáticamente: Status={closed_trade.status}, Causa={closed_trade.close_reason}")
        print(f"  [+] PnL Realizado Neto: ${closed_trade.realized_pnl:.2f} ({closed_trade.return_pct:.2f}%)")
        assert closed_trade.status == "CLOSED"
        assert closed_trade.close_reason == "TAKE_PROFIT"
        assert float(closed_trade.realized_pnl) > 0

        # Verificar saldo de la cartera
        final_summary = await pm.get_account_summary(db, account.id)
        print(f"  [+] Saldo final de cartera: ${final_summary['current_balance']:.2f} (Ganancia total: +${final_summary['realized_pnl']:.2f})")
        assert final_summary["current_balance"] > 10000.0
        assert final_summary["winning_trades"] == 1
        assert final_summary["win_rate_pct"] == 100.0

    # -------------------------------------------------------------
    # 5. Prueba de Endpoints REST del Despachador (/dispatcher/*)
    # -------------------------------------------------------------
    print("\n--- 5. Probando Endpoints REST FastAPI para Dispatcher ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        anon = await client.post("/api/v1/paper/dispatcher/stop")
        assert anon.status_code == 401, f"Sin sesión debía responder 401, obtuvo {anon.status_code}"
        print("  [+] POST /api/v1/paper/dispatcher/stop sin sesión -> 401")
        install_test_session()

        # GET /api/v1/paper/dispatcher/status
        r_stat = await client.get("/api/v1/paper/dispatcher/status")
        assert r_stat.status_code == 200
        stat_data = r_stat.json()
        print(f"  [+] GET /api/v1/paper/dispatcher/status -> 200 OK | signals_received={stat_data['telemetry']['signals_received']}, auto_trade={stat_data['auto_trade_enabled']}")

        # POST /api/v1/paper/dispatcher/config
        r_cfg = await client.post(
            "/api/v1/paper/dispatcher/config",
            json={
                "min_confidence": 60.0,
                "risk_per_trade_pct": 1.5,
                "auto_trade_enabled": True,
            },
        )
        assert r_cfg.status_code == 200
        cfg_data = r_cfg.json()
        assert cfg_data["min_confidence"] == 60.0
        assert cfg_data["risk_per_trade_pct"] == 1.5
        print(f"  [+] POST /api/v1/paper/dispatcher/config -> 200 OK | min_conf={cfg_data['min_confidence']}%, risk={cfg_data['risk_per_trade_pct']}%")

        # POST /api/v1/paper/dispatcher/stop
        r_stop = await client.post("/api/v1/paper/dispatcher/stop")
        assert r_stop.status_code == 200
        print(f"  [+] POST /api/v1/paper/dispatcher/stop -> 200 OK | is_running={r_stop.json()['is_running']}")

        # POST /api/v1/paper/dispatcher/start
        r_start = await client.post("/api/v1/paper/dispatcher/start")
        assert r_start.status_code == 200
        print(f"  [+] POST /api/v1/paper/dispatcher/start -> 200 OK | is_running={r_start.json()['is_running']}")

    # Detener dispatcher de prueba
    await dispatcher.stop()
    await redis_client.aclose()

    print("\n" + "=" * 70)
    print("TODAS LAS PRUEBAS DE FASE 7.2 & 7.3 PASARON EXITOSAMENTE (100% OK)")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_tests())
