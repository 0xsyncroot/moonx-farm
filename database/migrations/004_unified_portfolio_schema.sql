-- ============================================
-- Migration: Unified Portfolio Schema (v2.0)
-- Description: Consolidated and improved portfolio management system
-- Version: 004
-- Author: MoonX Farm Team
-- Date: 2025-01-06
-- ============================================

-- This migration combines and improves:
-- 1. Core Service portfolio tables
-- 2. Sync Worker requirements  
-- 3. User sync status tracking
-- 4. Historical data and analytics

-- ============================================
-- 0. CLEAN UP EXISTING TABLES
-- ============================================

-- Drop existing tables and dependencies (no data loss concern)
DROP TABLE IF EXISTS user_token_holdings_history CASCADE;
DROP TABLE IF EXISTS user_sync_status CASCADE;
DROP TABLE IF EXISTS sync_operations CASCADE;
DROP TABLE IF EXISTS user_token_holdings CASCADE;

-- Drop existing functions that might conflict
DROP FUNCTION IF EXISTS update_user_sync_status_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_user_sync_status(VARCHAR(255), VARCHAR(255)) CASCADE;
DROP FUNCTION IF EXISTS upsert_user_sync_status(VARCHAR(255), VARCHAR(255), VARCHAR(50), VARCHAR(20), VARCHAR(20), INTEGER, DECIMAL(20,2), INTEGER, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop existing views
DROP VIEW IF EXISTS current_portfolio CASCADE;
DROP VIEW IF EXISTS active_sync_operations CASCADE;
DROP VIEW IF EXISTS sync_statistics_daily CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Existing tables and dependencies dropped - starting fresh with unified schema';
END $$;

-- ============================================
-- 1. CORE PORTFOLIO TABLES
-- ============================================

-- Main portfolio holdings table (current state)
CREATE TABLE user_token_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Token identification
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_name VARCHAR(255) NOT NULL,
    token_decimals INTEGER NOT NULL DEFAULT 18,
    
    -- Balance and pricing
    balance TEXT NOT NULL, -- Raw balance as hex string
    balance_formatted DECIMAL(38,18) NOT NULL, -- Human readable balance
    price_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
    value_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    
    -- Metadata and flags
    logo_url TEXT,
    is_spam BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Raw API data
    alchemy_data JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, wallet_address, chain_id, token_address)
);

-- Historical portfolio snapshots (for P&L and analytics)
CREATE TABLE user_token_holdings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Token identification
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_name VARCHAR(255) NOT NULL,
    token_decimals INTEGER NOT NULL DEFAULT 18,
    
    -- Snapshot data
    balance TEXT NOT NULL,
    balance_formatted DECIMAL(38,18) NOT NULL,
    price_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
    value_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    
    -- Snapshot metadata
    snapshot_type VARCHAR(20) DEFAULT 'auto' CHECK (snapshot_type IN ('auto', 'manual', 'scheduled', 'sync')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Reference to sync operation
    sync_operation_id UUID
);

-- Sync operations tracking (enhanced version)
CREATE TABLE sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    
    -- Operation details
    type VARCHAR(20) NOT NULL DEFAULT 'portfolio' CHECK (type IN ('portfolio', 'trades', 'metadata', 'full')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Results
    tokens_synced INTEGER DEFAULT 0,
    chains_synced INTEGER DEFAULT 0,
    total_value_usd DECIMAL(20,2) DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Worker information
    worker_id VARCHAR(255),
    worker_version VARCHAR(50),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, wallet_address, started_at) -- Prevent duplicate syncs
);

