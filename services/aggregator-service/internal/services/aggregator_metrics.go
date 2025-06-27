package services

import (
	"sort"
	"time"

	"github.com/sirupsen/logrus"
)

// ProviderMetrics tracks performance metrics for each provider (1inch pattern)
type ProviderMetrics struct {
	AvgResponseTime time.Duration
	SuccessRate     float64
	LastUsed        time.Time
	TotalRequests   int64
	SuccessCount    int64
	ErrorCount      int64
	LastError       string
	LastErrorTime   time.Time
}

// CircuitBreaker implements circuit breaker pattern for provider reliability
type CircuitBreaker struct {
	State         string    // CLOSED, OPEN, HALF_OPEN
	FailureCount  int64
	LastFailTime  time.Time
	NextRetryTime time.Time
	FailureThreshold int64
	RecoveryTimeout  time.Duration
}

// isCircuitBreakerOpen checks if circuit breaker is open for provider
func (a *AggregatorService) isCircuitBreakerOpen(provider string) bool {
	a.cbMutex.RLock()
	defer a.cbMutex.RUnlock()
	
	cb, exists := a.circuitBreakers[provider]
	if !exists {
		return false
	}
	
	if cb.State == "OPEN" {
		if time.Now().After(cb.NextRetryTime) {
			// Transition to HALF_OPEN
			cb.State = "HALF_OPEN"
			logrus.WithField("provider", provider).Info("Circuit breaker transitioning to HALF_OPEN")
		} else {
			return true
		}
	}
	
	return false
}

// recordProviderResult updates circuit breaker and metrics
func (a *AggregatorService) recordProviderResult(provider string, success bool, duration time.Duration, err error) {
	// Update metrics
	a.updateProviderMetrics(provider, duration, success)
	
	// Update circuit breaker
	a.cbMutex.Lock()
	defer a.cbMutex.Unlock()
	
	cb, exists := a.circuitBreakers[provider]
	if !exists {
		cb = &CircuitBreaker{
			State:            "CLOSED",
			FailureThreshold: 5,                // 5 failures threshold
			RecoveryTimeout:  30 * time.Second, // 30s recovery
		}
		a.circuitBreakers[provider] = cb
	}
	
	if success {
		cb.FailureCount = 0
		if cb.State == "HALF_OPEN" {
			cb.State = "CLOSED"
			logrus.WithField("provider", provider).Info("Circuit breaker closed")
		}
	} else {
		cb.FailureCount++
		cb.LastFailTime = time.Now()
		
		if cb.FailureCount >= cb.FailureThreshold && cb.State == "CLOSED" {
			cb.State = "OPEN"
			cb.NextRetryTime = time.Now().Add(cb.RecoveryTimeout)
			logrus.WithFields(logrus.Fields{
				"provider":     provider,
				"failureCount": cb.FailureCount,
				"nextRetry":    cb.NextRetryTime,
			}).Warn("Circuit breaker opened")
		}
	}
}

// getFastestProviders returns providers ordered by performance
func (a *AggregatorService) getFastestProviders(limit int) []string {
	allProviders := []string{
		"lifi",
		"1inch",
		"relay",
	}
	
	orderedProviders := a.getOrderedProviders(allProviders)
	
	if limit > 0 && limit < len(orderedProviders) {
		return orderedProviders[:limit]
	}
	
	return orderedProviders
}

// getOrderedProviders returns providers ordered by performance metrics
func (a *AggregatorService) getOrderedProviders(providers []string) []string {
	a.metricsMutex.RLock()
	defer a.metricsMutex.RUnlock()

	type providerScore struct {
		provider string
		score    float64
	}

	scores := make([]providerScore, 0, len(providers))
	for _, provider := range providers {
		metric := a.providerMetrics[provider]
		if metric == nil {
			// Default score for new providers
			scores = append(scores, providerScore{provider: provider, score: 1000.0})
			continue
		}

		// Score = response time (ms) + failure penalty
		score := float64(metric.AvgResponseTime.Milliseconds())
		if metric.SuccessRate < 0.9 {
			score += 500 // penalty for low success rate
		}
		
		scores = append(scores, providerScore{provider: provider, score: score})
	}

	// Sort by score (lower is better)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].score < scores[j].score
	})

	ordered := make([]string, len(scores))
	for i, score := range scores {
		ordered[i] = score.provider
	}

	return ordered
}

// updateProviderMetrics updates performance metrics for providers
func (a *AggregatorService) updateProviderMetrics(provider string, duration time.Duration, success bool) {
	a.metricsMutex.Lock()
	defer a.metricsMutex.Unlock()

	metric, exists := a.providerMetrics[provider]
	if !exists {
		metric = &ProviderMetrics{
			AvgResponseTime: duration,
			SuccessRate:     1.0,
			LastUsed:        time.Now(),
			TotalRequests:   1,
			SuccessCount:    0,
		}
	}

	// Exponential moving average for response time
	alpha := 0.3 // smoothing factor
	metric.AvgResponseTime = time.Duration(float64(metric.AvgResponseTime)*alpha + float64(duration)*(1-alpha))
	
	metric.TotalRequests++
	if success {
		metric.SuccessCount++
	}
	
	// Calculate success rate
	metric.SuccessRate = float64(metric.SuccessCount) / float64(metric.TotalRequests)
	metric.LastUsed = time.Now()

	a.providerMetrics[provider] = metric
} 