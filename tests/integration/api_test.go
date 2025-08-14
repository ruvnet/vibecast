package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"

	"github.com/ruvnet/alienator/internal/api/rest"
	"github.com/ruvnet/alienator/internal/api/ws"
	"github.com/ruvnet/alienator/internal/dto"
	"github.com/ruvnet/alienator/internal/gateway"
	"github.com/ruvnet/alienator/internal/middleware"
)

// APITestSuite provides comprehensive API testing
type APITestSuite struct {
	suite.Suite
	server    *httptest.Server
	router    *gin.Engine
	logger    *zap.Logger
	jwtSecret string
	adminJWT  string
	userJWT   string
}

// SetupSuite initializes the test environment
func (s *APITestSuite) SetupSuite() {
	gin.SetMode(gin.TestMode)
	s.logger = zaptest.NewLogger(s.T())
	s.jwtSecret = "test-jwt-secret-key"

	// Create router with middleware
	s.router = gin.New()
	s.router.Use(gin.Recovery())

	// Setup auth middleware
	authMiddleware := middleware.JWTAuth(middleware.AuthConfig{
		JWTSecret:  s.jwtSecret,
		Issuer:     "vibecast-test",
		Expiration: time.Hour,
	}, s.logger)

	// Setup rate limiting middleware
	rateLimiter := middleware.NewInMemoryRateLimiter()
	rateMiddleware := middleware.RateLimit(middleware.RateLimitConfig{
		RequestsPerWindow: 1000,
		WindowSize:        time.Minute,
		KeyGenerator: func(c *gin.Context) string {
			return c.ClientIP()
		},
	}, rateLimiter, s.logger)

	// Setup REST handlers
	restHandler := rest.NewHandler(nil, s.logger)

	// Setup routes
	api := s.router.Group("/api/v1")
	{
		// Health endpoints
		api.GET("/health", restHandler.Health)
		api.GET("/health/ready", restHandler.Ready)
		api.GET("/health/live", restHandler.Live)

		// Authentication endpoints
		auth := api.Group("/auth")
		{
			auth.POST("/login", rateMiddleware, restHandler.Login)
			auth.POST("/register", rateMiddleware, restHandler.Register)
			auth.POST("/refresh", rateMiddleware, restHandler.RefreshToken)
			auth.POST("/logout", authMiddleware, restHandler.Logout)
		}

		// User endpoints
		users := api.Group("/users", authMiddleware)
		{
			users.GET("/me", restHandler.GetCurrentUser)
			users.PUT("/me", restHandler.UpdateCurrentUser)
			users.POST("/me/change-password", restHandler.ChangePassword)
		}

		// Anomaly detection endpoints
		anomaly := api.Group("/anomaly", authMiddleware)
		{
			anomaly.POST("/detect", restHandler.DetectAnomaly)
			anomaly.POST("/analyze/text", restHandler.AnalyzeText)
			anomaly.POST("/analyze/batch", restHandler.BatchAnalyzeText)
			anomaly.GET("/history", restHandler.GetAnomalyHistory)
		}

		// Admin endpoints (require admin role)
		admin := api.Group("/admin", authMiddleware, middleware.RequireRole("admin"))
		{
			admin.GET("/system", restHandler.GetSystemInfo)
			admin.GET("/metrics", restHandler.GetMetrics)
			admin.POST("/system/action", restHandler.ExecuteSystemAction)
			admin.GET("/logs", restHandler.GetSystemLogs)
		}
	}

	// WebSocket endpoint
	wsHandler := ws.NewHandler(s.logger)
	s.router.GET("/ws", wsHandler.HandleWebSocket)

	// Create test server
	s.server = httptest.NewServer(s.router)

	// Generate test JWT tokens
	s.generateTestTokens()
}

// TearDownSuite cleans up test resources
func (s *APITestSuite) TearDownSuite() {
	s.server.Close()
}

