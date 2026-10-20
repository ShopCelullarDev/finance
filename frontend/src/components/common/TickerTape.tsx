'use client';

import React from 'react';
import { MarketTick } from '@/types/market';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TickerTapeProps {
  ticks: Record<string, MarketTick>;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const TickerTape: React.FC<TickerTapeProps> = ({
  ticks,
  selectedSymbol,
  onSelectSymbol,
}) => {
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DXY', 'SP500', 'GLD', 'USO'];

  const formatPrice = (symbol: string, price?: number) => {
    if (price === undefined || price === null) return '--.--';
    if (symbol === 'DXY') return price.toFixed(3);
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  return (
    <div className="border-b border-[#242f42] bg-[#131923] py-1.5 px-4 overflow-x-auto select-none scrollbar-none">
      <div className="flex items-center gap-6 min-w-max text-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-[#242f42] pr-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          MERCADO EN VIVO
        </span>

        {symbols.map((symbol) => {
          const tick = ticks[symbol];
          const price = tick?.price;
          const change = tick?.change_24h ?? 0;
          const isSelected = selectedSymbol === symbol;
          const isPositive = change > 0;
          const isNegative = change < 0;

          return (
            <button
              key={symbol}
              onClick={() => onSelectSymbol(symbol)}
              className={`flex items-center gap-2.5 px-2.5 py-1 rounded transition-colors ${
                isSelected
                  ? 'bg-[#1c2433] border border-blue-500/50 shadow-sm'
                  : 'hover:bg-[#1a2230]'
              }`}
            >
              <span className={`font-semibold ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
                {symbol}
              </span>

              <span className="font-mono tabular-nums font-bold text-slate-100">
                ${formatPrice(symbol, price)}
              </span>

              <span
                className={`flex items-center font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-950/50'
                    : isNegative
                    ? 'text-rose-400 bg-rose-950/50'
                    : 'text-slate-400 bg-slate-800/50'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-0.5 inline" />
                ) : isNegative ? (
                  <TrendingDown className="h-3 w-3 mr-0.5 inline" />
                ) : (
                  <Minus className="h-3 w-3 mr-0.5 inline" />
                )}
                {isPositive ? '+' : ''}
                {change.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
