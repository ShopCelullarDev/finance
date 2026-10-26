-- =============================================================================
-- 06_paper_account_type.sql
-- Libro contable SIMULATED | REAL. REAL no es una orden enviada a un exchange.
-- Idempotente: las bases ya creadas no reejecutan 05_paper_trading.sql.
-- =============================================================================

BEGIN;

ALTER TABLE paper_accounts
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'SIMULATED';

CREATE INDEX IF NOT EXISTS idx_paper_accounts_type ON paper_accounts (account_type);

COMMIT;
