# Plan de Trabajo y Lista de Pendientes (Backlog Maestro)

Este documento registra todas las tareas de implementación divididas por fases. Cada tarea cuenta con su estado, prioridad y agente asignado.

**Convención de Estados:**
- 🔴 `[ ] PENDIENTE`: Tarea no iniciada.
- 🟡 `[/] EN PROGRESO`: Tarea actualmente en desarrollo.
- 🟢 `[x] COMPLETADO`: Tarea finalizada, probada y validada.

---

## Fase 1: Recopilación y Arquitectura (TimescaleDB + PostgreSQL)

- [x] **1.1 Infraestructura Local Dockerizada** `Prioridad: Alta` `Agente: devops-security-agent`
  - [x] Crear `docker-compose.yml` con servicios: TimescaleDB (PostgreSQL 16) y Redis 7+.
  - [x] Configurar volúmenes persistentes, redes aisladas y healthchecks de arranque.
  - [x] Crear plantilla de entorno `.env.example` con credenciales locales por defecto.
- [x] **1.2 Migraciones DDL y Definición de Tablas** `Prioridad: Alta` `Agente: dba-timescaledb-agent`
  - [x] Script SQL / Migración para activar extensión `timescaledb`.
  - [x] Creación de tabla relacional `assets` con constraints e índices únicos.
  - [x] Creación de hipertabla `market_ticks` con particionado temporal en `time`.
  - [x] Creación de hipertabla `news_events` con particionado temporal en `published_at`.
  - [x] Creación de hipertabla `predictive_signals` con particionado temporal en `generated_at`.
- [x] **1.3 Optimización y Afinamiento de Hypertables** `Prioridad: Media` `Agente: dba-timescaledb-agent`
  - [x] Configurar tamaño óptimo de chunk (`chunk_time_interval` de 1 día para ticks, 7 días para noticias).
  - [x] Definir políticas de compresión automática de datos históricos (`compress_chunk`).
  - [x] Definir índices compuestos para optimizar filtros de `asset_id` + tiempo descendente.
- [x] **1.4 Semillas de Datos Iniciales (Seed Data)** `Prioridad: Media` `Agente: dba-timescaledb-agent`
  - [x] Poblar activos iniciales en `assets` (BTC/USDT, ETH/USDT, SOL/USDT, SPY, QQQ, GLD, USO/WTI).
  - [x] Script de prueba para validar inserciones de ticks a alta frecuencia.

---

## Fase 2: Backend, Ingestores y Motor de IA (FastAPI + CCXT + NLP)

- [x] **2.1 Estructura Base de FastAPI** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [x] Inicializar proyecto Python con `pyproject.toml` / `requirements.txt` y configuración modular (`app/`).
  - [x] Conexión asíncrona a PostgreSQL/TimescaleDB mediante `asyncpg` y SQLAlchemy async session.
  - [x] Conexión a Redis para Pub/Sub y buffering de ticks.
  - [x] Endpoints básicos de salud (`/health`, `/api/v1/assets`).
- [x] **2.2 Conectores de Ingesta Vector 1 (Exchanges en Tiempo Real)** `Prioridad: Alta` `Agente: data-ingestion-agent`
  - [x] Conector WebSocket persistente para Binance (Ticker y Trades).
  - [x] Conector WebSocket para Kraken y Coinbase Pro.
  - [x] Normalización de ticks con CCXT e inserción eficiente por lotes (batch inserts).
  - [x] Conector API para Polymarket Gamma API (mercados predictivos).
- [ ] **2.3 Conectores de Ingesta Vector 2 (Smart Money & Flujos)** `Prioridad: Media` `Agente: data-ingestion-agent`
  - [ ] Scraper / parser de transacciones del Congreso (CapitolTrades, QuiverQuant).
  - [ ] Extracción programada de compras/ventas de insiders (OpenInsider).
