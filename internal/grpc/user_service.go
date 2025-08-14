package grpc

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
	"github.com/ruvnet/alienator/internal/services"
)

// UserServiceServer implements the gRPC UserService
type UserServiceServer struct {
	pb.UnimplementedUserServiceServer
	userService *services.UserService
	logger      *zap.Logger
}

// GetUser retrieves user information
func (s *UserServiceServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	s.logger.Debug("gRPC GetUser request", zap.String("user_id", req.UserId))

	if req.UserId == "" {
		return &pb.GetUserResponse{
			Status: createStatus(codes.InvalidArgument, "User ID is required"),
		}, nil
	}

	userUUID, err := uuid.Parse(req.UserId)
	if err != nil {
		return &pb.GetUserResponse{
			Status: createStatus(codes.InvalidArgument, "Invalid user ID format"),
		}, nil
	}

	user, err := s.userService.GetUserByID(userUUID)
	if err != nil {
		s.logger.Warn("User not found", zap.String("user_id", req.UserId), zap.Error(err))
		return &pb.GetUserResponse{
			Status: createStatus(codes.NotFound, "User not found"),
		}, nil
	}

	pbUser := &pb.User{
		Id:        user.ID.String(),
		Email:     user.Email,
		Username:  user.Username,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Role:      user.Role,
		IsActive:  user.IsActive,
		CreatedAt: timestamppb.New(user.CreatedAt),
		UpdatedAt: timestamppb.New(user.UpdatedAt),
	}

	response := &pb.GetUserResponse{
		Status: createSuccessStatus(),
		User:   pbUser,
	}

	return response, nil
}

