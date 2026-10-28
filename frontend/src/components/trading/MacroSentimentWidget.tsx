'use client';

import React from 'react';
import { Compass, Gauge } from 'lucide-react';

interface MacroSentimentWidgetProps {
  nlpScore?: number;
  fearGreedIndex?: number;
}

export const MacroSentimentWidget: React.FC<MacroSentimentWidgetProps> = ({
  nlpScore,
  fearGreedIndex,
}) => {

  const getSentimentText = (score: number) => {
    if (score >= 0.5) return { label: 'MUY ALCISTA', color: 'text-emerald-400' };
    if (score >= 0.15) return { label: 'ALCISTA MODERADO', color: 'text-emerald-400' };
    if (score <= -0.5) return { label: 'MUY BAJISTA', color: 'text-rose-400' };
    if (score <= -0.15) return { label: 'BAJISTA MODERADO', color: 'text-rose-400' };
    return { label: 'NEUTRAL / CONSOLIDACIÓN', color: 'text-amber-400' };
  };

  const sentiment = nlpScore === undefined ? null : getSentimentText(nlpScore);

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
            <span className={`font-bold font-mono text-xs ${sentiment ? sentiment.color : 'text-slate-500'}`}>
              {sentiment
                ? `${sentiment.label} (${nlpScore! >= 0 ? `+${nlpScore!.toFixed(2)}` : nlpScore!.toFixed(2)})`
                : 'sin noticias en vivo'}
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
              style={{ left: `${nlpScore === undefined ? 50 : Math.min(98, Math.max(2, ((nlpScore + 1) / 2) * 100))}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
            <span>-1.0 (Pánico)</span>
            <span>0.0 (Neutral)</span>
            <span>+1.0 (Euforia)</span>
          </div>
        </div>

        {fearGreedIndex === undefined ? (
          <p className="text-xs text-slate-500 px-1">
            DXY, S&amp;P 500, oro y el índice de miedo no tienen fuente en vivo. No se muestran cifras de muestra.
          </p>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e14] border border-[#242f42]">
            <span className="text-[11px] text-slate-400">Fear &amp; Greed</span>
            <span className="font-mono tabular-nums font-bold text-slate-100">{fearGreedIndex}</span>
          </div>
        )}
      </div>
    </div>
  );
};
