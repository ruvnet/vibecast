package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
	"go.uber.org/zap"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
	"github.com/ruvnet/alienator/internal/services"
)

// AuthServiceServer implements the gRPC AuthService
type AuthServiceServer struct {
	pb.UnimplementedAuthServiceServer
	authService *services.AuthService
	logger      *zap.Logger
}

// Login handles user authentication
func (s *AuthServiceServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	s.logger.Info("gRPC Login request", zap.String("email", req.Email))

	// Validate request
	if req.Email == "" || req.Password == "" {
		return &pb.LoginResponse{
			Status: createStatus(codes.InvalidArgument, "Email and password are required"),
		}, nil
	}

	// Perform login
	user, token, refreshToken, err := s.authService.Login(req.Email, req.Password, req.RememberMe)
	if err != nil {
		s.logger.Warn("Login failed", zap.String("email", req.Email), zap.Error(err))
		return &pb.LoginResponse{
			Status: createStatus(codes.Unauthenticated, "Invalid credentials"),
		}, nil
	}

	// Convert user to protobuf
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

	response := &pb.LoginResponse{
		Status:       createSuccessStatus(),
		User:         pbUser,
		AccessToken:  token,
		RefreshToken: refreshToken,
		ExpiresAt:    timestamppb.New(user.CreatedAt.Add(24 * 3600 * 1000000000)), // 24 hours
		TokenType:    "Bearer",
	}

	s.logger.Info("Login successful", zap.String("user_id", user.ID.String()))
	return response, nil
}

// Register handles user registration
func (s *AuthServiceServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	s.logger.Info("gRPC Register request", zap.String("email", req.Email))

	// Validate request
	if req.Email == "" || req.Username == "" || req.Password == "" {
		return &pb.RegisterResponse{
			Status: createStatus(codes.InvalidArgument, "Email, username, and password are required"),
		}, nil
	}

	// Perform registration
	user, token, refreshToken, err := s.authService.Register(
		req.Email, req.Username, req.FirstName, req.LastName, req.Password, req.Role,
	)
	if err != nil {
		s.logger.Warn("Registration failed", zap.String("email", req.Email), zap.Error(err))
		return &pb.RegisterResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	// Convert user to protobuf
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

	response := &pb.RegisterResponse{
		Status:       createSuccessStatus(),
		User:         pbUser,
		AccessToken:  token,
		RefreshToken: refreshToken,
		ExpiresAt:    timestamppb.New(user.CreatedAt.Add(24 * 3600 * 1000000000)), // 24 hours
		TokenType:    "Bearer",
	}

	s.logger.Info("Registration successful", zap.String("user_id", user.ID.String()))
	return response, nil
}

// RefreshToken handles token refresh
func (s *AuthServiceServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.RefreshTokenResponse, error) {
	s.logger.Debug("gRPC RefreshToken request")

	if req.RefreshToken == "" {
		return &pb.RefreshTokenResponse{
			Status: createStatus(codes.InvalidArgument, "Refresh token is required"),
		}, nil
	}

	token, expiresAt, err := s.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		s.logger.Warn("Token refresh failed", zap.Error(err))
		return &pb.RefreshTokenResponse{
			Status: createStatus(codes.Unauthenticated, "Invalid refresh token"),
		}, nil
	}

	response := &pb.RefreshTokenResponse{
		Status:      createSuccessStatus(),
		AccessToken: token,
		ExpiresAt:   timestamppb.New(expiresAt),
	}

	s.logger.Debug("Token refresh successful")
	return response, nil
}

// ValidateToken validates a JWT token
func (s *AuthServiceServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResponse, error) {
	if req.Token == "" {
		return &pb.ValidateTokenResponse{
			Status: createStatus(codes.InvalidArgument, "Token is required"),
			Valid:  false,
		}, nil
	}

	claims, err := s.authService.ValidateToken(req.Token)
	if err != nil {
		return &pb.ValidateTokenResponse{
			Status: createStatus(codes.Unauthenticated, "Invalid token"),
			Valid:  false,
		}, nil
	}

	// Get user details (simplified - in real implementation, fetch from database)
	pbUser := &pb.User{
		Id:       claims.UserID.String(),
		Email:    claims.Email,
		Username: claims.Username,
		Role:     claims.Role,
		IsActive: claims.IsActive,
	}

	response := &pb.ValidateTokenResponse{
		Status:    createSuccessStatus(),
		Valid:     true,
		User:      pbUser,
		ExpiresAt: timestamppb.New(claims.ExpiresAt),
	}

	return response, nil
}

// Logout handles user logout
func (s *AuthServiceServer) Logout(ctx context.Context, req *pb.LogoutRequest) (*pb.LogoutResponse, error) {
	s.logger.Debug("gRPC Logout request")

	if req.Token == "" {
		return &pb.LogoutResponse{
			Status: createStatus(codes.InvalidArgument, "Token is required"),
		}, nil
	}

	// In a real implementation, you would blacklist the token
	// For now, we'll just return success
	err := s.authService.Logout(req.Token)
	if err != nil {
		return &pb.LogoutResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	response := &pb.LogoutResponse{
		Status: createSuccessStatus(),
	}

	s.logger.Debug("Logout successful")
	return response, nil
}