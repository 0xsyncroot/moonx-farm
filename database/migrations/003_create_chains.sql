-- Migration: 003_create_chains
-- Description: Create chains table for multi-chain support management
-- Created: 2024-12-31
-- Purpose: Centralized chain configuration with caching support

-- Create chains table
CREATE TABLE IF NOT EXISTS chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    network_type VARCHAR(20) NOT NULL DEFAULT 'mainnet',
    
    -- RPC Configuration (multiple RPC endpoints)
    rpc_providers JSONB NOT NULL,
    
    -- Aggregator Providers Configuration
    aggregator_providers JSONB NOT NULL DEFAULT '{}',
    
    -- Explorer URLs
    explorer_urls TEXT[] NOT NULL,
    
    -- Native Currency Info
    native_currency JSONB NOT NULL,
    
    -- Visual & Branding
    icon_url TEXT,
    brand_color VARCHAR(7), -- Hex color code
    
    -- Status & Control
    active BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    priority INTEGER NOT NULL DEFAULT 0,
    is_testnet BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Smart Contract Addresses
    diamond_contract_address VARCHAR(42),
    
    -- Chain Configuration (gas limits, block times, etc.)
    chain_config JSONB NOT NULL DEFAULT '{}',
    
    -- Additional URLs
    faucet_urls TEXT[], -- For testnets
    docs_url TEXT,
    website_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chains_chain_id_positive CHECK (chain_id > 0),
    CONSTRAINT chains_name_length CHECK (length(name) > 0),
    CONSTRAINT chains_short_name_length CHECK (length(short_name) > 0),
    CONSTRAINT chains_network_type_check CHECK (network_type IN ('mainnet', 'testnet')),
    CONSTRAINT chains_status_check CHECK (status IN ('active', 'inactive', 'maintenance')),
    CONSTRAINT chains_brand_color_format CHECK (brand_color IS NULL OR brand_color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chains_diamond_address_format CHECK (diamond_contract_address IS NULL OR diamond_contract_address ~* '^0x[a-f0-9]{40}$'),
    CONSTRAINT chains_explorer_urls_not_empty CHECK (array_length(explorer_urls, 1) > 0),
    CONSTRAINT chains_rpc_providers_structure CHECK (
        rpc_providers ? 'primary' AND 
        jsonb_typeof(rpc_providers->'primary') = 'string'
    ),
    CONSTRAINT chains_aggregator_providers_structure CHECK (
        jsonb_typeof(aggregator_providers) = 'object'
    ),
    CONSTRAINT chains_native_currency_structure CHECK (
        native_currency ? 'name' AND 
        native_currency ? 'symbol' AND 
        native_currency ? 'decimals' AND
        jsonb_typeof(native_currency->'decimals') = 'number'
    ),
    CONSTRAINT chains_chain_config_structure CHECK (
        jsonb_typeof(chain_config) = 'object'
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chains_chain_id ON chains(chain_id);
CREATE INDEX IF NOT EXISTS idx_chains_status ON chains(status);
CREATE INDEX IF NOT EXISTS idx_chains_network_type ON chains(network_type);
CREATE INDEX IF NOT EXISTS idx_chains_is_testnet ON chains(is_testnet);
CREATE INDEX IF NOT EXISTS idx_chains_priority ON chains(priority);
CREATE INDEX IF NOT EXISTS idx_chains_short_name ON chains(short_name);
CREATE INDEX IF NOT EXISTS idx_chains_created_at ON chains(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chains_active_priority ON chains(status, priority) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_chains_network_status ON chains(network_type, status);
CREATE INDEX IF NOT EXISTS idx_chains_testnet_status ON chains(is_testnet, status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chains_updated_at 
    BEFORE UPDATE ON chains 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default supported chains
INSERT INTO chains (
    chain_id, name, short_name, network_type, 
    rpc_providers, aggregator_providers, explorer_urls, native_currency, 
    icon_url, brand_color, active, status, priority, is_testnet,
    diamond_contract_address, chain_config, faucet_urls, docs_url, website_url
) VALUES

-- Mainnet chains
(1, 'Ethereum', 'ETH', 'mainnet', 
 '{"primary": "https://ethereum.drpc.org", "secondary": "https://rpc.ankr.com/eth", "fallback": "https://cloudflare-eth.com"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://etherscan.io'], 
 '{"name": "Ether", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/ethereum/ethereum-org-website/dev/src/assets/eth-diamond-rainbow.png',
 '#627EEA', true, 'active', 1, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 12, "maxGasPrice": "100000000000"}',
 NULL, 'https://ethereum.org/developers/', 'https://ethereum.org'),

(56, 'BNB Smart Chain', 'BSC', 'mainnet',
 '{"primary": "https://bsc-dataseed.binance.org", "secondary": "https://rpc.ankr.com/bsc", "fallback": "https://bsc-dataseed1.defibit.io"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://bscscan.com'],
 '{"name": "BNB", "symbol": "BNB", "decimals": 18}',
 'https://raw.githubusercontent.com/binance-chain/bsc/master/docs/logo/bsc-logo.svg',
 '#F3BA2F', true, 'active', 2, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 3, "maxGasPrice": "20000000000"}',
 NULL, 'https://docs.bnbchain.org/', 'https://www.bnbchain.org'),

