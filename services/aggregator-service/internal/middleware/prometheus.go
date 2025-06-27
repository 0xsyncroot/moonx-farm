package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/moonx-farm/aggregator-service/internal/metrics"
	"github.com/sirupsen/logrus"
)

// PrometheusMetrics middleware for tracking HTTP metrics
func PrometheusMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Increment requests in progress
		metrics.HTTPRequestsInProgress.Inc()
		defer metrics.HTTPRequestsInProgress.Dec()

		// Process request
		c.Next()

		// Record metrics after request is processed
		duration := time.Since(start)

		// Get route name (use path if route is empty)
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		// Record request metrics
		metrics.RecordHTTPRequest(
			c.Request.Method,
			route,
			strconv.Itoa(c.Writer.Status()),
			duration,
		)

		// Log slow requests
		if duration.Seconds() > 1.0 {
			logrus.WithFields(logrus.Fields{
				"method":   c.Request.Method,
				"path":     c.Request.URL.Path,
				"duration": duration.Seconds(),
				"status":   c.Writer.Status(),
			}).Warn("Slow request detected")
		}
	}
}

// RedisMetrics records Redis operation metrics
func RedisMetrics(operation string, status string) {
	metrics.RecordRedisOperation(operation, status)
}

// ProviderMetrics records provider API metrics
func ProviderMetrics(provider string, duration time.Duration, success bool) {
	metrics.RecordProviderRequest(provider, duration, success)
}