-- User sync status (latest sync state per user/wallet)
CREATE TABLE user_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    
    -- Latest sync information
    last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_sync_operation_id UUID,
    sync_reason VARCHAR(50) NOT NULL DEFAULT 'manual',
    sync_type VARCHAR(20) NOT NULL DEFAULT 'portfolio',
    sync_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    
    -- Latest sync results
    tokens_count INTEGER DEFAULT 0,
    chains_count INTEGER DEFAULT 0,
    total_value_usd DECIMAL(20,2) DEFAULT 0,
    sync_duration_ms INTEGER DEFAULT 0,
    
    -- Sync statistics
    total_syncs INTEGER DEFAULT 1,
    successful_syncs INTEGER DEFAULT 1,
    failed_syncs INTEGER DEFAULT 0,
    avg_sync_duration_ms INTEGER DEFAULT 0,
    
    -- Status flags
    is_sync_enabled BOOLEAN DEFAULT true,
    auto_sync_interval_minutes INTEGER DEFAULT 15,
    
    -- Error tracking
    last_error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, wallet_address)
);

-- Add foreign key constraints after all tables are created
ALTER TABLE user_token_holdings_history 
ADD CONSTRAINT fk_history_sync_operation 
FOREIGN KEY (sync_operation_id) REFERENCES sync_operations(id) ON DELETE SET NULL;

ALTER TABLE user_sync_status 
ADD CONSTRAINT fk_sync_status_operation 
FOREIGN KEY (last_sync_operation_id) REFERENCES sync_operations(id) ON DELETE SET NULL;

-- ============================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================

-- user_token_holdings indexes
CREATE INDEX idx_user_token_holdings_user_id ON user_token_holdings(user_id);
CREATE INDEX idx_user_token_holdings_wallet ON user_token_holdings(wallet_address);
CREATE INDEX idx_user_token_holdings_chain_id ON user_token_holdings(chain_id);
CREATE INDEX idx_user_token_holdings_token_address ON user_token_holdings(token_address);
CREATE INDEX idx_user_token_holdings_last_updated ON user_token_holdings(last_updated DESC);
CREATE INDEX idx_user_token_holdings_value_usd ON user_token_holdings(value_usd DESC);
CREATE INDEX idx_user_token_holdings_is_spam ON user_token_holdings(is_spam) WHERE is_spam = false;
CREATE INDEX idx_user_token_holdings_is_verified ON user_token_holdings(is_verified) WHERE is_verified = true;

-- Composite indexes for common queries
CREATE INDEX idx_user_token_holdings_user_wallet ON user_token_holdings(user_id, wallet_address);
CREATE INDEX idx_user_token_holdings_user_chain ON user_token_holdings(user_id, chain_id);
CREATE INDEX idx_user_token_holdings_wallet_chain ON user_token_holdings(wallet_address, chain_id);
CREATE INDEX idx_user_token_holdings_user_wallet_updated ON user_token_holdings(user_id, wallet_address, last_updated DESC);

-- GIN index for JSONB
CREATE INDEX idx_user_token_holdings_alchemy_data_gin ON user_token_holdings USING GIN (alchemy_data);

-- user_token_holdings_history indexes
CREATE INDEX idx_user_token_holdings_history_user_id ON user_token_holdings_history(user_id);
CREATE INDEX idx_user_token_holdings_history_wallet ON user_token_holdings_history(wallet_address);
CREATE INDEX idx_user_token_holdings_history_created_at ON user_token_holdings_history(created_at DESC);
CREATE INDEX idx_user_token_holdings_history_sync_op ON user_token_holdings_history(sync_operation_id);
CREATE INDEX idx_user_token_holdings_history_user_created ON user_token_holdings_history(user_id, created_at DESC);
CREATE INDEX idx_user_token_holdings_history_wallet_created ON user_token_holdings_history(wallet_address, created_at DESC);

-- sync_operations indexes
CREATE INDEX idx_sync_operations_user_id ON sync_operations(user_id);
CREATE INDEX idx_sync_operations_wallet ON sync_operations(wallet_address);
CREATE INDEX idx_sync_operations_status ON sync_operations(status);
CREATE INDEX idx_sync_operations_type ON sync_operations(type);
CREATE INDEX idx_sync_operations_priority ON sync_operations(priority);
CREATE INDEX idx_sync_operations_started_at ON sync_operations(started_at DESC);
CREATE INDEX idx_sync_operations_completed_at ON sync_operations(completed_at DESC);
CREATE INDEX idx_sync_operations_worker_id ON sync_operations(worker_id);

