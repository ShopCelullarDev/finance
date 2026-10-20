# Matriz de Agentes y Roles del Sistema

Este documento establece los agentes especializados (roles funcionales y técnicos) que coordinan el diseño, la implementación, la auditoría y la operación del **Motor Predictivo de Tendencias Web (Cripto & Macro)**. Cada agente posee responsabilidades delimitadas, herramientas primarias y criterios de éxito.

---

## 1. Agente DBA & Arquitecto de Series Temporales (`dba-timescaledb-agent`)

- **Objetivo:** Garantizar la integridad, particionado, rendimiento de escritura masiva y velocidad de consulta en TimescaleDB y PostgreSQL.
- **Responsabilidades:**
  - Definición y mantenimiento de DDL, migraciones versionadas y scripts de seed.
  - Creación y afinamiento de hypertables (`market_ticks`, `news_events`, `predictive_signals`).
  - Configuración de `chunk_time_interval`, índices compuestos (ej. `(asset_id, time DESC)`).
  - Políticas de compresión continua en segundo plano y políticas de retención de datos históricos.
  - Asegurar la integridad referencial con la tabla `assets`.
- **Stack / Herramientas:** PostgreSQL 16, TimescaleDB, Alembic / SQLAlchemy async, `asyncpg`, SQL scripts.
- **Métrica de Éxito:** Tiempo de inserción de ticks < 5ms, compresión superior al 60% en datos > 7 días, cero bloqueos de tabla.

---

## 2. Agente de Ingesta y Web Scraping (`data-ingestion-agent`)

- **Objetivo:** Orquestar la recolección continua, tolerante a fallos y sin interrupciones de las 45+ fuentes de datos distribuidas en los 4 vectores.
- **Responsabilidades:**
  - Implementación de clientes WebSocket persistentes con reconexión automática y backoff exponencial (Binance, Kraken, Coinbase, Polymarket).
  - Integración de CCXT para normalización de pares, orderbooks y OHLCV.
  - Scrapers éticos y resilientes para flujos institucionales (Vector 2: CapitolTrades, QuiverQuant, OpenInsider).
  - Consumo de feeds de noticias y RSS (Vector 3: FinancialJuice, Reuters, Bloomberg, Jin10).
  - Parsers de reportes macro y commodities (Vector 4: EIA, CME, TradingEconomics).
  - Manejo de rate limiting, rotación de headers/proxies cuando sea necesario y buffer en Redis.
- **Stack / Herramientas:** Python `asyncio`, `aiohttp`, `websockets`, CCXT, BeautifulSoup4 / Playwright, Redis.
- **Métrica de Éxito:** Uptime de feeds > 99.8%, latencia de ingesta de ticks < 100ms, tolerancia a caídas de conexión sin pérdida de datos.

---

## 3. Agente Backend & API Gateway (`backend-fastapi-agent`)

- **Objetivo:** Desarrollar la capa de servicios REST y WebSockets asíncronos para servir datos en tiempo real al terminal y panel administrativo.
- **Responsabilidades:**
  - Estructuración modular y limpia de FastAPI (Routers, Schemas Pydantic v2, Dependencies, Services).
  - Servidor de WebSockets de alto rendimiento con canales temáticos (`ticks:{symbol}`, `signals:{timeframe}`, `news:feed`).
  - Middleware de autenticación (JWT/API Keys) para usuarios y administradores.
  - Endpoints de consulta paginada, agregaciones temporales (`time_bucket`) y estado del sistema.
  - Orquestación de workers en segundo plano y comunicación con Redis.
- **Stack / Herramientas:** FastAPI, Uvicorn, Pydantic v2, Redis PubSub, WebSockets, Docker.
- **Métrica de Éxito:** Tiempos de respuesta de endpoints REST p95 < 30ms, capacidad de atender 1,000+ conexiones WS concurrentes.

---

## 4. Agente de IA Cuantitativa & NLP (`quant-nlp-agent`)

