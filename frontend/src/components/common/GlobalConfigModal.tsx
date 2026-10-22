'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  DollarSign,
  TrendingUp,
  Target,
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Zap,
  Info,
  ArrowRight,
  TrendingDown,
  Percent,
} from 'lucide-react';
import { OrderDispatcherConfig, OrderDispatcherStatus } from '@/types/market';
import { updateDispatcherConfig } from '@/services/api';

interface GlobalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatcherStatus: OrderDispatcherStatus | null;
  onConfigUpdated?: (updatedStatus: OrderDispatcherStatus) => void;
}

export const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({
  isOpen,
  onClose,
  dispatcherStatus,
  onConfigUpdated,
}) => {
  // Form State
  const [tradeAmount, setTradeAmount] = useState<number>(1000);
  const [targetProfitPct, setTargetProfitPct] = useState<number>(5.0);
  const [selectionMode, setSelectionMode] = useState<'AUTOMATIC' | 'SPECIFIC'>('AUTOMATIC');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [compoundEnabled, setCompoundEnabled] = useState<boolean>(true);
  const [minConfidence, setMinConfidence] = useState<number>(55.0);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState<boolean>(true);
  const [requireOfi, setRequireOfi] = useState<boolean>(true);
  const [avoidSqueeze, setAvoidSqueeze] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync state when dispatcherStatus arrives
  useEffect(() => {
    if (dispatcherStatus) {
      if (dispatcherStatus.trade_amount_usd !== undefined) {
        setTradeAmount(dispatcherStatus.trade_amount_usd);
      }
      if (dispatcherStatus.target_profit_pct !== undefined) {
        setTargetProfitPct(dispatcherStatus.target_profit_pct);
      }
      if (dispatcherStatus.asset_selection_mode) {
        setSelectionMode(dispatcherStatus.asset_selection_mode);
      }
      if (dispatcherStatus.selected_symbol) {
        setSelectedSymbol(dispatcherStatus.selected_symbol);
      }
      if (dispatcherStatus.compound_interest_enabled !== undefined) {
        setCompoundEnabled(dispatcherStatus.compound_interest_enabled);
      }
      if (dispatcherStatus.min_confidence !== undefined) {
        setMinConfidence(dispatcherStatus.min_confidence);
      }
      if (dispatcherStatus.auto_trade_enabled !== undefined) {
        setAutoTradeEnabled(dispatcherStatus.auto_trade_enabled);
      }
      if (dispatcherStatus.require_ofi_confluence !== undefined) {
        setRequireOfi(dispatcherStatus.require_ofi_confluence);
      }
      if (dispatcherStatus.avoid_squeeze_regime !== undefined) {
        setAvoidSqueeze(dispatcherStatus.avoid_squeeze_regime);
      }
    }
  }, [dispatcherStatus]);

  if (!isOpen) return null;

  // Compound Interest Simulation Model
  const calculateCompoundProjection = () => {
    const rate = targetProfitPct / 100.0;
    const trades = [1, 2, 3, 5, 10, 15];
    return trades.map((t) => {
      // Compounded: Base * (1 + rate)^t
      const compoundBalance = tradeAmount * Math.pow(1 + rate, t);
      const compoundProfitTotal = compoundBalance - tradeAmount;
      const profitThisTrade = compoundBalance - (tradeAmount * Math.pow(1 + rate, t - 1));

      // Simple: Base + (Base * rate * t)
      const simpleBalance = tradeAmount + (tradeAmount * rate * t);
      const simpleProfitTotal = tradeAmount * rate * t;

      return {
        tradeIndex: t,
        compoundBalance,
        compoundProfitTotal,
        profitThisTrade,
        simpleBalance,
        simpleProfitTotal,
        pctGain: ((compoundBalance - tradeAmount) / tradeAmount) * 100.0,
      };
    });
  };

  const projections = calculateCompoundProjection();

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload: OrderDispatcherConfig = {
        auto_trade_enabled: autoTradeEnabled,
        min_confidence: minConfidence,
        trade_amount_usd: tradeAmount,
        target_profit_pct: targetProfitPct,
        asset_selection_mode: selectionMode,
        selected_symbol: selectedSymbol,
        compound_interest_enabled: compoundEnabled,
        require_ofi_confluence: requireOfi,
        avoid_squeeze_regime: avoidSqueeze,
        allowed_symbols: selectionMode === 'SPECIFIC' ? [selectedSymbol] : undefined,
      };

      const updated = await updateDispatcherConfig(payload);
      if (onConfigUpdated) {
        onConfigUpdated(updated);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error('Error al guardar configuración global:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setTradeAmount(1000);
    setTargetProfitPct(5.0);
    setSelectionMode('AUTOMATIC');
    setSelectedSymbol('BTC/USDT');
    setCompoundEnabled(true);
    setMinConfidence(55.0);
    setAutoTradeEnabled(true);
    setRequireOfi(true);
    setAvoidSqueeze(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      // Anti-Backdrop Protection
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#131923] border border-[#242f42] shadow-2xl flex flex-col my-6 max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#242f42] bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/30">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                  Configuración Global de Trading & Profit
                </h3>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-700/50">
                  MOTOR AUTÓNOMO IA
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ajuste centralizado de capital, objetivo de ganancia, selección de cripto y reinversión compuesta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#1c2433] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card 1: Monto para Tradear & Profit Objetivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monto para tradear */}
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#1e2638] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                    Monto Asignado por Trade
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">USDT</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    step="50"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(Math.max(10, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#131923] border border-[#242f42] rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono font-medium">USD</span>
                </div>
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[250, 500, 1000, 2500, 5000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTradeAmount(preset)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                        tradeAmount === preset
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-[#18202e] text-slate-400 hover:text-slate-200 hover:bg-[#1f293d]'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3">
                Base fija de entrada para cada posición ejecutada por la plataforma.
              </p>
            </div>

            {/* % de Profit Objetivo */}
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#1e2638] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    % Profit Objetivo por Trade
                  </label>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">Take Profit</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={targetProfitPct}
                    onChange={(e) => setTargetProfitPct(Math.max(0.5, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#131923] border border-[#242f42] rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono font-medium">%</span>
                </div>
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[2.5, 3.5, 5.0, 7.5, 10.0].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTargetProfitPct(preset)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                        targetProfitPct === preset
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-[#18202e] text-slate-400 hover:text-slate-200 hover:bg-[#1f293d]'
                      }`}
                    >
                      +{preset}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-[#1a2333]">
                <span>Ganancia esperada / trade:</span>
                <span className="font-mono font-bold text-emerald-400">
                  +${((tradeAmount * targetProfitPct) / 100.0).toFixed(2)} USDT
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Selección de Criptomoneda */}
          <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#1e2638] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                Estrategia de Selección de Criptomoneda
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Decisión Autónoma vs Filtro Fijo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opción A: Automática por IA */}
              <div
                onClick={() => setSelectionMode('AUTOMATIC')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectionMode === 'AUTOMATIC'
                    ? 'bg-blue-950/20 border-blue-500/60 shadow-sm shadow-blue-500/10'
                    : 'bg-[#131923] border-[#242f42] hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Automática (IA Cuantitativa)
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-600/40 font-mono font-semibold">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  La plataforma evalúa todos los pares en tiempo real (BTC, ETH, SOL...) y selecciona automáticamente el activo con mayor confluencia matemática, desbalance de liquidez (OFI) y menor riesgo.
                </p>
              </div>

              {/* Opción B: Específica */}
              <div
                onClick={() => setSelectionMode('SPECIFIC')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectionMode === 'SPECIFIC'
                    ? 'bg-blue-950/20 border-blue-500/60 shadow-sm shadow-blue-500/10'
                    : 'bg-[#131923] border-[#242f42] hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    <Target className="w-3.5 h-3.5 text-indigo-400" />
                    Criptomoneda Específica
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                    Manual
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                  La plataforma solo ejecutará operaciones para el activo seleccionado, ignorando oportunidades en otros pares.
                </p>
                {selectionMode === 'SPECIFIC' && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-indigo-500/40 rounded-md px-2.5 py-1.5 text-xs font-mono font-semibold text-white focus:outline-none"
                    >
                      <option value="BTC/USDT">BTC/USDT (Bitcoin)</option>
                      <option value="ETH/USDT">ETH/USDT (Ethereum)</option>
                      <option value="SOL/USDT">SOL/USDT (Solana)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Interés Compuesto (Compound Growth) */}
          <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#1e2638] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                    Habilitar Interés Compuesto (Reinversión de Ganancias)
                  </h4>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-mono">
                    EXPONENCIAL
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Si se logra el objetivo de profit con el monto inicial, la siguiente operación toma automáticamente el saldo inicial más el profit alcanzado para las demás operaciones.
                </p>
              </div>

              {/* Checkbox / Toggle */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compoundEnabled}
                  onChange={(e) => setCompoundEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Simulador Interactivo de Proyección */}
            {compoundEnabled && (
              <div className="p-3 rounded-lg bg-[#131923] border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    Proyección de Crecimiento Compuesto ({targetProfitPct}% por Trade Exitoso)
                  </span>
                  <span className="text-emerald-400 font-mono text-[10px]">
                    Base Inicial: ${tradeAmount.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                  {projections.map((p) => (
                    <div
                      key={p.tradeIndex}
                      className="p-2 rounded-md bg-[#0b0e14] border border-[#242f42] text-center"
                    >
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                        Trade #{p.tradeIndex}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-100 block">
                        ${p.compoundBalance.toFixed(0)}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 font-semibold block">
                        +{p.pctGain.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>A 10 operaciones exitosas con 5%:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    ${(tradeAmount * Math.pow(1 + targetProfitPct / 100, 10)).toFixed(2)} (+{((Math.pow(1 + targetProfitPct / 100, 10) - 1) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Filtros de Decisión Autónoma de la Plataforma */}
          <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#1e2638] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                Parámetros de Decisión de la IA (Confluencia Multidimensional)
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Control de Riesgo Cuantitativo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Umbral de confianza */}
              <div className="p-2.5 rounded-lg bg-[#131923] border border-[#242f42]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-300 font-medium">Confianza Mínima</span>
                  <span className="text-xs font-mono font-bold text-blue-400">{minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="45"
                  max="85"
                  step="1"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Confluencia OFI */}
              <div
                onClick={() => setRequireOfi(!requireOfi)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                  requireOfi ? 'bg-[#131923] border-blue-500/40 text-slate-200' : 'bg-[#10141c] border-[#1e2638] text-slate-500'
                }`}
              >
                <div>
                  <span className="text-[11px] font-semibold block">Confluencia OFI</span>
                  <span className="text-[9px] text-slate-400">Order Flow Imbalance</span>
                </div>
                <CheckCircle2 className={`w-4 h-4 ${requireOfi ? 'text-blue-400' : 'text-slate-600'}`} />
              </div>

              {/* Filtro Squeeze */}
              <div
                onClick={() => setAvoidSqueeze(!avoidSqueeze)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                  avoidSqueeze ? 'bg-[#131923] border-blue-500/40 text-slate-200' : 'bg-[#10141c] border-[#1e2638] text-slate-500'
                }`}
              >
                <div>
                  <span className="text-[11px] font-semibold block">Filtro Squeeze</span>
                  <span className="text-[9px] text-slate-400">Evitar compresión</span>
                </div>
                <CheckCircle2 className={`w-4 h-4 ${avoidSqueeze ? 'text-blue-400' : 'text-slate-600'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#242f42] bg-[#0b0e14]">
          <button
            onClick={handleResetDefaults}
            className="text-xs text-slate-400 hover:text-slate-200 underline transition cursor-pointer"
          >
            Restablecer Valores Predeterminados
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-[#131923] hover:bg-[#1c2433] border border-[#242f42] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 border border-blue-400/30 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>¡Aplicado con Éxito!</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Guardar & Aplicar al Motor</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
