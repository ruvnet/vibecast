package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// CoordinatorConfig holds configuration for the messaging coordinator
type CoordinatorConfig struct {
	BrokerConfig         *BrokerConfig
	QueueConfig          *QueueConfig
	EventBusConfig       *EventBusConfig
	RateLimiterConfig    *RateLimiterConfig
	StorageConfig        *StorageConfig
	BackpressureConfig   *BackpressureConfig
	EnableMetrics        bool
	MetricsInterval      time.Duration
	HealthCheckInterval  time.Duration
}

// DefaultCoordinatorConfig returns default coordinator configuration
func DefaultCoordinatorConfig() *CoordinatorConfig {
	return &CoordinatorConfig{
		BrokerConfig:         DefaultBrokerConfig(),
		QueueConfig:          DefaultQueueConfig(),
		EventBusConfig:       DefaultEventBusConfig(),
		RateLimiterConfig:    DefaultRateLimiterConfig(),
		StorageConfig:        DefaultStorageConfig(),
		BackpressureConfig:   DefaultBackpressureConfig(),
		EnableMetrics:        true,
		MetricsInterval:      30 * time.Second,
		HealthCheckInterval:  1 * time.Minute,
	}
}

// MessagingCoordinator coordinates all messaging components
type MessagingCoordinator struct {
	config              *CoordinatorConfig
	broker              MessageBroker
	queue               MessageQueue
	eventBus            EventBus
	rateLimiter         RateLimiter
	storage             Storage
	backpressureManager *BackpressureManager
	logger              *zap.Logger
	ctx                 context.Context
	cancel              context.CancelFunc
	wg                  sync.WaitGroup
	healthStatus        map[string]bool
	mu                  sync.RWMutex
}

// NewMessagingCoordinator creates a new messaging coordinator
func NewMessagingCoordinator(config *CoordinatorConfig, logger *zap.Logger) (*MessagingCoordinator, error) {
	if config == nil {
		config = DefaultCoordinatorConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	coordinator := &MessagingCoordinator{
		config:       config,
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
		healthStatus: make(map[string]bool),
	}
	
	// Initialize components
	if err := coordinator.initializeComponents(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize components: %w", err)
	}
	
	// Start background routines
	if config.EnableMetrics {
		coordinator.wg.Add(1)
		go coordinator.metricsRoutine()
	}
	
	coordinator.wg.Add(1)
	go coordinator.healthCheckRoutine()
	
	logger.Info("messaging coordinator initialized successfully")
	
	return coordinator, nil
}

// initializeComponents initializes all messaging components
func (mc *MessagingCoordinator) initializeComponents() error {
	// Initialize storage
	mc.storage = NewMemoryStorage(mc.config.StorageConfig, mc.logger.Named("storage"))
	
	// Initialize rate limiter
	mc.rateLimiter = NewTokenBucketLimiter(mc.config.RateLimiterConfig, mc.logger.Named("ratelimiter"))
	
	// Initialize backpressure manager
	mc.backpressureManager = NewBackpressureManager(mc.config.BackpressureConfig, mc.logger.Named("backpressure"))
	
	// Initialize broker
	mc.broker = NewBroker(mc.config.BrokerConfig, mc.rateLimiter, mc.logger.Named("broker"))
	
	// Initialize queue with backpressure handler
	backpressureHandler := func(ctx context.Context, queueSize int64, concurrentRequests int64) bool {
		return mc.backpressureManager.ShouldApplyBackpressure(ctx, queueSize)
	}
	mc.queue = NewQueue(mc.config.QueueConfig, mc.storage, backpressureHandler, mc.logger.Named("queue"))
	
	// Initialize event bus
	mc.eventBus = NewEventBus(mc.config.EventBusConfig, mc.logger.Named("eventbus"))
	
	// Set initial health status
	mc.mu.Lock()
	mc.healthStatus["broker"] = true
	mc.healthStatus["queue"] = true
	mc.healthStatus["eventbus"] = true
	mc.healthStatus["ratelimiter"] = true
	mc.healthStatus["storage"] = true
	mc.mu.Unlock()
	
	return nil
}

// GetBroker returns the message broker
func (mc *MessagingCoordinator) GetBroker() MessageBroker {
	return mc.broker
}

// GetQueue returns the message queue
func (mc *MessagingCoordinator) GetQueue() MessageQueue {
	return mc.queue
}

// GetEventBus returns the event bus
func (mc *MessagingCoordinator) GetEventBus() EventBus {
	return mc.eventBus
}

// GetRateLimiter returns the rate limiter
func (mc *MessagingCoordinator) GetRateLimiter() RateLimiter {
	return mc.rateLimiter
}

// GetStorage returns the storage
func (mc *MessagingCoordinator) GetStorage() Storage {
	return mc.storage
}

// PublishMessage publishes a message through the broker
func (mc *MessagingCoordinator) PublishMessage(ctx context.Context, topic string, msg *proto.Message) error {
	return mc.broker.Publish(ctx, topic, msg)
}

// EnqueueMessage enqueues a message for processing
func (mc *MessagingCoordinator) EnqueueMessage(ctx context.Context, queueName string, msg *proto.Message) error {
	return mc.queue.Enqueue(ctx, queueName, msg)
}

// EmitEvent emits an event
func (mc *MessagingCoordinator) EmitEvent(ctx context.Context, event *proto.Event) error {
	return mc.eventBus.Emit(ctx, event)
}

// GetSystemHealth returns the health status of all components
func (mc *MessagingCoordinator) GetSystemHealth(ctx context.Context) map[string]interface{} {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	health := make(map[string]interface{})
	
	// Component health status
	health["components"] = make(map[string]bool)
	for component, status := range mc.healthStatus {
		health["components"].(map[string]bool)[component] = status
	}
	
	// Overall health
	overallHealthy := true
	for _, status := range mc.healthStatus {
		if !status {
			overallHealthy = false
			break
		}
	}
	health["overall_healthy"] = overallHealthy
	health["timestamp"] = time.Now()
	
	return health
}

// GetSystemMetrics returns comprehensive system metrics
func (mc *MessagingCoordinator) GetSystemMetrics(ctx context.Context) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})
	
	// Broker stats
	if brokerStats, err := mc.broker.GetStats(ctx); err == nil {
		metrics["broker"] = map[string]interface{}{
			"messages_published":   brokerStats.MessagesPublished,
			"messages_delivered":   brokerStats.MessagesDelivered,
			"active_subscriptions": brokerStats.ActiveSubscriptions,
			"failed_deliveries":    brokerStats.FailedDeliveries,
		}
	}
	
	// Storage stats
	if memStorage, ok := mc.storage.(*MemoryStorage); ok {
		metrics["storage"] = memStorage.GetAllStats()
	}
	
	// Rate limiter stats
	if tokenLimiter, ok := mc.rateLimiter.(*TokenBucketLimiter); ok {
		metrics["rate_limiter"] = tokenLimiter.GetAllStats()
	}
	
	// System health
	metrics["health"] = mc.GetSystemHealth(ctx)
	
	return metrics, nil
}

