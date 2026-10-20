'use client';

import React from 'react';
import { NewsEvent } from '@/types/market';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';

interface NewsFeedWidgetProps {
  news: NewsEvent[];
}

export const NewsFeedWidget: React.FC<NewsFeedWidgetProps> = ({ news }) => {
  const getSentimentBadge = (label?: string, score?: number | string) => {
    const numScore = typeof score === 'number' ? score : parseFloat(String(score || 0)) || 0;
    const formattedScore = numScore >= 0 ? `+${numScore.toFixed(2)}` : numScore.toFixed(2);

    let activeLabel = label;
    if (!activeLabel) {
      if (numScore >= 0.5) activeLabel = 'VERY_BULLISH';
      else if (numScore >= 0.15) activeLabel = 'BULLISH';
      else if (numScore <= -0.5) activeLabel = 'VERY_BEARISH';
      else if (numScore <= -0.15) activeLabel = 'BEARISH';
      else activeLabel = 'NEUTRAL';
    }

    switch (activeLabel) {
      case 'VERY_BULLISH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
            {formattedScore} MUY ALCISTA
          </span>
        );
      case 'BULLISH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
            {formattedScore} ALCISTA
          </span>
        );
      case 'VERY_BEARISH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-950/70 border border-rose-500/50 text-rose-300">
            {formattedScore} MUY BAJISTA
          </span>
        );
      case 'BEARISH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/40 border border-rose-500/30 text-rose-400">
            {formattedScore} BAJISTA
          </span>
        );
      case 'NEUTRAL':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950/40 border border-amber-500/30 text-amber-400">
            {numScore.toFixed(2)} NEUTRAL
          </span>
        );
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'En vivo';
    }
  };

  return (
    <div className="flex flex-col bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#242f42] bg-[#0f141d]">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-blue-400" />
          <h4 className="text-xs font-bold text-slate-100">Feed de Noticias & NLP en Tiempo Real</h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Vector 3 (FinBERT)</span>
      </div>

      {/* List */}
      <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto divide-y divide-[#242f42]/40 scrollbar-thin">
        {news.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Esperando noticias entrantes...</p>
        ) : (
          news.map((item) => (
            <div key={item.id} className="pt-2.5 first:pt-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h5 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug hover:text-blue-400 cursor-pointer transition-colors">
                  {item.title}
                </h5>
                <div className="shrink-0">{getSentimentBadge(item.sentiment_label, item.sentiment_score)}</div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-[#0b0e14] text-slate-300 font-medium border border-[#242f42]">
                    {item.source}
                  </span>
                  {(item.related_assets || (item as any).affected_assets || []).map((a: string) => (
                    <span key={a} className="text-blue-400 font-bold">
                      #{a}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(item.published_at)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
