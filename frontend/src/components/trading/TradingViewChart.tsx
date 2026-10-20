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
import { Maximize2, BarChart2, Layers } from 'lucide-react';

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

  // Timeframes disponibles
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Generador de velas sintéticas iniciales según el símbolo y precio actual
  const generateInitialData = (basePrice: number): { candles: CandleData[]; volumes: any[] } => {
    const candles: CandleData[] = [];
    const volumes: any[] = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSecs = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : 86400;

    const count = 100;
    let price = basePrice * 0.96;

    for (let i = count; i >= 0; i--) {
      const time = (now - i * intervalSecs) as Time;
      const volatility = basePrice * 0.003;
      const delta = (Math.random() - 0.49) * volatility;
      const open = price;
      const close = Math.max(1, open + delta);
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = Math.floor(Math.random() * 80) + 10;

      candles.push({ time: time as any, open, high, low, close, volume });
      volumes.push({
        time: time as any,
        value: volume,
        color: close >= open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      });

      price = close;
    }

    return { candles, volumes };
  };

  // Inicializar Gráfico de TradingView
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Limpiar previo si existe
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
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
        mode: 1, // CrosshairMode.Normal
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

    // Serie de Velas Japonesas
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

    // Serie de Volumen (Histograma)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Escala propia secundaria
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Cargar datos sintéticos iniciales
    const refPrice = currentPrice || (symbol === 'BTC/USDT' ? 82450 : symbol === 'ETH/USDT' ? 2450 : symbol === 'SOL/USDT' ? 145 : 100);
    const { candles, volumes } = generateInitialData(refPrice);
    candlestickSeries.setData(candles as any);
    volumeSeries.setData(volumes as any);

    // Observer de Redimensionado
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Actualizar el gráfico con el precio en tiempo real (ticks entrantes)
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
      // Ignorar si el timestamp se superpone
    }
  }, [currentPrice]);

  // Renderizar o actualizar líneas de Señal Predictiva (Entry, Stop Loss, Take Profit)
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    // Limpiar líneas anteriores
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

    if (!overlaySignals || !activeSignal) return;

    try {
      // Línea de Entrada (Azul)
      entryLineRef.current = series.createPriceLine({
        price: activeSignal.entry_price,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `ENTRADA AI (${activeSignal.action})`,
      });

      // Línea de Take Profit (Verde)
      tpLineRef.current = series.createPriceLine({
        price: activeSignal.take_profit,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TAKE PROFIT (+${(((activeSignal.take_profit / activeSignal.entry_price) - 1) * 100).toFixed(2)}%)`,
      });

      // Línea de Stop Loss (Rojo)
      slLineRef.current = series.createPriceLine({
        price: activeSignal.stop_loss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `STOP LOSS (${(((activeSignal.stop_loss / activeSignal.entry_price) - 1) * 100).toFixed(2)}%)`,
      });
    } catch (e) {
      console.warn('[TradingViewChart] Error al renderizar price lines de señal:', e);
    }
  }, [activeSignal, overlaySignals]);

  return (
    <div className="flex flex-col h-full bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg">
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
      <div className="relative flex-1 w-full min-h-[420px]">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Signal Overlay Banner if active */}
        {overlaySignals && activeSignal && (
          <div className="absolute top-3 left-4 z-10 flex items-center gap-2 bg-[#0b0e14]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs shadow-lg">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-slate-300">Señal IA Activa:</span>
            <span className={`font-bold ${activeSignal.action.includes('BUY') ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activeSignal.action}
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              ({activeSignal.confidence_score.toFixed(1)}% conf)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
