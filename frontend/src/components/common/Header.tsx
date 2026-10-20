'use client';

import React from 'react';
import { Activity, ShieldCheck, Zap, Radio, Terminal, Database, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'trading' | 'admin';
  setActiveTab: (tab: 'trading' | 'admin') => void;
  connectionStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  onEvaluateAI: () => void;
  isEvaluating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  connectionStatus,
  onEvaluateAI,
  isEvaluating,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE WS
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            CONECTANDO
          </span>
        );
      case 'DISCONNECTED':
      case 'ERROR':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-950/60 border border-rose-500/30 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            DESCONECTADO
          </span>
        );
    }
  };

  return (
    <header className="border-b border-[#242f42] bg-[#0b0e14] sticky top-0 z-40 select-none">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20 border border-blue-400/30">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-slate-50 uppercase">
                Motor Predictivo
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-widest px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                PRO v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Terminal Cuantitativa Cripto & Macro • TimescaleDB + IA
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#131923] p-1 rounded-lg border border-[#242f42]">
          <button
            onClick={() => setActiveTab('trading')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'trading'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2433]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Terminal de Trading
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2433]'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Telemetría & Admin
          </button>
        </nav>

        {/* Action Controls & System Status */}
        <div className="flex items-center gap-3">
          {/* Quick AI Trigger */}
          <button
            onClick={onEvaluateAI}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-blue-500/20 border border-blue-400/30 transition-all disabled:opacity-50"
            title="Disparar evaluación cuantitativa de señal con IA"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluando...' : 'Evaluar IA (BTC)'}</span>
          </button>

          {/* Connection Badge */}
          {getStatusBadge()}
        </div>
      </div>
    </header>
  );
};
