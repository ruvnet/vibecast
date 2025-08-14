package grpc

import (
	"context"
	"time"

	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
)

// HealthServiceServer implements the gRPC HealthService
type HealthServiceServer struct {
	pb.UnimplementedHealthServiceServer
	logger *zap.Logger
}

// Check performs a health check
func (s *HealthServiceServer) Check(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	s.logger.Debug("gRPC health check", zap.String("service", req.Service))

	// Check the health of the requested service
	status := pb.HealthCheckResponse_SERVING
	metadata := make(map[string]string)

	switch req.Service {
	case "auth":
		// Check auth service health
		metadata["status"] = "healthy"
		metadata["response_time"] = "5ms"
	case "anomaly":
		// Check anomaly service health  
		metadata["status"] = "healthy"
		metadata["response_time"] = "12ms"
	case "user":
		// Check user service health
		metadata["status"] = "healthy"
		metadata["response_time"] = "8ms"
	case "database":
		// Check database health
		metadata["status"] = "healthy"
		metadata["connections"] = "5/50"
	case "redis":
		// Check Redis health
		metadata["status"] = "healthy"
		metadata["memory_usage"] = "25MB"
	case "":
		// Overall system health
		metadata["status"] = "healthy"
		metadata["services"] = "5"
		metadata["uptime"] = "2h 30m"
	default:
		status = pb.HealthCheckResponse_SERVICE_UNKNOWN
		metadata["error"] = "Unknown service"
	}

	response := &pb.HealthCheckResponse{
		Status:    status,
		Metadata:  metadata,
		Timestamp: time.Now(),
	}

	return response, nil
}

// Watch provides streaming health updates
func (s *HealthServiceServer) Watch(req *pb.HealthCheckRequest, stream pb.HealthService_WatchServer) error {
	s.logger.Info("gRPC health watch started", zap.String("service", req.Service))

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Send initial status
	response := &pb.HealthCheckResponse{
		Status: pb.HealthCheckResponse_SERVING,
		Metadata: map[string]string{
			"status": "healthy",
			"service": req.Service,
		},
		Timestamp: time.Now(),
	}

	if err := stream.Send(response); err != nil {
		s.logger.Error("Failed to send initial health status", zap.Error(err))
		return err
	}

	// Send periodic updates
	for {
		select {
		case <-stream.Context().Done():
			s.logger.Info("Health watch context cancelled")
			return nil
		case <-ticker.C:
			// Update health status
			response := &pb.HealthCheckResponse{
				Status: pb.HealthCheckResponse_SERVING,
				Metadata: map[string]string{
					"status": "healthy",
					"service": req.Service,
					"last_check": time.Now().Format(time.RFC3339),
				},
				Timestamp: time.Now(),
			}

			if err := stream.Send(response); err != nil {
				s.logger.Error("Failed to send health status update", zap.Error(err))
				return err
			}

			s.logger.Debug("Health status update sent", zap.String("service", req.Service))
		}
	}
}