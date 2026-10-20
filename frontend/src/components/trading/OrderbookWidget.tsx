'use client';

import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';

interface OrderbookWidgetProps {
  symbol: string;
  currentPrice?: number;
}

export const OrderbookWidget: React.FC<OrderbookWidgetProps> = ({ symbol, currentPrice }) => {
  const price = currentPrice || (symbol === 'BTC/USDT' ? 82450 : 2500);

  // Generador de órdenes de libro sintético L2 de alta densidad alrededor del precio actual
  const { asks, bids, spread, spreadPct } = useMemo(() => {
    const askList = [];
    const bidList = [];
    const step = price * 0.0003;

    let askCum = 0;
    for (let i = 5; i >= 1; i--) {
      const askPrice = price + i * step;
      const size = ((i * 37) % 25) / 10 + 0.35;
      askCum += size;
      askList.push({ price: askPrice, size, total: askCum });
    }

    let bidCum = 0;
    for (let i = 1; i <= 5; i++) {
      const bidPrice = price - i * step;
      const size = ((i * 43) % 25) / 10 + 0.35;
      bidCum += size;
      bidList.push({ price: bidPrice, size, total: bidCum });
    }

    const currentSpread = askList[askList.length - 1].price - bidList[0].price;
    const currentSpreadPct = (currentSpread / price) * 100;

    return { asks: askList, bids: bidList, spread: currentSpread, spreadPct: currentSpreadPct };
  }, [price]);

  return (
    <div className="flex flex-col bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Widget Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#242f42] bg-[#0f141d]">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-blue-400" />
          <h4 className="text-xs font-bold text-slate-100">Orderbook L2</h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Spread: ${spread.toFixed(2)} ({spreadPct.toFixed(3)}%)</span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-semibold text-slate-400 border-b border-[#242f42]/40 bg-[#0b0e14]/40">
        <span>Precio (USD)</span>
        <span className="text-right">Monto ({symbol.split('/')[0]})</span>
        <span className="text-right">Total Acum.</span>
      </div>

      {/* Asks (Ventas - Rojo) */}
      <div className="p-1 space-y-0.5 text-xs font-mono tabular-nums">
        {asks.map((ask, idx) => (
          <div
            key={`ask-${idx}`}
            className="grid grid-cols-3 px-2 py-0.5 rounded hover:bg-[#1a2230] relative overflow-hidden"
          >
            <div
              className="absolute right-0 top-0 bottom-0 bg-rose-950/20 pointer-events-none"
              style={{ width: `${Math.min(100, (ask.total / 15) * 100)}%` }}
            />
            <span className="text-rose-400 font-semibold relative z-10">
              ${ask.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-right text-slate-300 relative z-10">{ask.size.toFixed(4)}</span>
            <span className="text-right text-slate-500 relative z-10">{ask.total.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Current Mid Price Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0e14] border-y border-[#242f42] font-mono tabular-nums">
        <span className="text-sm font-bold text-slate-100">
          ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] text-emerald-400 font-semibold">PRECIO MID</span>
      </div>

      {/* Bids (Compras - Verde) */}
      <div className="p-1 space-y-0.5 text-xs font-mono tabular-nums">
        {bids.map((bid, idx) => (
          <div
            key={`bid-${idx}`}
            className="grid grid-cols-3 px-2 py-0.5 rounded hover:bg-[#1a2230] relative overflow-hidden"
          >
            <div
              className="absolute right-0 top-0 bottom-0 bg-emerald-950/20 pointer-events-none"
              style={{ width: `${Math.min(100, (bid.total / 15) * 100)}%` }}
            />
            <span className="text-emerald-400 font-semibold relative z-10">
              ${bid.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-right text-slate-300 relative z-10">{bid.size.toFixed(4)}</span>
            <span className="text-right text-slate-500 relative z-10">{bid.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
