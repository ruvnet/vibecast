package models

import (
	"time"
)

// DataPoint represents a single data point for anomaly detection
type DataPoint struct {
	ID        string                 `json:"id" db:"id"`
	Timestamp time.Time              `json:"timestamp" db:"timestamp"`
	Source    string                 `json:"source" db:"source"`
	Features  map[string]float64     `json:"features" db:"features"`
	Labels    map[string]string      `json:"labels,omitempty" db:"labels"`
	Metadata  map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
}

// Anomaly represents a detected anomaly
type Anomaly struct {
	ID             string                 `json:"id" db:"id"`
	DataPointID    string                 `json:"data_point_id" db:"data_point_id"`
	DetectedAt     time.Time              `json:"detected_at" db:"detected_at"`
	Score          float64                `json:"score" db:"score"`
	Confidence     float64                `json:"confidence" db:"confidence"`
	Severity       Severity               `json:"severity" db:"severity"`
	ModelUsed      string                 `json:"model_used" db:"model_used"`
	Features       map[string]float64     `json:"features" db:"features"`
	Metadata       map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	Status         AnomalyStatus          `json:"status" db:"status"`
	ResolvedAt     *time.Time             `json:"resolved_at,omitempty" db:"resolved_at"`
	ResolvedBy     string                 `json:"resolved_by,omitempty" db:"resolved_by"`
	ResolutionNote string                 `json:"resolution_note,omitempty" db:"resolution_note"`
	CreatedAt      time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at" db:"updated_at"`
}

