'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/common/Header';
import { TickerTape } from '@/components/common/TickerTape';
import { SignalDetailModal } from '@/components/common/SignalDetailModal';
import { PlatformGuideModal } from '@/components/common/PlatformGuideModal';
import { GlobalConfigModal } from '@/components/common/GlobalConfigModal';
import { TradingViewChart } from '@/components/trading/TradingViewChart';
import { SignalsFeed } from '@/components/trading/SignalsFeed';
import { OrderbookWidget } from '@/components/trading/OrderbookWidget';
import { MacroSentimentWidget } from '@/components/trading/MacroSentimentWidget';
import { NewsFeedWidget } from '@/components/trading/NewsFeedWidget';
import { BacktestDashboard } from '@/components/trading/BacktestDashboard';
import { PaperTradingDashboard } from '@/components/trading/PaperTradingDashboard';
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard';
import { wsClient } from '@/services/websocket';
import { fetchSignals, fetchNews, fetchTelemetry, triggerSignalEvaluation, normalizeSignal, normalizeNews, fetchDispatcherStatus } from '@/services/api';
import { MarketTick, PredictiveSignal, NewsEvent, SystemTelemetry, OrderDispatcherStatus } from '@/types/market';
import { useAuth } from '@/context/AuthContext';
import { Activity } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'trading' | 'paper' | 'backtest' | 'admin'>('trading');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isGlobalConfigOpen, setIsGlobalConfigOpen] = useState<boolean>(false);
  const [dispatcherStatus, setDispatcherStatus] = useState<OrderDispatcherStatus | null>(null);

  const [ticks, setTicks] = useState<Record<string, MarketTick>>({});
  const [signals, setSignals] = useState<PredictiveSignal[]>([]);

  const [selectedSignalForModal, setSelectedSignalForModal] = useState<PredictiveSignal | null>(null);
  const [news, setNews] = useState<NewsEvent[]>([]);

  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [isEvaluatingAI, setIsEvaluatingAI] = useState<boolean>(false);

  // Cargar datos iniciales desde FastAPI
  const loadInitialData = useCallback(async () => {
    try {
      const [signalsData, newsData, telemetryData, dispData] = await Promise.all([
        fetchSignals(15),
        fetchNews(10),
        fetchTelemetry(),
        fetchDispatcherStatus().catch(() => null),
      ]);

      if (dispData) {
        setDispatcherStatus(dispData);
      }

      const freshCutoff = Date.now() - 15 * 60 * 1000;
      setSignals(
        (signalsData || []).filter((item) => {
          const stamp = new Date(item.created_at).getTime();
          return Number.isFinite(stamp) && stamp >= freshCutoff;
        })
      );
      setNews(newsData || []);

      if (telemetryData) {
        setTelemetry(telemetryData);
      }
    } catch (e) {
      console.warn('[Home] Error al cargar datos iniciales:', e);
    }
  }, []);

  // Inicializar WebSocket y suscripciones en tiempo real
  useEffect(() => {
    if (!isAuthenticated) return;

    loadInitialData();

    const unsubStatus = wsClient.addStatusListener((status) => {
      setConnectionStatus(status);
    });

    wsClient.connect();

    // Suscribir a ticks, señales y noticias
    wsClient.subscribe([
      `ticks:${selectedSymbol}`,
      'ticks:BTC/USDT',
      'ticks:ETH/USDT',
      'ticks:SOL/USDT',
      'signals:stream',
      'news:feed',
    ]);

    // Listener de Ticks en vivo
    const unsubTicks = wsClient.on('ticks', (msg) => {
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
            timestamp: msg.data.time || msg.data.timestamp || new Date().toISOString(),
          },
        }));
      }
    });

    // Listener de Señales Predictivas en vivo
    const unsubSignals = wsClient.on('signals', (msg) => {
      if (msg.data) {
        const norm = normalizeSignal(msg.data);
        setSignals((prev) => [norm, ...prev.filter((s) => s.id !== norm.id)]);
      }
    });

    // Listener de Noticias en vivo
    const unsubNews = wsClient.on('news', (msg) => {
      if (msg.data) {
        const norm = normalizeNews(msg.data);
        setNews((prev) => [norm, ...prev.slice(0, 19)]);
      }
    });

    return () => {
      unsubStatus();
      unsubTicks();
      unsubSignals();
      unsubNews();
    };
  }, [isAuthenticated, loadInitialData, selectedSymbol]);

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
      console.warn('[AI Evaluation] La evaluación no devolvió una señal:', e);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400 gap-3 select-none">
        <Activity className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="font-mono text-xs tracking-widest uppercase text-emerald-400">
          Autenticando Bóveda Cuantitativa...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0e14] text-[#f8fafc]">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionStatus={connectionStatus}
        onEvaluateAI={handleEvaluateAI}
        isEvaluating={isEvaluatingAI}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenConfig={() => setIsGlobalConfigOpen(true)}
      />

      {/* Live Ticker Tape */}
      <TickerTape
        ticks={ticks}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-5 max-w-[1920px] mx-auto w-full">
        {activeTab === 'trading' && (
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
                  nlpScore={
                    news.length > 0
                      ? news.reduce((sum, item) => sum + (Number(item.sentiment_score) || 0), 0) / news.length
                      : undefined
                  }
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
        )}

        {activeTab === 'paper' && (
          <PaperTradingDashboard
            currentPriceMap={Object.entries(ticks).reduce((acc, [sym, tick]) => {
              acc[sym] = tick.price;
              return acc;
            }, {} as Record<string, number>)}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestDashboard />
        )}

        {activeTab === 'admin' && (
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

      {/* Interactive Platform Operations Guide Modal */}
      <PlatformGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsGuideOpen(false);
        }}
      />

      {/* Global Trading, Profit & Compound Interest Modal */}
      <GlobalConfigModal
        isOpen={isGlobalConfigOpen}
        onClose={() => setIsGlobalConfigOpen(false)}
        dispatcherStatus={dispatcherStatus}
        onConfigUpdated={(updated) => setDispatcherStatus(updated)}
      />
    </div>
  );
}
