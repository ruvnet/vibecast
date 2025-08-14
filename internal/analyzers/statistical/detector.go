package statistical

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/analyzers"
)

// Detector implements statistical anomaly detection using z-score and IQR methods
type Detector struct {
	config      *analyzers.Configuration
	statistics  *analyzers.Statistics
	method      Method
	zThreshold  float64
	iqrMultiplier float64
	windowData  []float64
	mu          sync.RWMutex
}

// Method represents the statistical detection method
type Method string

const (
	MethodZScore Method = "zscore"
	MethodIQR    Method = "iqr"
	MethodBoth   Method = "both"
)

// NewDetector creates a new statistical anomaly detector
func NewDetector(config *analyzers.Configuration) (*Detector, error) {
	if config == nil {
		config = analyzers.DefaultConfiguration()
	}

	detector := &Detector{
		config:        config,
		method:        MethodBoth,
		zThreshold:    config.Threshold,
		iqrMultiplier: 1.5,
		windowData:    make([]float64, 0, config.WindowSize),
	}

	return detector, nil
}

// Name returns the analyzer name
func (d *Detector) Name() string {
	return "statistical-detector"
}

// Type returns the analyzer type
func (d *Detector) Type() analyzers.AnomalyType {
	return analyzers.AnomalyTypeStatistical
}

// Analyze performs statistical anomaly detection
func (d *Detector) Analyze(ctx context.Context, data *analyzers.TimeSeries) (*analyzers.AnalysisResult, error) {
	start := time.Now()

	if len(data.DataPoints) < d.config.MinDataPoints {
		return &analyzers.AnalysisResult{
			Anomalies: []analyzers.Anomaly{},
			Score:     0.0,
			Metadata: map[string]interface{}{
				"error": "insufficient data points",
				"required": d.config.MinDataPoints,
				"actual": len(data.DataPoints),
			},
			Duration: time.Since(start),
		}, nil
	}

	// Convert data points to float64 values
	values, err := d.extractValues(data.DataPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to extract values: %w", err)
	}

	// Update window data
	d.updateWindowData(values)

	// Calculate statistics
	stats := d.calculateStatistics(d.windowData)
	d.mu.Lock()
	d.statistics = stats
	d.mu.Unlock()

	// Detect anomalies
	anomalies := d.detectAnomalies(data.DataPoints, values, stats)

	// Calculate overall anomaly score
	score := d.calculateOverallScore(anomalies)

	duration := time.Since(start)
	
	metadata := map[string]interface{}{
		"method":           string(d.method),
		"z_threshold":      d.zThreshold,
		"iqr_multiplier":   d.iqrMultiplier,
		"window_size":      len(d.windowData),
		"statistics":       stats,
		"processing_time_ms": duration.Milliseconds(),
	}

	return &analyzers.AnalysisResult{
		Anomalies: anomalies,
		Score:     score,
		Metadata:  metadata,
		Duration:  duration,
	}, nil
}

// Configure updates the detector configuration
func (d *Detector) Configure(config map[string]interface{}) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if method, ok := config["method"].(string); ok {
		d.method = Method(method)
	}

	if threshold, ok := config["z_threshold"].(float64); ok {
		d.zThreshold = threshold
	}

	if multiplier, ok := config["iqr_multiplier"].(float64); ok {
		d.iqrMultiplier = multiplier
	}

	if windowSize, ok := config["window_size"].(int); ok {
		d.config.WindowSize = windowSize
		// Resize window data if needed
		if len(d.windowData) > windowSize {
			d.windowData = d.windowData[len(d.windowData)-windowSize:]
		}
	}

	return nil
}

// IsReady returns true if the detector has sufficient data
func (d *Detector) IsReady() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return len(d.windowData) >= d.config.MinDataPoints
}

// Close cleans up resources
func (d *Detector) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.windowData = nil
	d.statistics = nil
	return nil
}

// GetStatistics returns current statistics
func (d *Detector) GetStatistics() *analyzers.Statistics {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.statistics == nil {
		return nil
	}
	// Return a copy
	stats := *d.statistics
	return &stats
}

// extractValues converts data points to float64 values
func (d *Detector) extractValues(dataPoints []analyzers.DataPoint) ([]float64, error) {
	values := make([]float64, len(dataPoints))
	
	for i, point := range dataPoints {
		switch v := point.Value.(type) {
		case float64:
			values[i] = v
		case float32:
			values[i] = float64(v)
		case int:
			values[i] = float64(v)
		case int32:
			values[i] = float64(v)
		case int64:
			values[i] = float64(v)
		default:
			return nil, fmt.Errorf("unsupported value type: %T", v)
		}
	}
	
	return values, nil
}

// updateWindowData updates the sliding window with new values
func (d *Detector) updateWindowData(values []float64) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for _, value := range values {
		d.windowData = append(d.windowData, value)
		
		// Maintain window size
		if len(d.windowData) > d.config.WindowSize {
			d.windowData = d.windowData[1:]
		}
	}
}

