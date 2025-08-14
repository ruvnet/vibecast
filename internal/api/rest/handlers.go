// Package rest provides REST API handlers
package rest

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/middleware"
	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/internal/services"
	"go.uber.org/zap"
)

// Handler handles REST API requests
type Handler struct {
	detector       *core.AnomalyDetector
	anomalyService *services.AnomalyService
	userService    *services.UserService
	authService    *services.AuthService
	logger         *zap.Logger
}

// NewHandler creates a new REST API handler
func NewHandler(
	detector *core.AnomalyDetector,
	anomalyService *services.AnomalyService,
	userService *services.UserService,
	authService *services.AuthService,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		detector:       detector,
		anomalyService: anomalyService,
		userService:    userService,
		authService:    authService,
		logger:         logger,
	}
}

// SetupRoutes configures all REST API routes
func (h *Handler) SetupRoutes(router *gin.RouterGroup) {
	// Authentication routes
	auth := router.Group("/auth")
	{
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.RefreshToken)
		auth.POST("/logout", middleware.OptionalAuth(h.authService), h.Logout)
	}

	// User routes
	users := router.Group("/users")
	users.Use(middleware.Auth(h.authService))
	{
		users.GET("/profile", h.GetProfile)
		users.PUT("/profile", h.UpdateProfile)
		users.DELETE("/profile", h.DeleteProfile)
		users.GET("/stats", h.GetUserStats)
		
		// Admin only routes
		admin := users.Group("/")
		admin.Use(middleware.AdminOnly())
		{
			admin.GET("", h.ListUsers)
			admin.GET("/:id", h.GetUser)
			admin.DELETE("/:id", h.DeleteUser)
		}
	}

	// Anomaly detection routes
	anomalies := router.Group("/anomalies")
	anomalies.Use(middleware.Auth(h.authService))
	{
		anomalies.POST("/detect", h.DetectAnomaly)
		anomalies.GET("", h.ListAnomalies)
		anomalies.GET("/:id", h.GetAnomaly)
		anomalies.DELETE("/:id", h.DeleteAnomaly)
		anomalies.GET("/stats", h.GetAnomalyStats)
	}

	// System routes
	system := router.Group("/system")
	system.Use(middleware.Auth(h.authService))
	system.Use(middleware.AdminOnly())
	{
		system.GET("/health", h.SystemHealth)
		system.GET("/stats", h.SystemStats)
	}
}

// Authentication Handlers

// Register godoc
// @Summary Register a new user
// @Description Register a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param request body models.RegisterRequest true "Registration details"
// @Success 201 {object} models.APIResponse{data=models.LoginResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 409 {object} models.APIResponse
// @Router /auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request format",
				Details: err.Error(),
			},
		})
		return
	}

	// Validate password strength
	if err := h.authService.ValidatePasswordStrength(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "WEAK_PASSWORD",
				Message: err.Error(),
			},
		})
		return
	}

	// Hash password
	hashedPassword, err := h.authService.HashPassword(req.Password)
	if err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to process registration",
			},
		})
		return
	}

	// Create user
	user, err := h.userService.CreateUser(&req, hashedPassword)
	if err != nil {
		status := http.StatusConflict
		if err.Error() == "failed to create user" {
			status = http.StatusInternalServerError
		}
		c.JSON(status, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "REGISTRATION_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	// Generate token
	token, expiresAt, err := h.authService.GenerateToken(user)
	if err != nil {
		h.logger.Error("Failed to generate token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "TOKEN_GENERATION_FAILED",
				Message: "Failed to generate authentication token",
			},
		})
		return
	}

	response := models.LoginResponse{
		Token:     token,
		User:      *user,
		ExpiresAt: expiresAt,
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// Login godoc
// @Summary User login
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body models.LoginRequest true "Login credentials"
// @Success 200 {object} models.APIResponse{data=models.LoginResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request format",
				Details: err.Error(),
			},
		})
		return
	}

	// Get user by email
	user, err := h.userService.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_CREDENTIALS",
				Message: "Invalid email or password",
			},
		})
		return
	}

	// Validate credentials
	if err := h.authService.ValidateUserCredentials(req.Email, req.Password, user); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_CREDENTIALS",
				Message: err.Error(),
			},
		})
		return
	}

	// Generate token
	token, expiresAt, err := h.authService.GenerateToken(user)
	if err != nil {
		h.logger.Error("Failed to generate token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "TOKEN_GENERATION_FAILED",
				Message: "Failed to generate authentication token",
			},
		})
		return
	}

	response := models.LoginResponse{
		Token:     token,
		User:      *user,
		ExpiresAt: expiresAt,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// RefreshToken godoc
// @Summary Refresh JWT token
// @Description Refresh an existing JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse{data=models.LoginResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /auth/refresh [post]
func (h *Handler) RefreshToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "MISSING_TOKEN",
				Message: "Authorization token is required",
			},
		})
		return
	}

	tokenString := authHeader[7:] // Remove "Bearer " prefix
	newToken, expiresAt, err := h.authService.RefreshToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "REFRESH_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	user, err := h.authService.GetUserFromToken(newToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "USER_FETCH_FAILED",
				Message: "Failed to fetch user information",
			},
		})
		return
	}

	response := models.LoginResponse{
		Token:     newToken,
		User:      *user,
		ExpiresAt: expiresAt,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// Logout godoc
// @Summary User logout
// @Description Logout user (client-side token removal)
// @Tags auth
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse
// @Router /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	// In a JWT implementation, logout is typically handled client-side
	// by removing the token. Server-side logout would require token blacklisting.
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "Logged out successfully"},
	})
}

