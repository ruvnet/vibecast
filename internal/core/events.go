package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/vibecast/anomaly-detector/internal/models/proto"
	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// EventBusConfig holds configuration for the event bus
type EventBusConfig struct {
	MaxEventHistory   int
	HandlerTimeout    time.Duration
	MaxHandlers       int
	BufferSize        int
	EnablePersistence bool
	EventTTL          time.Duration
}

// DefaultEventBusConfig returns default event bus configuration
func DefaultEventBusConfig() *EventBusConfig {
	return &EventBusConfig{
		MaxEventHistory:   10000,
		HandlerTimeout:    30 * time.Second,
		MaxHandlers:       1000,
		BufferSize:        100,
		EnablePersistence: true,
		EventTTL:          24 * time.Hour,
	}
}

// eventHandler represents an internal event handler
type eventHandler struct {
	ID        string
	EventType string
	Handler   EventHandler
	Buffer    chan *proto.Event
	Active    bool
	Created   time.Time
	OneTime   bool
}

// EventBus implements the EventBus interface
type EventBus struct {
	config        *EventBusConfig
	handlers      map[string]*eventHandler
	eventTypes    map[string][]*eventHandler
	eventHistory  map[string][]*proto.Event
	storage       Storage
	mu            sync.RWMutex
	logger        *zap.Logger
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	rateLimiter   RateLimiter
}