-- Composite indexes for sync operations
CREATE INDEX idx_sync_operations_user_status ON sync_operations(user_id, status);
CREATE INDEX idx_sync_operations_user_started ON sync_operations(user_id, started_at DESC);
CREATE INDEX idx_sync_operations_status_priority ON sync_operations(status, priority);
CREATE INDEX idx_sync_operations_user_wallet ON sync_operations(user_id, wallet_address);
CREATE INDEX idx_sync_operations_active ON sync_operations(status, priority, started_at) WHERE status IN ('pending', 'running');

-- user_sync_status indexes
CREATE INDEX idx_user_sync_status_user_id ON user_sync_status(user_id);
CREATE INDEX idx_user_sync_status_wallet_address ON user_sync_status(wallet_address);
CREATE INDEX idx_user_sync_status_last_sync_at ON user_sync_status(last_sync_at DESC);
CREATE INDEX idx_user_sync_status_sync_reason ON user_sync_status(sync_reason);
CREATE INDEX idx_user_sync_status_sync_status ON user_sync_status(sync_status);
CREATE INDEX idx_user_sync_status_is_sync_enabled ON user_sync_status(is_sync_enabled) WHERE is_sync_enabled = true;
CREATE INDEX idx_user_sync_status_consecutive_failures ON user_sync_status(consecutive_failures) WHERE consecutive_failures > 0;

-- ============================================
-- 3. TRIGGERS AND FUNCTIONS
-- ============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_token_holdings_updated_at
    BEFORE UPDATE ON user_token_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_operations_updated_at
    BEFORE UPDATE ON sync_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sync_status_updated_at
    BEFORE UPDATE ON user_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update sync status when sync operation completes
CREATE OR REPLACE FUNCTION update_sync_status_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if sync operation is completed or failed
    IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
        INSERT INTO user_sync_status (
            user_id, wallet_address, last_sync_at, last_sync_operation_id,
            sync_reason, sync_type, sync_status, tokens_count, chains_count,
            total_value_usd, sync_duration_ms, total_syncs, successful_syncs,
            failed_syncs, consecutive_failures, last_error_message, last_error_at
        ) VALUES (
            NEW.user_id, NEW.wallet_address, COALESCE(NEW.completed_at, NEW.updated_at),
            NEW.id, 'auto', NEW.type, NEW.status, NEW.tokens_synced, NEW.chains_synced,
            NEW.total_value_usd, NEW.duration_ms, 1, 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
            NEW.error_message, 
            CASE WHEN NEW.status = 'failed' THEN NEW.updated_at ELSE NULL END
        )
        ON CONFLICT (user_id, wallet_address) DO UPDATE SET
            last_sync_at = COALESCE(NEW.completed_at, NEW.updated_at),
            last_sync_operation_id = NEW.id,
            sync_reason = 'auto',
            sync_type = NEW.type,
            sync_status = NEW.status,
            tokens_count = NEW.tokens_synced,
            chains_count = NEW.chains_synced,
            total_value_usd = NEW.total_value_usd,
            sync_duration_ms = NEW.duration_ms,
            total_syncs = user_sync_status.total_syncs + 1,
            successful_syncs = user_sync_status.successful_syncs + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
            failed_syncs = user_sync_status.failed_syncs + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
            avg_sync_duration_ms = (user_sync_status.avg_sync_duration_ms * user_sync_status.total_syncs + COALESCE(NEW.duration_ms, 0)) / (user_sync_status.total_syncs + 1),
            consecutive_failures = CASE WHEN NEW.status = 'completed' THEN 0 ELSE user_sync_status.consecutive_failures + 1 END,
            last_error_message = CASE WHEN NEW.status = 'failed' THEN NEW.error_message ELSE NULL END,
            last_error_at = CASE WHEN NEW.status = 'failed' THEN NEW.updated_at ELSE user_sync_status.last_error_at END,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sync_status_on_completion
    AFTER UPDATE ON sync_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_status_on_completion();