- [ ] **2.4 Conectores de Ingesta Vector 3 (Noticias en Streaming)** `Prioridad: Media` `Agente: data-ingestion-agent`
  - [ ] Ingesta de feeds RSS y scrapers en tiempo real (FinancialJuice, Jin10, ZeroHedge, Reuters).
  - [ ] Limpieza y desduplicación de noticias por URL / hash de contenido.
- [ ] **2.5 Conectores de Ingesta Vector 4 (Macro & Commodities)** `Prioridad: Media` `Agente: data-ingestion-agent`
  - [ ] Conector de datos de energía y commodities (EIA, CME, OilPrice).
  - [ ] Calendario de eventos macroeconómicos (TradingEconomics).
- [x] **2.6 Pipeline NLP de Sentimiento y Enriquecimiento** `Prioridad: Alta` `Agente: quant-nlp-agent`
  - [x] Carga del modelo FinBERT para inferencia de polaridad de noticias.
  - [x] Mapeo de entidades (NER) para vincular noticias con `affected_assets`.
  - [x] Guardado automático en hipertabla `news_events` con `sentiment_score`.
- [x] **2.7 Motor Predictivo y Generación de Señales** `Prioridad: Alta` `Agente: quant-nlp-agent`
  - [x] Algoritmo multivariante que correlaciona: Ticks + Sentimiento NLP + Flujo Institucional.
  - [x] Cálculo dinámico de `confidence_score` (0-100%).
  - [x] Estimación de niveles de gestión de riesgo: `entry_price`, `stop_loss`, `take_profit`.
  - [x] Estructuración explicable del payload `trigger_factors` (JSONB).
  - [x] Almacenamiento en hipertabla `predictive_signals` y emisión a Redis PubSub.
- [x] **2.8 Servidor WebSockets de Distribución** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [x] Gateway WebSocket `/ws/live` con suscripción a canales (`ticks:{symbol}`, `signals`, `news`).
  - [x] Broadcast de señales y ticks en tiempo real a clientes conectados.

---

## Fase 3: Desarrollo del Panel Administrativo (Dashboard)

- [x] **3.1 Monitor de Salud de Fuentes (Telemetry)** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [x] Matriz de estado en vivo para las 45+ fuentes de datos (Online / Latencia ms / Errores).
  - [x] Alertas visuales ante desconexión de sockets de exchanges.
- [x] **3.2 Visor de Rendimiento de Hypertables** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [x] Panel con volumen de ticks ingeridos por segundo y tamaño de chunks en disco.
  - [x] Estado de compresión y uso de memoria de TimescaleDB y Redis.
- [x] **3.3 Consola de Control de Señales e IA** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [x] Registro histórico de señales generadas con detalle de `trigger_factors`.
  - [x] Botón de disparo manual o recalibración de umbrales de confianza.
- [x] **3.4 Gestión de Configuración y Claves API** `Prioridad: Baja` `Agente: frontend-terminal-agent`
  - [x] Panel para activar/desactivar pares de activos o fuentes específicas.
  - [x] Configuración segura de endpoints y tokens.

---

## Fase 4: Frontend y Terminal del Trader

- [x] **4.1 Base de Frontend y Diseño Institucional** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [x] Configuración de Next.js (TypeScript, TailwindCSS, Dark Theme ergonómico).
  - [x] Sistema de layout adaptable para pantallas de trading multi-monitor y laptops.
- [x] **4.2 Integración de Gráficos Interactivos** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [x] Integración de TradingView Lightweight Charts con velas japonesas en tiempo real.
  - [x] Soporte para timeframes (1m, 5m, 15m, 1h, 4h, 1d).
  - [x] Capa de visualización de señales predictivas sobre el gráfico (flechas de entrada, líneas de SL/TP).
- [x] **4.3 Orderbook, Depth Chart y Feed en Tiempo Real** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [x] Widget de libro de órdenes simplificado o spread de mercado.
  - [x] Feed en vivo de señales predictivas con filtrado por activo y nivel de confianza.
  - [x] Ticker tape con precios y variaciones porcentuales 24h.
