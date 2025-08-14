// Package grpc provides gRPC server implementation
package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_auth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	grpc_validator "github.com/grpc-ecosystem/go-grpc-middleware/validator"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
	"github.com/ruvnet/alienator/internal/services"
)

// Server wraps the gRPC server and its dependencies
type Server struct {
	grpcServer     *grpc.Server
	healthServer   *health.Server
	authService    *services.AuthService
	anomalyService *services.AnomalyService
	userService    *services.UserService
	logger         *zap.Logger
	port           int
}

// Config holds server configuration
type Config struct {
	Port                int
	MaxConnectionIdle   time.Duration
	MaxConnectionAge    time.Duration
	MaxConnectionAgeGrace time.Duration
	Time                time.Duration
	Timeout             time.Duration
}

// NewServer creates a new gRPC server
func NewServer(
	config Config,
	authService *services.AuthService,
	anomalyService *services.AnomalyService,
	userService *services.UserService,
	logger *zap.Logger,
) *Server {
	// Configure keepalive parameters
	kaep := keepalive.EnforcementPolicy{
		MinTime:             5 * time.Second,
		PermitWithoutStream: true,
	}

	kasp := keepalive.ServerParameters{
		MaxConnectionIdle:     config.MaxConnectionIdle,
		MaxConnectionAge:      config.MaxConnectionAge,
		MaxConnectionAgeGrace: config.MaxConnectionAgeGrace,
		Time:                  config.Time,
		Timeout:               config.Timeout,
	}

	// Create auth function
	authFunc := func(ctx context.Context) (context.Context, error) {
		token, err := grpc_auth.AuthFromMD(ctx, "bearer")
		if err != nil {
			return nil, status.Errorf(codes.Unauthenticated, "invalid auth token: %v", err)
		}

		claims, err := authService.ValidateToken(token)
		if err != nil {
			return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
		}

		// Add user context
		ctx = context.WithValue(ctx, "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "role", claims.Role)
		ctx = context.WithValue(ctx, "email", claims.Email)

		return ctx, nil
	}

	// Recovery function
	recoveryFunc := func(p interface{}) error {
		logger.Error("gRPC panic recovered", zap.Any("panic", p))
		return status.Errorf(codes.Internal, "internal server error")
	}

	// Create gRPC server with middleware
	grpcServer := grpc.NewServer(
		grpc.KeepaliveEnforcementPolicy(kaep),
		grpc.KeepaliveParams(kasp),
		grpc.Creds(insecure.NewCredentials()),
		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
			grpc_prometheus.StreamServerInterceptor,
			grpc_auth.StreamServerInterceptor(authFunc),
			grpc_validator.StreamServerInterceptor(),
			grpc_recovery.StreamServerInterceptor(grpc_recovery.WithRecoveryHandler(recoveryFunc)),
		)),
		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
			grpc_prometheus.UnaryServerInterceptor,
			grpc_auth.UnaryServerInterceptor(authFunc),
			grpc_validator.UnaryServerInterceptor(),
			grpc_recovery.UnaryServerInterceptor(grpc_recovery.WithRecoveryHandler(recoveryFunc)),
		)),
	)

	// Initialize health server
	healthServer := health.NewServer()

	// Create server instance
	server := &Server{
		grpcServer:     grpcServer,
		healthServer:   healthServer,
		authService:    authService,
		anomalyService: anomalyService,
		userService:    userService,
		logger:         logger,
		port:           config.Port,
	}

	// Register services
	server.registerServices()

	// Register health service
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)

	// Enable reflection for debugging
	reflection.Register(grpcServer)

	// Initialize Prometheus metrics
	grpc_prometheus.Register(grpcServer)

	return server
}