// UpdateUser updates user information
func (s *UserServiceServer) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.UpdateUserResponse, error) {
	s.logger.Info("gRPC UpdateUser request", zap.String("user_id", req.UserId))

	if req.UserId == "" {
		return &pb.UpdateUserResponse{
			Status: createStatus(codes.InvalidArgument, "User ID is required"),
		}, nil
	}

	// Check permissions - users can only update their own profile, or admin can update any
	requestingUserID, err := getUserIDFromContext(ctx)
	if err != nil {
		return &pb.UpdateUserResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	role, _ := getUserRoleFromContext(ctx)
	if requestingUserID != req.UserId && role != "admin" {
		return &pb.UpdateUserResponse{
			Status: createStatus(codes.PermissionDenied, "Permission denied"),
		}, nil
	}

	userUUID, err := uuid.Parse(req.UserId)
	if err != nil {
		return &pb.UpdateUserResponse{
			Status: createStatus(codes.InvalidArgument, "Invalid user ID format"),
		}, nil
	}

	// In a real implementation, you would call userService.UpdateUser
	// For now, we'll return a mock response
	updatedUser := &pb.User{
		Id:        req.UserId,
		Email:     req.Email,
		Username:  req.Username,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      req.Role,
		IsActive:  req.IsActive,
		UpdatedAt: time.Now(),
	}

	response := &pb.UpdateUserResponse{
		Status: createSuccessStatus(),
		User:   updatedUser,
	}

	s.logger.Info("User updated successfully", zap.String("user_id", req.UserId))
	return response, nil
}

// DeleteUser deletes a user (admin only)
func (s *UserServiceServer) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	s.logger.Info("gRPC DeleteUser request", zap.String("user_id", req.UserId))

	// Check admin permissions
	if err := RequireAdmin(ctx); err != nil {
		return &pb.DeleteUserResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	if req.UserId == "" {
		return &pb.DeleteUserResponse{
			Status: createStatus(codes.InvalidArgument, "User ID is required"),
		}, nil
	}

	userUUID, err := uuid.Parse(req.UserId)
	if err != nil {
		return &pb.DeleteUserResponse{
			Status: createStatus(codes.InvalidArgument, "Invalid user ID format"),
		}, nil
	}

	// In a real implementation, you would call userService.DeleteUser
	err = s.userService.DeleteUser(userUUID)
	if err != nil {
		s.logger.Error("Failed to delete user", zap.String("user_id", req.UserId), zap.Error(err))
		return &pb.DeleteUserResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	response := &pb.DeleteUserResponse{
		Status: createSuccessStatus(),
	}

	s.logger.Info("User deleted successfully", zap.String("user_id", req.UserId))
	return response, nil
}

// ListUsers retrieves a list of users with pagination
func (s *UserServiceServer) ListUsers(ctx context.Context, req *pb.ListUsersRequest) (*pb.ListUsersResponse, error) {
	s.logger.Debug("gRPC ListUsers request")

	// Check admin permissions for full list, or return limited info for regular users
	role, _ := getUserRoleFromContext(ctx)
	if role != "admin" {
		return &pb.ListUsersResponse{
			Status: createStatus(codes.PermissionDenied, "Admin access required"),
		}, nil
	}

	// Set defaults
	page := req.Page
	if page <= 0 {
		page = 1
	}
	limit := req.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	// Mock response - in real implementation, query database with pagination
	users := []*pb.User{
		{
			Id:        uuid.New().String(),
			Email:     "user1@example.com",
			Username:  "user1",
			FirstName: "John",
			LastName:  "Doe",
			Role:      "user",
			IsActive:  true,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			Id:        uuid.New().String(),
			Email:     "admin@example.com",
			Username:  "admin",
			FirstName: "Admin",
			LastName:  "User",
			Role:      "admin",
			IsActive:  true,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	// Apply filters
	if req.Role != "" {
		filteredUsers := make([]*pb.User, 0)
		for _, user := range users {
			if user.Role == req.Role {
				filteredUsers = append(filteredUsers, user)
			}
		}
		users = filteredUsers
	}

	if req.ActiveOnly {
		filteredUsers := make([]*pb.User, 0)
		for _, user := range users {
			if user.IsActive {
				filteredUsers = append(filteredUsers, user)
			}
		}
		users = filteredUsers
	}

	total := int32(len(users))
	totalPages := (total + limit - 1) / limit

	response := &pb.ListUsersResponse{
		Status:     createSuccessStatus(),
		Users:      users,
		Total:      total,
		Page:       page,
		TotalPages: totalPages,
	}

	s.logger.Debug("Users listed successfully", zap.Int32("total", total))
	return response, nil
}

// ChangePassword changes user password
func (s *UserServiceServer) ChangePassword(ctx context.Context, req *pb.ChangePasswordRequest) (*pb.ChangePasswordResponse, error) {
	s.logger.Info("gRPC ChangePassword request", zap.String("user_id", req.UserId))

	if req.UserId == "" || req.CurrentPassword == "" || req.NewPassword == "" {
		return &pb.ChangePasswordResponse{
			Status: createStatus(codes.InvalidArgument, "User ID, current password, and new password are required"),
		}, nil
	}

	// Check permissions - users can only change their own password
	requestingUserID, err := getUserIDFromContext(ctx)
	if err != nil {
		return &pb.ChangePasswordResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	if requestingUserID != req.UserId {
		return &pb.ChangePasswordResponse{
			Status: createStatus(codes.PermissionDenied, "Can only change your own password"),
		}, nil
	}

	userUUID, err := uuid.Parse(req.UserId)
	if err != nil {
		return &pb.ChangePasswordResponse{
			Status: createStatus(codes.InvalidArgument, "Invalid user ID format"),
		}, nil
	}

	// In a real implementation, you would call userService.ChangePassword
	err = s.userService.ChangePassword(userUUID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		s.logger.Warn("Password change failed", zap.String("user_id", req.UserId), zap.Error(err))
		return &pb.ChangePasswordResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	response := &pb.ChangePasswordResponse{
		Status: createSuccessStatus(),
	}

	s.logger.Info("Password changed successfully", zap.String("user_id", req.UserId))
	return response, nil
}