- **Objetivo:** Transformar datos crudos en inteligencia predictiva mediante procesamiento de lenguaje natural y modelado matemático.
- **Responsabilidades:**
  - Pipeline de inferencia NLP en streaming para noticias financieras (clasificación de sentimiento con FinBERT/RoBERTa y cálculo de score [-1, +1]).
  - Mapeo de entidades nombradas (NER) para vincular noticias con activos afectados (`affected_assets`).
  - Modelos de detección de anomalías y correlación cruzada (ej. Smart Money + Variación de Ticks + Sentimiento).
  - Generación de señales estructuradas: `action_suggested` (BUY/SELL/HOLD), `confidence_score` (0-100%), cálculo dinámico de `entry_price`, `stop_loss`, `take_profit` basado en volatilidad (ATR).
  - Construcción del payload explicable `trigger_factors` (JSONB).
- **Stack / Herramientas:** PyTorch, Transformers (Hugging Face), Pandas, NumPy, scikit-learn, FinBERT.
- **Métrica de Éxito:** Inferencia NLP < 50ms por noticia, precisión de señales verificada contra backtesting, calibración estricta del `confidence_score`.

---

## 5. Agente Frontend & Terminal de Trading (`frontend-terminal-agent`)

- **Objetivo:** Proporcionar una experiencia de usuario de grado institucional, rápida, visualmente atractiva y fluida para el trader y el administrador.
- **Responsabilidades:**
  - Desarrollo de la Terminal del Trader con gráficos de velas en tiempo real usando **TradingView Lightweight Charts**.
  - Panel administrativo de telemetría: monitor de salud de las 45+ fuentes, latencias de red, tasa de eventos por segundo e hipertablas.
  - Visualización del libro de órdenes (depth chart), feed de señales en vivo con alertas sonoras/visuales opcionales y medidor de sentimiento macro.
  - Diseño ergonómico en Dark Mode con paleta de colores institucional, tokens UI consistentes y sin parpadeos por renderizado WebSocket.
- **Stack / Herramientas:** Next.js (App Router), TypeScript, TailwindCSS / CSS nativo, Lightweight Charts, Lucide Icons.
- **Métrica de Éxito:** 60 FPS estables durante streaming intensivo, cero pérdidas de memoria (memory leak free), tiempo de carga inicial < 1.2s.

---

## 6. Agente de SEO, Performance & Core Web Vitals (`seo-performance-agent`)

- **Objetivo:** Maximizar el posicionamiento orgánico en buscadores, la indexabilidad de las páginas públicas y garantizar métricas Lighthouse 90+.
- **Responsabilidades:**
  - Renderizado del lado del servidor (SSR / SSG / ISR) para páginas de resumen de mercado y fichas de activos.
  - Inyección de metadatos dinámicos, Open Graph, Twitter Cards y etiquetas Schema.org estructuradas (`FinancialProduct`, `Dataset`, `NewsArticle`).
  - Optimización de fuentes (Google Fonts preconnect/swap), minimización de CSS/JS, lazy loading de componentes pesados.
  - Asegurar el cumplimiento de Core Web Vitals: LCP < 1.5s, CLS = 0, INP < 100ms.
- **Stack / Herramientas:** Next.js SSR, Lighthouse CLI, Chrome DevTools, Web Vitals API.
- **Métrica de Éxito:** Puntuación Lighthouse >= 90 en Performance, SEO, Accesibilidad y Best Practices.

---

## 7. Agente de DevOps, Seguridad & Calidad (`devops-security-agent`)

- **Objetivo:** Mantener la reproducibilidad del entorno, seguridad de accesos y la estabilidad de los despliegues.
- **Responsabilidades:**
  - Configuración de `docker-compose.yml` para el stack completo (TimescaleDB, Redis, FastAPI, Next.js).
  - Gestión estricta de variables de entorno mediante `.env.example` y sin exposición de claves privadas ni API keys.
  - Healthchecks automatizados entre contenedores.
  - Pruebas unitarias y de integración end-to-end.
  - Procedimientos de respaldo de base de datos y planes de rollback ante fallos.
- **Stack / Herramientas:** Docker, Docker Compose, Git, Pytest, Jest, GitHub Actions / CI.
- **Métrica de Éxito:** Despliegues automatizados reproducibles en 1 comando, cero secretos en control de versiones.
