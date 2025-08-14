// Package middleware provides rate limiting functionality
package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/models"
	"golang.org/x/time/rate"
)

// RateLimiter holds rate limiting configuration and state
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	config   config.RateLimitConfig
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(config config.RateLimitConfig) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		config:   config,
	}
}

// getLimiter gets or creates a rate limiter for a client
func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	if limiter, exists := rl.limiters[key]; exists {
		return limiter
	}

	// Create new limiter with configured rate and burst
	limiter := rate.NewLimiter(
		rate.Limit(rl.config.RequestsPerMinute)/60, // Convert per minute to per second
		rl.config.Burst,
	)
	rl.limiters[key] = limiter

	// Clean up old limiters periodically (simple approach)
	go func() {
		time.Sleep(10 * time.Minute)
		delete(rl.limiters, key)
	}()

	return limiter
}

// RateLimit middleware applies rate limiting per IP address
func RateLimit(config config.RateLimitConfig) gin.HandlerFunc {
	rl := NewRateLimiter(config)

	return func(c *gin.Context) {
		// Get client identifier (IP address)
		clientIP := c.ClientIP()
		
		// Get or create limiter for this client
		limiter := rl.getLimiter(clientIP)

		// Check if request is allowed
		if !limiter.Allow() {
			// Calculate retry after time
			retryAfter := time.Second
			
			c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
			c.Header("X-Rate-Limit-Limit", strconv.Itoa(config.RequestsPerMinute))
			c.Header("X-Rate-Limit-Remaining", "0")
			c.Header("X-Rate-Limit-Reset", strconv.FormatInt(time.Now().Add(retryAfter).Unix(), 10))

			c.JSON(http.StatusTooManyRequests, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "RATE_LIMIT_EXCEEDED",
					Message: "Rate limit exceeded. Please try again later.",
					Details: fmt.Sprintf("Limit: %d requests per minute", config.RequestsPerMinute),
				},
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		c.Header("X-Rate-Limit-Limit", strconv.Itoa(config.RequestsPerMinute))
		c.Header("X-Rate-Limit-Remaining", strconv.Itoa(config.Burst-1))
		c.Header("X-Rate-Limit-Reset", strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10))

		c.Next()
	}
}

// UserBasedRateLimit applies rate limiting per authenticated user
func UserBasedRateLimit(config config.RateLimitConfig) gin.HandlerFunc {
	rl := NewRateLimiter(config)

	return func(c *gin.Context) {
		// Get user ID from context (set by auth middleware)
		userID, exists := c.Get("user_id")
		if !exists {
			// Fall back to IP-based rate limiting for unauthenticated users
			userID = c.ClientIP()
		}

		key := fmt.Sprintf("user:%v", userID)
		limiter := rl.getLimiter(key)

		if !limiter.Allow() {
			retryAfter := time.Second

			c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
			c.JSON(http.StatusTooManyRequests, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "USER_RATE_LIMIT_EXCEEDED",
					Message: "User rate limit exceeded. Please try again later.",
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// EndpointRateLimit applies rate limiting per endpoint
func EndpointRateLimit(requestsPerMinute, burst int) gin.HandlerFunc {
	config := config.RateLimitConfig{
		RequestsPerMinute: requestsPerMinute,
		Burst:             burst,
	}
	rl := NewRateLimiter(config)

	return func(c *gin.Context) {
		key := fmt.Sprintf("endpoint:%s:%s", c.Request.Method, c.FullPath())
		limiter := rl.getLimiter(key)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, models.APIResponse{
				Success: false,
				Error: &models.APIError{
					Code:    "ENDPOINT_RATE_LIMIT_EXCEEDED",
					Message: "Endpoint rate limit exceeded. Please try again later.",
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}