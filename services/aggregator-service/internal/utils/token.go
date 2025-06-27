package utils

import (
	"strings"

	"github.com/sirupsen/logrus"
)

// TokenUtils provides shared token-related utilities
type TokenUtils struct{}

// NewTokenUtils creates a new TokenUtils instance
func NewTokenUtils() *TokenUtils {
	return &TokenUtils{}
}

// GetTokenDecimals gets token decimals with comprehensive multi-chain support
func (tu *TokenUtils) GetTokenDecimals(tokenAddress string, chainID int) (int, error) {
	normalizedAddress := strings.ToLower(strings.TrimSpace(tokenAddress))
	
	// Handle native tokens (always 18 decimals)
	if normalizedAddress == "0x0000000000000000000000000000000000000000" || 
	   normalizedAddress == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" {
		return 18, nil
	}
	
	// Handle known tokens by chain
	switch chainID {
	case 1: // Ethereum Mainnet
		switch normalizedAddress {
		case "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": // WETH
			return 18, nil
		case "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": // USDC
			return 6, nil
		case "0xdac17f958d2ee523a2206206994597c13d831ec7": // USDT
			return 6, nil
		case "0x6b175474e89094c44da98b954eedeac495271d0f": // DAI
			return 18, nil
		case "0x514910771af9ca656af840dff83e8264ecf986ca": // LINK
			return 18, nil
		case "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": // WBTC
			return 8, nil
		case "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": // UNI
			return 18, nil
		case "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0": // MATIC
			return 18, nil
		}
	case 8453: // Base
		switch normalizedAddress {
		case "0x4200000000000000000000000000000000000006": // WETH
			return 18, nil
		case "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": // USDC
			return 6, nil
		case "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": // DAI
			return 18, nil
		case "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": // USDbC (Bridged USDC)
			return 6, nil
		case "0x940181a94a35a4569e4529a3cdfb74e38fd98631": // AERO
			return 18, nil
		case "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": // cbETH
			return 18, nil
		}
	case 56: // BSC (Binance Smart Chain)
		switch normalizedAddress {
		case "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": // WBNB
			return 18, nil
		case "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": // USDC
			return 18, nil
		case "0x55d398326f99059ff775485246999027b3197955": // USDT
			return 18, nil
		case "0xe9e7cea3dedca5984780bafc599bd69add087d56": // BUSD
			return 18, nil
		case "0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe": // XRP
			return 18, nil
		case "0x2170ed0880ac9a755fd29b2688956bd959f933f8": // ETH
			return 18, nil
		case "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": // BTCB
			return 18, nil
		}
	case 137: // Polygon
		switch normalizedAddress {
		case "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": // WMATIC
			return 18, nil
		case "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": // USDC
			return 6, nil
		case "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": // USDT
			return 6, nil
		case "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": // DAI
			return 18, nil
		case "0x7ceb23fd6c692e4b50fff685f77fcf6d7e9c4f6b": // WETH
			return 18, nil
		case "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": // WBTC
			return 8, nil
		case "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39": // LINK
			return 18, nil
		}
	case 42161: // Arbitrum One
		switch normalizedAddress {
		case "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": // WETH
			return 18, nil
		case "0xaf88d065e77c8cc2239327c5edb3a432268e5831": // USDC
			return 6, nil
		case "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": // USDT
			return 6, nil
		case "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": // DAI
			return 18, nil
		case "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": // WBTC
			return 8, nil
		case "0xf97f4df75117a78c1a5a0dbb814af92458539fb4": // LINK
			return 18, nil
		case "0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0": // UNI
			return 18, nil
		}
	case 10: // Optimism
		switch normalizedAddress {
		case "0x4200000000000000000000000000000000000006": // WETH
			return 18, nil
		case "0x0b2c639c533813f4aa9d7837caf62653d097ff85": // USDC
			return 6, nil
		case "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": // USDT
			return 6, nil
		case "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": // DAI
			return 18, nil
		case "0x68f180fcce6836688e9084f035309e29bf0a2095": // WBTC
			return 8, nil
		case "0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6": // LINK
			return 18, nil
		case "0x6fd9d7ad17242c41f7131d257212c54a0e816691": // UNI
			return 18, nil
		}
	case 43114: // Avalanche C-Chain
		switch normalizedAddress {
		case "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": // WAVAX
			return 18, nil
		case "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": // USDC
			return 6, nil
		case "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": // USDT
			return 6, nil
		case "0xd586e7f844cea2f87f50152665bcbc2c279d8d70": // DAI
			return 18, nil
		case "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab": // WETH
			return 18, nil
		case "0x50b7545627a5162f82a992c33b87adc75187b218": // WBTC
			return 8, nil
		}
	case 250: // Fantom
		switch normalizedAddress {
		case "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83": // WFTM
			return 18, nil
		case "0x04068da6c83afcfa0e13ba15a6696662335d5b75": // USDC
			return 6, nil
		case "0x049d68029688eabf473097a2fc38ef61633a3c7a": // USDT
			return 6, nil
		case "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e": // DAI
			return 18, nil
		case "0x74b23882a30290451a17c44f4f05243b6b58c76d": // WETH
			return 18, nil
		case "0x321162cd933e2be498cd2267a90534a804051b11": // WBTC
			return 8, nil
		}
	}
	
	// Fallback: call onchain to get decimals
	return tu.getTokenDecimalsFromContract(normalizedAddress, chainID)
}

