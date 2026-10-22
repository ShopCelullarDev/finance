'use client';

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Terminal,
  ShieldCheck,
  BarChart3,
  Database,
  TrendingUp,
  Cpu,
  Layers,
  Zap,
  Radio,
  Sliders,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface PlatformGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'trading' | 'paper' | 'backtest' | 'admin') => void;
}

export const PlatformGuideModal: React.FC<PlatformGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<'overview' | 'trading' | 'paper' | 'backtest' | 'telemetry'>('overview');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      // Anti-Backdrop Protection
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#131923] border border-[#242f42] shadow-2xl flex flex-col my-6 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242f42] bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 border border-blue-400/30">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Manual de Operaciones & Guía de la Terminal
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  INTERACTIVA
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Conoce la arquitectura cuantitativa, generación de señales y ejecución simulada
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1c2433] transition-colors cursor-pointer"
            title="Cerrar Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#242f42] bg-[#0f141d] overflow-x-auto select-none">
          <button
            onClick={() => setActiveGuideTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeGuideTab === 'overview'
                ? 'text-blue-400 border-blue-500 bg-[#131923]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131923]/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>1. Arquitectura & IA</span>
          </button>

          <button
            onClick={() => setActiveGuideTab('trading')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeGuideTab === 'trading'
                ? 'text-blue-400 border-blue-500 bg-[#131923]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131923]/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. Terminal de Trading</span>
          </button>

          <button
            onClick={() => setActiveGuideTab('paper')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeGuideTab === 'paper'
                ? 'text-blue-400 border-blue-500 bg-[#131923]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131923]/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Paper Trading (Fase 7)</span>
          </button>

          <button
            onClick={() => setActiveGuideTab('backtest')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeGuideTab === 'backtest'
                ? 'text-blue-400 border-blue-500 bg-[#131923]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131923]/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>4. Matriz Walk-Forward</span>
          </button>

          <button
            onClick={() => setActiveGuideTab('telemetry')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeGuideTab === 'telemetry'
                ? 'text-blue-400 border-blue-500 bg-[#131923]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131923]/50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>5. Telemetría & Fuentes</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed max-h-[calc(90vh-140px)]">
          {/* TAB 1: OVERVIEW & PIPELINE */}
          {activeGuideTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100">
                    ¿Qué es el Motor Predictivo de Tendencias Web?
                  </h4>
                  <p className="mt-1 text-slate-300">
                    Es una terminal institucional privada que procesa datos de mercado en tiempo real, aplica modelos de Machine Learning (FinBERT para noticias y LightGBM con Triple Barrier Labeling para precios) y genera señales predictivas explicables con gestión automática de riesgo.
                  </p>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Pipeline de Datos en 4 Pasos
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-[10px]">1</span>
                    <span>Ingesta Vectorizada</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Captura ticks de Binance y Kraken WS, mercados de predicción en Polymarket Gamma, noticias en streaming y métricas macroeconómicas de la FED.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-blue-400 font-bold font-mono">
                    <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-500/50 flex items-center justify-center text-[10px]">2</span>
                    <span>Almacenamiento Temporal</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Los ticks y noticias se insertan en hypertables de TimescaleDB con partición automática y compresión columnar, distribuyéndose vía Redis Streams y Pub/Sub.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold font-mono">
                    <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/50 flex items-center justify-center text-[10px]">3</span>
                    <span>Inferencia de IA y Señales</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Feature Store multivariable de 14 factores: polaridad FinBERT con decaimiento temporal, Order Flow Imbalance (OFI), confluencia MTF y predicción LightGBM.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold font-mono">
                    <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/50 flex items-center justify-center text-[10px]">4</span>
                    <span>Auto-Ejecución & Monitoreo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    El Order Dispatcher evalúa filtros de confluencia y auto-ejecuta órdenes simuladas con slippage, mientras el monitor tick a tick activa Trailing Stops a Breakeven.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRADING TERMINAL */}
          {activeGuideTab === 'trading' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  Terminal de Trading en Vivo
                </h4>
                <p className="text-slate-300">
                  Es el centro operativo principal para visualizar el comportamiento de precios y las recomendaciones de la IA en tiempo real.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Gráfico Interactivo de TradingView & Líneas de Niveles IA:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Al emitirse una señal para el activo seleccionado (ej. BTC/USDT), el gráfico proyecta automáticamente 3 líneas de referencia:
                    <span className="text-blue-400 font-mono font-bold"> Azul (Entrada)</span>,
                    <span className="text-rose-400 font-mono font-bold"> Roja (Stop Loss dinámico por volatilidad ATR)</span> y
                    <span className="text-emerald-400 font-mono font-bold"> Verde (Take Profit con relación 1:2.2)</span>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Feed de Señales y Modal de Explicabilidad:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Cada tarjeta en el feed derecho muestra la acción (<strong className="text-emerald-400">BUY</strong>, <strong className="text-rose-400">SELL</strong>, <strong className="text-amber-400">HOLD</strong>), el porcentaje de confianza y la confirmación del modelo ML.
                    Al hacer clic en cualquier señal, se abre el modal con la justificación algorítmica matemática (pesos de sentimiento, momentum, OFI y macro).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Libro de Órdenes L2 y Sentimiento Macro:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    El widget de profundidad muestra los niveles de oferta y demanda con el spread actual. En la parte inferior, el indicador de sentimiento macro refleja la polaridad ponderada por tiempo de los titulares globales.
                  </p>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    onNavigateTab('trading');
                    onClose();
                  }}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer text-xs"
                >
                  <span>Ir a la Terminal de Trading</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* TAB 3: PAPER TRADING */}
          {activeGuideTab === 'paper' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Paper Trading & Ejecución Simulada (Fase 7)
                </h4>
                <p className="text-slate-300">
                  Simula la operativa de una cuenta institucional con $10,000.00 USDT de saldo, aplicando comisiones de taker reales (1.5 bps), deslizamiento (slippage) y reglas estrictas de riesgo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-1.5">
                  <h5 className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" />
                    Filtros de Confluencia
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    El Order Dispatcher solo abre operaciones si la señal cumple con:
                  </p>
                  <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-1">
                    <li>Confianza ML ≥ 55%</li>
                    <li>Consenso direccional entre reglas y LightGBM</li>
                    <li>OFI positivo para compras (no presiona venta)</li>
                    <li>Exclusión de régimen Squeeze (chop/lateral)</li>
                    <li>Sin posiciones abiertas duplicadas en el activo</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-1.5">
                  <h5 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Trailing Stop a Breakeven
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Cuando una posición abierta alcanza el <strong>50% del camino hacia el Take Profit</strong>:
                  </p>
                  <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-1">
                    <li>El Stop Loss sube automáticamente a Precio de Entrada + Comisiones</li>
                    <li>Se activa el distintivo <span className="text-blue-400 font-mono font-bold">BE RATCHET</span></li>
                    <li>La posición queda matemáticamente blindada contra pérdidas</li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-2">
                <h5 className="font-bold text-xs text-slate-200">
                  Dimensionamiento ATR & Límite de Margen
                </h5>
                <p className="text-[11px] text-slate-400">
                  Al abrir órdenes manuales o automáticas, el tamaño de la posición se calcula para arriesgar exactamente el 1.0% de la cuenta ($100).
                  Para evitar concentraciones de capital excesivas, el sistema aplica un <strong className="text-slate-200">límite máximo de margen del 25%</strong> del capital total.
                </p>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    onNavigateTab('paper');
                    onClose();
                  }}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer text-xs"
                >
                  <span>Ir a Paper Trading</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* TAB 4: BACKTESTING */}
          {activeGuideTab === 'backtest' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Matriz Walk-Forward de Backtesting (Fase 6D)
                </h4>
                <p className="text-slate-300">
                  Prueba la robustez del motor cuantitativo mediante simulación tick a tick fuera de muestra (Out-of-Sample) con comisiones y slippage realistas.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Validación por Folds Cronológicos:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    El historial se fragmenta en ventanas independientes (Folds 1 al 4) para medir si el algoritmo mantiene rentabilidad en diferentes condiciones de mercado sin sobre-ajustar parámetros.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Horizonte Temporal Óptimo (H ≥ 1,000 ticks):
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    El análisis empírico demostró que a nivel de milisegundos, el arrastre de comisiones (fee drag) diluye las ganancias. Operar con un horizonte mayor a 1,000 ticks (~70 minutos) permite capturar movimientos del 0.3% - 0.8% que superan los costos de fricción con holgura.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14]/60 border border-[#242f42] space-y-1">
                  <div className="font-semibold text-slate-200 text-xs">
                    • Libro de Auditoría de Operaciones:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Permite auditar trade por trade el precio de entrada, precio de salida, causa de cierre (Take Profit, Stop Loss, Trailing Stop o Time Limit) y el PnL neto después de fees.
                  </p>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    onNavigateTab('backtest');
                    onClose();
                  }}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer text-xs"
                >
                  <span>Ir a Matriz Backtesting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* TAB 5: TELEMETRY & CONNECTIVITY */}
          {activeGuideTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Telemetría, Conectividad & Salud del Sistema (Fase 3)
                </h4>
                <p className="text-slate-300">
                  Panel para auditar el estado de los sockets, latencias de las APIs de exchanges y la salud de TimescaleDB y Redis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Insignia LIVE WS</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Indica que el cliente WebSocket está autenticado y suscrito activamente a los canales de ticks y señales con latencia sub-milisegundo.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-1">
                  <div className="flex items-center gap-2 text-blue-400 font-bold font-mono">
                    <Database className="w-3.5 h-3.5" />
                    <span>Hypertables & Compresión</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Muestra los chunks creados en TimescaleDB y el porcentaje de compresión en disco de datos históricos de ticks y noticias.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#242f42] space-y-1">
                <h5 className="font-semibold text-slate-200 text-xs">
                  Red de 45+ Fuentes de Mercado
                </h5>
                <p className="text-[11px] text-slate-400">
                  Supervisa la disponibilidad de Binance, Kraken, Polymarket Gamma, CoinGecko, Federal Reserve FRED y fuentes de noticias financieras con alertas de desconexión inmediata.
                </p>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    onNavigateTab('admin');
                    onClose();
                  }}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer text-xs"
                >
                  <span>Ir a Telemetría & Admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#242f42] bg-[#0b0e14] text-[11px] text-slate-400">
          <span>Terminal Cuantitativa v1.0 • Motor Predictivo</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1c2433] hover:bg-[#242f42] text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};