-- ============================================
-- 4. VIEWS FOR COMMON QUERIES
-- ============================================

-- Current portfolio summary
CREATE VIEW current_portfolio AS
SELECT 
    user_id,
    wallet_address,
    COUNT(*) as token_count,
    COUNT(DISTINCT chain_id) as chain_count,
    SUM(value_usd) as total_value_usd,
    MAX(last_updated) as last_updated,
    ARRAY_AGG(
        json_build_object(
            'id', id,
            'tokenSymbol', token_symbol,
            'tokenName', token_name,
            'chainId', chain_id,
            'tokenAddress', token_address,
            'valueUSD', value_usd,
            'balanceFormatted', balance_formatted,
            'priceUSD', price_usd,
            'logoUrl', logo_url,
            'isSpam', is_spam,
            'isVerified', is_verified,
            'lastUpdated', last_updated
        ) ORDER BY value_usd DESC
    ) as holdings,
    CASE 
        WHEN MAX(last_updated) >= NOW() - INTERVAL '5 minutes' THEN 'current'
        WHEN MAX(last_updated) >= NOW() - INTERVAL '1 hour' THEN 'recent'  
        ELSE 'stale'
    END as sync_status
FROM user_token_holdings
WHERE is_spam = false
GROUP BY user_id, wallet_address;

-- Active sync operations
CREATE VIEW active_sync_operations AS
SELECT 
    so.*,
    EXTRACT(EPOCH FROM (NOW() - so.started_at))::INTEGER as duration_seconds,
    uss.auto_sync_interval_minutes,
    uss.consecutive_failures
FROM sync_operations so
LEFT JOIN user_sync_status uss ON so.user_id = uss.user_id AND so.wallet_address = uss.wallet_address
WHERE so.status IN ('pending', 'running')
ORDER BY so.priority DESC, so.started_at ASC;

-- Sync statistics by day
CREATE VIEW sync_statistics_daily AS
SELECT 
    DATE_TRUNC('day', started_at) as date,
    COUNT(*) as total_syncs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
    AVG(duration_ms) as avg_duration_ms,
    AVG(tokens_synced) as avg_tokens_synced,
    SUM(total_value_usd) as total_value_synced,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT wallet_address) as unique_wallets
FROM sync_operations
WHERE completed_at IS NOT NULL
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- ============================================
-- 5. UTILITY FUNCTIONS
-- ============================================