// getTokenDecimalsFromContract fetches decimals from contract via RPC
func (tu *TokenUtils) getTokenDecimalsFromContract(tokenAddress string, chainID int) (int, error) {
	// This would require RPC client setup - for now return default
	// TODO: Implement actual contract call with ethers or go-ethereum
	logrus.WithFields(logrus.Fields{
		"tokenAddress": tokenAddress,
		"chainID":      chainID,
	}).Warn("⚠️ Token decimals not found in known list, using default 18. TODO: implement onchain lookup")
	
	return 18, nil
}

// IsNativeToken checks if a token address represents the native token
func (tu *TokenUtils) IsNativeToken(tokenAddress string) bool {
	normalizedAddress := strings.ToLower(strings.TrimSpace(tokenAddress))
	return normalizedAddress == "0x0000000000000000000000000000000000000000" || 
		   normalizedAddress == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
}

// GetNativeTokenSymbol returns the native token symbol for a chain
func (tu *TokenUtils) GetNativeTokenSymbol(chainID int) string {
	switch chainID {
	case 1:
		return "ETH"
	case 8453:
		return "ETH"
	case 56:
		return "BNB"
	case 137:
		return "MATIC"
	case 42161:
		return "ETH"
	case 10:
		return "ETH"
	case 43114:
		return "AVAX"
	case 250:
		return "FTM"
	default:
		return "ETH"
	}
}

// IsStablecoin checks if a token is a known stablecoin
func (tu *TokenUtils) IsStablecoin(tokenAddress string, chainID int) bool {
	normalizedAddress := strings.ToLower(strings.TrimSpace(tokenAddress))
	
	stablecoins := map[int]map[string]bool{
		1: { // Ethereum
			"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": true, // USDC
			"0xdac17f958d2ee523a2206206994597c13d831ec7": true, // USDT
			"0x6b175474e89094c44da98b954eedeac495271d0f": true, // DAI
		},
		8453: { // Base
			"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": true, // USDC
			"0x50c5725949a6f0c72e6c4a641f24049a917db0cb": true, // DAI
			"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": true, // USDbC
		},
		56: { // BSC
			"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": true, // USDC
			"0x55d398326f99059ff775485246999027b3197955": true, // USDT
			"0xe9e7cea3dedca5984780bafc599bd69add087d56": true, // BUSD
		},
		137: { // Polygon
			"0x2791bca1f2de4661ed88a30c99a7a9449aa84174": true, // USDC
			"0xc2132d05d31c914a87c6611c10748aeb04b58e8f": true, // USDT
			"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": true, // DAI
		},
		42161: { // Arbitrum
			"0xaf88d065e77c8cc2239327c5edb3a432268e5831": true, // USDC
			"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": true, // USDT
			"0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": true, // DAI
		},
		10: { // Optimism
			"0x0b2c639c533813f4aa9d7837caf62653d097ff85": true, // USDC
			"0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": true, // USDT
			"0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": true, // DAI
		},
	}
	
	if chainStables, exists := stablecoins[chainID]; exists {
		return chainStables[normalizedAddress]
	}
	
	return false
} 