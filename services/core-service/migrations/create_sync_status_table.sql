-- Migration: Create User Sync Status Table
-- Description: Create user_sync_status table to track user sync history and status
-- Created: 2025-01-04

-- User sync status table (for tracking sync history and status)
CREATE TABLE IF NOT EXISTS user_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    
    -- Sync status information
    last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sync_reason VARCHAR(50) NOT NULL DEFAULT 'manual',
    sync_type VARCHAR(20) NOT NULL DEFAULT 'portfolio' CHECK (sync_type IN ('portfolio', 'trades', 'full')),
    sync_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (sync_status IN ('pending', 'running', 'completed', 'failed')),
    
    -- Sync results
    tokens_count INTEGER DEFAULT 0,
    total_value_usd DECIMAL(20,2) DEFAULT 0,
    sync_duration_ms INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    error_message TEXT NULL,
    sync_metadata JSONB DEFAULT '{}',
    
    -- Constraints
    UNIQUE(user_id, wallet_address) -- One status record per user-wallet combination
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sync_status_user_id ON user_sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_wallet_address ON user_sync_status(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_last_sync_at ON user_sync_status(last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_sync_reason ON user_sync_status(sync_reason);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_sync_type ON user_sync_status(sync_type);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_sync_status ON user_sync_status(sync_status);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_created_at ON user_sync_status(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_updated_at ON user_sync_status(updated_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_sync_status_user_wallet ON user_sync_status(user_id, wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_user_last_sync ON user_sync_status(user_id, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_wallet_last_sync ON user_sync_status(wallet_address, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sync_status_reason_last_sync ON user_sync_status(sync_reason, last_sync_at DESC);

-- GIN index for JSONB metadata
CREATE INDEX IF NOT EXISTS idx_user_sync_status_metadata_gin ON user_sync_status USING GIN (sync_metadata);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_user_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sync_status_updated_at
    BEFORE UPDATE ON user_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_user_sync_status_updated_at();

-- Create helper function to get user sync status
CREATE OR REPLACE FUNCTION get_user_sync_status(p_user_id VARCHAR(255), p_wallet_address VARCHAR(255))
RETURNS TABLE (
    user_id VARCHAR(255),
    wallet_address VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_reason VARCHAR(50),
    sync_type VARCHAR(20),
    sync_status VARCHAR(20),
    tokens_count INTEGER,
    total_value_usd DECIMAL(20,2),
    sync_duration_ms INTEGER,
    minutes_since_last_sync INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uss.user_id,
        uss.wallet_address,
        uss.last_sync_at,
        uss.sync_reason,
        uss.sync_type,
        uss.sync_status,
        uss.tokens_count,
        uss.total_value_usd,
        uss.sync_duration_ms,
        EXTRACT(EPOCH FROM (NOW() - uss.last_sync_at))::INTEGER / 60 AS minutes_since_last_sync
    FROM user_sync_status uss
    WHERE uss.user_id = p_user_id AND uss.wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to update or insert sync status
CREATE OR REPLACE FUNCTION upsert_user_sync_status(
    p_user_id VARCHAR(255),
    p_wallet_address VARCHAR(255),
    p_sync_reason VARCHAR(50),
    p_sync_type VARCHAR(20) DEFAULT 'portfolio',
    p_sync_status VARCHAR(20) DEFAULT 'completed',
    p_tokens_count INTEGER DEFAULT 0,
    p_total_value_usd DECIMAL(20,2) DEFAULT 0,
    p_sync_duration_ms INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_sync_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_sync_status (
        user_id, wallet_address, last_sync_at, sync_reason, sync_type, 
        sync_status, tokens_count, total_value_usd, sync_duration_ms,
        error_message, sync_metadata
    ) VALUES (
        p_user_id, p_wallet_address, NOW(), p_sync_reason, p_sync_type,
        p_sync_status, p_tokens_count, p_total_value_usd, p_sync_duration_ms,
        p_error_message, p_sync_metadata
    )
    ON CONFLICT (user_id, wallet_address) 
    DO UPDATE SET 
        last_sync_at = NOW(),
        sync_reason = p_sync_reason,
        sync_type = p_sync_type,
        sync_status = p_sync_status,
        tokens_count = p_tokens_count,
        total_value_usd = p_total_value_usd,
        sync_duration_ms = p_sync_duration_ms,
        error_message = p_error_message,
        sync_metadata = p_sync_metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE user_sync_status IS 'Tracks the sync status and history for each user-wallet combination';
COMMENT ON COLUMN user_sync_status.user_id IS 'User identifier';
COMMENT ON COLUMN user_sync_status.wallet_address IS 'Wallet address being synced';
COMMENT ON COLUMN user_sync_status.last_sync_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN user_sync_status.sync_reason IS 'Reason for sync: manual, scheduled, triggered, etc.';
COMMENT ON COLUMN user_sync_status.sync_type IS 'Type of sync: portfolio, trades, full';
COMMENT ON COLUMN user_sync_status.sync_status IS 'Current sync status: pending, running, completed, failed';
COMMENT ON COLUMN user_sync_status.tokens_count IS 'Number of tokens synced in last sync';
COMMENT ON COLUMN user_sync_status.total_value_usd IS 'Total portfolio value in USD from last sync';
COMMENT ON COLUMN user_sync_status.sync_duration_ms IS 'Duration of last sync in milliseconds';
COMMENT ON COLUMN user_sync_status.error_message IS 'Error message if sync failed';
COMMENT ON COLUMN user_sync_status.sync_metadata IS 'Additional metadata from sync process'; 