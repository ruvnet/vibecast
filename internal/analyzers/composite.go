package analyzers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/analyzers/alerts"
)

// CompositeAnalyzer combines multiple analyzers to provide comprehensive anomaly detection
type CompositeAnalyzer struct {
	analyzers    []Analyzer
	alertManager *alerts.Manager
	weights      map[AnomalyType]float64
	mu           sync.RWMutex
}

// NewCompositeAnalyzer creates a new composite analyzer
func NewCompositeAnalyzer(analyzers []Analyzer, alertManager *alerts.Manager) *CompositeAnalyzer {
	weights := map[AnomalyType]float64{
		AnomalyTypeStatistical: 0.25,
		AnomalyTypePattern:     0.25,
		AnomalyTypeML:          0.30,
		AnomalyTypeThreshold:   0.20,
	}

	return &CompositeAnalyzer{
		analyzers:    analyzers,
		alertManager: alertManager,
		weights:      weights,
	}
}

// Name returns the analyzer name
func (c *CompositeAnalyzer) Name() string {
	return "composite"
}

// Type returns the analyzer type
func (c *CompositeAnalyzer) Type() AnomalyType {
	return "composite"
}

// Analyze runs all analyzers and combines their results
func (c *CompositeAnalyzer) Analyze(ctx context.Context, data *TimeSeries) (*AnalysisResult, error) {
	start := time.Now()

	// Run all analyzers in parallel
	results := make(chan *analyzerResult, len(c.analyzers))
	var wg sync.WaitGroup

	for _, analyzer := range c.analyzers {
		if !analyzer.IsReady() {
			continue
		}

		wg.Add(1)
		go func(a Analyzer) {
			defer wg.Done()
			result, err := a.Analyze(ctx, data)
			results <- &analyzerResult{
				analyzer: a,
				result:   result,
				err:      err,
			}
		}(analyzer)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect and combine results
	var allAnomalies []Anomaly
	var totalScore float64
	metadata := make(map[string]interface{})
	errorCount := 0

	for res := range results {
		if res.err != nil {
			errorCount++
			metadata[fmt.Sprintf("%s_error", res.analyzer.Name())] = res.err.Error()
			continue
		}

		if res.result != nil {
			// Apply weight to anomalies based on analyzer type
			weight := c.getWeight(res.analyzer.Type())
			for _, anomaly := range res.result.Anomalies {
				anomaly.Score *= weight
				allAnomalies = append(allAnomalies, anomaly)
			}

			totalScore += res.result.Score * weight
			metadata[fmt.Sprintf("%s_score", res.analyzer.Name())] = res.result.Score

			// Merge analyzer-specific metadata
			for k, v := range res.result.Metadata {
				metadata[fmt.Sprintf("%s_%s", res.analyzer.Name(), k)] = v
			}
		}
	}

	// Deduplicate and rank anomalies
	finalAnomalies := c.deduplicateAnomalies(allAnomalies)
	finalAnomalies = c.rankAnomalies(finalAnomalies)

	// Generate alerts for high-severity anomalies
	if c.alertManager != nil {
		for _, anomaly := range finalAnomalies {
			if anomaly.Severity == SeverityHigh || anomaly.Severity == SeverityCritical {
				if err := c.alertManager.ProcessAnomaly(ctx, anomaly); err != nil {
					metadata["alert_error"] = err.Error()
				}
			}
		}
	}

	duration := time.Since(start)
	metadata["analyzers_count"] = len(c.analyzers)
	metadata["errors_count"] = errorCount
	metadata["duration_ms"] = duration.Milliseconds()

	return &AnalysisResult{
		Anomalies: finalAnomalies,
		Score:     totalScore,
		Metadata:  metadata,
		Duration:  duration,
	}, nil
}

// Configure updates the configuration for all analyzers
func (c *CompositeAnalyzer) Configure(config map[string]interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update weights if provided
	if weights, ok := config["weights"].(map[string]float64); ok {
		for typeStr, weight := range weights {
			c.weights[AnomalyType(typeStr)] = weight
		}
	}

	// Configure individual analyzers
	var errors []error
	for _, analyzer := range c.analyzers {
		if err := analyzer.Configure(config); err != nil {
			errors = append(errors, fmt.Errorf("%s: %w", analyzer.Name(), err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("configuration errors: %v", errors)
	}

	return nil
}

// IsReady returns true if at least one analyzer is ready
func (c *CompositeAnalyzer) IsReady() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, analyzer := range c.analyzers {
		if analyzer.IsReady() {
			return true
		}
	}
	return false
}

// Close closes all analyzers
func (c *CompositeAnalyzer) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var errors []error
	for _, analyzer := range c.analyzers {
		if err := analyzer.Close(); err != nil {
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("close errors: %v", errors)
	}

	return nil
}

// GetAnalyzers returns the list of analyzers
func (c *CompositeAnalyzer) GetAnalyzers() []Analyzer {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]Analyzer, len(c.analyzers))
	copy(result, c.analyzers)
	return result
}

// SetWeights updates the analyzer weights
func (c *CompositeAnalyzer) SetWeights(weights map[AnomalyType]float64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for anomalyType, weight := range weights {
		c.weights[anomalyType] = weight
	}
}

// getWeight returns the weight for the given anomaly type
func (c *CompositeAnalyzer) getWeight(anomalyType AnomalyType) float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if weight, exists := c.weights[anomalyType]; exists {
		return weight
	}
	return 0.25 // Default weight
}

// deduplicateAnomalies removes duplicate anomalies based on timestamp and value
func (c *CompositeAnalyzer) deduplicateAnomalies(anomalies []Anomaly) []Anomaly {
	seen := make(map[string]bool)
	var result []Anomaly

	for _, anomaly := range anomalies {
		key := fmt.Sprintf("%v_%v_%s", anomaly.Timestamp.Unix(), anomaly.Value, anomaly.Source)
		if !seen[key] {
			seen[key] = true
			result = append(result, anomaly)
		}
	}

	return result
}

// rankAnomalies sorts anomalies by score in descending order
func (c *CompositeAnalyzer) rankAnomalies(anomalies []Anomaly) []Anomaly {
	// Simple bubble sort for demonstration - use sort.Slice in production
	for i := 0; i < len(anomalies)-1; i++ {
		for j := 0; j < len(anomalies)-i-1; j++ {
			if anomalies[j].Score < anomalies[j+1].Score {
				anomalies[j], anomalies[j+1] = anomalies[j+1], anomalies[j]
			}
		}
	}
	return anomalies
}

// analyzerResult holds the result from an individual analyzer
type analyzerResult struct {
	analyzer Analyzer
	result   *AnalysisResult
	err      error
}
