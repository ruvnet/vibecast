package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// QueueConfig holds configuration for the message queue
type QueueConfig struct {
	MaxQueueSize        int64
	RetryAttempts       int
	RetryDelay          time.Duration
	DeadLetterThreshold int
	PersistenceEnabled  bool
	FlushInterval       time.Duration
	MaxMessageAge       time.Duration
}

// DefaultQueueConfig returns default queue configuration
func DefaultQueueConfig() *QueueConfig {
	return &QueueConfig{
		MaxQueueSize:        100000,
		RetryAttempts:       3,
		RetryDelay:          5 * time.Second,
		DeadLetterThreshold: 5,
		PersistenceEnabled:  true,
		FlushInterval:       10 * time.Second,
		MaxMessageAge:       24 * time.Hour,
	}
}

// queueItem represents an item in the queue
type queueItem struct {
	QueueMessage *proto.QueueMessage
	InFlight     bool
	LastDelivery time.Time
	AckDeadline  time.Time
}

// Queue implements the MessageQueue interface
type Queue struct {
	config               *QueueConfig
	queues               map[string][]*queueItem
	inFlightMessages     map[string]*queueItem
	deadLetterQueue      map[string][]*queueItem
	storage              Storage
	backpressureHandler  BackpressureHandler
	mu                   sync.RWMutex
	logger               *zap.Logger
	ctx                  context.Context
	cancel               context.CancelFunc
	wg                   sync.WaitGroup
}

// NewQueue creates a new message queue
func NewQueue(config *QueueConfig, storage Storage, backpressureHandler BackpressureHandler, logger *zap.Logger) *Queue {
	if config == nil {
		config = DefaultQueueConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	queue := &Queue{
		config:               config,
		queues:               make(map[string][]*queueItem),
		inFlightMessages:     make(map[string]*queueItem),
		deadLetterQueue:      make(map[string][]*queueItem),
		storage:              storage,
		backpressureHandler:  backpressureHandler,
		logger:               logger,
		ctx:                  ctx,
		cancel:               cancel,
	}
	
	// Start background routines
	queue.wg.Add(2)
	go queue.persistenceRoutine()
	go queue.cleanupRoutine()
	
	return queue
}

// Enqueue adds a message to the queue
func (q *Queue) Enqueue(ctx context.Context, queueName string, message interface{}) error {
	if message == nil {
		return fmt.Errorf("message cannot be nil")
	}
	
	if queueName == "" {
		return fmt.Errorf("queue name cannot be empty")
	}
	
	// Convert message to the appropriate type
	var queueMsg *proto.QueueMessage
	
	switch msg := message.(type) {
	case *proto.QueueMessage:
		queueMsg = msg
	case *proto.Message:
		// Convert Message to QueueMessage
		queueMsg = &proto.QueueMessage{
			Id:          fmt.Sprintf("qm_%d", time.Now().UnixNano()),
			QueueName:   queueName,
			Message:     msg,
			EnqueuedAt:  time.Now().Unix(),
			Attempts:    0,
			MaxAttempts: int32(q.config.DeadLetterThreshold),
			Status:      "pending",
		}
	default:
		return fmt.Errorf("unsupported message type: %T", message)
	}
	
	q.mu.Lock()
	defer q.mu.Unlock()
	
	// Check queue size limits
	currentSize := int64(len(q.queues[queueName]))
	if currentSize >= q.config.MaxQueueSize {
		// Handle backpressure
		if q.backpressureHandler != nil {
			if shouldApplyBackpressure := q.backpressureHandler(ctx, currentSize, 0); shouldApplyBackpressure {
				return fmt.Errorf("backpressure applied, queue is full")
			}
		}
		return fmt.Errorf("queue size limit exceeded: %d", q.config.MaxQueueSize)
	}
	
	// Create queue item
	item := &queueItem{
		QueueMessage: queueMsg,
		InFlight:     false,
		LastDelivery: time.Time{},
	}
	
	// Add to queue
	q.queues[queueName] = append(q.queues[queueName], item)
	
	if queueMsg.Message != nil {
		q.logger.Debug("message enqueued",
			zap.String("queue", queueName),
			zap.String("message_id", queueMsg.Message.ID),
			zap.Int64("queue_size", currentSize+1))
	} else {
		q.logger.Debug("message enqueued",
			zap.String("queue", queueName),
			zap.Int64("queue_size", currentSize+1))
	}
	
	return nil
}

// Dequeue removes and returns a message from the queue
func (q *Queue) Dequeue(ctx context.Context, queueName string, timeout time.Duration) (*proto.QueueMessage, error) {
	if queueName == "" {
		return nil, fmt.Errorf("queue name cannot be empty")
	}
	
	deadline := time.Now().Add(timeout)
	
	for {
		q.mu.Lock()
		
		// Find available message
		queue := q.queues[queueName]
		var availableItem *queueItem
		var itemIndex int
		
		for i, item := range queue {
			if !item.InFlight {
				availableItem = item
				itemIndex = i
				break
			}
		}
		
		if availableItem != nil {
			// Mark as in-flight
			availableItem.InFlight = true
			availableItem.LastDelivery = time.Now()
			availableItem.AckDeadline = time.Now().Add(timeout)
			availableItem.QueueMessage.Attempts++
			availableItem.QueueMessage.DequeuedAt = time.Now().Unix()
			availableItem.QueueMessage.Status = "in_flight"
			
			// Remove from queue and add to in-flight
			q.queues[queueName] = append(queue[:itemIndex], queue[itemIndex+1:]...)
			q.inFlightMessages[availableItem.QueueMessage.Message.ID] = availableItem
			
			result := availableItem.QueueMessage
			q.mu.Unlock()
			
			q.logger.Debug("message dequeued",
				zap.String("queue", queueName),
				zap.String("message_id", result.Message.ID),
				zap.Int32("delivery_count", result.Attempts))
			
			return result, nil
		}
		
		q.mu.Unlock()
		
		// Check timeout
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("dequeue timeout")
		}
		
		// Check context cancellation
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(100 * time.Millisecond):
			// Continue polling
		}
	}
}