// calculateStatistics computes statistical measures for the data
func (d *Detector) calculateStatistics(values []float64) *analyzers.Statistics {
	if len(values) == 0 {
		return &analyzers.Statistics{}
	}

	// Sort values for percentile calculations
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	stats := &analyzers.Statistics{
		Count: len(values),
		Min:   sorted[0],
		Max:   sorted[len(sorted)-1],
	}

	// Calculate mean
	var sum float64
	for _, v := range values {
		sum += v
	}
	stats.Mean = sum / float64(len(values))

	// Calculate median
	if len(sorted)%2 == 0 {
		stats.Median = (sorted[len(sorted)/2-1] + sorted[len(sorted)/2]) / 2
	} else {
		stats.Median = sorted[len(sorted)/2]
	}

	// Calculate variance and standard deviation
	var sumSquares float64
	for _, v := range values {
		diff := v - stats.Mean
		sumSquares += diff * diff
	}
	stats.Variance = sumSquares / float64(len(values))
	stats.StdDev = math.Sqrt(stats.Variance)

	// Calculate quartiles
	stats.Q1 = d.percentile(sorted, 0.25)
	stats.Q3 = d.percentile(sorted, 0.75)
	stats.IQR = stats.Q3 - stats.Q1

	// Count outliers using IQR method
	lowerBound := stats.Q1 - d.iqrMultiplier*stats.IQR
	upperBound := stats.Q3 + d.iqrMultiplier*stats.IQR
	
	for _, v := range values {
		if v < lowerBound || v > upperBound {
			stats.Outliers++
		}
	}

	return stats
}

// percentile calculates the percentile value from sorted data
func (d *Detector) percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	
	index := p * float64(len(sorted)-1)
	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))
	
	if lower == upper {
		return sorted[lower]
	}
	
	weight := index - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}

// detectAnomalies identifies anomalies using the configured method
func (d *Detector) detectAnomalies(dataPoints []analyzers.DataPoint, values []float64, stats *analyzers.Statistics) []analyzers.Anomaly {
	var anomalies []analyzers.Anomaly

	for i, value := range values {
		var isAnomaly bool
		var score float64
		var method string

		switch d.method {
		case MethodZScore:
			isAnomaly, score = d.detectZScoreAnomaly(value, stats)
			method = "z-score"
		case MethodIQR:
			isAnomaly, score = d.detectIQRAnomaly(value, stats)
			method = "iqr"
		case MethodBoth:
			zAnomaly, zScore := d.detectZScoreAnomaly(value, stats)
			iqrAnomaly, iqrScore := d.detectIQRAnomaly(value, stats)
			isAnomaly = zAnomaly || iqrAnomaly
			score = math.Max(zScore, iqrScore)
			method = "z-score+iqr"
		}

		if isAnomaly {
			anomaly := analyzers.Anomaly{
				ID:        fmt.Sprintf("stat_%d_%d", time.Now().Unix(), i),
				Type:      analyzers.AnomalyTypeStatistical,
				Severity:  d.calculateSeverity(score),
				Score:     score,
				Timestamp: dataPoints[i].Timestamp,
				Value:     value,
				Expected:  stats.Mean,
				Source:    d.Name(),
				Message:   fmt.Sprintf("Statistical anomaly detected using %s method", method),
				Metadata: map[string]interface{}{
					"method":     method,
					"z_score":    math.Abs(value-stats.Mean) / stats.StdDev,
					"iqr_ratio":  d.calculateIQRRatio(value, stats),
					"statistics": stats,
				},
			}
			anomalies = append(anomalies, anomaly)
		}
	}

	return anomalies
}

// detectZScoreAnomaly detects anomalies using z-score method
func (d *Detector) detectZScoreAnomaly(value float64, stats *analyzers.Statistics) (bool, float64) {
	if stats.StdDev == 0 {
		return false, 0
	}

	zScore := math.Abs(value-stats.Mean) / stats.StdDev
	return zScore > d.zThreshold, zScore
}

// detectIQRAnomaly detects anomalies using IQR method
func (d *Detector) detectIQRAnomaly(value float64, stats *analyzers.Statistics) (bool, float64) {
	if stats.IQR == 0 {
		return false, 0
	}

	lowerBound := stats.Q1 - d.iqrMultiplier*stats.IQR
	upperBound := stats.Q3 + d.iqrMultiplier*stats.IQR
	
	isAnomaly := value < lowerBound || value > upperBound
	
	// Calculate score based on distance from bounds
	var score float64
	if value < lowerBound {
		score = (lowerBound - value) / stats.IQR
	} else if value > upperBound {
		score = (value - upperBound) / stats.IQR
	}
	
	return isAnomaly, score
}

// calculateIQRRatio calculates the IQR ratio for metadata
func (d *Detector) calculateIQRRatio(value float64, stats *analyzers.Statistics) float64 {
	if stats.IQR == 0 {
		return 0
	}
	
	lowerBound := stats.Q1 - d.iqrMultiplier*stats.IQR
	upperBound := stats.Q3 + d.iqrMultiplier*stats.IQR
	
	if value < lowerBound {
		return (lowerBound - value) / stats.IQR
	} else if value > upperBound {
		return (value - upperBound) / stats.IQR
	}
	
	return 0
}

// calculateSeverity determines anomaly severity based on score
func (d *Detector) calculateSeverity(score float64) analyzers.Severity {
	if score >= 5.0 {
		return analyzers.SeverityCritical
	} else if score >= 3.0 {
		return analyzers.SeverityHigh
	} else if score >= 2.0 {
		return analyzers.SeverityMedium
	}
	return analyzers.SeverityLow
}

// calculateOverallScore calculates the overall anomaly score for the analysis
func (d *Detector) calculateOverallScore(anomalies []analyzers.Anomaly) float64 {
	if len(anomalies) == 0 {
		return 0.0
	}

	var totalScore float64
	for _, anomaly := range anomalies {
		totalScore += anomaly.Score
	}

	// Normalize by number of anomalies and apply sensitivity
	avgScore := totalScore / float64(len(anomalies))
	return avgScore * d.config.Sensitivity
}