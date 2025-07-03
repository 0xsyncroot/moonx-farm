package config

import (
	"strings"

	"github.com/moonx-farm/aggregator-service/internal/models"
)

// PopularTokenMetadata contains complete metadata for popular tokens
type PopularTokenMetadata struct {
	Symbol        string   `json:"symbol"`
	Name          string   `json:"name"`
	Decimals      int      `json:"decimals"`
	LogoURI       string   `json:"logoURI"`
	IsNative      bool     `json:"isNative"`
	CoinGeckoID   string   `json:"coinGeckoId,omitempty"`
	BinanceSymbol string   `json:"binanceSymbol,omitempty"`
	IsStablecoin  bool     `json:"isStablecoin"`
	Tags          []string `json:"tags"`
}

// PopularTokensByChain contains popular tokens with full metadata per chain
var PopularTokensByChain = map[int]map[string]*PopularTokenMetadata{
	// Ethereum Mainnet
	1: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "ETH",
			Name:          "Ethereum",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
			IsNative:      true,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"native", "popular"},
		},
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
			Symbol:        "WETH",
			Name:          "Wrapped Ethereum",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/2518/large/weth.png",
			IsNative:      false,
			CoinGeckoID:   "weth",
			BinanceSymbol: "ETH",
			Tags:          []string{"wrapped", "popular"},
		},
		"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
			Symbol:        "USDC",
			Name:          "USD Coin",
			Decimals:      6,
			LogoURI:       "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
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
			LogoURI:       "https://assets.coingecko.com/coins/images/325/large/Tether.png",
			IsNative:      false,
			CoinGeckoID:   "tether",
			BinanceSymbol: "USDT",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0x514910771af9ca656af840dff83e8264ecf986ca": {
			Symbol:        "LINK",
			Name:          "Chainlink",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
			IsNative:      false,
			CoinGeckoID:   "chainlink",
			BinanceSymbol: "LINK",
			Tags:          []string{"oracle", "popular"},
		},
	},

	// Base Mainnet
	8453: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "ETH",
			Name:          "Ethereum",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
			IsNative:      true,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"native", "popular"},
		},
		"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
			Symbol:        "USDC",
			Name:          "USD Coin",
			Decimals:      6,
			LogoURI:       "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
			IsNative:      false,
			CoinGeckoID:   "usd-coin",
			BinanceSymbol: "USDC",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "popular"},
		},
		"0x4200000000000000000000000000000000000006": {
			Symbol:        "WETH",
			Name:          "Wrapped Ethereum",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/2518/large/weth.png",
			IsNative:      false,
			CoinGeckoID:   "weth",
			BinanceSymbol: "ETH",
			Tags:          []string{"wrapped", "popular"},
		},
	},

	// BSC Mainnet
	56: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "BNB",
			Name:          "BNB",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
			IsNative:      true,
			CoinGeckoID:   "binancecoin",
			BinanceSymbol: "BNB",
			Tags:          []string{"native", "popular"},
		},
		"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": {
			Symbol:        "WBNB",
			Name:          "Wrapped BNB",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/12591/large/binance-coin-logo.png",
			IsNative:      false,
			CoinGeckoID:   "wbnb",
			BinanceSymbol: "BNB",
			Tags:          []string{"wrapped", "popular"},
		},
		"0x55d398326f99059fF775485246999027B3197955": {
			Symbol:        "USDT",
			Name:          "Tether USD",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/325/large/Tether.png",
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
			LogoURI:       "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
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
			LogoURI:       "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
			IsNative:      false,
			CoinGeckoID:   "ethereum",
			BinanceSymbol: "ETH",
			Tags:          []string{"bridged", "popular"},
		},
	},

	// Base Sepolia Testnet - NEW with accurate addresses
	84532: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "ETH",
			Name:          "Ethereum (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
			IsNative:      true,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"native", "testnet"},
		},
		"0x4200000000000000000000000000000000000006": {
			Symbol:        "WETH",
			Name:          "Wrapped Ether",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/2518/large/weth.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"wrapped", "testnet"},
		},
		"0x036CbD53842c5426634e7929541eC2318f3dCF7e": {
			Symbol:        "USDC",
			Name:          "USD Coin (Testnet)",
			Decimals:      6,
			LogoURI:       "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "testnet"},
		},
		"0xE4aB69C077896252FAFBD49EFD26B5D171A32410": {
			Symbol:        "LINK",
			Name:          "Chainlink (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"oracle", "testnet"},
		},
	},

	// BSC Testnet - NEW with accurate addresses
	97: {
		"0x0000000000000000000000000000000000000000": {
			Symbol:        "BNB",
			Name:          "BNB (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
			IsNative:      true,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"native", "testnet"},
		},
		"0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd": {
			Symbol:        "WBNB",
			Name:          "Wrapped BNB (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/12591/large/binance-coin-logo.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"wrapped", "testnet"},
		},
		"0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06": {
			Symbol:        "LINK",
			Name:          "Chainlink (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			Tags:          []string{"oracle", "testnet"},
		},
		"0x337610d27c682E347C9cD60BD4b3b107C9d34dDd": {
			Symbol:        "USDT",
			Name:          "Tether USD (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/325/large/Tether.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "testnet"},
		},
		"0x64544969ed7EBf5f083679233325356EbE738930": {
			Symbol:        "USDC",
			Name:          "USD Coin (Testnet)",
			Decimals:      18,
			LogoURI:       "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
			IsNative:      false,
			CoinGeckoID:   "",
			BinanceSymbol: "",
			IsStablecoin:  true,
			Tags:          []string{"stablecoin", "testnet"},
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

// IsPopularTokenAdvanced checks if a token is popular by address or symbol (most comprehensive)
func IsPopularTokenAdvanced(address, symbol string, chainID int) bool {
	popularTokensMap := GetAllPopularTokensForChain(chainID)
	if len(popularTokensMap) == 0 {
		return false
	}

	// Check by address first (exact match)
	if _, exists := popularTokensMap[strings.ToLower(address)]; exists {
		return true
	}

	// Check by symbol (case insensitive)
	for _, metadata := range popularTokensMap {
		if strings.EqualFold(metadata.Symbol, symbol) {
			return true
		}
	}

	return false
}

// IsPopularTokenByToken checks if a Token struct is popular (for compatibility)
func IsPopularTokenByToken(token *models.Token) bool {
	if token == nil {
		return false
	}

	// First check metadata if available
	if token.Metadata != nil {
		if popular, ok := token.Metadata["isPopular"].(bool); ok {
			return popular
		}
	}

	// Use the advanced check as fallback
	return IsPopularTokenAdvanced(token.Address, token.Symbol, token.ChainID)
}

// IsStablecoin checks if a token is a stablecoin based on symbol
func IsStablecoin(symbol string) bool {
	stableSymbols := map[string]bool{
		"USDC": true, "USDT": true, "DAI": true, "FRAX": true,
		"USDB": true, "FDUSD": true,
		// Note: USDbC removed due to low liquidity
		// Note: BUSD removed due to Binance deprecation
	}
	return stableSymbols[strings.ToUpper(symbol)]
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
