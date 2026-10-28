'use client';

import React, { useState } from 'react';
import { PredictiveSignal } from '@/types/market';
import { ChevronRight, Filter, AlertCircle, Sparkles } from 'lucide-react';

interface SignalsFeedProps {
  signals: PredictiveSignal[];
  onSelectSignal: (signal: PredictiveSignal) => void;
  selectedSymbol: string;
}

export const SignalsFeed: React.FC<SignalsFeedProps> = ({
  signals,
  onSelectSignal,
  selectedSymbol,
}) => {
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const filteredSignals = signals.filter((s) => {
    if (filterAction === 'BUY') return s.action?.includes('BUY');
    if (filterAction === 'SELL') return s.action?.includes('SELL');
    if (filterAction === 'HOLD') return s.action === 'HOLD';
    return true;
  });

  const getActionBadge = (action: string = 'HOLD') => {
    switch (action) {
      case 'STRONG_BUY':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
            COMPRA FUERTE
          </span>
        );
      case 'BUY':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/50 border border-emerald-500/30 text-emerald-400">
            COMPRA
          </span>
        );
      case 'STRONG_SELL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-950/70 border border-rose-500/50 text-rose-300">
            VENTA FUERTE
          </span>
        );
      case 'SELL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950/50 border border-rose-500/30 text-rose-400">
            VENTA
          </span>
        );
      case 'HOLD':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/50 border border-amber-500/30 text-amber-400">
            HOLD / NEUTRAL
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Feed Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#242f42] bg-[#0f141d]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <h3 className="font-bold text-slate-100 text-sm">Señales Predictivas IA</h3>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-900/40 text-blue-300 border border-blue-500/30 font-mono">
            {filteredSignals.length}
          </span>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="h-3 w-3 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-[#1c2433] text-slate-300 text-xs rounded border border-[#242f42] px-2 py-1 outline-none"
          >
            <option value="ALL">Todas</option>
            <option value="BUY">Compras</option>
            <option value="SELL">Ventas</option>
            <option value="HOLD">Hold</option>
          </select>
        </div>
      </div>

      {/* Signals List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-[#242f42]/40">
        {filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 p-4">
            <AlertCircle className="h-8 w-8 text-slate-500 mb-2 opacity-60" />
            <p className="text-xs font-medium">No hay señales con el filtro actual</p>
            <p className="text-[10px] text-slate-500 mt-1">
              No hay una señal calculada sobre el precio de ahora.
            </p>
          </div>
        ) : (
          filteredSignals.map((signal) => {
            const isTarget = signal.symbol === selectedSymbol;
            const action = signal.action || 'HOLD';
            const isBuy = action.includes('BUY');
            const isSell = action.includes('SELL');
            const conf = Number(signal.confidence_score);
            const entryPrice = Number(signal.entry_price);
            const stopLoss = Number(signal.stop_loss);
            const takeProfit = Number(signal.take_profit);

            return (
              <div
                key={signal.id}
                onClick={() => onSelectSignal(signal)}
                className={`pt-2.5 first:pt-0 cursor-pointer p-2.5 rounded-lg transition-all ${
                  isTarget ? 'bg-[#1c2433] border border-blue-500/40' : 'hover:bg-[#1a2230]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-xs">{signal.symbol}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-[#0b0e14] px-1.5 py-0.5 rounded">
                      {signal.timeframe}
                    </span>
                  </div>
                  {getActionBadge(action)}
                </div>

                {/* Confidence Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Confianza Algorítmica</span>
                    <span className="font-mono tabular-nums font-bold text-slate-200">
                      {Number.isFinite(conf) ? `${conf.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0b0e14] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Number.isFinite(conf) ? Math.min(100, Math.max(0, conf)) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Levels & Metrics */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono tabular-nums bg-[#0b0e14]/60 p-2 rounded border border-[#242f42]/60">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Entrada</span>
                    <span className="font-semibold text-slate-300">
                      {Number.isFinite(entryPrice) && entryPrice > 0 ? `$${entryPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-400/80 block">Stop Loss</span>
                    <span className="font-semibold text-rose-400">
                      {Number.isFinite(stopLoss) && stopLoss > 0 ? `$${stopLoss.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400/80 block">Take Profit</span>
                    <span className="font-semibold text-emerald-400">
                      {Number.isFinite(takeProfit) && takeProfit > 0 ? `$${takeProfit.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '--'}
                    </span>
                  </div>
                </div>

                {/* Footer link to explainability */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#242f42]/40 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">
                      {signal.trigger_factors?.risk_reward_ratio != null
                        ? `R/R 1:${signal.trigger_factors.risk_reward_ratio.toFixed(1)}`
                        : 'R/R sin lectura'}
                    </span>
                    {signal.trigger_factors?.market_regime && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#0b0e14] text-blue-300 font-mono border border-[#242f42]">
                        {signal.trigger_factors.market_regime}
                      </span>
                    )}
                    {signal.trigger_factors?.ml_supervised && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950/60 text-purple-300 font-mono border border-purple-500/30">
                        ML {signal.trigger_factors.ml_supervised.ml_action}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 font-medium">
                    Ver Explicabilidad <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
