-- =============================================================================
-- 01_init_hypertables.sql
-- Inicialización de extensión TimescaleDB, Catálogo de Activos e Hipertablas
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Tabla Maestra de Activos Financieros
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,      -- Ej: 'BTC/USDT', 'ETH/USDT', 'SPY', 'GLD'
    name VARCHAR(100) NOT NULL,              -- Ej: 'Bitcoin', 'Ethereum', 'Gold ETF'
    asset_type VARCHAR(30) NOT NULL,         -- 'CRYPTO', 'INDEX', 'COMMODITY', 'FOREX'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (asset_type) WHERE is_active = TRUE;

-- 2. Hipertabla de Ticks de Mercado (Alta Frecuencia)
CREATE TABLE IF NOT EXISTS market_ticks (
    time TIMESTAMPTZ NOT NULL,
    asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,             -- 'BINANCE', 'KRAKEN', 'COINBASE', etc.
    price NUMERIC(18, 8) NOT NULL,
    volume_24h NUMERIC(24, 8),
    bid_ask_spread NUMERIC(10, 6)
);

-- Particionar por tiempo: chunks diarios para streaming de alta frecuencia
SELECT create_hypertable(
    'market_ticks',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX IF NOT EXISTS idx_market_ticks_asset_time ON market_ticks (asset_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_ticks_source_time ON market_ticks (source, time DESC);

-- 3. Hipertabla de Eventos de Noticias y Sentimiento NLP
CREATE TABLE IF NOT EXISTS news_events (
    id BIGSERIAL,
    published_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(100) NOT NULL,            -- 'REUTERS', 'BLOOMBERG', 'FINANCIAL_JUICE'
    title TEXT NOT NULL,
    url TEXT,
    sentiment_score NUMERIC(4, 3),           -- Rango -1.000 a +1.000
    affected_assets VARCHAR(20)[],           -- Array: ARRAY['BTC', 'ETH']
    PRIMARY KEY (id, published_at)
);

-- Particionar por tiempo: chunks semanales
SELECT create_hypertable(
    'news_events',
    'published_at',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_news_events_time ON news_events (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_assets ON news_events USING GIN (affected_assets);

-- 4. Hipertabla de Señales Predictivas y Factores Desencadenantes
CREATE TABLE IF NOT EXISTS predictive_signals (
    id BIGSERIAL,
    generated_at TIMESTAMPTZ NOT NULL,
    asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,          -- '1m', '5m', '15m', '1h', '4h', '1d'
    action_suggested VARCHAR(20) NOT NULL,   -- 'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'
    confidence_score NUMERIC(5, 2) NOT NULL, -- 0.00 a 100.00 %
    entry_price NUMERIC(18, 8),
    stop_loss NUMERIC(18, 8),
    take_profit NUMERIC(18, 8),
    trigger_factors JSONB NOT NULL,          -- Explicabilidad de la IA
    PRIMARY KEY (id, generated_at)
);

-- Particionar por tiempo: chunks semanales
SELECT create_hypertable(
    'predictive_signals',
    'generated_at',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_signals_asset_time ON predictive_signals (asset_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_action ON predictive_signals (action_suggested, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_trigger_gin ON predictive_signals USING GIN (trigger_factors);
