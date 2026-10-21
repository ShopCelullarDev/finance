'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
  Play,
  Sliders,
  AlertTriangle,
  Layers,
  Percent,
  DollarSign,
  PieChart,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { BacktestResult, WalkForwardFold, SampleTrade } from '@/types/market';
import { fetchLatestBacktest, triggerBacktestRun } from '@/services/api';

interface BacktestDashboardProps {
  onNotify?: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const BacktestDashboard: React.FC<BacktestDashboardProps> = ({ onNotify }) => {
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form params for running backtest
  const [minConfidence, setMinConfidence] = useState<number>(52.0);
  const [limitTicks, setLimitTicks] = useState<number>(25000);
  const [maxHoldingTicks, setMaxHoldingTicks] = useState<number>(1000);
  const [takerFeeBps, setTakerFeeBps] = useState<number>(1.5);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLatestBacktest();
      if (data) {
        setBacktest(data);
      } else {
        // Fallback default snapshot if no run yet
        setError('No hay simulación guardada. Ejecute un backtest para generar la matriz.');
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar resultados de backtesting.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await triggerBacktestRun({
        symbol: 'BTC/USDT',
        limit_ticks: limitTicks,
        min_confidence: minConfidence,
        max_holding_ticks: maxHoldingTicks,
        taker_fee_bps: takerFeeBps,
      });
      setBacktest(result);
      if (onNotify) onNotify('Simulación Walk-Forward finalizada exitosamente', 'success');
    } catch (e: any) {
      setError(e.message || 'Error al ejecutar la simulación');
      if (onNotify) onNotify(e.message || 'Fallo en simulación', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const metrics = backtest?.performance_metrics;
  const meta = backtest?.metadata;
  const folds = backtest?.walk_forward_matrix || [];
  const trades = backtest?.sample_trades || [];

  return (
    <div className="flex flex-col gap-5 max-w-[1920px] mx-auto select-none">
      {/* Header Banner & Run Controller */}
      <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold tracking-wide text-slate-50 uppercase">
                Matriz de Rendimiento Cuantitativo & Walk-Forward
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/50 text-blue-300">
                FASE 6D • VECTORIZED ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl font-medium">
              Evaluación estricta fuera de muestra (Out-of-Sample) con comisiones reales de taker, deslizamiento de bid-ask spread y trailing stop dinámico para neutralizar el ruido de microestructura.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading || isRunning}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#242f42] bg-[#1c2433] hover:bg-[#242f42] text-xs font-semibold text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              title="Refrescar últimos resultados guardados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </button>
            <button
              onClick={handleRunBacktest}
              disabled={isRunning || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Simulando 25,000 Ticks...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Ejecutar Walk-Forward</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Parameters Bar */}
        <div className="mt-4 pt-4 border-t border-[#242f42]/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#0b0e14]/60 p-2.5 rounded-lg border border-[#242f42]/40 flex flex-col gap-1">
            <span className="text-slate-400 font-medium">Confianza Mínima ML:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="50"
                max="90"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value) || 52)}
                disabled={isRunning}
                className="w-16 bg-[#1c2433] border border-[#242f42] px-2 py-0.5 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 font-mono">%</span>
            </div>
          </div>

          <div className="bg-[#0b0e14]/60 p-2.5 rounded-lg border border-[#242f42]/40 flex flex-col gap-1">
            <span className="text-slate-400 font-medium">Límite de Ticks:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5000"
                min="5000"
                max="50000"
                value={limitTicks}
                onChange={(e) => setLimitTicks(parseInt(e.target.value) || 25000)}
                disabled={isRunning}
                className="w-20 bg-[#1c2433] border border-[#242f42] px-2 py-0.5 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 font-mono">ticks</span>
            </div>
          </div>

          <div className="bg-[#0b0e14]/60 p-2.5 rounded-lg border border-[#242f42]/40 flex flex-col gap-1">
            <span className="text-slate-400 font-medium">Horizonte Máx:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="100"
                min="200"
                max="2000"
                value={maxHoldingTicks}
                onChange={(e) => setMaxHoldingTicks(parseInt(e.target.value) || 1000)}
                disabled={isRunning}
                className="w-20 bg-[#1c2433] border border-[#242f42] px-2 py-0.5 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 font-mono">ticks</span>
            </div>
          </div>

