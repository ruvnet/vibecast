// Package middleware provides HTTP middleware for the API server
package middleware

import (
	"net/http"
	"strings"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/models"
)

// Claims represents JWT claims
type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	jwt.StandardClaims
}

// AuthService interface for dependency injection
type AuthService interface {
	ValidateToken(tokenString string) (*Claims, error)
}

// Auth middleware validates JWT tokens
func Auth(authService AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for certain paths
		if isPublicPath(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "MISSING_TOKEN",
					Message: "Authorization token is required",
				},
			})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>" format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "INVALID_TOKEN_FORMAT",
					Message: "Invalid authorization header format",
				},
			})
			c.Abort()
			return
		}

		tokenString := tokenParts[1]

		// Validate token
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "INVALID_TOKEN",
					Message: "Invalid or expired token",
					Details: err.Error(),
				},
			})
			c.Abort()
			return
		}

		// Set user information in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_username", claims.Username)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// AdminOnly middleware ensures only admin users can access the endpoint
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "ACCESS_DENIED",
					Message: "Admin access required",
				},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// OptionalAuth middleware for endpoints that work with or without authentication
func OptionalAuth(authService AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := tokenParts[1]
		claims, err := authService.ValidateToken(tokenString)
		if err == nil {
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("user_username", claims.Username)
			c.Set("user_role", claims.Role)
		}

		c.Next()
	}
}

// isPublicPath checks if the path should skip authentication
func isPublicPath(path string) bool {
	publicPaths := []string{
		"/health",
		"/metrics",
		"/swagger",
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/playground",
	}

	for _, publicPath := range publicPaths {
		if strings.HasPrefix(path, publicPath) {
			return true
		}
	}

	return false
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}

	id, ok := userID.(uuid.UUID)
	return id, ok
}

// GetUserRole extracts user role from context
func GetUserRole(c *gin.Context) (string, bool) {
	userRole, exists := c.Get("user_role")
	if !exists {
		return "", false
	}

	role, ok := userRole.(string)
	return role, ok
}

// RequireRole middleware ensures user has specific role
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := GetUserRole(c)
		if !exists || userRole != requiredRole {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "INSUFFICIENT_PERMISSIONS",
					Message: "Insufficient permissions for this operation",
				},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}