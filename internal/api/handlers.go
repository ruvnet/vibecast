package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/models"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for the anomaly detection API
type Handler struct {
	detector *core.AnomalyDetector
	logger   *zap.Logger
}

// NewHandler creates a new API handler
func NewHandler(detector *core.AnomalyDetector, logger *zap.Logger) *Handler {
	return &Handler{
		detector: detector,
		logger:   logger,
	}
}

// SetupRoutes configures the API routes
func (h *Handler) SetupRoutes(router *gin.Engine) {
	v1 := router.Group("/api/v1")
	{
		v1.POST("/analyze", h.AnalyzeText)
		v1.GET("/health", h.HealthCheck)
		v1.GET("/metrics", h.GetMetrics)
	}
}

// AnalyzeTextRequest represents the request payload for text analysis
type AnalyzeTextRequest struct {
	Text    string            `json:"text" binding:"required"`
	Options map[string]string `json:"options,omitempty"`
}

// AnalyzeText handles text analysis requests
func (h *Handler) AnalyzeText(c *gin.Context) {
	var req AnalyzeTextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("Invalid request payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	startTime := time.Now()
	
	result, err := h.detector.AnalyzeText(req.Text)
	if err != nil {
		h.logger.Error("Analysis failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analysis failed"})
		return
	}
	
	duration := time.Since(startTime)
	result.Timestamp = startTime

	response := &models.AnalysisResponse{
		ID:       generateRequestID(),
		Result:   result,
		Duration: duration,
	}

	h.logger.Info("Analysis completed",
		zap.String("request_id", response.ID),
		zap.Float64("score", result.Score),
		zap.Bool("is_anomalous", result.IsAnomalous),
		zap.Duration("duration", duration))

	c.JSON(http.StatusOK, response)
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

// GetMetrics handles metrics requests
func (h *Handler) GetMetrics(c *gin.Context) {
	// TODO: Implement metrics collection
	c.JSON(http.StatusOK, gin.H{
		"total_requests": 0,
		"avg_duration":   0,
		"error_rate":     0,
	})
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	// Simple timestamp-based ID for now
	return time.Now().Format("20060102150405.000")
}