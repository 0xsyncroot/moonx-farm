package config

// ChainConfig represents blockchain configuration
type ChainConfig struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	ShortName       string `json:"shortName"`
	NativeCurrency  string `json:"nativeCurrency"`
	RpcURL          string `json:"rpcUrl"`
	ExplorerURL     string `json:"explorerUrl"`
	IsTestnet       bool   `json:"isTestnet"`
	IsActive        bool   `json:"isActive"`
	CoingeckoID     string `json:"coingeckoId,omitempty"`
	DexScreenerSlug string `json:"dexScreenerSlug,omitempty"`
}

// GetSupportedChains returns all supported chains based on environment
func GetSupportedChains(environment string) map[int]*ChainConfig {
	chains := make(map[int]*ChainConfig)

	// Development/Test - Include testnets
	chains[84532] = &ChainConfig{
		ID:              84532,
		Name:            "Base Sepolia",
		ShortName:       "base-sepolia",
		NativeCurrency:  "ETH",
		RpcURL:          "https://sepolia.base.org",
		ExplorerURL:     "https://sepolia-explorer.base.org",
		IsTestnet:       true,
		IsActive:        true,
		CoingeckoID:     "",
		DexScreenerSlug: "",
	}

	chains[97] = &ChainConfig{
		ID:              97,
		Name:            "BSC Testnet",
		ShortName:       "bsc-testnet",
		NativeCurrency:  "BNB",
		RpcURL:          "https://data-seed-prebsc-1-s1.binance.org:8545",
		ExplorerURL:     "https://testnet.bscscan.com",
		IsTestnet:       true,
		IsActive:        true,
		CoingeckoID:     "",
		DexScreenerSlug: "",
	}

	// Production chains (always available)
	chains[8453] = &ChainConfig{
		ID:              8453,
		Name:            "Base",
		ShortName:       "base",
		NativeCurrency:  "ETH",
		RpcURL:          "https://mainnet.base.org",
		ExplorerURL:     "https://basescan.org",
		IsTestnet:       false,
		IsActive:        true,
		CoingeckoID:     "base",
		DexScreenerSlug: "base",
	}

	chains[56] = &ChainConfig{
		ID:              56,
		Name:            "BNB Smart Chain",
		ShortName:       "bsc",
		NativeCurrency:  "BNB",
		RpcURL:          "https://bsc-dataseed1.binance.org",
		ExplorerURL:     "https://bscscan.com",
		IsTestnet:       false,
		IsActive:        true,
		CoingeckoID:     "binance-smart-chain",
		DexScreenerSlug: "bsc",
	}

	// Additional major chains (can be enabled/disabled easily)
	if environment == "production" {
		chains[1] = &ChainConfig{
			ID:              1,
			Name:            "Ethereum",
			ShortName:       "ethereum",
			NativeCurrency:  "ETH",
			RpcURL:          "https://eth.llamarpc.com",
			ExplorerURL:     "https://etherscan.io",
			IsTestnet:       false,
			IsActive:        false, // Disabled by default (high gas)
			CoingeckoID:     "ethereum",
			DexScreenerSlug: "ethereum",
		}

		chains[137] = &ChainConfig{
			ID:              137,
			Name:            "Polygon",
			ShortName:       "polygon",
			NativeCurrency:  "MATIC",
			RpcURL:          "https://polygon-rpc.com",
			ExplorerURL:     "https://polygonscan.com",
			IsTestnet:       false,
			IsActive:        false, // Can be enabled later
			CoingeckoID:     "polygon-pos",
			DexScreenerSlug: "polygon",
		}

		chains[42161] = &ChainConfig{
			ID:              42161,
			Name:            "Arbitrum One",
			ShortName:       "arbitrum",
			NativeCurrency:  "ETH",
			RpcURL:          "https://arb1.arbitrum.io/rpc",
			ExplorerURL:     "https://arbiscan.io",
			IsTestnet:       false,
			IsActive:        false, // Can be enabled later
			CoingeckoID:     "arbitrum-one",
			DexScreenerSlug: "arbitrum",
		}

		chains[10] = &ChainConfig{
			ID:              10,
			Name:            "Optimism",
			ShortName:       "optimism",
			NativeCurrency:  "ETH",
			RpcURL:          "https://mainnet.optimism.io",
			ExplorerURL:     "https://optimistic.etherscan.io",
			IsTestnet:       false,
			IsActive:        false, // Can be enabled later
			CoingeckoID:     "optimistic-ethereum",
			DexScreenerSlug: "optimism",
		}
	}

	return chains
}

// GetActiveChains returns only active chains
func GetActiveChains(environment string) map[int]*ChainConfig {
	allChains := GetSupportedChains(environment)
	activeChains := make(map[int]*ChainConfig)

	for id, chain := range allChains {
		if chain.IsActive {
			activeChains[id] = chain
		}
	}

	return activeChains
}

// GetChainByID returns chain config by ID
func GetChainByID(chainID int, environment string) *ChainConfig {
	chains := GetSupportedChains(environment)
	return chains[chainID]
}

// GetMainnetChains returns only mainnet chains
func GetMainnetChains(environment string) map[int]*ChainConfig {
	allChains := GetSupportedChains(environment)
	mainnetChains := make(map[int]*ChainConfig)

	for id, chain := range allChains {
		if !chain.IsTestnet && chain.IsActive {
			mainnetChains[id] = chain
		}
	}

	return mainnetChains
}

// GetTestnetChains returns only testnet chains
func GetTestnetChains(environment string) map[int]*ChainConfig {
	allChains := GetSupportedChains(environment)
	testnetChains := make(map[int]*ChainConfig)

	for id, chain := range allChains {
		if chain.IsTestnet && chain.IsActive {
			testnetChains[id] = chain
		}
	}

	return testnetChains
}

// Popular token addresses per chain for quick lookup
var PopularTokens = map[int]map[string]string{
	// Base Mainnet
	8453: {
		"ETH":   "0x0000000000000000000000000000000000000000",
		"WETH":  "0x4200000000000000000000000000000000000006",
		"USDC":  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
		"USDbC": "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
		"DAI":   "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
	},
	// BSC Mainnet
	56: {
		"BNB":  "0x0000000000000000000000000000000000000000",
		"WBNB": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
		"USDT": "0x55d398326f99059fF775485246999027B3197955",
		"USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
		"BUSD": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
	},
	// Base Sepolia (Testnet)
	84532: {
		"ETH":  "0x0000000000000000000000000000000000000000",
		"WETH": "0x4200000000000000000000000000000000000006",
	},
	// BSC Testnet
	97: {
		"BNB":  "0x0000000000000000000000000000000000000000",
		"WBNB": "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
	},
}

// GetPopularTokens returns popular tokens for a chain
func GetPopularTokens(chainID int) map[string]string {
	if tokens, exists := PopularTokens[chainID]; exists {
		return tokens
	}
	return make(map[string]string)
}
