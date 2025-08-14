// Package models defines data models for the application
package models

import (
	"time"

	"github.com/google/uuid"
)

// AnalysisResult represents the result from a single analyzer
type AnalysisResult struct {
	Score      float64                `json:"score"`      // Anomaly score (0-1)
	Confidence float64                `json:"confidence"` // Confidence in the result (0-1)
	Metadata   map[string]interface{} `json:"metadata"`   // Additional analyzer-specific data
}

// AnomalyResult represents the final aggregated result
type AnomalyResult struct {
	Score       float64                      `json:"score"`        // Final anomaly score (0-1)
	Confidence  float64                      `json:"confidence"`   // Overall confidence (0-1)
	IsAnomalous bool                         `json:"is_anomalous"` // Binary classification
	Details     map[string]*AnalysisResult   `json:"details"`      // Individual analyzer results
	Timestamp   time.Time                    `json:"timestamp"`    // When the analysis was performed
}

// AnalysisRequest represents a request for text analysis
type AnalysisRequest struct {
	ID       string            `json:"id"`
	Text     string            `json:"text"`
	Options  map[string]string `json:"options,omitempty"`
	Priority int               `json:"priority,omitempty"`
}

// AnalysisResponse represents the response from the analysis API
type AnalysisResponse struct {
	ID       string         `json:"id"`
	Result   *AnomalyResult `json:"result"`
	Error    string         `json:"error,omitempty"`
	Duration time.Duration  `json:"duration"`
}

// TextSample represents a text sample for training/testing
type TextSample struct {
	ID          string            `json:"id"`
	Text        string            `json:"text"`
	Label       string            `json:"label"`       // human, ai, or unknown
	Source      string            `json:"source"`      // source of the text
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// ModelMetrics represents performance metrics for analyzers
type ModelMetrics struct {
	Accuracy    float64 `json:"accuracy"`
	Precision   float64 `json:"precision"`
	Recall      float64 `json:"recall"`
	F1Score     float64 `json:"f1_score"`
	AUC         float64 `json:"auc"`
	SampleCount int     `json:"sample_count"`
	LastUpdated time.Time `json:"last_updated"`
}

// User represents a user in the system
type User struct {
	ID        uuid.UUID `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Email     string    `json:"email" db:"email" gorm:"uniqueIndex;not null" validate:"required,email"`
	Username  string    `json:"username" db:"username" gorm:"uniqueIndex;not null" validate:"required,min=3,max=50"`
	FirstName string    `json:"first_name" db:"first_name" gorm:"not null" validate:"required"`
	LastName  string    `json:"last_name" db:"last_name" gorm:"not null" validate:"required"`
	Password  string    `json:"-" db:"password" gorm:"not null"`
	Role      string    `json:"role" db:"role" gorm:"default:'user'" validate:"oneof=user admin"`
	IsActive  bool      `json:"is_active" db:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// AnomalyData represents anomaly detection data
type AnomalyData struct {
	ID          uuid.UUID              `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	UserID      uuid.UUID              `json:"user_id" db:"user_id" gorm:"not null"`
	Data        map[string]interface{} `json:"data" db:"data" gorm:"type:jsonb"`
	Score       float64                `json:"score" db:"score"`
	IsAnomaly   bool                   `json:"is_anomaly" db:"is_anomaly"`
	Threshold   float64                `json:"threshold" db:"threshold"`
	Algorithm   string                 `json:"algorithm" db:"algorithm"`
	ProcessedAt time.Time              `json:"processed_at" db:"processed_at"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	User        *User                  `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// DetectionResult represents the result of anomaly detection
type DetectionResult struct {
	ID             uuid.UUID `json:"id"`
	IsAnomaly      bool      `json:"is_anomaly"`
	Score          float64   `json:"score"`
	Confidence     float64   `json:"confidence"`
	Threshold      float64   `json:"threshold"`
	Algorithm      string    `json:"algorithm"`
	ProcessingTime int64     `json:"processing_time_ms"`
	Metadata       Metadata  `json:"metadata"`
}

// Metadata represents additional detection metadata
type Metadata struct {
	Features    map[string]float64 `json:"features"`
	Explanations []string          `json:"explanations"`
	Suggestions []string          `json:"suggestions"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// APIError represents an API error
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Meta represents response metadata
type Meta struct {
	Page       int `json:"page,omitempty"`
	PerPage    int `json:"per_page,omitempty"`
	Total      int `json:"total,omitempty"`
	TotalPages int `json:"total_pages,omitempty"`
}

// LoginRequest represents login request payload
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// LoginResponse represents login response
type LoginResponse struct {
	Token     string    `json:"token"`
	User      User      `json:"user"`
	ExpiresAt time.Time `json:"expires_at"`
}

// RegisterRequest represents user registration request
type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Username  string `json:"username" validate:"required,min=3,max=50"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Password  string `json:"password" validate:"required,min=6"`
}

// UpdateUserRequest represents user update request
type UpdateUserRequest struct {
	FirstName *string `json:"first_name,omitempty"`
	LastName  *string `json:"last_name,omitempty"`
	Email     *string `json:"email,omitempty" validate:"omitempty,email"`
	Username  *string `json:"username,omitempty" validate:"omitempty,min=3,max=50"`
}

// DetectionRequest represents anomaly detection request
type DetectionRequest struct {
	Data      map[string]interface{} `json:"data" validate:"required"`
	Algorithm string                 `json:"algorithm,omitempty"`
	Threshold float64                `json:"threshold,omitempty"`
}

// WebSocketMessage represents WebSocket message structure
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	UserID    uuid.UUID   `json:"user_id,omitempty"`
}

// HealthCheck represents system health status
type HealthCheck struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Timestamp time.Time         `json:"timestamp"`
	Services  map[string]string `json:"services"`
	Uptime    string            `json:"uptime"`
}