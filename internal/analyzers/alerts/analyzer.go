package alerts

import (
	"context"
	"time"
)

// AlertAnalyzer analyzes data for alert conditions
type AlertAnalyzer struct {
	threshold float64
}

// NewAlertAnalyzer creates a new alert analyzer
func NewAlertAnalyzer(threshold float64) *AlertAnalyzer {
	return &AlertAnalyzer{
		threshold: threshold,
	}
}

// Analyze checks if data triggers an alert
func (a *AlertAnalyzer) Analyze(ctx context.Context, data interface{}) (bool, error) {
	// Simple threshold check implementation
	if val, ok := data.(float64); ok {
		return val > a.threshold, nil
	}
	return false, nil
}

// GetThreshold returns the current threshold
func (a *AlertAnalyzer) GetThreshold() float64 {
	return a.threshold
}

// SetThreshold updates the threshold
func (a *AlertAnalyzer) SetThreshold(threshold float64) {
	a.threshold = threshold
}

// Alert represents an alert
type Alert struct {
	ID        string
	Level     string
	Message   string
	Timestamp time.Time
	Data      interface{}
}