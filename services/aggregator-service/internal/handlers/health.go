package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/storage"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	redisClient *storage.RedisClient
	startTime   time.Time
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(redisClient *storage.RedisClient) *HealthHandler {
	return &HealthHandler{
		redisClient: redisClient,
		startTime:   time.Now(),
	}
}

// HealthCheck performs a basic health check
// @Summary Health check
// @Description Check if the service is running
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.HealthResponse
// @Router /health [get]
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	response := &models.HealthResponse{
		Status:    models.StatusHealthy,
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Uptime:    time.Since(h.startTime).String(),
	}

	c.JSON(http.StatusOK, response)
}

// ReadinessCheck performs a readiness check including dependencies
// @Summary Readiness check
// @Description Check if the service is ready to handle requests
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.HealthResponse
// @Failure 503 {object} models.HealthResponse
// @Router /ready [get]
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	checks := make(map[string]string)
	status := models.StatusHealthy
	statusCode := http.StatusOK

	// Check Redis connection
	if err := h.redisClient.Ping(c.Request.Context()); err != nil {
		checks["redis"] = "unhealthy: " + err.Error()
		status = models.StatusUnhealthy
		statusCode = http.StatusServiceUnavailable
	} else {
		checks["redis"] = "healthy"
	}

	response := &models.HealthResponse{
		Status:    status,
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Uptime:    time.Since(h.startTime).String(),
		Checks:    checks,
	}

	c.JSON(statusCode, response)
} 