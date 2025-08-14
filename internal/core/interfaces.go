package core

import (
	"context"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
)

// MessageHandler handles incoming messages
type MessageHandler func(ctx context.Context, msg *proto.Message) error

// EventHandler handles events
type EventHandler func(ctx context.Context, event *proto.Event) error

// MessageBroker interface for message publishing and subscribing
type MessageBroker interface {
	Publish(ctx context.Context, topic string, message *proto.Message) error
	Subscribe(ctx context.Context, topic string, handler MessageHandler) (string, error)
	Unsubscribe(ctx context.Context, subscriptionID string) error
	GetStats(ctx context.Context) (*proto.BrokerStats, error)
	Close() error
}

// MessageQueue interface for message queuing
type MessageQueue interface {
	Enqueue(ctx context.Context, queueName string, message interface{}) error
	Dequeue(ctx context.Context, queueName string, timeout time.Duration) (*proto.QueueMessage, error)
	Ack(ctx context.Context, messageID string) error
	Nack(ctx context.Context, messageID string, requeue bool) error
	PurgeQueue(ctx context.Context, queueName string) error
	GetStats(queueName string) (*proto.QueueStats, error)
	Close() error
}

// EventBus interface for event handling
type EventBus interface {
	Publish(ctx context.Context, event *proto.Event) error
	Emit(ctx context.Context, event *proto.Event) error
	Subscribe(eventType string, handler EventHandler) (string, error)
	Unsubscribe(subscriptionID string) error
	GetHistory(eventType string, limit int) ([]*proto.Event, error)
	Close() error
}

// RateLimiter interface for rate limiting
type RateLimiter interface {
	Allow(key string) bool
	GetStats(key string) (*proto.RateLimitInfo, error)
	Close() error
}

// Storage interface for data persistence
type Storage interface {
	Store(ctx context.Context, key string, value interface{}) error
	Retrieve(ctx context.Context, key string, dest interface{}) error
	Delete(ctx context.Context, key string) error
	Close() error
}