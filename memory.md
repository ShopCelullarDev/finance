# Memoria Técnica y Decisiones de Arquitectura (Single Source of Truth)

Este documento es el registro persistente de decisiones arquitectónicas, estándares de ingeniería, convenciones de código y contratos del sistema **Motor Predictivo de Tendencias Web (Cripto & Macro)**.

---

## 1. Registro de Decisiones de Arquitectura (ADRs)

### ADR-001: Adopción de TimescaleDB sobre PostgreSQL Estándar
- **Fecha:** 2026-10-20
- **Contexto:** Se requiere ingerir cientos de ticks por segundo de múltiples exchanges, junto con eventos de noticias y señales cuantitativas, permitiendo consultas agregadas (`time_bucket`) en milisegundos.
- **Decisión:** Utilizar **TimescaleDB** como extensión de PostgreSQL. Las tablas `market_ticks`, `news_events` y `predictive_signals` se definen como *hypertables* particionadas por tiempo.
- **Consecuencias:** Escritura masiva sin degradación de índices B-Tree estándar, compresión nativa en columnas (>60% ahorro de disco), compatibilidad total con el ecosistema SQL y herramientas de PostgreSQL.

### ADR-002: Desacoplamiento de Ingesta Asíncrona y API de Servicio
- **Fecha:** 2026-10-20
- **Contexto:** Los conectores WebSocket y scrapers no deben bloquear la respuesta HTTP ni los WebSockets de cara a los clientes del terminal.
- **Decisión:** Los procesos de ingesta se ejecutan como workers asíncronos independientes (`asyncio`). Emplean **Redis** como bus de mensajería (Pub/Sub y colas) y realizan inserciones por lotes (*batch inserts*) en TimescaleDB.
- **Consecuencias:** Si la API REST o el cliente web se reinicia, la ingesta no pierde datos ni satura las conexiones de base de datos.

### ADR-003: Almacenamiento Estructurado y Explicable en `trigger_factors` (JSONB)
- **Fecha:** 2026-10-20
- **Contexto:** Los traders y administradores necesitan entender **por qué** el modelo generó una señal específica de compra o venta.
- **Decisión:** La hipertabla `predictive_signals` incluye una columna `trigger_factors JSONB` con desglose de pesos:
  ```json
  {
    "nlp_sentiment": {"score": 0.85, "weight": 0.35, "headline": "Fed rate cut announced"},
    "smart_money_flow": {"bias": "BULLISH", "insider_ratio": 2.4, "weight": 0.30},
    "technical_indicators": {"rsi_14": 32.1, "ema_cross": "GOLDEN", "weight": 0.25},
    "macro_indicator": {"dxy_trend": "DOWN", "weight": 0.10}
  }
  ```
- **Consecuencias:** Auditoría total, explicabilidad de la IA y facilidad para backtesting granular.

### ADR-004: Frontend Dual: Terminal del Trader + Dashboard Administrativo
- **Fecha:** 2026-10-20
- **Contexto:** Los usuarios traders necesitan gráficos interactivos ultrarrápidos y señales en vivo, mientras que los administradores necesitan supervisar la salud de las 45+ fuentes de datos, latencias de red y consumo de recursos.
- **Decisión:** Una única plataforma web basada en **Next.js** con rutas claramente delimitadas:
  - `/terminal`: Terminal para análisis técnico, trading y recepción de señales en tiempo real vía WebSockets con **TradingView Lightweight Charts**.
  - `/admin`: Panel de operaciones y monitoreo de estado de fuentes, re-entrenamiento manual de modelos y métricas de hypertables.
  - `/market/[symbol]`: Páginas públicas SSR con metadata SEO y Schema.org optimizadas para Lighthouse 90+.

---

## 2. Contratos de Datos y Esquemas Verificados