- [x] **4.4 Panel de Sentimiento Macro y Correlaciones** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [x] Medidor tipo "Gauge" del sentimiento global del mercado (Fear & Greed / NLP Sentiment).
  - [x] Tabla de correlaciones entre Cripto (BTC) y Macro (DXY, Petróleo, Oro, SP500).

---

## Fase 5: Arquitectura Privada, Autenticación y Control de Acceso (Zero-Leak Security)

- [x] **5.1 Bloqueo Global de Indexación y Privacidad Estricta (Anti-SEO)** `Prioridad: Alta` `Agente: devops-security-agent`
  - [x] Inyección de `robots.txt` restrictivo (`User-agent: *`, `Disallow: /`) en Next.js.
  - [x] Configuración global de cabecera HTTP `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` en `next.config.ts`.
  - [x] Metadatos globales `<meta name="robots" content="noindex, nofollow" />` en `layout.tsx`.
  - [x] Middleware en FastAPI para inyectar cabeceras de privacidad y deshabilitar endpoints de docs públicos en producción (`/docs`, `/redoc` condicionales).
- [x] **5.2 Modelo de Usuarios y Hashing de Contraseñas (Argon2id / bcrypt)** `Prioridad: Alta` `Agente: dba-timescaledb-agent & backend-fastapi-agent`
  - [x] Migración SQL / tabla `users` (id UUID, username, email, hashed_password, role, is_active, failed_attempts, locked_until).
  - [x] Utilidades criptográficas seguras de hashing con sal y factor de trabajo alto (`Argon2id` o `bcrypt`).
  - [x] Script de seed CLI para crear el superusuario inicial administrador de forma segura.
- [x] **5.3 Gestión de Sesiones y Tokens Duales (JWT + Redis + WebSocket Auth)** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [x] Emisión de Access Token de corta duración (15 min) y Refresh Token de larga duración (7 días).
  - [x] Almacenamiento y revocación inmediata de Refresh Tokens en Redis (soporte para cierre de sesión global).
  - [x] Protocolo de autenticación para WebSockets (`/ws/live` con validación de ticket efímero o token en handshake).
- [x] **5.4 Control de Acceso, Middleware y Rate Limiting** `Prioridad: Alta` `Agente: backend-fastapi-agent & frontend-terminal-agent`
  - [x] Dependencias de seguridad en FastAPI (`get_current_active_user`, scopes de roles).
  - [x] Rate limiter con ventana deslizante en Redis para `/api/v1/auth/login` (máximo 5 intentos por IP/usuario, bloqueo temporal).
  - [x] Middleware en Next.js (`middleware.ts`) que intercepta todas las rutas privadas y redirige a `/login` si no hay token válido.
