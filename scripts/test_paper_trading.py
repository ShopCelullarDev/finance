"""
Test Suite para la Fase 7.1: Gestor de Posiciones y Cartera Simulada (Paper Trading)
Verifica:
1. Dimensionamiento de posición (Position Sizer con ATR y riesgo fijo).
2. Apertura, marcado a mercado y cierre de posiciones con PortfolioManager.
3. Trailing Stop dinámico a Breakeven.
4. Endpoints REST de FastAPI (/api/v1/paper/*).
"""

import asyncio
import os
import sys
from decimal import Decimal

import httpx
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.main import app
from app.models.paper_trading import PaperAccount, PaperPosition
from app.schemas.paper_trading import OpenPositionRequest
from app.services.trading.portfolio_manager import PortfolioManager
from app.services.trading.position_sizer import PositionSizer


async def run_tests():
    print("=" * 70)
    print("TEST SUITE: FASE 7.1 - PAPER TRADING & PORTFOLIO MANAGER")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. Prueba Unitaria del Motor de Dimensionamiento (PositionSizer)
    # -------------------------------------------------------------
    print("\n--- 1. Probando PositionSizer (Riesgo Fijo & ATR) ---")
    sizer = PositionSizer(default_risk_pct=1.0, max_margin_pct=25.0)

    # Caso 1: Con margin cap activo (entry_price 65k, SL 64k -> requiere $6,500 de margen, pero max_margin_pct=25% limita a $2,500)
    res = sizer.calculate_size(
        symbol="BTC/USDT",
        side="BUY",
        entry_price=65000.0,
        total_equity=10000.0,
        available_cash=10000.0,
        stop_loss=64000.0,
    )
    print(f"  [+] BTC Long (Margin Capped): Tamaño={res.recommended_size} BTC, Margen=${res.required_margin:.2f}, Riesgo=${res.risk_amount_usdt:.2f} ({res.risk_pct}%)")
    assert res.is_affordable is True, "Debería ser ejecutable"
    assert res.required_margin <= 2500.01, f"Margen debe estar acotado a $2,500, obtenido {res.required_margin}"
    assert "Acotado al 25.0% de margen" in res.notes

    # Caso 2: Sin margin cap (ETH/USDT @ 2500, SL 2400 -> dist 100, unidades = 1.0 ETH, margen = $2,500 <= $2,500)
    res_unconstrained = sizer.calculate_size(
        symbol="ETH/USDT",
        side="BUY",
        entry_price=2500.0,
        total_equity=10000.0,
        available_cash=10000.0,
        stop_loss=2375.0,  # Distancia 125, unidades = 100/125 = 0.8 ETH, Margen = 0.8 * 2500 = $2,000 <= $2,500
    )
    print(f"  [+] ETH Long (Unconstrained): Tamaño={res_unconstrained.recommended_size} ETH, Margen=${res_unconstrained.required_margin:.2f}, Riesgo=${res_unconstrained.risk_amount_usdt:.2f} ({res_unconstrained.risk_pct}%)")
    assert abs(res_unconstrained.risk_amount_usdt - 100.0) < 1.0, f"Riesgo esperado ~$100, obtenido {res_unconstrained.risk_amount_usdt}"
    assert res_unconstrained.reward_risk_ratio >= 2.0, "R/R ratio debe ser >= 2.0"
    print(f"  [+] SL: {res_unconstrained.stop_loss}, TP: {res_unconstrained.take_profit}, R/R: {res_unconstrained.reward_risk_ratio}:1")


    # Caso 3: Capping de Margen Estricto al 25% ($2,500) ante Stop Loss ultracercano
    res_tight = sizer.calculate_size(
        symbol="BTC/USDT",
        side="BUY",
        entry_price=65000.0,
        total_equity=10000.0,
        available_cash=10000.0,
        stop_loss=64990.0,  # Distancia 10 USDT
    )
    print(f"  [+] Margen Capping Test: Margen=${res_tight.required_margin:.2f} (Límite: $2,500.00)")
    assert res_tight.required_margin <= 2505.0, "El margen no debe superar el 25% del capital"
    print("  [OK] PositionSizer validado exitosamente.")

    # -------------------------------------------------------------
    # 2. Prueba del Servicio PortfolioManager en Base de Datos
    # -------------------------------------------------------------
    print("\n--- 2. Probando PortfolioManager (Apertura, Trailing Stop, Cierre) ---")
    pm = PortfolioManager(position_sizer=sizer)

    async with AsyncSessionLocal() as db:
        # Obtener cuenta
        account = await pm.get_or_create_default_account(db)
        print(f"  [+] Cuenta: '{account.name}' (ID: {account.id})")

        # Reiniciar a $10,000 para entorno limpio de prueba
        account = await pm.reset_account(db, account.id, initial_balance=10000.0)
        summary = await pm.get_account_summary(db, account.id)
        assert summary["current_balance"] == 10000.0
        assert summary["open_positions_count"] == 0
        print(f"  [+] Saldo inicial verificado: ${summary['current_balance']:.2f}")

        # Abrir Posición LONG en BTC/USDT @ 65000 con SL 63500 y TP 68300
        open_req = OpenPositionRequest(
            symbol="BTC/USDT",
            side="BUY",
            risk_pct=1.0,
            stop_loss=63500.0,
            take_profit=68300.0,
            metadata={"source": "test_suite_phase7"},
        )
        pos = await pm.open_position(db, account.id, open_req, current_market_price=65000.0)
        print(f"  [+] Posición abierta: {pos.side} {pos.size} {pos.symbol} @ {pos.entry_price} (Margen: ${pos.margin_used:.2f})")
        assert pos.status == "OPEN"
        assert float(pos.size) > 0

        # Verificar deducción de efectivo y asignación de margen
        summary_after_open = await pm.get_account_summary(db, account.id)
        print(f"  [+] Efectivo restante: ${summary_after_open['current_balance']:.2f}, Margen en uso: ${summary_after_open['allocated_margin']:.2f}")
        assert summary_after_open["open_positions_count"] == 1
        assert summary_after_open["allocated_margin"] > 0
        assert summary_after_open["current_balance"] < 10000.0

        # Probar marcado a mercado y Trailing Stop dinámico
        # El TP está en 68300 (distancia = +3300). El 50% de la distancia es +1650 -> Precio 66650
        # Enviamos un tick a 66700 para forzar la activación de Trailing Stop a Breakeven
        print("\n  [*] Simulando subida de precio a 66,700 (+2.6%) para activar Trailing Stop...")
        updated_positions = await pm.update_market_price(db, "BTC/USDT", latest_price=66700.0)
        assert len(updated_positions) == 1
        updated_pos = updated_positions[0]
        print(f"  [+] PnL no realizado: ${updated_pos.unrealized_pnl:.2f} ({updated_pos.return_pct:.2f}%)")
        print(f"  [+] Trailing Stop Activo: {updated_pos.trailing_stop_active}, Nivel: ${updated_pos.trailing_stop_price}")
        assert updated_pos.unrealized_pnl > 0
        assert updated_pos.trailing_stop_active is True
        assert updated_pos.trailing_stop_price is not None
        assert float(updated_pos.trailing_stop_price) >= 65000.0  # Al menos en Breakeven

        # Probar cierre de posición manual a 67,000
        print("\n  [*] Cerrando posición con beneficio a $67,000...")
        closed_pos = await pm.close_position(db, pos.id, exit_price=67000.0, reason="MANUAL_PROFIT_TAKE")
        print(f"  [+] Posición cerrada: Status={closed_pos.status}, PnL Realizado: ${closed_pos.realized_pnl:.2f} ({closed_pos.return_pct:.2f}%)")
        assert closed_pos.status == "CLOSED"
        assert closed_pos.realized_pnl > 0
        assert closed_pos.close_reason == "MANUAL_PROFIT_TAKE"

        # Verificar balance final post-cierre
        final_summary = await pm.get_account_summary(db, account.id)
        print(f"  [+] Balance final: ${final_summary['current_balance']:.2f}, Capital total: ${final_summary['total_equity']:.2f}")
        print(f"  [+] Estadísticas: Trades={final_summary['total_trades']}, Ganadores={final_summary['winning_trades']}, Win Rate={final_summary['win_rate_pct']}%")
        assert final_summary["current_balance"] > 10000.0  # Capital creció
        assert final_summary["allocated_margin"] == 0.0     # Margen liberado
        assert final_summary["winning_trades"] == 1

        # Verificar curva de capital
        snapshots = await pm.get_equity_curve(db, account.id, limit=10)
        print(f"  [+] Puntos de curva de capital registrados: {len(snapshots)}")
        assert len(snapshots) >= 2
        print("  [OK] PortfolioManager validado exitosamente en base de datos.")

    # -------------------------------------------------------------
    # 3. Prueba de Endpoints REST (/api/v1/paper/*) con httpx
    # -------------------------------------------------------------
    print("\n--- 3. Probando Endpoints REST FastAPI (/api/v1/paper/*) ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # GET /api/v1/paper/account
        r = await client.get("/api/v1/paper/account")
        assert r.status_code == 200, f"Error {r.status_code}: {r.text}"
        acc_data = r.json()
        print(f"  [+] GET /api/v1/paper/account -> 200 OK | Capital: ${acc_data['total_equity']:.2f}, Win Rate: {acc_data['win_rate_pct']}%")

        # POST /api/v1/paper/calculate-sizing
        r_calc = await client.post(
            "/api/v1/paper/calculate-sizing",
            json={
                "symbol": "ETH/USDT",
                "side": "BUY",
                "entry_price": 2600.0,
                "stop_loss": 2520.0,
                "take_profit": 2776.0,
                "risk_pct": 1.0,
            },
        )
        assert r_calc.status_code == 200
        calc_data = r_calc.json()
        print(f"  [+] POST /api/v1/paper/calculate-sizing -> 200 OK | Tamaño sugerido: {calc_data['recommended_size']} ETH, Margen: ${calc_data['required_margin']:.2f}")

        # POST /api/v1/paper/positions/open
        r_open = await client.post(
            "/api/v1/paper/positions/open",
            json={
                "symbol": "ETH/USDT",
                "side": "BUY",
                "risk_pct": 1.0,
                "stop_loss": 2520.0,
                "take_profit": 2776.0,
            },
            params={"price": 2600.0},
        )
        assert r_open.status_code == 201, f"Error {r_open.status_code}: {r_open.text}"
        new_pos = r_open.json()
        pos_id = new_pos["id"]
        print(f"  [+] POST /api/v1/paper/positions/open -> 201 Created | ID: {pos_id}, Símbolo: {new_pos['symbol']}")

        # GET /api/v1/paper/positions/open
        r_open_list = await client.get("/api/v1/paper/positions/open")
        assert r_open_list.status_code == 200
        open_list = r_open_list.json()
        assert len(open_list) >= 1
        print(f"  [+] GET /api/v1/paper/positions/open -> 200 OK | {len(open_list)} posición(es) abierta(s)")

        # POST /api/v1/paper/positions/{id}/close
        r_close = await client.post(
            f"/api/v1/paper/positions/{pos_id}/close",
            json={"close_reason": "TAKE_PROFIT_API_TEST"},
            params={"exit_price": 2750.0},
        )
        assert r_close.status_code == 200
        closed_data = r_close.json()
        print(f"  [+] POST /api/v1/paper/positions/{pos_id}/close -> 200 OK | PnL: ${closed_data['realized_pnl']:.2f}")

        # GET /api/v1/paper/positions/history
        r_hist = await client.get("/api/v1/paper/positions/history")
        assert r_hist.status_code == 200
        hist_data = r_hist.json()
        print(f"  [+] GET /api/v1/paper/positions/history -> 200 OK | {len(hist_data)} trade(s) en historial")

        # GET /api/v1/paper/equity-curve
        r_eq = await client.get("/api/v1/paper/equity-curve")
        assert r_eq.status_code == 200
        eq_data = r_eq.json()
        print(f"  [+] GET /api/v1/paper/equity-curve -> 200 OK | {len(eq_data)} punto(s) de curva")

    print("\n" + "=" * 70)
    print("TODAS LAS PRUEBAS DE FASE 7.1 PASARON EXITOSAMENTE (100% OK)")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_tests())
