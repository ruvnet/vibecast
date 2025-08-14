package grpc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/ruvnet/alienator/proto/vibecast/v1"
	"github.com/ruvnet/alienator/internal/services"
)

// AnomalyServiceServer implements the gRPC AnomalyService
type AnomalyServiceServer struct {
	pb.UnimplementedAnomalyServiceServer
	anomalyService *services.AnomalyService
	logger         *zap.Logger
}

// DetectAnomaly handles anomaly detection requests
func (s *AnomalyServiceServer) DetectAnomaly(ctx context.Context, req *pb.DetectAnomalyRequest) (*pb.DetectAnomalyResponse, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return &pb.DetectAnomalyResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Info("gRPC DetectAnomaly request", zap.String("user_id", userID))

	if len(req.Data) == 0 {
		return &pb.DetectAnomalyResponse{
			Status: createStatus(codes.InvalidArgument, "Data is required"),
		}, nil
	}

	// Convert string map to interface map
	data := make(map[string]interface{})
	for k, v := range req.Data {
		data[k] = v
	}

	options := make(map[string]interface{})
	for k, v := range req.Options {
		options[k] = v
	}

	userUUID, _ := uuid.Parse(userID)
	threshold := &req.Threshold

	result, err := s.anomalyService.DetectAnomaly(userUUID, data, req.Algorithm, threshold, options)
	if err != nil {
		s.logger.Error("Anomaly detection failed", zap.Error(err))
		return &pb.DetectAnomalyResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	// Convert result to protobuf
	pbResult := &pb.DetectionResult{
		Id:               result.ID.String(),
		IsAnomaly:        result.IsAnomaly,
		Score:            result.Score,
		Confidence:       result.Confidence,
		Threshold:        result.Threshold,
		Algorithm:        result.Algorithm,
		ProcessingTimeMs: result.ProcessingTime,
		Timestamp:        time.Now(),
	}

	// Convert metadata
	if len(result.Metadata.Features) > 0 {
		pbResult.Metadata = make(map[string]string)
		for k, v := range result.Metadata.Features {
			pbResult.Metadata[k] = fmt.Sprintf("%f", v)
		}
	}

	response := &pb.DetectAnomalyResponse{
		Status: createSuccessStatus(),
		Result: pbResult,
	}

	s.logger.Info("Anomaly detection completed",
		zap.String("user_id", userID),
		zap.Bool("is_anomaly", result.IsAnomaly),
		zap.Float64("score", result.Score),
	)

	return response, nil
}

// AnalyzeText handles text analysis requests
func (s *AnomalyServiceServer) AnalyzeText(ctx context.Context, req *pb.AnalyzeTextRequest) (*pb.AnalyzeTextResponse, error) {
	s.logger.Debug("gRPC AnalyzeText request")

	if req.Text == "" {
		return &pb.AnalyzeTextResponse{
			Status: createStatus(codes.InvalidArgument, "Text is required"),
		}, nil
	}

	startTime := time.Now()

	// This would call your actual text analysis service
	// For now, we'll create a mock response
	result := &pb.AnomalyResult{
		Score:        0.3,
		Confidence:   0.8,
		IsAnomalous:  false,
		Timestamp:    time.Now(),
		Details:      make(map[string]*pb.AnalysisResult),
	}

	// Add some mock analysis details
	result.Details["linguistic"] = &pb.AnalysisResult{
		Score:      0.2,
		Confidence: 0.9,
		Metadata: map[string]string{
			"word_count":     "150",
			"avg_word_length": "5.2",
		},
	}

	duration := time.Since(startTime)

	response := &pb.AnalyzeTextResponse{
		Status:     createSuccessStatus(),
		Result:     result,
		DurationMs: duration.Milliseconds(),
	}

	s.logger.Debug("Text analysis completed",
		zap.Int64("duration_ms", duration.Milliseconds()),
		zap.Bool("is_anomalous", result.IsAnomalous),
	)

	return response, nil
}

// BatchAnalyze handles batch text analysis requests
func (s *AnomalyServiceServer) BatchAnalyze(ctx context.Context, req *pb.BatchAnalyzeRequest) (*pb.BatchAnalyzeResponse, error) {
	s.logger.Info("gRPC BatchAnalyze request", zap.Int("items", len(req.Items)))

	if len(req.Items) == 0 {
		return &pb.BatchAnalyzeResponse{
			Status: createStatus(codes.InvalidArgument, "Items are required"),
		}, nil
	}

	startTime := time.Now()
	results := make([]*pb.AnalyzeTextResponse, len(req.Items))
	success := 0
	failed := 0

	for i, item := range req.Items {
		result, err := s.AnalyzeText(ctx, item)
		if err != nil || result.Status.Code != int32(codes.OK) {
			failed++
			results[i] = &pb.AnalyzeTextResponse{
				Status: createStatus(codes.Internal, "Analysis failed"),
			}
		} else {
			success++
			results[i] = result
		}
	}

	duration := time.Since(startTime)

	response := &pb.BatchAnalyzeResponse{
		Status:     createSuccessStatus(),
		Results:    results,
		Total:      int32(len(req.Items)),
		Success:    int32(success),
		Failed:     int32(failed),
		DurationMs: duration.Milliseconds(),
	}

	s.logger.Info("Batch analysis completed",
		zap.Int("total", len(req.Items)),
		zap.Int("success", success),
		zap.Int("failed", failed),
		zap.Int64("duration_ms", duration.Milliseconds()),
	)

	return response, nil
}

// GetAnomalyHistory retrieves anomaly detection history
func (s *AnomalyServiceServer) GetAnomalyHistory(ctx context.Context, req *pb.GetAnomalyHistoryRequest) (*pb.GetAnomalyHistoryResponse, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return &pb.GetAnomalyHistoryResponse{
			Status: createErrorStatus(err),
		}, nil
	}

	s.logger.Debug("gRPC GetAnomalyHistory request", zap.String("user_id", userID))

	// Mock response - in real implementation, query database
	records := []*pb.AnomalyRecord{
		{
			Id:     uuid.New().String(),
			UserId: userID,
			Result: &pb.AnomalyResult{
				Score:       0.7,
				Confidence:  0.9,
				IsAnomalous: true,
				Timestamp:   time.Now(),
			},
			InputText: "Sample suspicious text",
			CreatedAt: time.Now(),
		},
	}

	response := &pb.GetAnomalyHistoryResponse{
		Status:     createSuccessStatus(),
		Records:    records,
		Total:      int32(len(records)),
		Page:       req.Page,
		TotalPages: 1,
	}

	return response, nil
}

