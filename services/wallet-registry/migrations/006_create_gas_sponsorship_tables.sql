-- Gas Sponsorship Policies Table
CREATE TABLE IF NOT EXISTS gas_sponsorship_policies (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_id VARCHAR(50) NULL,
  wallet_address VARCHAR(42) NULL,
  daily_limit VARCHAR(100) NOT NULL, -- Wei amount as string
  monthly_limit VARCHAR(100) NOT NULL, -- Wei amount as string
  per_transaction_limit VARCHAR(100) NULL, -- Wei amount as string
  allowed_contracts TEXT NULL, -- JSON array of contract addresses
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
);

-- Gas Usage Records Table
CREATE TABLE IF NOT EXISTS gas_usage (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  user_operation_hash VARCHAR(66) NOT NULL,
  gas_cost VARCHAR(100) NOT NULL, -- Wei amount as string
  policy_id VARCHAR(50) NOT NULL,
  sponsored BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_chain_id (chain_id),
  INDEX idx_policy_id (policy_id),
  INDEX idx_sponsored (sponsored),
  INDEX idx_timestamp (timestamp),
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_policy_timestamp (policy_id, timestamp),
  
  FOREIGN KEY (policy_id) REFERENCES gas_sponsorship_policies(id) ON DELETE CASCADE
);

-- Add comments for documentation
ALTER TABLE gas_sponsorship_policies COMMENT = 'Gas sponsorship policies for Account Abstraction wallets';
ALTER TABLE gas_usage COMMENT = 'Gas usage tracking for sponsored and non-sponsored transactions';

-- Add column comments
ALTER TABLE gas_sponsorship_policies 
  MODIFY COLUMN daily_limit VARCHAR(100) NOT NULL COMMENT 'Daily gas limit in wei (string to handle large numbers)',
  MODIFY COLUMN monthly_limit VARCHAR(100) NOT NULL COMMENT 'Monthly gas limit in wei (string to handle large numbers)',
  MODIFY COLUMN per_transaction_limit VARCHAR(100) NULL COMMENT 'Per transaction gas limit in wei (optional)',
  MODIFY COLUMN allowed_contracts TEXT NULL COMMENT 'JSON array of allowed contract addresses (optional)';

ALTER TABLE gas_usage
  MODIFY COLUMN gas_cost VARCHAR(100) NOT NULL COMMENT 'Gas cost in wei (string to handle large numbers)',
  MODIFY COLUMN sponsored BOOLEAN NOT NULL DEFAULT false COMMENT 'Whether this transaction was sponsored by a policy'; 