// Ack acknowledges a message has been processed
func (q *Queue) Ack(ctx context.Context, messageID string) error {
	if messageID == "" {
		return fmt.Errorf("message ID cannot be empty")
	}
	
	q.mu.Lock()
	defer q.mu.Unlock()
	
	item, exists := q.inFlightMessages[messageID]
	if !exists {
		return fmt.Errorf("message not found in flight: %s", messageID)
	}
	
	// Remove from in-flight messages
	delete(q.inFlightMessages, messageID)
	
	q.logger.Debug("message acknowledged",
		zap.String("message_id", messageID),
		zap.String("queue", item.QueueMessage.QueueName))
	
	return nil
}

// Nack negatively acknowledges a message
func (q *Queue) Nack(ctx context.Context, messageID string, requeue bool) error {
	if messageID == "" {
		return fmt.Errorf("message ID cannot be empty")
	}
	
	q.mu.Lock()
	defer q.mu.Unlock()
	
	item, exists := q.inFlightMessages[messageID]
	if !exists {
		return fmt.Errorf("message not found in flight: %s", messageID)
	}
	
	// Remove from in-flight messages
	delete(q.inFlightMessages, messageID)
	
	if requeue {
		// Check if should go to dead letter queue
		if item.QueueMessage.Attempts >= int32(q.config.DeadLetterThreshold) {
			item.QueueMessage.Status = "dead_letter"
			dlqName := fmt.Sprintf("dlq_%s", item.QueueMessage.QueueName)
			q.deadLetterQueue[dlqName] = append(q.deadLetterQueue[dlqName], item)
			
			q.logger.Warn("message moved to dead letter queue",
				zap.String("message_id", messageID),
				zap.String("original_queue", item.QueueMessage.QueueName),
				zap.Int32("delivery_count", item.QueueMessage.Attempts))
		} else {
			// Requeue with delay
			item.InFlight = false
			item.QueueMessage.RequeuedAt = time.Now().Unix()
			item.QueueMessage.Status = "pending"
			q.queues[item.QueueMessage.QueueName] = append(q.queues[item.QueueMessage.QueueName], item)
			
			q.logger.Debug("message requeued",
				zap.String("message_id", messageID),
				zap.String("queue", item.QueueMessage.QueueName),
				zap.Int32("delivery_count", item.QueueMessage.Attempts))
		}
	}
	
	return nil
}

// GetQueueSize returns the size of a queue
func (q *Queue) GetQueueSize(ctx context.Context, queueName string) (int64, error) {
	if queueName == "" {
		return 0, fmt.Errorf("queue name cannot be empty")
	}
	
	q.mu.RLock()
	defer q.mu.RUnlock()
	
	size := int64(len(q.queues[queueName]))
	return size, nil
}

// GetStats returns queue statistics
func (q *Queue) GetStats(queueName string) (*proto.QueueStats, error) {
	if queueName == "" {
		return nil, fmt.Errorf("queue name cannot be empty")
	}
	
	q.mu.RLock()
	defer q.mu.RUnlock()
	
	queue := q.queues[queueName]
	dlq := q.deadLetterQueue[fmt.Sprintf("dlq_%s", queueName)]
	
	stats := &proto.QueueStats{
		Name:            queueName,
		Size:            int64(len(queue)),
		DlqSize:         int64(len(dlq)),
		ProcessingCount: 0,
		Timestamp:       time.Now().Unix(),
	}
	
	// Count in-flight messages
	for _, item := range queue {
		if item.InFlight {
			stats.ProcessingCount++
		}
	}
	
	return stats, nil
}