// NewEventBus creates a new event bus
func NewEventBus(config *EventBusConfig, storage Storage, rateLimiter RateLimiter, logger *zap.Logger) *EventBus {
	if config == nil {
		config = DefaultEventBusConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	bus := &EventBus{
		config:       config,
		handlers:     make(map[string]*eventHandler),
		eventTypes:   make(map[string][]*eventHandler),
		eventHistory: make(map[string][]*proto.Event),
		storage:      storage,
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
		rateLimiter:  rateLimiter,
	}
	
	// Start background cleanup routine
	bus.wg.Add(1)
	go bus.cleanupRoutine()
	
	return bus
}

// Emit emits an event
func (eb *EventBus) Emit(ctx context.Context, event *proto.Event) error {
	if event == nil {
		return fmt.Errorf("event cannot be nil")
	}
	
	if event.Type == "" {
		return fmt.Errorf("event type cannot be empty")
	}
	
	// Check rate limiting
	if eb.rateLimiter != nil {
		allowed, _, err := eb.rateLimiter.Allow(ctx, fmt.Sprintf("event:%s", event.Type))
		if err != nil {
			eb.logger.Error("rate limiter error", zap.Error(err))
			return fmt.Errorf("rate limiter error: %w", err)
		}
		if !allowed {
			return fmt.Errorf("rate limit exceeded for event type: %s", event.Type)
		}
	}
	
	// Set timestamp if not provided
	if event.Timestamp == nil {
		event.Timestamp = timestamppb.Now()
	}
	
	// Generate ID if not provided
	if event.Id == "" {
		event.Id = fmt.Sprintf("evt_%d", time.Now().UnixNano())
	}
	
	eb.mu.RLock()
	handlers, exists := eb.eventTypes[event.Type]
	if !exists {
		eb.mu.RUnlock()
		eb.logger.Debug("no handlers for event type", zap.String("type", event.Type))
		
		// Still add to history even if no handlers
		eb.addToHistory(event)
		return nil
	}
	
	// Create a copy of handlers to avoid holding lock during delivery
	activeHandlers := make([]*eventHandler, 0, len(handlers))
	for _, handler := range handlers {
		if handler.Active {
			activeHandlers = append(activeHandlers, handler)
		}
	}
	eb.mu.RUnlock()
	
	// Add to history
	eb.addToHistory(event)
	
	// Deliver to all active handlers
	deliveredCount := 0
	for _, handler := range activeHandlers {
		if err := eb.deliverEvent(ctx, handler, event); err != nil {
			eb.logger.Error("failed to deliver event",
				zap.String("handler_id", handler.ID),
				zap.String("event_type", event.Type),
				zap.String("event_id", event.Id),
				zap.Error(err))
		} else {
			deliveredCount++
			
			// Remove one-time handlers after successful delivery
			if handler.OneTime {
				if err := eb.Off(handler.ID); err != nil {
					eb.logger.Error("failed to remove one-time handler",
						zap.String("handler_id", handler.ID),
						zap.Error(err))
				}
			}
		}
	}
	
	// Persist event if enabled
	if eb.config.EnablePersistence && eb.storage != nil {
		if err := eb.persistEvent(event); err != nil {
			eb.logger.Error("failed to persist event", zap.Error(err))
		}
	}
	
	eb.logger.Debug("event emitted",
		zap.String("type", event.Type),
		zap.String("event_id", event.Id),
		zap.Int("delivered_count", deliveredCount))
	
	return nil
}

// On registers an event handler
func (eb *EventBus) On(eventType string, handler EventHandler) string {
	return eb.registerHandler(eventType, handler, false)
}

// Once registers a one-time event handler
func (eb *EventBus) Once(eventType string, handler EventHandler) string {
	return eb.registerHandler(eventType, handler, true)
}

// registerHandler registers an event handler (internal)
func (eb *EventBus) registerHandler(eventType string, handler EventHandler, oneTime bool) string {
	if handler == nil {
		eb.logger.Error("handler cannot be nil")
		return ""
	}
	
	if eventType == "" {
		eb.logger.Error("event type cannot be empty")
		return ""
	}
	
	eb.mu.Lock()
	defer eb.mu.Unlock()
	
	// Check handler limits
	if len(eb.handlers) >= eb.config.MaxHandlers {
		eb.logger.Error("maximum handlers reached", zap.Int("max", eb.config.MaxHandlers))
		return ""
	}
	
	// Generate handler ID
	handlerID := fmt.Sprintf("hdl_%s_%d", eventType, time.Now().UnixNano())
	
	// Create handler
	eh := &eventHandler{
		ID:        handlerID,
		EventType: eventType,
		Handler:   handler,
		Buffer:    make(chan *proto.Event, eb.config.BufferSize),
		Active:    true,
		Created:   time.Now(),
		OneTime:   oneTime,
	}
	
	// Add to maps
	eb.handlers[handlerID] = eh
	eb.eventTypes[eventType] = append(eb.eventTypes[eventType], eh)
	
	// Start event processor for this handler
	eb.wg.Add(1)
	go eb.processEvents(eh)
	
	eb.logger.Info("event handler registered",
		zap.String("handler_id", handlerID),
		zap.String("event_type", eventType),
		zap.Bool("one_time", oneTime))
	
	return handlerID
}

// Off removes an event handler
func (eb *EventBus) Off(handlerID string) error {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	
	handler, exists := eb.handlers[handlerID]
	if !exists {
		return fmt.Errorf("handler not found: %s", handlerID)
	}
	
	// Mark as inactive and close buffer
	handler.Active = false
	close(handler.Buffer)
	
	// Remove from handlers map
	delete(eb.handlers, handlerID)
	
	// Remove from event type handlers
	if typeHandlers, exists := eb.eventTypes[handler.EventType]; exists {
		for i, typeHandler := range typeHandlers {
			if typeHandler.ID == handlerID {
				eb.eventTypes[handler.EventType] = append(typeHandlers[:i], typeHandlers[i+1:]...)
				break
			}
		}
		
		// Clean up empty event type
		if len(eb.eventTypes[handler.EventType]) == 0 {
			delete(eb.eventTypes, handler.EventType)
		}
	}
	
	eb.logger.Info("event handler removed",
		zap.String("handler_id", handlerID),
		zap.String("event_type", handler.EventType))
	
	return nil
}

// GetEventHistory returns event history
func (eb *EventBus) GetEventHistory(ctx context.Context, eventType string, limit int) ([]*proto.Event, error) {
	if eventType == "" {
		return nil, fmt.Errorf("event type cannot be empty")
	}
	
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	
	history, exists := eb.eventHistory[eventType]
	if !exists {
		return []*proto.Event{}, nil
	}
	
	// Apply limit
	if limit > 0 && limit < len(history) {
		// Return the most recent events
		start := len(history) - limit
		return history[start:], nil
	}
	
	// Return a copy to avoid external modifications
	result := make([]*proto.Event, len(history))
	copy(result, history)
	
	return result, nil
}

// Close closes the event bus
func (eb *EventBus) Close() error {
	eb.logger.Info("closing event bus")
	
	// Cancel context to stop routines
	eb.cancel()
	
	// Close all handlers
	eb.mu.Lock()
	for _, handler := range eb.handlers {
		handler.Active = false
		close(handler.Buffer)
	}
	eb.mu.Unlock()
	
	// Wait for all goroutines to finish
	eb.wg.Wait()
	
	eb.logger.Info("event bus closed")
	return nil
}

// deliverEvent delivers an event to a handler
func (eb *EventBus) deliverEvent(ctx context.Context, handler *eventHandler, event *proto.Event) error {
	if !handler.Active {
		return fmt.Errorf("handler is inactive")
	}
	
	select {
	case handler.Buffer <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(eb.config.HandlerTimeout):
		return fmt.Errorf("delivery timeout")
	}
}

// processEvents processes events for a handler
func (eb *EventBus) processEvents(handler *eventHandler) {
	defer eb.wg.Done()
	
	for {
		select {
		case event, ok := <-handler.Buffer:
			if !ok {
				// Channel closed, handler removed
				return
			}
			
			// Process event with timeout
			ctx, cancel := context.WithTimeout(eb.ctx, eb.config.HandlerTimeout)
			err := handler.Handler(ctx, event)
			cancel()
			
			if err != nil {
				eb.logger.Error("event handler failed",
					zap.String("handler_id", handler.ID),
					zap.String("event_type", event.Type),
					zap.String("event_id", event.Id),
					zap.Error(err))
			}
			
		case <-eb.ctx.Done():
			return
		}
	}
}

// addToHistory adds an event to the history
func (eb *EventBus) addToHistory(event *proto.Event) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	
	// Add to history
	eb.eventHistory[event.Type] = append(eb.eventHistory[event.Type], event)
	
	// Trim history if it exceeds max size
	if len(eb.eventHistory[event.Type]) > eb.config.MaxEventHistory {
		// Remove oldest events
		excess := len(eb.eventHistory[event.Type]) - eb.config.MaxEventHistory
		eb.eventHistory[event.Type] = eb.eventHistory[event.Type][excess:]
	}
}

