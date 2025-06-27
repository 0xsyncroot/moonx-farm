package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Prometheus metrics
var (
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "route", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)

	HTTPRequestsInProgress = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_progress",
			Help: "Number of HTTP requests currently in progress",
		},
	)

	RedisOperationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "redis_operations_total",
			Help: "Total number of Redis operations",
		},
		[]string{"operation", "status"},
	)

	ProviderRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "provider_requests_total",
			Help: "Total number of provider API requests",
		},
		[]string{"provider", "status"},
	)

	ProviderResponseTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "provider_response_time_seconds",
			Help:    "Provider API response time in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"provider"},
	)

	CacheHitsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_type"},
	)

	CacheMissesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_type"},
	)
)

// Init registers all Prometheus metrics
func Init() {
	prometheus.MustRegister(HTTPRequestsTotal)
	prometheus.MustRegister(HTTPRequestDuration)
	prometheus.MustRegister(HTTPRequestsInProgress)
	prometheus.MustRegister(RedisOperationsTotal)
	prometheus.MustRegister(ProviderRequestsTotal)
	prometheus.MustRegister(ProviderResponseTime)
	prometheus.MustRegister(CacheHitsTotal)
	prometheus.MustRegister(CacheMissesTotal)
}

// RecordHTTPRequest records HTTP request metrics
func RecordHTTPRequest(method, route, status string, duration time.Duration) {
	HTTPRequestsTotal.WithLabelValues(method, route, status).Inc()
	HTTPRequestDuration.WithLabelValues(method, route).Observe(duration.Seconds())
}

// RecordRedisOperation records Redis operation metrics
func RecordRedisOperation(operation, status string) {
	RedisOperationsTotal.WithLabelValues(operation, status).Inc()
}

// RecordProviderRequest records provider API metrics
func RecordProviderRequest(provider string, duration time.Duration, success bool) {
	status := "success"
	if !success {
		status = "error"
	}

	ProviderRequestsTotal.WithLabelValues(provider, status).Inc()
	ProviderResponseTime.WithLabelValues(provider).Observe(duration.Seconds())
}

// RecordCacheHit records cache hit metrics
func RecordCacheHit(cacheType string) {
	CacheHitsTotal.WithLabelValues(cacheType).Inc()
}

// RecordCacheMiss records cache miss metrics
func RecordCacheMiss(cacheType string) {
	CacheMissesTotal.WithLabelValues(cacheType).Inc()
}
