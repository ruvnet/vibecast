package auth

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User represents an authenticated user
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// AuthService handles authentication and authorization
type AuthService struct {
	secretKey string
}

// NewAuthService creates a new authentication service
func NewAuthService(secretKey string) *AuthService {
	return &AuthService{
		secretKey: secretKey,
	}
}

// HashPassword hashes a password using bcrypt
func (a *AuthService) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword validates a password against its hash
func (a *AuthService) CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateToken generates a JWT token for the user (placeholder)
func (a *AuthService) GenerateToken(user *User) (string, error) {
	// In a real implementation, use a JWT library like github.com/golang-jwt/jwt
	// For now, return a placeholder token
	
	if user == nil {
		return "", errors.New("user cannot be nil")
	}

	// Placeholder token implementation
	token := "placeholder-jwt-token-" + user.ID + "-" + time.Now().Format("20060102150405")
	
	return token, nil
}

// ValidateToken validates a JWT token and returns the user (placeholder)
func (a *AuthService) ValidateToken(token string) (*User, error) {
	// In a real implementation, parse and validate the JWT token
	// For now, return a placeholder user if token is not empty
	
	if token == "" {
		return nil, errors.New("token cannot be empty")
	}

	// Placeholder validation
	if len(token) < 10 {
		return nil, errors.New("invalid token format")
	}

	// Return a placeholder user
	user := &User{
		ID:       "user-123",
		Username: "testuser",
		Email:    "test@example.com",
		Role:     "user",
	}

	return user, nil
}

// IsAuthorized checks if a user has permission to perform an action
func (a *AuthService) IsAuthorized(user *User, resource, action string) bool {
	if user == nil {
		return false
	}

	// Simple role-based authorization
	switch user.Role {
	case "admin":
		return true // Admin can do everything
	case "moderator":
		// Moderators can read and update but not delete
		return action != "delete"
	case "user":
		// Regular users can only read
		return action == "read"
	default:
		return false
	}
}

// RefreshToken generates a new token based on an existing valid token
func (a *AuthService) RefreshToken(oldToken string) (string, error) {
	user, err := a.ValidateToken(oldToken)
	if err != nil {
		return "", err
	}

	return a.GenerateToken(user)
}