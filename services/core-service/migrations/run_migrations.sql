-- Run all Core Service migrations in order
-- Execute this script to set up all required tables

-- 1. Create Orders and Order Executions tables
\i create_orders_tables.sql

-- 2. Create User Trades table
\i create_trades_table.sql

-- 3. Create Portfolio and Sync Management tables
\i create_portfolio_tables.sql

-- Verify all tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN (
    'orders',
    'order_executions', 
    'user_trades',
    'user_token_holdings',
    'user_token_holdings_history',
    'sync_operations'
)
ORDER BY tablename; 