// Prediction represents a model prediction
type Prediction struct {
	ID            string             `json:"id"`
	Score         float64            `json:"score"`
	Confidence    float64            `json:"confidence"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	Features      map[string]float64 `json:"features"`
	Timestamp     time.Time          `json:"timestamp"`
	ModelVersion  string             `json:"model_version"`
}

// Feedback represents feedback on model predictions
type Feedback struct {
	ID           string    `json:"id" db:"id"`
	PredictionID string    `json:"prediction_id" db:"prediction_id"`
	AnomalyID    string    `json:"anomaly_id,omitempty" db:"anomaly_id"`
	IsCorrect    bool      `json:"is_correct" db:"is_correct"`
	ActualLabel  string    `json:"actual_label" db:"actual_label"`
	Notes        string    `json:"notes,omitempty" db:"notes"`
	ProvidedBy   string    `json:"provided_by" db:"provided_by"`
	ProvidedAt   time.Time `json:"provided_at" db:"provided_at"`
	Weight       float64   `json:"weight" db:"weight"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// ModelMetrics represents metrics for a machine learning model
type ModelMetrics struct {
	ModelName         string                 `json:"model_name"`
	Version           string                 `json:"version"`
	TrainingDate      time.Time              `json:"training_date"`
	LastUpdateDate    time.Time              `json:"last_update_date"`
	Accuracy          float64                `json:"accuracy"`
	Precision         float64                `json:"precision"`
	Recall            float64                `json:"recall"`
	F1Score           float64                `json:"f1_score"`
	TruePositives     int64                  `json:"true_positives"`
	FalsePositives    int64                  `json:"false_positives"`
	TrueNegatives     int64                  `json:"true_negatives"`
	FalseNegatives    int64                  `json:"false_negatives"`
	TotalPredictions  int64                  `json:"total_predictions"`
	AvgProcessingTime time.Duration          `json:"avg_processing_time"`
	FeatureCount      int                    `json:"feature_count"`
	Parameters        map[string]interface{} `json:"parameters,omitempty"`
	Status            ModelStatus            `json:"status"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

// SystemMetrics represents overall system performance metrics
type SystemMetrics struct {
	Timestamp           time.Time               `json:"timestamp"`
	TotalRequests       int64                   `json:"total_requests"`
	SuccessfulRequests  int64                   `json:"successful_requests"`
	FailedRequests      int64                   `json:"failed_requests"`
	AvgResponseTime     time.Duration           `json:"avg_response_time"`
	AnomaliesDetected   int64                   `json:"anomalies_detected"`
	DataPointsProcessed int64                   `json:"data_points_processed"`
	ActiveConnections   int                     `json:"active_connections"`
	MemoryUsage         MemoryUsage             `json:"memory_usage"`
	CPUUsage            CPUUsage                `json:"cpu_usage"`
	ModelPerformance    map[string]ModelMetrics `json:"model_performance"`
	ErrorRates          map[string]float64      `json:"error_rates"`
}

// MemoryUsage represents memory usage statistics
type MemoryUsage struct {
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	Total     uint64  `json:"total"`
	Percent   float64 `json:"percent"`
}

// CPUUsage represents CPU usage statistics
type CPUUsage struct {
	Percent    float64   `json:"percent"`
	LoadAvg    []float64 `json:"load_avg"`
	CoreCount  int       `json:"core_count"`
	UserTime   float64   `json:"user_time"`
	SystemTime float64   `json:"system_time"`
	IdleTime   float64   `json:"idle_time"`
}

// Alert represents a system alert
type Alert struct {
	ID             string                 `json:"id" db:"id"`
	Type           AlertType              `json:"type" db:"type"`
	Severity       Severity               `json:"severity" db:"severity"`
	Title          string                 `json:"title" db:"title"`
	Message        string                 `json:"message" db:"message"`
	Source         string                 `json:"source" db:"source"`
	AnomalyID      string                 `json:"anomaly_id,omitempty" db:"anomaly_id"`
	Metadata       map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	Status         AlertStatus            `json:"status" db:"status"`
	CreatedAt      time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at" db:"updated_at"`
	ResolvedAt     *time.Time             `json:"resolved_at,omitempty" db:"resolved_at"`
	ResolvedBy     string                 `json:"resolved_by,omitempty" db:"resolved_by"`
	AcknowledgedAt *time.Time             `json:"acknowledged_at,omitempty" db:"acknowledged_at"`
	AcknowledgedBy string                 `json:"acknowledged_by,omitempty" db:"acknowledged_by"`
}

// User represents a system user
type User struct {
	ID        string     `json:"id" db:"id"`
	Username  string     `json:"username" db:"username"`
	Email     string     `json:"email" db:"email"`
	Role      UserRole   `json:"role" db:"role"`
	IsActive  bool       `json:"is_active" db:"is_active"`
	LastLogin *time.Time `json:"last_login,omitempty" db:"last_login"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
}

// Enums

// Severity represents the severity level of an anomaly or alert
type Severity string

const (
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

// AnomalyStatus represents the status of an anomaly
type AnomalyStatus string

const (
	AnomalyStatusOpen          AnomalyStatus = "open"
	AnomalyStatusInProgress    AnomalyStatus = "in_progress"
	AnomalyStatusResolved      AnomalyStatus = "resolved"
	AnomalyStatusFalsePositive AnomalyStatus = "false_positive"
)

// ModelStatus represents the status of a machine learning model
type ModelStatus string

const (
	ModelStatusTraining   ModelStatus = "training"
	ModelStatusReady      ModelStatus = "ready"
	ModelStatusDeprecated ModelStatus = "deprecated"
	ModelStatusFailed     ModelStatus = "failed"
)

// AlertType represents the type of alert
type AlertType string

const (
	AlertTypeAnomaly     AlertType = "anomaly"
	AlertTypeSystem      AlertType = "system"
	AlertTypePerformance AlertType = "performance"
	AlertTypeSecurity    AlertType = "security"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusOpen         AlertStatus = "open"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved     AlertStatus = "resolved"
	AlertStatusClosed       AlertStatus = "closed"
)

// UserRole represents user roles in the system
type UserRole string

const (
	UserRoleAdmin     UserRole = "admin"
	UserRoleModerator UserRole = "moderator"
	UserRoleAnalyst   UserRole = "analyst"
	UserRoleViewer    UserRole = "viewer"
)

// Request and Response models for API

// DetectRequest represents a request to detect anomalies
type DetectRequest struct {
	DataPoints []DataPoint   `json:"data_points"`
	ModelName  string        `json:"model_name,omitempty"`
	Options    DetectOptions `json:"options,omitempty"`
}

// DetectOptions represents options for anomaly detection
type DetectOptions struct {
	Threshold      *float64 `json:"threshold,omitempty"`
	WindowSize     *int     `json:"window_size,omitempty"`
	EnableML       *bool    `json:"enable_ml,omitempty"`
	ReturnFeatures bool     `json:"return_features,omitempty"`
}

// DetectResponse represents a response from anomaly detection
type DetectResponse struct {
	Results        []DetectionResult `json:"results"`
	ProcessingTime time.Duration     `json:"processing_time"`
	ModelUsed      string            `json:"model_used"`
	Timestamp      time.Time         `json:"timestamp"`
}

// DetectionResult represents a single detection result
type DetectionResult struct {
	DataPointID string             `json:"data_point_id"`
	IsAnomaly   bool               `json:"is_anomaly"`
	Score       float64            `json:"score"`
	Confidence  float64            `json:"confidence"`
	Severity    Severity           `json:"severity"`
	Features    map[string]float64 `json:"features,omitempty"`
	Explanation string             `json:"explanation,omitempty"`
}

// TrainRequest represents a request to train a model
type TrainRequest struct {
	ModelName  string                 `json:"model_name"`
	DataPoints []DataPoint            `json:"data_points"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
	Validation ValidationOptions      `json:"validation,omitempty"`
}

// ValidationOptions represents validation options for training
type ValidationOptions struct {
	SplitRatio      float64     `json:"split_ratio,omitempty"`
	CrossValidation int         `json:"cross_validation,omitempty"`
	TestData        []DataPoint `json:"test_data,omitempty"`
}

// TrainResponse represents a response from model training
type TrainResponse struct {
	ModelName    string        `json:"model_name"`
	Version      string        `json:"version"`
	TrainingTime time.Duration `json:"training_time"`
	Metrics      ModelMetrics  `json:"metrics"`
	Status       ModelStatus   `json:"status"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status    string          `json:"status"`
	Timestamp time.Time       `json:"timestamp"`
	Version   string          `json:"version"`
	Uptime    time.Duration   `json:"uptime"`
	Services  map[string]bool `json:"services"`
	Metrics   SystemMetrics   `json:"metrics,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error     string                 `json:"error"`
	Code      string                 `json:"code,omitempty"`
	Details   string                 `json:"details,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	RequestID string                 `json:"request_id,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
	Total      int64       `json:"total"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
}

// Helper functions

// IsValidSeverity checks if a severity value is valid
func IsValidSeverity(severity Severity) bool {
	switch severity {
	case SeverityLow, SeverityMedium, SeverityHigh, SeverityCritical:
		return true
	default:
		return false
	}
}

// IsValidAnomalyStatus checks if an anomaly status is valid
func IsValidAnomalyStatus(status AnomalyStatus) bool {
	switch status {
	case AnomalyStatusOpen, AnomalyStatusInProgress, AnomalyStatusResolved, AnomalyStatusFalsePositive:
		return true
	default:
		return false
	}
}

// IsValidUserRole checks if a user role is valid
func IsValidUserRole(role UserRole) bool {
	switch role {
	case UserRoleAdmin, UserRoleModerator, UserRoleAnalyst, UserRoleViewer:
		return true
	default:
		return false
	}
}

// GetSeverityFromScore converts a numeric score to severity level
func GetSeverityFromScore(score float64) Severity {
	switch {
	case score >= 0.9:
		return SeverityCritical
	case score >= 0.7:
		return SeverityHigh
	case score >= 0.5:
		return SeverityMedium
	default:
		return SeverityLow
	}
}
