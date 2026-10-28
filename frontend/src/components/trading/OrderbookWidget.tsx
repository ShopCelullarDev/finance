'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { DepthLevel, fetchDepth } from '@/services/api';

interface OrderbookWidgetProps {
  symbol: string;
  currentPrice?: number;
}

interface BookRow extends DepthLevel {
  total: number;
}

function withTotals(levels: DepthLevel[]): BookRow[] {
  let total = 0;
  return levels.map((level) => {
    total += level.size;
    return { ...level, total };
  });
}

export const OrderbookWidget: React.FC<OrderbookWidgetProps> = ({ symbol, currentPrice }) => {
  const [asks, setAsks] = useState<BookRow[]>([]);
  const [bids, setBids] = useState<BookRow[]>([]);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const book = await fetchDepth(symbol);
      if (stopped) return;
      if (!book) {
        setAsks([]);
        setBids([]);
        return;
      }
      setAsks(withTotals([...book.asks].reverse()));
      setBids(withTotals(book.bids));
    };
    load();
    const timer = window.setInterval(load, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [symbol]);

  const bestAsk = asks.length > 0 ? asks[asks.length - 1].price : undefined;
  const bestBid = bids.length > 0 ? bids[0].price : undefined;
  const spread = bestAsk !== undefined && bestBid !== undefined ? bestAsk - bestBid : undefined;
  const mid = bestAsk !== undefined && bestBid !== undefined ? (bestAsk + bestBid) / 2 : currentPrice;
  const spreadPct = spread !== undefined && mid ? (spread / mid) * 100 : undefined;
  const depthMax = Math.max(1, ...asks.map((row) => row.total), ...bids.map((row) => row.total));

  return (
    <div className="flex flex-col bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#242f42] bg-[#0f141d]">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-blue-400" />
          <h4 className="text-xs font-bold text-slate-100">Orderbook L2</h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
          {spread === undefined || spreadPct === undefined
            ? 'Sin libro en vivo'
            : `Spread: $${spread.toFixed(2)} (${spreadPct.toFixed(3)}%)`}
        </span>
      </div>

      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-semibold text-slate-400 border-b border-[#242f42]/40 bg-[#0b0e14]/40">
        <span>Precio (USD)</span>
        <span className="text-right">Monto ({symbol.split('/')[0]})</span>
        <span className="text-right">Total Acum.</span>
      </div>

      {asks.length === 0 && bids.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">Binance no entregó el libro de {symbol}.</p>
      ) : (
        <>
          <div className="p-1 space-y-0.5 text-xs font-mono tabular-nums">
            {asks.map((ask) => (
              <div
                key={`ask-${ask.price}`}
                className="grid grid-cols-3 px-2 py-0.5 rounded hover:bg-[#1a2230] relative overflow-hidden"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-950/20 pointer-events-none"
                  style={{ width: `${Math.min(100, (ask.total / depthMax) * 100)}%` }}
                />
                <span className="text-rose-400 font-semibold relative z-10">
                  ${ask.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-300 relative z-10">{ask.size.toFixed(4)}</span>
                <span className="text-right text-slate-500 relative z-10">{ask.total.toFixed(3)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0e14] border-y border-[#242f42] font-mono tabular-nums">
            <span className="text-sm font-bold text-slate-100">
              {mid ? `$${mid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">PRECIO MID</span>
          </div>

          <div className="p-1 space-y-0.5 text-xs font-mono tabular-nums">
            {bids.map((bid) => (
              <div
                key={`bid-${bid.price}`}
                className="grid grid-cols-3 px-2 py-0.5 rounded hover:bg-[#1a2230] relative overflow-hidden"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-950/20 pointer-events-none"
                  style={{ width: `${Math.min(100, (bid.total / depthMax) * 100)}%` }}
                />
                <span className="text-emerald-400 font-semibold relative z-10">
                  ${bid.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-300 relative z-10">{bid.size.toFixed(4)}</span>
                <span className="text-right text-slate-500 relative z-10">{bid.total.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
