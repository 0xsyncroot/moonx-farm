package config

import (
	"strings"
)

// PopularTokenMetadata contains complete metadata for popular tokens
type PopularTokenMetadata struct {
	Symbol        string          `json:"symbol"`
	Name          string          `json:"name"`
	Decimals      int             `json:"decimals"`
	LogoURI       string          `json:"logoURI"`
	IsNative      bool            `json:"isNative"`
	CoinGeckoID   string          `json:"coinGeckoId,omitempty"`
	BinanceSymbol string          `json:"binanceSymbol,omitempty"`
	IsStablecoin  bool            `json:"isStablecoin"`
	Tags          []string        `json:"tags"`
}

// PopularTokensByChain contains popular tokens with full metadata per chain
var PopularTokensByChain = map[int]map[string]*PopularTokenMetadata{
	// Ethereum Mainnet
	1: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "ETH",
			Name:          "Ethereum",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
			IsNative:      true,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"native", "popular"},
		},
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
			Symbol:        "WETH",
			Name:          "Wrapped Ether",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
			IsNative:      false,
			CoinGeckoID:   "weth",
			BinanceSymbol: "ETH",
			Tags:          []string{"wrapped", "popular"},
		},
		"0xa0b86a33e6776c9c13b995b48b3d6f9b6b5e9a5a": {
			Symbol:        "USDC",
			Name:          "USD Coin",
			Decimals:      6,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6776c9C13b995b48B3d6f9B6B5E9A5a/logo.png",
			IsNative:      false,
			CoinGeckoID:   "usd-coin",
			BinanceSymbol: "USDC",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0xdac17f958d2ee523a2206206994597c13d831ec7": {
			Symbol:        "USDT",
			Name:          "Tether USD",
			Decimals:      6,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
			IsNative:      false,
			CoinGeckoID:   "tether",
			BinanceSymbol: "USDT",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
	},
	
	// Base Mainnet
	8453: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "ETH",
			Name:          "Ethereum",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
			IsNative:      true,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"native", "popular"},
		},
		"0x4200000000000000000000000000000000000006": {
			Symbol:        "WETH",
			Name:          "Wrapped Ether",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
			IsNative:      false,
			CoinGeckoID:   "weth",
			BinanceSymbol: "ETH",
			Tags:          []string{"wrapped", "popular"},
		},
		"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
			Symbol:        "USDC",
			Name:          "USD Coin",
			Decimals:      6,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6776c9C13b995b48B3d6f9B6B5E9A5a/logo.png",
			IsNative:      false,
			CoinGeckoID:   "usd-coin",
			BinanceSymbol: "USDC",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": {
			Symbol:        "USDbC",
			Name:          "USD Base Coin",
			Decimals:      6,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6776c9C13b995b48B3d6f9B6B5E9A5a/logo.png",
			IsNative:      false,
			CoinGeckoID:   "usd-base-coin",
			BinanceSymbol: "",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
	},
	
	// BSC Mainnet
	56: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "BNB",
			Name:          "BNB",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
			IsNative:      true,
			CoinGeckoID:   "binancecoin",
			BinanceSymbol: "BNB",
			Tags:          []string{"native", "popular"},
		},
		"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": {
			Symbol:        "WBNB",
			Name:          "Wrapped BNB",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/logo.png",
			IsNative:      false,
			CoinGeckoID:   "wbnb",
			BinanceSymbol: "BNB",
			Tags:          []string{"wrapped", "popular"},
		},
		"0x55d398326f99059fF775485246999027B3197955": {
			Symbol:        "USDT",
			Name:          "Tether USD",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png",
			IsNative:      false,
			CoinGeckoID:   "tether",
			BinanceSymbol: "USDT",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": {
			Symbol:        "USDC",
			Name:          "USD Coin",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png",
			IsNative:      false,
			CoinGeckoID:   "usd-coin",
			BinanceSymbol: "USDC",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0x2170Ed0880ac9A755fd29B2688956BD959F933F8": {
			Symbol:        "ETH",
			Name:          "Ethereum Token",
			Decimals:      18,
			LogoURI:       "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png",
			IsNative:      false,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"wrapped", "popular"},
		},
	},
}

// IsPopularToken checks if a token is in the popular tokens list
func IsPopularToken(address string, chainID int) bool {
	if tokens, exists := PopularTokensByChain[chainID]; exists {
		_, isPopular := tokens[strings.ToLower(address)]
		return isPopular
	}
	return false
}

// GetPopularTokenMetadata returns metadata for a popular token
func GetPopularTokenMetadata(address string, chainID int) *PopularTokenMetadata {
	if tokens, exists := PopularTokensByChain[chainID]; exists {
		if metadata, exists := tokens[strings.ToLower(address)]; exists {
			return metadata
		}
	}
	return nil
}

// GetAllPopularTokensForChain returns all popular tokens for a chain
func GetAllPopularTokensForChain(chainID int) map[string]*PopularTokenMetadata {
	if tokens, exists := PopularTokensByChain[chainID]; exists {
		return tokens
	}
	return make(map[string]*PopularTokenMetadata)
}

// GetBinanceSymbolMapping returns mapping of symbol to Binance trading symbol
func GetBinanceSymbolMapping() map[string]string {
	mapping := make(map[string]string)
	
	for _, chainTokens := range PopularTokensByChain {
		for _, metadata := range chainTokens {
			if metadata.BinanceSymbol != "" {
				mapping[metadata.Symbol] = metadata.BinanceSymbol
			}
		}
	}
	
	return mapping
} 