-- Migration: Add AA wallet address column to users table
-- Date: 2025-01-09
-- Description: Add aa_wallet_address column to store Account Abstraction wallet address from Privy

-- Add aa_wallet_address column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS aa_wallet_address VARCHAR(42);

-- Create index for aa_wallet_address for faster queries
CREATE INDEX IF NOT EXISTS idx_users_aa_wallet_address ON users(aa_wallet_address);

-- Add comment to column
COMMENT ON COLUMN users.aa_wallet_address IS 'Account Abstraction wallet address from Privy (smart contract wallet)';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 006: Added aa_wallet_address column to users table successfully';
END $$; 