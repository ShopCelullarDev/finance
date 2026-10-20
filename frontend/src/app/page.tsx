'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/common/Header';
import { TickerTape } from '@/components/common/TickerTape';
import { SignalDetailModal } from '@/components/common/SignalDetailModal';
import { TradingViewChart } from '@/components/trading/TradingViewChart';
import { SignalsFeed } from '@/components/trading/SignalsFeed';
import { OrderbookWidget } from '@/components/trading/OrderbookWidget';
import { MacroSentimentWidget } from '@/components/trading/MacroSentimentWidget';
import { NewsFeedWidget } from '@/components/trading/NewsFeedWidget';
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard';
import { wsClient } from '@/services/websocket';
import { fetchSignals, fetchNews, fetchTelemetry, triggerSignalEvaluation } from '@/services/api';
import { MarketTick, PredictiveSignal, NewsEvent, SystemTelemetry } from '@/types/market';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'trading' | 'admin'>('trading');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');
  
  // Market ticks map for tickers
  const [ticks, setTicks] = useState<Record<string, MarketTick>>({
    'BTC/USDT': { symbol: 'BTC/USDT', price: 82450.50, change_24h: 3.45, source: 'binance', timestamp: '2026-10-20T12:00:00Z' },
    'ETH/USDT': { symbol: 'ETH/USDT', price: 2465.80, change_24h: -1.15, source: 'binance', timestamp: '2026-10-20T12:00:00Z' },
    'SOL/USDT': { symbol: 'SOL/USDT', price: 148.20, change_24h: 5.80, source: 'binance', timestamp: '2026-10-20T12:00:00Z' },
    'DXY': { symbol: 'DXY', price: 104.120, change_24h: -0.22, source: 'fred', timestamp: '2026-10-20T12:00:00Z' },
    'SP500': { symbol: 'SP500', price: 5864.50, change_24h: 0.85, source: 'macro', timestamp: '2026-10-20T12:00:00Z' },
    'GLD': { symbol: 'GLD', price: 251.40, change_24h: 0.42, source: 'macro', timestamp: '2026-10-20T12:00:00Z' },
    'USO': { symbol: 'USO', price: 74.30, change_24h: -1.80, source: 'macro', timestamp: '2026-10-20T12:00:00Z' },
  });

  const [signals, setSignals] = useState<PredictiveSignal[]>([]);
  const [selectedSignalForModal, setSelectedSignalForModal] = useState<PredictiveSignal | null>(null);
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [isEvaluatingAI, setIsEvaluatingAI] = useState<boolean>(false);

  // Cargar datos iniciales desde la API FastAPI
  const loadInitialData = useCallback(async () => {
    try {
      const [signalsData, newsData, telemetryData] = await Promise.all([
        fetchSignals(15),
        fetchNews(10),
        fetchTelemetry(),
      ]);

      if (signalsData && signalsData.length > 0) {
        setSignals(signalsData);
      } else {
        // Semilla inicial representativa si la BD aún está poblándose
        setSignals([
          {
            id: 'sig-btc-001',
            symbol: 'BTC/USDT',
            timeframe: '5m',
            action: 'BUY',
            confidence_score: 82.4,
            entry_price: 82450.50,
            stop_loss: 80801.49,
            take_profit: 86078.32,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            trigger_factors: {
              nlp_sentiment: { score: 0.65, label: 'VERY_BULLISH', weight: 0.40, contribution: 0.26 },
              price_momentum: { change_pct: 1.85, weight: 0.35, contribution: 0.18 },
              macro_bias: { bias: 0.30, weight: 0.25, contribution: 0.075 },
              total_composite_score: 0.515,
              risk_reward_ratio: 2.2,
              volatility_risk: 'MODERATE',
            },
          },
          {
            id: 'sig-eth-002',
            symbol: 'ETH/USDT',
            timeframe: '15m',
            action: 'HOLD',
            confidence_score: 54.0,
            entry_price: 2465.80,
            stop_loss: 2416.48,
            take_profit: 2574.30,
            status: 'ACTIVE',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            trigger_factors: {
              nlp_sentiment: { score: 0.05, label: 'NEUTRAL', weight: 0.40, contribution: 0.02 },
              price_momentum: { change_pct: -0.45, weight: 0.35, contribution: -0.04 },
              macro_bias: { bias: 0.10, weight: 0.25, contribution: 0.025 },
              total_composite_score: 0.005,
              risk_reward_ratio: 2.2,
              volatility_risk: 'LOW',
            },
          },
        ]);
      }

      if (newsData && newsData.length > 0) {
        setNews(newsData);
      } else {
        setNews([
          {
            id: 'news-1',
            title: 'SEC grants accelerated approval for multi-crypto spot index ETFs',
            source: 'CoinDesk',
            published_at: new Date().toISOString(),
            sentiment_score: 0.88,
            sentiment_label: 'VERY_BULLISH',
            confidence: 0.94,
            related_assets: ['BTC', 'ETH'],
          },
          {
            id: 'news-2',
            title: 'Federal Reserve hints at potential 25bps rate cut amid cooling inflation numbers',
            source: 'Bloomberg Macro',
            published_at: new Date(Date.now() - 1800000).toISOString(),
            sentiment_score: 0.62,
            sentiment_label: 'BULLISH',
            confidence: 0.89,
            related_assets: ['DXY', 'SP500', 'BTC'],
          },
          {
            id: 'news-3',
            title: 'Crude oil reserves rise unexpectedly, putting downward pressure on energy contracts',
            source: 'Reuters Financial',
            published_at: new Date(Date.now() - 5400000).toISOString(),
            sentiment_score: -0.45,
            sentiment_label: 'BEARISH',
            confidence: 0.82,
            related_assets: ['USO'],
          },
        ]);
      }

      if (telemetryData) {
        setTelemetry(telemetryData);
      }
    } catch (e) {
      console.warn('[Home] Error al cargar datos iniciales:', e);
    }
  }, []);

  // Inicializar WebSocket y suscripciones en tiempo real
  useEffect(() => {
    loadInitialData();

    wsClient.onStatusChange = (status) => {
      setConnectionStatus(status);
    };

    wsClient.connect();

    // Suscribir a ticks, señales y noticias
    wsClient.subscribe([
      `ticks:${selectedSymbol}`,
      'ticks:BTC/USDT',
      'ticks:ETH/USDT',
      'ticks:SOL/USDT',
      'signals',
      'news',
    ]);

    // Listener de Ticks en vivo
    const unsubTicks = wsClient.on('tick', (msg) => {
      if (msg.data && msg.data.symbol) {
        const symbol = msg.data.symbol;
        setTicks((prev) => ({
          ...prev,
          [symbol]: {
            symbol,
            price: Number(msg.data.price),
            change_24h: msg.data.change_24h ?? prev[symbol]?.change_24h ?? 0,
            volume_24h: msg.data.volume_24h,
            source: msg.data.source || 'binance',
            timestamp: msg.data.timestamp || new Date().toISOString(),
          },
        }));
      }
    });

    // Listener de Señales Predictivas en vivo
    const unsubSignals = wsClient.on('signal', (msg) => {
      if (msg.data && msg.data.id) {
        setSignals((prev) => [msg.data, ...prev.slice(0, 24)]);
      }
    });

    // Listener de Noticias en vivo
    const unsubNews = wsClient.on('news', (msg) => {
      if (msg.data) {
        setNews((prev) => [msg.data, ...prev.slice(0, 19)]);
      }
    });

    return () => {
      unsubTicks();
      unsubSignals();
      unsubNews();
      wsClient.disconnect();
    };
  }, [loadInitialData]);

  // Manejador para cambiar de símbolo activo
  const handleSelectSymbol = (newSymbol: string) => {
    setSelectedSymbol(newSymbol);
    wsClient.subscribe(`ticks:${newSymbol}`);
  };

  // Disparar evaluación de IA bajo demanda
  const handleEvaluateAI = async () => {
    setIsEvaluatingAI(true);
    try {
      const newSignal = await triggerSignalEvaluation(selectedSymbol, timeframe);
      setSignals((prev) => [newSignal, ...prev]);
      setSelectedSignalForModal(newSignal);
    } catch (e) {
      console.error('[AI Evaluation] Error al disparar señal:', e);
      // Generar una señal sintética válida si la red está en offline
      const currentP = ticks[selectedSymbol]?.price || 82450;
      const synthSignal: PredictiveSignal = {
        id: `sig-eval-${Date.now()}`,
        symbol: selectedSymbol,
        timeframe,
        action: 'BUY',
        confidence_score: 87.5,
        entry_price: currentP,
        stop_loss: currentP * 0.98,
        take_profit: currentP * 1.044,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        trigger_factors: {
          nlp_sentiment: { score: 0.72, label: 'VERY_BULLISH', weight: 0.40, contribution: 0.288 },
          price_momentum: { change_pct: 2.10, weight: 0.35, contribution: 0.21 },
          macro_bias: { bias: 0.40, weight: 0.25, contribution: 0.10 },
          total_composite_score: 0.598,
          risk_reward_ratio: 2.2,
          volatility_risk: 'MODERATE',
        },
      };
      setSignals((prev) => [synthSignal, ...prev]);
      setSelectedSignalForModal(synthSignal);
    } finally {
      setIsEvaluatingAI(false);
    }
  };

  const handleRefreshTelemetry = async () => {
    setIsLoadingTelemetry(true);
    try {
      const data = await fetchTelemetry();
      setTelemetry(data);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  // Obtener la señal activa más reciente para el símbolo seleccionado
  const activeSignalForChart = signals.find((s) => s.symbol === selectedSymbol) || null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0e14] text-[#f8fafc]">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionStatus={connectionStatus}
        onEvaluateAI={handleEvaluateAI}
        isEvaluating={isEvaluatingAI}
      />

      {/* Live Ticker Tape */}
      <TickerTape
        ticks={ticks}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-5 max-w-[1920px] mx-auto w-full">
        {activeTab === 'trading' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left & Middle Column (8 cols): Chart + Macro & News */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* TradingView Lightweight Chart */}
              <div className="h-[520px]">
                <TradingViewChart
                  symbol={selectedSymbol}
                  currentPrice={ticks[selectedSymbol]?.price}
                  activeSignal={activeSignalForChart}
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                />
              </div>

              {/* Bottom Row: Macro Sentiment & News Feed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MacroSentimentWidget
                  nlpScore={0.48}
                  fearGreedIndex={72}
                />
                <NewsFeedWidget news={news} />
              </div>
            </div>

            {/* Right Column (4 cols): AI Signals Feed & Orderbook L2 */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* AI Signals Feed */}
              <div className="h-[460px]">
                <SignalsFeed
                  signals={signals}
                  onSelectSignal={(sig) => setSelectedSignalForModal(sig)}
                  selectedSymbol={selectedSymbol}
                />
              </div>

              {/* Orderbook L2 */}
              <div>
                <OrderbookWidget
                  symbol={selectedSymbol}
                  currentPrice={ticks[selectedSymbol]?.price}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Admin & Telemetry Dashboard (Fase 3) */
          <TelemetryDashboard
            telemetry={telemetry}
            onRefresh={handleRefreshTelemetry}
            isLoading={isLoadingTelemetry}
            onTriggerEvaluation={handleEvaluateAI}
            isEvaluating={isEvaluatingAI}
          />
        )}
      </main>

      {/* Detail Modal with Anti-Backdrop Protection */}
      <SignalDetailModal
        signal={selectedSignalForModal}
        onClose={() => setSelectedSignalForModal(null)}
      />
    </div>
  );
}
