# MOTOR PREDICTIVO - ESTADO VIVO DEL PROYECTO (PROJECT_STATE.md)
> **PROTOCOLO DE RESILIENCIA:** Archivo canónico de sincronización rápida. Cualquier modelo de IA o agente entrante DEBE leer ÚNICAMENTE este archivo para reanudar el trabajo de forma inmediata ante cortes de energía o traspasos de sesión, sin releer todo el repositorio ni el historial.

---

## 1. METADATOS DE SINCRONIZACION
- **FECHA_HORA_ACTUALIZACION:** 2026-10-26T17:17:00-04:00
- **MODELO_ACTIVO:** Grok 4.7
- **RAMA_GIT:** `main`
- **ESTADO_REPOSITORIO:** Fases 1 a 7 cerradas. Fase 8.1 en código y pausada hasta mañana. El punto de reanudación vivo es semilla.md.

---

## 2. PIVOTE ARQUITECTONICO & FASE ACTIVA
- **DIRECTIVA_ACTIVA:** Pivote a Arquitectura 100% Privada y Blindada contra Fallos + Optimización Cuantitativa de IA + Paper Trading
- **ESTADO_PRIVACIDAD:** 
  - 🔒 **Zero Crawler Leak:** `robots.ts` (`Disallow: /`), cabeceras HTTP `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, nocache` en Next.js y FastAPI, meta tag robots en `layout.tsx`.
  - 🛡️ **Gate de Autenticación Mandatorio:** Terminal protegida por pantalla de Login institucional (`/login`), Next.js Middleware Edge interceptando accesos no autenticados, y FastAPI dependencias `get_current_user`.
  - 🔑 **Criptografía & Sesiones:** Hashing con SHA-256 + Bcrypt (12 rondas), JWT Access Token (15m) + Refresh Token (7d) con whitelist y revocación en Redis, y tickets de un solo uso para WebSockets.
  - ⏱️ **Rate Limiting:** Ventana deslizante en Redis sobre `/api/v1/auth/login` (máx. 5 intentos, bloqueo temporal por IP/identificador).
- **FASE_ACTUAL:** Fase 8.1 - Cerrar la superficie antes de un agente
- **ID_SUBTAREA_ACTUAL:** 8.1 (sesión obligatoria hecha; DDL 06 sin aplicar)
- **ESTADO_SUBTAREA:** PAUSADO

---

## 3. HISTORIAL DE HITOS COMPLETADOS (FASES 1 - 7)
- **Fase 1 (TimescaleDB + PostgreSQL 16):** ✅ Hipertablas particionadas, compresión y seeds.
- **Fase 2 (FastAPI + Ingesta V1 + IA):** ✅ Binance WS, Polymarket Gamma, Redis Pub/Sub, NLP FinBERT, Señales Predictivas y WS `/ws/live`.
- **Fase 3 (Dashboard Telemetría Admin):** ✅ Matriz de fuentes 45+, KPIs y monitor de hypertables.
- **Fase 4 (Terminal del Trader UI):** ✅ TradingView Charts v5, Orderbook, Sentimiento, Feed de Señales con modal anti-dismiss.
- **Fase 5 (Seguridad Privada & Auth Gate):** ✅ Zero SEO, Hashing SHA-256 + Bcrypt, Tokens duales en Redis, Next.js Middleware Edge y Login Dark Fintech.
- **Fase 6A (Optimización Cuantitativa del Motor de Señales):** ✅ Decaimiento exponencial NLP ($\tau_{1/2}=45\text{m}/120\text{m}$), volatilidad realizada $\sigma_{5m}$ y stops dinámicos (R/R 1:2.2).
- **Fase 6B (Microestructura, Confluencia MTF y Régimen):** ✅ Order Flow Imbalance (OFI), Cumulative Volume Delta (CVD), Confluencia MTF (1m, 5m, 1h), Anti-Whipsaw y Detección Cuantitativa de Régimen.
- **Fase 6C (Machine Learning Supervisado & Feature Store):** ✅ Feature Store con 14 variables, Triple Barrier Labeling, LightGBM shallow regularizado, e inferencia explicable en tiempo real.
- **Fase 6D (Backtesting Vectorizado & Walk-Forward Performance Matrix):** ✅ Simulación realista con comisiones taker y slippage, trailing stops a Breakeven, horizonte óptimo $H \ge 1,000$ ticks, matriz de 4 folds consistente, endpoints FastAPI y dashboard UI.
- **Fase 7.1 (Gestor de Posiciones y Cartera Simulada):** ✅
  - **DDL TimescaleDB (`05_paper_trading.sql`):** Tabla `paper_accounts` ($10,000 USDT de saldo inicial), tabla `paper_positions` e hipertabla `paper_equity_snapshots` particionada en chunks de 7 días.
  - **Motor de Dimensionamiento de Riesgo (`position_sizer.py`):** Riesgo fijo (1% por trade), dimensionamiento por volatilidad ATR, límite máximo de margen (25%) y comisiones taker.
  - **Servicio Asíncrono de Cartera (`portfolio_manager.py`):** Apertura/cierre de posiciones, marcado a mercado, trailing stop dinámico a Breakeven al 50% de camino a TP y eventos Redis PubSub `paper:events`.
  - **FastAPI Endpoints (`/api/v1/paper/*`):** `GET /account`, `GET /positions/open`, `GET /positions/history`, `GET /equity-curve`, `POST /calculate-sizing`, `POST /positions/open`, `POST /positions/{id}/close`, `POST /account/reset`.
