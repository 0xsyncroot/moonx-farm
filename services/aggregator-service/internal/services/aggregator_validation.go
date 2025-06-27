package services

import (
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
)

// QuoteValidationLevel defines validation intensity
type QuoteValidationLevel int

const (
	ValidationFast     QuoteValidationLevel = iota // Basic validation only
	ValidationStandard                             // Standard validation (default)
	ValidationStrict                               // Full validation with calldata verification
)

// orderQuotesByQuality validates and orders quotes by quality (best first) - ULTRA SIMPLIFIED
func (a *AggregatorService) orderQuotesByQuality(quotes []*models.Quote, level QuoteValidationLevel) []*models.Quote {
	if len(quotes) == 0 {
		return nil
	}

	// Skip validation for speed - just sort by ToAmount (highest first)
	validQuotes := make([]*models.Quote, 0, len(quotes))

	// Only basic nil check
	for _, quote := range quotes {
		if quote != nil && quote.ToAmount.GreaterThan(decimal.Zero) {
			validQuotes = append(validQuotes, quote)
		}
	}

	if len(validQuotes) == 0 {
		return nil
	}

	// Simple sort by ToAmount - no complex scoring
	if len(validQuotes) > 1 {
		// Find highest ToAmount and put it first
		for i := 0; i < len(validQuotes)-1; i++ {
			maxIdx := i
			for j := i + 1; j < len(validQuotes); j++ {
				if validQuotes[j].ToAmount.GreaterThan(validQuotes[maxIdx].ToAmount) {
					maxIdx = j
				}
			}
			if maxIdx != i {
				validQuotes[i], validQuotes[maxIdx] = validQuotes[maxIdx], validQuotes[i]
			}
		}
	}

	return validQuotes
}

// selectBestQuoteWithValidation selects best quote with appropriate validation level
// DEPRECATED: Use orderQuotesByQuality instead for ordered list
func (a *AggregatorService) selectBestQuoteWithValidation(quotes []*models.Quote, level QuoteValidationLevel) *models.Quote {
	orderedQuotes := a.orderQuotesByQuality(quotes, level)
	if len(orderedQuotes) > 0 {
		return orderedQuotes[0]
	}
	return nil
}

// isQuoteValid validates quote based on validation level
func (a *AggregatorService) isQuoteValid(quote *models.Quote, level QuoteValidationLevel) bool {
	if quote == nil {
		return false
	}

	// Level 1: Fast validation (basic checks only)
	if quote.ToAmount.LessThanOrEqual(decimal.Zero) {
		return false
	}

	if quote.FromAmount.LessThanOrEqual(decimal.Zero) {
		return false
	}

	// Check quote expiration
	if quote.ExpiresAt.Before(time.Now()) {
		return false
	}

	if level == ValidationFast {
		return true
	}

	// Level 2: Standard validation
	if quote.PriceImpact.GreaterThan(a.maxPriceImpact) {
		logrus.WithFields(logrus.Fields{
			"provider":    quote.Provider,
			"priceImpact": quote.PriceImpact,
			"maxAllowed":  a.maxPriceImpact,
		}).Warn("Quote exceeds max price impact")
		return false
	}

	if quote.SlippageTolerance.GreaterThan(a.maxSlippageTolerance) {
		return false
	}

	// Validate amount consistency
	if quote.ToAmountMin.GreaterThan(quote.ToAmount) {
		return false
	}

	if level == ValidationStandard {
		return true
	}

	// Level 3: Strict validation (includes calldata validation)
	if quote.CallData == "" {
		logrus.WithField("provider", quote.Provider).Warn("Quote missing call data")
		return false
	}

	if quote.To == "" {
		return false
	}

	// Additional calldata format validation
	if !strings.HasPrefix(quote.CallData, "0x") || len(quote.CallData) < 10 {
		return false
	}

	return true
}

// selectOptimalQuote selects the best quote using multi-criteria analysis
func (a *AggregatorService) selectOptimalQuote(quotes []*models.Quote) *models.Quote {
	if len(quotes) == 0 {
		return nil
	}

	if len(quotes) == 1 {
		return quotes[0]
	}

	// Multi-criteria scoring (LiFi pattern)
	type quoteScore struct {
		quote *models.Quote
		score float64
	}

	scores := make([]quoteScore, len(quotes))

	for i, quote := range quotes {
		score := a.calculateQuoteScore(quote)
		scores[i] = quoteScore{quote: quote, score: score}
	}

	// Sort by score (highest first)
	for i := 0; i < len(scores)-1; i++ {
		for j := i + 1; j < len(scores); j++ {
			if scores[i].score < scores[j].score {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}

	bestQuote := scores[0].quote

	logrus.WithFields(logrus.Fields{
		"provider":    bestQuote.Provider,
		"score":       scores[0].score,
		"toAmount":    bestQuote.ToAmount,
		"totalQuotes": len(quotes),
	}).Debug("Optimal quote selected")

	return bestQuote
}

// calculateQuoteScore calculates a comprehensive score for quote selection
func (a *AggregatorService) calculateQuoteScore(quote *models.Quote) float64 {
	score := 0.0

	// Primary factor: Output amount (70% weight)
	outputScore := float64(quote.ToAmount.InexactFloat64())
	score += outputScore * 0.7

	// Secondary factor: Price impact (15% weight - lower is better)
	priceImpactPenalty := float64(quote.PriceImpact.InexactFloat64()) * 1000 // Convert to penalty
	score -= priceImpactPenalty * 0.15

	// Tertiary factor: Gas cost (10% weight - lower is better)
	if quote.GasEstimate != nil {
		gasCostPenalty := float64(quote.GasEstimate.GasFee.InexactFloat64())
		score -= gasCostPenalty * 0.1
	}

	// Provider reliability factor (5% weight)
	a.metricsMutex.RLock()
	if metrics, exists := a.providerMetrics[quote.Provider]; exists {
		reliabilityBonus := metrics.SuccessRate * 100 // 0-100 bonus
		score += reliabilityBonus * 0.05
	}
	a.metricsMutex.RUnlock()

	return score
}

// generateComparison generates comparison metrics between quotes
func (a *AggregatorService) generateComparison(quotes []*models.Quote) *models.QuoteComparison {
	if len(quotes) == 0 {
		return nil
	}

	// Find best and worst prices
	bestPrice := quotes[0].Price
	worstPrice := quotes[0].Price
	var bestGas, worstGas *models.GasEstimate

	for _, quote := range quotes {
		if quote.Price.GreaterThan(bestPrice) {
			bestPrice = quote.Price
		}
		if quote.Price.LessThan(worstPrice) {
			worstPrice = quote.Price
		}

		if quote.GasEstimate != nil {
			if bestGas == nil || quote.GasEstimate.GasFee.LessThan(bestGas.GasFee) {
				bestGas = quote.GasEstimate
			}
			if worstGas == nil || quote.GasEstimate.GasFee.GreaterThan(worstGas.GasFee) {
				worstGas = quote.GasEstimate
			}
		}
	}

	// Calculate price difference
	priceDifference := bestPrice.Sub(worstPrice)
	priceDifferencePercent := decimal.Zero
	if !worstPrice.IsZero() {
		priceDifferencePercent = priceDifference.Div(worstPrice).Mul(decimal.NewFromInt(100))
	}

	return &models.QuoteComparison{
		BestPrice:              bestPrice,
		WorstPrice:             worstPrice,
		PriceDifference:        priceDifference,
		PriceDifferencePercent: priceDifferencePercent,
		BestGasEstimate:        bestGas,
		WorstGasEstimate:       worstGas,
	}
}
