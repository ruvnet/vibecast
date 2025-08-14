package unit

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap/zaptest"

	"github.com/ruvnet/alienator/internal/api"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/models"
)

// MockAnomalyDetector is a mock implementation of AnomalyDetector
type MockAnomalyDetector struct {
	mock.Mock
}

func (m *MockAnomalyDetector) AnalyzeText(text string) (*models.AnomalyResult, error) {
	args := m.Called(text)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.AnomalyResult), args.Error(1)
}

func (m *MockAnomalyDetector) RegisterAnalyzer(analyzer core.Analyzer) {
	m.Called(analyzer)
}

// APIHandlerTestSuite provides comprehensive test coverage for API handlers
type APIHandlerTestSuite struct {
	suite.Suite
	handler  *api.Handler
	detector *MockAnomalyDetector
	router   *gin.Engine
	logger   *zap.Logger
}

func (suite *APIHandlerTestSuite) SetupTest() {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	suite.logger = zaptest.NewLogger(suite.T())
	suite.detector = &MockAnomalyDetector{}
	suite.handler = api.NewHandler(suite.detector, suite.logger)
	suite.router = gin.New()
	suite.handler.SetupRoutes(suite.router)
}

func (suite *APIHandlerTestSuite) TestNewHandler() {
	handler := api.NewHandler(suite.detector, suite.logger)

	assert.NotNil(suite.T(), handler)
	assert.Equal(suite.T(), suite.detector, handler.detector)
	assert.Equal(suite.T(), suite.logger, handler.logger)
}

