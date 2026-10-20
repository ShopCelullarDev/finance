'use client';

import React, { useState } from 'react';
import { PredictiveSignal } from '@/types/market';
import { X, Copy, Check, Brain, TrendingUp, Compass, ShieldAlert, Cpu } from 'lucide-react';

interface SignalDetailModalProps {
  signal: PredictiveSignal | null;
  onClose: () => void;
}

export const SignalDetailModal: React.FC<SignalDetailModalProps> = ({ signal, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!signal) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(signal, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionColor = (action: string) => {
    if (action.includes('BUY')) return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
    if (action.includes('SELL')) return 'text-rose-400 bg-rose-950/60 border-rose-500/40';
    return 'text-amber-400 bg-amber-950/60 border-amber-500/40';
  };

  const tf = signal.trigger_factors;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      // Protección Anti-Backdrop: un clic en el fondo oscuro no cierra la ventana
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#131923] border border-[#242f42] shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242f42] bg-[#0f141d]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Explicabilidad de Señal IA • {signal.symbol}
                </h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getActionColor(signal.action)}`}>
                  {signal.action}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                ID: {signal.id.slice(0, 8)}... | Timeframe: {signal.timeframe} | Confianza: {signal.confidence_score.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Botón Explícito de Cierre */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1c2433] transition-colors border border-transparent hover:border-[#242f42]"
            title="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Risk Levels Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42]">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Precio Entrada</span>
              <span className="font-mono tabular-nums text-base font-bold text-blue-400">
                ${signal.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-rose-950/40">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Stop Loss</span>
              <span className="font-mono tabular-nums text-base font-bold text-rose-400">
                ${signal.stop_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-emerald-950/40">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Take Profit</span>
              <span className="font-mono tabular-nums text-base font-bold text-emerald-400">
                ${signal.take_profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Factores del Algoritmo Cuantitativo */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-blue-400" />
              Desglose de Contribución Multivariable (100%)
            </h4>

            <div className="space-y-3 bg-[#0b0e14] p-4 rounded-xl border border-[#242f42]">
              {/* Factor 1: NLP Sentiment */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-indigo-400" />
                    Sentimiento NLP Noticias (Peso {tf?.nlp_sentiment?.weight ? tf.nlp_sentiment.weight * 100 : 40}%)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-400">
                    Score: {tf?.nlp_sentiment?.score?.toFixed(3) ?? '0.000'} ({tf?.nlp_sentiment?.label ?? 'NEUTRAL'})
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1c2433] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, ((tf?.nlp_sentiment?.score ?? 0) + 1) * 50))}%` }}
                  />
                </div>
              </div>

              {/* Factor 2: Momentum */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    Momentum de Precios Ticks (Peso {tf?.price_momentum?.weight ? tf.price_momentum.weight * 100 : 35}%)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-400">
                    Var: {tf?.price_momentum?.change_pct ? tf.price_momentum.change_pct.toFixed(2) : '+0.00'}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1c2433] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, ((tf?.price_momentum?.change_pct ?? 0) + 5) * 10))}%` }}
                  />
                </div>
              </div>

              {/* Factor 3: Macro Bias */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-amber-400" />
                    Sesgo Macro y Predicción Gamma (Peso {tf?.macro_bias?.weight ? tf.macro_bias.weight * 100 : 25}%)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-amber-400">
                    Sesgo: {tf?.macro_bias?.bias?.toFixed(2) ?? '0.00'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1c2433] overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, ((tf?.macro_bias?.bias ?? 0) + 1) * 50))}%` }}
                  />
                </div>
              </div>

              {/* Ratio y Riesgo */}
              <div className="pt-2 border-t border-[#1c2433] flex justify-between items-center text-xs text-slate-400">
                <span>Ratio Riesgo/Recompensa: <strong className="text-slate-100 font-mono">1 : {tf?.risk_reward_ratio?.toFixed(1) ?? '2.2'}</strong></span>
                <span>Riesgo de Volatilidad: <strong className="text-slate-100 uppercase">{tf?.volatility_risk ?? 'MODERATE'}</strong></span>
              </div>
            </div>
          </div>

          {/* JSON Crudo con Copiado */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Payload Completo `trigger_factors JSONB`
              </h4>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-[#1c2433] hover:bg-[#242f42] text-slate-300 transition-colors border border-[#242f42]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] text-xs font-mono text-emerald-400 overflow-x-auto max-h-48 scrollbar-thin">
              {JSON.stringify(signal.trigger_factors, null, 2)}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-[#242f42] bg-[#0f141d]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1c2433] hover:bg-[#242f42] text-slate-200 border border-[#242f42] transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