- **Fase 7.2 (Order Dispatcher & Auto-Ejecución con Confluencia Cuantitativa):** ✅
  - Worker en segundo plano suscrito a Redis `signals:stream` iniciado con el ciclo de vida de FastAPI.
  - Puertas de confluencia: confianza ML $\ge 55\%$, acuerdo direccional ML, filtro de confluencia OFI, exclusión de régimen squeeze y deduplicación.
  - Ejecución con slippage realista (1.5 bps) y registro de actividad en telemetría.
- **Fase 7.3 (Monitoreo Tick a Tick & Trailing Stop Breakeven Ratchet):** ✅
  - Monitoreo en tiempo real sobre `ticks:stream` con lookup $O(1)$ de activos con posiciones abiertas.
  - Marcado a mercado continuo y activación automática de Trailing Stop a Breakeven (+ comisiones) al alcanzar el 50% de distancia al Take Profit.
  - Auto-liquidación por Take Profit, Stop Loss o Trailing Stop con liberación inmediata de margen y snapshots en TimescaleDB.
- **Fase 7.4 (Terminal UI de Paper Trading en Next.js):** ✅
  - Componente institucional de alta densidad `PaperTradingDashboard.tsx` integrado en `Header.tsx` y `page.tsx`.
  - Ribbon de KPIs de cuenta, panel de control y telemetría de confluencia, calculadora interactiva de dimensionamiento, feed de despacho, tablas de posiciones abiertas y cerradas, gráfico SVG de curva de capital y modal anti-backdrop de reseteo.
  - 100% de pruebas superadas en `scripts/test_paper_trading.py`, `scripts/test_order_dispatcher.py` y `npm run build` sin errores.

---

## 4. ARCHIVOS MODIFICADOS / CREADOS RECIENTEMENTE
- `database/init/05_paper_trading.sql` (Esquema DDL e hipertabla)
- `app/models/paper_trading.py`, `app/models/__init__.py` (Modelos SQLAlchemy)
- `app/schemas/paper_trading.py`, `app/schemas/__init__.py` (Esquemas Pydantic v2)
- `app/services/trading/position_sizer.py` (Motor de dimensionamiento de posición)
- `app/services/trading/portfolio_manager.py`, `app/services/trading/__init__.py` (Servicio de cartera)
- `app/services/trading/order_dispatcher.py` (Worker de auto-ejecución con confluencia)
- `app/api/v1/endpoints/paper_trading.py` (Endpoints FastAPI para cartera y despachador)
- `app/api/v1/router.py` (Registro de router `/paper`)
- `app/main.py` (Integración de lifespan startup/shutdown del despachador)
- `scripts/test_paper_trading.py` (Suite de pruebas Fase 7.1)
- `scripts/test_order_dispatcher.py` (Suite de pruebas Fases 7.2 y 7.3)
- `frontend/src/types/market.ts` (Tipos TypeScript de Paper Trading y Dispatcher)
- `frontend/src/services/api.ts` (Clientes de API)
- `frontend/src/components/trading/PaperTradingDashboard.tsx` (Dashboard UI de Paper Trading)
- `frontend/src/components/common/Header.tsx` (Pestaña "Paper Trading")
- `frontend/src/app/page.tsx` (Integración en layout de terminal)
- `pendiente.md`, `bitacora.md`, `semilla.md`, `checkpoint.json`, `PROJECT_STATE.md`

---

## 5. COMANDO DE VERIFICACION RAPIDA (HEALTHCHECK)
```bash
PYTHONPATH=. .venv/bin/python3 scripts/test_paper_trading.py && PYTHONPATH=. .venv/bin/python3 scripts/test_order_dispatcher.py && cd frontend && npm run build
```

---

## 6. INSTRUCCION INMEDIATA DE REANUDACION (NEXT ACTION)
> **INSTRUCCION_DIRECTA:** Sesión pausada el 2026-10-26. Leer semilla.md y continuar mañana. No implementar el brief del agente. Si TimescaleDB está arriba, respaldar y aplicar database/init/06_paper_account_type.sql. Los routers de mercado ya exigen sesión.
