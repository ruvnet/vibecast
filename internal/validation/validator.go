// Package validation provides request validation utilities
package validation

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/ruvnet/alienator/internal/dto"
)

// Validator wraps the validator instance
type Validator struct {
	validator *validator.Validate
}

// NewValidator creates a new validator instance
func NewValidator() *Validator {
	v := validator.New()
	
	// Register custom validators
	v.RegisterValidation("datetime", validateDateTime)
	v.RegisterValidation("uuid", validateUUID)
	v.RegisterValidation("alphanum_underscore", validateAlphanumUnderscore)
	v.RegisterValidation("json", validateJSON)
	v.RegisterValidation("password_strength", validatePasswordStrength)
	v.RegisterValidation("phone", validatePhone)
	v.RegisterValidation("url_path", validateURLPath)
	
	// Register field name tag
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})

	return &Validator{validator: v}
}

// ValidateStruct validates a struct
func (v *Validator) ValidateStruct(s interface{}) error {
	err := v.validator.Struct(s)
	if err == nil {
		return nil
	}

	// Convert validation errors to our format
	var validationErrors []dto.ValidationError
	for _, err := range err.(validator.ValidationErrors) {
		validationErrors = append(validationErrors, dto.ValidationError{
			Field:   err.Field(),
			Message: getErrorMessage(err),
			Value:   err.Value(),
		})
	}

	return &ValidationError{
		Errors: validationErrors,
	}
}

// ValidateVar validates a single variable
func (v *Validator) ValidateVar(field interface{}, tag string) error {
	return v.validator.Var(field, tag)
}

// ValidationError represents validation errors
type ValidationError struct {
	Errors []dto.ValidationError
}

func (e *ValidationError) Error() string {
	if len(e.Errors) == 0 {
		return "validation failed"
	}
	
	var messages []string
	for _, err := range e.Errors {
		messages = append(messages, fmt.Sprintf("%s: %s", err.Field, err.Message))
	}
	
	return fmt.Sprintf("validation failed: %s", strings.Join(messages, ", "))
}

// getErrorMessage returns a human-readable error message
func getErrorMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "This field is required"
	case "email":
		return "Invalid email format"
	case "min":
		return fmt.Sprintf("Minimum length is %s", fe.Param())
	case "max":
		return fmt.Sprintf("Maximum length is %s", fe.Param())
	case "len":
		return fmt.Sprintf("Length must be %s", fe.Param())
	case "alphanum":
		return "Only alphanumeric characters are allowed"
	case "oneof":
		return fmt.Sprintf("Must be one of: %s", fe.Param())
	case "uuid":
		return "Invalid UUID format"
	case "datetime":
		return "Invalid datetime format"
	case "password_strength":
		return "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
	case "phone":
		return "Invalid phone number format"
	case "url_path":
		return "Invalid URL path format"
	case "json":
		return "Invalid JSON format"
	default:
		return fmt.Sprintf("Validation failed on '%s' tag", fe.Tag())
	}
}

// Custom validation functions

func validateDateTime(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true // Allow empty values, use required tag for mandatory fields
	}
	
	// Try parsing different datetime formats
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	
	for _, format := range formats {
		if _, err := time.Parse(format, value); err == nil {
			return true
		}
	}
	
	return false
}

func validateUUID(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true // Allow empty values
	}
	
	// Simple UUID v4 validation
	if len(value) != 36 {
		return false
	}
	
	if value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	
	return true
}

func validateAlphanumUnderscore(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	for _, char := range value {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || 
			 (char >= '0' && char <= '9') || char == '_') {
			return false
		}
	}
	return true
}

func validateJSON(fl validator.FieldLevel) bool {
	// This is a simplified JSON validation
	// In a real implementation, you might want to use json.Valid
	value := fl.Field().String()
	return strings.HasPrefix(value, "{") && strings.HasSuffix(value, "}")
}

func validatePasswordStrength(fl validator.FieldLevel) bool {
	password := fl.Field().String()
	if len(password) < 8 {
		return false
	}
	
	hasUpper := false
	hasLower := false
	hasNumber := false
	hasSpecial := false
	
	for _, char := range password {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasNumber = true
		case strings.ContainsRune("!@#$%^&*()_+-=[]{}|;:,.<>?", char):
			hasSpecial = true
		}
	}
	
	return hasUpper && hasLower && hasNumber && hasSpecial
}

func validatePhone(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true
	}
	
	// Simple phone validation (can be enhanced based on requirements)
	if len(value) < 10 || len(value) > 15 {
		return false
	}
	
	for _, char := range value {
		if !((char >= '0' && char <= '9') || char == '+' || char == '-' || char == ' ' || char == '(' || char == ')') {
			return false
		}
	}
	
	return true
}

func validateURLPath(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true
	}
	
	// Basic URL path validation
	return strings.HasPrefix(value, "/") && !strings.Contains(value, "..")
}