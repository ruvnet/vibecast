package dto

import (
	"time"
	"github.com/google/uuid"
	"github.com/ruvnet/alienator/internal/models"
)

// BaseResponse contains common response fields
type BaseResponse struct {
	Success   bool      `json:"success"`
	Message   string    `json:"message,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"request_id,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	BaseResponse
	Error *ErrorDetail `json:"error,omitempty"`
}

// ErrorDetail contains detailed error information
type ErrorDetail struct {
	Code     string            `json:"code"`
	Message  string            `json:"message"`
	Details  string            `json:"details,omitempty"`
	Fields   map[string]string `json:"fields,omitempty"`
	Trace    string            `json:"trace,omitempty"`
}

// ValidationErrorResponse represents validation error response
type ValidationErrorResponse struct {
	ErrorResponse
	ValidationErrors []ValidationError `json:"validation_errors,omitempty"`
}

// ValidationError represents a single validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	BaseResponse
	Data       interface{} `json:"data"`
	Pagination *Pagination `json:"pagination"`
}

// Pagination contains pagination metadata
type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// UserResponse represents user data response
type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	BaseResponse
	User         UserResponse `json:"user"`
	Token        string       `json:"token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresAt    time.Time    `json:"expires_at"`
	TokenType    string       `json:"token_type"`
}

// RefreshTokenResponse represents refresh token response
type RefreshTokenResponse struct {
	BaseResponse
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// AnomalyDetectionResponse represents anomaly detection response
type AnomalyDetectionResponse struct {
	BaseResponse
	Result *models.DetectionResult `json:"result"`
}

// TextAnalysisResponse represents text analysis response
type TextAnalysisResponse struct {
	BaseResponse
	Result *models.AnomalyResult `json:"result"`
	Duration time.Duration `json:"duration"`
}

// BatchAnalysisResponse represents batch analysis response
type BatchAnalysisResponse struct {
	BaseResponse
	Results     []TextAnalysisResponse `json:"results"`
	Total       int                    `json:"total"`
	Success     int                    `json:"success"`
	Failed      int                    `json:"failed"`
	Duration    time.Duration          `json:"duration"`
}

// HealthResponse represents health check response
type HealthResponse struct {
	BaseResponse
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"`
	Services  map[string]string `json:"services"`
	Metrics   map[string]interface{} `json:"metrics,omitempty"`
}

// MetricsResponse represents metrics response
type MetricsResponse struct {
	BaseResponse
	Metrics map[string]interface{} `json:"metrics"`
	Period  string                 `json:"period"`
}

// WebSocketMessage represents WebSocket message structure
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	UserID    *uuid.UUID  `json:"user_id,omitempty"`
	EventID   string      `json:"event_id,omitempty"`
}

// NotificationResponse represents notification response
type NotificationResponse struct {
	BaseResponse
	NotificationID uuid.UUID `json:"notification_id"`
	Status         string    `json:"status"`
	DeliveredAt    *time.Time `json:"delivered_at,omitempty"`
}

// ConfigResponse represents configuration response
type ConfigResponse struct {
	BaseResponse
	Key     string      `json:"key"`
	Value   interface{} `json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SystemActionResponse represents system action response
type SystemActionResponse struct {
	BaseResponse
	Action    string                 `json:"action"`
	Status    string                 `json:"status"`
	Result    map[string]interface{} `json:"result,omitempty"`
	StartedAt time.Time              `json:"started_at"`
	CompletedAt *time.Time           `json:"completed_at,omitempty"`
}

// ReportResponse represents report generation response
type ReportResponse struct {
	BaseResponse
	ReportID    uuid.UUID `json:"report_id"`
	DownloadURL string    `json:"download_url"`
	Format      string    `json:"format"`
	Size        int64     `json:"size"`
	GeneratedAt time.Time `json:"generated_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// BulkOperationResponse represents bulk operation response
type BulkOperationResponse struct {
	BaseResponse
	Operation string                   `json:"operation"`
	Total     int                      `json:"total"`
	Success   int                      `json:"success"`
	Failed    int                      `json:"failed"`
	Results   []BulkOperationResult    `json:"results,omitempty"`
	Errors    []BulkOperationError     `json:"errors,omitempty"`
	Duration  time.Duration            `json:"duration"`
}

// BulkOperationResult represents individual bulk operation result
type BulkOperationResult struct {
	Index  int         `json:"index"`
	ID     interface{} `json:"id,omitempty"`
	Status string      `json:"status"`
}

// BulkOperationError represents individual bulk operation error
type BulkOperationError struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

// FileUploadResponse represents file upload response
type FileUploadResponse struct {
	BaseResponse
	FileID   uuid.UUID `json:"file_id"`
	Filename string    `json:"filename"`
	Size     int64     `json:"size"`
	URL      string    `json:"url"`
	MimeType string    `json:"mime_type"`
}

// ListResponse represents a generic list response
type ListResponse struct {
	BaseResponse
	Data  interface{} `json:"data"`
	Count int         `json:"count"`
}

// StatusResponse represents a simple status response
type StatusResponse struct {
	BaseResponse
	Status string                 `json:"status"`
	Data   map[string]interface{} `json:"data,omitempty"`
}