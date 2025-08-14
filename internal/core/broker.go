package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// BrokerConfig holds configuration for the message broker
type BrokerConfig struct {
	MaxSubscriptions int
	BufferSize       int
	DeliveryTimeout  time.Duration
	RetryAttempts    int
	RetryDelay       time.Duration
}

// DefaultBrokerConfig returns default broker configuration
func DefaultBrokerConfig() *BrokerConfig {
	return &BrokerConfig{
		MaxSubscriptions: 10000,
		BufferSize:       1000,
		DeliveryTimeout:  30 * time.Second,
		RetryAttempts:    3,
		RetryDelay:       1 * time.Second,
	}
}

// subscription represents an internal subscription
type subscription struct {
	ID      string
	Topic   string
	Handler MessageHandler
	Buffer  chan *proto.Message
	Active  bool
	Created time.Time
}

// Broker implements the MessageBroker interface
type Broker struct {
	config        *BrokerConfig
	subscriptions map[string]*subscription
	topics        map[string][]*subscription
	stats         *proto.BrokerStats
	mu            sync.RWMutex
	logger        *zap.Logger
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	rateLimiter   RateLimiter
}

// NewBroker creates a new message broker
func NewBroker(config *BrokerConfig, rateLimiter RateLimiter, logger *zap.Logger) *Broker {
	if config == nil {
		config = DefaultBrokerConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	broker := &Broker{
		config:        config,
		subscriptions: make(map[string]*subscription),
		topics:        make(map[string][]*subscription),
		stats: &proto.BrokerStats{
			LastUpdated: time.Now(),
		},
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
		rateLimiter: rateLimiter,
	}
	
	// Start background cleanup routine
	broker.wg.Add(1)
	go broker.cleanupRoutine()
	
	return broker
}

// Publish publishes a message to a topic
func (b *Broker) Publish(ctx context.Context, topic string, msg *proto.Message) error {
	if msg == nil {
		return fmt.Errorf("message cannot be nil")
	}
	
	// Check rate limiting
	if b.rateLimiter != nil {
		allowed := b.rateLimiter.Allow(fmt.Sprintf("publish:%s", topic))
		if !allowed {
			return fmt.Errorf("rate limit exceeded for topic: %s", topic)
		}
	}
	
	// Set timestamp if not provided
	if msg.Timestamp == nil {
		now := time.Now()
		msg.Timestamp = &now
	}
	
	b.mu.RLock()
	subs, exists := b.topics[topic]
	if !exists {
		b.mu.RUnlock()
		b.logger.Debug("no subscribers for topic", zap.String("topic", topic))
		return nil
	}
	
	// Create a copy of subscriptions to avoid holding lock during delivery
	activeSubs := make([]*subscription, 0, len(subs))
	for _, sub := range subs {
		if sub.Active {
			activeSubs = append(activeSubs, sub)
		}
	}
	b.mu.RUnlock()
	
	// Deliver to all active subscriptions
	deliveredCount := 0
	for _, sub := range activeSubs {
		if err := b.deliverMessage(ctx, sub, msg); err != nil {
			b.logger.Error("failed to deliver message",
				zap.String("subscription_id", sub.ID),
				zap.String("topic", topic),
				zap.Error(err))
			b.updateStats(func(stats *proto.BrokerStats) {
				stats.FailedDeliveries++
			})
		} else {
			deliveredCount++
		}
	}
	
	b.updateStats(func(stats *proto.BrokerStats) {
		stats.MessagesPublished++
		stats.MessagesDelivered += int64(deliveredCount)
	})
	
	b.logger.Debug("message published",
		zap.String("topic", topic),
		zap.String("message_id", msg.ID),
		zap.Int("delivered_count", deliveredCount))
	
	return nil
}

// Subscribe creates a subscription to a topic
func (b *Broker) Subscribe(ctx context.Context, topic string, handler MessageHandler) (string, error) {
	if handler == nil {
		return "", fmt.Errorf("handler cannot be nil")
	}
	
	b.mu.Lock()
	defer b.mu.Unlock()
	
	// Check subscription limits
	if len(b.subscriptions) >= b.config.MaxSubscriptions {
		return "", fmt.Errorf("maximum subscriptions reached: %d", b.config.MaxSubscriptions)
	}
	
	// Generate subscription ID
	subID := fmt.Sprintf("sub_%s_%d", topic, time.Now().UnixNano())
	
	// Create subscription
	sub := &subscription{
		ID:      subID,
		Topic:   topic,
		Handler: handler,
		Buffer:  make(chan *proto.Message, b.config.BufferSize),
		Active:  true,
		Created: time.Now(),
	}
	
	// Add to maps
	b.subscriptions[subID] = sub
	b.topics[topic] = append(b.topics[topic], sub)
	
	// Start message processor for this subscription
	b.wg.Add(1)
	go b.processMessages(sub)
	
	b.updateStats(func(stats *proto.BrokerStats) {
		stats.ActiveSubscriptions++
	})
	
	b.logger.Info("subscription created",
		zap.String("subscription_id", subID),
		zap.String("topic", topic))
	
	return subID, nil
}

// Unsubscribe removes a subscription
func (b *Broker) Unsubscribe(ctx context.Context, subscriptionID string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	
	sub, exists := b.subscriptions[subscriptionID]
	if !exists {
		return fmt.Errorf("subscription not found: %s", subscriptionID)
	}
	
	// Mark as inactive and close buffer
	sub.Active = false
	close(sub.Buffer)
	
	// Remove from subscriptions map
	delete(b.subscriptions, subscriptionID)
	
	// Remove from topic subscriptions
	if topicSubs, exists := b.topics[sub.Topic]; exists {
		for i, topicSub := range topicSubs {
			if topicSub.ID == subscriptionID {
				b.topics[sub.Topic] = append(topicSubs[:i], topicSubs[i+1:]...)
				break
			}
		}
		
		// Clean up empty topic
		if len(b.topics[sub.Topic]) == 0 {
			delete(b.topics, sub.Topic)
		}
	}
	
	b.updateStats(func(stats *proto.BrokerStats) {
		stats.ActiveSubscriptions--
	})
	
	b.logger.Info("subscription removed",
		zap.String("subscription_id", subscriptionID),
		zap.String("topic", sub.Topic))
	
	return nil
}

// GetStats returns broker statistics (interface method)
func (b *Broker) GetStats(ctx context.Context) (*proto.BrokerStats, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	
	// Create a copy of stats
	statsCopy := &proto.BrokerStats{
		MessagesPublished:    b.stats.MessagesPublished,
		MessagesDelivered:    b.stats.MessagesDelivered,
		ActiveSubscriptions:  int32(len(b.subscriptions)),
		FailedDeliveries:     b.stats.FailedDeliveries,
		LastUpdated:         time.Now(),
	}
	
	return statsCopy, nil
}

// Close closes the broker
func (b *Broker) Close() error {
	b.logger.Info("closing message broker")
	
	// Cancel context to stop routines
	b.cancel()
	
	// Close all subscriptions
	b.mu.Lock()
	for _, sub := range b.subscriptions {
		sub.Active = false
		close(sub.Buffer)
	}
	b.mu.Unlock()
	
	// Wait for all goroutines to finish
	b.wg.Wait()
	
	b.logger.Info("message broker closed")
	return nil
}

// deliverMessage delivers a message to a subscription
func (b *Broker) deliverMessage(ctx context.Context, sub *subscription, msg *proto.Message) error {
	if !sub.Active {
		return fmt.Errorf("subscription is inactive")
	}
	
	select {
	case sub.Buffer <- msg:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(b.config.DeliveryTimeout):
		return fmt.Errorf("delivery timeout")
	}
}

// processMessages processes messages for a subscription
func (b *Broker) processMessages(sub *subscription) {
	defer b.wg.Done()
	
	for {
		select {
		case msg, ok := <-sub.Buffer:
			if !ok {
				// Channel closed, subscription removed
				return
			}
			
			// Process message with retry logic
			var lastErr error
			for attempt := 0; attempt < b.config.RetryAttempts; attempt++ {
				ctx, cancel := context.WithTimeout(b.ctx, b.config.DeliveryTimeout)
				err := sub.Handler(ctx, msg)
				cancel()
				
				if err == nil {
					break // Success
				}
				
				lastErr = err
				b.logger.Warn("message handler failed",
					zap.String("subscription_id", sub.ID),
					zap.String("message_id", msg.ID),
					zap.Int("attempt", attempt+1),
					zap.Error(err))
				
				if attempt < b.config.RetryAttempts-1 {
					time.Sleep(b.config.RetryDelay)
				}
			}
			
			if lastErr != nil {
				b.logger.Error("message processing failed after all retries",
					zap.String("subscription_id", sub.ID),
					zap.String("message_id", msg.ID),
					zap.Error(lastErr))
				
				b.updateStats(func(stats *proto.BrokerStats) {
					stats.FailedDeliveries++
				})
			}
			
		case <-b.ctx.Done():
			return
		}
	}
}

// cleanupRoutine performs periodic cleanup
func (b *Broker) cleanupRoutine() {
	defer b.wg.Done()
	
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			b.performCleanup()
		case <-b.ctx.Done():
			return
		}
	}
}

// performCleanup removes inactive subscriptions and updates stats
func (b *Broker) performCleanup() {
	b.mu.Lock()
	defer b.mu.Unlock()
	
	// Clean up inactive subscriptions (if needed)
	// This is a placeholder for more complex cleanup logic
	
	// Update stats timestamp
	b.stats.LastUpdated = time.Now()
}

// updateStats safely updates broker statistics
func (b *Broker) updateStats(updateFunc func(*proto.BrokerStats)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	
	updateFunc(b.stats)
	b.stats.LastUpdated = time.Now()
}