// User Handlers

// GetProfile godoc
// @Summary Get user profile
// @Description Get current user's profile information
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse{data=models.User}
// @Failure 401 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Router /users/profile [get]
func (h *Handler) GetProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "USER_NOT_FOUND",
				Message: "User not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}

// UpdateProfile godoc
// @Summary Update user profile
// @Description Update current user's profile information
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param request body models.UpdateUserRequest true "Profile updates"
// @Success 200 {object} models.APIResponse{data=models.User}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /users/profile [put]
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request format",
				Details: err.Error(),
			},
		})
		return
	}

	user, err := h.userService.UpdateUser(userID, &req)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "user not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UPDATE_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}

// DeleteProfile godoc
// @Summary Delete user profile
// @Description Delete current user's profile
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /users/profile [delete]
func (h *Handler) DeleteProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	if err := h.userService.DeleteUser(userID); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "DELETE_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "Profile deleted successfully"},
	})
}

// GetUserStats godoc
// @Summary Get user statistics
// @Description Get statistics for current user
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /users/stats [get]
func (h *Handler) GetUserStats(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	stats, err := h.userService.GetUserStats(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "STATS_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// ListUsers godoc
// @Summary List all users (Admin only)
// @Description Get paginated list of all users
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} models.APIResponse{data=[]models.User}
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Router /users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	users, meta, err := h.userService.ListUsers(page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "FETCH_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    users,
		Meta:    meta,
	})
}

// GetUser godoc
// @Summary Get user by ID (Admin only)
// @Description Get user information by ID
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param id path string true "User ID"
// @Success 200 {object} models.APIResponse{data=models.User}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Router /users/{id} [get]
func (h *Handler) GetUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_USER_ID",
				Message: "Invalid user ID format",
			},
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "USER_NOT_FOUND",
				Message: "User not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}

// DeleteUser godoc
// @Summary Delete user by ID (Admin only)
// @Description Delete user by ID
// @Tags users
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param id path string true "User ID"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_USER_ID",
				Message: "Invalid user ID format",
			},
		})
		return
	}

	if err := h.userService.DeleteUser(userID); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "DELETE_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "User deleted successfully"},
	})
}

// Anomaly Detection Handlers

// DetectAnomaly godoc
// @Summary Detect anomalies in data
// @Description Analyze data for anomalies using ML algorithms
// @Tags anomalies
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param request body models.DetectionRequest true "Detection request"
// @Success 200 {object} models.APIResponse{data=models.DetectionResult}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /anomalies/detect [post]
func (h *Handler) DetectAnomaly(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	var req models.DetectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request format",
				Details: err.Error(),
			},
		})
		return
	}

	result, err := h.anomalyService.ProcessDetection(userID, &req)
	if err != nil {
		h.logger.Error("Anomaly detection failed", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "DETECTION_FAILED",
				Message: "Failed to process anomaly detection",
				Details: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    result,
	})
}

