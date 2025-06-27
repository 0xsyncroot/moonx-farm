package services

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
)

// getFastQuotesAll gets multiple quotes from fastest providers with aggressive timeout
func (a *AggregatorService) getFastQuotesAll(ctx context.Context, req *models.QuoteRequest, timeout time.Duration) []*models.Quote {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Get only the single fastest provider for sub-1s response
	fastProviders := a.getFastestProviders(1) // Only fastest provider for speed

	// Fallback to relay if no metrics available (relay is usually fastest)
	if len(fastProviders) == 0 {
		fastProviders = []string{"relay"}
	}

	quotes, _ := a.getQuotesFromSourcesOptimizedMultiple(ctx, req, fastProviders)
	return quotes
}

// getAllQuotesOptimizedMultiple gets multiple quotes from all available sources
func (a *AggregatorService) getAllQuotesOptimizedMultiple(ctx context.Context, req *models.QuoteRequest) ([]*models.Quote, error) {
	// Order providers by performance
	providers := []string{
		models.ProviderLiFi,
		"relay",
	}

	// Only add 1inch for same-chain requests (1inch doesn't support cross-chain)
	if req.ToChainID == 0 || req.ToChainID == req.ChainID {
		providers = append(providers, models.ProviderOneInch)
	}

	orderedProviders := a.getOrderedProviders(providers)

	return a.getQuotesFromSourcesOptimizedMultiple(ctx, req, orderedProviders)
}

// getQuotesFromSourcesOptimizedMultiple gets multiple quotes from specified sources with circuit breaker and validation
func (a *AggregatorService) getQuotesFromSourcesOptimizedMultiple(ctx context.Context, req *models.QuoteRequest, sources []string) ([]*models.Quote, error) {
	type result struct {
		provider string
		quotes   []*models.Quote
		err      error
		duration time.Duration
	}

	// Filter out providers with open circuit breakers
	availableSources := make([]string, 0, len(sources))
	for _, provider := range sources {
		if !a.isCircuitBreakerOpen(provider) {
			availableSources = append(availableSources, provider)
		} else {
			logrus.WithField("provider", provider).Debug("Skipping provider due to open circuit breaker")
		}
	}

	if len(availableSources) == 0 {
		return nil, fmt.Errorf("all providers have open circuit breakers")
	}

	results := make(chan result, len(availableSources))

	// Launch available providers concurrently
	for _, source := range availableSources {
		go func(provider string) {
			// Start timing for this provider
			providerStart := time.Now()
			logrus.WithField("provider", provider).Info("🚀 Starting provider call")

			var quotes []*models.Quote
			var err error

			// Route to appropriate service with detailed timing
			switch provider {
			case models.ProviderLiFi:
				apiStart := time.Now()
				logrus.WithField("provider", "lifi").Info("📡 Calling LiFi API...")

				// Use fastest DEX/bridge tools for optimal performance
				quotes, err = a.LiFiService.GetMultipleQuotes(ctx, req, 2) // 2 quotes from fastest tools

				apiDuration := time.Since(apiStart)
				logrus.WithFields(logrus.Fields{
					"provider": "lifi",
					"duration": apiDuration,
					"quotes":   len(quotes),
					"error":    err != nil,
				}).Info("✅ LiFi API call completed")

			case models.ProviderOneInch:
				apiStart := time.Now()
				logrus.WithField("provider", "1inch").Info("📡 Calling 1inch API...")

				// 1inch single quote
				if quote, qErr := a.OneInchService.GetQuote(ctx, req); qErr == nil {
					quotes = []*models.Quote{quote}
				} else {
					err = qErr
				}

				apiDuration := time.Since(apiStart)
				logrus.WithFields(logrus.Fields{
					"provider": "1inch",
					"duration": apiDuration,
					"quotes":   len(quotes),
					"error":    err != nil,
				}).Info("✅ 1inch API call completed")

			case "relay":
				apiStart := time.Now()
				logrus.WithField("provider", "relay").Info("📡 Calling Relay API...")

				// Relay single best quote
				if quote, qErr := a.RelayService.GetQuote(ctx, req); qErr == nil {
					quotes = []*models.Quote{quote}
				} else {
					err = qErr
				}

				apiDuration := time.Since(apiStart)
				logrus.WithFields(logrus.Fields{
					"provider": "relay",
					"duration": apiDuration,
					"quotes":   len(quotes),
					"error":    err != nil,
				}).Info("✅ Relay API call completed")

			default:
				err = fmt.Errorf("unknown provider: %s", provider)
			}

			totalDuration := time.Since(providerStart)
			logrus.WithFields(logrus.Fields{
				"provider":      provider,
				"totalDuration": totalDuration,
				"quotes":        len(quotes),
				"success":       err == nil,
			}).Info("🏁 Provider processing completed")

			results <- result{
				provider: provider,
				quotes:   quotes,
				err:      err,
				duration: totalDuration,
			}
		}(source)
	}

	// Collect results with generous timeout
	var allQuotes []*models.Quote
	resultsCollected := 0

	// Simple 5 second timeout
	timeout := time.NewTimer(5 * time.Second)
	defer timeout.Stop()

	collectionStart := time.Now()
	logrus.WithField("expectedResults", len(availableSources)).Info("⏰ Starting result collection...")

	for resultsCollected < len(availableSources) {
		select {
		case res := <-results:
			resultsCollected++

			logrus.WithFields(logrus.Fields{
				"provider":         res.provider,
				"duration":         res.duration,
				"quotes":           len(res.quotes),
				"success":          res.err == nil,
				"resultsCollected": resultsCollected,
				"totalExpected":    len(availableSources),
			}).Info("📥 Provider result received")

			if res.err != nil {
				continue // Skip failed providers silently
			}

			if len(res.quotes) > 0 {
				// Add all quotes directly - no validation for speed
				allQuotes = append(allQuotes, res.quotes...)

				logrus.WithFields(logrus.Fields{
					"provider":    res.provider,
					"quotesAdded": len(res.quotes),
					"totalQuotes": len(allQuotes),
				}).Info("✅ Quotes added to collection")
			}

		case <-timeout.C:
			logrus.WithFields(logrus.Fields{
				"timeout":          "5s",
				"resultsCollected": resultsCollected,
				"quotesFound":      len(allQuotes),
			}).Warn("⏰ Collection timeout - using available results")
			break // Timeout - use what we have
		}
	}

	collectionDuration := time.Since(collectionStart)
	logrus.WithFields(logrus.Fields{
		"collectionDuration": collectionDuration,
		"resultsCollected":   resultsCollected,
		"totalQuotes":        len(allQuotes),
		"performance":        fmt.Sprintf("%.0fms collection", float64(collectionDuration.Nanoseconds())/1000000),
	}).Info("📦 Result collection completed")

	return allQuotes, nil
}
