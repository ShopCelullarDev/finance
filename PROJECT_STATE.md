# MOTOR PREDICTIVO - ESTADO VIVO DEL PROYECTO (PROJECT_STATE.md)
> **PROTOCOLO DE RESILIENCIA:** Archivo canónico de sincronización rápida. Cualquier modelo de IA o agente entrante DEBE leer ÚNICAMENTE este archivo para reanudar el trabajo de forma inmediata ante cortes de energía o traspasos de sesión, sin releer todo el repositorio ni el historial.

---

## 1. METADATOS DE SINCRONIZACION
- **FECHA_HORA_ACTUALIZACION:** 2026-10-21T16:40:00-04:00
- **MODELO_ACTIVO:** Gemini 3.8 Flash (High) / Antigravity AI Orchestrator
- **RAMA_GIT:** `main`
- **ESTADO_REPOSITORIO:** Fase 5 (Seguridad Privada), Fase 6A (Volatilidad & Stops), Fase 6B (OFI & MTF Confluence) y Fase 6C (Supervised ML LightGBM & Feature Store) Completadas al 100%

---

## 2. PIVOTE ARQUITECTONICO & FASE ACTIVA
- **DIRECTIVA_ACTIVA:** Pivote a Arquitectura 100% Privada y Blindada contra Fallos + Optimización Cuantitativa de IA
- **ESTADO_PRIVACIDAD:** 
  - 🔒 **Zero Crawler Leak:** `robots.ts` (`Disallow: /`), cabeceras HTTP `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, nocache` en Next.js y FastAPI, meta tag robots en `layout.tsx`.
  - 🛡️ **Gate de Autenticación Mandatorio:** Terminal protegida por pantalla de Login institucional (`/login`), Next.js Middleware Edge interceptando accesos no autenticados, y FastAPI dependencias `get_current_user`.
  - 🔑 **Criptografía & Sesiones:** Hashing con SHA-256 + Bcrypt (12 rondas), JWT Access Token (15m) + Refresh Token (7d) con whitelist y revocación en Redis, y tickets de un solo uso para WebSockets.
  - ⏱️ **Rate Limiting:** Ventana deslizante en Redis sobre `/api/v1/auth/login` (máx. 5 intentos, bloqueo temporal por IP/identificador).
- **FASE_ACTUAL:** Fase 6 - Optimización Cuantitativa y Machine Learning del Motor Predictivo
- **ID_SUBTAREA_ACTUAL:** Fase 6C - Supervised Machine Learning, Feature Store y Triple Barrier Labeling
- **ESTADO_SUBTAREA:** COMPLETADO_VERIFICADO

---

## 3. HISTORIAL DE HITOS COMPLETADOS (FASES 1 - 6C)
- **Fase 1 (TimescaleDB + PostgreSQL 16):** ✅ Hipertablas particionadas, compresión y seeds.
- **Fase 2 (FastAPI + Ingesta V1 + IA):** ✅ Binance WS, Polymarket Gamma, Redis Pub/Sub, NLP FinBERT, Señales Predictivas y WS `/ws/live`.
- **Fase 3 (Dashboard Telemetría Admin):** ✅ Matriz de fuentes 45+, KPIs y monitor de hypertables.
- **Fase 4 (Terminal del Trader UI):** ✅ TradingView Charts v5, Orderbook, Sentimiento, Feed de Señales con modal anti-dismiss.
- **Fase 5 (Seguridad Privada & Auth Gate):** ✅ Zero SEO, Hashing SHA-256 + Bcrypt, Tokens duales en Redis, Next.js Middleware Edge y Login Dark Fintech.
- **Fase 6A (Optimización Cuantitativa del Motor de Señales):** ✅ Decaimiento exponencial NLP ($\tau_{1/2}=45\text{m}/120\text{m}$), volatilidad realizada $\sigma_{5m}$ y stops dinámicos (R/R 1:2.2).
- **Fase 6B (Microestructura, Confluencia MTF y Régimen):** ✅ Order Flow Imbalance (OFI), Cumulative Volume Delta (CVD), Confluencia MTF (1m, 5m, 1h), Anti-Whipsaw y Detección Cuantitativa de Régimen.
- **Fase 6C (Machine Learning Supervisado & Feature Store):** ✅
  - **Feature Store Cuantitativo (`feature_store.py`):** 14 features multivariables libres de data leakage (`log_return_5m/15m/1h`, `realized_volatility`, `vwap_deviation`, `ofi_score`, `cvd_ratio`, `spread_bps`, `hl_range_pct`, `news_sentiment`, `macro_bias`, one-hot flags de régimen).
  - **Triple Barrier Labeling (López de Prado):** Barreras dinámicas horizontales y límite temporal con calibración empírica por error estándar ($\sigma_{\text{tick}} \cdot \sqrt{H_{\text{ticks}}}$).
  - **Clasificador LightGBM (`ml_model.py`):** Árboles regularizados (`max_depth=3`, `num_leaves=7`, `reg_alpha=0.3`, `reg_lambda=1.5`), `StandardScaler` ajustado estrictamente sobre Train (70% train / 15% val / 15% test Walk-Forward), superando baselines naive y logísticos.
  - **Inferencia en Tiempo Real en `signal_engine.py`:** Extracción dinámica del vector de features e inferencia con probabilidades $P(\text{BUY}), P(\text{SELL}), P(\text{NEUTRAL})$ y Top Drivers integrados en `trigger_factors["ml_supervised"]`.
  - **Explicabilidad en Frontend UI:** `SignalDetailModal.tsx` con tarjeta de probabilidades multiclass y drivers, y `SignalsFeed.tsx` con badges `ML BUY/SELL/HOLD`.

---

## 4. ARCHIVOS MODIFICADOS / CREADOS RECIENTEMENTE
- `app/services/ai/feature_store.py` (Feature Store Cuantitativo y Triple Barrier Labeling)
- `app/services/ai/ml_model.py` (Clasificador LightGBM y entrenamiento Walk-Forward)
- `scripts/train_ml_model.py` (Script de entrenamiento y persistencia de artefactos)
- `app/services/ai/models/lightgbm_signal_model.joblib` (Modelo entrenado)
- `app/services/ai/models/feature_scaler.joblib` (Scaler entrenado sin leakage)
- `app/services/ai/signal_engine.py` (Inferencia en tiempo real y payload enriquecido)
- `scripts/test_ai_signals.py` (Aserciones de Fase 6C para `ml_supervised`)
- `frontend/src/types/market.ts` (Tipos TypeScript de `ml_supervised`)
- `frontend/src/components/common/SignalDetailModal.tsx` (Visualización de LightGBM y probabilidades)
- `frontend/src/components/trading/SignalsFeed.tsx` (Badge ML en feed)
- `PROJECT_STATE.md`, `checkpoint.json`, `semilla.md`, `bitacora.md`

---

## 5. COMANDO DE VERIFICACION RAPIDA (HEALTHCHECK)
```bash
# Validar compilación limpia de frontend y ejecución del motor de señales con LightGBM ML
cd frontend && npm run build && cd .. && PYTHONPATH=. .venv/bin/python3 scripts/test_ai_signals.py
```

---

## 6. INSTRUCCION INMEDIATA DE REANUDACION (NEXT ACTION)
> **INSTRUCCION_DIRECTA:** La Fase 6C está completada y validada al 100%. Realizar git commit y push con los cambios de Fase 6C. Proceder a la siguiente fase planificada según indicaciones del usuario (por ejemplo, Fase 6D: Backtesting Vectorizado & Walk-Forward Performance Matrix, o Fase 7: Auto-Execution / Simulated Order Manager).
