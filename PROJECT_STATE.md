# MOTOR PREDICTIVO - ESTADO VIVO DEL PROYECTO (PROJECT_STATE.md)
> **PROTOCOLO DE RESILIENCIA:** Archivo canónico de sincronización rápida. Cualquier modelo de IA o agente entrante DEBE leer ÚNICAMENTE este archivo para reanudar el trabajo de forma inmediata ante cortes de energía o traspasos de sesión, sin releer todo el repositorio ni el historial.

---

## 1. METADATOS DE SINCRONIZACION
- **FECHA_HORA_ACTUALIZACION:** 2026-10-21T12:48:00-04:00
- **MODELO_ACTIVO:** Gemini 3.8 Flash (High) / Antigravity AI Orchestrator
- **RAMA_GIT:** `main`
- **ESTADO_REPOSITORIO:** Fase 5 (Seguridad Privada) & Fase 6A (Optimización Cuantitativa) Completadas al 100%

---

## 2. PIVOTE ARQUITECTONICO & FASE ACTIVA
- **DIRECTIVA_ACTIVA:** Pivote a Arquitectura 100% Privada y Blindada contra Fallos + Optimización Cuantitativa de IA
- **ESTADO_PRIVACIDAD:** 
  - 🔒 **Zero Crawler Leak:** `robots.ts` (`Disallow: /`), cabeceras HTTP `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, nocache` en Next.js y FastAPI, meta tag robots en `layout.tsx`.
  - 🛡️ **Gate de Autenticación Mandatorio:** Terminal protegida por pantalla de Login institucional (`/login`), Next.js Middleware Edge interceptando accesos no autenticados, y FastAPI dependencias `get_current_user`.
  - 🔑 **Criptografía & Sesiones:** Hashing con SHA-256 + Bcrypt (12 rondas), JWT Access Token (15m) + Refresh Token (7d) con whitelist y revocación en Redis, y tickets de un solo uso para WebSockets.
  - ⏱️ **Rate Limiting:** Ventana deslizante en Redis sobre `/api/v1/auth/login` (máx. 5 intentos, bloqueo temporal por IP/identificador).
- **FASE_ACTUAL:** Fase 6 - Optimización Cuantitativa y Machine Learning del Motor Predictivo
- **ID_SUBTAREA_ACTUAL:** Fase 6A - Decaimiento Temporal NLP, Volatilidad Realizada y SL/TP Dinámicos
- **ESTADO_SUBTAREA:** COMPLETADO_VERIFICADO

---

## 3. HISTORIAL DE HITOS COMPLETADOS (FASES 1 - 6A)
- **Fase 1 (TimescaleDB + PostgreSQL 16):** ✅ Hipertablas particionadas, compresión y seeds.
- **Fase 2 (FastAPI + Ingesta V1 + IA):** ✅ Binance WS, Polymarket Gamma, Redis Pub/Sub, NLP FinBERT, Señales Predictivas y WS `/ws/live`.
- **Fase 3 (Dashboard Telemetría Admin):** ✅ Matriz de fuentes 45+, KPIs y monitor de hypertables.
- **Fase 4 (Terminal del Trader UI):** ✅ TradingView Charts v5, Orderbook, Sentimiento, Feed de Señales con modal anti-dismiss.
- **Fase 5 (Seguridad Privada & Auth Gate):** ✅ Zero SEO, Hashing SHA-256 + Bcrypt, Tokens duales en Redis, Next.js Middleware Edge y Login Dark Fintech.
- **Fase 6A (Optimización Cuantitativa del Motor de Señales):** ✅
  - Decaimiento exponencial de noticias ($w_i = e^{-\lambda \Delta t}$, half-life 45m cripto / 120m macro).
  - Volatilidad realizada $\sigma_{5m}$ sobre retornos logarítmicos y estimador High-Low de ticks.
  - Stop-Loss y Take-Profit adaptativos por volatilidad y clase de activo (Ratio R/R 1:2.2).
  - Penalización por spread y calibración de confianza logística ($50.0\% - 98.5\%$).

---

## 4. ARCHIVOS MODIFICADOS RECIENTEMENTE
- `app/services/ai/signal_engine.py` (Cálculo de volatilidad, decaimiento exponencial y riesgo adaptativo)
- `scripts/test_ai_signals.py` (Suite de pruebas para validación de señales e ingesta)
- `bitacora.md` (Registro cronológico de la optimización Fase A)
- `semilla.md`, `checkpoint.json`, `PROJECT_STATE.md`

---

## 5. COMANDO DE VERIFICACION RAPIDA (HEALTHCHECK)
```bash
# Validar ejecución limpia del motor de señales y persistencia en TimescaleDB
PYTHONPATH=. .venv/bin/python3 scripts/test_ai_signals.py
```

---

## 6. INSTRUCCION INMEDIATA DE REANUDACION (NEXT ACTION)
> **INSTRUCCION_DIRECTA:** La Fase 6A está completada y probada al 100%. El siguiente paso es iniciar la **Fase 6B: Microestructura & Multi-Timeframe**:
> 1. Desarrollar la métrica de Order Flow Imbalance (OFI) y Depth Delta L2 a partir del orderbook de Binance/conectores.
> 2. Implementar el motor de confluencia multi-temporal (1m, 5m, 15m, 1h) en `signal_engine.py` para filtrar ruido y whipsaws.