// ListAnomalies godoc
// @Summary List anomaly detection results
// @Description Get paginated list of anomaly detection results
// @Tags anomalies
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} models.APIResponse{data=[]models.AnomalyData}
// @Failure 401 {object} models.APIResponse
// @Router /anomalies [get]
func (h *Handler) ListAnomalies(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	// Check if user is admin to see all data
	userRole, _ := middleware.GetUserRole(c)
	var anomalies []*models.AnomalyData
	var meta *models.Meta
	var err error

	if userRole == "admin" {
		anomalies, meta, err = h.anomalyService.ListAnomalyData(page, limit)
	} else {
		anomalies, meta, err = h.anomalyService.GetUserAnomalyData(userID, page, limit)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "FETCH_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    anomalies,
		Meta:    meta,
	})
}

// GetAnomaly godoc
// @Summary Get anomaly detection result
// @Description Get specific anomaly detection result by ID
// @Tags anomalies
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param id path string true "Anomaly ID"
// @Success 200 {object} models.APIResponse{data=models.AnomalyData}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Router /anomalies/{id} [get]
func (h *Handler) GetAnomaly(c *gin.Context) {
	anomalyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_ANOMALY_ID",
				Message: "Invalid anomaly ID format",
			},
		})
		return
	}

	anomaly, err := h.anomalyService.GetAnomalyData(anomalyID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "ANOMALY_NOT_FOUND",
				Message: "Anomaly data not found",
			},
		})
		return
	}

	// Check if user can access this anomaly data
	userID, _ := middleware.GetUserID(c)
	userRole, _ := middleware.GetUserRole(c)
	
	if userRole != "admin" && anomaly.UserID != userID {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "ACCESS_DENIED",
				Message: "Access denied to this anomaly data",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    anomaly,
	})
}

// DeleteAnomaly godoc
// @Summary Delete anomaly detection result
// @Description Delete specific anomaly detection result by ID
// @Tags anomalies
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param id path string true "Anomaly ID"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Router /anomalies/{id} [delete]
func (h *Handler) DeleteAnomaly(c *gin.Context) {
	anomalyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "INVALID_ANOMALY_ID",
				Message: "Invalid anomaly ID format",
			},
		})
		return
	}

	// Check if user can delete this anomaly data
	anomaly, err := h.anomalyService.GetAnomalyData(anomalyID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "ANOMALY_NOT_FOUND",
				Message: "Anomaly data not found",
			},
		})
		return
	}

	userID, _ := middleware.GetUserID(c)
	userRole, _ := middleware.GetUserRole(c)
	
	if userRole != "admin" && anomaly.UserID != userID {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "ACCESS_DENIED",
				Message: "Access denied to this anomaly data",
			},
		})
		return
	}

	if err := h.anomalyService.DeleteAnomalyData(anomalyID); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "DELETE_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "Anomaly data deleted successfully"},
	})
}

// GetAnomalyStats godoc
// @Summary Get anomaly detection statistics
// @Description Get statistics about anomaly detection results
// @Tags anomalies
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Router /anomalies/stats [get]
func (h *Handler) GetAnomalyStats(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "User authentication required",
			},
		})
		return
	}

	userRole, _ := middleware.GetUserRole(c)
	var stats map[string]interface{}
	var err error

	if userRole == "admin" {
		stats, err = h.anomalyService.GetAnomalyStats(nil)
	} else {
		stats, err = h.anomalyService.GetAnomalyStats(&userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error: &models.APIError{
				Code:    "STATS_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// System Handlers

// SystemHealth godoc
// @Summary System health check (Admin only)
// @Description Get system health status
// @Tags system
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse{data=models.HealthCheck}
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Router /system/health [get]
func (h *Handler) SystemHealth(c *gin.Context) {
	health := models.HealthCheck{
		Status:    "healthy",
		Version:   "2.0.0",
		Timestamp: time.Now(),
		Services: map[string]string{
			"database": "healthy",
			"api":      "healthy",
		},
		Uptime: "running",
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    health,
	})
}

// SystemStats godoc
// @Summary System statistics (Admin only)
// @Description Get system-wide statistics
// @Tags system
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Router /system/stats [get]
func (h *Handler) SystemStats(c *gin.Context) {
	// This would typically gather system metrics
	stats := gin.H{
		"timestamp":     time.Now(),
		"total_users":   0, // Would be calculated from database
		"total_anomalies": 0, // Would be calculated from database
		"api_version":   "2.0.0",
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}