// PurgeQueue removes all messages from a queue
func (q *Queue) PurgeQueue(ctx context.Context, queueName string) error {
	if queueName == "" {
		return fmt.Errorf("queue name cannot be empty")
	}
	
	q.mu.Lock()
	defer q.mu.Unlock()
	
	// Get current size for logging
	currentSize := len(q.queues[queueName])
	
	// Clear the queue
	delete(q.queues, queueName)
	
	q.logger.Info("queue purged",
		zap.String("queue", queueName),
		zap.Int("messages_removed", currentSize))
	
	return nil
}

// Close closes the queue
func (q *Queue) Close() error {
	q.logger.Info("closing message queue")
	
	// Cancel context to stop routines
	q.cancel()
	
	// Wait for all goroutines to finish
	q.wg.Wait()
	
	// Persist any remaining messages if enabled
	if q.config.PersistenceEnabled && q.storage != nil {
		if err := q.flushToPersistence(); err != nil {
			q.logger.Error("failed to flush messages to persistence", zap.Error(err))
		}
	}
	
	q.logger.Info("message queue closed")
	return nil
}

// persistenceRoutine handles message persistence
func (q *Queue) persistenceRoutine() {
	defer q.wg.Done()
	
	if !q.config.PersistenceEnabled || q.storage == nil {
		return
	}
	
	ticker := time.NewTicker(q.config.FlushInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			if err := q.flushToPersistence(); err != nil {
				q.logger.Error("failed to flush to persistence", zap.Error(err))
			}
		case <-q.ctx.Done():
			return
		}
	}
}

// cleanupRoutine performs periodic cleanup
func (q *Queue) cleanupRoutine() {
	defer q.wg.Done()
	
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			q.performCleanup()
		case <-q.ctx.Done():
			return
		}
	}
}

// performCleanup removes expired messages and handles timeouts
func (q *Queue) performCleanup() {
	q.mu.Lock()
	defer q.mu.Unlock()
	
	now := time.Now()
	
	// Handle in-flight message timeouts
	for messageID, item := range q.inFlightMessages {
		if now.After(item.AckDeadline) {
			// Timeout - requeue or move to dead letter
			delete(q.inFlightMessages, messageID)
			
			if item.QueueMessage.Attempts >= int32(q.config.DeadLetterThreshold) {
				item.QueueMessage.Status = "dead_letter"
				dlqName := fmt.Sprintf("dlq_%s", item.QueueMessage.QueueName)
				q.deadLetterQueue[dlqName] = append(q.deadLetterQueue[dlqName], item)
				
				q.logger.Warn("in-flight message timed out and moved to DLQ",
					zap.String("message_id", messageID),
					zap.String("queue", item.QueueMessage.QueueName))
			} else {
				// Requeue with delay
				item.InFlight = false
				item.QueueMessage.Status = "pending"
				q.queues[item.QueueMessage.QueueName] = append(q.queues[item.QueueMessage.QueueName], item)
				
				q.logger.Debug("in-flight message timed out and requeued",
					zap.String("message_id", messageID),
					zap.String("queue", item.QueueMessage.QueueName))
			}
		}
	}
	
	// Clean up expired messages
	maxAge := now.Add(-q.config.MaxMessageAge)
	for queueName, queue := range q.queues {
		filteredQueue := make([]*queueItem, 0, len(queue))
		removedCount := 0
		
		for _, item := range queue {
			if time.Unix(item.QueueMessage.EnqueuedAt, 0).After(maxAge) {
				filteredQueue = append(filteredQueue, item)
			} else {
				removedCount++
			}
		}
		
		if removedCount > 0 {
			q.queues[queueName] = filteredQueue
			q.logger.Info("removed expired messages",
				zap.String("queue", queueName),
				zap.Int("count", removedCount))
		}
	}
}

// flushToPersistence saves queue state to persistent storage
func (q *Queue) flushToPersistence() error {
	if q.storage == nil {
		return fmt.Errorf("storage not configured")
	}
	
	// This is a simplified implementation
	// In a real system, you'd use more sophisticated serialization
	
	q.mu.RLock()
	defer q.mu.RUnlock()
	
	// Persist queue metadata and critical messages
	for queueName := range q.queues {
		key := fmt.Sprintf("queue_state:%s", queueName)
		// In a real implementation, you'd serialize the queue state
		if err := q.storage.Store(q.ctx, key, "queue_state"); err != nil {
			return fmt.Errorf("failed to store queue state for %s: %w", queueName, err)
		}
	}
	
	return nil
}