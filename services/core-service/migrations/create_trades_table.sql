-- Migration: Create User Trades Table
-- Description: Add comprehensive trade tracking with all necessary fields for production

-- User trades table
CREATE TABLE IF NOT EXISTS user_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL UNIQUE,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Trade classification
    trade_type VARCHAR(20) NOT NULL DEFAULT 'swap' CHECK (trade_type IN ('swap', 'limit_order', 'dca', 'bridge')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    
    -- Token information (stored as JSONB for flexibility)
    from_token JSONB NOT NULL, -- {address, symbol, name, decimals, amount, amountFormatted, priceUSD, valueUSD}
    to_token JSONB NOT NULL,   -- {address, symbol, name, decimals, amount, amountFormatted, priceUSD, valueUSD}
    
    -- Financial details
    gas_fee_eth DECIMAL(20,8) NOT NULL DEFAULT 0,
    gas_fee_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    protocol_fee_usd DECIMAL(20,2) NULL,
    slippage DECIMAL(8,4) NULL, -- Percentage, e.g., 1.5 for 1.5%
    price_impact DECIMAL(8,4) NULL, -- Percentage
    
    -- DEX/Protocol information
    dex_name VARCHAR(100) NULL,
    router_address VARCHAR(255) NULL,
    aggregator VARCHAR(20) NULL CHECK (aggregator IS NULL OR aggregator IN ('lifi', '1inch', 'relay', 'jupiter')),
    
    -- P&L tracking (stored as JSONB for flexibility)
    pnl JSONB NULL, -- {realizedPnlUSD, unrealizedPnlUSD?, feesPaidUSD, netPnlUSD}
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_user_trades_user_id (user_id),
    INDEX idx_user_trades_wallet_address (wallet_address),
    INDEX idx_user_trades_timestamp (timestamp),
    INDEX idx_user_trades_chain_id (chain_id),
    INDEX idx_user_trades_status (status),
    INDEX idx_user_trades_trade_type (trade_type),
    INDEX idx_user_trades_dex_name (dex_name),
    INDEX idx_user_trades_aggregator (aggregator),
    
    -- Composite indexes for common queries
    INDEX idx_user_trades_user_timestamp (user_id, timestamp DESC),
    INDEX idx_user_trades_user_chain (user_id, chain_id),
    INDEX idx_user_trades_user_status (user_id, status),
    INDEX idx_user_trades_wallet_timestamp (wallet_address, timestamp DESC),
    INDEX idx_user_trades_chain_timestamp (chain_id, timestamp DESC),
    
    -- GIN index for JSONB fields (for filtering by token data)
    INDEX idx_user_trades_from_token_gin USING GIN (from_token),
    INDEX idx_user_trades_to_token_gin USING GIN (to_token),
    INDEX idx_user_trades_pnl_gin USING GIN (pnl)
);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_trades table
DROP TRIGGER IF EXISTS update_user_trades_updated_at ON user_trades;
CREATE TRIGGER update_user_trades_updated_at
    BEFORE UPDATE ON user_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW recent_trades AS
SELECT *
FROM user_trades
WHERE timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW successful_trades AS
SELECT *
FROM user_trades
WHERE status = 'completed'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW failed_trades AS
SELECT *
FROM user_trades
WHERE status = 'failed'
ORDER BY timestamp DESC;

-- Create view for trade analytics
CREATE OR REPLACE VIEW trade_analytics AS
SELECT 
    user_id,
    wallet_address,
    chain_id,
    COUNT(*) as trade_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_trades,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_trades,
    SUM(gas_fee_usd) as total_gas_fees_usd,
    SUM(CASE WHEN protocol_fee_usd IS NOT NULL THEN protocol_fee_usd ELSE 0 END) as total_protocol_fees_usd,
    AVG(slippage) as avg_slippage,
    AVG(price_impact) as avg_price_impact,
    MIN(timestamp) as first_trade,
    MAX(timestamp) as last_trade
FROM user_trades
WHERE status = 'completed'
GROUP BY user_id, wallet_address, chain_id;

-- Insert sample data for testing (commented out for production)
/*
INSERT INTO user_trades (
    user_id, wallet_address, tx_hash, chain_id, block_number, timestamp,
    trade_type, status, from_token, to_token, gas_fee_eth, gas_fee_usd,
    protocol_fee_usd, slippage, price_impact, dex_name, router_address, aggregator
) VALUES (
    'test_user_123',
    '0x742d35Cc6934C0532925a3b8D67Cf8b789C2f8B6',
    '0x1234567890abcdef1234567890abcdef12345678901234567890abcdef123456',
    1, -- Ethereum
    18500000,
    NOW() - INTERVAL '1 hour',
    'swap',
    'completed',
    '{"address": "0xA0b86a33E6B7cB2CCFE06e0ec7b8Dd64f77b2A38", "symbol": "USDC", "name": "USD Coin", "decimals": 6, "amount": "1000000000", "amountFormatted": 1000, "priceUSD": 1.0, "valueUSD": 1000}',
    '{"address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "symbol": "WETH", "name": "Wrapped Ether", "decimals": 18, "amount": "500000000000000000", "amountFormatted": 0.5, "priceUSD": 2000, "valueUSD": 1000}',
    0.005,
    10.0,
    2.5,
    1.2,
    0.8,
    'Uniswap V3',
    '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    '1inch'
);
*/

-- Partitioning setup for large-scale production (optional)
-- This creates monthly partitions to improve query performance
/*
-- Enable partitioning extension
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Convert to partitioned table (run this after initial data if needed)
SELECT partman.create_parent(
    'public.user_trades',
    'timestamp',
    'range',
    'monthly'
);

-- Set retention policy (keep 2 years of data)
UPDATE partman.part_config 
SET retention = '24 months',
    retention_keep_table = false
WHERE parent_table = 'public.user_trades';
*/

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON user_trades TO core_service_user;
-- GRANT USAGE ON SEQUENCE user_trades_id_seq TO core_service_user;

-- Performance monitoring queries (for production monitoring)
/*
-- Check table size and statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'user_trades';

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'user_trades'
ORDER BY idx_scan DESC;

-- Check query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%user_trades%'
ORDER BY total_time DESC;
*/ 