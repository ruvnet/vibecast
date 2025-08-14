package core

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// BackpressureConfig holds configuration for backpressure management
type BackpressureConfig struct {
	EnableBackpressure      bool
	MaxConcurrentRequests   int64
	MaxQueueSize           int64
	ResponseTimeThreshold   time.Duration
	ErrorRateThreshold      float64
	CheckInterval          time.Duration
	AdaptiveScaling        bool
}

// DefaultBackpressureConfig returns default backpressure configuration
func DefaultBackpressureConfig() *BackpressureConfig {
	return &BackpressureConfig{
		EnableBackpressure:     true,
		MaxConcurrentRequests:  1000,
		MaxQueueSize:          10000,
		ResponseTimeThreshold:  5 * time.Second,
		ErrorRateThreshold:    0.1, // 10%
		CheckInterval:         10 * time.Second,
		AdaptiveScaling:       true,
	}
}

// BackpressureHandler handles backpressure decisions
type BackpressureHandler func(ctx context.Context, queueSize int64, concurrentRequests int64) bool

// BackpressureManager manages system backpressure
type BackpressureManager struct {
	config             *BackpressureConfig
	concurrentRequests int64
	totalRequests      int64
	errorCount         int64
	lastCheck          time.Time
	responseTimeSum    int64
	responseTimeCount  int64
	mu                 sync.RWMutex
	logger             *zap.Logger
	handlers           []BackpressureHandler
}

// NewBackpressureManager creates a new backpressure manager
func NewBackpressureManager(config *BackpressureConfig, logger *zap.Logger) *BackpressureManager {
	bm := &BackpressureManager{
		config:    config,
		lastCheck: time.Now(),
		logger:    logger,
		handlers:  make([]BackpressureHandler, 0),
	}
	
	// Add default handler
	bm.handlers = append(bm.handlers, bm.defaultBackpressureHandler)
	
	return bm
}

// ShouldApplyBackpressure checks if backpressure should be applied
func (bm *BackpressureManager) ShouldApplyBackpressure(ctx context.Context, queueSize int64) bool {
	if !bm.config.EnableBackpressure {
		return false
	}

	concurrent := atomic.LoadInt64(&bm.concurrentRequests)
	
	// Check with all registered handlers
	for _, handler := range bm.handlers {
		if handler(ctx, queueSize, concurrent) {
			return true
		}
	}
	
	return false
}

// RecordRequest records the start of a request
func (bm *BackpressureManager) RecordRequest() {
	atomic.AddInt64(&bm.concurrentRequests, 1)
	atomic.AddInt64(&bm.totalRequests, 1)
}

// RecordResponse records the completion of a request
func (bm *BackpressureManager) RecordResponse(duration time.Duration, isError bool) {
	atomic.AddInt64(&bm.concurrentRequests, -1)
	
	// Record response time
	atomic.AddInt64(&bm.responseTimeSum, int64(duration))
	atomic.AddInt64(&bm.responseTimeCount, 1)
	
	// Record error if applicable
	if isError {
		atomic.AddInt64(&bm.errorCount, 1)
	}
}

// AddHandler adds a custom backpressure handler
func (bm *BackpressureManager) AddHandler(handler BackpressureHandler) {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	bm.handlers = append(bm.handlers, handler)
}

// GetMetrics returns current backpressure metrics
func (bm *BackpressureManager) GetMetrics() BackpressureMetrics {
	concurrent := atomic.LoadInt64(&bm.concurrentRequests)
	total := atomic.LoadInt64(&bm.totalRequests)
	errors := atomic.LoadInt64(&bm.errorCount)
	responseSum := atomic.LoadInt64(&bm.responseTimeSum)
	responseCount := atomic.LoadInt64(&bm.responseTimeCount)
	
	var avgResponseTime time.Duration
	if responseCount > 0 {
		avgResponseTime = time.Duration(responseSum / responseCount)
	}
	
	var errorRate float64
	if total > 0 {
		errorRate = float64(errors) / float64(total)
	}
	
	return BackpressureMetrics{
		ConcurrentRequests: concurrent,
		TotalRequests:     total,
		ErrorCount:        errors,
		ErrorRate:         errorRate,
		AvgResponseTime:   avgResponseTime,
	}
}

// defaultBackpressureHandler is the default backpressure decision handler
func (bm *BackpressureManager) defaultBackpressureHandler(ctx context.Context, queueSize int64, concurrentRequests int64) bool {
	// Check concurrent requests limit
	if concurrentRequests >= bm.config.MaxConcurrentRequests {
		bm.logger.Warn("Applying backpressure: concurrent requests limit exceeded",
			zap.Int64("concurrent", concurrentRequests),
			zap.Int64("limit", bm.config.MaxConcurrentRequests))
		return true
	}
	
	// Check queue size limit
	if queueSize >= bm.config.MaxQueueSize {
		bm.logger.Warn("Applying backpressure: queue size limit exceeded",
			zap.Int64("queue_size", queueSize),
			zap.Int64("limit", bm.config.MaxQueueSize))
		return true
	}
	
	// Check error rate and response time periodically
	now := time.Now()
	if now.Sub(bm.lastCheck) >= bm.config.CheckInterval {
		bm.mu.Lock()
		bm.lastCheck = now
		bm.mu.Unlock()
		
		metrics := bm.GetMetrics()
		
		// Check error rate
		if metrics.ErrorRate >= bm.config.ErrorRateThreshold {
			bm.logger.Warn("Applying backpressure: error rate threshold exceeded",
				zap.Float64("error_rate", metrics.ErrorRate),
				zap.Float64("threshold", bm.config.ErrorRateThreshold))
			return true
		}
		
		// Check response time
		if metrics.AvgResponseTime >= bm.config.ResponseTimeThreshold {
			bm.logger.Warn("Applying backpressure: response time threshold exceeded",
				zap.Duration("avg_response_time", metrics.AvgResponseTime),
				zap.Duration("threshold", bm.config.ResponseTimeThreshold))
			return true
		}
	}
	
	return false
}

// BackpressureMetrics holds backpressure metrics
type BackpressureMetrics struct {
	ConcurrentRequests int64
	TotalRequests     int64
	ErrorCount        int64
	ErrorRate         float64
	AvgResponseTime   time.Duration
}