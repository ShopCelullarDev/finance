'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Layers,
  Zap,
  Play,
  Square,
  RefreshCw,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Radio,
  FileText,
  X,
  Target,
  Crosshair,
  Info,
  Wallet,
  Scale,
} from 'lucide-react';
import {
  PaperAccount,
  PaperPosition,
  PaperEquitySnapshot,
  PositionSizingResult,
  OrderDispatcherStatus,
  OrderDispatcherConfig,
  DualPortfolioSummary,
} from '@/types/market';
import {
  fetchPaperAccount,
  fetchOpenPositions,
  fetchClosedPositions,
  fetchEquityCurve,
  calculatePositionSizing,
  openPaperPosition,
  closePaperPosition,
  resetPaperAccount,
  fetchDispatcherStatus,
  updateDispatcherConfig,
  startDispatcher,
  stopDispatcher,
  fetchDualPortfolioSummary,
  fundAccount,
} from '@/services/api';

interface PaperTradingDashboardProps {
  currentPriceMap?: Record<string, number>;
  onNotify?: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const PaperTradingDashboard: React.FC<PaperTradingDashboardProps> = ({
  currentPriceMap = {},
  onNotify,
}) => {
  // Mode Selector: Saldo Ficticio (Paper) vs Saldo Real (Live) vs Comparativa
  const [accountMode, setAccountMode] = useState<'SIMULATED' | 'REAL' | 'COMPARATIVE'>('SIMULATED');
  const [dualSummary, setDualSummary] = useState<DualPortfolioSummary | null>(null);

  // Account & Positions State
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<PaperPosition[]>([]);
  const [equityCurve, setEquityCurve] = useState<PaperEquitySnapshot[]>([]);
  const [dispatcherStatus, setDispatcherStatus] = useState<OrderDispatcherStatus | null>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Fund Real Account Modal State
  const [isFundModalOpen, setIsFundModalOpen] = useState<boolean>(false);
  const [fundAmount, setFundAmount] = useState<string>('5000');
  const [fundOperation, setFundOperation] = useState<'SET' | 'DEPOSIT'>('SET');
  const [isFunding, setIsFunding] = useState<boolean>(false);

  // Manual Order Execution Form
  const [orderSymbol, setOrderSymbol] = useState<string>('BTC/USDT');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderRiskPct, setOrderRiskPct] = useState<number>(1.0);
  const [orderStopLoss, setOrderStopLoss] = useState<string>('');
  const [orderTakeProfit, setOrderTakeProfit] = useState<string>('');
  const [sizingResult, setSizingResult] = useState<PositionSizingResult | null>(null);
  const [isCalculatingSizing, setIsCalculatingSizing] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Dispatcher Config Controls
  const [autoTradeEnabled, setAutoTradeEnabled] = useState<boolean>(false);
  const [minConfidence, setMinConfidence] = useState<number>(55.0);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [maxSlippageBps, setMaxSlippageBps] = useState<number>(2.0);
  const [requireMlAgreement, setRequireMlAgreement] = useState<boolean>(true);
  const [requireOfiConfluence, setRequireOfiConfluence] = useState<boolean>(true);
  const [avoidSqueeze, setAvoidSqueeze] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Refresh All Data
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const activeType = accountMode === 'REAL' ? 'REAL' : 'SIMULATED';
      const [acc, openPos, closedPos, eqCurve, disp, dual] = await Promise.all([
        fetchPaperAccount(activeType).catch(() => null),
        fetchOpenPositions(activeType).catch(() => []),
        fetchClosedPositions(50, activeType).catch(() => []),
        fetchEquityCurve(60, activeType).catch(() => []),
        fetchDispatcherStatus().catch(() => null),
        fetchDualPortfolioSummary().catch(() => null),
      ]);

      if (acc) setAccount(acc);
      setOpenPositions(openPos);
      setClosedPositions(closedPos);
      setEquityCurve(eqCurve);
      if (dual) setDualSummary(dual);

