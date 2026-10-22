'use client';

import React from 'react';
import { Activity, ShieldCheck, Zap, Radio, Terminal, Database, RefreshCw, LogOut, UserCheck, BarChart3, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  activeTab: 'trading' | 'paper' | 'backtest' | 'admin';
  setActiveTab: (tab: 'trading' | 'paper' | 'backtest' | 'admin') => void;
  connectionStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  onEvaluateAI: () => void;
  isEvaluating: boolean;
  onOpenGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  connectionStatus,
  onEvaluateAI,
  isEvaluating,
  onOpenGuide,
}) => {
  const { user, logout } = useAuth();

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <div
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30"
            title="WebSocket conectado en tiempo real (heartbeat 1000ms)"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
            <span>LIVE WS</span>
          </div>
        );
      case 'CONNECTING':
        return (
          <div
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-mono font-medium text-amber-400 bg-amber-950/40 border border-amber-500/30"
            title="Estableciendo conexión WebSocket..."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>CONECTANDO</span>
          </div>
        );
      case 'DISCONNECTED':
      case 'ERROR':
      default:
        return (
          <div
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-mono font-medium text-rose-400 bg-rose-950/40 border border-rose-500/30"
            title="WebSocket desconectado"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span>OFFLINE</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-[#1c2433] bg-[#0b0e14]/95 backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="flex h-12 items-center justify-between px-3 sm:px-4 max-w-[1920px] mx-auto gap-2">
        {/* Brand / Logo (Compact Single-Line) */}
        <div
          className="flex items-center gap-2.5 min-w-max cursor-pointer"
          title="Motor Predictivo • Terminal Cuantitativa Cripto & Macro con TimescaleDB + IA"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-500/20 border border-blue-400/30">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-slate-100 uppercase">
              Motor Predictivo
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" />
              VAULT
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Minimalist Segmented Control) */}
        <nav className="flex items-center gap-0.5 bg-[#10151f] p-0.5 rounded-lg border border-[#1e2638]">
          <button
            onClick={() => setActiveTab('trading')}
            title="Terminal de Trading en Vivo"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'trading'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161d2a]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Trading</span>
          </button>
          <button
            onClick={() => setActiveTab('paper')}
            title="Simulación de Ejecución Cuantitativa & Paper Trading"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'paper'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161d2a]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Paper Trading</span>
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            title="Matriz Walk-Forward de Backtesting Fuera de Muestra"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'backtest'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161d2a]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Backtesting</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            title="Telemetría de Sistema, Hypertables & Fuentes"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161d2a]'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Telemetría</span>
          </button>
        </nav>

        {/* Action Controls & System Status (Compact High-Density) */}
        <div className="flex items-center gap-2 min-w-max">
          {/* Interactive Guide Trigger */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-[#131923] hover:bg-[#1c2433] text-slate-300 hover:text-white border border-[#242f42] hover:border-slate-600 transition-all cursor-pointer shadow-sm"
              title="Manual interactivo de operaciones y arquitectura"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
              <span>Guía</span>
            </button>
          )}

          {/* Quick AI Trigger */}
          <button
            onClick={onEvaluateAI}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            title="Disparar evaluación cuantitativa de señal con IA (BTC/USDT)"
          >
            <RefreshCw className={`h-3 w-3 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluando...' : 'Evaluar IA'}</span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-[#242f42]" />

          {/* Connection Status Badge */}
          {getStatusBadge()}

          {/* User Badge & Logout */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#242f42]">
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-[#131923] border border-[#242f42] text-xs">
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span className="font-mono text-slate-200 text-[11px] font-medium">{user.username}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono font-semibold">
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
                title="Cerrar Sesión Segura"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
