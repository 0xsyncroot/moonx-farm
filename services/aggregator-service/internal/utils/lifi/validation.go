package lifi

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/types/lifi"
)

// ValidationUtils provides validation utilities for LiFi service
type ValidationUtils struct{}

// NewValidationUtils creates a new validation utils instance
func NewValidationUtils() *ValidationUtils {
	return &ValidationUtils{}
}

// ValidateQuoteRequest validates quote request parameters
func (v *ValidationUtils) ValidateQuoteRequest(req *models.QuoteRequest) error {
	if req == nil {
		return fmt.Errorf("quote request cannot be nil")
	}

	// Validate chain ID
	if req.ChainID <= 0 {
		return fmt.Errorf("invalid chain ID: %d", req.ChainID)
	}

	// Validate amount
	if req.Amount.IsZero() || req.Amount.IsNegative() {
		return fmt.Errorf("invalid amount: %s", req.Amount.String())
	}

	// Validate tokens
	if req.FromToken == "" {
		return fmt.Errorf("from_token cannot be empty")
	}
	if req.ToToken == "" {
		return fmt.Errorf("to_token cannot be empty")
	}

	// Validate slippage
	if req.SlippageTolerance.IsNegative() || req.SlippageTolerance.GreaterThan(decimal.NewFromFloat(50.0)) {
		return fmt.Errorf("invalid slippage tolerance: %s (must be between 0-50%%)", req.SlippageTolerance.String())
	}

	// Cross-chain validation
	if req.ToChainID > 0 && req.ToChainID != req.ChainID {
		// This is a cross-chain request - LiFi supports this
		logrus.WithFields(logrus.Fields{
			"fromChain": req.ChainID,
			"toChain":   req.ToChainID,
		}).Debug("Cross-chain quote request validated for LiFi")
	}

	return nil
}

// ValidateLiFiResponse validates LiFi API response
func (v *ValidationUtils) ValidateLiFiResponse(resp *lifi.LiFiQuoteResponse) error {
	if resp == nil {
		return fmt.Errorf("LiFi response is nil")
	}

	// Validate basic structure
	if resp.Tool == "" {
		return fmt.Errorf("tool is empty")
	}

	// Validate action - check required fields instead of nil comparison
	if resp.Action.FromToken.Address == "" {
		return fmt.Errorf("from token address is empty")
	}

	if resp.Action.ToToken.Address == "" {
		return fmt.Errorf("to token address is empty")
	}

	// Validate estimate
	if resp.Estimate.ToAmount == "" || resp.Estimate.ToAmount == "0" {
		return fmt.Errorf("to_amount is zero or empty")
	}

	// Validate execution duration is reasonable (not more than 24 hours)
	if resp.Estimate.ExecutionDuration > 86400 {
		logrus.WithField("duration", resp.Estimate.ExecutionDuration).Warn("Very long execution duration")
	}

	return nil
}

// ValidateTokensResponse validates LiFi tokens API response
func (v *ValidationUtils) ValidateTokensResponse(resp *lifi.LiFiTokensResponse) error {
	if resp == nil {
		return fmt.Errorf("tokens response is nil")
	}

	if resp.Tokens == nil {
		return fmt.Errorf("tokens map is nil")
	}

	if len(resp.Tokens) == 0 {
		return fmt.Errorf("no tokens found")
	}

	// Validate each chain's tokens
	for chainIDStr, tokens := range resp.Tokens {
		// Validate chain ID is parseable
		if _, err := strconv.Atoi(chainIDStr); err != nil {
			return fmt.Errorf("invalid chain ID format: %s", chainIDStr)
		}

		// Check we have tokens for this chain
		if len(tokens) == 0 {
			logrus.WithField("chainId", chainIDStr).Warn("No tokens found for chain")
			continue
		}

		// Validate first few tokens structure
		for i, token := range tokens {
			if i >= 3 { // Only check first 3 tokens per chain
				break
			}

			if err := v.validateToken(token); err != nil {
				return fmt.Errorf("invalid token in chain %s: %w", chainIDStr, err)
			}
		}
	}

	return nil
}

