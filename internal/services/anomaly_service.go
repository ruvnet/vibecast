// Package services provides business logic layer
package services

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/internal/repository"
	"go.uber.org/zap"
)

// AnomalyService handles anomaly detection business logic
type AnomalyService struct {
	repo   repository.Repository
	logger *zap.Logger
}

// NewAnomalyService creates a new anomaly service
func NewAnomalyService(repo repository.Repository, logger *zap.Logger) *AnomalyService {
	return &AnomalyService{
		repo:   repo,
		logger: logger,
	}
}

// ProcessDetection processes anomaly detection request
func (s *AnomalyService) ProcessDetection(userID uuid.UUID, req *models.DetectionRequest) (*models.DetectionResult, error) {
	startTime := time.Now()

	// Set default algorithm if not provided
	algorithm := req.Algorithm
	if algorithm == "" {
		algorithm = "isolation_forest"
	}

	// Set default threshold if not provided
	threshold := req.Threshold
	if threshold == 0 {
		threshold = 0.5
	}

	// Simulate anomaly detection processing
	// In a real implementation, this would call your actual anomaly detection algorithms
	score := s.calculateAnomalyScore(req.Data, algorithm)
	isAnomaly := score > threshold
	confidence := s.calculateConfidence(score, threshold)
	
	// Generate metadata
	metadata := models.Metadata{
		Features:     s.extractFeatures(req.Data),
		Explanations: s.generateExplanations(req.Data, score, isAnomaly),
		Suggestions:  s.generateSuggestions(isAnomaly, score),
	}

	// Create anomaly data record
	anomalyData := &models.AnomalyData{
		UserID:      userID,
		Data:        req.Data,
		Score:       score,
		IsAnomaly:   isAnomaly,
		Threshold:   threshold,
		Algorithm:   algorithm,
		ProcessedAt: time.Now(),
	}

	if err := s.repo.CreateAnomalyData(anomalyData); err != nil {
		s.logger.Error("Failed to save anomaly data", zap.Error(err), zap.String("user_id", userID.String()))
		// Continue with response even if saving fails
	}

	processingTime := time.Since(startTime).Milliseconds()

	result := &models.DetectionResult{
		ID:             anomalyData.ID,
		IsAnomaly:      isAnomaly,
		Score:          score,
		Confidence:     confidence,
		Threshold:      threshold,
		Algorithm:      algorithm,
		ProcessingTime: processingTime,
		Metadata:       metadata,
	}

	s.logger.Info("Anomaly detection completed",
		zap.String("user_id", userID.String()),
		zap.String("algorithm", algorithm),
		zap.Float64("score", score),
		zap.Bool("is_anomaly", isAnomaly),
		zap.Int64("processing_time_ms", processingTime),
	)

	return result, nil
}

// GetAnomalyData retrieves anomaly data by ID
func (s *AnomalyService) GetAnomalyData(id uuid.UUID) (*models.AnomalyData, error) {
	data, err := s.repo.GetAnomalyDataByID(id)
	if err != nil {
		return nil, fmt.Errorf("anomaly data not found")
	}

	return data, nil
}

// GetUserAnomalyData retrieves anomaly data for a specific user
func (s *AnomalyService) GetUserAnomalyData(userID uuid.UUID, page, limit int) ([]*models.AnomalyData, *models.Meta, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	data, total, err := s.repo.GetAnomalyDataByUserID(userID, page, limit)
	if err != nil {
		s.logger.Error("Failed to get user anomaly data", zap.Error(err), zap.String("user_id", userID.String()))
		return nil, nil, fmt.Errorf("failed to retrieve anomaly data: %v", err)
	}

	totalPages := (total + limit - 1) / limit
	meta := &models.Meta{
		Page:       page,
		PerPage:    limit,
		Total:      total,
		TotalPages: totalPages,
	}

	return data, meta, nil
}

// ListAnomalyData retrieves paginated anomaly data
func (s *AnomalyService) ListAnomalyData(page, limit int) ([]*models.AnomalyData, *models.Meta, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	data, total, err := s.repo.ListAnomalyData(page, limit)
	if err != nil {
		s.logger.Error("Failed to list anomaly data", zap.Error(err))
		return nil, nil, fmt.Errorf("failed to retrieve anomaly data: %v", err)
	}

	totalPages := (total + limit - 1) / limit
	meta := &models.Meta{
		Page:       page,
		PerPage:    limit,
		Total:      total,
		TotalPages: totalPages,
	}

	return data, meta, nil
}

// DeleteAnomalyData deletes anomaly data by ID
func (s *AnomalyService) DeleteAnomalyData(id uuid.UUID) error {
	if err := s.repo.DeleteAnomalyData(id); err != nil {
		s.logger.Error("Failed to delete anomaly data", zap.Error(err), zap.String("id", id.String()))
		return fmt.Errorf("failed to delete anomaly data: %v", err)
	}

	s.logger.Info("Anomaly data deleted", zap.String("id", id.String()))
	return nil
}

