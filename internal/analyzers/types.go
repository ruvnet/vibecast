package analyzers

import (
	"context"
	"time"
)

// Anomaly represents a detected anomaly with contextual information
type Anomaly struct {
	ID        string                 `json:"id"`
	Type      AnomalyType            `json:"type"`
	Severity  Severity               `json:"severity"`
	Score     float64                `json:"score"`
	Timestamp time.Time              `json:"timestamp"`
	Value     interface{}            `json:"value"`
	Expected  interface{}            `json:"expected,omitempty"`
	Source    string                 `json:"source"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Features  []string               `json:"features,omitempty"`
}

// AnomalyType represents the type of anomaly detected
type AnomalyType string

const (
	AnomalyTypeStatistical AnomalyType = "statistical"
	AnomalyTypePattern     AnomalyType = "pattern"
	AnomalyTypeML          AnomalyType = "ml"
	AnomalyTypeThreshold   AnomalyType = "threshold"
)

// Severity represents the severity level of an anomaly
type Severity string

const (
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

// DataPoint represents a single data point for analysis
type DataPoint struct {
	Timestamp time.Time              `json:"timestamp"`
	Value     interface{}            `json:"value"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// TimeSeries represents a time series of data points
type TimeSeries struct {
	Name       string                 `json:"name"`
	DataPoints []DataPoint            `json:"data_points"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// AnalysisResult represents the result of an analysis
type AnalysisResult struct {
	Anomalies []Anomaly              `json:"anomalies"`
	Score     float64                `json:"score"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Duration  time.Duration          `json:"duration"`
}

// Analyzer defines the interface for anomaly detection analyzers
type Analyzer interface {
	// Name returns the analyzer name
	Name() string

	// Type returns the analyzer type
	Type() AnomalyType

	// Analyze performs anomaly detection on the given data
	Analyze(ctx context.Context, data *TimeSeries) (*AnalysisResult, error)

	// Configure updates analyzer configuration
	Configure(config map[string]interface{}) error

	// IsReady returns true if the analyzer is ready for analysis
	IsReady() bool

	// Close cleans up resources
	Close() error
}

// TrainableAnalyzer defines the interface for analyzers that can be trained
type TrainableAnalyzer interface {
	Analyzer

	// Train trains the analyzer with the given data
	Train(ctx context.Context, data []*TimeSeries) error

	// IsTrained returns true if the analyzer has been trained
	IsTrained() bool
}

// Configuration holds common configuration for analyzers
type Configuration struct {
	Sensitivity   float64                `json:"sensitivity" yaml:"sensitivity"`
	WindowSize    int                    `json:"window_size" yaml:"window_size"`
	MinDataPoints int                    `json:"min_data_points" yaml:"min_data_points"`
	MaxDataPoints int                    `json:"max_data_points" yaml:"max_data_points"`
	Threshold     float64                `json:"threshold" yaml:"threshold"`
	EnableCaching bool                   `json:"enable_caching" yaml:"enable_caching"`
	CacheSize     int                    `json:"cache_size" yaml:"cache_size"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" yaml:"metadata,omitempty"`
}

// DefaultConfiguration returns default configuration values
func DefaultConfiguration() *Configuration {
	return &Configuration{
		Sensitivity:   0.95,
		WindowSize:    100,
		MinDataPoints: 10,
		MaxDataPoints: 10000,
		Threshold:     2.0,
		EnableCaching: true,
		CacheSize:     1000,
		Metadata:      make(map[string]interface{}),
	}
}

// Alert represents an alert generated from anomaly detection
type Alert struct {
	ID        string                 `json:"id"`
	Anomaly   Anomaly                `json:"anomaly"`
	Timestamp time.Time              `json:"timestamp"`
	Status    AlertStatus            `json:"status"`
	Channel   string                 `json:"channel"`
	Recipient string                 `json:"recipient"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusPending      AlertStatus = "pending"
	AlertStatusSent         AlertStatus = "sent"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved     AlertStatus = "resolved"
	AlertStatusFailed       AlertStatus = "failed"
)

// AlertRule defines rules for generating alerts
type AlertRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Condition   string                 `json:"condition"`
	Severity    Severity               `json:"severity"`
	Channel     string                 `json:"channel"`
	Recipients  []string               `json:"recipients"`
	Cooldown    time.Duration          `json:"cooldown"`
	Enabled     bool                   `json:"enabled"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Statistics holds statistical information about data
type Statistics struct {
	Mean     float64 `json:"mean"`
	Median   float64 `json:"median"`
	StdDev   float64 `json:"std_dev"`
	Variance float64 `json:"variance"`
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	Q1       float64 `json:"q1"`
	Q3       float64 `json:"q3"`
	IQR      float64 `json:"iqr"`
	Count    int     `json:"count"`
	Outliers int     `json:"outliers"`
}
