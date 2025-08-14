package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// RateLimiterConfig holds configuration for the rate limiter
type RateLimiterConfig struct {
	DefaultLimit      int
	DefaultWindow     time.Duration
	MaxKeys           int
	CleanupInterval   time.Duration
	BurstMultiplier   float64
	EnableBackpressure bool
}

// DefaultRateLimiterConfig returns default rate limiter configuration
func DefaultRateLimiterConfig() *RateLimiterConfig {
	return &RateLimiterConfig{
		DefaultLimit:       1000,
		DefaultWindow:      1 * time.Minute,
		MaxKeys:           10000,
		CleanupInterval:   5 * time.Minute,
		BurstMultiplier:   1.5,
		EnableBackpressure: true,
	}
}

// rateLimitBucket represents a rate limit bucket
type rateLimitBucket struct {
	Limit      int
	Window     time.Duration
	Count      int
	WindowStart time.Time
	LastAccess  time.Time
}

// TokenBucketLimiter implements the RateLimiter interface using token bucket algorithm
type TokenBucketLimiter struct {
	config         *RateLimiterConfig
	buckets        map[string]*rateLimitBucket
	customLimits   map[string]int // Custom limits per key pattern
	mu             sync.RWMutex
	logger         *zap.Logger
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
}

// NewTokenBucketLimiter creates a new token bucket rate limiter
func NewTokenBucketLimiter(config *RateLimiterConfig, logger *zap.Logger) *TokenBucketLimiter {
	if config == nil {
		config = DefaultRateLimiterConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	limiter := &TokenBucketLimiter{
		config:       config,
		buckets:      make(map[string]*rateLimitBucket),
		customLimits: make(map[string]int),
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
	}
	
	// Start cleanup routine
	limiter.wg.Add(1)
	go limiter.cleanupRoutine()
	
	return limiter
}

// Allow checks if an operation is allowed (interface method)
func (tbl *TokenBucketLimiter) Allow(key string) bool {
	allowed, _, _ := tbl.AllowWithDetails(context.Background(), key)
	return allowed
}

// AllowWithDetails provides detailed rate limiting information
func (tbl *TokenBucketLimiter) AllowWithDetails(ctx context.Context, key string) (bool, *proto.RateLimitInfo, error) {
	if key == "" {
		return false, nil, fmt.Errorf("key cannot be empty")
	}
	
	tbl.mu.Lock()
	defer tbl.mu.Unlock()
	
	// Check if we've exceeded max keys
	if len(tbl.buckets) >= tbl.config.MaxKeys {
		// Clean up old buckets first
		tbl.performCleanup()
		
		// Check again after cleanup
		if len(tbl.buckets) >= tbl.config.MaxKeys {
			return false, nil, fmt.Errorf("rate limiter capacity exceeded")
		}
	}
	
	now := time.Now()
	bucket, exists := tbl.buckets[key]
	
	if !exists {
		// Create new bucket
		limit := tbl.getLimitForKey(key)
		bucket = &rateLimitBucket{
			Limit:       limit,
			Window:      tbl.config.DefaultWindow,
			Count:       0,
			WindowStart: now,
			LastAccess:  now,
		}
		tbl.buckets[key] = bucket
	}
	
	// Update last access
	bucket.LastAccess = now
	
	// Check if we need to reset the window
	if now.Sub(bucket.WindowStart) >= bucket.Window {
		bucket.Count = 0
		bucket.WindowStart = now
	}
	
	// Check if request is allowed
	allowed := bucket.Count < bucket.Limit
	if allowed {
		bucket.Count++
	}
	
	// Calculate remaining and reset time
	remaining := bucket.Limit - bucket.Count
	if remaining < 0 {
		remaining = 0
	}
	
	resetTime := bucket.WindowStart.Add(bucket.Window)
	
	rateLimitInfo := &proto.RateLimitInfo{
		Key:       key,
		Limit:     int64(bucket.Limit),
		Remaining: int64(remaining),
		ResetTime: resetTime.Unix(),
	}
	
	if !allowed {
		tbl.logger.Debug("rate limit exceeded",
			zap.String("key", key),
			zap.Int("limit", bucket.Limit),
			zap.Int("count", bucket.Count))
	}
	
	return allowed, rateLimitInfo, nil
}

// Reset resets the rate limit for a key
func (tbl *TokenBucketLimiter) Reset(ctx context.Context, key string) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}
	
	tbl.mu.Lock()
	defer tbl.mu.Unlock()
	
	bucket, exists := tbl.buckets[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}
	
	bucket.Count = 0
	bucket.WindowStart = time.Now()
	
	tbl.logger.Debug("rate limit reset",
		zap.String("key", key))
	
	return nil
}