- [x] **5.5 Gate UI/UX del Terminal (Pantalla de Login Fintech Dark)** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [x] Pantalla de Login institucional con estética ergonómica oscura (#0b0e14, acentos esmeralda/rojo, sin fugas de marca).
  - [x] Contexto global de autenticación en React (`AuthProvider`) con refresh automático de tokens en segundo plano.
  - [x] Interceptores en `api.ts` y reconexión autenticada en `websocket.ts`.

---

## Fase 6: Optimización Cuantitativa y Machine Learning del Motor Predictivo

- [x] **6.1 (Fase 6A) Modelado de Volatilidad, Decaimiento NLP y Stops Dinámicos** `Prioridad: Alta` `Agente: quant-nlp-agent`
  - [x] Decaimiento temporal exponencial de noticias ($\tau_{1/2}=45\text{m}/120\text{m}$).
  - [x] Volatilidad realizada $\sigma_{5m}$ con normalización min-max adaptativa.
  - [x] Stops dinámicos basados en Average True Range (ATR) con relación R/R calibrada 1:2.2.
- [x] **6.2 (Fase 6B) Microestructura, Confluencia MTF y Detección de Régimen** `Prioridad: Alta` `Agente: quant-nlp-agent`
  - [x] Order Flow Imbalance (OFI) y Cumulative Volume Delta (CVD) vía regla Lee-Ready.
  - [x] Confluencia Multi-Timeframe (1m, 5m, 1h) con penalización anti-whipsaw y multiplicador dinámico.
  - [x] Clasificador cuantitativo de régimen de mercado (Trending Bull/Bear, Range/Mean-Reverting, Volatile Squeeze).
- [x] **6.3 (Fase 6C) Machine Learning Supervisado & Feature Store** `Prioridad: Alta` `Agente: quant-nlp-agent`
  - [x] Feature Store Cuantitativo con 14 variables independientes (`feature_store.py`).
  - [x] Triple Barrier Labeling de Marcos López de Prado con calibración empírica por error estándar ($\sigma \cdot \sqrt{H}$).
  - [x] Clasificador LightGBM con árboles regularizados y entrenamiento cronológico Walk-Forward.
  - [x] Inferencia en tiempo real en `signal_engine.py` e integración con UI explicable.
- [x] **6.4 (Fase 6D) Backtesting Vectorizado & Walk-Forward Performance Matrix** `Prioridad: Alta` `Agente: quant-nlp-agent & frontend-terminal-agent`
  - [x] Motor de backtesting tick a tick con fricción realista (taker fees de 1.5 bps y bid-ask slippage).
  - [x] Trailing stop automático a breakeven (+ comisiones) al alcanzar el 50% de la distancia objetivo.
  - [x] Matriz Walk-Forward por Folds cronológicos (+1.07% Fold 1, +1.23% Fold 2, +0.26% Fold 3; Max DD 6.37%).
  - [x] Endpoints FastAPI `/api/v1/backtest/latest` y `/api/v1/backtest/run`.
  - [x] Dashboard UI institucional `BacktestDashboard.tsx` integrado en Header con libro de auditoría de órdenes.

---

## Fase 7: Paper Trading en Vivo & Simulated Order Execution Manager

- [ ] **7.1 Gestor de Posiciones y Cartera Simulada (Simulated Portfolio Manager)** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [ ] Esquema de base de datos o estado persistente en Redis/TimescaleDB para cuentas de paper trading (balance USDT, margen asignado, PnL realizado).
  - [ ] Motor de dimensionamiento de posición (Position Sizing) basado en volatilidad ATR y riesgo fijo (ej. 1% por trade).
- [ ] **7.2 Suscriptor de Señales en Vivo y Auto-Ejecución (Order Dispatcher)** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [ ] Worker en segundo plano suscrito a Redis PubSub `signals:stream`.
  - [ ] Filtro de confluencia para auto-ejecución (confianza ML >= 55%, OFI en concordancia, filtro de régimen).
  - [ ] Apertura de órdenes simuladas (Market / Limit con slippage estimado).
- [ ] **7.3 Monitor de Liquidación y Trailing Stops en Vivo** `Prioridad: Alta` `Agente: backend-fastapi-agent`
  - [ ] Monitoreo tick a tick de posiciones abiertas frente al feed de precios de Binance WS.
  - [ ] Disparo automático de Take Profit, Stop Loss y desplazamiento dinámico de Trailing Stop a Breakeven en tiempo real.
  - [ ] Registro histórico de transacciones ejecutadas en hipertabla o tabla de auditoría.
- [ ] **7.4 Panel UI de Paper Trading en la Terminal** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [ ] Pestaña o widget interactivo con posiciones abiertas en tiempo real (Unrealized PnL, precio de entrada, distancia al SL/TP).
  - [ ] Botones de cierre manual de emergencia de posiciones.
  - [ ] Curva de capital (Equity Curve) en vivo y métricas de rendimiento acumuladas.