// GetAnomalyStats returns anomaly detection statistics
func (s *AnomalyService) GetAnomalyStats(userID *uuid.UUID) (map[string]interface{}, error) {
	// This is a simplified implementation
	// In a real system, you'd have more sophisticated analytics
	
	var total int
	var anomalyCount int
	
	if userID != nil {
		// Get stats for specific user
		data, totalCount, err := s.repo.GetAnomalyDataByUserID(*userID, 1, 1000)
		if err != nil {
			s.logger.Warn("Failed to get user anomaly stats", zap.Error(err))
			return nil, err
		}
		total = totalCount
		for _, d := range data {
			if d.IsAnomaly {
				anomalyCount++
			}
		}
	} else {
		// Get global stats
		data, totalCount, err := s.repo.ListAnomalyData(1, 1000)
		if err != nil {
			s.logger.Warn("Failed to get global anomaly stats", zap.Error(err))
			return nil, err
		}
		total = totalCount
		for _, d := range data {
			if d.IsAnomaly {
				anomalyCount++
			}
		}
	}

	anomalyRate := 0.0
	if total > 0 {
		anomalyRate = float64(anomalyCount) / float64(total) * 100
	}

	stats := map[string]interface{}{
		"total_detections":   total,
		"anomaly_count":      anomalyCount,
		"normal_count":       total - anomalyCount,
		"anomaly_rate":       anomalyRate,
		"generated_at":       time.Now(),
	}

	if userID != nil {
		stats["user_id"] = *userID
	}

	return stats, nil
}

// Helper methods for anomaly detection simulation

func (s *AnomalyService) calculateAnomalyScore(data map[string]interface{}, algorithm string) float64 {
	// Simplified anomaly score calculation
	// In a real implementation, this would use actual ML algorithms
	
	score := 0.0
	count := 0
	
	for _, value := range data {
		if v, ok := value.(float64); ok {
			// Simple statistical approach - values far from mean get higher scores
			if v > 100 || v < -100 {
				score += 0.8
			} else if v > 50 || v < -50 {
				score += 0.6
			} else if v > 25 || v < -25 {
				score += 0.4
			} else {
				score += 0.2
			}
			count++
		}
	}
	
	if count > 0 {
		score = score / float64(count)
	}
	
	// Add some randomness to simulate real anomaly detection
	if score < 0.3 {
		score += 0.1
	}
	
	// Ensure score is between 0 and 1
	if score > 1.0 {
		score = 1.0
	}
	
	return score
}

func (s *AnomalyService) calculateConfidence(score, threshold float64) float64 {
	// Calculate confidence based on how far the score is from the threshold
	distance := abs(score - threshold)
	confidence := 0.5 + (distance * 0.5)
	
	if confidence > 1.0 {
		confidence = 1.0
	}
	
	return confidence
}

func (s *AnomalyService) extractFeatures(data map[string]interface{}) map[string]float64 {
	features := make(map[string]float64)
	
	for key, value := range data {
		if v, ok := value.(float64); ok {
			features[key] = v
		}
	}
	
	// Add derived features
	if len(features) > 0 {
		sum := 0.0
		for _, v := range features {
			sum += v
		}
		features["mean"] = sum / float64(len(features))
	}
	
	return features
}

func (s *AnomalyService) generateExplanations(data map[string]interface{}, score float64, isAnomaly bool) []string {
	explanations := []string{}
	
	if isAnomaly {
		explanations = append(explanations, fmt.Sprintf("Anomaly score %.3f exceeds the threshold", score))
		
		for key, value := range data {
			if v, ok := value.(float64); ok {
				if v > 100 {
					explanations = append(explanations, fmt.Sprintf("Feature '%s' has an unusually high value: %.2f", key, v))
				} else if v < -100 {
					explanations = append(explanations, fmt.Sprintf("Feature '%s' has an unusually low value: %.2f", key, v))
				}
			}
		}
	} else {
		explanations = append(explanations, "Data point appears normal based on historical patterns")
	}
	
	return explanations
}

func (s *AnomalyService) generateSuggestions(isAnomaly bool, score float64) []string {
	suggestions := []string{}
	
	if isAnomaly {
		suggestions = append(suggestions, "Review the data point for potential issues")
		suggestions = append(suggestions, "Consider investigating the source system")
		if score > 0.8 {
			suggestions = append(suggestions, "High confidence anomaly - immediate attention recommended")
		}
	} else {
		suggestions = append(suggestions, "Data point is within normal parameters")
		if score < 0.2 {
			suggestions = append(suggestions, "Very normal data point - no action needed")
		}
	}
	
	return suggestions
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}