// GetInfo returns rate limit information
func (tbl *TokenBucketLimiter) GetInfo(ctx context.Context, key string) (*proto.RateLimitInfo, error) {
	if key == "" {
		return nil, fmt.Errorf("key cannot be empty")
	}
	
	tbl.mu.RLock()
	defer tbl.mu.RUnlock()
	
	bucket, exists := tbl.buckets[key]
	if !exists {
		// Return default info for non-existent key
		limit := tbl.getLimitForKey(key)
		return &proto.RateLimitInfo{
			Key:       key,
			Limit:     int64(limit),
			Remaining: int64(limit),
			ResetTime: time.Now().Add(tbl.config.DefaultWindow).Unix(),
		}, nil
	}
	
	now := time.Now()
	
	// Check if window has expired
	remaining := bucket.Limit - bucket.Count
	if now.Sub(bucket.WindowStart) >= bucket.Window {
		remaining = bucket.Limit
	}
	
	if remaining < 0 {
		remaining = 0
	}
	
	resetTime := bucket.WindowStart.Add(bucket.Window)
	
	return &proto.RateLimitInfo{
		Key:       key,
		Limit:     int64(bucket.Limit),
		Remaining: int64(remaining),
		ResetTime: resetTime.Unix(),
	}, nil
}

// Close closes the rate limiter
func (tbl *TokenBucketLimiter) Close() error {
	tbl.logger.Info("closing rate limiter")
	
	// Cancel context to stop routines
	tbl.cancel()
	
	// Wait for all goroutines to finish
	tbl.wg.Wait()
	
	tbl.logger.Info("rate limiter closed")
	return nil
}

// SetCustomLimit sets a custom limit for a key pattern
func (tbl *TokenBucketLimiter) SetCustomLimit(keyPattern string, limit int) {
	tbl.mu.Lock()
	defer tbl.mu.Unlock()
	
	tbl.customLimits[keyPattern] = limit
	
	tbl.logger.Info("custom rate limit set",
		zap.String("pattern", keyPattern),
		zap.Int("limit", limit))
}

// RemoveCustomLimit removes a custom limit
func (tbl *TokenBucketLimiter) RemoveCustomLimit(keyPattern string) {
	tbl.mu.Lock()
	defer tbl.mu.Unlock()
	
	delete(tbl.customLimits, keyPattern)
	
	tbl.logger.Info("custom rate limit removed",
		zap.String("pattern", keyPattern))
}

// getLimitForKey returns the appropriate limit for a key
func (tbl *TokenBucketLimiter) getLimitForKey(key string) int {
	// Check for custom limits (simplified pattern matching)
	for pattern, limit := range tbl.customLimits {
		// Simple prefix matching - in production, use regex or glob patterns
		if len(key) >= len(pattern) && key[:len(pattern)] == pattern {
			return limit
		}
	}
	
	return tbl.config.DefaultLimit
}

// cleanupRoutine performs periodic cleanup
func (tbl *TokenBucketLimiter) cleanupRoutine() {
	defer tbl.wg.Done()
	
	ticker := time.NewTicker(tbl.config.CleanupInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			tbl.mu.Lock()
			tbl.performCleanup()
			tbl.mu.Unlock()
		case <-tbl.ctx.Done():
			return
		}
	}
}

// performCleanup removes old unused buckets (called with lock held)
func (tbl *TokenBucketLimiter) performCleanup() {
	now := time.Now()
	cleanupThreshold := 10 * time.Minute // Remove buckets not accessed for 10 minutes
	
	keysToDelete := make([]string, 0)
	
	for key, bucket := range tbl.buckets {
		if now.Sub(bucket.LastAccess) > cleanupThreshold {
			keysToDelete = append(keysToDelete, key)
		}
	}
	
	for _, key := range keysToDelete {
		delete(tbl.buckets, key)
	}
	
	if len(keysToDelete) > 0 {
		tbl.logger.Debug("cleaned up unused rate limit buckets",
			zap.Int("count", len(keysToDelete)))
	}
}

// GetStats returns rate limiter statistics for a specific key
func (tbl *TokenBucketLimiter) GetStats(key string) (*proto.RateLimitInfo, error) {
	tbl.mu.RLock()
	defer tbl.mu.RUnlock()
	
	bucket, exists := tbl.buckets[key]
	if !exists {
		// Return default limits info
		return &proto.RateLimitInfo{
			Key:       key,
			Limit:     int64(tbl.config.DefaultLimit),
			Remaining: int64(tbl.config.DefaultLimit),
			ResetTime: time.Now().Add(tbl.config.DefaultWindow).Unix(),
		}, nil
	}
	
	return &proto.RateLimitInfo{
		Key:       key,
		Limit:     int64(bucket.Limit),
		Remaining: int64(bucket.Limit - bucket.Count),
		ResetTime: bucket.WindowStart.Add(bucket.Window).Unix(),
	}, nil
}

// GetAllStats returns overall rate limiter statistics
func (tbl *TokenBucketLimiter) GetAllStats() map[string]interface{} {
	tbl.mu.RLock()
	defer tbl.mu.RUnlock()
	
	stats := map[string]interface{}{
		"active_keys":    len(tbl.buckets),
		"max_keys":       tbl.config.MaxKeys,
		"default_limit":  tbl.config.DefaultLimit,
		"default_window": tbl.config.DefaultWindow.String(),
		"custom_limits":  len(tbl.customLimits),
	}
	
	return stats
}

