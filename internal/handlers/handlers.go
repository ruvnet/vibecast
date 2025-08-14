package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/ruvnet/alienator/internal/storage"
	"github.com/ruvnet/alienator/pkg/detector"
	"github.com/ruvnet/alienator/pkg/models"
)

// Handlers represents the HTTP handlers
type Handlers struct {
	storage  storage.Storage
	detector *detector.Detector
	logger   *zap.Logger
	upgrader websocket.Upgrader
}

// New creates a new handlers instance
func New(storage storage.Storage, detector *detector.Detector, logger *zap.Logger) *Handlers {
	return &Handlers{
		storage:  storage,
		detector: detector,
		logger:   logger,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
		},
	}
}

// HealthCheck handles health check requests
func (h *Handlers) HealthCheck(w http.ResponseWriter, r *http.Request) {
	response := models.HealthResponse{
		Status:    "ok",
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Uptime:    time.Since(time.Now().Add(-time.Hour)), // Placeholder
		Services: map[string]bool{
			"database": true,  // Should check actual database connectivity
			"detector": true,  // Should check detector status
			"redis":    true,  // Should check Redis connectivity
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetAnomalies handles GET /anomalies
func (h *Handlers) GetAnomalies(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50 // default
	offset := 0 // default

	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}

	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil {
			offset = parsedOffset
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	anomalies, err := h.storage.ListAnomalies(ctx, limit, offset)
	if err != nil {
		h.logger.Error("Failed to list anomalies", zap.Error(err))
		http.Error(w, "Failed to retrieve anomalies", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"anomalies": anomalies,
		"total":     len(anomalies), // In production, get actual count
	})
}

// GetAnomaly handles GET /anomalies/{id}
func (h *Handlers) GetAnomaly(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if id == "" {
		http.Error(w, "Missing anomaly ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	anomaly, err := h.storage.GetAnomaly(ctx, id)
	if err != nil {
		h.logger.Error("Failed to get anomaly", zap.String("id", id), zap.Error(err))
		http.Error(w, "Anomaly not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(anomaly)
}

// CreateAnomaly handles POST /anomalies
func (h *Handlers) CreateAnomaly(w http.ResponseWriter, r *http.Request) {
	var anomaly models.Anomaly
	if err := json.NewDecoder(r.Body).Decode(&anomaly); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if anomaly.ID == "" {
		anomaly.ID = generateID() // You need to implement this function
	}

	// Set timestamps
	now := time.Now()
	anomaly.CreatedAt = now
	anomaly.UpdatedAt = now
	if anomaly.DetectedAt.IsZero() {
		anomaly.DetectedAt = now
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := h.storage.CreateAnomaly(ctx, &anomaly); err != nil {
		h.logger.Error("Failed to create anomaly", zap.Error(err))
		http.Error(w, "Failed to create anomaly", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(anomaly)
}

// DetectAnomaly handles POST /detect
func (h *Handlers) DetectAnomaly(w http.ResponseWriter, r *http.Request) {
	var request models.DetectRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if len(request.DataPoints) == 0 {
		http.Error(w, "No data points provided", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	startTime := time.Now()

	// Perform anomaly detection
	results, err := h.detector.Detect(ctx, request.DataPoints)
	if err != nil {
		h.logger.Error("Failed to detect anomalies", zap.Error(err))
		http.Error(w, "Failed to detect anomalies", http.StatusInternalServerError)
		return
	}

	// Convert detector results to API response format
	detectionResults := make([]models.DetectionResult, len(results))
	for i, result := range results {
		detectionResults[i] = models.DetectionResult{
			DataPointID: request.DataPoints[i].ID,
			IsAnomaly:   result.IsAnomaly,
			Score:       result.Score,
			Confidence:  result.Confidence,
			Severity:    models.GetSeverityFromScore(result.Score),
			Features:    result.Features,
		}
	}

	response := models.DetectResponse{
		Results:        detectionResults,
		ProcessingTime: time.Since(startTime),
		ModelUsed:      "hybrid", // or get from results
		Timestamp:      time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetMetrics handles GET /metrics
func (h *Handlers) GetMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := h.detector.GetMetrics()

	// Add system-wide metrics
	systemMetrics := models.SystemMetrics{
		Timestamp:           time.Now(),
		TotalRequests:       0,    // Implement request counter
		SuccessfulRequests:  0,    // Implement success counter
		FailedRequests:      0,    // Implement failure counter
		AvgResponseTime:     0,    // Implement response time tracking
		AnomaliesDetected:   0,    // Get from storage or cache
		DataPointsProcessed: 0,    // Track processed data points
		ActiveConnections:   0,    // Track active connections
		MemoryUsage: models.MemoryUsage{
			Used:      0,
			Available: 0,
			Total:     0,
			Percent:   0.0,
		},
		CPUUsage: models.CPUUsage{
			Percent:    0.0,
			LoadAvg:    []float64{0.0, 0.0, 0.0},
			CoreCount:  0,
			UserTime:   0.0,
			SystemTime: 0.0,
			IdleTime:   0.0,
		},
		ModelPerformance: make(map[string]models.ModelMetrics),
		ErrorRates:       make(map[string]float64),
	}

	response := map[string]interface{}{
		"detector": metrics,
		"system":   systemMetrics,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// WebSocketHandler handles WebSocket connections for real-time updates
func (h *Handlers) WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
		return
	}
	defer conn.Close()

	h.logger.Info("WebSocket connection established")

	// Handle WebSocket communication
	for {
		// Read message from client
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				h.logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}

		h.logger.Debug("Received WebSocket message", 
			zap.String("message", string(message)),
			zap.Int("type", messageType))

		// Echo the message back (implement real-time anomaly notifications here)
		if err := conn.WriteMessage(messageType, message); err != nil {
			h.logger.Error("Failed to write WebSocket message", zap.Error(err))
			break
		}
	}

	h.logger.Info("WebSocket connection closed")
}

// Helper function to generate unique IDs
func generateID() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36)
}