func (suite *APIHandlerTestSuite) TestSetupRoutes() {
	router := gin.New()
	suite.handler.SetupRoutes(router)

	// Test that routes are properly registered
	routes := router.Routes()

	routePaths := make(map[string]bool)
	for _, route := range routes {
		routePaths[route.Path] = true
	}

	assert.True(suite.T(), routePaths["/api/v1/analyze"])
	assert.True(suite.T(), routePaths["/api/v1/health"])
	assert.True(suite.T(), routePaths["/api/v1/metrics"])
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_Success() {
	// Setup mock response
	expectedResult := &models.AnomalyResult{
		Score:       0.75,
		Confidence:  0.88,
		IsAnomalous: true,
		Details: map[string]*models.AnalysisResult{
			"entropy": {
				Score:      0.7,
				Confidence: 0.9,
				Metadata:   map[string]interface{}{"type": "entropy"},
			},
		},
	}

	suite.detector.On("AnalyzeText", "This is test text").Return(expectedResult, nil)

	// Prepare request
	requestBody := api.AnalyzeTextRequest{
		Text: "This is test text",
		Options: map[string]string{
			"analyzer": "all",
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify response
	assert.Equal(suite.T(), http.StatusOK, resp.Code)

	var response models.AnalysisResponse
	err = json.Unmarshal(resp.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.NotEmpty(suite.T(), response.ID)
	assert.Equal(suite.T(), expectedResult.Score, response.Result.Score)
	assert.Equal(suite.T(), expectedResult.Confidence, response.Result.Confidence)
	assert.Equal(suite.T(), expectedResult.IsAnomalous, response.Result.IsAnomalous)
	assert.Greater(suite.T(), response.Duration, time.Duration(0))

	suite.detector.AssertExpectations(suite.T())
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_InvalidJSON() {
	// Make request with invalid JSON
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify error response
	assert.Equal(suite.T(), http.StatusBadRequest, resp.Code)

	var errorResp map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &errorResp)
	require.NoError(suite.T(), err)

	assert.Contains(suite.T(), errorResp["error"], "Invalid request payload")
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_MissingText() {
	// Prepare request without required text field
	requestBody := api.AnalyzeTextRequest{
		Options: map[string]string{
			"analyzer": "entropy",
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify error response
	assert.Equal(suite.T(), http.StatusBadRequest, resp.Code)

	var errorResp map[string]interface{}
	err = json.Unmarshal(resp.Body.Bytes(), &errorResp)
	require.NoError(suite.T(), err)

	assert.Contains(suite.T(), errorResp["error"], "Invalid request payload")
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_DetectorError() {
	// Setup mock to return error
	suite.detector.On("AnalyzeText", "test text").Return(nil, errors.New("detector failed"))

	// Prepare request
	requestBody := api.AnalyzeTextRequest{
		Text: "test text",
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify error response
	assert.Equal(suite.T(), http.StatusInternalServerError, resp.Code)

	var errorResp map[string]interface{}
	err = json.Unmarshal(resp.Body.Bytes(), &errorResp)
	require.NoError(suite.T(), err)

	assert.Contains(suite.T(), errorResp["error"], "Analysis failed")

	suite.detector.AssertExpectations(suite.T())
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_EmptyText() {
	// Setup mock for empty text
	expectedResult := &models.AnomalyResult{
		Score:       0.0,
		Confidence:  0.0,
		IsAnomalous: false,
		Details:     map[string]*models.AnalysisResult{},
	}

	suite.detector.On("AnalyzeText", "").Return(expectedResult, nil)

	// Prepare request with empty text
	requestBody := api.AnalyzeTextRequest{
		Text: "",
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Should still succeed but likely with validation error from binding
	// depending on how binding is configured
	assert.Equal(suite.T(), http.StatusBadRequest, resp.Code)
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_LongText() {
	// Test with very long text
	longText := strings.Repeat("This is a very long text for testing. ", 1000)

	expectedResult := &models.AnomalyResult{
		Score:       0.6,
		Confidence:  0.85,
		IsAnomalous: false,
		Details:     map[string]*models.AnalysisResult{},
	}

	suite.detector.On("AnalyzeText", longText).Return(expectedResult, nil)

	// Prepare request
	requestBody := api.AnalyzeTextRequest{
		Text: longText,
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify response
	assert.Equal(suite.T(), http.StatusOK, resp.Code)

	suite.detector.AssertExpectations(suite.T())
}

func (suite *APIHandlerTestSuite) TestAnalyzeText_WithOptions() {
	expectedResult := &models.AnomalyResult{
		Score:       0.45,
		Confidence:  0.72,
		IsAnomalous: false,
		Details:     map[string]*models.AnalysisResult{},
	}

	suite.detector.On("AnalyzeText", "test with options").Return(expectedResult, nil)

	// Prepare request with options
	requestBody := api.AnalyzeTextRequest{
		Text: "test with options",
		Options: map[string]string{
			"analyzer":  "entropy",
			"threshold": "0.7",
			"language":  "en",
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(suite.T(), err)

	// Make request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify response
	assert.Equal(suite.T(), http.StatusOK, resp.Code)

	var response models.AnalysisResponse
	err = json.Unmarshal(resp.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), expectedResult.Score, response.Result.Score)

	suite.detector.AssertExpectations(suite.T())
}

func (suite *APIHandlerTestSuite) TestHealthCheck() {
	// Make request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify response
	assert.Equal(suite.T(), http.StatusOK, resp.Code)

	var healthResp map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &healthResp)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "healthy", healthResp["status"])
	assert.Equal(suite.T(), "1.0.0", healthResp["version"])
	assert.Contains(suite.T(), healthResp, "timestamp")
}

func (suite *APIHandlerTestSuite) TestGetMetrics() {
	// Make request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics", nil)
	resp := httptest.NewRecorder()

	suite.router.ServeHTTP(resp, req)

	// Verify response
	assert.Equal(suite.T(), http.StatusOK, resp.Code)

	var metricsResp map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &metricsResp)
	require.NoError(suite.T(), err)

	assert.Contains(suite.T(), metricsResp, "total_requests")
	assert.Contains(suite.T(), metricsResp, "avg_duration")
	assert.Contains(suite.T(), metricsResp, "error_rate")
}

func TestAPIHandlerTestSuite(t *testing.T) {
	suite.Run(t, new(APIHandlerTestSuite))
}

// Test middleware and error handling
func TestAPIHandler_Middleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(t)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)

	router := gin.New()

	// Add custom middleware for testing
	router.Use(func(c *gin.Context) {
		c.Header("X-Test-Header", "test-value")
		c.Next()
	})

	handler.SetupRoutes(router)

	// Test that middleware is applied
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, "test-value", resp.Header().Get("X-Test-Header"))
}

// Test concurrent requests
func TestAPIHandler_ConcurrentRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(t)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)
	router := gin.New()
	handler.SetupRoutes(router)

	// Setup mock for concurrent requests
	expectedResult := &models.AnomalyResult{
		Score:       0.5,
		Confidence:  0.8,
		IsAnomalous: false,
		Details:     map[string]*models.AnalysisResult{},
	}

	detector.On("AnalyzeText", mock.AnythingOfType("string")).Return(expectedResult, nil).Maybe()

	// Make multiple concurrent requests
	const numRequests = 50
	responseChan := make(chan int, numRequests)

	for i := 0; i < numRequests; i++ {
		go func(id int) {
			requestBody := api.AnalyzeTextRequest{
				Text: fmt.Sprintf("Test text %d", id),
			}

			jsonBody, _ := json.Marshal(requestBody)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)
			responseChan <- resp.Code
		}(i)
	}

	// Collect responses
	successCount := 0
	for i := 0; i < numRequests; i++ {
		code := <-responseChan
		if code == http.StatusOK {
			successCount++
		}
	}

	assert.Equal(t, numRequests, successCount, "All concurrent requests should succeed")
}

// Test request timeout
func TestAPIHandler_RequestTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(t)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)
	router := gin.New()
	handler.SetupRoutes(router)

	// Setup mock to simulate slow response
	detector.On("AnalyzeText", "slow text").Return(
		func(text string) *models.AnomalyResult {
			time.Sleep(100 * time.Millisecond) // Simulate slow processing
			return &models.AnomalyResult{Score: 0.5, Confidence: 0.8}
		},
		func(text string) error {
			time.Sleep(100 * time.Millisecond)
			return nil
		})

	requestBody := api.AnalyzeTextRequest{
		Text: "slow text",
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	start := time.Now()
	router.ServeHTTP(resp, req)
	duration := time.Since(start)

	// Should complete within reasonable time
	assert.Less(t, duration, 5*time.Second)
	assert.Equal(t, http.StatusOK, resp.Code)
}

// Benchmark tests for API performance
func BenchmarkAPIHandler_AnalyzeText(b *testing.B) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(b)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)
	router := gin.New()
	handler.SetupRoutes(router)

	expectedResult := &models.AnomalyResult{
		Score:       0.65,
		Confidence:  0.82,
		IsAnomalous: false,
		Details:     map[string]*models.AnalysisResult{},
	}

	detector.On("AnalyzeText", mock.AnythingOfType("string")).Return(expectedResult, nil)

	requestBody := api.AnalyzeTextRequest{
		Text: "This is a benchmark test text for measuring API performance.",
	}

	jsonBody, err := json.Marshal(requestBody)
	require.NoError(b, err)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", resp.Code)
		}
	}
}

