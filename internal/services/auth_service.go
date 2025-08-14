// Package services provides business logic layer
package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/middleware"
	"github.com/ruvnet/alienator/internal/models"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// AuthService handles authentication and authorization
type AuthService struct {
	config *config.Config
	logger *zap.Logger
}

// NewAuthService creates a new authentication service
func NewAuthService(config *config.Config, logger *zap.Logger) *AuthService {
	return &AuthService{
		config: config,
		logger: logger,
	}
}

// HashPassword hashes a password using bcrypt
func (s *AuthService) HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %v", err)
	}
	return string(hashedBytes), nil
}

// CheckPassword verifies a password against its hash
func (s *AuthService) CheckPassword(password, hashedPassword string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

// GenerateToken generates a JWT token for a user
func (s *AuthService) GenerateToken(user *models.User) (string, time.Time, error) {
	expirationTime := time.Now().Add(s.config.JWT.ExpirationTime)

	claims := &middleware.Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Username: user.Username,
		Role:     user.Role,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
			IssuedAt:  time.Now().Unix(),
			NotBefore: time.Now().Unix(),
			Issuer:    s.config.JWT.Issuer,
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to generate token: %v", err)
	}

	return tokenString, expirationTime, nil
}

// ValidateToken validates a JWT token and returns claims
func (s *AuthService) ValidateToken(tokenString string) (*middleware.Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &middleware.Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %v", err)
	}

	claims, ok := token.Claims.(*middleware.Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	// Check if token is expired
	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		return nil, errors.New("token has expired")
	}

	// Check if token is used before valid time
	if time.Unix(claims.NotBefore, 0).After(time.Now()) {
		return nil, errors.New("token not valid yet")
	}

	return claims, nil
}

// RefreshToken generates a new token for an existing valid token
func (s *AuthService) RefreshToken(tokenString string) (string, time.Time, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("cannot refresh invalid token: %v", err)
	}

	// Check if token is close to expiration (within 1 hour)
	expirationTime := time.Unix(claims.ExpiresAt, 0)
	if time.Until(expirationTime) > time.Hour {
		return "", time.Time{}, errors.New("token is not close to expiration")
	}

	// Generate new token with updated expiration
	newExpirationTime := time.Now().Add(s.config.JWT.ExpirationTime)
	claims.ExpiresAt = newExpirationTime.Unix()
	claims.IssuedAt = time.Now().Unix()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	newTokenString, err := token.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to generate refresh token: %v", err)
	}

	return newTokenString, newExpirationTime, nil
}

// ValidateUserCredentials validates user login credentials
func (s *AuthService) ValidateUserCredentials(email, password string, user *models.User) error {
	if user == nil {
		return errors.New("user not found")
	}

	if !user.IsActive {
		return errors.New("user account is disabled")
	}

	if err := s.CheckPassword(password, user.Password); err != nil {
		s.logger.Warn("Invalid password attempt",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
		)
		return errors.New("invalid credentials")
	}

	return nil
}

// GetUserFromToken extracts user information from a valid token
func (s *AuthService) GetUserFromToken(tokenString string) (*models.User, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:       claims.UserID,
		Email:    claims.Email,
		Username: claims.Username,
		Role:     claims.Role,
	}

	return user, nil
}

// ValidatePasswordStrength validates password strength requirements
func (s *AuthService) ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters long")
	}

	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false

	for _, char := range password {
		switch {
		case 'a' <= char && char <= 'z':
			hasLower = true
		case 'A' <= char && char <= 'Z':
			hasUpper = true
		case '0' <= char && char <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}

	if !hasLower {
		return errors.New("password must contain at least one lowercase letter")
	}
	if !hasUpper {
		return errors.New("password must contain at least one uppercase letter")
	}
	if !hasDigit {
		return errors.New("password must contain at least one digit")
	}
	if !hasSpecial {
		return errors.New("password must contain at least one special character")
	}

	return nil
}

// GeneratePasswordResetToken generates a token for password reset
func (s *AuthService) GeneratePasswordResetToken(userID uuid.UUID) (string, time.Time, error) {
	expirationTime := time.Now().Add(30 * time.Minute) // 30 minutes for password reset

	claims := &jwt.StandardClaims{
		ExpiresAt: expirationTime.Unix(),
		IssuedAt:  time.Now().Unix(),
		NotBefore: time.Now().Unix(),
		Issuer:    s.config.JWT.Issuer,
		Subject:   userID.String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWT.Secret + "reset"))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to generate password reset token: %v", err)
	}

	return tokenString, expirationTime, nil
}

// ValidatePasswordResetToken validates a password reset token
func (s *AuthService) ValidatePasswordResetToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret + "reset"), nil
	})

	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to parse reset token: %v", err)
	}

	claims, ok := token.Claims.(*jwt.StandardClaims)
	if !ok || !token.Valid {
		return uuid.Nil, errors.New("invalid reset token")
	}

	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		return uuid.Nil, errors.New("reset token has expired")
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID in token: %v", err)
	}

	return userID, nil
}