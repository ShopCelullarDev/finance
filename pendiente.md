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

- [ ] **3.1 Monitor de Salud de Fuentes (Telemetry)** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [ ] Matriz de estado en vivo para las 45+ fuentes de datos (Online / Latencia ms / Errores).
  - [ ] Alertas visuales ante desconexión de sockets de exchanges.
- [ ] **3.2 Visor de Rendimiento de Hypertables** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [ ] Panel con volumen de ticks ingeridos por segundo y tamaño de chunks en disco.
  - [ ] Estado de compresión y uso de memoria de TimescaleDB y Redis.
- [ ] **3.3 Consola de Control de Señales e IA** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [ ] Registro histórico de señales generadas con detalle de `trigger_factors`.
  - [ ] Botón de disparo manual o recalibración de umbrales de confianza.
- [ ] **3.4 Gestión de Configuración y Claves API** `Prioridad: Baja` `Agente: frontend-terminal-agent`
  - [ ] Panel para activar/desactivar pares de activos o fuentes específicas.
  - [ ] Configuración segura de endpoints y tokens.

---

## Fase 4: Frontend y Terminal del Trader

- [ ] **4.1 Base de Frontend y Diseño Institucional** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [ ] Configuración de Next.js (TypeScript, TailwindCSS, Dark Theme ergonómico).
  - [ ] Sistema de layout adaptable para pantallas de trading multi-monitor y laptops.
- [ ] **4.2 Integración de Gráficos Interactivos** `Prioridad: Alta` `Agente: frontend-terminal-agent`
  - [ ] Integración de TradingView Lightweight Charts con velas japonesas en tiempo real.
  - [ ] Soporte para timeframes (1m, 5m, 15m, 1h, 4h, 1d).
  - [ ] Capa de visualización de señales predictivas sobre el gráfico (flechas de entrada, líneas de SL/TP).
- [ ] **4.3 Orderbook, Depth Chart y Feed en Tiempo Real** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [ ] Widget de libro de órdenes simplificado o spread de mercado.
  - [ ] Feed en vivo de señales predictivas con filtrado por activo y nivel de confianza.
  - [ ] Ticker tape con precios y variaciones porcentuales 24h.
- [ ] **4.4 Panel de Sentimiento Macro y Correlaciones** `Prioridad: Media` `Agente: frontend-terminal-agent`
  - [ ] Medidor tipo "Gauge" del sentimiento global del mercado (Fear & Greed / NLP Sentiment).
  - [ ] Tabla de correlaciones entre Cripto (BTC) y Macro (DXY, Petróleo, Oro, SP500).

---

## Fase 5: Optimización SEO, SSR y Core Web Vitals (Lighthouse 90+)

- [ ] **5.1 Arquitectura SSR/SSG en Next.js** `Prioridad: Alta` `Agente: seo-performance-agent`
  - [ ] Páginas públicas de activos `/market/[symbol]` renderizadas en el servidor para indexación inmediata.
  - [ ] Generación estática incremental (ISR) para actualizar precios y métricas clave periódicamente.
- [ ] **5.2 Marcado Semántico y Schema.org JSON-LD** `Prioridad: Alta` `Agente: seo-performance-agent`
  - [ ] Inyección de esquemas JSON-LD (`FinancialProduct`, `Dataset`, `NewsArticle`).
  - [ ] Metadatos dinámicos Open Graph y Twitter Cards generados con imagen de cotización.
- [ ] **5.3 Auditoría de Rendimiento y Core Web Vitals** `Prioridad: Alta` `Agente: seo-performance-agent`
  - [ ] Optimización de Largest Contentful Paint (LCP < 1.5s) con lazy loading y prefetch selectivo.
  - [ ] Eliminación de Cumulative Layout Shift (CLS = 0) reservando dimensiones en gráficos.
  - [ ] Optimización de interacción (INP < 100ms) evitando bloqueos en el hilo principal con Web Workers si aplica.
  - [ ] Verificación de reporte Lighthouse >= 90 en todos los rubros.
