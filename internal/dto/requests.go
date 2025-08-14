// Package dto contains Data Transfer Objects for API requests and responses
package dto

import (
	"time"
	"github.com/google/uuid"
)

// BaseRequest contains common request fields
type BaseRequest struct {
	RequestID string `json:"request_id,omitempty"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

// PaginationRequest contains pagination parameters
type PaginationRequest struct {
	Page     int    `json:"page" form:"page" validate:"min=1"`
	Limit    int    `json:"limit" form:"limit" validate:"min=1,max=100"`
	Sort     string `json:"sort" form:"sort"`
	Order    string `json:"order" form:"order" validate:"oneof=asc desc"`
	Search   string `json:"search,omitempty" form:"search"`
}

// FilterRequest contains filtering parameters
type FilterRequest struct {
	Filters map[string]interface{} `json:"filters,omitempty"`
	DateFrom *time.Time `json:"date_from,omitempty"`
	DateTo   *time.Time `json:"date_to,omitempty"`
}

// UserCreateRequest represents user creation request
type UserCreateRequest struct {
	BaseRequest
	Email     string `json:"email" validate:"required,email,max=255"`
	Username  string `json:"username" validate:"required,min=3,max=50,alphanum"`
	FirstName string `json:"first_name" validate:"required,min=1,max=100"`
	LastName  string `json:"last_name" validate:"required,min=1,max=100"`
	Password  string `json:"password" validate:"required,min=8,max=100"`
	Role      string `json:"role,omitempty" validate:"omitempty,oneof=user admin"`
}

// UserUpdateRequest represents user update request
type UserUpdateRequest struct {
	BaseRequest
	FirstName *string `json:"first_name,omitempty" validate:"omitempty,min=1,max=100"`
	LastName  *string `json:"last_name,omitempty" validate:"omitempty,min=1,max=100"`
	Email     *string `json:"email,omitempty" validate:"omitempty,email,max=255"`
	Username  *string `json:"username,omitempty" validate:"omitempty,min=3,max=50,alphanum"`
	Role      *string `json:"role,omitempty" validate:"omitempty,oneof=user admin"`
	IsActive  *bool   `json:"is_active,omitempty"`
}

// AuthLoginRequest represents login request
type AuthLoginRequest struct {
	BaseRequest
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	RememberMe bool `json:"remember_me,omitempty"`
}

// AuthRefreshRequest represents token refresh request
type AuthRefreshRequest struct {
	BaseRequest
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// PasswordChangeRequest represents password change request
type PasswordChangeRequest struct {
	BaseRequest
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=100"`
}

// AnomalyDetectionRequest represents anomaly detection request
type AnomalyDetectionRequest struct {
	BaseRequest
	Data      map[string]interface{} `json:"data" validate:"required"`
	Algorithm string                 `json:"algorithm,omitempty" validate:"omitempty,oneof=isolation_forest one_class_svm local_outlier_factor"`
	Threshold *float64               `json:"threshold,omitempty" validate:"omitempty,min=0,max=1"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

// TextAnalysisRequest represents text analysis request
type TextAnalysisRequest struct {
	BaseRequest
	Text     string            `json:"text" validate:"required,min=1,max=10000"`
	Language string            `json:"language,omitempty" validate:"omitempty,len=2"`
	Options  map[string]string `json:"options,omitempty"`
	Priority int               `json:"priority,omitempty" validate:"omitempty,min=1,max=10"`
}

// BatchAnalysisRequest represents batch analysis request
type BatchAnalysisRequest struct {
	BaseRequest
	Items []TextAnalysisRequest `json:"items" validate:"required,min=1,max=100,dive"`
}

// WebSocketConnectionRequest represents WebSocket connection request
type WebSocketConnectionRequest struct {
	Token      string            `json:"token" validate:"required"`
	Topics     []string          `json:"topics,omitempty"`
	Filters    map[string]string `json:"filters,omitempty"`
	ClientInfo map[string]string `json:"client_info,omitempty"`
}

// NotificationRequest represents notification request
type NotificationRequest struct {
	BaseRequest
	UserID  uuid.UUID              `json:"user_id" validate:"required"`
	Type    string                 `json:"type" validate:"required,oneof=email sms push websocket"`
	Title   string                 `json:"title" validate:"required,max=255"`
	Message string                 `json:"message" validate:"required,max=1000"`
	Data    map[string]interface{} `json:"data,omitempty"`
	ScheduledAt *time.Time         `json:"scheduled_at,omitempty"`
}

// ConfigUpdateRequest represents configuration update request
type ConfigUpdateRequest struct {
	BaseRequest
	Key   string      `json:"key" validate:"required,max=255"`
	Value interface{} `json:"value" validate:"required"`
}

// SystemActionRequest represents system action request
type SystemActionRequest struct {
	BaseRequest
	Action string                 `json:"action" validate:"required,oneof=restart shutdown backup restore"`
	Params map[string]interface{} `json:"params,omitempty"`
	Force  bool                   `json:"force,omitempty"`
}

// ReportGenerationRequest represents report generation request
type ReportGenerationRequest struct {
	BaseRequest
	Type      string                 `json:"type" validate:"required,oneof=anomaly_summary user_activity system_health"`
	DateFrom  time.Time              `json:"date_from" validate:"required"`
	DateTo    time.Time              `json:"date_to" validate:"required"`
	Format    string                 `json:"format" validate:"required,oneof=pdf csv json"`
	Filters   map[string]interface{} `json:"filters,omitempty"`
	UserID    *uuid.UUID             `json:"user_id,omitempty"`
}

// BulkOperationRequest represents bulk operation request
type BulkOperationRequest struct {
	BaseRequest
	Operation string        `json:"operation" validate:"required,oneof=create update delete"`
	Items     []interface{} `json:"items" validate:"required,min=1,max=1000"`
	Options   map[string]interface{} `json:"options,omitempty"`
}