// validateToken validates individual token structure
func (v *ValidationUtils) validateToken(token lifi.LiFiToken) error {
	if token.Address == "" {
		return fmt.Errorf("token address is empty")
	}

	if token.Symbol == "" {
		return fmt.Errorf("token symbol is empty")
	}

	if token.Name == "" {
		return fmt.Errorf("token name is empty")
	}

	if token.Decimals <= 0 || token.Decimals > 30 {
		return fmt.Errorf("invalid token decimals: %d", token.Decimals)
	}

	if token.ChainId <= 0 {
		return fmt.Errorf("invalid token chain ID: %d", token.ChainId)
	}

	return nil
}

// ValidateQuoteResult validates the converted quote result
func (v *ValidationUtils) ValidateQuoteResult(quote *models.Quote, req *models.QuoteRequest) error {
	if quote == nil {
		return fmt.Errorf("quote is nil")
	}

	// Basic validation
	if quote.Provider != "lifi" {
		return fmt.Errorf("invalid provider: %s", quote.Provider)
	}

	if quote.ToAmount.IsZero() {
		return fmt.Errorf("to_amount is zero")
	}

	if quote.Price.IsZero() {
		return fmt.Errorf("price is zero")
	}

	// Amount validation
	if !quote.FromAmount.Equal(req.Amount) {
		return fmt.Errorf("from_amount mismatch: expected %s, got %s", req.Amount.String(), quote.FromAmount.String())
	}

	// Cross-chain validation - only validate if ToChainID is specified
	if req.ToChainID > 0 {
		// For cross-chain quotes, the quote should have ToToken with the target chain ID
		if quote.ToToken != nil && quote.ToToken.ChainID != req.ToChainID {
			return fmt.Errorf("to_chain_id mismatch: expected %d, got %d", req.ToChainID, quote.ToToken.ChainID)
		}
	}

	// Price impact validation (LiFi standard: max 30%)
	if err := v.validatePriceImpact(quote, req); err != nil {
		logrus.WithError(err).Warn("Price impact validation failed")
		// Don't fail the quote, just warn
	}

	// Expiration validation
	if quote.ExpiresAt.Before(time.Now().Add(10 * time.Second)) {
		logrus.Warn("Quote expires very soon")
	}

	return nil
}

// validatePriceImpact validates price impact is within acceptable range
func (v *ValidationUtils) validatePriceImpact(quote *models.Quote, req *models.QuoteRequest) error {
	// Calculate price impact if we have USD values in metadata
	if metadata, ok := quote.Metadata["fromAmountUSD"].(string); ok {
		fromUSD, err := decimal.NewFromString(metadata)
		if err == nil {
			if toUSDMetadata, ok := quote.Metadata["toAmountUSD"].(string); ok {
				toUSD, err := decimal.NewFromString(toUSDMetadata)
				if err == nil && !fromUSD.IsZero() {
					priceImpact := fromUSD.Sub(toUSD).Div(fromUSD).Mul(decimal.NewFromInt(100))
					
					// LiFi standard: warn if price impact > 30%
					if priceImpact.GreaterThan(decimal.NewFromInt(30)) {
						return fmt.Errorf("high price impact: %.2f%%", priceImpact.InexactFloat64())
					}
				}
			}
		}
	}

	return nil
}

// IsRetryableError determines if an error from LiFi API is retryable
func (v *ValidationUtils) IsRetryableError(err error) bool {
	if err == nil {
		return false
	}

	errorStr := strings.ToLower(err.Error())
	
	// Network errors are retryable
	retryablePatterns := []string{
		"timeout",
		"connection refused",
		"network",
		"temporary",
		"rate limit",
		"too many requests",
		"internal server error",
		"bad gateway",
		"service unavailable",
		"gateway timeout",
	}

	for _, pattern := range retryablePatterns {
		if strings.Contains(errorStr, pattern) {
			return true
		}
	}

	return false
}

// SanitizeTokenAddress normalizes token address format
func (v *ValidationUtils) SanitizeTokenAddress(address string) string {
	// Remove whitespace
	address = strings.TrimSpace(address)
	
	// Convert to lowercase for consistency
	address = strings.ToLower(address)
	
	// Handle native token representations
	if address == "" || address == "0x0000000000000000000000000000000000000000" {
		return "0x0000000000000000000000000000000000000000"
	}
	
	// Ensure it starts with 0x
	if !strings.HasPrefix(address, "0x") {
		address = "0x" + address
	}
	
	return address
} 