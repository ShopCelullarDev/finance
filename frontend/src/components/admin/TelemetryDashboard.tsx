'use client';

import React from 'react';
import { SystemTelemetry, TelemetrySource } from '@/types/market';
import { Database, Server, Radio, HardDrive, RefreshCw, Cpu, CheckCircle2, AlertTriangle, XCircle, Zap } from 'lucide-react';

interface TelemetryDashboardProps {
  telemetry: SystemTelemetry | null;
  onRefresh: () => void;
  isLoading: boolean;
  onTriggerEvaluation: () => void;
  isEvaluating: boolean;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  telemetry,
  onRefresh,
  isLoading,
  onTriggerEvaluation,
  isEvaluating,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'DEGRADED':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'OFFLINE':
      default:
        return <XCircle className="h-4 w-4 text-rose-400" />;
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-emerald-400';
    if (latency < 150) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Bar: Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#131923] border border-[#242f42]">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-400" />
            Consola Administrativa & Telemetría en Vivo
          </h2>
          <p className="text-xs text-slate-400">
            Conectores realmente arrancados en este proceso, más el estado de base y Redis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerEvaluation}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm border border-blue-400/30 transition-all disabled:opacity-50"
          >
            <Cpu className={`h-4 w-4 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluando Señales...' : 'Forzar Evaluación Cuantitativa'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1c2433] hover:bg-[#242f42] text-slate-200 border border-[#242f42] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ticks Ingestados */}
        <div className="p-4 rounded-xl bg-[#131923] border border-[#242f42] shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Ticks Ingestados (Total)</span>
            <Database className="h-4 w-4 text-blue-400" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
            {(telemetry?.ticks_ingested_total ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            Insertados por el buffer de este proceso
          </p>
        </div>

        {/* Señales Predictivas */}
        <div className="p-4 rounded-xl bg-[#131923] border border-[#242f42] shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Señales Generadas (IA)</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
            {telemetry?.signals_generated_total == null ? '—' : telemetry.signals_generated_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-blue-400 font-mono mt-1">
            Persistidas con explicabilidad JSONB
          </p>
        </div>

        {/* Chunks TimescaleDB */}
        <div className="p-4 rounded-xl bg-[#131923] border border-[#242f42] shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Hipertablas & Compresión</span>
            <HardDrive className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
            {telemetry?.compressed_chunks == null || telemetry?.hypertable_chunks_total == null
              ? '—'
              : `${telemetry.compressed_chunks} / ${telemetry.hypertable_chunks_total}`}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            Chunks no consultados en esta vista
          </p>
        </div>

        {/* Clientes WebSocket */}
        <div className="p-4 rounded-xl bg-[#131923] border border-[#242f42] shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Clientes WS Conectados</span>
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
            {telemetry?.active_websocket_clients == null ? '—' : telemetry.active_websocket_clients}
          </div>
          <p className="text-[10px] text-emerald-400 font-mono mt-1">
            Distribución sub-milisegundo vía Redis Pub/Sub
          </p>
        </div>
      </div>

      {/* Sources Matrix Table */}
      <div className="bg-[#131923] border border-[#242f42] rounded-xl overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b border-[#242f42] bg-[#0f141d] flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-sm">
            Conectores de ingesta en este proceso
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {telemetry?.sources?.length ?? 0} conectores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0e14]/60 text-slate-400 uppercase text-[10px] font-bold border-b border-[#242f42]">
              <tr>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Fuente de Datos</th>
                <th className="px-4 py-2.5">Vector / Categoría</th>
                <th className="px-4 py-2.5 text-right">Latencia</th>
                <th className="px-4 py-2.5 text-right">Tasa (Ev/s)</th>
                <th className="px-4 py-2.5 text-right">Total Eventos</th>
                <th className="px-4 py-2.5 text-right">Errores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242f42]/40 font-mono tabular-nums">
              {!telemetry?.sources?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center font-sans text-slate-400">
                    Ningún conector de ingesta está registrado en este proceso.
                  </td>
                </tr>
              )}
              {telemetry?.sources?.map((source) => (
                <tr key={source.id} className="hover:bg-[#1a2230] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(source.status)}
                      <span className="font-semibold text-slate-200">{source.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-sans font-bold text-slate-100">
                    {source.name}
                  </td>
                  <td className="px-4 py-2.5 font-sans text-slate-400">
                    {source.category}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold ${source.latency_ms == null ? 'text-slate-500' : getLatencyColor(source.latency_ms)}`}>
                    {source.latency_ms == null ? 'sin medición' : `${source.latency_ms} ms`}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {source.rate_per_second}/s
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-400">
                    {source.total_events.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-300">
                    {source.error_count === 0 ? (
                      <span className="text-emerald-400">0</span>
                    ) : (
                      <span className="text-rose-400">{source.error_count}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
