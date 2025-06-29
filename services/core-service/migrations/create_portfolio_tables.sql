-- Migration: Create Portfolio and Sync Management Tables
-- Description: Add portfolio holdings, sync operations, and historical tracking

-- User token holdings table (current portfolio state)
CREATE TABLE IF NOT EXISTS user_token_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Token details
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_name VARCHAR(255) NOT NULL,
    token_decimals INTEGER NOT NULL,
    
    -- Balance information
    balance TEXT NOT NULL, -- Raw balance as string to handle large numbers
    balance_formatted DECIMAL(38,18) NOT NULL, -- Human readable balance
    price_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
    value_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    
    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    alchemy_data JSONB DEFAULT '{}', -- Raw Alchemy API response
    
    -- Constraints
    UNIQUE(user_id, wallet_address, chain_id, token_address)
);

-- Create indexes for user_token_holdings table
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_user_id ON user_token_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_wallet ON user_token_holdings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_chain_id ON user_token_holdings(chain_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_token_address ON user_token_holdings(token_address);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_last_updated ON user_token_holdings(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_value_usd ON user_token_holdings(value_usd DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_user_wallet ON user_token_holdings(user_id, wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_user_chain ON user_token_holdings(user_id, chain_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_wallet_chain ON user_token_holdings(wallet_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_user_wallet_updated ON user_token_holdings(user_id, wallet_address, last_updated DESC);

-- GIN index for JSONB
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_alchemy_data_gin ON user_token_holdings USING GIN (alchemy_data);

-- User token holdings history table (for P&L calculations)
CREATE TABLE IF NOT EXISTS user_token_holdings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Token details
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_name VARCHAR(255) NOT NULL,
    token_decimals INTEGER NOT NULL,
    
    -- Balance snapshot
    balance TEXT NOT NULL,
    balance_formatted DECIMAL(38,18) NOT NULL,
    price_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
    value_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    
    -- Snapshot metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    snapshot_type VARCHAR(20) DEFAULT 'sync' CHECK (snapshot_type IN ('sync', 'manual', 'scheduled'))
);

-- Create indexes for user_token_holdings_history table
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_history_user_id ON user_token_holdings_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_history_wallet ON user_token_holdings_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_history_created_at ON user_token_holdings_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_history_user_created ON user_token_holdings_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_token_holdings_history_wallet_created ON user_token_holdings_history(wallet_address, created_at DESC);

-- Sync operations table (tracking portfolio sync status)
CREATE TABLE IF NOT EXISTS sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    
    -- Sync details
    type VARCHAR(20) NOT NULL DEFAULT 'portfolio' CHECK (type IN ('portfolio', 'trades', 'full')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    duration_ms INTEGER NULL,
    
    -- Results
    tokens_synced INTEGER DEFAULT 0,
    chains_synced INTEGER DEFAULT 0,
    total_value_usd DECIMAL(20,2) DEFAULT 0,
    
    -- Error handling
    error TEXT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, wallet_address, started_at) -- Prevent duplicate syncs at same time
);

-- Create indexes for sync_operations table
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_id ON sync_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_wallet ON sync_operations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_sync_operations_type ON sync_operations(type);
CREATE INDEX IF NOT EXISTS idx_sync_operations_priority ON sync_operations(priority);
CREATE INDEX IF NOT EXISTS idx_sync_operations_started_at ON sync_operations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_operations_completed_at ON sync_operations(completed_at DESC);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_status ON sync_operations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_started ON sync_operations(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_operations_status_priority ON sync_operations(status, priority);
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_wallet ON sync_operations(user_id, wallet_address);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_token_holdings_updated_at ON user_token_holdings;
CREATE TRIGGER update_user_token_holdings_updated_at
    BEFORE UPDATE ON user_token_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_operations_updated_at ON sync_operations;
CREATE TRIGGER update_sync_operations_updated_at
    BEFORE UPDATE ON sync_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW current_portfolio AS
SELECT 
    user_id,
    wallet_address,
    COUNT(*) as token_count,
    SUM(value_usd) as total_value_usd,
    MAX(last_updated) as last_updated,
    ARRAY_AGG(
        json_build_object(
            'tokenSymbol', token_symbol,
            'tokenName', token_name,
            'chainId', chain_id,
            'valueUSD', value_usd,
            'balanceFormatted', balance_formatted
        ) ORDER BY value_usd DESC
    ) as holdings
FROM user_token_holdings
GROUP BY user_id, wallet_address;

CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
    user_id,
    wallet_address,
    SUM(value_usd) as total_value_usd,
    COUNT(*) as token_count,
    COUNT(DISTINCT chain_id) as chain_count,
    MAX(last_updated) as last_sync,
    CASE 
        WHEN MAX(last_updated) >= NOW() - INTERVAL '5 minutes' THEN 'current'
        WHEN MAX(last_updated) >= NOW() - INTERVAL '1 hour' THEN 'recent'  
        ELSE 'stale'
    END as sync_status
FROM user_token_holdings
GROUP BY user_id, wallet_address;

CREATE OR REPLACE VIEW active_syncs AS
SELECT *
FROM sync_operations
WHERE status IN ('pending', 'running')
ORDER BY priority DESC, started_at ASC;

CREATE OR REPLACE VIEW sync_statistics AS
SELECT 
    DATE_TRUNC('day', started_at) as date,
    COUNT(*) as total_syncs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
    AVG(duration_ms) as avg_duration_ms,
    AVG(tokens_synced) as avg_tokens_synced,
    SUM(total_value_usd) as total_value_synced
FROM sync_operations
WHERE completed_at IS NOT NULL
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- Portfolio history snapshot function
CREATE OR REPLACE FUNCTION create_portfolio_snapshot(
    p_user_id VARCHAR(255),
    p_wallet_address VARCHAR(255),
    p_snapshot_type VARCHAR(20) DEFAULT 'manual'
) RETURNS INTEGER AS $$
DECLARE
    snapshot_count INTEGER := 0;
BEGIN
    -- Insert current holdings into history
    INSERT INTO user_token_holdings_history (
        user_id, wallet_address, chain_id, token_address, token_symbol,
        token_name, token_decimals, balance, balance_formatted, price_usd,
        value_usd, snapshot_type
    )
    SELECT 
        user_id, wallet_address, chain_id, token_address, token_symbol,
        token_name, token_decimals, balance, balance_formatted, price_usd,
        value_usd, p_snapshot_type
    FROM user_token_holdings
    WHERE user_id = p_user_id AND wallet_address = p_wallet_address;
    
    GET DIAGNOSTICS snapshot_count = ROW_COUNT;
    RETURN snapshot_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old history (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_portfolio_history() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    DELETE FROM user_token_holdings_history
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON user_token_holdings TO core_service_user;
-- GRANT ALL PRIVILEGES ON user_token_holdings_history TO core_service_user;  
-- GRANT ALL PRIVILEGES ON sync_operations TO core_service_user;
-- GRANT EXECUTE ON FUNCTION create_portfolio_snapshot TO core_service_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_portfolio_history TO core_service_user; 