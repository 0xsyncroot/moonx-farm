-- Migration: Create Orders and Order Executions Tables
-- Description: Add order management capabilities for limit and DCA orders

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('LIMIT', 'DCA')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED')),
    
    -- Token details
    from_token VARCHAR(255) NOT NULL,
    to_token VARCHAR(255) NOT NULL,
    from_chain INTEGER NOT NULL,
    to_chain INTEGER NOT NULL,
    
    -- Order parameters
    input_amount TEXT NOT NULL, -- Using TEXT to handle large numbers
    target_price TEXT NULL, -- For limit orders
    frequency INTEGER NULL, -- For DCA orders (in hours)
    execution_count INTEGER DEFAULT 0, -- For DCA orders
    max_executions INTEGER NULL, -- For DCA orders
    
    -- Execution details
    executed_amount TEXT DEFAULT '0',
    received_amount TEXT DEFAULT '0',
    average_price TEXT DEFAULT '0',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    last_executed_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Blockchain details
    transaction_hash VARCHAR(255) NULL,
    contract_address VARCHAR(255) NULL,
    
    -- Metadata
    slippage DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    gas_price TEXT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    UNIQUE(user_id, order_id)
);

-- Create indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_type ON orders(user_id, type);

-- Order executions table
CREATE TABLE IF NOT EXISTS order_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL, -- Reference to orders.id (primary key)
    execution_index INTEGER NOT NULL,
    
    -- Execution details
    input_amount TEXT NOT NULL,
    output_amount TEXT NOT NULL,
    execution_price TEXT NOT NULL,
    
    -- Blockchain details
    transaction_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    gas_used TEXT NOT NULL,
    gas_fee TEXT NOT NULL,
    
    -- Timestamp
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    UNIQUE(order_id, execution_index),
    
    -- Foreign key reference to orders primary key
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create indexes for order_executions table
CREATE INDEX IF NOT EXISTS idx_executions_order_id ON order_executions(order_id);
CREATE INDEX IF NOT EXISTS idx_executions_executed_at ON order_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_transaction_hash ON order_executions(transaction_hash);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW active_orders AS
SELECT *
FROM orders
WHERE status IN ('PENDING', 'PARTIALLY_FILLED')
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW completed_orders AS
SELECT *
FROM orders
WHERE status IN ('FILLED', 'CANCELLED', 'EXPIRED')
ORDER BY updated_at DESC;

-- Create view for order summary with execution count
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.*,
    COALESCE(e.execution_count, 0) as actual_execution_count,
    COALESCE(e.total_gas_fee, '0') as total_gas_fee
FROM orders o
LEFT JOIN (
    SELECT 
        order_id,
        COUNT(*) as execution_count,
        SUM(CAST(gas_fee AS DECIMAL)) as total_gas_fee
    FROM order_executions
    GROUP BY order_id
) e ON o.id = e.order_id;

-- Insert sample data for testing (commented out for production)
/*
INSERT INTO orders (
    user_id, order_id, type, from_token, to_token, from_chain, to_chain,
    input_amount, target_price, slippage
) VALUES (
    'test_user_123',
    'limit_order_001', 
    'LIMIT',
    '0xA0b86a33E6B7cB2CCFE06e0ec7b8Dd64f77b2A38', -- USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', -- WETH
    1, -- Ethereum
    1, -- Ethereum
    '1000.0', -- 1000 USDC
    '0.0005', -- Target price: 1 USDC = 0.0005 ETH
    2.0 -- 2% slippage
);

INSERT INTO orders (
    user_id, order_id, type, from_token, to_token, from_chain, to_chain,
    input_amount, frequency, max_executions, slippage
) VALUES (
    'test_user_123',
    'dca_order_001',
    'DCA',
    '0xA0b86a33E6B7cB2CCFE06e0ec7b8Dd64f77b2A38', -- USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', -- WETH
    1, -- Ethereum
    1, -- Ethereum
    '500.0', -- 500 USDC per execution
    168, -- Every week (168 hours)
    10, -- 10 executions total
    1.5 -- 1.5% slippage
);
*/

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON orders TO core_service_user;
-- GRANT ALL PRIVILEGES ON order_executions TO core_service_user;
-- GRANT USAGE ON SEQUENCE orders_id_seq TO core_service_user;
-- GRANT USAGE ON SEQUENCE order_executions_id_seq TO core_service_user; 