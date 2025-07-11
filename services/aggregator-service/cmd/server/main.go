package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	swaggerfiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gopkg.in/natefinch/lumberjack.v2"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/handlers"
	"github.com/moonx-farm/aggregator-service/internal/metrics"
	"github.com/moonx-farm/aggregator-service/internal/middleware"
	"github.com/moonx-farm/aggregator-service/internal/services"
	"github.com/moonx-farm/aggregator-service/internal/storage"

	_ "github.com/moonx-farm/aggregator-service/docs" // Import swagger docs
)

// @title MoonXFarm Aggregator Service API
// @version 1.0
// @description Aggregator service for MoonXFarm DEX - Aggregates prices and routes from multiple DEX sources
// @termsOfService http://swagger.io/terms/

// @contact.name MoonXFarm Team
// @contact.email support@moonxfarm.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:3003
// @BasePath /api/v1

// @schemes http https

func main() {
	// Initialize Prometheus metrics
	metrics.Init()

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		logrus.Info("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Setup logger
	setupLogger(cfg.LogLevel)

	logrus.Info("Starting MoonXFarm Aggregator Service...")
	logrus.Infof("Environment: %s", cfg.Environment)
	logrus.Infof("Port: %d", cfg.Port)

	// Initialize storage
	redisClient, err := storage.NewRedisClient(cfg.Redis)
	if err != nil {
		logrus.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	logrus.Info("Connected to Redis successfully")

	// Initialize services
	cacheService := services.NewCacheService(redisClient, cfg.Cache)
	lifiService := services.NewLiFiService(cfg.ExternalAPIs, cacheService)
	oneInchService := services.NewOneInchService(cfg.ExternalAPIs, cacheService)
	relayService := services.NewRelayService(cfg.ExternalAPIs, cacheService)
	externalAPIService := services.NewExternalAPIService(cacheService, cfg, logrus.StandardLogger())
	aggregatorService := services.NewAggregatorService(
		lifiService,
		oneInchService,
		relayService,
		cacheService,
		externalAPIService,
		cfg.Environment,
	)

	// Initialize handlers
	quoteHandler := handlers.NewQuoteHandler(aggregatorService)
	healthHandler := handlers.NewHealthHandler(redisClient)

	// Start cache warmup in background
	go func() {
		logrus.Info("Starting cache warmup...")
		time.Sleep(5 * time.Second) // Wait for services to be ready
		aggregatorService.WarmupSearchCache(context.Background())
	}()

	// Setup router
	router := setupRouter(cfg, quoteHandler, healthHandler)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logrus.Infof("Server starting on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Start metrics server if enabled
	if cfg.Environment == "production" || os.Getenv("PROMETHEUS_METRICS_ENABLED") == "true" {
		metricsPort := 9090
		if envPort := os.Getenv("PROMETHEUS_METRICS_PORT"); envPort != "" {
			if port, err := fmt.Sscanf(envPort, "%d", &metricsPort); err == nil && port == 1 {
				// port is set
			}
		}

		go func() {
			metricsMux := http.NewServeMux()
			metricsMux.Handle("/metrics", promhttp.Handler())

			metricsServer := &http.Server{
				Addr:         fmt.Sprintf(":%d", metricsPort),
				Handler:      metricsMux,
				ReadTimeout:  5 * time.Second,
				WriteTimeout: 5 * time.Second,
			}

			logrus.Infof("Metrics server starting on port %d", metricsPort)
			if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logrus.Errorf("Failed to start metrics server: %v", err)
			}
		}()
	}

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logrus.Errorf("Server forced to shutdown: %v", err)
	}

	logrus.Info("Server exited")
}

func setupRouter(cfg *config.Config, quoteHandler *handlers.QuoteHandler, healthHandler *handlers.HealthHandler) *gin.Engine {
	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.RateLimit(cfg))
	router.Use(middleware.PrometheusMetrics()) // Add Prometheus metrics middleware

	// Health check endpoints (both at root and in API group for flexibility)
	router.GET("/health", healthHandler.HealthCheck)
	router.GET("/ready", healthHandler.ReadinessCheck)

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Health check endpoints in API group
		v1.GET("/health", healthHandler.HealthCheck)
		v1.GET("/ready", healthHandler.ReadinessCheck)

		// Single unified quote endpoint for best quote (same-chain & cross-chain)
		v1.GET("/quote", quoteHandler.GetBestQuote)

		// Single unified token search endpoint
		v1.GET("/tokens/search", quoteHandler.SearchTokens)

		// Popular tokens endpoint with Binance prices
		v1.GET("/tokens/popular", quoteHandler.GetPopularTokens)
	}

	// Swagger documentation (only in development)
	if cfg.Environment == "development" {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))
		logrus.Info("Swagger documentation available at: http://localhost:3003/swagger/index.html")
	}

	return router
}

func setupLogger(level string) {
	// Set log level
	switch level {
	case "debug":
		logrus.SetLevel(logrus.DebugLevel)
	case "info":
		logrus.SetLevel(logrus.InfoLevel)
	case "warn":
		logrus.SetLevel(logrus.WarnLevel)
	case "error":
		logrus.SetLevel(logrus.ErrorLevel)
	default:
		logrus.SetLevel(logrus.InfoLevel)
	}

	// Check if ELK logging is enabled
	if os.Getenv("ELK_LOGGING_ENABLED") == "true" {
		setupELKLogger()
	} else {
		// Default JSON formatter for stdout
		logrus.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.RFC3339,
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
			},
		})
	}
}

func setupELKLogger() {
	// Create multi-writer to send logs to both stdout and file
	logFile := &lumberjack.Logger{
		Filename:   "/var/log/aggregator-service/app.log",
		MaxSize:    10, // MB
		MaxBackups: 3,
		MaxAge:     28,   // days
		Compress:   true, // compress rotated files
	}

	// Set JSON formatter with ELK-friendly fields
	logrus.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339,
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "@timestamp",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "message",
			logrus.FieldKeyFunc:  "function",
			logrus.FieldKeyFile:  "file",
		},
	})

	// Add service metadata to all logs
	logrus.AddHook(&ELKMetadataHook{
		Service:     "aggregator-service",
		Version:     os.Getenv("APP_VERSION"),
		Environment: os.Getenv("ENVIRONMENT"),
		Host:        os.Getenv("HOSTNAME"),
	})

	// Set output to both stdout and file
	logrus.SetOutput(logFile)

	logrus.Info("ELK logging configured successfully")
}

// ELKMetadataHook adds metadata for ELK stack
type ELKMetadataHook struct {
	Service     string
	Version     string
	Environment string
	Host        string
}

func (h *ELKMetadataHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (h *ELKMetadataHook) Fire(entry *logrus.Entry) error {
	entry.Data["service"] = h.Service
	entry.Data["version"] = h.Version
	entry.Data["environment"] = h.Environment
	entry.Data["host"] = h.Host
	entry.Data["log_type"] = "application"
	return nil
}