// persistEvent persists an event to storage
func (eb *EventBus) persistEvent(event *proto.Event) error {
	if eb.storage == nil {
		return fmt.Errorf("storage not configured")
	}
	
	key := fmt.Sprintf("event:%s:%s", event.Type, event.Id)
	
	// In a real implementation, you'd serialize the event properly
	// This is a simplified version
	eventData := []byte(fmt.Sprintf("event:%s", event.Id))
	
	return eb.storage.Store(eb.ctx, key, eventData, eb.config.EventTTL)
}

// cleanupRoutine performs periodic cleanup
func (eb *EventBus) cleanupRoutine() {
	defer eb.wg.Done()
	
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			eb.performCleanup()
		case <-eb.ctx.Done():
			return
		}
	}
}

// performCleanup removes old events from history
func (eb *EventBus) performCleanup() {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	
	cutoff := time.Now().Add(-eb.config.EventTTL)
	
	for eventType, events := range eb.eventHistory {
		filteredEvents := make([]*proto.Event, 0, len(events))
		removedCount := 0
		
		for _, event := range events {
			if event.Timestamp.AsTime().After(cutoff) {
				filteredEvents = append(filteredEvents, event)
			} else {
				removedCount++
			}
		}
		
		if removedCount > 0 {
			eb.eventHistory[eventType] = filteredEvents
			eb.logger.Debug("cleaned up expired events",
				zap.String("event_type", eventType),
				zap.Int("removed", removedCount))
		}
	}
}