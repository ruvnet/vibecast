// Package errors defines custom error types and error handling utilities
package errors

import (
	"fmt"
	"net/http"
	"time"
)

// ErrorCode represents an error code
type ErrorCode string

// Predefined error codes
const (
	// General errors
	InternalError     ErrorCode = "INTERNAL_ERROR"
	BadRequest        ErrorCode = "BAD_REQUEST"
	Unauthorized      ErrorCode = "UNAUTHORIZED"
	Forbidden         ErrorCode = "FORBIDDEN"
	NotFound          ErrorCode = "NOT_FOUND"
	Conflict          ErrorCode = "CONFLICT"
	ValidationFailed  ErrorCode = "VALIDATION_FAILED"
	RateLimitExceeded ErrorCode = "RATE_LIMIT_EXCEEDED"
	
	// Authentication errors
	InvalidCredentials ErrorCode = "INVALID_CREDENTIALS"
	TokenExpired       ErrorCode = "TOKEN_EXPIRED"
	TokenInvalid       ErrorCode = "TOKEN_INVALID"
	RefreshTokenInvalid ErrorCode = "REFRESH_TOKEN_INVALID"
	
	// User errors
	UserNotFound      ErrorCode = "USER_NOT_FOUND"
	UserAlreadyExists ErrorCode = "USER_ALREADY_EXISTS"
	UserInactive      ErrorCode = "USER_INACTIVE"
	
	// Data errors
	DataNotFound      ErrorCode = "DATA_NOT_FOUND"
	DataCorrupted     ErrorCode = "DATA_CORRUPTED"
	DataTooLarge      ErrorCode = "DATA_TOO_LARGE"
	
	// Service errors
	ServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	Timeout           ErrorCode = "TIMEOUT"
	DatabaseError     ErrorCode = "DATABASE_ERROR"
	ExternalAPIError  ErrorCode = "EXTERNAL_API_ERROR"
	
	// Analysis errors
	AnalysisFailed    ErrorCode = "ANALYSIS_FAILED"
	InvalidAlgorithm  ErrorCode = "INVALID_ALGORITHM"
	InsufficientData  ErrorCode = "INSUFFICIENT_DATA"
)

// APIError represents a structured API error
type APIError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	Details    string                 `json:"details,omitempty"`
	Fields     map[string]string      `json:"fields,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	RequestID  string                 `json:"request_id,omitempty"`
	StackTrace string                 `json:"stack_trace,omitempty"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// HTTPStatus returns the appropriate HTTP status code for the error
func (e *APIError) HTTPStatus() int {
	switch e.Code {
	case BadRequest, ValidationFailed, InvalidAlgorithm, InsufficientData:
		return http.StatusBadRequest
	case Unauthorized, InvalidCredentials, TokenExpired, TokenInvalid, RefreshTokenInvalid:
		return http.StatusUnauthorized
	case Forbidden, UserInactive:
		return http.StatusForbidden
	case NotFound, UserNotFound, DataNotFound:
		return http.StatusNotFound
	case Conflict, UserAlreadyExists:
		return http.StatusConflict
	case DataTooLarge:
		return http.StatusRequestEntityTooLarge
	case RateLimitExceeded:
		return http.StatusTooManyRequests
	case ServiceUnavailable, DatabaseError, ExternalAPIError:
		return http.StatusServiceUnavailable
	case Timeout:
		return http.StatusRequestTimeout
	default:
		return http.StatusInternalServerError
	}
}

// WithField adds a field-specific error
func (e *APIError) WithField(field, message string) *APIError {
	if e.Fields == nil {
		e.Fields = make(map[string]string)
	}
	e.Fields[field] = message
	return e
}

// WithMetadata adds metadata to the error
func (e *APIError) WithMetadata(key string, value interface{}) *APIError {
	if e.Metadata == nil {
		e.Metadata = make(map[string]interface{})
	}
	e.Metadata[key] = value
	return e
}

// WithRequestID adds a request ID to the error
func (e *APIError) WithRequestID(requestID string) *APIError {
	e.RequestID = requestID
	return e
}

// WithStackTrace adds a stack trace to the error
func (e *APIError) WithStackTrace(stackTrace string) *APIError {
	e.StackTrace = stackTrace
	return e
}

// NewAPIError creates a new API error
func NewAPIError(code ErrorCode, message string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewAPIErrorWithDetails creates a new API error with details
func NewAPIErrorWithDetails(code ErrorCode, message, details string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}
}

// Predefined error constructors

func NewBadRequestError(message string) *APIError {
	return NewAPIError(BadRequest, message)
}

func NewUnauthorizedError(message string) *APIError {
	return NewAPIError(Unauthorized, message)
}

func NewForbiddenError(message string) *APIError {
	return NewAPIError(Forbidden, message)
}

func NewNotFoundError(message string) *APIError {
	return NewAPIError(NotFound, message)
}

func NewConflictError(message string) *APIError {
	return NewAPIError(Conflict, message)
}

func NewValidationError(message string) *APIError {
	return NewAPIError(ValidationFailed, message)
}

func NewInternalError(message string) *APIError {
	return NewAPIError(InternalError, message)
}

func NewServiceUnavailableError(message string) *APIError {
	return NewAPIError(ServiceUnavailable, message)
}

func NewRateLimitError(message string) *APIError {
	return NewAPIError(RateLimitExceeded, message)
}

func NewTimeoutError(message string) *APIError {
	return NewAPIError(Timeout, message)
}

// Domain-specific error constructors

func NewUserNotFoundError() *APIError {
	return NewAPIError(UserNotFound, "User not found")
}

func NewUserAlreadyExistsError() *APIError {
	return NewAPIError(UserAlreadyExists, "User already exists")
}

func NewInvalidCredentialsError() *APIError {
	return NewAPIError(InvalidCredentials, "Invalid credentials")
}

func NewTokenExpiredError() *APIError {
	return NewAPIError(TokenExpired, "Token has expired")
}

func NewTokenInvalidError() *APIError {
	return NewAPIError(TokenInvalid, "Invalid token")
}

func NewAnalysisFailedError(details string) *APIError {
	return NewAPIErrorWithDetails(AnalysisFailed, "Analysis failed", details)
}

func NewDatabaseError(details string) *APIError {
	return NewAPIErrorWithDetails(DatabaseError, "Database operation failed", details)
}

// IsAPIError checks if an error is an APIError
func IsAPIError(err error) (*APIError, bool) {
	apiErr, ok := err.(*APIError)
	return apiErr, ok
}

// WrapError wraps a standard error as an APIError
func WrapError(err error, code ErrorCode, message string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Details:   err.Error(),
		Timestamp: time.Now(),
	}
}

// ErrorHandler is a function that handles errors
type ErrorHandler func(error) *APIError

// DefaultErrorHandler provides default error handling
func DefaultErrorHandler(err error) *APIError {
	if apiErr, ok := IsAPIError(err); ok {
		return apiErr
	}
	
	// Handle common error types
	switch err.Error() {
	case "record not found":
		return NewNotFoundError("Resource not found")
	case "connection refused":
		return NewServiceUnavailableError("Service temporarily unavailable")
	default:
		return WrapError(err, InternalError, "Internal server error")
	}
}