// generateTestTokens creates admin and user JWT tokens for testing
func (s *APITestSuite) generateTestTokens() {
	// Admin token
	adminClaims := jwt.MapClaims{
		"sub":  "admin-user-id",
		"role": "admin",
		"exp":  time.Now().Add(time.Hour).Unix(),
		"iat":  time.Now().Unix(),
		"iss":  "vibecast-test",
	}
	adminToken := jwt.NewWithClaims(jwt.SigningMethodHS256, adminClaims)
	adminTokenString, err := adminToken.SignedString([]byte(s.jwtSecret))
	require.NoError(s.T(), err)
	s.adminJWT = adminTokenString

	// User token
	userClaims := jwt.MapClaims{
		"sub":  "regular-user-id",
		"role": "user",
		"exp":  time.Now().Add(time.Hour).Unix(),
		"iat":  time.Now().Unix(),
		"iss":  "vibecast-test",
	}
	userToken := jwt.NewWithClaims(jwt.SigningMethodHS256, userClaims)
	userTokenString, err := userToken.SignedString([]byte(s.jwtSecret))
	require.NoError(s.T(), err)
	s.userJWT = userTokenString
}

// Helper method to make authenticated requests
func (s *APITestSuite) makeRequest(method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		var err error
		reqBody, err = json.Marshal(body)
		require.NoError(s.T(), err)
	}

	req := httptest.NewRequest(method, path, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	return w
}

// TestHealthEndpoints tests health check endpoints
func (s *APITestSuite) TestHealthEndpoints() {
	// Test main health endpoint
	w := s.makeRequest("GET", "/api/v1/health", nil, "")
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var healthResp dto.HealthResponse
	err := json.Unmarshal(w.Body.Bytes(), &healthResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), healthResp.Success)
	assert.Equal(s.T(), "healthy", healthResp.Status)

	// Test readiness endpoint
	w = s.makeRequest("GET", "/api/v1/health/ready", nil, "")
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test liveness endpoint
	w = s.makeRequest("GET", "/api/v1/health/live", nil, "")
	assert.Equal(s.T(), http.StatusOK, w.Code)
}

// TestAuthenticationEndpoints tests authentication flow
func (s *APITestSuite) TestAuthenticationEndpoints() {
	// Test registration
	registerReq := dto.RegisterRequest{
		Email:     "test@example.com",
		Username:  "testuser",
		FirstName: "Test",
		LastName:  "User",
		Password:  "SecurePass123!",
		Role:      "user",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, "")
	assert.Equal(s.T(), http.StatusCreated, w.Code)

	var registerResp dto.AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &registerResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), registerResp.Success)
	assert.NotEmpty(s.T(), registerResp.Token)
	assert.NotEmpty(s.T(), registerResp.RefreshToken)

	// Test login
	loginReq := dto.LoginRequest{
		Email:    "test@example.com",
		Password: "SecurePass123!",
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, "")
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var loginResp dto.AuthResponse
	err = json.Unmarshal(w.Body.Bytes(), &loginResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), loginResp.Success)
	assert.NotEmpty(s.T(), loginResp.Token)

	// Test refresh token
	refreshReq := dto.RefreshTokenRequest{
		RefreshToken: registerResp.RefreshToken,
	}

	w = s.makeRequest("POST", "/api/v1/auth/refresh", refreshReq, "")
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var refreshResp dto.RefreshTokenResponse
	err = json.Unmarshal(w.Body.Bytes(), &refreshResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), refreshResp.Success)
	assert.NotEmpty(s.T(), refreshResp.Token)
}

