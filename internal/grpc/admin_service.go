package grpc

import (
	"context"
	"runtime"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
)

// AdminServiceServer implements the gRPC AdminService
type AdminServiceServer struct {
	pb.UnimplementedAdminServiceServer
	logger    *zap.Logger
	startTime time.Time
}

// GetSystemInfo retrieves system information
func (s *AdminServiceServer) GetSystemInfo(ctx context.Context, req *emptypb.Empty) (*pb.SystemInfoResponse, error) {
	// Check admin permissions
	if err := RequireAdmin(ctx); err != nil {
		return &pb.SystemInfoResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Debug("gRPC GetSystemInfo request")

	uptime := time.Since(s.startTime)
	
	services := map[string]string{
		"auth":    "healthy",
		"anomaly": "healthy", 
		"user":    "healthy",
		"grpc":    "healthy",
		"rest":    "healthy",
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	systemStats := map[string]string{
		"go_version":      runtime.Version(),
		"goroutines":      fmt.Sprintf("%d", runtime.NumGoroutine()),
		"memory_alloc":    fmt.Sprintf("%d KB", m.Alloc/1024),
		"memory_sys":      fmt.Sprintf("%d KB", m.Sys/1024),
		"gc_runs":         fmt.Sprintf("%d", m.NumGC),
		"cpu_cores":       fmt.Sprintf("%d", runtime.NumCPU()),
	}

	response := &pb.SystemInfoResponse{
		Status:      createSuccessStatus(),
		Version:     "2.0.0",
		Uptime:      uptime.String(),
		Services:    services,
		SystemStats: systemStats,
		Timestamp:   time.Now(),
	}

	return response, nil
}

// GetMetrics retrieves system metrics
func (s *AdminServiceServer) GetMetrics(ctx context.Context, req *pb.GetMetricsRequest) (*pb.GetMetricsResponse, error) {
	// Check admin permissions
	if err := RequireAdmin(ctx); err != nil {
		return &pb.GetMetricsResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Debug("gRPC GetMetrics request", zap.String("timeframe", req.Timeframe))

	// Mock metrics data
	metrics := map[string]*pb.MetricValue{
		"api_requests_total": {
			Value: 15420,
			Unit:  "requests",
			History: []*pb.DataPoint{
				{Value: 14800, Timestamp: timestamppb.New(time.Now().Add(-1 * time.Hour))},
				{Value: 15200, Timestamp: timestamppb.New(time.Now().Add(-30 * time.Minute))},
				{Value: 15420, Timestamp: time.Now()},
			},
		},
		"anomaly_detections_total": {
			Value: 892,
			Unit:  "detections",
			History: []*pb.DataPoint{
				{Value: 850, Timestamp: timestamppb.New(time.Now().Add(-1 * time.Hour))},
				{Value: 875, Timestamp: timestamppb.New(time.Now().Add(-30 * time.Minute))},
				{Value: 892, Timestamp: time.Now()},
			},
		},
		"active_connections": {
			Value: 45,
			Unit:  "connections",
			History: []*pb.DataPoint{
				{Value: 42, Timestamp: timestamppb.New(time.Now().Add(-1 * time.Hour))},
				{Value: 48, Timestamp: timestamppb.New(time.Now().Add(-30 * time.Minute))},
				{Value: 45, Timestamp: time.Now()},
			},
		},
		"average_response_time": {
			Value: 125.5,
			Unit:  "ms",
			History: []*pb.DataPoint{
				{Value: 130.2, Timestamp: timestamppb.New(time.Now().Add(-1 * time.Hour))},
				{Value: 128.7, Timestamp: timestamppb.New(time.Now().Add(-30 * time.Minute))},
				{Value: 125.5, Timestamp: time.Now()},
			},
		},
	}

	// Filter metrics if specific ones requested
	if len(req.Metrics) > 0 {
		filteredMetrics := make(map[string]*pb.MetricValue)
		for _, metricName := range req.Metrics {
			if metric, exists := metrics[metricName]; exists {
				filteredMetrics[metricName] = metric
			}
		}
		metrics = filteredMetrics
	}

	response := &pb.GetMetricsResponse{
		Status:    createSuccessStatus(),
		Metrics:   metrics,
		Period:    req.Timeframe,
		Timestamp: time.Now(),
	}

	return response, nil
}

// ExecuteSystemAction executes administrative actions
func (s *AdminServiceServer) ExecuteSystemAction(ctx context.Context, req *pb.SystemActionRequest) (*pb.SystemActionResponse, error) {
	// Check admin permissions
	if err := RequireAdmin(ctx); err != nil {
		return &pb.SystemActionResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Info("gRPC ExecuteSystemAction request", zap.String("action", req.Action))

	startedAt := time.Now()
	result := make(map[string]string)

	switch req.Action {
	case "restart":
		result["message"] = "System restart initiated"
		result["estimated_downtime"] = "30 seconds"
		s.logger.Warn("System restart requested via gRPC")
		
	case "shutdown":
		if !req.Force {
			return &pb.SystemActionResponse{
				Status: createStatus(codes.FailedPrecondition, "Force parameter required for shutdown"),
			}, nil
		}
		result["message"] = "System shutdown initiated"
		s.logger.Warn("System shutdown requested via gRPC")
		
	case "backup":
		result["message"] = "Database backup initiated"
		result["backup_id"] = "backup_20240814_123456"
		result["estimated_duration"] = "5 minutes"
		
	case "restore":
		backupId, exists := req.Params["backup_id"]
		if !exists {
			return &pb.SystemActionResponse{
				Status: createStatus(codes.InvalidArgument, "backup_id parameter required"),
			}, nil
		}
		result["message"] = "Database restore initiated"
		result["backup_id"] = backupId
		result["estimated_duration"] = "10 minutes"
		
	case "cache_clear":
		result["message"] = "Cache cleared successfully"
		result["cleared_keys"] = "1250"
		
	case "log_rotate":
		result["message"] = "Log rotation completed"
		result["rotated_files"] = "5"
		
	default:
		return &pb.SystemActionResponse{
			Status: createStatus(codes.InvalidArgument, "Unknown action: "+req.Action),
		}, nil
	}

	response := &pb.SystemActionResponse{
		Status:      createSuccessStatus(),
		Action:      req.Action,
		Result:      result,
		StartedAt:   startedAt,
		CompletedAt: time.Now(),
	}

	s.logger.Info("System action completed",
		zap.String("action", req.Action),
		zap.Any("result", result),
	)

	return response, nil
}

// GetSystemLogs retrieves system logs
func (s *AdminServiceServer) GetSystemLogs(ctx context.Context, req *pb.GetSystemLogsRequest) (*pb.GetSystemLogsResponse, error) {
	// Check admin permissions
	if err := RequireAdmin(ctx); err != nil {
		return &pb.GetSystemLogsResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Debug("gRPC GetSystemLogs request",
		zap.String("level", req.Level),
		zap.String("service", req.Service),
	)

	// Mock log entries
	logs := []*pb.LogEntry{
		{
			Level:     "INFO",
			Service:   "auth",
			Message:   "User logged in successfully",
			Fields:    map[string]string{"user_id": "123", "ip": "192.168.1.100"},
			Timestamp: timestamppb.New(time.Now().Add(-5 * time.Minute)),
		},
		{
			Level:     "WARN",
			Service:   "anomaly",
			Message:   "High anomaly score detected",
			Fields:    map[string]string{"score": "0.95", "algorithm": "isolation_forest"},
			Timestamp: timestamppb.New(time.Now().Add(-3 * time.Minute)),
		},
		{
			Level:     "ERROR",
			Service:   "grpc",
			Message:   "Failed to process request",
			Fields:    map[string]string{"error": "timeout", "duration": "30s"},
			Timestamp: timestamppb.New(time.Now().Add(-1 * time.Minute)),
		},
		{
			Level:     "DEBUG",
			Service:   "user",
			Message:   "User profile updated",
			Fields:    map[string]string{"user_id": "456", "fields": "email,name"},
			Timestamp: time.Now(),
		},
	}

	// Filter logs by level
	if req.Level != "" {
		filteredLogs := make([]*pb.LogEntry, 0)
		for _, log := range logs {
			if log.Level == req.Level {
				filteredLogs = append(filteredLogs, log)
			}
		}
		logs = filteredLogs
	}

	// Filter logs by service
	if req.Service != "" {
		filteredLogs := make([]*pb.LogEntry, 0)
		for _, log := range logs {
			if log.Service == req.Service {
				filteredLogs = append(filteredLogs, log)
			}
		}
		logs = filteredLogs
	}

	// Apply limit
	if req.Limit > 0 && int(req.Limit) < len(logs) {
		logs = logs[:req.Limit]
	}

	response := &pb.GetSystemLogsResponse{
		Status: createSuccessStatus(),
		Logs:   logs,
	}

	s.logger.Debug("System logs retrieved",
		zap.Int("count", len(logs)),
	)

	return response, nil
}