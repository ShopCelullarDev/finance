'use client';

import React from 'react';
import { Compass, Gauge, TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface MacroSentimentWidgetProps {
  nlpScore?: number;
  fearGreedIndex?: number;
}

export const MacroSentimentWidget: React.FC<MacroSentimentWidgetProps> = ({
  nlpScore = 0.42,
  fearGreedIndex = 68,
}) => {
  // Matriz de correlaciones Macro empíricas
  const correlations = [
    { asset: 'BTC / DXY', corr: -0.74, label: 'Inversa Fuerte', status: 'bearish' },
    { asset: 'BTC / S&P500', corr: 0.62, label: 'Directa Moderada', status: 'bullish' },
    { asset: 'BTC / ORO (GLD)', corr: 0.38, label: 'Refugio Positivo', status: 'bullish' },
    { asset: 'BTC / PETROLEO', corr: -0.15, label: 'Descorrelacionado', status: 'neutral' },
  ];

  const getSentimentText = (score: number) => {
    if (score >= 0.5) return { label: 'MUY ALCISTA', color: 'text-emerald-400' };
    if (score >= 0.15) return { label: 'ALCISTA MODERADO', color: 'text-emerald-400' };
    if (score <= -0.5) return { label: 'MUY BAJISTA', color: 'text-rose-400' };
    if (score <= -0.15) return { label: 'BAJISTA MODERADO', color: 'text-rose-400' };
    return { label: 'NEUTRAL / CONSOLIDACIÓN', color: 'text-amber-400' };
  };

  const sentiment = getSentimentText(nlpScore);

  return (
    <div className="flex flex-col bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#242f42] bg-[#0f141d]">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-blue-400" />
          <h4 className="text-xs font-bold text-slate-100">Sentimiento NLP & Sesgo Macro</h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Vector 2 & 4</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Gauge / Meter Visual */}
        <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-[#242f42]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-blue-400" />
              Índice NLP Ponderado
            </span>
            <span className={`font-bold font-mono text-xs ${sentiment.color}`}>
              {sentiment.label} ({nlpScore >= 0 ? `+${nlpScore.toFixed(2)}` : nlpScore.toFixed(2)})
            </span>
          </div>

          {/* Dial bar (-1 to +1) */}
          <div className="relative h-3 w-full bg-[#1c2433] rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-80"
              style={{ width: '100%' }}
            />
            {/* Pointer needle indicator */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-lg border border-black transition-all duration-700"
              style={{ left: `${Math.min(98, Math.max(2, ((nlpScore + 1) / 2) * 100))}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
            <span>-1.0 (Pánico)</span>
            <span>0.0 (Neutral)</span>
            <span>+1.0 (Euforia)</span>
          </div>
        </div>

        {/* Fear & Greed Index */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e14] border border-[#242f42]">
          <div>
            <span className="text-[11px] text-slate-400 block">Fear & Greed Index (Macro)</span>
            <span className="text-xs font-bold text-slate-200">Codicia / Apetito de Riesgo</span>
          </div>
          <div className="flex items-baseline gap-1 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg">
            <span className="text-base font-extrabold font-mono text-emerald-400">{fearGreedIndex}</span>
            <span className="text-[10px] text-emerald-500/80 font-semibold">/ 100</span>
          </div>
        </div>

        {/* Macro Correlations Table */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Correlación Cruzada Cuantitativa
          </span>
          <div className="space-y-1.5">
            {correlations.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-[#0b0e14]/50 border border-[#242f42]/50 hover:bg-[#1a2230] transition-colors"
              >
                <span className="font-semibold text-slate-200">{c.asset}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">{c.label}</span>
                  <span
                    className={`font-mono tabular-nums font-bold text-xs ${
                      c.corr > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {c.corr > 0 ? `+${c.corr.toFixed(2)}` : c.corr.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
