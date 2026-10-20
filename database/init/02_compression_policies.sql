-- =============================================================================
-- 02_compression_policies.sql
-- Políticas de compresión columnar continua para optimización de almacenamiento
-- =============================================================================

-- 1. Compresión en market_ticks
-- Comprimir chunks con más de 7 días de antigüedad
ALTER TABLE market_ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'asset_id, source',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('market_ticks', INTERVAL '7 days', if_not_exists => TRUE);

-- 2. Compresión en news_events
-- Comprimir eventos con más de 30 días de antigüedad
ALTER TABLE news_events SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'source',
    timescaledb.compress_orderby = 'published_at DESC'
);

SELECT add_compression_policy('news_events', INTERVAL '30 days', if_not_exists => TRUE);

-- 3. Compresión en predictive_signals
-- Comprimir señales históricas con más de 30 días de antigüedad
ALTER TABLE predictive_signals SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'asset_id, timeframe',
    timescaledb.compress_orderby = 'generated_at DESC'
);

SELECT add_compression_policy('predictive_signals', INTERVAL '30 days', if_not_exists => TRUE);