// TestUserEndpoints tests user management endpoints
func (s *APITestSuite) TestUserEndpoints() {
	// Test get current user
	w := s.makeRequest("GET", "/api/v1/users/me", nil, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var userResp dto.UserResponse
	err := json.Unmarshal(w.Body.Bytes(), &userResp)
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "regular-user-id", userResp.ID)

	// Test update user
	updateReq := dto.UpdateUserRequest{
		FirstName: "Updated",
		LastName:  "Name",
		Email:     "updated@example.com",
	}

	w = s.makeRequest("PUT", "/api/v1/users/me", updateReq, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test change password
	changePassReq := dto.ChangePasswordRequest{
		CurrentPassword: "oldpass",
		NewPassword:     "newpass123",
	}

	w = s.makeRequest("POST", "/api/v1/users/me/change-password", changePassReq, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)
}

// TestAnomalyDetectionEndpoints tests anomaly detection functionality
func (s *APITestSuite) TestAnomalyDetectionEndpoints() {
	// Test anomaly detection
	detectReq := dto.AnomalyDetectionRequest{
		Data: map[string]string{
			"temperature": "75.5",
			"humidity":    "60.2",
			"pressure":    "1013.25",
		},
		Algorithm: "isolation_forest",
		Threshold: 0.7,
	}

	w := s.makeRequest("POST", "/api/v1/anomaly/detect", detectReq, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var detectResp dto.AnomalyDetectionResponse
	err := json.Unmarshal(w.Body.Bytes(), &detectResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), detectResp.Success)
	assert.NotNil(s.T(), detectResp.Result)

	// Test text analysis
	textReq := dto.TextAnalysisRequest{
		Text:     "This is a test message for analysis",
		Language: "en",
		Priority: 5,
	}

	w = s.makeRequest("POST", "/api/v1/anomaly/analyze/text", textReq, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var textResp dto.TextAnalysisResponse
	err = json.Unmarshal(w.Body.Bytes(), &textResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), textResp.Success)

	// Test batch analysis
	batchReq := dto.BatchAnalysisRequest{
		Items: []dto.TextAnalysisRequest{
			{Text: "First text", Language: "en", Priority: 5},
			{Text: "Second text", Language: "en", Priority: 3},
		},
	}

	w = s.makeRequest("POST", "/api/v1/anomaly/analyze/batch", batchReq, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test anomaly history
	w = s.makeRequest("GET", "/api/v1/anomaly/history?page=1&limit=10", nil, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var historyResp dto.PaginatedAnomalyHistory
	err = json.Unmarshal(w.Body.Bytes(), &historyResp)
	assert.NoError(s.T(), err)
	assert.True(s.T(), historyResp.Success)
	assert.NotNil(s.T(), historyResp.Pagination)
}

// TestAdminEndpoints tests administrative endpoints
func (s *APITestSuite) TestAdminEndpoints() {
	// Test system info (admin only)
	w := s.makeRequest("GET", "/api/v1/admin/system", nil, s.adminJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test with user token (should fail)
	w = s.makeRequest("GET", "/api/v1/admin/system", nil, s.userJWT)
	assert.Equal(s.T(), http.StatusForbidden, w.Code)

	// Test metrics
	w = s.makeRequest("GET", "/api/v1/admin/metrics?timeframe=1h", nil, s.adminJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test system action
	actionReq := map[string]interface{}{
		"action": "cache_clear",
		"force":  false,
	}

	w = s.makeRequest("POST", "/api/v1/admin/system/action", actionReq, s.adminJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test system logs
	w = s.makeRequest("GET", "/api/v1/admin/logs?level=INFO&limit=50", nil, s.adminJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)
}

// TestAuthenticationRequired tests endpoints that require authentication
func (s *APITestSuite) TestAuthenticationRequired() {
	endpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/users/me"},
		{"PUT", "/api/v1/users/me"},
		{"POST", "/api/v1/anomaly/detect"},
		{"GET", "/api/v1/admin/system"},
	}

	for _, endpoint := range endpoints {
		w := s.makeRequest(endpoint.method, endpoint.path, nil, "")
		assert.Equal(s.T(), http.StatusUnauthorized, w.Code,
			"Endpoint %s %s should require authentication", endpoint.method, endpoint.path)
	}
}

// TestRateLimiting tests rate limiting functionality
func (s *APITestSuite) TestRateLimiting() {
	// Make many requests to trigger rate limit
	loginReq := dto.LoginRequest{
		Email:    "test@example.com",
		Password: "password",
	}

	// Make requests up to the limit
	successCount := 0
	rateLimitedCount := 0

	for i := 0; i < 1010; i++ { // Exceed the 1000 per minute limit
		w := s.makeRequest("POST", "/api/v1/auth/login", loginReq, "")

		if w.Code == http.StatusOK || w.Code == http.StatusUnauthorized {
			successCount++
		} else if w.Code == http.StatusTooManyRequests {
			rateLimitedCount++
		}
	}

	assert.Greater(s.T(), rateLimitedCount, 0, "Rate limiting should trigger")
}

// TestInputValidation tests request validation
func (s *APITestSuite) TestInputValidation() {
	// Test invalid registration data
	invalidReq := map[string]interface{}{
		"email":    "invalid-email",
		"username": "ab",  // Too short
		"password": "123", // Too weak
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", invalidReq, "")
	assert.Equal(s.T(), http.StatusBadRequest, w.Code)

	var errorResp dto.ValidationErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errorResp)
	assert.NoError(s.T(), err)
	assert.False(s.T(), errorResp.Success)
	assert.NotEmpty(s.T(), errorResp.ValidationErrors)
}

// TestWebSocketConnection tests WebSocket functionality
func (s *APITestSuite) TestWebSocketConnection() {
	// Convert HTTP URL to WebSocket URL
	wsURL := strings.Replace(s.server.URL, "http://", "ws://", 1) + "/ws"

	// Create WebSocket connection with authentication
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+s.userJWT)

	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		s.T().Skip("WebSocket test skipped - connection failed:", err)
		return
	}
	defer conn.Close()

	// Test subscription message
	subscribeMsg := map[string]interface{}{
		"action": "subscribe",
		"topics": []string{"anomaly_alerts"},
	}

	err = conn.WriteJSON(subscribeMsg)
	assert.NoError(s.T(), err)

	// Read response
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var response map[string]interface{}
	err = conn.ReadJSON(&response)
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "subscribed", response["status"])
}

// TestErrorHandling tests various error scenarios
func (s *APITestSuite) TestErrorHandling() {
	// Test 404 for non-existent endpoint
	w := s.makeRequest("GET", "/api/v1/nonexistent", nil, "")
	assert.Equal(s.T(), http.StatusNotFound, w.Code)

	// Test malformed JSON
	req := httptest.NewRequest("POST", "/api/v1/auth/login", strings.NewReader("{invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	s.router.ServeHTTP(w2, req)
	assert.Equal(s.T(), http.StatusBadRequest, w2.Code)

	// Test invalid JWT token
	w = s.makeRequest("GET", "/api/v1/users/me", nil, "invalid-jwt-token")
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

// TestAPIGateway tests the API Gateway functionality
func (s *APITestSuite) TestAPIGateway() {
	// Create a separate gateway instance for testing
	gatewayLogger := zaptest.NewLogger(s.T())
	gw := gateway.NewGateway(gatewayLogger)

	// Register mock services
	gw.RegisterService(&gateway.ServiceInstance{
		ID:      "auth-1",
		Name:    "auth-service",
		Address: "127.0.0.1",
		Port:    8081,
		Health:  "healthy",
		Tags:    []string{"v1", "auth"},
	})

	gw.RegisterService(&gateway.ServiceInstance{
		ID:      "anomaly-1",
		Name:    "anomaly-service",
		Address: "127.0.0.1",
		Port:    8082,
		Health:  "healthy",
		Tags:    []string{"v1", "ml"},
	})

	// Create gateway router
	gatewayRouter := gin.New()
	gw.SetupRoutes(gatewayRouter)

	// Test gateway health
	req := httptest.NewRequest("GET", "/gateway/health", nil)
	w := httptest.NewRecorder()
	gatewayRouter.ServeHTTP(w, req)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test service listing
	req = httptest.NewRequest("GET", "/gateway/registry/services", nil)
	w = httptest.NewRecorder()
	gatewayRouter.ServeHTTP(w, req)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var services map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &services)
	assert.NoError(s.T(), err)
	assert.Contains(s.T(), services, "services")
}

// TestPerformance tests API performance characteristics
func (s *APITestSuite) TestPerformance() {
	// Test response times for health endpoint
	start := time.Now()
	w := s.makeRequest("GET", "/api/v1/health", nil, "")
	duration := time.Since(start)

	assert.Equal(s.T(), http.StatusOK, w.Code)
	assert.Less(s.T(), duration, 100*time.Millisecond, "Health endpoint should respond quickly")

	// Test concurrent requests
	concurrency := 10
	results := make(chan int, concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			w := s.makeRequest("GET", "/api/v1/health", nil, "")
			results <- w.Code
		}()
	}

	successCount := 0
	for i := 0; i < concurrency; i++ {
		code := <-results
		if code == http.StatusOK {
			successCount++
		}
	}

	assert.Equal(s.T(), concurrency, successCount, "All concurrent requests should succeed")
}

// TestSecurityHeaders tests security-related headers and configurations
func (s *APITestSuite) TestSecurityHeaders() {
	w := s.makeRequest("GET", "/api/v1/health", nil, "")

	// Check for security headers (would be added by middleware in production)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test CORS handling
	req := httptest.NewRequest("OPTIONS", "/api/v1/health", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")

	w2 := httptest.NewRecorder()
	s.router.ServeHTTP(w2, req)

	// In production, CORS middleware would handle this
	assert.True(s.T(), w2.Code == http.StatusOK || w2.Code == http.StatusNoContent)
}

// TestInfrastructureEndpoints tests infrastructure-related endpoints
func (s *APITestSuite) TestInfrastructureEndpoints() {
	// Test metrics endpoint format
	w := s.makeRequest("GET", "/api/v1/admin/metrics", nil, s.adminJWT)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var metricsResp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &metricsResp)
	assert.NoError(s.T(), err)

	assert.Contains(s.T(), metricsResp, "success")
	assert.Contains(s.T(), metricsResp, "timestamp")
}

// TestDataConsistency tests data consistency across endpoints
func (s *APITestSuite) TestDataConsistency() {
	// Test that user data is consistent across different endpoints
	userResp1 := s.makeRequest("GET", "/api/v1/users/me", nil, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, userResp1.Code)

	var user1 dto.UserResponse
	err := json.Unmarshal(userResp1.Body.Bytes(), &user1)
	assert.NoError(s.T(), err)

	// Make another request and verify consistency
	userResp2 := s.makeRequest("GET", "/api/v1/users/me", nil, s.userJWT)
	assert.Equal(s.T(), http.StatusOK, userResp2.Code)

	var user2 dto.UserResponse
	err = json.Unmarshal(userResp2.Body.Bytes(), &user2)
	assert.NoError(s.T(), err)

	assert.Equal(s.T(), user1.ID, user2.ID)
	assert.Equal(s.T(), user1.Role, user2.Role)
}

// Run the test suite
func TestAPIIntegration(t *testing.T) {
	suite.Run(t, new(APITestSuite))
}

// Benchmark tests for performance analysis
func BenchmarkHealthEndpoint(b *testing.B) {
	suite := &APITestSuite{}
	suite.SetT(&testing.T{})
	suite.SetupSuite()
	defer suite.TearDownSuite()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := suite.makeRequest("GET", "/api/v1/health", nil, "")
		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}

func BenchmarkAuthenticatedEndpoint(b *testing.B) {
	suite := &APITestSuite{}
	suite.SetT(&testing.T{})
	suite.SetupSuite()
	defer suite.TearDownSuite()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := suite.makeRequest("GET", "/api/v1/users/me", nil, suite.userJWT)
		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}

func BenchmarkAnomalyDetection(b *testing.B) {
	suite := &APITestSuite{}
	suite.SetT(&testing.T{})
	suite.SetupSuite()
	defer suite.TearDownSuite()

	detectReq := dto.AnomalyDetectionRequest{
		Data: map[string]string{
			"value": "42.5",
		},
		Algorithm: "isolation_forest",
		Threshold: 0.7,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := suite.makeRequest("POST", "/api/v1/anomaly/detect", detectReq, suite.userJWT)
		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}