// registerServices registers all gRPC services
func (s *Server) registerServices() {
	// Register Auth Service
	authServer := &AuthServiceServer{
		authService: s.authService,
		logger:      s.logger,
	}
	pb.RegisterAuthServiceServer(s.grpcServer, authServer)

	// Register Anomaly Service
	anomalyServer := &AnomalyServiceServer{
		anomalyService: s.anomalyService,
		logger:         s.logger,
	}
	pb.RegisterAnomalyServiceServer(s.grpcServer, anomalyServer)

	// Register User Service
	userServer := &UserServiceServer{
		userService: s.userService,
		logger:      s.logger,
	}
	pb.RegisterUserServiceServer(s.grpcServer, userServer)

	// Register Health Service
	healthServer := &HealthServiceServer{
		logger: s.logger,
	}
	pb.RegisterHealthServiceServer(s.grpcServer, healthServer)

	// Register Admin Service
	adminServer := &AdminServiceServer{
		logger: s.logger,
	}
	pb.RegisterAdminServiceServer(s.grpcServer, adminServer)

	s.logger.Info("All gRPC services registered successfully")
}

// Start starts the gRPC server
func (s *Server) Start() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		return fmt.Errorf("failed to listen on port %d: %w", s.port, err)
	}

	// Set all services as healthy
	s.healthServer.SetServingStatus("auth", grpc_health_v1.HealthCheckResponse_SERVING)
	s.healthServer.SetServingStatus("anomaly", grpc_health_v1.HealthCheckResponse_SERVING)
	s.healthServer.SetServingStatus("user", grpc_health_v1.HealthCheckResponse_SERVING)
	s.healthServer.SetServingStatus("admin", grpc_health_v1.HealthCheckResponse_SERVING)
	s.healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	s.logger.Info("Starting gRPC server",
		zap.Int("port", s.port),
		zap.String("address", listener.Addr().String()),
	)

	return s.grpcServer.Serve(listener)
}

// Stop gracefully stops the gRPC server
func (s *Server) Stop() {
	s.logger.Info("Shutting down gRPC server")
	
	// Set all services as not serving
	s.healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	
	// Graceful stop
	s.grpcServer.GracefulStop()
	
	s.logger.Info("gRPC server stopped")
}

// GetGRPCServer returns the underlying gRPC server
func (s *Server) GetGRPCServer() *grpc.Server {
	return s.grpcServer
}

// Helper functions for extracting context values
func getUserIDFromContext(ctx context.Context) (string, error) {
	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return "", status.Error(codes.Unauthenticated, "user ID not found in context")
	}
	return userID, nil
}

func getUserRoleFromContext(ctx context.Context) (string, error) {
	role, ok := ctx.Value("role").(string)
	if !ok {
		return "", status.Error(codes.Unauthenticated, "user role not found in context")
	}
	return role, nil
}

func getUserEmailFromContext(ctx context.Context) (string, error) {
	email, ok := ctx.Value("email").(string)
	if !ok {
		return "", status.Error(codes.Unauthenticated, "user email not found in context")
	}
	return email, nil
}

// RequireAdmin checks if the user has admin role
func RequireAdmin(ctx context.Context) error {
	role, err := getUserRoleFromContext(ctx)
	if err != nil {
		return err
	}
	
	if role != "admin" {
		return status.Error(codes.PermissionDenied, "admin role required")
	}
	
	return nil
}

// createStatus creates a status response
func createStatus(code codes.Code, message string) *pb.Status {
	return &pb.Status{
		Code:    int32(code),
		Message: message,
	}
}

// createSuccessStatus creates a success status
func createSuccessStatus() *pb.Status {
	return &pb.Status{
		Code:    int32(codes.OK),
		Message: "Success",
	}
}

// createErrorStatus creates an error status from an error
func createErrorStatus(err error) *pb.Status {
	if s, ok := status.FromError(err); ok {
		return &pb.Status{
			Code:    int32(s.Code()),
			Message: s.Message(),
			Details: s.Message(),
		}
	}
	
	return &pb.Status{
		Code:    int32(codes.Internal),
		Message: "Internal server error",
		Details: err.Error(),
	}
}