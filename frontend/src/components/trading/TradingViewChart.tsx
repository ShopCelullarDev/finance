'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
} from 'lightweight-charts';
import { CandleData, PredictiveSignal } from '@/types/market';
import { Layers } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  currentPrice?: number;
  activeSignal?: PredictiveSignal | null;
  timeframe: string;
  setTimeframe: (tf: string) => void;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  currentPrice,
  activeSignal,
  timeframe,
  setTimeframe,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const entryLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);
  const tpLineRef = useRef<IPriceLine | null>(null);

  const [overlaySignals, setOverlaySignals] = useState(true);

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Generador determinístico de velas iniciales según el activo
  const generateInitialData = (basePrice: number): { candles: CandleData[]; volumes: any[] } => {
    const candles: CandleData[] = [];
    const volumes: any[] = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSecs = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : 86400;

    const count = 120;
    let price = basePrice * 0.94;

    for (let i = count; i >= 0; i--) {
      const time = (now - i * intervalSecs) as Time;
      const step = ((i * 19) % 29) / 100 - 0.14; // Fluctuación determinista
      const volatility = basePrice * 0.0025;
      const open = price;
      const delta = step * volatility;
      const close = Math.max(1, open + delta);
      const high = Math.max(open, close) + (((i * 7) % 11) / 10) * volatility * 0.4;
      const low = Math.min(open, close) - (((i * 13) % 11) / 10) * volatility * 0.4;
      const volume = 20 + ((i * 31) % 65);

      candles.push({ time: time as any, open, high, low, close, volume });
      volumes.push({
        time: time as any,
        value: volume,
        color: close >= open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      });

      price = close;
    }

    return { candles, volumes };
  };

  // Inicializar Gráfico con ResizeObserver robusto
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 440;

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(36, 47, 66, 0.4)' },
        horzLines: { color: 'rgba(36, 47, 66, 0.4)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#1c2433',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#1c2433',
        },
      },
      rightPriceScale: {
        borderColor: '#242f42',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#242f42',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Serie de Velas
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candlestickSeries;

    // Serie de Volumen
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Cargar datos
    const refPrice = currentPrice || (symbol === 'BTC/USDT' ? 82450 : symbol === 'ETH/USDT' ? 2450 : symbol === 'SOL/USDT' ? 145 : 100);
    const { candles, volumes } = generateInitialData(refPrice);
    candlestickSeries.setData(candles as any);
    volumeSeries.setData(volumes as any);

    // Ajustar velas a la pantalla
    chart.timeScale().fitContent();

    // ResizeObserver para adaptar al contenedor inmediatamente
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0 && chartRef.current) {
        chartRef.current.resize(width, height);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Actualizar último precio en tiempo real
  useEffect(() => {
    if (!candleSeriesRef.current || !currentPrice) return;

    const now = Math.floor(Date.now() / 1000);
    const lastBar = {
      time: now as any,
      open: currentPrice * 0.9998,
      high: currentPrice * 1.0003,
      low: currentPrice * 0.9995,
      close: currentPrice,
    };

    try {
      candleSeriesRef.current.update(lastBar);
    } catch {
      // Ignorar superposición de timestamps
    }
  }, [currentPrice]);

  // Renderizar o actualizar líneas de Señal Predictiva (Entry, SL, TP)
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    if (entryLineRef.current) {
      try { series.removePriceLine(entryLineRef.current); } catch {}
      entryLineRef.current = null;
    }
    if (slLineRef.current) {
      try { series.removePriceLine(slLineRef.current); } catch {}
      slLineRef.current = null;
    }
    if (tpLineRef.current) {
      try { series.removePriceLine(tpLineRef.current); } catch {}
      tpLineRef.current = null;
    }

    if (!overlaySignals || !activeSignal || !activeSignal.entry_price) return;

    try {
      entryLineRef.current = series.createPriceLine({
        price: Number(activeSignal.entry_price),
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `ENTRADA AI (${activeSignal.action || 'SIGNAL'})`,
      });

      if (activeSignal.take_profit) {
        const tpVal = Number(activeSignal.take_profit);
        const gainPct = (((tpVal / Number(activeSignal.entry_price)) - 1) * 100).toFixed(2);
        tpLineRef.current = series.createPriceLine({
          price: tpVal,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TAKE PROFIT (+${gainPct}%)`,
        });
      }

      if (activeSignal.stop_loss) {
        const slVal = Number(activeSignal.stop_loss);
        const lossPct = (((slVal / Number(activeSignal.entry_price)) - 1) * 100).toFixed(2);
        slLineRef.current = series.createPriceLine({
          price: slVal,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `STOP LOSS (${lossPct}%)`,
        });
      }
    } catch (e) {
      console.warn('[TradingViewChart] Error al renderizar price lines de señal:', e);
    }
  }, [activeSignal, overlaySignals]);

  const isBuyAction = activeSignal?.action?.includes('BUY');
  const actionLabel = activeSignal?.action || 'HOLD';
  const confidence = typeof activeSignal?.confidence_score === 'number'
    ? activeSignal.confidence_score.toFixed(1)
    : '75.0';

  return (
    <div className="flex flex-col h-full min-h-[480px] bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#242f42] bg-[#0f141d]">
        {/* Symbol Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 text-sm tracking-wide">{symbol}</span>
            <span className="text-[11px] font-medium text-slate-400 bg-[#1c2433] px-2 py-0.5 rounded border border-[#242f42]">
              Spot / Perpetual
            </span>
          </div>

          {currentPrice && (
            <span className="font-mono tabular-nums text-base font-bold text-slate-50">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Chart Actions & Timeframe selector */}
        <div className="flex items-center gap-2">
          {/* Timeframe buttons */}
          <div className="flex items-center bg-[#1c2433] p-0.5 rounded-lg border border-[#242f42]">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Toggle IA Signals Overlay */}
          <button
            onClick={() => setOverlaySignals(!overlaySignals)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              overlaySignals
                ? 'bg-blue-950/60 border-blue-500/50 text-blue-300'
                : 'bg-[#1c2433] border-[#242f42] text-slate-400 hover:text-slate-200'
            }`}
            title="Activar/Desactivar líneas de Entrada, TP y SL de la IA"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Niveles IA</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative flex-1 w-full min-h-[420px] h-[440px]">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Signal Overlay Banner if active */}
        {overlaySignals && activeSignal && (
          <div className="absolute top-3 left-4 z-10 flex items-center gap-2 bg-[#0b0e14]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs shadow-lg">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-slate-300">Señal IA Activa:</span>
            <span className={`font-bold ${isBuyAction ? 'text-emerald-400' : 'text-rose-400'}`}>
              {actionLabel}
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              ({confidence}% conf)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