-- Create portfolio snapshot
CREATE OR REPLACE FUNCTION create_portfolio_snapshot(
    p_user_id VARCHAR(255),
    p_wallet_address VARCHAR(255),
    p_snapshot_type VARCHAR(20) DEFAULT 'manual',
    p_sync_operation_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    snapshot_count INTEGER := 0;
BEGIN
    -- Insert current holdings into history
    INSERT INTO user_token_holdings_history (
        user_id, wallet_address, chain_id, token_address, token_symbol,
        token_name, token_decimals, balance, balance_formatted, price_usd,
        value_usd, snapshot_type, sync_operation_id
    )
    SELECT 
        user_id, wallet_address, chain_id, token_address, token_symbol,
        token_name, token_decimals, balance, balance_formatted, price_usd,
        value_usd, p_snapshot_type, p_sync_operation_id
    FROM user_token_holdings
    WHERE user_id = p_user_id AND wallet_address = p_wallet_address;
    
    GET DIAGNOSTICS snapshot_count = ROW_COUNT;
    RETURN snapshot_count;
END;
$$ LANGUAGE plpgsql;

-- Get sync status for user
CREATE OR REPLACE FUNCTION get_user_sync_status(
    p_user_id VARCHAR(255), 
    p_wallet_address VARCHAR(255)
) RETURNS TABLE (
    user_id VARCHAR(255),
    wallet_address VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20),
    tokens_count INTEGER,
    total_value_usd DECIMAL(20,2),
    minutes_since_last_sync INTEGER,
    consecutive_failures INTEGER,
    is_sync_enabled BOOLEAN,
    auto_sync_interval_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uss.user_id,
        uss.wallet_address,
        uss.last_sync_at,
        uss.sync_status,
        uss.tokens_count,
        uss.total_value_usd,
        EXTRACT(EPOCH FROM (NOW() - uss.last_sync_at))::INTEGER / 60 AS minutes_since_last_sync,
        uss.consecutive_failures,
        uss.is_sync_enabled,
        uss.auto_sync_interval_minutes
    FROM user_sync_status uss
    WHERE uss.user_id = p_user_id AND uss.wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_portfolio_data(
    p_history_days INTEGER DEFAULT 90,
    p_sync_operations_days INTEGER DEFAULT 30
) RETURNS TABLE (
    history_deleted INTEGER,
    sync_operations_deleted INTEGER
) AS $$
DECLARE
    hist_count INTEGER := 0;
    sync_count INTEGER := 0;
BEGIN
    -- Delete old history snapshots
    DELETE FROM user_token_holdings_history
    WHERE created_at < NOW() - INTERVAL '1 day' * p_history_days;
    GET DIAGNOSTICS hist_count = ROW_COUNT;
    
    -- Delete old completed sync operations
    DELETE FROM sync_operations
    WHERE completed_at < NOW() - INTERVAL '1 day' * p_sync_operations_days
      AND status IN ('completed', 'failed', 'cancelled');
    GET DIAGNOSTICS sync_count = ROW_COUNT;
    
    RETURN QUERY SELECT hist_count, sync_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON TABLE user_token_holdings IS 'Current portfolio holdings for each user/wallet combination';
COMMENT ON TABLE user_token_holdings_history IS 'Historical snapshots of portfolio holdings for analytics and P&L calculation';
COMMENT ON TABLE sync_operations IS 'Tracks all portfolio sync operations with detailed status and results';
COMMENT ON TABLE user_sync_status IS 'Latest sync status and statistics for each user/wallet combination';

COMMENT ON COLUMN user_token_holdings.balance IS 'Raw token balance as hex string from blockchain';
COMMENT ON COLUMN user_token_holdings.balance_formatted IS 'Human-readable balance converted using token decimals';
COMMENT ON COLUMN user_token_holdings.alchemy_data IS 'Raw metadata from Alchemy API response';
COMMENT ON COLUMN user_token_holdings.is_verified IS 'Whether token contract is verified';

COMMENT ON COLUMN sync_operations.worker_id IS 'Identifier of the sync worker that processed this operation';
COMMENT ON COLUMN sync_operations.worker_version IS 'Version of the sync worker software';
COMMENT ON COLUMN sync_operations.duration_ms IS 'Total sync operation duration in milliseconds';

COMMENT ON COLUMN user_sync_status.consecutive_failures IS 'Number of consecutive sync failures (resets on success)';
COMMENT ON COLUMN user_sync_status.auto_sync_interval_minutes IS 'Auto-sync interval in minutes for this user/wallet';
COMMENT ON COLUMN user_sync_status.is_sync_enabled IS 'Whether automatic sync is enabled for this user/wallet';

-- ============================================
-- 7. FINAL VALIDATION
-- ============================================

-- Run validation to ensure all tables and indexes are created
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    view_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('user_token_holdings', 'user_token_holdings_history', 'sync_operations', 'user_sync_status');
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';
    
    -- Count views
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name IN ('current_portfolio', 'active_sync_operations', 'sync_statistics_daily');
    
    -- Count functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('create_portfolio_snapshot', 'get_user_sync_status', 'cleanup_old_portfolio_data');
    
    RAISE NOTICE 'Migration completed: % tables, % indexes, % views, % functions created', 
                 table_count, index_count, view_count, function_count;
    
    RAISE NOTICE 'Unified portfolio schema migration completed successfully!';
    RAISE NOTICE 'All tables recreated with new unified structure.';
END $$;

-- ============================================
-- Migration completed successfully
-- ============================================ 