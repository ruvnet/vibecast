package core

import (
	"context"
	"fmt"
	"sync"

	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap"
)

// AnomalyDetector is the main detector that orchestrates all analyzers
type AnomalyDetector struct {
	analyzers []Analyzer
	logger    *zap.Logger
	metrics   *metrics.Metrics
}

// Analyzer interface for all anomaly detection algorithms
type Analyzer interface {
	Name() string
	Analyze(ctx context.Context, text string) (*models.AnalysisResult, error)
}

// NewAnomalyDetector creates a new anomaly detector instance
func NewAnomalyDetector(logger *zap.Logger, metrics *metrics.Metrics) *AnomalyDetector {
	return &AnomalyDetector{
		analyzers: make([]Analyzer, 0),
		logger:    logger,
		metrics:   metrics,
	}
}

// RegisterAnalyzer adds a new analyzer to the detector
func (ad *AnomalyDetector) RegisterAnalyzer(analyzer Analyzer) {
	ad.analyzers = append(ad.analyzers, analyzer)
}

// AnalyzeText performs anomaly detection on the given text
func (ad *AnomalyDetector) AnalyzeText(text string) (*models.AnomalyResult, error) {
	ctx := context.Background()
	
	// Run all analyzers in parallel
	results := make(map[string]*models.AnalysisResult)
	var wg sync.WaitGroup
	var mu sync.Mutex
	errChan := make(chan error, len(ad.analyzers))

	for _, analyzer := range ad.analyzers {
		wg.Add(1)
		go func(a Analyzer) {
			defer wg.Done()
			
			result, err := a.Analyze(ctx, text)
			if err != nil {
				ad.logger.Error("Analyzer failed", 
					zap.String("analyzer", a.Name()),
					zap.Error(err))
				errChan <- fmt.Errorf("analyzer %s failed: %w", a.Name(), err)
				return
			}

			mu.Lock()
			results[a.Name()] = result
			mu.Unlock()
		}(analyzer)
	}

	wg.Wait()
	close(errChan)

	// Check for errors
	if len(errChan) > 0 {
		return nil, <-errChan
	}

	// Aggregate results
	return ad.aggregateResults(results), nil
}

// aggregateResults combines individual analyzer results into a final score
func (ad *AnomalyDetector) aggregateResults(results map[string]*models.AnalysisResult) *models.AnomalyResult {
	if len(results) == 0 {
		return &models.AnomalyResult{
			Score:       0.0,
			Confidence:  0.0,
			IsAnomalous: false,
			Details:     make(map[string]*models.AnalysisResult),
		}
	}

	// Simple weighted average for now
	totalScore := 0.0
	totalWeight := 0.0
	
	for _, result := range results {
		weight := result.Confidence
		totalScore += result.Score * weight
		totalWeight += weight
	}

	finalScore := totalScore / totalWeight
	finalConfidence := totalWeight / float64(len(results))

	return &models.AnomalyResult{
		Score:       finalScore,
		Confidence:  finalConfidence,
		IsAnomalous: finalScore > 0.7, // Threshold can be configurable
		Details:     results,
	}
}