(137, 'Polygon', 'MATIC', 'mainnet',
 '{"primary": "https://polygon-rpc.com", "secondary": "https://rpc.ankr.com/polygon", "fallback": "https://matic-mainnet.chainstacklabs.com"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://polygonscan.com'],
 '{"name": "MATIC", "symbol": "MATIC", "decimals": 18}',
 'https://raw.githubusercontent.com/0xPolygon/brand-resources/main/SVG/polygon-token-icon.svg',
 '#8247E5', true, 'active', 3, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 2, "maxGasPrice": "50000000000"}',
 NULL, 'https://docs.polygon.technology/', 'https://polygon.technology'),

(8453, 'Base', 'BASE', 'mainnet',
 '{"primary": "https://mainnet.base.org", "secondary": "https://rpc.ankr.com/base", "fallback": "https://base.blockpi.network/v1/rpc/public"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": false, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://basescan.org'],
 '{"name": "Ethereum", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg',
 '#0052FF', true, 'active', 4, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 2, "maxGasPrice": "10000000000"}',
 NULL, 'https://docs.base.org/', 'https://base.org'),

(42161, 'Arbitrum One', 'ARB', 'mainnet',
 '{"primary": "https://arb1.arbitrum.io/rpc", "secondary": "https://rpc.ankr.com/arbitrum", "fallback": "https://arbitrum-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://arbiscan.io'],
 '{"name": "Ethereum", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/OffchainLabs/arbitrum-docs/master/static/img/logo.svg',
 '#28A0F0', true, 'active', 5, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 0.25, "maxGasPrice": "2000000000"}',
 NULL, 'https://docs.arbitrum.io/', 'https://arbitrum.io'),

(10, 'Optimism', 'OP', 'mainnet',
 '{"primary": "https://mainnet.optimism.io", "secondary": "https://rpc.ankr.com/optimism", "fallback": "https://optimism-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://optimistic.etherscan.io'],
 '{"name": "Ethereum", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/ethereum-optimism/brand-kit/main/assets/svg/OPTIMISM-R.svg',
 '#FF0420', true, 'active', 6, false,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 2, "maxGasPrice": "1000000000"}',
 NULL, 'https://docs.optimism.io/', 'https://optimism.io'),

-- Testnet chains
(11155111, 'Ethereum Sepolia', 'ETH-SEP', 'testnet',
 '{"primary": "https://sepolia.drpc.org", "secondary": "https://rpc.ankr.com/eth_sepolia", "fallback": "https://ethereum-sepolia.blockpi.network/v1/rpc/public"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://sepolia.etherscan.io'],
 '{"name": "Sepolia Ether", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/ethereum/ethereum-org-website/dev/src/assets/eth-diamond-rainbow.png',
 '#627EEA', true, 'active', 101, true,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 12, "maxGasPrice": "100000000000"}',
 ARRAY['https://sepoliafaucet.com/', 'https://faucet.quicknode.com/ethereum/sepolia'], 'https://ethereum.org/developers/', 'https://ethereum.org'),

