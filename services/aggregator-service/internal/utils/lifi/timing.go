package lifi

import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
)

// TimingUtils provides timing utilities for LiFi service
type TimingUtils struct{}

// NewTimingUtils creates a new timing utils instance
func NewTimingUtils() *TimingUtils {
	return &TimingUtils{}
}

// CreateContextWithTimeout creates context with appropriate timeout for LiFi operations
func (t *TimingUtils) CreateContextWithTimeout(parentCtx context.Context, operation string) (context.Context, context.CancelFunc) {
	var timeout time.Duration
	
	switch operation {
	case "quote":
		timeout = 8 * time.Second // LiFi quotes can be slow
	case "tokens":
		timeout = 15 * time.Second // Token list can be large
	case "chains":
		timeout = 5 * time.Second // Chain list is smaller
	default:
		timeout = 10 * time.Second // Default timeout
	}
	
	ctx, cancel := context.WithTimeout(parentCtx, timeout)
	
	logrus.WithFields(logrus.Fields{
		"operation": operation,
		"timeout":   timeout,
	}).Debug("Created context with timeout for LiFi operation")
	
	return ctx, cancel
}

// MeasureExecutionTime measures and logs execution time for LiFi operations
func (t *TimingUtils) MeasureExecutionTime(operation string, startTime time.Time) {
	duration := time.Since(startTime)
	
	logLevel := logrus.InfoLevel
	if duration > 5*time.Second {
		logLevel = logrus.WarnLevel
	}
	
	logrus.WithFields(logrus.Fields{
		"operation": operation,
		"duration":  duration,
		"provider":  "lifi",
	}).Log(logLevel, "LiFi operation completed")
}

// CalculateRetryDelay calculates exponential backoff delay for retries
func (t *TimingUtils) CalculateRetryDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return 0
	}
	
	// Exponential backoff: 100ms, 200ms, 400ms, 800ms
	baseDelay := 100 * time.Millisecond
	delay := baseDelay * time.Duration(1<<uint(attempt-1))
	
	// Cap at 1 second
	if delay > time.Second {
		delay = time.Second
	}
	
	return delay
}

// ShouldTimeout checks if we should timeout the operation based on context
func (t *TimingUtils) ShouldTimeout(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return true
	default:
		return false
	}
}

// GetRemainingTime returns remaining time in context
func (t *TimingUtils) GetRemainingTime(ctx context.Context) time.Duration {
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < 0 {
			return 0
		}
		return remaining
	}
	return time.Hour // Large duration if no deadline
}

// CreateProgressiveTimeouts creates timeouts that get progressively longer
func (t *TimingUtils) CreateProgressiveTimeouts(baseTimeout time.Duration, steps int) []time.Duration {
	timeouts := make([]time.Duration, steps)
	
	for i := 0; i < steps; i++ {
		// Progressive increase: 1x, 1.5x, 2x, 2.5x...
		multiplier := 1.0 + (float64(i) * 0.5)
		timeouts[i] = time.Duration(float64(baseTimeout) * multiplier)
	}
	
	return timeouts
}

// IsTimeoutError checks if error is a timeout error
func (t *TimingUtils) IsTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	
	// Check for context timeout
	if err == context.DeadlineExceeded {
		return true
	}
	
	// Check for context cancellation
	if err == context.Canceled {
		return true
	}
	
	return false
} 