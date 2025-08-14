package proto

import (
	"time"
)

// Message represents a generic message
type Message struct {
	ID        string            `protobuf:"bytes,1,opt,name=id,proto3" json:"id,omitempty"`
	Topic     string            `protobuf:"bytes,2,opt,name=topic,proto3" json:"topic,omitempty"`
	Data      []byte            `protobuf:"bytes,3,opt,name=data,proto3" json:"data,omitempty"`
	Timestamp *time.Time        `protobuf:"varint,4,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
	Headers   map[string]string `protobuf:"bytes,5,opt,name=headers,proto3" json:"headers,omitempty"`
}

// QueueMessage represents a message in a queue with additional metadata
type QueueMessage struct {
	Id          string   `json:"id" protobuf:"bytes,1,opt,name=id"`
	Message     *Message `json:"message" protobuf:"bytes,2,opt,name=message"`
	QueueName   string   `json:"queue_name" protobuf:"bytes,3,opt,name=queue_name"`
	EnqueuedAt  int64    `json:"enqueued_at" protobuf:"varint,4,opt,name=enqueued_at"`
	DequeuedAt  int64    `json:"dequeued_at" protobuf:"varint,5,opt,name=dequeued_at"`
	RequeuedAt  int64    `json:"requeued_at" protobuf:"varint,6,opt,name=requeued_at"`
	Attempts    int32    `json:"attempts" protobuf:"varint,7,opt,name=attempts"`
	MaxAttempts int32    `json:"max_attempts" protobuf:"varint,8,opt,name=max_attempts"`
	Status      string   `json:"status" protobuf:"bytes,9,opt,name=status"`
}

// Event represents an event in the system
type Event struct {
	Id        string                 `json:"id" protobuf:"bytes,1,opt,name=id"`
	Type      string                 `json:"type" protobuf:"bytes,2,opt,name=type"`
	Source    string                 `json:"source" protobuf:"bytes,3,opt,name=source"`
	Timestamp int64                  `json:"timestamp" protobuf:"varint,4,opt,name=timestamp"`
	Data      map[string]interface{} `json:"data" protobuf:"bytes,5,opt,name=data"`
	Version   string                 `json:"version" protobuf:"bytes,6,opt,name=version"`
}

// BrokerStats represents broker statistics
type BrokerStats struct {
	InMsgs              uint64    `json:"in_msgs" protobuf:"varint,1,opt,name=in_msgs"`
	OutMsgs             uint64    `json:"out_msgs" protobuf:"varint,2,opt,name=out_msgs"`
	InBytes             uint64    `json:"in_bytes" protobuf:"varint,3,opt,name=in_bytes"`
	OutBytes            uint64    `json:"out_bytes" protobuf:"varint,4,opt,name=out_bytes"`
	Reconnects          uint64    `json:"reconnects" protobuf:"varint,5,opt,name=reconnects"`
	PendingSize         int64     `json:"pending_size" protobuf:"varint,6,opt,name=pending_size"`
	MessagesPublished   int64     `json:"messages_published"`
	MessagesDelivered   int64     `json:"messages_delivered"`
	FailedDeliveries    int64     `json:"failed_deliveries"`
	ActiveSubscriptions int32     `json:"active_subscriptions"`
	LastUpdated         time.Time `json:"last_updated"`
	Subscriptions int64  `json:"subscriptions" protobuf:"varint,7,opt,name=subscriptions"`
}

// QueueStats represents queue statistics
type QueueStats struct {
	Name            string `json:"name" protobuf:"bytes,1,opt,name=name"`
	Size            int64  `json:"size" protobuf:"varint,2,opt,name=size"`
	DlqSize         int64  `json:"dlq_size" protobuf:"varint,3,opt,name=dlq_size"`
	ProcessingCount int64  `json:"processing_count" protobuf:"varint,4,opt,name=processing_count"`
	Timestamp       int64  `json:"timestamp" protobuf:"varint,5,opt,name=timestamp"`
}

// EventBusStats represents event bus statistics
type EventBusStats struct {
	EventTypes      map[string]int64 `json:"event_types" protobuf:"bytes,1,rep,name=event_types"`
	HandlerCounts   map[string]int64 `json:"handler_counts" protobuf:"bytes,2,rep,name=handler_counts"`
	TotalEvents     int64            `json:"total_events" protobuf:"varint,3,opt,name=total_events"`
	TotalHandlers   int64            `json:"total_handlers" protobuf:"varint,4,opt,name=total_handlers"`
	Timestamp       int64            `json:"timestamp" protobuf:"varint,5,opt,name=timestamp"`
}

// RateLimitInfo represents rate limiting information
type RateLimitInfo struct {
	Key           string        `json:"key" protobuf:"bytes,1,opt,name=key"`
	Limit         int64         `json:"limit" protobuf:"varint,2,opt,name=limit"`
	Remaining     int64         `json:"remaining" protobuf:"varint,3,opt,name=remaining"`
	ResetTime     int64         `json:"reset_time" protobuf:"varint,4,opt,name=reset_time"`
	RetryAfter    time.Duration `json:"retry_after" protobuf:"varint,5,opt,name=retry_after"`
	IsRateLimited bool          `json:"is_rate_limited" protobuf:"varint,6,opt,name=is_rate_limited"`
}

// Stream represents a data stream
type Stream struct {
	Id          string            `json:"id" protobuf:"bytes,1,opt,name=id"`
	Name        string            `json:"name" protobuf:"bytes,2,opt,name=name"`
	Description string            `json:"description" protobuf:"bytes,3,opt,name=description"`
	Status      string            `json:"status" protobuf:"bytes,4,opt,name=status"`
	CreatedAt   int64             `json:"created_at" protobuf:"varint,5,opt,name=created_at"`
	UpdatedAt   int64             `json:"updated_at" protobuf:"varint,6,opt,name=updated_at"`
	Config      map[string]string `json:"config" protobuf:"bytes,7,rep,name=config"`
	Metrics     *StreamMetrics    `json:"metrics" protobuf:"bytes,8,opt,name=metrics"`
}

// StreamMetrics represents stream metrics
type StreamMetrics struct {
	MessageCount    int64   `json:"message_count" protobuf:"varint,1,opt,name=message_count"`
	ByteCount       int64   `json:"byte_count" protobuf:"varint,2,opt,name=byte_count"`
	SubscriberCount int64   `json:"subscriber_count" protobuf:"varint,3,opt,name=subscriber_count"`
	Throughput      float64 `json:"throughput" protobuf:"fixed64,4,opt,name=throughput"`
	Latency         float64 `json:"latency" protobuf:"fixed64,5,opt,name=latency"`
	ErrorRate       float64 `json:"error_rate" protobuf:"fixed64,6,opt,name=error_rate"`
	LastActivity    int64   `json:"last_activity" protobuf:"varint,7,opt,name=last_activity"`
}

// Channel represents a broadcast channel
type Channel struct {
	Id            string            `json:"id" protobuf:"bytes,1,opt,name=id"`
	Name          string            `json:"name" protobuf:"bytes,2,opt,name=name"`
	Description   string            `json:"description" protobuf:"bytes,3,opt,name=description"`
	Status        string            `json:"status" protobuf:"bytes,4,opt,name=status"`
	CreatedAt     int64             `json:"created_at" protobuf:"varint,5,opt,name=created_at"`
	UpdatedAt     int64             `json:"updated_at" protobuf:"varint,6,opt,name=updated_at"`
	SubscriberCount int64           `json:"subscriber_count" protobuf:"varint,7,opt,name=subscriber_count"`
	Config        map[string]string `json:"config" protobuf:"bytes,8,rep,name=config"`
	TTL           int64             `json:"ttl" protobuf:"varint,9,opt,name=ttl"`
}

// Subscription represents a subscription to a channel or stream
type Subscription struct {
	Id         string            `json:"id" protobuf:"bytes,1,opt,name=id"`
	UserId     string            `json:"user_id" protobuf:"bytes,2,opt,name=user_id"`
	ResourceId string            `json:"resource_id" protobuf:"bytes,3,opt,name=resource_id"`
	Type       string            `json:"type" protobuf:"bytes,4,opt,name=type"`
	Status     string            `json:"status" protobuf:"bytes,5,opt,name=status"`
	CreatedAt  int64             `json:"created_at" protobuf:"varint,6,opt,name=created_at"`
	UpdatedAt  int64             `json:"updated_at" protobuf:"varint,7,opt,name=updated_at"`
	Config     map[string]string `json:"config" protobuf:"bytes,8,rep,name=config"`
}

// BroadcastRequest represents a request to broadcast a message
type BroadcastRequest struct {
	ChannelId string   `json:"channel_id" protobuf:"bytes,1,opt,name=channel_id"`
	Message   *Message `json:"message" protobuf:"bytes,2,opt,name=message"`
	Options   *BroadcastOptions `json:"options" protobuf:"bytes,3,opt,name=options"`
}

// BroadcastOptions represents options for broadcasting
type BroadcastOptions struct {
	Persistent bool   `json:"persistent" protobuf:"varint,1,opt,name=persistent"`
	TTL        int64  `json:"ttl" protobuf:"varint,2,opt,name=ttl"`
	Priority   int32  `json:"priority" protobuf:"varint,3,opt,name=priority"`
	Compress   bool   `json:"compress" protobuf:"varint,4,opt,name=compress"`
}

// StreamData represents data flowing through a stream
type StreamData struct {
	StreamId  string                 `json:"stream_id" protobuf:"bytes,1,opt,name=stream_id"`
	Sequence  int64                  `json:"sequence" protobuf:"varint,2,opt,name=sequence"`
	Timestamp int64                  `json:"timestamp" protobuf:"varint,3,opt,name=timestamp"`
	Data      []byte                 `json:"data" protobuf:"bytes,4,opt,name=data"`
	Metadata  map[string]interface{} `json:"metadata" protobuf:"bytes,5,opt,name=metadata"`
	Checksum  string                 `json:"checksum" protobuf:"bytes,6,opt,name=checksum"`
}

// SystemStatus represents the overall system status
type SystemStatus struct {
	Version     string                 `json:"version" protobuf:"bytes,1,opt,name=version"`
	Uptime      int64                  `json:"uptime" protobuf:"varint,2,opt,name=uptime"`
	Status      string                 `json:"status" protobuf:"bytes,3,opt,name=status"`
	Components  map[string]string      `json:"components" protobuf:"bytes,4,rep,name=components"`
	Metrics     map[string]interface{} `json:"metrics" protobuf:"bytes,5,opt,name=metrics"`
	Timestamp   int64                  `json:"timestamp" protobuf:"varint,6,opt,name=timestamp"`
}

// ErrorInfo represents error information
type ErrorInfo struct {
	Code      string `json:"code" protobuf:"bytes,1,opt,name=code"`
	Message   string `json:"message" protobuf:"bytes,2,opt,name=message"`
	Details   string `json:"details" protobuf:"bytes,3,opt,name=details"`
	Timestamp int64  `json:"timestamp" protobuf:"varint,4,opt,name=timestamp"`
	Component string `json:"component" protobuf:"bytes,5,opt,name=component"`
}