// GetAnomalyDetails retrieves details of a specific anomaly
func (s *AnomalyServiceServer) GetAnomalyDetails(ctx context.Context, req *pb.GetAnomalyDetailsRequest) (*pb.GetAnomalyDetailsResponse, error) {
	s.logger.Debug("gRPC GetAnomalyDetails request", zap.String("anomaly_id", req.AnomalyId))

	if req.AnomalyId == "" {
		return &pb.GetAnomalyDetailsResponse{
			Status: createStatus(codes.InvalidArgument, "Anomaly ID is required"),
		}, nil
	}

	// Mock response - in real implementation, query database
	record := &pb.AnomalyRecord{
		Id:     req.AnomalyId,
		UserId: "user-123",
		Result: &pb.AnomalyResult{
			Score:       0.8,
			Confidence:  0.95,
			IsAnomalous: true,
			Timestamp:   time.Now(),
			Details: map[string]*pb.AnalysisResult{
				"linguistic": {
					Score:      0.9,
					Confidence: 0.95,
					Metadata: map[string]string{
						"suspicious_patterns": "3",
						"confidence_level":   "high",
					},
				},
			},
		},
		InputText: "Detailed suspicious text content",
		CreatedAt: time.Now(),
	}

	response := &pb.GetAnomalyDetailsResponse{
		Status: createSuccessStatus(),
		Record: record,
	}

	return response, nil
}

// StreamAnomalies provides real-time anomaly alerts
func (s *AnomalyServiceServer) StreamAnomalies(req *pb.StreamAnomaliesRequest, stream pb.AnomalyService_StreamAnomaliesServer) error {
	s.logger.Info("gRPC StreamAnomalies started", zap.String("user_id", req.UserId))

	// Mock streaming - send periodic alerts
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stream.Context().Done():
			s.logger.Info("StreamAnomalies context cancelled")
			return nil
		case <-ticker.C:
			alert := &pb.AnomalyAlert{
				Id:     uuid.New().String(),
				UserId: req.UserId,
				Type:   "text_analysis",
				Result: &pb.AnomalyResult{
					Score:       0.75,
					Confidence:  0.88,
					IsAnomalous: true,
					Timestamp:   time.Now(),
				},
				Message:   "Potential anomaly detected in real-time analysis",
				Timestamp: time.Now(),
				Metadata: map[string]string{
					"source":   "real_time_monitor",
					"severity": "medium",
				},
			}

			if err := stream.Send(alert); err != nil {
				s.logger.Error("Failed to send anomaly alert", zap.Error(err))
				return err
			}

			s.logger.Debug("Anomaly alert sent", zap.String("alert_id", alert.ID))
		}
	}
}