'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Activity } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de autenticación. Verifique sus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f8fafc] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      {/* Glow de fondo discreto */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Principal */}
      <div className="w-full max-w-md z-10">
        {/* Cabecera / Badge Institucional */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0f172a] border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.15)] mb-4">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-emerald-400 uppercase">
              Private Trading Vault
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 text-center">
            Motor Predictivo
          </h1>
          <p className="text-xs text-slate-400 mt-1 text-center font-mono">
            Acceso restringido • Solo operadores y modelos autorizados
          </p>
        </div>

        {/* Tarjeta de Login */}
        <div className="bg-[#0b0e14]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-7 shadow-2xl shadow-black/80">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Campo Usuario / Correo */}
            <div>
              <label className="block text-[11px] font-mono tracking-wider text-slate-400 uppercase mb-2">
                Operador / Identificador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin o usuario@terminal.private"
                  autoComplete="username"
                  required
                  className="w-full bg-[#111722] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                  Contraseña Maestra
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-[#111722] border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Autenticación */}
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-semibold text-sm shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans active:scale-[0.99]"
            >
              {isSubmitting || loading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Autenticando Bóveda...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Información de Seguridad al pie */}
          <div className="mt-6 pt-5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Cifrado SHA-256 + Bcrypt</span>
            <span className="text-emerald-500/80">Rate-Limited (Redis)</span>
          </div>
        </div>

        {/* Footer legal/anti-leak */}
        <p className="text-center text-[11px] text-slate-600 mt-6 font-mono">
          Strictly Private • No Search Indexing • Session Revocation Active
        </p>
      </div>
    </div>
  );
}