      if (disp) {
        setDispatcherStatus(disp);
        setAutoTradeEnabled(disp.auto_trade_enabled);
        setMinConfidence(disp.min_confidence * 100);
        setRiskPerTrade(disp.risk_per_trade_pct * 100);
        setMaxSlippageBps(disp.default_taker_slippage_bps);
        setRequireMlAgreement(disp.require_ml_agreement);
        setRequireOfiConfluence(disp.require_ofi_confluence);
        setAvoidSqueeze(disp.avoid_squeeze_regime);
      }
    } catch (err: any) {
      console.error('[PaperTrading] Error al refrescar datos:', err);
    } finally {
      setLoading(false);
      if (!isSilent) setIsRefreshing(false);
    }
  }, [accountMode]);

  // Polling loop
  useEffect(() => {
    loadAllData(false);
    const interval = setInterval(() => {
      loadAllData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // Handle position sizing preview calculation
  const handleCalculateSizing = useCallback(async () => {
    const markPrice = currentPriceMap[orderSymbol] || (orderSymbol === 'BTC/USDT' ? 82450.5 : 2450.0);
    setIsCalculatingSizing(true);
    try {
      const sl = parseFloat(orderStopLoss) || undefined;
      const tp = parseFloat(orderTakeProfit) || undefined;
      const res = await calculatePositionSizing({
        symbol: orderSymbol,
        side: orderSide,
        entry_price: markPrice,
        stop_loss: sl,
        take_profit: tp,
        risk_pct: orderRiskPct / 100,
        account_type: accountMode === 'REAL' ? 'REAL' : 'SIMULATED',
      });
      setSizingResult(res);
      if (!orderStopLoss && res.stop_loss) {
        setOrderStopLoss(res.stop_loss.toFixed(2));
      }
      if (!orderTakeProfit && res.take_profit) {
        setOrderTakeProfit(res.take_profit.toFixed(2));
      }
    } catch (err: any) {
      console.warn('[Sizing] Error:', err);
    } finally {
      setIsCalculatingSizing(false);
    }
  }, [orderSymbol, orderSide, orderRiskPct, orderStopLoss, orderTakeProfit, currentPriceMap, accountMode]);

  // Recalculate on symbol/side change
  useEffect(() => {
    handleCalculateSizing();
  }, [orderSymbol, orderSide, accountMode]);

  // Submit manual order
  const handleOpenPosition = async () => {
    setIsSubmittingOrder(true);
    try {
      const markPrice = currentPriceMap[orderSymbol] || (orderSymbol === 'BTC/USDT' ? 82450.5 : 2450.0);
      const sl = parseFloat(orderStopLoss) || undefined;
      const tp = parseFloat(orderTakeProfit) || undefined;
      const activeType = accountMode === 'REAL' ? 'REAL' : 'SIMULATED';

      await openPaperPosition(
        {
          symbol: orderSymbol,
          side: orderSide,
          risk_pct: orderRiskPct / 100,
          stop_loss: sl,
          take_profit: tp,
          metadata: { execution_mode: 'MANUAL_TERMINAL', account_type: activeType },
        },
        markPrice,
        activeType
      );

      if (onNotify) {
        onNotify(
          `Posición ${orderSide} en ${orderSymbol} ejecutada en ${activeType === 'REAL' ? 'libro B' : 'libro demo'} con éxito`,
          'success'
        );
      }
      await loadAllData(true);
    } catch (err: any) {
      if (onNotify) {
        onNotify(err.message || 'Error abriendo posición', 'error');
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Close open position manually
  const handleClosePosition = async (positionId: string, symbol: string) => {
    setClosingPositionId(positionId);
    try {
      const markPrice = currentPriceMap[symbol];
      await closePaperPosition(positionId, markPrice, 'MANUAL_TERMINAL_EXIT');
      if (onNotify) {
        onNotify(`Posición en ${symbol} cerrada y margen liberado`, 'success');
      }
      await loadAllData(true);
    } catch (err: any) {
      if (onNotify) {
        onNotify(err.message || 'Error al cerrar la posición', 'error');
      }
    } finally {
      setClosingPositionId(null);
    }
  };

  // Dispatcher Controls
  const handleToggleAutoTrade = async () => {
    setIsSavingConfig(true);
    try {
      const nextState = !autoTradeEnabled;
      const updated = await updateDispatcherConfig({
        auto_trade_enabled: nextState,
      });
      setAutoTradeEnabled(updated.auto_trade_enabled);
      setDispatcherStatus(updated);
      if (onNotify) {
        onNotify(
          nextState
            ? 'Auto-Trading ACTIVADO: Ejecutando señales con confluencia'
            : 'Auto-Trading PAUSADO: Modo solo monitoreo',
          'info'
        );
      }
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Error actualizando auto-trade', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveDispatcherConfig = async () => {
    setIsSavingConfig(true);
    try {
      const updated = await updateDispatcherConfig({
        auto_trade_enabled: autoTradeEnabled,
        min_confidence: minConfidence / 100,
        risk_per_trade_pct: riskPerTrade / 100,
        default_taker_slippage_bps: maxSlippageBps,
        require_ml_agreement: requireMlAgreement,
        require_ofi_confluence: requireOfiConfluence,
        avoid_squeeze_regime: avoidSqueeze,
      });
      setDispatcherStatus(updated);
      if (onNotify) onNotify('Parámetros de confluencia guardados correctamente', 'success');
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Error guardando parámetros', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleWorker = async () => {
    setIsSavingConfig(true);
    try {
      if (dispatcherStatus?.is_running) {
        const res = await stopDispatcher();
        setDispatcherStatus(res);
        if (onNotify) onNotify('Worker en segundo plano detenido', 'info');
      } else {
        const res = await startDispatcher();
        setDispatcherStatus(res);
        if (onNotify) onNotify('Worker en segundo plano iniciado', 'success');
      }
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Error modificando estado del worker', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Account Reset
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const activeType = accountMode === 'REAL' ? 'REAL' : 'SIMULATED';
      const initialBal = activeType === 'REAL' ? 0.0 : 10000.0;
      await resetPaperAccount(initialBal, activeType);
      setIsResetModalOpen(false);
      if (onNotify) {
        onNotify(
          activeType === 'REAL'
            ? 'Libro B restablecido a $0.00 USDT'
            : 'Cartera Simulada restablecida a $10,000.00 USDT',
          'success'
        );
      }
      await loadAllData(false);
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Error reiniciando cuenta', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Fund / Adjust Real Account Balance
  const handleConfirmFund = async () => {
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt < 0) {
      if (onNotify) onNotify('Por favor ingresa un monto válido en USDT', 'error');
      return;
    }
    setIsFunding(true);
    try {
      await fundAccount({
        amount: amt,
        operation_type: fundOperation,
        account_type: 'REAL',
      });
      setIsFundModalOpen(false);
      if (onNotify) {
        onNotify(
          fundOperation === 'SET'
            ? `Saldo del libro B establecido a $${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT`
            : `Depósito de $${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT acreditado al libro B`,
          'success'
        );
      }
      await loadAllData(false);
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Error al fondear saldo real', 'error');
    } finally {
      setIsFunding(false);
    }
  };

  // Compute SVG Equity Curve
  const renderEquityCurveSvg = () => {
    if (!equityCurve || equityCurve.length < 2) {
      return (
        <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
          <Activity className="w-6 h-6 text-slate-600 animate-pulse" />
          <span>Generando snapshots de curva de capital...</span>
        </div>
      );
    }

    const width = 640;
    const height = 180;
    const padding = 24;

    const values = equityCurve.map((s) => s.total_equity);
    const minVal = Math.min(...values) * 0.998;
    const maxVal = Math.max(...values) * 1.002;
    const range = maxVal - minVal || 1;

    const points = equityCurve.map((s, idx) => {
      const x = padding + (idx / (equityCurve.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((s.total_equity - minVal) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `M ${points[0]} L ${points.join(' L ')} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

    const isProfit = (account?.total_equity || initialBalance) >= initialBalance;
    const strokeColor = isProfit ? '#10b981' : '#ef4444';
    const fillGradientId = isProfit ? 'equityGradGreen' : 'equityGradRed';

    return (
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="equityGradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="equityGradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference grid line */}
          <line
            x1={padding}
            y1={height - padding - ((initialBalance - minVal) / range) * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - ((initialBalance - minVal) / range) * (height - 2 * padding)}
            stroke="#242f42"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaD} fill={`url(#${fillGradientId})`} />

          {/* Line stroke */}
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />

          {/* Latest Point Pulsing Dot */}
          {points.length > 0 && (
            <circle
              cx={parseFloat(points[points.length - 1].split(',')[0])}
              cy={parseFloat(points[points.length - 1].split(',')[1])}
              r="4.5"
              fill={strokeColor}
              className="animate-ping origin-center"
              opacity="0.75"
            />
          )}
          {points.length > 0 && (
            <circle
              cx={parseFloat(points[points.length - 1].split(',')[0])}
              cy={parseFloat(points[points.length - 1].split(',')[1])}
              r="3.5"
              fill="#ffffff"
            />
          )}
        </svg>

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1 px-2">
          <span>Base: ${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>Máx: ${maxVal.toFixed(2)}</span>
          <span>Actual: ${(account?.total_equity ?? initialBalance).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const defaultInit = accountMode === 'REAL' ? 0.0 : 10000.0;
  const initialBalance = account?.initial_balance ?? defaultInit;
  const totalEquity = account?.total_equity ?? initialBalance;
  const totalReturnPct = initialBalance > 0 ? ((totalEquity - initialBalance) / initialBalance) * 100 : 0.0;
  const cashBalance = account?.current_balance ?? initialBalance;
  const marginAllocated = account?.allocated_margin ?? 0.0;
  const unrealizedPnl = account?.unrealized_pnl ?? 0.0;
  const realizedPnl = account?.realized_pnl ?? 0.0;
  const winRate = account?.win_rate_pct ?? 0.0;
  const profitFactor = account?.profit_factor ?? 0.0;
  const totalTrades = account?.total_trades ?? 0;
  const winningTrades = account?.winning_trades ?? 0;
  const losingTrades = account?.losing_trades ?? 0;

  // Render Side-by-Side Comparative Analysis Board
  const renderComparativeAnalytics = () => {
    const sim = dualSummary?.simulated;
    const real = dualSummary?.real;

    const simEquity = sim?.total_equity ?? 10000;
    const realEquity = real?.total_equity ?? 0;
    const simReturn = sim && sim.initial_balance > 0 ? ((simEquity - sim.initial_balance) / sim.initial_balance) * 100 : 0;
    const realReturn = real && real.initial_balance > 0 ? ((realEquity - real.initial_balance) / real.initial_balance) * 100 : 0;
    const deltaReturn = realReturn - simReturn;
    const simWinRate = sim?.win_rate_pct ?? 0;
    const realWinRate = real?.win_rate_pct ?? 0;
    const deltaWinRate = realWinRate - simWinRate;
    const simPnl = sim?.realized_pnl ?? 0;
    const realPnl = real?.realized_pnl ?? 0;
    const deltaPnl = realPnl - simPnl;

    return (
      <div className="flex flex-col gap-5">
        {/* Comparative Executive Banner */}
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-emerald-950/40 border border-[#242f42] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Scale className="w-5 h-5" />
                </span>
                <h2 className="text-base font-bold text-slate-100 tracking-wide uppercase">
                  Matriz comparativa: libro demo vs libro B
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Los dos libros son contables. Ninguno envía órdenes a un exchange. Compara retornos, tasa de acierto y comisiones entre el demo y el libro B.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAccountMode('SIMULATED')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer"
              >
                Ir a Saldo Ficticio
              </button>
              <button
                onClick={() => setAccountMode('REAL')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
              >
                Ir al libro B
              </button>
            </div>
          </div>
        </div>

        {/* Side-by-Side Dual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card Left: Saldo Ficticio (Simulado) */}
          <div className="bg-[#131923] border border-blue-500/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-blue-950 text-blue-400 border-b border-l border-blue-500/30 text-[10px] font-bold uppercase rounded-bl-lg">
              Simulación Demo
            </div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Cartera Simulada (Saldo Ficticio)
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42]">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Capital Total</span>
                <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">
                  ${simEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-blue-400 mt-0.5">
                  Base: ${(sim?.initial_balance ?? 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42]">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Retorno Acumulado</span>
                <div className={`text-xl font-bold font-mono mt-0.5 ${simReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {simReturn >= 0 ? '+' : ''}{simReturn.toFixed(2)}%
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  PnL: {simPnl >= 0 ? '+' : ''}${simPnl.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Metrics List */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Saldo Disponible (Cash):</span>
                <span className="text-slate-200 font-bold">${(sim?.current_balance ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Margen Asignado:</span>
                <span className="text-slate-200 font-bold">${(sim?.allocated_margin ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Win Rate Histórico:</span>
                <span className="text-blue-400 font-bold">{simWinRate.toFixed(1)}% ({sim?.winning_trades ?? 0}W / {sim?.losing_trades ?? 0}L)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Profit Factor:</span>
                <span className="text-slate-200 font-bold">{sim?.profit_factor ? sim.profit_factor.toFixed(2) : '-'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400 font-sans">Total de Operaciones:</span>
                <span className="text-slate-200 font-bold">{sim?.total_trades ?? 0} trades</span>
              </div>
            </div>

            <button
              onClick={() => setAccountMode('SIMULATED')}
              className="mt-4 w-full py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-md shadow-blue-600/20"
            >
              Ver Detalle y Operar en Modo Ficticio
            </button>
          </div>

          {/* Card Right: Saldo Real (Capital en Vivo) */}
          <div className="bg-[#131923] border border-emerald-500/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-950 text-emerald-400 border-b border-l border-emerald-500/30 text-[10px] font-bold uppercase rounded-bl-lg">
              Libro contable B
            </div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Libro B (contable)
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42]">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Capital Total</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  ${realEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Base: ${(real?.initial_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42]">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Retorno Acumulado</span>
                <div className={`text-xl font-bold font-mono mt-0.5 ${realReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {realReturn >= 0 ? '+' : ''}{realReturn.toFixed(2)}%
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  PnL: {realPnl >= 0 ? '+' : ''}${realPnl.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Metrics List */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Saldo Disponible (Cash):</span>
                <span className="text-slate-200 font-bold">${(real?.current_balance ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Margen Comprometido:</span>
                <span className="text-slate-200 font-bold">${(real?.allocated_margin ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Win Rate Real:</span>
                <span className="text-emerald-400 font-bold">{realWinRate.toFixed(1)}% ({real?.winning_trades ?? 0}W / {real?.losing_trades ?? 0}L)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1c2433]">
                <span className="text-slate-400 font-sans">Profit Factor:</span>
                <span className="text-slate-200 font-bold">{real?.profit_factor ? real.profit_factor.toFixed(2) : '-'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400 font-sans">Total de Operaciones:</span>
                <span className="text-slate-200 font-bold">{real?.total_trades ?? 0} trades</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setAccountMode('REAL')}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                Ver Detalle y Operar en Modo Real
              </button>
              <button
                onClick={() => setIsFundModalOpen(true)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0b0e14] hover:bg-[#1c2433] text-emerald-400 border border-emerald-500/40 transition-all cursor-pointer"
                title="Ajustar o depositar saldo real"
              >
                Fondear
              </button>
            </div>
          </div>
        </div>

        {/* Divergence & Alpha Gap Matrix */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Análisis Cuantitativo de Divergencia & Fricción de Mercado
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0b0e14] p-4 rounded-lg border border-[#242f42]">
              <span className="text-[11px] text-slate-400 font-medium">Divergencia de Retorno (% Delta)</span>
              <div className={`text-xl font-bold font-mono mt-1 ${deltaReturn >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {deltaReturn >= 0 ? '+' : ''}{deltaReturn.toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Diferencia de rentabilidad entre ejecuciones reales y simuladas.
              </p>
            </div>

            <div className="bg-[#0b0e14] p-4 rounded-lg border border-[#242f42]">
              <span className="text-[11px] text-slate-400 font-medium">Discrepancia de Win Rate</span>
              <div className={`text-xl font-bold font-mono mt-1 ${deltaWinRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {deltaWinRate >= 0 ? '+' : ''}{deltaWinRate.toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Variación de ratio de éxito por deslizamiento y tiempos de confirmación.
              </p>
            </div>

            <div className="bg-[#0b0e14] p-4 rounded-lg border border-[#242f42]">
              <span className="text-[11px] text-slate-400 font-medium">Diferencial de Ganancia Neta</span>
              <div className={`text-xl font-bold font-mono mt-1 ${deltaPnl >= 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {deltaPnl >= 0 ? '+' : ''}${deltaPnl.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                PnL neto realizado diferencial entre ambos libros de órdenes.
              </p>
            </div>
          </div>

          {/* AI Auditor Verdict Box */}
          <div className="mt-4 p-3.5 rounded-lg bg-[#0b0e14] border border-indigo-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-indigo-300 font-semibold">Veredicto del Motor Cuantitativo:</strong>{' '}
              {real && real.total_trades > 0 ? (
                <>
                  Hay operaciones en ambos libros contables. La desviación usa el slippage modelado del dispatcher ({dispatcherStatus?.default_taker_slippage_bps ?? 2.0} bps). Ningún libro envía la orden a un exchange.
                </>
              ) : (
                <>
                  El libro B todavía no tiene órdenes. Sigue siendo un libro contable interno, igual que el demo.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 max-w-[1920px] mx-auto select-none">
      {/* 0. Entorno Operativo: Selector de Saldo Ficticio vs Saldo Real vs Análisis Comparativo */}
      <div className="bg-[#131923] border border-[#242f42] rounded-xl p-2.5 sm:p-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
              Entorno Operativo:
            </span>
            <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
              (Segregación estricta de capital y métricas de rendimiento)
            </span>
          </div>

          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 bg-[#0b0e14] p-1 rounded-lg border border-[#242f42]">
            {/* Botón Saldo Ficticio */}
            <button
              onClick={() => setAccountMode('SIMULATED')}
              className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                accountMode === 'SIMULATED'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131923]'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${accountMode === 'SIMULATED' ? 'bg-cyan-300' : 'bg-slate-600'}`} />
              <span>Saldo Ficticio (Demo)</span>
            </button>

            {/* Botón Saldo Real */}
            <button
              onClick={() => setAccountMode('REAL')}
              className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                accountMode === 'REAL'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131923]'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${accountMode === 'REAL' ? 'bg-emerald-300 animate-pulse' : 'bg-slate-600'}`} />
              <span>Libro B (contable)</span>
            </button>

            {/* Botón Comparativa */}
            <button
              onClick={() => setAccountMode('COMPARATIVE')}
              className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                accountMode === 'COMPARATIVE'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 border border-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131923]'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Análisis Comparativo</span>
            </button>
          </div>

          {/* Quick Balances Pill */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-lg bg-[#0b0e14] border border-[#242f42] text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Demo:</span>
              <span className="text-blue-400 font-bold">
                ${(dualSummary?.simulated?.total_equity ?? 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Real:</span>
              <span className="text-emerald-400 font-bold">
                ${(dualSummary?.real?.total_equity ?? 5000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Header Bar & Controls */}
      <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                accountMode === 'REAL'
                  ? 'bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border-emerald-500/30 text-emerald-400'
                  : accountMode === 'COMPARATIVE'
                  ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30 text-indigo-400'
                  : 'bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-blue-500/30 text-blue-400'
              }`}
            >
              {accountMode === 'COMPARATIVE' ? (
                <Scale className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-wide text-slate-50 uppercase font-sans">
                  {accountMode === 'REAL'
                    ? 'Terminal del libro contable B'
                    : accountMode === 'COMPARATIVE'
                    ? 'Comparativa: libro demo vs libro B'
                    : 'Terminal de Saldo Ficticio & Paper Trading'}
                </h1>
                <span
                  className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${
                    accountMode === 'REAL'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/50 flex items-center gap-1.5'
                      : accountMode === 'COMPARATIVE'
                      ? 'bg-indigo-950/80 text-indigo-400 border-indigo-700/50'
                      : 'bg-blue-950/80 text-blue-400 border-blue-700/50'
                  }`}
                >
                  {accountMode === 'REAL' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIBRO B CONTABLE
                    </>
                  ) : accountMode === 'COMPARATIVE' ? (
                    'DUAL BENCHMARK'
                  ) : (
                    'SIMULADO DEMO'
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {accountMode === 'REAL'
                  ? 'Segundo libro contable • Sin envío a exchange • Mismo motor de riesgo que el demo'
                  : accountMode === 'COMPARATIVE'
                  ? 'Auditoría en Tiempo Real de Alpha, Desviación de Órdenes, Slippage y Rendimiento Cruzado'
                  : 'Gestión de Cartera Simulada • Despacho Confluente ML + OFI • Ratchet Trailing Breakeven a 50% TP'}
              </p>
            </div>
          </div>

          {/* Quick Actions & Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active Global Trading Profile */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0e14] border border-indigo-500/30 text-xs"
              title="Configuración global activa para operaciones cuantitativas"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-200 font-bold">${dispatcherStatus?.trade_amount_usd ?? 1000}</span>
                <span className="text-slate-500">@</span>
                <span className="text-emerald-400 font-bold">+{dispatcherStatus?.target_profit_pct ?? 5}% TP</span>
                <span className="text-slate-600">•</span>
                <span className="text-blue-400 font-semibold">{dispatcherStatus?.asset_selection_mode === 'SPECIFIC' ? dispatcherStatus?.selected_symbol : 'Auto-IA'}</span>
                {dispatcherStatus?.compound_interest_enabled && (
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/30 font-semibold">
                    Compuesto
                  </span>
                )}
              </div>
            </div>

            {/* Dispatcher Worker Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0e14] border border-[#242f42] text-xs">
              <span className="text-slate-400 font-medium">Worker:</span>
              <span className="flex items-center gap-1.5 font-mono font-bold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    dispatcherStatus?.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className={dispatcherStatus?.is_running ? 'text-emerald-400' : 'text-rose-400'}>
                  {dispatcherStatus?.is_running ? 'ACTIVO' : 'DETENIDO'}
                </span>
              </span>
              <button
                onClick={handleToggleWorker}
                disabled={isSavingConfig}
                className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#1c2433] hover:bg-[#242f42] text-slate-300 font-mono cursor-pointer transition-colors"
                title={dispatcherStatus?.is_running ? 'Detener Worker' : 'Iniciar Worker'}
              >
                {dispatcherStatus?.is_running ? 'Detener' : 'Iniciar'}
              </button>
            </div>

            {/* Auto-Trade Toggle Button */}
            <button
              onClick={handleToggleAutoTrade}
              disabled={isSavingConfig}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                autoTradeEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 border border-emerald-400/40'
                  : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40'
              }`}
            >
              {autoTradeEnabled ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-white" />
                  <span>Auto-Trade: ON</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Trade: PAUSA</span>
                </>
              )}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => loadAllData(false)}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-[#1c2433] hover:bg-[#242f42] text-slate-300 border border-[#242f42] transition-colors cursor-pointer"
              title="Refrescar Estado y Posiciones"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Fund Real Account Button (Visible in Real or Comparative mode) */}
            {(accountMode === 'REAL' || accountMode === 'COMPARATIVE') && (
              <button
                onClick={() => setIsFundModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
                title="Acreditar o fijar saldo en el libro B"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>+ Fondear Real</span>
              </button>
            )}

            {/* Reset Account Button */}
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
              title={accountMode === 'REAL' ? 'Reiniciar historial del libro B' : 'Reiniciar Saldo y Borrar Historial de Operaciones'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{accountMode === 'REAL' ? 'Reiniciar Historial' : 'Reiniciar Cartera'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Condicional: Análisis Comparativo vs Terminal Operativa */}
      {accountMode === 'COMPARATIVE' ? (
        renderComparativeAnalytics()
      ) : (
        <>
          {/* 2. Primary KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Equity */}
            <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Capital Total (Equity)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-slate-50 tabular-nums">
                  ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <span className={totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                </span>
                <span className="text-slate-500">
                  desde ${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

        {/* Free Cash Balance */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Saldo Disponible
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-200 tabular-nums">
              ${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {((cashBalance / (totalEquity || 1)) * 100).toFixed(1)}% líquido
          </span>
        </div>

        {/* Allocated Margin */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Margen Comprometido
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-200 tabular-nums">
              ${marginAllocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {((marginAllocated / (totalEquity || 1)) * 100).toFixed(1)}% / 25% max
          </span>
        </div>

        {/* Unrealized PnL */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            PnL Flotante (Abierto)
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                unrealizedPnl > 0 ? 'text-emerald-400' : unrealizedPnl < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {unrealizedPnl > 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {openPositions.length} posición{openPositions.length !== 1 ? 'es' : ''} activa{openPositions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Realized PnL */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            PnL Realizado (Cerrado)
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                realizedPnl > 0 ? 'text-emerald-400' : realizedPnl < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {realizedPnl > 0 ? '+' : ''}${realizedPnl.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {totalTrades} operaciones cerradas
          </span>
        </div>

        {/* Win Rate & Profit Factor */}
        <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Win Rate / Factor
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {winRate.toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              PF: {profitFactor > 0 ? profitFactor.toFixed(2) : '-'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {winningTrades}W / {losingTrades}L
          </span>
        </div>
      </div>

      {/* 3. Middle Section: Equity Curve & Dispatcher Settings vs. Manual Order Sizing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Col (7 cols): Equity Curve & Confluence Dispatcher Settings */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Equity Curve Card */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                  Evolución Temporal de la Cartera (Equity Curve)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Snapshots TimescaleDB • Intervalos 7d
              </span>
            </div>

            {renderEquityCurveSvg()}
          </div>

          {/* Confluence Dispatcher Parameters */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#242f42] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                  Filtros Cuantitativos de Confluencia (Order Dispatcher)
                </h2>
              </div>
              <button
                onClick={handleSaveDispatcherConfig}
                disabled={isSavingConfig}
                className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingConfig ? 'Guardando...' : 'Aplicar Filtros'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Confidence Threshold */}
              <div className="bg-[#0b0e14]/70 p-3 rounded-lg border border-[#242f42]/60 flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Umbral Mínimo ML:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="95"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value) || 55)}
                    className="w-16 bg-[#1c2433] border border-[#242f42] px-2 py-1 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500 text-right"
                  />
                  <span className="text-slate-400 font-mono text-xs">%</span>
                </div>
                <span className="text-[9px] text-slate-500">Mínimo sugerido: ≥ 55%</span>
              </div>

              {/* Risk Per Trade */}
              <div className="bg-[#0b0e14]/70 p-3 rounded-lg border border-[#242f42]/60 flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Riesgo por Trade:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="5.0"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(parseFloat(e.target.value) || 1.0)}
                    className="w-16 bg-[#1c2433] border border-[#242f42] px-2 py-1 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500 text-right"
                  />
                  <span className="text-slate-400 font-mono text-xs">%</span>
                </div>
                <span className="text-[9px] text-slate-500">Por defecto: 1.0% ($100)</span>
              </div>

              {/* Slippage Taker */}
              <div className="bg-[#0b0e14]/70 p-3 rounded-lg border border-[#242f42]/60 flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Deslizamiento (Slippage):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.0"
                    max="10.0"
                    value={maxSlippageBps}
                    onChange={(e) => setMaxSlippageBps(parseFloat(e.target.value) || 2.0)}
                    className="w-16 bg-[#1c2433] border border-[#242f42] px-2 py-1 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500 text-right"
                  />
                  <span className="text-slate-400 font-mono text-xs">bps</span>
                </div>
                <span className="text-[9px] text-slate-500">Simulación institucional</span>
              </div>
            </div>

            {/* Checkbox Gates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0b0e14]/50 border border-[#242f42]/40 text-xs text-slate-300 cursor-pointer hover:bg-[#0b0e14]">
                <input
                  type="checkbox"
                  checked={requireMlAgreement}
                  onChange={(e) => setRequireMlAgreement(e.target.checked)}
                  className="rounded border-[#242f42] text-blue-600 focus:ring-0 bg-[#1c2433]"
                />
                <span className="text-[11px] font-medium">Consenso Direccional ML</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0b0e14]/50 border border-[#242f42]/40 text-xs text-slate-300 cursor-pointer hover:bg-[#0b0e14]">
                <input
                  type="checkbox"
                  checked={requireOfiConfluence}
                  onChange={(e) => setRequireOfiConfluence(e.target.checked)}
                  className="rounded border-[#242f42] text-blue-600 focus:ring-0 bg-[#1c2433]"
                />
                <span className="text-[11px] font-medium">Confluencia OFI L2</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0b0e14]/50 border border-[#242f42]/40 text-xs text-slate-300 cursor-pointer hover:bg-[#0b0e14]">
                <input
                  type="checkbox"
                  checked={avoidSqueeze}
                  onChange={(e) => setAvoidSqueeze(e.target.checked)}
                  className="rounded border-[#242f42] text-blue-600 focus:ring-0 bg-[#1c2433]"
                />
                <span className="text-[11px] font-medium">Evitar Régimen Squeeze</span>
              </label>
            </div>

            {/* Telemetry Counter Strip */}
            <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42] flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-3">
              <div>
                <span className="text-slate-500">Señales Recibidas: </span>
                <span className="text-slate-200 font-bold">
                  {dispatcherStatus?.telemetry.signals_received ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Filtradas: </span>
                <span className="text-amber-400 font-bold">
                  {dispatcherStatus?.telemetry.signals_filtered ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Despachadas: </span>
                <span className="text-emerald-400 font-bold">
                  {dispatcherStatus?.telemetry.orders_dispatched ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Ticks Monitoreados: </span>
                <span className="text-blue-400 font-bold">
                  {dispatcherStatus?.telemetry.ticks_processed ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col (5 cols): Manual Order Execution & Sizing Calculator */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#242f42] pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                  Ejecución Manual & Dimensionamiento ATR
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Límite 25% Margen
              </span>
            </div>

            {/* Symbol & Side Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Activo
                </label>
                <select
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value)}
                  className="w-full bg-[#1c2433] border border-[#242f42] px-3 py-1.5 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="BTC/USDT">BTC/USDT</option>
                  <option value="ETH/USDT">ETH/USDT</option>
                  <option value="SOL/USDT">SOL/USDT</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Dirección
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrderSide('BUY')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      orderSide === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-[#1c2433] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderSide('SELL')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      orderSide === 'SELL'
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                        : 'bg-[#1c2433] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Risk & Price Targets */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Riesgo %
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="5.0"
                  value={orderRiskPct}
                  onChange={(e) => setOrderRiskPct(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#1c2433] border border-[#242f42] px-2.5 py-1.5 rounded-lg text-slate-100 font-mono text-xs text-right focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Stop Loss ($)
                </label>
                <input
                  type="text"
                  placeholder="Automático ATR"
                  value={orderStopLoss}
                  onChange={(e) => setOrderStopLoss(e.target.value)}
                  className="w-full bg-[#1c2433] border border-[#242f42] px-2.5 py-1.5 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Take Profit ($)
                </label>
                <input
                  type="text"
                  placeholder="Automático ATR"
                  value={orderTakeProfit}
                  onChange={(e) => setOrderTakeProfit(e.target.value)}
                  className="w-full bg-[#1c2433] border border-[#242f42] px-2.5 py-1.5 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sizing Preview Box */}
            <div className="bg-[#0b0e14] border border-[#242f42] rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Tamaño Calculado:</span>
                <span className="text-slate-100 font-bold">
                  {sizingResult ? `${sizingResult.recommended_size.toFixed(4)} ${orderSymbol.split('/')[0]}` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Margen Requerido:</span>
                <span className="text-blue-400 font-bold">
                  {sizingResult ? `$${sizingResult.required_margin.toFixed(2)} USDT` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Riesgo Monetario:</span>
                <span className="text-rose-400 font-bold">
                  {sizingResult ? `$${sizingResult.risk_amount_usdt.toFixed(2)} USDT (${(sizingResult.risk_pct * 100).toFixed(1)}%)` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Ratio Beneficio/Riesgo (R:R):</span>
                <span className="text-emerald-400 font-bold">
                  {sizingResult ? `${sizingResult.reward_risk_ratio.toFixed(2)} : 1` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Comisión Taker Estimada:</span>
                <span className="text-slate-400">
                  {sizingResult ? `$${sizingResult.estimated_entry_fee.toFixed(3)}` : '---'}
                </span>
              </div>

              {sizingResult && sizingResult.notes && (
                <div className="text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-[#242f42]/40">
                  {sizingResult.notes}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleOpenPosition}
              disabled={isSubmittingOrder || isCalculatingSizing}
              className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                orderSide === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
              }`}
            >
              {isSubmittingOrder ? 'Ejecutando Orden...' : `Abrir Posición ${orderSide} en ${orderSymbol}`}
            </button>
          </div>

          {/* Dispatcher Recent Activity Terminal */}
          <div className="bg-[#131923] border border-[#242f42] rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[#242f42] pb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-200 uppercase">
                  Feed de Despacho en Vivo
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                redis: signals:stream
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
              {dispatcherStatus?.recent_activity && dispatcherStatus.recent_activity.length > 0 ? (
                dispatcherStatus.recent_activity.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-[#0b0e14] border border-[#242f42]/50 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          act.type === 'DISPATCHED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                            : 'bg-amber-950 text-amber-400 border border-amber-700/50'
                        }`}
                      >
                        {act.type}
                      </span>
                      <span className="text-slate-300 font-semibold">{act.symbol}</span>
                      <span className="text-slate-400 text-[10px]">
                        {act.action || act.side} • {(act.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-slate-500 text-[10px]">
                      {act.reason || (act.price ? `$${act.price.toFixed(2)}` : '')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 text-xs py-4 font-sans">
                  Esperando eventos en Redis streams...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Positions & History Tables Section */}
      <div className="bg-[#131923] border border-[#242f42] rounded-xl p-5 shadow-sm flex flex-col gap-4">
        {/* Table Tabs */}
        <div className="flex items-center justify-between border-b border-[#242f42] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('open')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'open'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2433]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Posiciones Abiertas en Vivo ({openPositions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2433]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Historial de Operaciones Cerradas ({closedPositions.length})</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
            Ratchet Breakeven activado al 50% TP
          </span>
        </div>

        {/* Tab Content */}
        {activeTab === 'open' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242f42] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0b0e14]/40">
                  <th className="py-2.5 px-3">Activo</th>
                  <th className="py-2.5 px-3">Lado</th>
                  <th className="py-2.5 px-3 text-right">Tamaño</th>
                  <th className="py-2.5 px-3 text-right">Entrada</th>
                  <th className="py-2.5 px-3 text-right">Mark Price</th>
                  <th className="py-2.5 px-3 text-right">Margen</th>
                  <th className="py-2.5 px-3 text-right">Stop Loss</th>
                  <th className="py-2.5 px-3 text-right">Take Profit</th>
                  <th className="py-2.5 px-3 text-center">Trailing BE</th>
                  <th className="py-2.5 px-3 text-right">PnL Flotante</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242f42]/40 text-xs font-mono">
                {openPositions.length > 0 ? (
                  openPositions.map((pos) => {
                    const isProfit = pos.unrealized_pnl >= 0;
                    const markPrice = currentPriceMap[pos.symbol] || pos.current_price;
                    return (
                      <tr key={pos.id} className="hover:bg-[#1a2230] transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{pos.symbol}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'BUY'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          {pos.size.toFixed(4)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          ${pos.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-100">
                          ${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right text-blue-400">
                          ${pos.margin_used.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-400">
                          ${pos.stop_loss ? pos.stop_loss.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400">
                          ${pos.take_profit ? pos.take_profit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {pos.trailing_stop_active ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-700/50"
                              title={`Breakeven Stop asegurado en $${pos.trailing_stop_price?.toFixed(2)}`}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              BE RATCHET
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Pendiente 50%</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          <div className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                            {isProfit ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {pos.return_pct >= 0 ? '+' : ''}{pos.return_pct.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleClosePosition(pos.id, pos.symbol)}
                            disabled={closingPositionId === pos.id}
                            className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {closingPositionId === pos.id ? 'Cerrando...' : 'Cerrar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers className="w-7 h-7 text-slate-600" />
                        <span>No hay posiciones simuladas abiertas actualmente.</span>
                        <span className="text-[11px] text-slate-600">
                          Active el Auto-Trade o ejecute una orden manual desde el panel lateral.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0b0e14] z-10">
                <tr className="border-b border-[#242f42] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Activo</th>
                  <th className="py-2.5 px-3">Lado</th>
                  <th className="py-2.5 px-3 text-right">Tamaño</th>
                  <th className="py-2.5 px-3 text-right">Precio Entrada</th>
                  <th className="py-2.5 px-3 text-right">Precio Salida</th>
                  <th className="py-2.5 px-3 text-right">Deslizamiento</th>
                  <th className="py-2.5 px-3 text-right">Comisiones</th>
                  <th className="py-2.5 px-3 text-right">PnL Neto ($)</th>
                  <th className="py-2.5 px-3 text-right">Retorno %</th>
                  <th className="py-2.5 px-3 text-center">Causa de Salida</th>
                  <th className="py-2.5 px-3 text-right">Fecha Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242f42]/40 text-xs font-mono">
                {closedPositions.length > 0 ? (
                  closedPositions.map((pos) => {
                    const isWin = pos.realized_pnl > 0;
                    const totalFees = (pos.entry_fee || 0) + (pos.exit_fee || 0);
                    return (
                      <tr key={pos.id} className="hover:bg-[#1a2230] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          {pos.symbol}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'BUY'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {pos.size.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          ${pos.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          ${pos.exit_price ? pos.exit_price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          ${(pos.slippage_incurred || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          ${totalFees.toFixed(3)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${pos.realized_pnl.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-semibold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.return_pct >= 0 ? '+' : ''}{pos.return_pct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.close_reason === 'TAKE_PROFIT'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                                : pos.close_reason === 'TRAILING_STOP'
                                ? 'bg-blue-950 text-blue-400 border border-blue-700/50'
                                : pos.close_reason === 'STOP_LOSS'
                                ? 'bg-rose-950 text-rose-400 border border-rose-700/50'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {pos.close_reason || 'CLOSED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">
                          {pos.closed_at ? pos.closed_at.split('T')[0] + ' ' + pos.closed_at.split('T')[1]?.slice(0, 5) : '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                      No hay historial de operaciones cerradas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

  {/* 5. Anti-Backdrop Reset Modal */}
  {isResetModalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      // Anti-Backdrop: un clic en el fondo oscuro no cierra la ventana
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#131923] border border-[#242f42] shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#242f42] pb-3">
          <div className="flex items-center gap-2.5 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-100 uppercase">
              {accountMode === 'REAL' ? 'Reiniciar libro contable B' : 'Confirmar Reinicio de Cartera Demo'}
            </h3>
          </div>
          <button
            onClick={() => setIsResetModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#1c2433] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {accountMode === 'REAL' ? (
            <>
              Esta acción cerrará todas las posiciones activas en el <strong className="text-emerald-400 font-mono">libro B</strong>,
              borrará el historial de operaciones y restablecerá los indicadores de rendimiento acumulados.
            </>
          ) : (
            <>
              Esta acción restablecerá el saldo de la cuenta simulada a <strong className="text-slate-100 font-mono">$10,000.00 USDT</strong>,
              cancelará todas las posiciones abiertas y reiniciará las estadísticas acumuladas de rendimiento.
            </>
          )}
        </p>

        <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42] text-[11px] font-mono text-slate-400 space-y-1">
          <div>Cuenta: <span className="text-slate-200 font-bold">{accountMode === 'REAL' ? 'REAL (00000000-0000-0000-0000-000000000002)' : 'SIMULATED (00000000-0000-0000-0000-000000000001)'}</span></div>
          <div>Saldo resultante: <span className="text-emerald-400 font-bold">{accountMode === 'REAL' ? `$${(account?.initial_balance ?? 5000).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT` : '$10,000.00 USDT'}</span></div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(false)}
            disabled={isResetting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#1c2433] border border-[#242f42] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={isResetting}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isResetting ? 'Reiniciando...' : accountMode === 'REAL' ? 'Sí, reiniciar libro B' : 'Sí, Reiniciar Cartera Demo'}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* 6. Fund Real Account Modal */}
  {isFundModalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#131923] border border-[#242f42] shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#242f42] pb-3">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Wallet className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-100 uppercase">
              Ajuste del libro contable B
            </h3>
          </div>
          <button
            onClick={() => setIsFundModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#1c2433] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Ajusta el saldo del libro B. El movimiento queda en la base local y no se envía a un exchange.
        </p>

        {/* Selector de Operación: SET vs DEPOSIT */}
        <div className="grid grid-cols-2 gap-2 bg-[#0b0e14] p-1 rounded-lg border border-[#242f42]">
          <button
            type="button"
            onClick={() => setFundOperation('SET')}
            className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              fundOperation === 'SET'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fijar Saldo Total (SET)
          </button>
          <button
            type="button"
            onClick={() => setFundOperation('DEPOSIT')}
            className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              fundOperation === 'DEPOSIT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Acreditar Depósito (ADD)
          </button>
        </div>

        {/* Input de Monto */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Monto en USDT
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono">
              $
            </div>
            <input
              type="number"
              min="0"
              step="100"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full bg-[#0b0e14] border border-[#242f42] focus:border-emerald-500 rounded-lg pl-7 pr-16 py-2 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
              placeholder="5000.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-mono text-slate-400">
              USDT
            </div>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Presets:</span>
          {['500', '1000', '5000', '10000', '25000'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setFundAmount(preset)}
              className="px-2 py-0.5 rounded bg-[#1c2433] hover:bg-[#242f42] text-[10px] font-mono text-slate-300 border border-[#242f42] transition-colors cursor-pointer"
            >
              ${Number(preset).toLocaleString()}
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#242f42] text-[11px] font-mono text-slate-400 space-y-1">
          <div>Cuenta Destino: <span className="text-emerald-400 font-bold">REAL (00000000-0000-0000-0000-000000000002)</span></div>
          <div>Saldo actual registrado: <span className="text-slate-200 font-bold">${(dualSummary?.real?.current_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT</span></div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsFundModalOpen(false)}
            disabled={isFunding}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#1c2433] border border-[#242f42] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmFund}
            disabled={isFunding}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isFunding ? 'Guardando...' : fundOperation === 'SET' ? 'Fijar saldo del libro B' : 'Acreditar Depósito'}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
