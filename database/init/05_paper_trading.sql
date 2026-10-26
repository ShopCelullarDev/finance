-- =============================================================================
-- 05_paper_trading.sql
-- Tablas e Hipertablas para el Sistema de Paper Trading y Gestión de Cartera Simulada
-- =============================================================================

BEGIN;

-- 1. Tabla de Cuentas / Carteras de Paper Trading
CREATE TABLE IF NOT EXISTS paper_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(50) NOT NULL DEFAULT 'Cuenta Principal Paper Trading',
    initial_balance NUMERIC(18, 4) NOT NULL DEFAULT 10000.0000,
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 10000.0000, -- Efectivo libre disponible (cash)
    allocated_margin NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,    -- Margen comprometido en posiciones abiertas
    realized_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,        -- Ganancia / Pérdida neta acumulada cerrada
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    losing_trades INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    account_type VARCHAR(20) NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_accounts_user ON paper_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_paper_accounts_type ON paper_accounts (account_type);

-- 2. Tabla de Posiciones y Órdenes Simuladas (Open & Closed Trades)
CREATE TABLE IF NOT EXISTS paper_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
    asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,                                -- Denormalizado: 'BTC/USDT'
    side VARCHAR(10) NOT NULL,                                  -- 'BUY' (Long) o 'SELL' (Short)
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',                 -- 'OPEN', 'CLOSED', 'CANCELLED'
    size NUMERIC(18, 8) NOT NULL,                               -- Cantidad del activo base (ej: 0.12500000 BTC)
    entry_price NUMERIC(18, 8) NOT NULL,                        -- Precio de ejecución de entrada
    current_price NUMERIC(18, 8) NOT NULL,                      -- Último precio de mercado registrado
    exit_price NUMERIC(18, 8),                                  -- Precio de ejecución de salida
    stop_loss NUMERIC(18, 8),                                   -- Precio Stop Loss
    take_profit NUMERIC(18, 8),                                 -- Precio Take Profit
    trailing_stop_active BOOLEAN NOT NULL DEFAULT FALSE,        -- Indica si el trailing stop se activó
    trailing_stop_price NUMERIC(18, 8),                         -- Nivel actual del trailing stop
    margin_used NUMERIC(18, 4) NOT NULL,                        -- Margen asignado en USDT (size * entry_price)
    unrealized_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,      -- PnL flotante
    realized_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,        -- PnL neto al cerrar (deduciendo fees)
    return_pct NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,           -- Rendimiento porcentual del trade
    entry_fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,           -- Comisión taker de entrada
    exit_fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,            -- Comisión taker de salida
    slippage_incurred NUMERIC(18, 8) NOT NULL DEFAULT 0.0000,   -- Deslizamiento de precio asumido
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    close_reason VARCHAR(50),                                   -- 'TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'MANUAL_EXIT', 'SIGNAL_REVERSAL'
    signal_id BIGINT,                                           -- Referencia a predictive_signals(id) si proviene de IA
    metadata JSONB                                              -- Factores desencadenantes, scores ML, etc.
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_account_status ON paper_positions (account_id, status);
CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol_status ON paper_positions (symbol, status);
CREATE INDEX IF NOT EXISTS idx_paper_positions_opened_at ON paper_positions (opened_at DESC);

-- 3. Hipertabla de Instantáneas de Capital (Equity Curve Tracking)
CREATE TABLE IF NOT EXISTS paper_equity_snapshots (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_id UUID NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
    total_equity NUMERIC(18, 4) NOT NULL,                       -- balance + margin + unrealized_pnl
    cash_balance NUMERIC(18, 4) NOT NULL,                       -- Efectivo líquido libre
    allocated_margin NUMERIC(18, 4) NOT NULL,                   -- Margen en uso
    unrealized_pnl NUMERIC(18, 4) NOT NULL,                     -- PnL flotante agregado
    realized_pnl NUMERIC(18, 4) NOT NULL,                       -- PnL acumulado
    open_positions_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, time)
);

COMMIT;

-- Particionar por tiempo: chunks semanales en TimescaleDB (fuera de transacción)
SELECT create_hypertable(
    'paper_equity_snapshots',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_paper_equity_account_time ON paper_equity_snapshots (account_id, time DESC);

-- 4. Semilla inicial: Cuenta Maestra de Paper Trading por defecto ($10,000 USDT)
INSERT INTO paper_accounts (id, name, initial_balance, current_balance, allocated_margin, realized_pnl)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Cartera Institucional Alpha (Simulada)',
    10000.0000,
    10000.0000,
    0.0000,
    0.0000
)
ON CONFLICT (id) DO NOTHING;

-- Registro de snapshot de inicio
INSERT INTO paper_equity_snapshots (time, account_id, total_equity, cash_balance, allocated_margin, unrealized_pnl, realized_pnl, open_positions_count)
VALUES (
    NOW(),
    '00000000-0000-0000-0000-000000000001',
    10000.0000,
    10000.0000,
    0.0000,
    0.0000,
    0.0000,
    0
)
ON CONFLICT DO NOTHING;
