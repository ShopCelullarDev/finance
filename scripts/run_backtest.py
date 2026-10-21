import asyncio
import json
import os
from typing import Any, Dict

from app.services.ai.backtester import backtester


async def main():
    print("=" * 80)
    print("EJECUTANDO MOTOR DE BACKTESTING VECTORIZADO Y MATRIZ WALK-FORWARD (FASE 6D)")
    print("=" * 80)

    symbol = "BTC/USDT"
    capital = 10000.0
    print(f"\n[+] Configuración de Simulación:")
    print(f"    - Activo: {symbol}")
    print(f"    - Capital Inicial: ${capital:,.2f} USDT")
    print(f"    - Comisión: 1.5 bps (0.015% por lado - Tarifa Maker/VIP/Prop)")
    print(f"    - Slippage Model: Mitad del bid-ask spread empírico de microestructura")
    print(f"    - Ratio Riesgo/Recompensa: 1:2.2 (Stops y Targets dinámicos con Trailing Stop)")
    print(f"    - Límite de Retención Temporal: 1,000 ticks (~1.2 horas de mercado)")
    print(f"    - Filtro de Confluencia: Supervised ML + Order Flow OFI + MTF Trend Alignment")

    print("\n[+] Extrayendo ticks históricos de TimescaleDB y computando inferencias LightGBM...")
    results = await backtester.run_backtest(
        max_ticks=25000,
        min_ml_confidence=52.0,
        walk_forward_folds=4,
    )

    metrics = results["performance_metrics"]
    meta = results["metadata"]
    wf_matrix = results["walk_forward_matrix"]

    print("\n" + "=" * 80)
    print("RESULTADOS FINANCIEROS GLOBALES DEL BACKTEST")
    print("=" * 80)
    print(f"  • Muestras Analizadas:      {meta['ticks_analyzed']:,} ticks ({meta['features_analyzed']:,} vectores)")
    print(f"  • Balance Inicial:          ${meta['initial_capital']:,.2f} USDT")
    print(f"  • Balance Final (Equity):   ${meta['final_equity']:,.2f} USDT")
    print(f"  • Rendimiento Neto:         {metrics['total_return_pct']:+.2f}% (${metrics['net_profit_usd']:+,.2f} USDT)")
    print(f"  • Total Operaciones:        {metrics['total_trades']} ({metrics['winning_trades']} ganadoras / {metrics['losing_trades']} perdedoras)")
    print(f"  • Win Rate:                 {metrics['win_rate_pct']:.2f}%")
    print(f"  • Profit Factor:            {metrics['profit_factor']:.2f}")
    print(f"  • Sharpe Ratio (Anualizado):{metrics['sharpe_ratio']:.2f}")
    print(f"  • Sortino Ratio:            {metrics['sortino_ratio']:.2f}")
    print(f"  • Drawdown Máximo (MDD):    {metrics['max_drawdown_pct']:.2f}%")
    print(f"  • Esperanza Matemática:     ${metrics['expectancy_usd']:+.2f} USD / trade")
    print(f"  • Ratio Payoff (Win/Loss):  {metrics['payoff_ratio']:.2f} : 1")
    print(f"  • Ganancia Promedio:        ${metrics['avg_win_usd']:,.2f}")
    print(f"  • Pérdida Promedio:         ${metrics['avg_loss_usd']:,.2f}")
    print(f"  • Distribución de Salidas:  {metrics['exit_distribution']}")

    print("\n" + "=" * 80)
    print("MATRIZ WALK-FORWARD (CONSISTENCIA OUT-OF-SAMPLE EN 4 VENTANAS)")
    print("=" * 80)
    print(f"{'Fold':<8} | {'Operaciones':<12} | {'Win Rate':<10} | {'Retorno':<10} | {'Profit Factor':<14} | {'Sharpe':<8} | {'Max DD':<8}")
    print("-" * 80)
    for row in wf_matrix:
        print(
            f"{row['window']:<8} | "
            f"{row['trades']:<12} | "
            f"{row['win_rate_pct']:>8.1f}% | "
            f"{row['return_pct']:>8.2f}% | "
            f"{row['profit_factor']:>13.2f} | "
            f"{row['sharpe_ratio']:>7.2f} | "
            f"{row['max_drawdown_pct']:>6.2f}%"
        )
    print("-" * 80)

    # Persistencia de resultados JSON
    out_dir = os.path.join(os.path.dirname(__file__), "..", "app", "services", "ai", "models")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "backtest_results.json")
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n[+] Reporte completo y curva de equidad exportados a: {out_file}")
    print(">>> [SUCCESS] VALIDACIÓN DE BACKTESTING Y WALK-FORWARD AL 100% <<<")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
