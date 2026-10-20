-- =============================================================================
-- 03_seed_assets.sql
-- Semillas iniciales del catálogo de activos monitoreados (Cripto & Macro)
-- =============================================================================

INSERT INTO assets (symbol, name, asset_type, is_active) VALUES
    -- Criptomonedas (Vector 1)
    ('BTC/USDT', 'Bitcoin / Tether', 'CRYPTO', TRUE),
    ('ETH/USDT', 'Ethereum / Tether', 'CRYPTO', TRUE),
    ('SOL/USDT', 'Solana / Tether', 'CRYPTO', TRUE),
    ('BNB/USDT', 'BNB / Tether', 'CRYPTO', TRUE),
    ('XRP/USDT', 'XRP / Tether', 'CRYPTO', TRUE),

    -- Commodities & Energía (Vector 4)
    ('GLD', 'SPDR Gold Shares', 'COMMODITY', TRUE),
    ('SLV', 'iShares Silver Trust', 'COMMODITY', TRUE),
    ('USO', 'United States Oil Fund (WTI Crude)', 'COMMODITY', TRUE),
    ('UNG', 'United States Natural Gas Fund', 'COMMODITY', TRUE),

    -- Índices Bursátiles y Volatilidad (Vector 2 y 4)
    ('SPY', 'SPDR S&P 500 ETF Trust', 'INDEX', TRUE),
    ('QQQ', 'Invesco QQQ Trust (Nasdaq 100)', 'INDEX', TRUE),
    ('IWM', 'iShares Russell 2000 ETF', 'INDEX', TRUE),
    ('VXX', 'iPath Series B S&P 500 VIX Short-Term Futures', 'INDEX', TRUE),

    -- Divisas / Índice Dólar (Macro)
    ('UUP', 'Invesco DB US Dollar Index Bullish Fund (DXY)', 'FOREX', TRUE)
ON CONFLICT (symbol) DO NOTHING;
