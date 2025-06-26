package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/quote-service/internal/models"
)

// Recovery middleware for panic recovery
func Recovery() gin.HandlerFunc {
	return gin.RecoveryWithWriter(gin.DefaultWriter, func(c *gin.Context, recovered interface{}) {
		logrus.WithField("recovered", recovered).Error("Panic recovered")

		response := &models.ErrorResponse{
			Error:   "Internal Server Error",
			Message: "An unexpected error occurred",
			Code:    http.StatusInternalServerError,
		}

		c.JSON(http.StatusInternalServerError, response)
	})
} 