-- Migration: Add owner information to AA wallets table
-- This establishes the link between Privy social login and AA wallet ownership

-- Add owner information columns
ALTER TABLE aa_wallets 
ADD COLUMN owner_address VARCHAR(42) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000';

ALTER TABLE aa_wallets 
ADD COLUMN owner_type VARCHAR(20) NOT NULL DEFAULT 'privy-social';

-- Add constraint for owner_type values
ALTER TABLE aa_wallets 
ADD CONSTRAINT check_owner_type 
CHECK (owner_type IN ('privy-social', 'privy-wallet', 'external'));

-- Add index for efficient owner queries
CREATE INDEX IF NOT EXISTS idx_aa_wallets_owner_address ON aa_wallets(owner_address);
CREATE INDEX IF NOT EXISTS idx_aa_wallets_owner_type ON aa_wallets(owner_type);

-- Add composite index for user + owner queries
CREATE INDEX IF NOT EXISTS idx_aa_wallets_user_owner ON aa_wallets(user_id, owner_address); 