(97, 'BNB Smart Chain Testnet', 'BSC-TEST', 'testnet',
 '{"primary": "https://data-seed-prebsc-1-s1.binance.org:8545", "secondary": "https://rpc.ankr.com/bsc_testnet_chapel", "fallback": "https://bsc-testnet.blockpi.network/v1/rpc/public"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": true, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://testnet.bscscan.com'],
 '{"name": "tBNB", "symbol": "tBNB", "decimals": 18}',
 'https://raw.githubusercontent.com/binance-chain/bsc/master/docs/logo/bsc-logo.svg',
 '#F3BA2F', true, 'active', 102, true,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 3, "maxGasPrice": "20000000000"}',
 ARRAY['https://testnet.bnbchain.org/faucet-smart'], 'https://docs.bnbchain.org/', 'https://www.bnbchain.org'),

(84532, 'Base Sepolia', 'BASE-SEP', 'testnet',
 '{"primary": "https://sepolia.base.org", "secondary": "https://rpc.ankr.com/base_sepolia", "fallback": "https://base-sepolia.blockpi.network/v1/rpc/public"}',
 '{"lifi": {"enabled": true, "functionName": "callLifi", "priority": 1}, "relay": {"enabled": true, "functionName": "callRelay", "priority": 2}, "oneinch": {"enabled": false, "functionName": "callOneInch", "priority": 3}}',
 ARRAY['https://sepolia.basescan.org'],
 '{"name": "Sepolia Ether", "symbol": "ETH", "decimals": 18}',
 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg',
 '#0052FF', true, 'active', 104, true,
 NULL, -- Will be set when deployed
 '{"gasLimit": 21000, "blockTime": 2, "maxGasPrice": "10000000000"}',
 ARRAY['https://bridge.base.org/deposit'], 'https://docs.base.org/', 'https://base.org');

-- Add comments
COMMENT ON TABLE chains IS 'Supported blockchain networks for MoonXFarm DEX with comprehensive configuration';
COMMENT ON COLUMN chains.id IS 'Internal UUID for chain identification';
COMMENT ON COLUMN chains.chain_id IS 'EIP-155 chain identifier (unique numeric ID)';
COMMENT ON COLUMN chains.name IS 'Human-readable chain name';
COMMENT ON COLUMN chains.short_name IS 'Short identifier for the chain';
COMMENT ON COLUMN chains.network_type IS 'Network type: mainnet or testnet';
COMMENT ON COLUMN chains.rpc_providers IS 'JSONB object with RPC endpoints: {primary, secondary, fallback}';
COMMENT ON COLUMN chains.aggregator_providers IS 'JSONB object with flexible aggregator configs: {[aggregatorName]: {enabled, functionName, priority}, ...} - supports any aggregator (lifi, relay, oneinch, paraswap, zeroex, etc.)';
COMMENT ON COLUMN chains.explorer_urls IS 'Array of block explorer URLs';
COMMENT ON COLUMN chains.native_currency IS 'Native currency information (name, symbol, decimals)';
COMMENT ON COLUMN chains.icon_url IS 'URL to chain icon/logo (preferably from GitHub or official sources)';
COMMENT ON COLUMN chains.brand_color IS 'Chain brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN chains.active IS 'Whether this chain is actively used (true/false)';
COMMENT ON COLUMN chains.status IS 'Chain status: active, inactive, or maintenance';
COMMENT ON COLUMN chains.priority IS 'Display order priority (lower numbers first)';
COMMENT ON COLUMN chains.is_testnet IS 'Whether this is a testnet chain';
COMMENT ON COLUMN chains.diamond_contract_address IS 'MoonXFarm Diamond contract address for this chain';
COMMENT ON COLUMN chains.chain_config IS 'Chain-specific configuration (gas limits, block times, etc.)';
COMMENT ON COLUMN chains.faucet_urls IS 'Array of testnet faucet URLs (for testnets only)';
COMMENT ON COLUMN chains.docs_url IS 'Official documentation URL';
COMMENT ON COLUMN chains.website_url IS 'Official website URL';
COMMENT ON COLUMN chains.created_at IS 'Chain record creation timestamp';
COMMENT ON COLUMN chains.updated_at IS 'Last update timestamp'; 