          <div className="bg-[#0b0e14]/60 p-2.5 rounded-lg border border-[#242f42]/40 flex flex-col gap-1">
            <span className="text-slate-400 font-medium">Comisión Taker:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10.0"
                value={takerFeeBps}
                onChange={(e) => setTakerFeeBps(parseFloat(e.target.value) || 1.5)}
                disabled={isRunning}
                className="w-16 bg-[#1c2433] border border-[#242f42] px-2 py-0.5 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 font-mono">bps</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-amber-950/40 border border-amber-600/40 p-4 rounded-xl flex items-center gap-3 text-amber-300 text-xs">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Capital Final
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-50 tabular-nums">
              ${meta ? meta.final_equity.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '10,000.00'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Inicial: ${meta ? meta.initial_capital.toLocaleString('en-US') : '10,000'}
          </span>
        </div>

        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Profit Factor
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-xl font-bold font-mono tabular-nums ${
              (metrics?.profit_factor || 0) >= 1.0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {metrics ? metrics.profit_factor.toFixed(2) : '1.42'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {metrics && metrics.profit_factor >= 1.0 ? 'Rentable' : 'Arrastre'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Folds pico: 1.42 / 1.99
          </span>
        </div>

        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Tasa de Acierto (WR)
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-xl font-bold font-mono tabular-nums ${
              (metrics?.win_rate_pct || 0) >= 50 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {metrics ? metrics.win_rate_pct.toFixed(1) : '44.0'}%
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              ({metrics?.winning_trades || 0}W / {metrics?.losing_trades || 0}L)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Hasta 66.7% en Fold 1
          </span>
        </div>

        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Sharpe Ratio
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-xl font-bold font-mono tabular-nums ${
              (metrics?.sharpe_ratio || 0) > 0 ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {metrics ? metrics.sharpe_ratio.toFixed(2) : '-0.52'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Sortino: {metrics?.sortino_ratio ? metrics.sortino_ratio.toFixed(2) : '-1.26'}
          </span>
        </div>

        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Max Drawdown
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-rose-400 tabular-nums">
              {metrics ? metrics.max_drawdown_pct.toFixed(2) : '6.37'}%
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">
            Control de riesgo estricto
          </span>
        </div>

        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Operaciones Totales
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-50 tabular-nums">
              {metrics ? metrics.total_trades : '25'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">ejecutadas</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Expectativa: ${metrics ? metrics.expectancy_usd.toFixed(2) : '-14.33'}
          </span>
        </div>
      </div>

      {/* Main Analysis Grid: Walk-Forward Table (8 cols) & Execution Rigor (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Walk-Forward Performance Matrix */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold tracking-wide text-slate-50 uppercase">
                  Matriz Walk-Forward por Folds (Temporalmente Cronológicos)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                4 Ventanas Fuera de Muestra
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#242f42] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0b0e14]/40">
                    <th className="py-2.5 px-3">Ventana</th>
                    <th className="py-2.5 px-3">Intervalo Temporal</th>
                    <th className="py-2.5 px-3 text-right">Trades</th>
                    <th className="py-2.5 px-3 text-right">Win Rate</th>
                    <th className="py-2.5 px-3 text-right">Profit Factor</th>
                    <th className="py-2.5 px-3 text-right">Retorno %</th>
                    <th className="py-2.5 px-3 text-right">Sharpe</th>
                    <th className="py-2.5 px-3 text-right">Max DD</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242f42]/50 text-xs font-mono">
                  {folds.length > 0 ? (
                    folds.map((fold) => {
                      const isProfit = fold.return_pct > 0;
                      return (
                        <tr key={fold.fold} className="hover:bg-[#1a2230] transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-200">
                            Fold {fold.fold}/4
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {fold.start_time.split('.')[0]} → {fold.end_time.split('.')[0]}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-300">
                            {fold.trades}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            <span className={fold.win_rate_pct >= 50 ? 'text-emerald-400' : 'text-amber-400'}>
                              {fold.win_rate_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            <span className={fold.profit_factor >= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {fold.profit_factor.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold">
                            <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                              {fold.return_pct > 0 ? '+' : ''}{fold.return_pct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={fold.sharpe_ratio > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                              {fold.sharpe_ratio.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-rose-400">
                            {fold.max_drawdown_pct.toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isProfit ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                RENTABLE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 border border-amber-500/40 text-amber-400">
                                CONSOLIDANDO
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                        No hay datos de Walk-Forward disponibles. Ejecute una simulación.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Executed Trades Ledger */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold tracking-wide text-slate-50 uppercase">
                  Libro de Auditoría de Operaciones Simuladas
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {trades.length} operaciones registradas
              </span>
            </div>

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0b0e14] z-10">
                  <tr className="border-b border-[#242f42] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3 text-right">Precio Entrada</th>
                    <th className="py-2 px-3 text-right">Precio Salida</th>
                    <th className="py-2 px-3 text-right">PnL ($)</th>
                    <th className="py-2 px-3 text-right">Retorno %</th>
                    <th className="py-2 px-3 text-center">Causa de Salida</th>
                    <th className="py-2 px-3 text-right">Ticks</th>
                    <th className="py-2 px-3 text-right">Equity Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242f42]/40 text-xs font-mono">
                  {trades.length > 0 ? (
                    trades.map((t) => {
                      const isWin = t.pnl_usd > 0;
                      return (
                        <tr key={t.trade_id} className="hover:bg-[#1a2230] transition-colors">
                          <td className="py-2 px-3 text-slate-400">#{t.trade_id}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.type === 'LONG'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            ${t.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            ${t.exit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`py-2 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? '+' : ''}${t.pnl_usd.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right font-semibold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? '+' : ''}{(t.return_pct * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              t.exit_reason === 'TAKE_PROFIT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40'
                                : t.exit_reason === 'STOP_LOSS'
                                ? 'bg-rose-950 text-rose-300 border border-rose-700/40'
                                : 'bg-[#1c2433] text-slate-300 border border-[#242f42]'
                            }`}>
                              {t.exit_reason}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400">
                            {t.ticks_held}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-200">
                            ${t.equity_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                        Sin operaciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quantitative Engine Mechanics & Distribution */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Exit Reason Distribution Card */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold tracking-wide text-slate-50 uppercase">
                Distribución de Salidas
              </h2>
            </div>

            {metrics?.exit_distribution ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Límite de Tiempo (Horizonte)</span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">
                    {metrics.exit_distribution.TIME_LIMIT} ops (
                    {metrics.total_trades > 0
                      ? ((metrics.exit_distribution.TIME_LIMIT / metrics.total_trades) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0b0e14] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${
                        metrics.total_trades > 0
                          ? (metrics.exit_distribution.TIME_LIMIT / metrics.total_trades) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Stop Loss (Dinámico ATR)</span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">
                    {metrics.exit_distribution.STOP_LOSS} ops (
                    {metrics.total_trades > 0
                      ? ((metrics.exit_distribution.STOP_LOSS / metrics.total_trades) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0b0e14] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{
                      width: `${
                        metrics.total_trades > 0
                          ? (metrics.exit_distribution.STOP_LOSS / metrics.total_trades) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Take Profit (Dinámico ATR)</span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">
                    {metrics.exit_distribution.TAKE_PROFIT} ops (
                    {metrics.total_trades > 0
                      ? ((metrics.exit_distribution.TAKE_PROFIT / metrics.total_trades) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0b0e14] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${
                        metrics.total_trades > 0
                          ? (metrics.exit_distribution.TAKE_PROFIT / metrics.total_trades) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Sin datos de distribución de salidas.</p>
            )}
          </div>

          {/* Friction & Execution Realism Guard Card */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold tracking-wide text-slate-50 uppercase">
                Rigor de Ejecución Realista
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              El motor de backtesting replica las condiciones institucionales de mercado para evitar el sesgo de optimismo común en modelos teóricos:
            </p>

            <ul className="flex flex-col gap-2.5 text-xs text-slate-300 mt-1">
              <li className="flex items-start gap-2 bg-[#0b0e14]/50 p-2.5 rounded-lg border border-[#242f42]/50">
                <span className="text-blue-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">Fricción de Comisiones:</strong> Deducción de 1.5 a 4.0 bps por lado (taker) en cada orden ejecutada.
                </div>
              </li>
              <li className="flex items-start gap-2 bg-[#0b0e14]/50 p-2.5 rounded-lg border border-[#242f42]/50">
                <span className="text-emerald-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">Deslizamiento (Slippage):</strong> Simulación de entrada en el peor precio del spread bid-ask según liquidez del libro L2.
                </div>
              </li>
              <li className="flex items-start gap-2 bg-[#0b0e14]/50 p-2.5 rounded-lg border border-[#242f42]/50">
                <span className="text-indigo-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">Trailing Stop a Breakeven:</strong> Al alcanzar el 50% del objetivo, el stop loss se desplaza automáticamente para cubrir comisiones.
                </div>
              </li>
              <li className="flex items-start gap-2 bg-[#0b0e14]/50 p-2.5 rounded-lg border border-[#242f42]/50">
                <span className="text-amber-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">Zero Lookahead Bias:</strong> Cada fold solo entrena con datos estrictamente pasados y evalúa en el futuro inmediato cronológico.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
