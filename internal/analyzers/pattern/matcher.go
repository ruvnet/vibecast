package pattern

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/analyzers"
)

// Pattern represents a detected pattern
type Pattern struct {
	ID          string                 `json:"id"`
	Type        PatternType           `json:"type"`
	Sequence    []interface{}         `json:"sequence"`
	Frequency   int                   `json:"frequency"`
	Confidence  float64               `json:"confidence"`
	StartTime   time.Time             `json:"start_time"`
	EndTime     time.Time             `json:"end_time"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PatternType represents different types of patterns
type PatternType string

const (
	PatternTypePeriodic    PatternType = "periodic"
	PatternTypeSequential  PatternType = "sequential"
	PatternTypeTrend       PatternType = "trend"
	PatternTypeSeasonal    PatternType = "seasonal"
	PatternTypeSpike       PatternType = "spike"
	PatternTypeDrop        PatternType = "drop"
)

// Matcher implements pattern-based anomaly detection
type Matcher struct {
	config           *analyzers.Configuration
	patterns         map[string]*Pattern
	sequenceBuffer   []interface{}
	valueBuffer      []float64
	timestampBuffer  []time.Time
	minPatternLength int
	maxPatternLength int
	similarityThreshold float64
	mu               sync.RWMutex
}

// NewMatcher creates a new pattern matcher
func NewMatcher(config *analyzers.Configuration) (*Matcher, error) {
	if config == nil {
		config = analyzers.DefaultConfiguration()
	}

	matcher := &Matcher{
		config:              config,
		patterns:            make(map[string]*Pattern),
		sequenceBuffer:      make([]interface{}, 0, config.WindowSize),
		valueBuffer:         make([]float64, 0, config.WindowSize),
		timestampBuffer:     make([]time.Time, 0, config.WindowSize),
		minPatternLength:    3,
		maxPatternLength:    20,
		similarityThreshold: 0.8,
	}

	return matcher, nil
}

// Name returns the analyzer name
func (m *Matcher) Name() string {
	return "pattern-matcher"
}

// Type returns the analyzer type
func (m *Matcher) Type() analyzers.AnomalyType {
	return analyzers.AnomalyTypePattern
}

// Analyze performs pattern-based anomaly detection
func (m *Matcher) Analyze(ctx context.Context, data *analyzers.TimeSeries) (*analyzers.AnalysisResult, error) {
	start := time.Now()

	if len(data.DataPoints) < m.config.MinDataPoints {
		return &analyzers.AnalysisResult{
			Anomalies: []analyzers.Anomaly{},
			Score:     0.0,
			Metadata: map[string]interface{}{
				"error": "insufficient data points",
				"required": m.config.MinDataPoints,
				"actual": len(data.DataPoints),
			},
			Duration: time.Since(start),
		}, nil
	}

	// Update buffers with new data
	m.updateBuffers(data.DataPoints)

	// Detect patterns
	detectedPatterns := m.detectPatterns()

	// Update pattern registry
	m.updatePatterns(detectedPatterns)

	// Detect anomalies based on pattern violations
	anomalies := m.detectPatternAnomalies(data.DataPoints)

	// Calculate overall score
	score := m.calculateOverallScore(anomalies, detectedPatterns)

	duration := time.Since(start)

	metadata := map[string]interface{}{
		"patterns_detected":     len(detectedPatterns),
		"patterns_total":        len(m.patterns),
		"buffer_size":           len(m.sequenceBuffer),
		"min_pattern_length":    m.minPatternLength,
		"max_pattern_length":    m.maxPatternLength,
		"similarity_threshold":  m.similarityThreshold,
		"processing_time_ms":    duration.Milliseconds(),
	}

	// Add pattern details to metadata
	patternDetails := make(map[string]interface{})
	for _, pattern := range detectedPatterns {
		patternDetails[pattern.ID] = map[string]interface{}{
			"type":       string(pattern.Type),
			"frequency":  pattern.Frequency,
			"confidence": pattern.Confidence,
		}
	}
	metadata["pattern_details"] = patternDetails

	return &analyzers.AnalysisResult{
		Anomalies: anomalies,
		Score:     score,
		Metadata:  metadata,
		Duration:  duration,
	}, nil
}

// Configure updates the matcher configuration
func (m *Matcher) Configure(config map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if minLen, ok := config["min_pattern_length"].(int); ok {
		m.minPatternLength = minLen
	}

	if maxLen, ok := config["max_pattern_length"].(int); ok {
		m.maxPatternLength = maxLen
	}

	if threshold, ok := config["similarity_threshold"].(float64); ok {
		m.similarityThreshold = threshold
	}

	if windowSize, ok := config["window_size"].(int); ok {
		m.config.WindowSize = windowSize
		// Resize buffers if needed
		if len(m.sequenceBuffer) > windowSize {
			m.sequenceBuffer = m.sequenceBuffer[len(m.sequenceBuffer)-windowSize:]
			m.valueBuffer = m.valueBuffer[len(m.valueBuffer)-windowSize:]
			m.timestampBuffer = m.timestampBuffer[len(m.timestampBuffer)-windowSize:]
		}
	}

	return nil
}

// IsReady returns true if the matcher has sufficient data
func (m *Matcher) IsReady() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sequenceBuffer) >= m.minPatternLength
}

// Close cleans up resources
func (m *Matcher) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.patterns = make(map[string]*Pattern)
	m.sequenceBuffer = nil
	m.valueBuffer = nil
	m.timestampBuffer = nil
	return nil
}

// GetPatterns returns currently detected patterns
func (m *Matcher) GetPatterns() map[string]*Pattern {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := make(map[string]*Pattern)
	for k, v := range m.patterns {
		// Return a copy
		pattern := *v
		result[k] = &pattern
	}
	return result
}

// updateBuffers adds new data points to the internal buffers
func (m *Matcher) updateBuffers(dataPoints []analyzers.DataPoint) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, point := range dataPoints {
		// Add to sequence buffer
		m.sequenceBuffer = append(m.sequenceBuffer, point.Value)
		m.timestampBuffer = append(m.timestampBuffer, point.Timestamp)

		// Convert and add to value buffer for numerical analysis
		if val, err := m.toFloat64(point.Value); err == nil {
			m.valueBuffer = append(m.valueBuffer, val)
		} else {
			// For non-numeric values, use a hash or categorical encoding
			m.valueBuffer = append(m.valueBuffer, float64(m.hashValue(point.Value)))
		}

		// Maintain buffer size
		if len(m.sequenceBuffer) > m.config.WindowSize {
			m.sequenceBuffer = m.sequenceBuffer[1:]
			m.valueBuffer = m.valueBuffer[1:]
			m.timestampBuffer = m.timestampBuffer[1:]
		}
	}
}

// detectPatterns identifies patterns in the current buffer
func (m *Matcher) detectPatterns() []*Pattern {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var patterns []*Pattern

	// Detect different types of patterns
	patterns = append(patterns, m.detectPeriodicPatterns()...)
	patterns = append(patterns, m.detectSequentialPatterns()...)
	patterns = append(patterns, m.detectTrendPatterns()...)
	patterns = append(patterns, m.detectSeasonalPatterns()...)
	patterns = append(patterns, m.detectSpikePatterns()...)
	patterns = append(patterns, m.detectDropPatterns()...)

	return patterns
}

// detectPeriodicPatterns identifies repeating patterns
func (m *Matcher) detectPeriodicPatterns() []*Pattern {
	var patterns []*Pattern

	if len(m.valueBuffer) < m.minPatternLength*2 {
		return patterns
	}

	// Look for repeating subsequences
	for length := m.minPatternLength; length <= m.maxPatternLength && length*2 <= len(m.valueBuffer); length++ {
		for start := 0; start <= len(m.valueBuffer)-length*2; start++ {
			pattern1 := m.valueBuffer[start : start+length]
			
			// Look for similar patterns
			for next := start + length; next <= len(m.valueBuffer)-length; next += length {
				pattern2 := m.valueBuffer[next : next+length]
				
				similarity := m.calculateSimilarity(pattern1, pattern2)
				if similarity >= m.similarityThreshold {
					confidence := similarity
					
					pattern := &Pattern{
						ID:         fmt.Sprintf("periodic_%d_%d_%d", start, length, time.Now().UnixNano()),
						Type:       PatternTypePeriodic,
						Sequence:   m.convertToInterface(pattern1),
						Frequency:  1, // Will be updated in updatePatterns
						Confidence: confidence,
						StartTime:  m.timestampBuffer[start],
						EndTime:    m.timestampBuffer[start+length-1],
						Metadata: map[string]interface{}{
							"length":     length,
							"similarity": similarity,
							"period":     next - start,
						},
					}
					patterns = append(patterns, pattern)
				}
			}
		}
	}

	return patterns
}

// detectSequentialPatterns identifies sequential patterns
func (m *Matcher) detectSequentialPatterns() []*Pattern {
	var patterns []*Pattern

	if len(m.valueBuffer) < m.minPatternLength {
		return patterns
	}

	// Look for monotonic sequences
	for start := 0; start <= len(m.valueBuffer)-m.minPatternLength; start++ {
		for length := m.minPatternLength; length <= m.maxPatternLength && start+length <= len(m.valueBuffer); length++ {
			sequence := m.valueBuffer[start : start+length]
			
			if m.isMonotonic(sequence) {
				confidence := m.calculateMonotonicConfidence(sequence)
				
				pattern := &Pattern{
					ID:         fmt.Sprintf("sequential_%d_%d_%d", start, length, time.Now().UnixNano()),
					Type:       PatternTypeSequential,
					Sequence:   m.convertToInterface(sequence),
					Frequency:  1,
					Confidence: confidence,
					StartTime:  m.timestampBuffer[start],
					EndTime:    m.timestampBuffer[start+length-1],
					Metadata: map[string]interface{}{
						"length":    length,
						"direction": m.getMonotonicDirection(sequence),
					},
				}
				patterns = append(patterns, pattern)
			}
		}
	}

	return patterns
}

// detectTrendPatterns identifies trending patterns
func (m *Matcher) detectTrendPatterns() []*Pattern {
	var patterns []*Pattern

	if len(m.valueBuffer) < m.minPatternLength {
		return patterns
	}

	// Calculate trend using linear regression
	for start := 0; start <= len(m.valueBuffer)-m.minPatternLength; start++ {
		for length := m.minPatternLength; length <= m.maxPatternLength && start+length <= len(m.valueBuffer); length++ {
			sequence := m.valueBuffer[start : start+length]
			slope, correlation := m.calculateLinearTrend(sequence)
			
			if math.Abs(correlation) >= 0.7 { // Strong correlation indicates trend
				pattern := &Pattern{
					ID:         fmt.Sprintf("trend_%d_%d_%d", start, length, time.Now().UnixNano()),
					Type:       PatternTypeTrend,
					Sequence:   m.convertToInterface(sequence),
					Frequency:  1,
					Confidence: math.Abs(correlation),
					StartTime:  m.timestampBuffer[start],
					EndTime:    m.timestampBuffer[start+length-1],
					Metadata: map[string]interface{}{
						"slope":       slope,
						"correlation": correlation,
						"direction":   m.getTrendDirection(slope),
					},
				}
				patterns = append(patterns, pattern)
			}
		}
	}

	return patterns
}

// detectSeasonalPatterns identifies seasonal patterns (simplified)
func (m *Matcher) detectSeasonalPatterns() []*Pattern {
	var patterns []*Pattern

	// This is a simplified seasonal detection
	// In practice, you'd use more sophisticated methods like FFT
	if len(m.valueBuffer) < 24 { // Need enough data for seasonal analysis
		return patterns
	}

	// Look for patterns that repeat every N intervals
	seasonalPeriods := []int{7, 24, 30} // Weekly, daily, monthly patterns
	
	for _, period := range seasonalPeriods {
		if len(m.valueBuffer) >= period*2 {
			// Check correlation between different periods
			correlations := m.calculateSeasonalCorrelation(period)
			avgCorrelation := m.average(correlations)
			
			if avgCorrelation >= 0.6 {
				pattern := &Pattern{
					ID:         fmt.Sprintf("seasonal_%d_%d", period, time.Now().UnixNano()),
					Type:       PatternTypeSeasonal,
					Sequence:   m.convertToInterface(m.valueBuffer[len(m.valueBuffer)-period:]),
					Frequency:  len(correlations),
					Confidence: avgCorrelation,
					StartTime:  m.timestampBuffer[len(m.timestampBuffer)-period],
					EndTime:    m.timestampBuffer[len(m.timestampBuffer)-1],
					Metadata: map[string]interface{}{
						"period":       period,
						"correlations": correlations,
					},
				}
				patterns = append(patterns, pattern)
			}
		}
	}

	return patterns
}

// detectSpikePatterns identifies sudden spikes
func (m *Matcher) detectSpikePatterns() []*Pattern {
	var patterns []*Pattern

	if len(m.valueBuffer) < 3 {
		return patterns
	}

	// Calculate moving average and standard deviation
	windowSize := min(10, len(m.valueBuffer)/2)
	
	for i := windowSize; i < len(m.valueBuffer)-1; i++ {
		window := m.valueBuffer[i-windowSize : i]
		mean := m.average(window)
		stdDev := m.standardDeviation(window, mean)
		
		current := m.valueBuffer[i]
		zScore := (current - mean) / stdDev
		
		if zScore > 3.0 { // Significant spike
			pattern := &Pattern{
				ID:         fmt.Sprintf("spike_%d_%d", i, time.Now().UnixNano()),
				Type:       PatternTypeSpike,
				Sequence:   []interface{}{current},
				Frequency:  1,
				Confidence: min(zScore/5.0, 1.0), // Normalize to 0-1
				StartTime:  m.timestampBuffer[i],
				EndTime:    m.timestampBuffer[i],
				Metadata: map[string]interface{}{
					"z_score":  zScore,
					"mean":     mean,
					"std_dev":  stdDev,
					"baseline": window,
				},
			}
			patterns = append(patterns, pattern)
		}
	}

	return patterns
}

// detectDropPatterns identifies sudden drops
func (m *Matcher) detectDropPatterns() []*Pattern {
	var patterns []*Pattern

	if len(m.valueBuffer) < 3 {
		return patterns
	}

	// Calculate moving average and standard deviation
	windowSize := min(10, len(m.valueBuffer)/2)
	
	for i := windowSize; i < len(m.valueBuffer)-1; i++ {
		window := m.valueBuffer[i-windowSize : i]
		mean := m.average(window)
		stdDev := m.standardDeviation(window, mean)
		
		current := m.valueBuffer[i]
		zScore := (mean - current) / stdDev // Inverted for drops
		
		if zScore > 3.0 { // Significant drop
			pattern := &Pattern{
				ID:         fmt.Sprintf("drop_%d_%d", i, time.Now().UnixNano()),
				Type:       PatternTypeDrop,
				Sequence:   []interface{}{current},
				Frequency:  1,
				Confidence: min(zScore/5.0, 1.0), // Normalize to 0-1
				StartTime:  m.timestampBuffer[i],
				EndTime:    m.timestampBuffer[i],
				Metadata: map[string]interface{}{
					"z_score":  zScore,
					"mean":     mean,
					"std_dev":  stdDev,
					"baseline": window,
				},
			}
			patterns = append(patterns, pattern)
		}
	}

	return patterns
}

// updatePatterns updates the pattern registry with new detections
func (m *Matcher) updatePatterns(newPatterns []*Pattern) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, newPattern := range newPatterns {
		// Check if similar pattern already exists
		var existingPattern *Pattern
		for _, existing := range m.patterns {
			if m.patternsAreSimilar(newPattern, existing) {
				existingPattern = existing
				break
			}
		}

		if existingPattern != nil {
			// Update existing pattern
			existingPattern.Frequency++
			existingPattern.EndTime = newPattern.EndTime
			existingPattern.Confidence = (existingPattern.Confidence + newPattern.Confidence) / 2
		} else {
			// Add new pattern
			m.patterns[newPattern.ID] = newPattern
		}
	}
}

// detectPatternAnomalies identifies anomalies based on pattern violations
func (m *Matcher) detectPatternAnomalies(dataPoints []analyzers.DataPoint) []analyzers.Anomaly {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var anomalies []analyzers.Anomaly

	// Check for missing expected patterns
	for _, pattern := range m.patterns {
		if pattern.Frequency > 2 { // Pattern should be established
			// Check if pattern continues to appear
			if !m.patternRecentlyDetected(pattern) {
				anomaly := analyzers.Anomaly{
					ID:        fmt.Sprintf("pattern_missing_%s", pattern.ID),
					Type:      analyzers.AnomalyTypePattern,
					Severity:  m.calculatePatternAnomalySeverity(pattern),
					Score:     pattern.Confidence * 0.8, // Slightly lower score for missing patterns
					Timestamp: time.Now(),
					Value:     nil,
					Expected:  pattern.Sequence,
					Source:    m.Name(),
					Message:   fmt.Sprintf("Expected %s pattern is missing", pattern.Type),
					Metadata: map[string]interface{}{
						"pattern_id":   pattern.ID,
						"pattern_type": string(pattern.Type),
						"frequency":    pattern.Frequency,
						"confidence":   pattern.Confidence,
					},
				}
				anomalies = append(anomalies, anomaly)
			}
		}
	}

	// Check for pattern breaks in recent data
	recentDataPoints := dataPoints
	if len(dataPoints) > 20 {
		recentDataPoints = dataPoints[len(dataPoints)-20:] // Last 20 points
	}

	for i, point := range recentDataPoints {
		if m.breaksPreviousPatterns(point, i) {
			anomaly := analyzers.Anomaly{
				ID:        fmt.Sprintf("pattern_break_%d_%d", point.Timestamp.Unix(), i),
				Type:      analyzers.AnomalyTypePattern,
				Severity:  analyzers.SeverityMedium,
				Score:     0.7,
				Timestamp: point.Timestamp,
				Value:     point.Value,
				Expected:  nil,
				Source:    m.Name(),
				Message:   "Data point breaks established patterns",
				Metadata: map[string]interface{}{
					"index": i,
				},
			}
			anomalies = append(anomalies, anomaly)
		}
	}

	return anomalies
}

// Helper methods

func (m *Matcher) toFloat64(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", value)
	}
}

func (m *Matcher) hashValue(value interface{}) int {
	return int(fmt.Sprintf("%v", value)[0]) % 100 // Simple hash
}

func (m *Matcher) calculateSimilarity(seq1, seq2 []float64) float64 {
	if len(seq1) != len(seq2) {
		return 0
	}

	var sumDiff, sumSeq1 float64
	for i := 0; i < len(seq1); i++ {
		diff := seq1[i] - seq2[i]
		sumDiff += diff * diff
		sumSeq1 += seq1[i] * seq1[i]
	}

	if sumSeq1 == 0 {
		return 0
	}

	return 1.0 - math.Sqrt(sumDiff)/math.Sqrt(sumSeq1)
}

func (m *Matcher) convertToInterface(values []float64) []interface{} {
	result := make([]interface{}, len(values))
	for i, v := range values {
		result[i] = v
	}
	return result
}

func (m *Matcher) isMonotonic(sequence []float64) bool {
	if len(sequence) < 2 {
		return false
	}

	increasing := true
	decreasing := true

	for i := 1; i < len(sequence); i++ {
		if sequence[i] <= sequence[i-1] {
			increasing = false
		}
		if sequence[i] >= sequence[i-1] {
			decreasing = false
		}
	}

	return increasing || decreasing
}

func (m *Matcher) calculateMonotonicConfidence(sequence []float64) float64 {
	if len(sequence) < 2 {
		return 0
	}

	violations := 0
	increasing := sequence[1] > sequence[0]

	for i := 1; i < len(sequence); i++ {
		if increasing && sequence[i] <= sequence[i-1] {
			violations++
		} else if !increasing && sequence[i] >= sequence[i-1] {
			violations++
		}
	}

	return 1.0 - float64(violations)/float64(len(sequence)-1)
}

func (m *Matcher) getMonotonicDirection(sequence []float64) string {
	if len(sequence) < 2 {
		return "unknown"
	}
	if sequence[1] > sequence[0] {
		return "increasing"
	}
	return "decreasing"
}

func (m *Matcher) calculateLinearTrend(sequence []float64) (float64, float64) {
	n := float64(len(sequence))
	if n < 2 {
		return 0, 0
	}

	var sumX, sumY, sumXY, sumXX float64
	for i, y := range sequence {
		x := float64(i)
		sumX += x
		sumY += y
		sumXY += x * y
		sumXX += x * x
	}

	slope := (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX)
	
	// Calculate correlation coefficient
	avgX := sumX / n
	avgY := sumY / n
	
	var numerator, denomX, denomY float64
	for i, y := range sequence {
		x := float64(i)
		numerator += (x - avgX) * (y - avgY)
		denomX += (x - avgX) * (x - avgX)
		denomY += (y - avgY) * (y - avgY)
	}
	
	correlation := numerator / math.Sqrt(denomX*denomY)
	
	return slope, correlation
}

func (m *Matcher) getTrendDirection(slope float64) string {
	if slope > 0 {
		return "upward"
	} else if slope < 0 {
		return "downward"
	}
	return "flat"
}

func (m *Matcher) calculateSeasonalCorrelation(period int) []float64 {
	var correlations []float64
	
	for start := 0; start+period*2 <= len(m.valueBuffer); start += period {
		seq1 := m.valueBuffer[start : start+period]
		seq2 := m.valueBuffer[start+period : start+period*2]
		corr := m.calculateSimilarity(seq1, seq2)
		correlations = append(correlations, corr)
	}
	
	return correlations
}

func (m *Matcher) average(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func (m *Matcher) standardDeviation(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sumSquares float64
	for _, v := range values {
		diff := v - mean
		sumSquares += diff * diff
	}
	return math.Sqrt(sumSquares / float64(len(values)))
}

func (m *Matcher) patternsAreSimilar(p1, p2 *Pattern) bool {
	return p1.Type == p2.Type && 
		   len(p1.Sequence) == len(p2.Sequence) &&
		   m.calculateSimilarity(m.extractFloats(p1.Sequence), m.extractFloats(p2.Sequence)) > 0.8
}

func (m *Matcher) extractFloats(sequence []interface{}) []float64 {
	result := make([]float64, len(sequence))
	for i, v := range sequence {
		if f, err := m.toFloat64(v); err == nil {
			result[i] = f
		}
	}
	return result
}

func (m *Matcher) patternRecentlyDetected(pattern *Pattern) bool {
	// Check if pattern was detected in recent data
	recentThreshold := time.Now().Add(-time.Hour) // Within last hour
	return pattern.EndTime.After(recentThreshold)
}

func (m *Matcher) breaksPreviousPatterns(point analyzers.DataPoint, index int) bool {
	// Simplified pattern break detection
	if len(m.valueBuffer) < 5 {
		return false
	}
	
	val, err := m.toFloat64(point.Value)
	if err != nil {
		return false
	}
	
	// Check if current value significantly deviates from recent trend
	recent := m.valueBuffer[max(0, len(m.valueBuffer)-5):]
	mean := m.average(recent)
	stdDev := m.standardDeviation(recent, mean)
	
	if stdDev > 0 {
		zScore := math.Abs(val-mean) / stdDev
		return zScore > 2.5 // Significant deviation
	}
	
	return false
}

func (m *Matcher) calculatePatternAnomalySeverity(pattern *Pattern) analyzers.Severity {
	if pattern.Confidence > 0.9 && pattern.Frequency > 5 {
		return analyzers.SeverityHigh
	} else if pattern.Confidence > 0.7 && pattern.Frequency > 3 {
		return analyzers.SeverityMedium
	}
	return analyzers.SeverityLow
}

func (m *Matcher) calculateOverallScore(anomalies []analyzers.Anomaly, patterns []*Pattern) float64 {
	if len(anomalies) == 0 {
		return 0.0
	}

	var totalScore float64
	for _, anomaly := range anomalies {
		totalScore += anomaly.Score
	}

	// Factor in pattern confidence
	var patternBonus float64
	for _, pattern := range patterns {
		patternBonus += pattern.Confidence * 0.1
	}

	avgScore := totalScore / float64(len(anomalies))
	return (avgScore + patternBonus) * m.config.Sensitivity
}

// Utility functions
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}