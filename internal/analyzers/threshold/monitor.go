package threshold

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/analyzers"
)

// ThresholdRule represents a threshold monitoring rule
type ThresholdRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Metric      string                 `json:"metric"`
	Operator    Operator              `json:"operator"`
	Value       float64               `json:"value"`
	Severity    analyzers.Severity    `json:"severity"`
	Enabled     bool                  `json:"enabled"`
	Cooldown    time.Duration         `json:"cooldown"`
	LastTriggered time.Time            `json:"last_triggered"`
	Count       int                   `json:"count"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Operator represents comparison operators for thresholds
type Operator string

const (
	OperatorGreaterThan    Operator = "gt"
	OperatorLessThan       Operator = "lt"
	OperatorEqual          Operator = "eq"
	OperatorNotEqual       Operator = "ne"
	OperatorGreaterOrEqual Operator = "gte"
	OperatorLessOrEqual    Operator = "lte"
	OperatorBetween        Operator = "between"
	OperatorOutside        Operator = "outside"
)

// ThresholdConfig holds configuration for threshold ranges
type ThresholdConfig struct {
	LowerBound    *float64 `json:"lower_bound,omitempty"`
	UpperBound    *float64 `json:"upper_bound,omitempty"`
	WarningLower  *float64 `json:"warning_lower,omitempty"`
	WarningUpper  *float64 `json:"warning_upper,omitempty"`
	CriticalLower *float64 `json:"critical_lower,omitempty"`
	CriticalUpper *float64 `json:"critical_upper,omitempty"`
}

// Monitor implements threshold-based anomaly detection
type Monitor struct {
	config         *analyzers.Configuration
	rules          map[string]*ThresholdRule
	thresholdConfig *ThresholdConfig
	adaptiveMode   bool
	statistics     *analyzers.Statistics
	valueHistory   []float64
	mu             sync.RWMutex
}

// NewMonitor creates a new threshold monitor
func NewMonitor(config *analyzers.Configuration) (*Monitor, error) {
	if config == nil {
		config = analyzers.DefaultConfiguration()
	}

	monitor := &Monitor{
		config:         config,
		rules:          make(map[string]*ThresholdRule),
		adaptiveMode:   false,
		valueHistory:   make([]float64, 0, config.WindowSize),
		thresholdConfig: &ThresholdConfig{},
	}

	// Set up default thresholds based on configuration
	if config.Threshold > 0 {
		upper := config.Threshold
		lower := -config.Threshold
		monitor.thresholdConfig.UpperBound = &upper
		monitor.thresholdConfig.LowerBound = &lower
	}

	// Add default rules
	monitor.addDefaultRules()

	return monitor, nil
}

// Name returns the analyzer name
func (m *Monitor) Name() string {
	return "threshold-monitor"
}

// Type returns the analyzer type
func (m *Monitor) Type() analyzers.AnomalyType {
	return analyzers.AnomalyTypeThreshold
}

// Analyze performs threshold-based anomaly detection
func (m *Monitor) Analyze(ctx context.Context, data *analyzers.TimeSeries) (*analyzers.AnalysisResult, error) {
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

	// Convert data points to float64 values
	values, err := m.extractValues(data.DataPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to extract values: %w", err)
	}

	// Update value history and statistics
	m.updateHistory(values)

	// Update adaptive thresholds if enabled
	if m.adaptiveMode {
		m.updateAdaptiveThresholds()
	}

	// Check all threshold rules
	anomalies := m.checkThresholds(data.DataPoints, values)

	// Calculate overall score
	score := m.calculateOverallScore(anomalies)

	duration := time.Since(start)

	metadata := map[string]interface{}{
		"rules_count":          len(m.rules),
		"adaptive_mode":        m.adaptiveMode,
		"threshold_config":     m.thresholdConfig,
		"statistics":           m.statistics,
		"history_size":         len(m.valueHistory),
		"processing_time_ms":   duration.Milliseconds(),
	}

	// Add rule status to metadata
	ruleStatus := make(map[string]interface{})
	for id, rule := range m.rules {
		ruleStatus[id] = map[string]interface{}{
			"enabled":        rule.Enabled,
			"triggered":      rule.Count,
			"last_triggered": rule.LastTriggered,
		}
	}
	metadata["rule_status"] = ruleStatus

	return &analyzers.AnalysisResult{
		Anomalies: anomalies,
		Score:     score,
		Metadata:  metadata,
		Duration:  duration,
	}, nil
}

// Configure updates the monitor configuration
func (m *Monitor) Configure(config map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if adaptiveMode, ok := config["adaptive_mode"].(bool); ok {
		m.adaptiveMode = adaptiveMode
	}

	if thresholds, ok := config["thresholds"].(map[string]interface{}); ok {
		if upper, ok := thresholds["upper"].(float64); ok {
			m.thresholdConfig.UpperBound = &upper
		}
		if lower, ok := thresholds["lower"].(float64); ok {
			m.thresholdConfig.LowerBound = &lower
		}
		if warningUpper, ok := thresholds["warning_upper"].(float64); ok {
			m.thresholdConfig.WarningUpper = &warningUpper
		}
		if warningLower, ok := thresholds["warning_lower"].(float64); ok {
			m.thresholdConfig.WarningLower = &warningLower
		}
		if criticalUpper, ok := thresholds["critical_upper"].(float64); ok {
			m.thresholdConfig.CriticalUpper = &criticalUpper
		}
		if criticalLower, ok := thresholds["critical_lower"].(float64); ok {
			m.thresholdConfig.CriticalLower = &criticalLower
		}
	}

	if rules, ok := config["rules"].([]interface{}); ok {
		for _, ruleData := range rules {
			if ruleMap, ok := ruleData.(map[string]interface{}); ok {
				rule, err := m.parseRule(ruleMap)
				if err != nil {
					return fmt.Errorf("failed to parse rule: %w", err)
				}
				m.rules[rule.ID] = rule
			}
		}
	}

	return nil
}

// IsReady returns true if the monitor has sufficient data
func (m *Monitor) IsReady() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.valueHistory) >= m.config.MinDataPoints || len(m.rules) > 0
}

// Close cleans up resources
func (m *Monitor) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules = make(map[string]*ThresholdRule)
	m.valueHistory = nil
	m.statistics = nil
	return nil
}

// AddRule adds a new threshold rule
func (m *Monitor) AddRule(rule *ThresholdRule) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules[rule.ID] = rule
}

// RemoveRule removes a threshold rule
func (m *Monitor) RemoveRule(ruleID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rules, ruleID)
}

// GetRules returns all threshold rules
func (m *Monitor) GetRules() map[string]*ThresholdRule {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := make(map[string]*ThresholdRule)
	for k, v := range m.rules {
		// Return a copy
		rule := *v
		result[k] = &rule
	}
	return result
}

// EnableAdaptiveMode enables or disables adaptive threshold adjustment
func (m *Monitor) EnableAdaptiveMode(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.adaptiveMode = enabled
}

// extractValues converts data points to float64 values
func (m *Monitor) extractValues(dataPoints []analyzers.DataPoint) ([]float64, error) {
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

// updateHistory updates the value history and recalculates statistics
func (m *Monitor) updateHistory(values []float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Add new values to history
	m.valueHistory = append(m.valueHistory, values...)

	// Maintain window size
	if len(m.valueHistory) > m.config.WindowSize {
		excess := len(m.valueHistory) - m.config.WindowSize
		m.valueHistory = m.valueHistory[excess:]
	}

	// Recalculate statistics
	m.statistics = m.calculateStatistics(m.valueHistory)
}

// updateAdaptiveThresholds adjusts thresholds based on current statistics
func (m *Monitor) updateAdaptiveThresholds() {
	if m.statistics == nil {
		return
	}

	// Update thresholds based on statistical measures
	// Upper bounds: mean + k*stddev
	// Lower bounds: mean - k*stddev
	
	k := 2.0 // Number of standard deviations for normal thresholds
	kWarning := 1.5
	kCritical := 3.0

	upper := m.statistics.Mean + k*m.statistics.StdDev
	lower := m.statistics.Mean - k*m.statistics.StdDev
	warningUpper := m.statistics.Mean + kWarning*m.statistics.StdDev
	warningLower := m.statistics.Mean - kWarning*m.statistics.StdDev
	criticalUpper := m.statistics.Mean + kCritical*m.statistics.StdDev
	criticalLower := m.statistics.Mean - kCritical*m.statistics.StdDev

	m.thresholdConfig.UpperBound = &upper
	m.thresholdConfig.LowerBound = &lower
	m.thresholdConfig.WarningUpper = &warningUpper
	m.thresholdConfig.WarningLower = &warningLower
	m.thresholdConfig.CriticalUpper = &criticalUpper
	m.thresholdConfig.CriticalLower = &criticalLower
}

// checkThresholds evaluates all threshold rules against the data
func (m *Monitor) checkThresholds(dataPoints []analyzers.DataPoint, values []float64) []analyzers.Anomaly {
	m.mu.Lock()
	defer m.mu.Unlock()

	var anomalies []analyzers.Anomaly

	for i, value := range values {
		// Check against configured threshold bounds
		if anomaly := m.checkThresholdBounds(dataPoints[i], value); anomaly != nil {
			anomalies = append(anomalies, *anomaly)
		}

		// Check against custom rules
		for _, rule := range m.rules {
			if !rule.Enabled {
				continue
			}

			// Check cooldown
			if time.Since(rule.LastTriggered) < rule.Cooldown {
				continue
			}

			if m.evaluateRule(rule, value) {
				rule.Count++
				rule.LastTriggered = time.Now()

				anomaly := analyzers.Anomaly{
					ID:        fmt.Sprintf("threshold_%s_%d", rule.ID, dataPoints[i].Timestamp.Unix()),
					Type:      analyzers.AnomalyTypeThreshold,
					Severity:  rule.Severity,
					Score:     m.calculateRuleScore(rule, value),
					Timestamp: dataPoints[i].Timestamp,
					Value:     value,
					Expected:  rule.Value,
					Source:    m.Name(),
					Message:   fmt.Sprintf("Threshold rule '%s' violated: %s %s %.2f", rule.Name, rule.Metric, rule.Operator, rule.Value),
					Metadata: map[string]interface{}{
						"rule_id":          rule.ID,
						"rule_name":        rule.Name,
						"rule_operator":    string(rule.Operator),
						"rule_value":       rule.Value,
						"actual_value":     value,
						"violation_count":  rule.Count,
						"rule_metadata":    rule.Metadata,
					},
				}
				anomalies = append(anomalies, anomaly)
			}
		}
	}

	return anomalies
}

// checkThresholdBounds checks value against configured threshold bounds
func (m *Monitor) checkThresholdBounds(dataPoint analyzers.DataPoint, value float64) *analyzers.Anomaly {
	var severity analyzers.Severity
	var message string
	var expected float64
	var violated bool

	// Check critical thresholds first
	if m.thresholdConfig.CriticalUpper != nil && value > *m.thresholdConfig.CriticalUpper {
		severity = analyzers.SeverityCritical
		message = "Value exceeds critical upper threshold"
		expected = *m.thresholdConfig.CriticalUpper
		violated = true
	} else if m.thresholdConfig.CriticalLower != nil && value < *m.thresholdConfig.CriticalLower {
		severity = analyzers.SeverityCritical
		message = "Value below critical lower threshold"
		expected = *m.thresholdConfig.CriticalLower
		violated = true
	}
	// Check warning thresholds
	if !violated {
		if m.thresholdConfig.WarningUpper != nil && value > *m.thresholdConfig.WarningUpper {
			severity = analyzers.SeverityMedium
			message = "Value exceeds warning upper threshold"
			expected = *m.thresholdConfig.WarningUpper
			violated = true
		} else if m.thresholdConfig.WarningLower != nil && value < *m.thresholdConfig.WarningLower {
			severity = analyzers.SeverityMedium
			message = "Value below warning lower threshold"
			expected = *m.thresholdConfig.WarningLower
			violated = true
		}
	}
	// Check basic thresholds
	if !violated {
		if m.thresholdConfig.UpperBound != nil && value > *m.thresholdConfig.UpperBound {
			severity = analyzers.SeverityLow
			message = "Value exceeds upper threshold"
			expected = *m.thresholdConfig.UpperBound
			violated = true
		} else if m.thresholdConfig.LowerBound != nil && value < *m.thresholdConfig.LowerBound {
			severity = analyzers.SeverityLow
			message = "Value below lower threshold"
			expected = *m.thresholdConfig.LowerBound
			violated = true
		}
	}

	if !violated {
		return nil
	}

	score := m.calculateThresholdScore(value, expected, severity)

	return &analyzers.Anomaly{
		ID:        fmt.Sprintf("threshold_bound_%d", dataPoint.Timestamp.Unix()),
		Type:      analyzers.AnomalyTypeThreshold,
		Severity:  severity,
		Score:     score,
		Timestamp: dataPoint.Timestamp,
		Value:     value,
		Expected:  expected,
		Source:    m.Name(),
		Message:   message,
		Metadata: map[string]interface{}{
			"threshold_type": "bound",
			"threshold_config": m.thresholdConfig,
		},
	}
}

// evaluateRule evaluates a threshold rule against a value
func (m *Monitor) evaluateRule(rule *ThresholdRule, value float64) bool {
	switch rule.Operator {
	case OperatorGreaterThan:
		return value > rule.Value
	case OperatorLessThan:
		return value < rule.Value
	case OperatorEqual:
		return math.Abs(value-rule.Value) < 1e-9 // Float comparison with epsilon
	case OperatorNotEqual:
		return math.Abs(value-rule.Value) >= 1e-9
	case OperatorGreaterOrEqual:
		return value >= rule.Value
	case OperatorLessOrEqual:
		return value <= rule.Value
	case OperatorBetween:
		// For between, rule.Value is the lower bound, upper bound should be in metadata
		if upper, ok := rule.Metadata["upper_bound"].(float64); ok {
			return value >= rule.Value && value <= upper
		}
		return false
	case OperatorOutside:
		// For outside, rule.Value is the lower bound, upper bound should be in metadata
		if upper, ok := rule.Metadata["upper_bound"].(float64); ok {
			return value < rule.Value || value > upper
		}
		return false
	default:
		return false
	}
}

// calculateRuleScore calculates anomaly score for a rule violation
func (m *Monitor) calculateRuleScore(rule *ThresholdRule, value float64) float64 {
	var distance float64

	switch rule.Operator {
	case OperatorGreaterThan, OperatorGreaterOrEqual:
		distance = math.Max(0, value-rule.Value)
	case OperatorLessThan, OperatorLessOrEqual:
		distance = math.Max(0, rule.Value-value)
	case OperatorEqual:
		distance = math.Abs(value - rule.Value)
	case OperatorNotEqual:
		distance = 1.0 // Binary score for inequality
	case OperatorBetween:
		if upper, ok := rule.Metadata["upper_bound"].(float64); ok {
			if value < rule.Value {
				distance = rule.Value - value
			} else if value > upper {
				distance = value - upper
			}
		}
	case OperatorOutside:
		distance = 1.0 // Binary score for being outside range
	}

	// Normalize distance and apply severity multiplier
	baseScore := math.Min(distance/rule.Value, 1.0)
	
	severityMultiplier := 1.0
	switch rule.Severity {
	case analyzers.SeverityLow:
		severityMultiplier = 0.5
	case analyzers.SeverityMedium:
		severityMultiplier = 0.75
	case analyzers.SeverityHigh:
		severityMultiplier = 1.0
	case analyzers.SeverityCritical:
		severityMultiplier = 1.5
	}

	return baseScore * severityMultiplier
}

// calculateThresholdScore calculates anomaly score for threshold violations
func (m *Monitor) calculateThresholdScore(actual, expected float64, severity analyzers.Severity) float64 {
	distance := math.Abs(actual - expected)
	normalizedDistance := distance / math.Max(math.Abs(expected), 1.0)
	
	severityMultiplier := 1.0
	switch severity {
	case analyzers.SeverityLow:
		severityMultiplier = 0.5
	case analyzers.SeverityMedium:
		severityMultiplier = 0.75
	case analyzers.SeverityHigh:
		severityMultiplier = 1.0
	case analyzers.SeverityCritical:
		severityMultiplier = 1.5
	}

	return math.Min(normalizedDistance*severityMultiplier, 2.0)
}

// calculateOverallScore calculates the overall anomaly score
func (m *Monitor) calculateOverallScore(anomalies []analyzers.Anomaly) float64 {
	if len(anomalies) == 0 {
		return 0.0
	}

	var totalScore float64
	for _, anomaly := range anomalies {
		totalScore += anomaly.Score
	}

	avgScore := totalScore / float64(len(anomalies))
	return avgScore * m.config.Sensitivity
}

// calculateStatistics computes statistical measures for the value history
func (m *Monitor) calculateStatistics(values []float64) *analyzers.Statistics {
	if len(values) == 0 {
		return &analyzers.Statistics{}
	}

	// Calculate basic statistics (simplified version of statistical/detector.go)
	stats := &analyzers.Statistics{
		Count: len(values),
	}

	// Calculate min, max, and mean
	stats.Min = values[0]
	stats.Max = values[0]
	var sum float64
	
	for _, v := range values {
		sum += v
		if v < stats.Min {
			stats.Min = v
		}
		if v > stats.Max {
			stats.Max = v
		}
	}
	
	stats.Mean = sum / float64(len(values))

	// Calculate variance and standard deviation
	var sumSquares float64
	for _, v := range values {
		diff := v - stats.Mean
		sumSquares += diff * diff
	}
	stats.Variance = sumSquares / float64(len(values))
	stats.StdDev = math.Sqrt(stats.Variance)

	return stats
}

// addDefaultRules adds default threshold rules
func (m *Monitor) addDefaultRules() {
	// Add default upper bound rule
	if m.thresholdConfig.UpperBound != nil {
		m.rules["default_upper"] = &ThresholdRule{
			ID:          "default_upper",
			Name:        "Default Upper Bound",
			Description: "Default upper threshold rule",
			Metric:      "value",
			Operator:    OperatorGreaterThan,
			Value:       *m.thresholdConfig.UpperBound,
			Severity:    analyzers.SeverityMedium,
			Enabled:     true,
			Cooldown:    time.Minute,
		}
	}

	// Add default lower bound rule
	if m.thresholdConfig.LowerBound != nil {
		m.rules["default_lower"] = &ThresholdRule{
			ID:          "default_lower",
			Name:        "Default Lower Bound",
			Description: "Default lower threshold rule",
			Metric:      "value",
			Operator:    OperatorLessThan,
			Value:       *m.thresholdConfig.LowerBound,
			Severity:    analyzers.SeverityMedium,
			Enabled:     true,
			Cooldown:    time.Minute,
		}
	}
}

// parseRule parses a rule from configuration map
func (m *Monitor) parseRule(ruleMap map[string]interface{}) (*ThresholdRule, error) {
	rule := &ThresholdRule{
		Enabled:  true,
		Cooldown: time.Minute,
		Metadata: make(map[string]interface{}),
	}

	if id, ok := ruleMap["id"].(string); ok {
		rule.ID = id
	} else {
		return nil, fmt.Errorf("rule id is required")
	}

	if name, ok := ruleMap["name"].(string); ok {
		rule.Name = name
	}

	if description, ok := ruleMap["description"].(string); ok {
		rule.Description = description
	}

	if metric, ok := ruleMap["metric"].(string); ok {
		rule.Metric = metric
	}

	if operator, ok := ruleMap["operator"].(string); ok {
		rule.Operator = Operator(operator)
	} else {
		return nil, fmt.Errorf("rule operator is required")
	}

	if value, ok := ruleMap["value"].(float64); ok {
		rule.Value = value
	} else {
		return nil, fmt.Errorf("rule value is required")
	}

	if severity, ok := ruleMap["severity"].(string); ok {
		rule.Severity = analyzers.Severity(severity)
	}

	if enabled, ok := ruleMap["enabled"].(bool); ok {
		rule.Enabled = enabled
	}

	if cooldown, ok := ruleMap["cooldown"].(string); ok {
		if duration, err := time.ParseDuration(cooldown); err == nil {
			rule.Cooldown = duration
		}
	}

	if metadata, ok := ruleMap["metadata"].(map[string]interface{}); ok {
		rule.Metadata = metadata
	}

	return rule, nil
}