### Tabla Maestra: `assets`
```sql
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,      -- Ej: BTC/USDT, ETH/USD, CL1! (Crude Oil)
    name VARCHAR(100) NOT NULL,              -- Ej: Bitcoin, Ethereum, WTI Crude
    asset_type VARCHAR(30) NOT NULL,         -- CRYPTO, COMMODITY, FOREX, INDEX, STOCK
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Hipertabla: `market_ticks`
```sql
CREATE TABLE market_ticks (
    time TIMESTAMPTZ NOT NULL,
    asset_id INT REFERENCES assets(id),
    source VARCHAR(50) NOT NULL,             -- Ej: BINANCE, KRAKEN, COINBASE
    price NUMERIC(18, 8) NOT NULL,
    volume_24h NUMERIC(24, 8),
    bid_ask_spread NUMERIC(10, 6)
);
SELECT create_hypertable('market_ticks', 'time', if_not_exists => TRUE);
CREATE INDEX ON market_ticks (asset_id, time DESC);
```

### Hipertabla: `news_events`
```sql
CREATE TABLE news_events (
    id BIGSERIAL,
    published_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(100) NOT NULL,            -- Ej: REUTERS, BLOOMBERG, FINANCIAL_JUICE
    title TEXT NOT NULL,
    url TEXT UNIQUE,
    sentiment_score NUMERIC(4, 3),           -- Rango de -1.000 a +1.000
    affected_assets VARCHAR(20)[],           -- Array de símbolos afectados: ['BTC', 'ETH']
    PRIMARY KEY (id, published_at)
);
SELECT create_hypertable('news_events', 'published_at', if_not_exists => TRUE);
```

### Hipertabla: `predictive_signals`
```sql
CREATE TABLE predictive_signals (
    id BIGSERIAL,
    generated_at TIMESTAMPTZ NOT NULL,
    asset_id INT REFERENCES assets(id),
    timeframe VARCHAR(10) NOT NULL,          -- 1m, 5m, 15m, 1h, 4h, 1d
    action_suggested VARCHAR(20) NOT NULL,   -- STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
    confidence_score NUMERIC(5, 2) NOT NULL, -- 0.00 a 100.00 %
    entry_price NUMERIC(18, 8),
    stop_loss NUMERIC(18, 8),
    take_profit NUMERIC(18, 8),
    trigger_factors JSONB NOT NULL,
    PRIMARY KEY (id, generated_at)
);
SELECT create_hypertable('predictive_signals', 'generated_at', if_not_exists => TRUE);
CREATE INDEX ON predictive_signals (asset_id, generated_at DESC);
```

---

## 3. Puertos, Redes y Servicios

| Servicio | Puerto Host | Puerto Contenedor | Protocolo | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL + TimescaleDB** | `5432` | `5432` | TCP | Base de datos principal relacional y de series de tiempo |
| **Redis** | `6379` | `6379` | TCP | Caché de ticks en caliente, colas y canal PubSub |
| **FastAPI Backend** | `8000` | `8000` | HTTP/WS | Endpoints REST `/api/v1` y WebSocket `/ws` |
| **Next.js Web / Terminal** | `3000` | `3000` | HTTP | Frontend público, terminal de trading y dashboard |

---

## 4. Convenciones de Código y Estándares

### Backend (Python)
- Versión objetivo: **Python 3.11+**.
- Tipado estricto con **Pydantic v2** y anotaciones de tipo nativas (`typing`).
- Manejo asíncrono con `async` / `await` en todos los controladores y queries de base de datos.
- Estructura modular:
  - `app/api/v1/`: Rutas REST y WebSockets.
  - `app/core/`: Configuración (`config.py`), base de datos (`database.py`), seguridad (`security.py`).
  - `app/models/`: Modelos ORM SQLAlchemy / TimescaleDB.
  - `app/schemas/`: Esquemas de validación Pydantic.
  - `app/services/`: Lógica de negocio (ingesta, conectores CCXT, motor de predicción, NLP).
  - `app/workers/`: Tareas asíncronas y listeners en background.

### Frontend (Next.js / TypeScript)
- Versión objetivo: **Next.js 14+ (App Router)**.
- Tipado estricto de TypeScript (`noImplicitAny: true`).
- Gráficos: Uso exclusivo de `@tradingview/lightweight-charts` o Canvas optimizado para no saturar el DOM con miles de elementos SVG.
- Gestión de estado: React Context ligero o Zustand para streaming de ticks sin disparar re-renderizados masivos en el árbol de componentes.
- Temas: Dark Theme institucional por defecto (fondo `#0b0e14`, acentos `#10b981` compra, `#ef4444` venta, `#3b82f6` acento institucional).

---

## 5. Gestión de Secretos y Seguridad
- Nunca commitear credenciales, API keys privadas ni contraseñas.
- Se mantendrá un archivo `.env.example` con variables documentadas y valores ficticios.
- Las variables de entorno de producción se gestionarán a través de secretos del entorno o bóvedas de credenciales.

---

## 6. Arquitectura de Memoria en 3 Capas y Skills Activas

Para optimizar la ventana de contexto de los modelos y garantizar continuidad tras caídas eléctricas o rotación de agentes:
- **Nivel 1 (Hot Memory - Inmediata):** [semilla.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/semilla.md) (<50 líneas). Contiene la última acción atómica y la instrucción exacta de reanudación.
- **Nivel 2 (Warm Memory - Operativa):** [pendiente.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/pendiente.md) y [bitacora.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/bitacora.md). Seguimiento de tareas y trazabilidad por agente/modelo.
- **Nivel 3 (Cold Memory - Arquitectura):** [contexto.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/contexto.md), [memory.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/memory.md) y [agentes.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/agentes.md). Referencia técnica de diseño.

### Catálogo de Skills Instaladas en `.agents/skills/`:
1. `project-credentials-environments`: Puertos canónicos (5432, 6379, 8000, 3000), `.env.example` y política de cero secretos.
2. `corporate-identity-ui`: Dark Theme Fintech (`#0b0e14`, `#10b981`, `#ef4444`), TradingView Lightweight Charts y modales anti-backdrop.
3. `safe-deployment-data-guard`: Respaldos transaccionales `pg_dump` con timestamp, migraciones idempotentes y protección de hypertables.
4. `agent-handoff-and-seed`: Mantenimiento de `semilla.md` para traspasos instantáneos y recuperación ante cortes de energía.
5. `context-compaction-governance`: Reglas de lectura selectiva de código y diseño agnóstico a la capacidad del modelo.

