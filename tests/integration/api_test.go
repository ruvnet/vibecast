package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/vibecast/anomaly-detector/internal/api"
	"github.com/vibecast/anomaly-detector/internal/core"
	"github.com/vibecast/anomaly-detector/pkg/metrics"
	"go.uber.org/zap/zaptest"
)

func setupTestRouter(t *testing.T) *gin.Engine {
	gin.SetMode(gin.TestMode)
	
	logger := zaptest.NewLogger(t)
	metrics := metrics.NewMetrics()
	detector := core.NewAnomalyDetector(logger, metrics)
	
	router := gin.New()
	handler := api.NewHandler(detector, logger)
	handler.SetupRoutes(router)
	
	return router
}

func TestAPI_HealthCheck(t *testing.T) {
	router := setupTestRouter(t)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health", nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, "healthy", response["status"])
	assert.Contains(t, response, "timestamp")
	assert.Equal(t, "1.0.0", response["version"])
}

func TestAPI_AnalyzeText(t *testing.T) {
	router := setupTestRouter(t)
	
	requestBody := map[string]string{
		"text": "This is a sample text for analysis.",
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "id")
	assert.Contains(t, response, "result")
	assert.Contains(t, response, "duration")
	
	result := response["result"].(map[string]interface{})
	assert.Contains(t, result, "score")
	assert.Contains(t, result, "confidence")
	assert.Contains(t, result, "is_anomalous")
}

func TestAPI_AnalyzeText_InvalidRequest(t *testing.T) {
	router := setupTestRouter(t)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/analyze", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAPI_AnalyzeText_EmptyText(t *testing.T) {
	router := setupTestRouter(t)
	
	requestBody := map[string]string{
		"text": "",
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAPI_GetMetrics(t *testing.T) {
	router := setupTestRouter(t)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/metrics", nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "total_requests")
	assert.Contains(t, response, "avg_duration")
	assert.Contains(t, response, "error_rate")
}