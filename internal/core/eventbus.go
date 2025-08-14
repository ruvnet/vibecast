package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// EventBusConfig holds configuration for the event bus
type EventBusConfig struct {
	MaxSubscriptions    int
	BufferSize         int
	EnableHistory      bool
	MaxHistorySize     int
	HistoryRetention   time.Duration
	DeliveryTimeout    time.Duration
	RetryAttempts      int
	RetryDelay         time.Duration
}

// DefaultEventBusConfig returns default event bus configuration
func DefaultEventBusConfig() *EventBusConfig {
	return &EventBusConfig{
		MaxSubscriptions:    1000,
		BufferSize:         100,
		EnableHistory:      true,
		MaxHistorySize:     10000,
		HistoryRetention:   24 * time.Hour,
		DeliveryTimeout:    30 * time.Second,
		RetryAttempts:      3,
		RetryDelay:         1 * time.Second,
	}
}

// eventSubscription represents an event subscription
type eventSubscription struct {
	ID        string
	EventType string
	Handler   EventHandler
	Buffer    chan *proto.Event
	Active    bool
	Created   time.Time
}

// InMemoryEventBus implements the EventBus interface
type InMemoryEventBus struct {
	config        *EventBusConfig
	subscriptions map[string]*eventSubscription
	eventTypes    map[string][]*eventSubscription
	history       map[string][]*proto.Event
	mu            sync.RWMutex
	logger        *zap.Logger
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
}

// NewEventBus creates a new event bus
func NewEventBus(config *EventBusConfig, logger *zap.Logger) *InMemoryEventBus {
	ctx, cancel := context.WithCancel(context.Background())
	
	eb := &InMemoryEventBus{
		config:        config,
		subscriptions: make(map[string]*eventSubscription),
		eventTypes:    make(map[string][]*eventSubscription),
		history:       make(map[string][]*proto.Event),
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start cleanup goroutine if history is enabled
	if config.EnableHistory {
		eb.wg.Add(1)
		go eb.historyCleanup()
	}

	return eb
}

// Publish publishes an event to all subscribers
func (eb *InMemoryEventBus) Publish(ctx context.Context, event *proto.Event) error {
	eb.mu.RLock()
	subscriptions, exists := eb.eventTypes[event.Type]
	if !exists {
		eb.mu.RUnlock()
		return nil // No subscribers for this event type
	}

	// Add to history if enabled
	if eb.config.EnableHistory {
		eb.addToHistory(event)
	}

	// Create a copy of subscriptions to avoid holding the lock
	subs := make([]*eventSubscription, len(subscriptions))
	copy(subs, subscriptions)
	eb.mu.RUnlock()

	// Deliver to subscribers
	for _, sub := range subs {
		if !sub.Active {
			continue
		}

		select {
		case sub.Buffer <- event:
			// Event delivered successfully
		default:
			eb.logger.Warn("Event buffer full for subscription", 
				zap.String("subscription_id", sub.ID),
				zap.String("event_type", event.Type))
		}
	}

	return nil
}

// Emit is an alias for Publish to satisfy the interface
func (eb *InMemoryEventBus) Emit(ctx context.Context, event *proto.Event) error {
	return eb.Publish(ctx, event)
}

// Subscribe subscribes to events of a specific type
func (eb *InMemoryEventBus) Subscribe(eventType string, handler EventHandler) (string, error) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	if len(eb.subscriptions) >= eb.config.MaxSubscriptions {
		return "", fmt.Errorf("maximum subscriptions limit reached: %d", eb.config.MaxSubscriptions)
	}

	subID := fmt.Sprintf("sub_%d", time.Now().UnixNano())
	
	sub := &eventSubscription{
		ID:        subID,
		EventType: eventType,
		Handler:   handler,
		Buffer:    make(chan *proto.Event, eb.config.BufferSize),
		Active:    true,
		Created:   time.Now(),
	}

	eb.subscriptions[subID] = sub
	eb.eventTypes[eventType] = append(eb.eventTypes[eventType], sub)

	// Start handler goroutine
	eb.wg.Add(1)
	go eb.handleEvents(sub)

	return subID, nil
}

// Unsubscribe removes a subscription
func (eb *InMemoryEventBus) Unsubscribe(subscriptionID string) error {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	sub, exists := eb.subscriptions[subscriptionID]
	if !exists {
		return fmt.Errorf("subscription not found: %s", subscriptionID)
	}

	sub.Active = false
	close(sub.Buffer)

	delete(eb.subscriptions, subscriptionID)

	// Remove from event type subscriptions
	eventSubs := eb.eventTypes[sub.EventType]
	for i, s := range eventSubs {
		if s.ID == subscriptionID {
			eb.eventTypes[sub.EventType] = append(eventSubs[:i], eventSubs[i+1:]...)
			break
		}
	}

	return nil
}

// GetHistory retrieves event history for a specific event type
func (eb *InMemoryEventBus) GetHistory(eventType string, limit int) ([]*proto.Event, error) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	if !eb.config.EnableHistory {
		return nil, fmt.Errorf("event history is disabled")
	}

	history, exists := eb.history[eventType]
	if !exists {
		return []*proto.Event{}, nil
	}

	if limit <= 0 || limit > len(history) {
		limit = len(history)
	}

	// Return the most recent events
	start := len(history) - limit
	result := make([]*proto.Event, limit)
	copy(result, history[start:])

	return result, nil
}

// Close shuts down the event bus
func (eb *InMemoryEventBus) Close() error {
	eb.cancel()

	eb.mu.Lock()
	for _, sub := range eb.subscriptions {
		sub.Active = false
		close(sub.Buffer)
	}
	eb.mu.Unlock()

	eb.wg.Wait()
	return nil
}

// handleEvents processes events for a subscription
func (eb *InMemoryEventBus) handleEvents(sub *eventSubscription) {
	defer eb.wg.Done()

	for {
		select {
		case event, ok := <-sub.Buffer:
			if !ok {
				return // Channel closed
			}

			ctx, cancel := context.WithTimeout(eb.ctx, eb.config.DeliveryTimeout)
			err := sub.Handler(ctx, event)
			cancel()

			if err != nil {
				eb.logger.Error("Event handler failed",
					zap.String("subscription_id", sub.ID),
					zap.String("event_type", event.Type),
					zap.Error(err))
			}

		case <-eb.ctx.Done():
			return
		}
	}
}

// addToHistory adds an event to the history
func (eb *InMemoryEventBus) addToHistory(event *proto.Event) {
	history := eb.history[event.Type]
	
	// Add timestamp if not set
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().Unix()
	}

	history = append(history, event)

	// Trim history if it exceeds max size
	if len(history) > eb.config.MaxHistorySize {
		history = history[len(history)-eb.config.MaxHistorySize:]
	}

	eb.history[event.Type] = history
}

// historyCleanup removes old events from history
func (eb *InMemoryEventBus) historyCleanup() {
	defer eb.wg.Done()

	ticker := time.NewTicker(eb.config.HistoryRetention / 4) // Clean up 4 times per retention period
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			eb.cleanupExpiredHistory()
		case <-eb.ctx.Done():
			return
		}
	}
}

// cleanupExpiredHistory removes expired events from history
func (eb *InMemoryEventBus) cleanupExpiredHistory() {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	cutoff := time.Now().Add(-eb.config.HistoryRetention)

	for eventType, history := range eb.history {
		var filtered []*proto.Event
		
		for _, event := range history {
			if event.Timestamp > 0 && time.Unix(event.Timestamp, 0).After(cutoff) {
				filtered = append(filtered, event)
			}
		}
		
		eb.history[eventType] = filtered
	}
}