// Package main provides the main entry point for the API server
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

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/ruvnet/alienator/internal/api/graphql"
	"github.com/ruvnet/alienator/internal/api/rest"
	"github.com/ruvnet/alienator/internal/api/ws"
	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/middleware"
	"github.com/ruvnet/alienator/internal/repository"
	"github.com/ruvnet/alienator/internal/services"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap"
)

// @title Vibecast API
// @version 2.0
// @description This is a comprehensive API server with REST, GraphQL, and WebSocket support
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.basic BasicAuth

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization
func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Initialize metrics
	metrics := metrics.NewMetrics()

	// Initialize repository
	repo := repository.NewRepository(cfg, logger)
	defer repo.Close()

	// Initialize services
	anomalyService := services.NewAnomalyService(repo, logger)
	userService := services.NewUserService(repo, logger)
	authService := services.NewAuthService(cfg, logger)

	// Initialize anomaly detector
	detector := core.NewAnomalyDetector(logger, metrics)

	// Initialize Gin router
	router := gin.Default()

	// Global middleware
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery())
	router.Use(middleware.RateLimit(cfg.RateLimit))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "timestamp": time.Now()})
	})

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// REST API routes
	restHandler := rest.NewHandler(detector, anomalyService, userService, authService, logger)
	v1 := router.Group("/api/v1")
	v1.Use(middleware.Auth(authService))
	restHandler.SetupRoutes(v1)

	// GraphQL endpoint (placeholder - implement if needed)
	// gqlResolver := graphql.NewResolver(anomalyService, userService, logger)
	// gqlHandler := handler.NewDefaultServer(graphql.NewExecutableSchema(graphql.Config{Resolvers: gqlResolver}))
	// router.POST("/graphql", gin.WrapH(gqlHandler))
	// router.GET("/playground", gin.WrapH(playground.Handler("GraphQL playground", "/graphql")))

	// WebSocket endpoint
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	wsHandler := ws.NewHandler(detector, upgrader, logger)
	router.GET("/ws", wsHandler.HandleWebSocket)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Starting API server",
			zap.Int("port", cfg.Port),
			zap.String("environment", cfg.Environment),
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited gracefully")
}
