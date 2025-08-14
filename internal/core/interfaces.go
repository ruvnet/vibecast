package core

import (
	"context"
	"time"

	"github.com/vibecast/anomaly-detector/internal/models/proto"
)

// MessageBroker defines the interface for message brokering
type MessageBroker interface {
	// Publish publishes a message to a topic
	Publish(ctx context.Context, topic string, msg *proto.Message) error
	
	// Subscribe creates a subscription to a topic
	Subscribe(ctx context.Context, topic string, handler MessageHandler) (string, error)
	
	// Unsubscribe removes a subscription
	Unsubscribe(ctx context.Context, subscriptionID string) error
	
	// GetStats returns broker statistics
	GetStats(ctx context.Context) (*proto.BrokerStats, error)
	
	// Close closes the broker
	Close() error
}

// MessageQueue defines the interface for message queuing
type MessageQueue interface {
	// Enqueue adds a message to the queue
	Enqueue(ctx context.Context, queueName string, msg *proto.Message) error
	
	// Dequeue removes and returns a message from the queue
	Dequeue(ctx context.Context, queueName string, timeout time.Duration) (*proto.QueueMessage, error)
	
	// Ack acknowledges a message has been processed
	Ack(ctx context.Context, messageID string) error
	
	// Nack negatively acknowledges a message
	Nack(ctx context.Context, messageID string, requeue bool) error
	
	// GetQueueSize returns the size of a queue
	GetQueueSize(ctx context.Context, queueName string) (int64, error)
	
	// PurgeQueue removes all messages from a queue
	PurgeQueue(ctx context.Context, queueName string) error
	
	// Close closes the queue
	Close() error
}

// EventBus defines the interface for event handling
type EventBus interface {
	// Emit emits an event
	Emit(ctx context.Context, event *proto.Event) error
	
	// On registers an event handler
	On(eventType string, handler EventHandler) string
	
	// Off removes an event handler
	Off(handlerID string) error
	
	// Once registers a one-time event handler
	Once(eventType string, handler EventHandler) string
	
	// GetEventHistory returns event history
	GetEventHistory(ctx context.Context, eventType string, limit int) ([]*proto.Event, error)
	
	// Close closes the event bus
	Close() error
}

// RateLimiter defines the interface for rate limiting
type RateLimiter interface {
	// Allow checks if an operation is allowed
	Allow(ctx context.Context, key string) (bool, *proto.RateLimitInfo, error)
	
	// Reset resets the rate limit for a key
	Reset(ctx context.Context, key string) error
	
	// GetInfo returns rate limit information
	GetInfo(ctx context.Context, key string) (*proto.RateLimitInfo, error)
	
	// Close closes the rate limiter
	Close() error
}

// Storage defines the interface for message persistence
type Storage interface {
	// Store stores a message
	Store(ctx context.Context, key string, data []byte, ttl time.Duration) error
	
	// Retrieve retrieves a message
	Retrieve(ctx context.Context, key string) ([]byte, error)
	
	// Delete deletes a message
	Delete(ctx context.Context, key string) error
	
	// List lists keys matching a pattern
	List(ctx context.Context, pattern string) ([]string, error)
	
	// Exists checks if a key exists
	Exists(ctx context.Context, key string) (bool, error)
	
	// Close closes the storage
	Close() error
}

// MessageHandler handles incoming messages
type MessageHandler func(ctx context.Context, msg *proto.Message) error

// EventHandler handles incoming events
type EventHandler func(ctx context.Context, event *proto.Event) error

// ErrorHandler handles errors
type ErrorHandler func(error)

// BackpressureHandler handles backpressure situations
type BackpressureHandler func(queueSize int64) error