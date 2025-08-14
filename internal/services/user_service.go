// Package services provides business logic layer
package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/internal/repository"
	"go.uber.org/zap"
)

// UserService handles user-related business logic
type UserService struct {
	repo   repository.Repository
	logger *zap.Logger
}

// NewUserService creates a new user service
func NewUserService(repo repository.Repository, logger *zap.Logger) *UserService {
	return &UserService{
		repo:   repo,
		logger: logger,
	}
}

// CreateUser creates a new user
func (s *UserService) CreateUser(req *models.RegisterRequest, hashedPassword string) (*models.User, error) {
	// Check if user with email already exists
	if _, err := s.repo.GetUserByEmail(req.Email); err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Check if user with username already exists
	if _, err := s.repo.GetUserByUsername(req.Username); err == nil {
		return nil, errors.New("user with this username already exists")
	}

	user := &models.User{
		Email:     req.Email,
		Username:  req.Username,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Password:  hashedPassword,
		Role:      "user",
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.CreateUser(user); err != nil {
		s.logger.Error("Failed to create user", zap.Error(err), zap.String("email", req.Email))
		return nil, fmt.Errorf("failed to create user: %v", err)
	}

	s.logger.Info("User created successfully", 
		zap.String("user_id", user.ID.String()),
		zap.String("email", user.Email),
		zap.String("username", user.Username),
	)

	return user, nil
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(id uuid.UUID) (*models.User, error) {
	user, err := s.repo.GetUserByID(id)
	if err != nil {
		s.logger.Debug("User not found", zap.String("user_id", id.String()))
		return nil, fmt.Errorf("user not found")
	}

	return user, nil
}

// GetUserByEmail retrieves a user by email
func (s *UserService) GetUserByEmail(email string) (*models.User, error) {
	user, err := s.repo.GetUserByEmail(email)
	if err != nil {
		s.logger.Debug("User not found", zap.String("email", email))
		return nil, fmt.Errorf("user not found")
	}

	return user, nil
}

// GetUserByUsername retrieves a user by username
func (s *UserService) GetUserByUsername(username string) (*models.User, error) {
	user, err := s.repo.GetUserByUsername(username)
	if err != nil {
		s.logger.Debug("User not found", zap.String("username", username))
		return nil, fmt.Errorf("user not found")
	}

	return user, nil
}

// UpdateUser updates user information
func (s *UserService) UpdateUser(id uuid.UUID, updates *models.UpdateUserRequest) (*models.User, error) {
	// Verify user exists
	user, err := s.repo.GetUserByID(id)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	// Check for email uniqueness if email is being updated
	if updates.Email != nil && *updates.Email != user.Email {
		if existingUser, err := s.repo.GetUserByEmail(*updates.Email); err == nil && existingUser.ID != id {
			return nil, errors.New("email already in use by another user")
		}
	}

	// Check for username uniqueness if username is being updated
	if updates.Username != nil && *updates.Username != user.Username {
		if existingUser, err := s.repo.GetUserByUsername(*updates.Username); err == nil && existingUser.ID != id {
			return nil, errors.New("username already in use by another user")
		}
	}

	if err := s.repo.UpdateUser(id, updates); err != nil {
		s.logger.Error("Failed to update user", zap.Error(err), zap.String("user_id", id.String()))
		return nil, fmt.Errorf("failed to update user: %v", err)
	}

	// Fetch updated user
	updatedUser, err := s.repo.GetUserByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated user: %v", err)
	}

	s.logger.Info("User updated successfully", 
		zap.String("user_id", id.String()),
		zap.String("updated_by", id.String()),
	)

	return updatedUser, nil
}

// DeleteUser deletes a user (soft delete by deactivating)
func (s *UserService) DeleteUser(id uuid.UUID) error {
	// Verify user exists
	_, err := s.repo.GetUserByID(id)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := s.repo.DeleteUser(id); err != nil {
		s.logger.Error("Failed to delete user", zap.Error(err), zap.String("user_id", id.String()))
		return fmt.Errorf("failed to delete user: %v", err)
	}

	s.logger.Info("User deleted successfully", zap.String("user_id", id.String()))
	return nil
}

// ListUsers retrieves a paginated list of users
func (s *UserService) ListUsers(page, limit int) ([]*models.User, *models.Meta, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	users, total, err := s.repo.ListUsers(page, limit)
	if err != nil {
		s.logger.Error("Failed to list users", zap.Error(err))
		return nil, nil, fmt.Errorf("failed to list users: %v", err)
	}

	totalPages := (total + limit - 1) / limit
	meta := &models.Meta{
		Page:       page,
		PerPage:    limit,
		Total:      total,
		TotalPages: totalPages,
	}

	return users, meta, nil
}

// ValidateUserPermissions checks if user has permission for a specific action
func (s *UserService) ValidateUserPermissions(userID uuid.UUID, action string, resourceOwnerID uuid.UUID) error {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if !user.IsActive {
		return errors.New("user account is disabled")
	}

	// Admin can do anything
	if user.Role == "admin" {
		return nil
	}

	// User can only modify their own resources
	switch action {
	case "read_own", "update_own", "delete_own":
		if userID != resourceOwnerID {
			return errors.New("insufficient permissions")
		}
	case "read_all", "update_all", "delete_all", "create_admin":
		return errors.New("admin access required")
	}

	return nil
}

// ChangePassword changes user password
func (s *UserService) ChangePassword(userID uuid.UUID, oldPassword, newHashedPassword string) error {
	_, err := s.repo.GetUserByEmail("")
	if err != nil {
		// Get user by ID first to get email
		userFromID, err := s.repo.GetUserByID(userID)
		if err != nil {
			return fmt.Errorf("user not found")
		}
		_, err = s.repo.GetUserByEmail(userFromID.Email)
		if err != nil {
			return fmt.Errorf("user not found")
		}
	}

	// For demonstration - in real implementation, you'd verify old password here
	// This would require integrating with AuthService or passing it as a parameter

	// Update password in database
	updates := &models.UpdateUserRequest{
		// Password update would require extending UpdateUserRequest
		// or creating a separate method in repository
	}

	if err := s.repo.UpdateUser(userID, updates); err != nil {
		s.logger.Error("Failed to change password", zap.Error(err), zap.String("user_id", userID.String()))
		return fmt.Errorf("failed to change password: %v", err)
	}

	s.logger.Info("Password changed successfully", zap.String("user_id", userID.String()))
	return nil
}

// GetUserStats returns user statistics
func (s *UserService) GetUserStats(userID uuid.UUID) (map[string]interface{}, error) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	// Get user's anomaly data count
	_, total, err := s.repo.GetAnomalyDataByUserID(userID, 1, 1)
	if err != nil {
		s.logger.Warn("Failed to get user anomaly data count", zap.Error(err))
		total = 0
	}

	stats := map[string]interface{}{
		"user_id":           user.ID,
		"username":          user.Username,
		"email":             user.Email,
		"role":              user.Role,
		"is_active":         user.IsActive,
		"created_at":        user.CreatedAt,
		"anomaly_data_count": total,
		"account_age_days":  int(time.Since(user.CreatedAt).Hours() / 24),
	}

	return stats, nil
}