func BenchmarkAPIHandler_HealthCheck(b *testing.B) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(b)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)
	router := gin.New()
	handler.SetupRoutes(router)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		resp := httptest.NewRecorder()

		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", resp.Code)
		}
	}
}

// Test edge cases
func TestAPIHandler_EdgeCases(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := zaptest.NewLogger(t)
	detector := &MockAnomalyDetector{}
	handler := api.NewHandler(detector, logger)
	router := gin.New()
	handler.SetupRoutes(router)

	testCases := []struct {
		name           string
		method         string
		path           string
		body           string
		expectedStatus int
	}{
		{"invalid_method", "PUT", "/api/v1/analyze", `{"text": "test"}`, http.StatusNotFound},
		{"invalid_path", "POST", "/api/v1/invalid", `{"text": "test"}`, http.StatusNotFound},
		{"large_payload", "POST", "/api/v1/analyze", `{"text": "` + strings.Repeat("x", 1000000) + `"}`, http.StatusOK},
		{"malformed_json", "POST", "/api/v1/analyze", `{"text": "test"`, http.StatusBadRequest},
		{"empty_body", "POST", "/api/v1/analyze", "", http.StatusBadRequest},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.expectedStatus == http.StatusOK {
				// Setup mock for successful cases
				detector.On("AnalyzeText", mock.AnythingOfType("string")).Return(
					&models.AnomalyResult{Score: 0.5, Confidence: 0.8}, nil).Maybe()
			}

			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			assert.Equal(t, tc.expectedStatus, resp.Code, "Test case: %s", tc.name)
		})
	}
}