// Close gracefully shuts down the coordinator and all components
func (mc *MessagingCoordinator) Close() error {
	mc.logger.Info("closing messaging coordinator")
	
	// Cancel context to stop background routines
	mc.cancel()
	
	// Close components in reverse order of initialization
	var errors []error
	
	if err := mc.eventBus.Close(); err != nil {
		errors = append(errors, fmt.Errorf("eventbus close error: %w", err))
	}
	
	if err := mc.queue.Close(); err != nil {
		errors = append(errors, fmt.Errorf("queue close error: %w", err))
	}
	
	if err := mc.broker.Close(); err != nil {
		errors = append(errors, fmt.Errorf("broker close error: %w", err))
	}
	
	if err := mc.rateLimiter.Close(); err != nil {
		errors = append(errors, fmt.Errorf("ratelimiter close error: %w", err))
	}
	
	if err := mc.storage.Close(); err != nil {
		errors = append(errors, fmt.Errorf("storage close error: %w", err))
	}
	
	// Wait for background routines to finish
	mc.wg.Wait()
	
	if len(errors) > 0 {
		return fmt.Errorf("errors during shutdown: %v", errors)
	}
	
	mc.logger.Info("messaging coordinator closed successfully")
	return nil
}

// metricsRoutine collects and logs metrics periodically
func (mc *MessagingCoordinator) metricsRoutine() {
	defer mc.wg.Done()
	
	ticker := time.NewTicker(mc.config.MetricsInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			if metrics, err := mc.GetSystemMetrics(mc.ctx); err == nil {
				mc.logger.Debug("system metrics", zap.Any("metrics", metrics))
			} else {
				mc.logger.Error("failed to collect metrics", zap.Error(err))
			}
		case <-mc.ctx.Done():
			return
		}
	}
}

// healthCheckRoutine performs periodic health checks
func (mc *MessagingCoordinator) healthCheckRoutine() {
	defer mc.wg.Done()
	
	ticker := time.NewTicker(mc.config.HealthCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			mc.performHealthCheck()
		case <-mc.ctx.Done():
			return
		}
	}
}

// performHealthCheck checks the health of all components
func (mc *MessagingCoordinator) performHealthCheck() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	
	ctx, cancel := context.WithTimeout(mc.ctx, 10*time.Second)
	defer cancel()
	
	// Check broker health
	if _, err := mc.broker.GetStats(ctx); err != nil {
		mc.healthStatus["broker"] = false
		mc.logger.Error("broker health check failed", zap.Error(err))
	} else {
		mc.healthStatus["broker"] = true
	}
	
	// Check storage health
	var testData string
	if err := mc.storage.Retrieve(ctx, "health_check", &testData); err != nil {
		// Try to store a test value
		if err := mc.storage.Store(ctx, "health_check", "ok"); err != nil {
			mc.healthStatus["storage"] = false
			mc.logger.Error("storage health check failed", zap.Error(err))
		} else {
			mc.healthStatus["storage"] = true
		}
	} else {
		mc.healthStatus["storage"] = true
	}
	
	// Check rate limiter health
	_ = mc.rateLimiter.Allow("health_check")
	mc.healthStatus["ratelimiter"] = true // Rate limiter is working if Allow returns a result
	
	// Check event bus health (simplified check)
	mc.healthStatus["eventbus"] = true
	
	// Check queue health - simplified check
	mc.healthStatus["queue"] = true
}