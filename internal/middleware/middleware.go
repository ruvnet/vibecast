package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// RequestIDKey is the key for request ID in context
type RequestIDKey struct{}

// CORS middleware to handle Cross-Origin Resource Sharing
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*") // In production, be more specific
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Logging middleware to log HTTP requests
func Logging(logger *zap.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create a response writer that captures the status code
			wrapped := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// Get request ID from context
			requestID := GetRequestID(r.Context())

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start)

			logger.Info("HTTP Request",
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.String("query", r.URL.RawQuery),
				zap.Int("status", wrapped.statusCode),
				zap.Duration("duration", duration),
				zap.String("user_agent", r.UserAgent()),
				zap.String("remote_addr", r.RemoteAddr),
				zap.String("request_id", requestID),
			)
		})
	}
}

// RequestID middleware to add unique request IDs
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if request ID already exists in headers
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			// Generate a new request ID
			requestID = generateRequestID()
		}

		// Add request ID to response headers
		w.Header().Set("X-Request-ID", requestID)

		// Add request ID to context
		ctx := context.WithValue(r.Context(), RequestIDKey{}, requestID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

// RateLimit middleware to limit requests per client
func RateLimit(requestsPerSecond int) func(http.Handler) http.Handler {
	// Simple in-memory rate limiter (use Redis in production)
	clientLimits := make(map[string]*rateLimiter)
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientIP := getClientIP(r)
			
			// Get or create rate limiter for this client
			limiter, exists := clientLimits[clientIP]
			if !exists {
				limiter = newRateLimiter(requestsPerSecond)
				clientLimits[clientIP] = limiter
			}

			if !limiter.allow() {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Authentication middleware
func Authentication(secretKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip authentication for health check and public endpoints
			if r.URL.Path == "/api/v1/health" || r.Method == "OPTIONS" {
				next.ServeHTTP(w, r)
				return
			}

			// Get authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// In a real implementation, validate JWT token here
			// For now, just check if header is present
			if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			// Extract token (simplified)
			// token := authHeader[7:]
			// In production: validate JWT, extract user info, add to context

			next.ServeHTTP(w, r)
		})
	}
}

// Recovery middleware to handle panics
func Recovery(logger *zap.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					requestID := GetRequestID(r.Context())
					
					logger.Error("Panic recovered",
						zap.Any("error", err),
						zap.String("method", r.Method),
						zap.String("path", r.URL.Path),
						zap.String("request_id", requestID),
					)

					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// Security headers middleware
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")

		next.ServeHTTP(w, r)
	})
}

// Helper types and functions

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Simple rate limiter implementation
type rateLimiter struct {
	tokens    int
	capacity  int
	refillRate int
	lastRefill time.Time
}

func newRateLimiter(requestsPerSecond int) *rateLimiter {
	return &rateLimiter{
		tokens:     requestsPerSecond,
		capacity:   requestsPerSecond,
		refillRate: requestsPerSecond,
		lastRefill: time.Now(),
	}
}

func (rl *rateLimiter) allow() bool {
	now := time.Now()
	elapsed := now.Sub(rl.lastRefill)
	
	// Refill tokens
	tokensToAdd := int(elapsed.Seconds()) * rl.refillRate
	if tokensToAdd > 0 {
		rl.tokens += tokensToAdd
		if rl.tokens > rl.capacity {
			rl.tokens = rl.capacity
		}
		rl.lastRefill = now
	}

	// Check if we have tokens
	if rl.tokens > 0 {
		rl.tokens--
		return true
	}

	return false
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), time.Now().Nanosecond())
}

// GetRequestID retrieves the request ID from context
func GetRequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value(RequestIDKey{}).(string); ok {
		return requestID
	}
	return ""
}

// getClientIP extracts the client IP address
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		return xff
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to remote address
	return r.RemoteAddr
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword validates a password against its hash
func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}