# MOTOR PREDICTIVO - ESTADO VIVO DEL PROYECTO (PROJECT_STATE.md)
> **PROTOCOLO DE RESILIENCIA:** Archivo canónico de sincronización rápida. Cualquier modelo de IA o agente entrante DEBE leer ÚNICAMENTE este archivo para reanudar el trabajo de forma inmediata ante cortes de energía o traspasos de sesión, sin releer todo el repositorio ni el historial.

---

## 1. METADATOS DE SINCRONIZACION
- **FECHA_HORA_ACTUALIZACION:** 2026-10-21T14:36:00-04:00
- **MODELO_ACTIVO:** Gemini 3.8 Flash (High) / Antigravity AI Orchestrator
- **RAMA_GIT:** `main`
- **ESTADO_REPOSITORIO:** Fase 5 (Seguridad Privada), Fase 6A (Volatilidad & Stops) y Fase 6B (OFI & MTF Confluence) Completadas al 100%

---

## 2. PIVOTE ARQUITECTONICO & FASE ACTIVA
- **DIRECTIVA_ACTIVA:** Pivote a Arquitectura 100% Privada y Blindada contra Fallos + Optimización Cuantitativa de IA
- **ESTADO_PRIVACIDAD:** 
  - 🔒 **Zero Crawler Leak:** `robots.ts` (`Disallow: /`), cabeceras HTTP `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, nocache` en Next.js y FastAPI, meta tag robots en `layout.tsx`.
  - 🛡️ **Gate de Autenticación Mandatorio:** Terminal protegida por pantalla de Login institucional (`/login`), Next.js Middleware Edge interceptando accesos no autenticados, y FastAPI dependencias `get_current_user`.
  - 🔑 **Criptografía & Sesiones:** Hashing con SHA-256 + Bcrypt (12 rondas), JWT Access Token (15m) + Refresh Token (7d) con whitelist y revocación en Redis, y tickets de un solo uso para WebSockets.
  - ⏱️ **Rate Limiting:** Ventana deslizante en Redis sobre `/api/v1/auth/login` (máx. 5 intentos, bloqueo temporal por IP/identificador).
- **FASE_ACTUAL:** Fase 6 - Optimización Cuantitativa y Machine Learning del Motor Predictivo
- **ID_SUBTAREA_ACTUAL:** Fase 6B - Order Flow Imbalance, Confluencia Multi-Timeframe y Régimen de Mercado
- **ESTADO_SUBTAREA:** COMPLETADO_VERIFICADO

---

## 3. HISTORIAL DE HITOS COMPLETADOS (FASES 1 - 6B)
- **Fase 1 (TimescaleDB + PostgreSQL 16):** ✅ Hipertablas particionadas, compresión y seeds.
- **Fase 2 (FastAPI + Ingesta V1 + IA):** ✅ Binance WS, Polymarket Gamma, Redis Pub/Sub, NLP FinBERT, Señales Predictivas y WS `/ws/live`.
- **Fase 3 (Dashboard Telemetría Admin):** ✅ Matriz de fuentes 45+, KPIs y monitor de hypertables.
- **Fase 4 (Terminal del Trader UI):** ✅ TradingView Charts v5, Orderbook, Sentimiento, Feed de Señales con modal anti-dismiss.
- **Fase 5 (Seguridad Privada & Auth Gate):** ✅ Zero SEO, Hashing SHA-256 + Bcrypt, Tokens duales en Redis, Next.js Middleware Edge y Login Dark Fintech.
- **Fase 6A (Optimización Cuantitativa del Motor de Señales):** ✅ Decaimiento exponencial NLP ($\tau_{1/2}=45\text{m}/120\text{m}$), volatilidad realizada $\sigma_{5m}$ y stops dinámicos (R/R 1:2.2).
- **Fase 6B (Microestructura, Confluencia MTF y Régimen):** ✅
  - Order Flow Imbalance (OFI) y Cumulative Volume Delta (CVD) vía regla Lee-Ready en microestructura de ticks.
  - Confluencia Multi-Timeframe (1m, 5m, 1h) con filtro Anti-Whipsaw (neutralización de rebotes en contratendencia).
  - Detección de Régimen (`TRENDING_EXPANSION`, `CHOPPY_RANGE`, `VOLATILITY_SQUEEZE`, `BALANCED_MARKET`) con ponderaciones dinámicas.
  - UI/UX en Frontend: `SignalDetailModal.tsx` con barras OFI, matriz MTF y Rationale textual. `SignalsFeed.tsx` con badges de régimen.

---

## 4. ARCHIVOS MODIFICADOS RECIENTEMENTE
- `app/services/ai/signal_engine.py` (OFI, MTF Confluence, Regime Detection, Anti-Whipsaw Filter)
- `scripts/test_ai_signals.py` (Aserciones de Fase B para OFI, MTF y Régimen)
- `frontend/src/types/market.ts` (Nuevas interfaces TriggerFactors)
- `frontend/src/components/common/SignalDetailModal.tsx` (Renderizado enriquecido de factores)
- `frontend/src/components/trading/SignalsFeed.tsx` (Badges de régimen en feed)
- `bitacora.md`, `semilla.md`, `checkpoint.json`, `PROJECT_STATE.md`

---

## 5. COMANDO DE VERIFICACION RAPIDA (HEALTHCHECK)
```bash
# Validar compilación limpia de frontend y ejecución del motor de señales
cd frontend && npm run build && cd .. && PYTHONPATH=. .venv/bin/python3 scripts/test_ai_signals.py
```

---

## 6. INSTRUCCION INMEDIATA DE REANUDACION (NEXT ACTION)
> **INSTRUCCION_DIRECTA:** La Fase 6B está completada y probada al 100%. El siguiente paso consiste en iniciar la **Fase 6C: Machine Learning Supervisado & Feature Store**:
> 1. Diseñar el pipeline de extracción de vectores de features a partir de los 128,000+ ticks en TimescaleDB.
> 2. Implementar el etiquetado Triple Barrier Method (Marcos López de Prado: hit TP first, hit SL first, o timeout).
> 3. Entrenar y evaluar un clasificador LightGBM / CatBoost con Walk-Forward Validation.
