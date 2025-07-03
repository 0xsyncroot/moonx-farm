package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
)

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RequestsPerMinute int
	BurstSize         int
}

// RateLimiter holds rate limiters for different clients
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	config   RateLimitConfig
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(config RateLimitConfig) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		config:   config,
	}
}

// GetLimiter returns rate limiter for a client
func (rl *RateLimiter) GetLimiter(clientID string) *rate.Limiter {
	rl.mu.RLock()
	limiter, exists := rl.limiters[clientID]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		// Double check after acquiring write lock
		if limiter, exists = rl.limiters[clientID]; !exists {
			limiter = rate.NewLimiter(
				rate.Every(time.Minute/time.Duration(rl.config.RequestsPerMinute)),
				rl.config.BurstSize,
			)
			rl.limiters[clientID] = limiter
		}
		rl.mu.Unlock()
	}

	return limiter
}

// RateLimit middleware for rate limiting requests
func RateLimit(cfg *config.Config) gin.HandlerFunc {
	limiter := NewRateLimiter(RateLimitConfig{
		RequestsPerMinute: cfg.RateLimit.RequestsPerMinute,
		BurstSize:         cfg.RateLimit.BurstSize,
	})

	return gin.HandlerFunc(func(c *gin.Context) {
		clientIP := c.ClientIP()

		// Get rate limiter for this client
		clientLimiter := limiter.GetLimiter(clientIP)

		// Check if request is allowed
		if !clientLimiter.Allow() {
			response := &models.ErrorResponse{
				Error:   "Too Many Requests",
				Message: "Rate limit exceeded. Please try again later.",
				Code:    http.StatusTooManyRequests,
			}
			c.JSON(http.StatusTooManyRequests, response)
			c.Abort()
			return
		}

		c.Next()
	})
}
