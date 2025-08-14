package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/models/proto"
	"go.uber.org/zap"
)

// ProcessingService handles message processing functionality
type ProcessingService struct {
	messageQueue core.MessageQueue
	eventBus     core.EventBus
	logger       *zap.Logger
	
	// Processing pipeline
	processors []MessageProcessor
	
	// Metrics
	metrics   *ProcessingMetrics
	metricsMu sync.RWMutex
	
	// Worker management
	workers   map[string]*ProcessingWorker
	workersMu sync.RWMutex
}

// ProcessingMetrics holds processing metrics
type ProcessingMetrics struct {
	TotalProcessed   int64
	TotalFailed      int64
	AverageLatency   float64
	ActiveWorkers    int64
	QueuedMessages   int64
	LastActivity     time.Time
}

// MessageProcessor defines interface for message processors
type MessageProcessor interface {
	Process(ctx context.Context, msg *proto.Message) (*proto.Message, error)
	Name() string
}

// ProcessingWorker represents a processing worker
type ProcessingWorker struct {
	ID       string
	Status   string
	Created  time.Time
	LastSeen time.Time
	Processed int64
	Failed    int64
}

// NewProcessingService creates a new processing service
func NewProcessingService(queue core.MessageQueue, eventBus core.EventBus, logger *zap.Logger) *ProcessingService {
	return &ProcessingService{
		messageQueue: queue,
		eventBus:     eventBus,
		logger:       logger,
		processors:   make([]MessageProcessor, 0),
		metrics:      &ProcessingMetrics{},
		workers:      make(map[string]*ProcessingWorker),
	}
}

// RegisterProcessor registers a message processor
func (ps *ProcessingService) RegisterProcessor(processor MessageProcessor) {
	ps.processors = append(ps.processors, processor)
	ps.logger.Info("Message processor registered", zap.String("name", processor.Name()))
}

// ProcessMessage processes a single message through the pipeline
func (ps *ProcessingService) ProcessMessage(ctx context.Context, msg *proto.Message) (*proto.Message, error) {
	startTime := time.Now()
	processedMsg := msg
	var err error

	// Process through each registered processor
	for _, processor := range ps.processors {
		processedMsg, err = processor.Process(ctx, processedMsg)
		if err != nil {
			ps.incrementFailed()
			
			// Emit processing error event
			if eventErr := ps.eventBus.Emit(ctx, &proto.Event{
				Type:   "processing.error",
				Source: "processing_service",
				Data: map[string]interface{}{
					"message_id":     msg.ID,
					"processor_name": processor.Name(),
					"error":          err.Error(),
				},
			}); eventErr != nil {
				ps.logger.Error("Failed to emit processing error event", zap.Error(eventErr))
			}

			return nil, fmt.Errorf("processing failed at %s: %w", processor.Name(), err)
		}
	}

	// Update metrics
	latency := time.Since(startTime).Milliseconds()
	ps.updateProcessingMetrics(latency)

	// Emit processing success event
	if err := ps.eventBus.Emit(ctx, &proto.Event{
		Type:   "processing.completed",
		Source: "processing_service",
		Data: map[string]interface{}{
			"message_id": msg.ID,
			"latency_ms": latency,
		},
	}); err != nil {
		ps.logger.Error("Failed to emit processing completed event", zap.Error(err))
	}

	ps.logger.Debug("Message processed successfully",
		zap.String("message_id", msg.ID),
		zap.Int64("latency_ms", latency),
	)

	return processedMsg, nil
}

// ProcessQueue processes messages from a specific queue
func (ps *ProcessingService) ProcessQueue(ctx context.Context, queueName string, timeout time.Duration) error {
	workerID := fmt.Sprintf("worker_%s_%d", queueName, time.Now().UnixNano())
	
	// Register worker
	ps.registerWorker(workerID)
	defer ps.unregisterWorker(workerID)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// Dequeue message
			queueMsg, err := ps.messageQueue.Dequeue(ctx, queueName, timeout)
			if err != nil {
				ps.logger.Error("Failed to dequeue message",
					zap.String("queue", queueName),
					zap.Error(err),
				)
				continue
			}

			if queueMsg == nil {
				continue // No messages available
			}

			// Process message
			processedMsg, err := ps.ProcessMessage(ctx, queueMsg.Message)
			if err != nil {
				ps.logger.Error("Failed to process message",
					zap.String("queue_message_id", queueMsg.Id),
					zap.String("message_id", queueMsg.Message.ID),
					zap.Error(err),
				)

				// Negative acknowledge for requeuing
				if nackErr := ps.messageQueue.Nack(ctx, queueMsg.Id, true); nackErr != nil {
					ps.logger.Error("Failed to nack message",
						zap.String("queue_message_id", queueMsg.Id),
						zap.Error(nackErr),
					)
				}
				continue
			}

			// Handle processed message (could be different from original)
			if processedMsg != nil {
				// If message was transformed, emit transformed event
				if processedMsg.ID != queueMsg.Message.ID {
					if err := ps.eventBus.Emit(ctx, &proto.Event{
						Type:   "message.transformed",
						Source: "processing_service",
						Data: map[string]interface{}{
							"original_id":   queueMsg.Message.ID,
							"transformed_id": processedMsg.ID,
						},
					}); err != nil {
						ps.logger.Error("Failed to emit transformation event", zap.Error(err))
					}
				}
			}

			// Acknowledge successful processing
			if err := ps.messageQueue.Ack(ctx, queueMsg.Id); err != nil {
				ps.logger.Error("Failed to acknowledge message",
					zap.String("queue_message_id", queueMsg.Id),
					zap.Error(err),
				)
			}

			// Update worker activity
			ps.updateWorkerActivity(workerID)
		}
	}
}

// registerWorker registers a new processing worker
func (ps *ProcessingService) registerWorker(workerID string) {
	ps.workersMu.Lock()
	defer ps.workersMu.Unlock()

	worker := &ProcessingWorker{
		ID:       workerID,
		Status:   "active",
		Created:  time.Now(),
		LastSeen: time.Now(),
		Processed: 0,
		Failed:    0,
	}

	ps.workers[workerID] = worker

	ps.metricsMu.Lock()
	ps.metrics.ActiveWorkers++
	ps.metricsMu.Unlock()

	ps.logger.Info("Processing worker registered", zap.String("worker_id", workerID))
}

// unregisterWorker unregisters a processing worker
func (ps *ProcessingService) unregisterWorker(workerID string) {
	ps.workersMu.Lock()
	worker, exists := ps.workers[workerID]
	if exists {
		worker.Status = "inactive"
		delete(ps.workers, workerID)
	}
	ps.workersMu.Unlock()

	if exists {
		ps.metricsMu.Lock()
		if ps.metrics.ActiveWorkers > 0 {
			ps.metrics.ActiveWorkers--
		}
		ps.metricsMu.Unlock()

		ps.logger.Info("Processing worker unregistered",
			zap.String("worker_id", workerID),
			zap.Int64("processed", worker.Processed),
			zap.Int64("failed", worker.Failed),
		)
	}
}

// updateWorkerActivity updates worker last seen time
func (ps *ProcessingService) updateWorkerActivity(workerID string) {
	ps.workersMu.Lock()
	defer ps.workersMu.Unlock()

	if worker, exists := ps.workers[workerID]; exists {
		worker.LastSeen = time.Now()
		worker.Processed++
	}
}

// updateProcessingMetrics updates processing metrics
func (ps *ProcessingService) updateProcessingMetrics(latencyMs int64) {
	ps.metricsMu.Lock()
	defer ps.metricsMu.Unlock()

	ps.metrics.TotalProcessed++
	
	// Calculate moving average latency
	if ps.metrics.AverageLatency == 0 {
		ps.metrics.AverageLatency = float64(latencyMs)
	} else {
		ps.metrics.AverageLatency = (ps.metrics.AverageLatency*0.9) + (float64(latencyMs)*0.1)
	}
	
	ps.metrics.LastActivity = time.Now()
}

// incrementFailed increments failed processing count
func (ps *ProcessingService) incrementFailed() {
	ps.metricsMu.Lock()
	defer ps.metricsMu.Unlock()

	ps.metrics.TotalFailed++
	ps.metrics.LastActivity = time.Now()
}

// GetMetrics returns processing service metrics
func (ps *ProcessingService) GetMetrics() *ProcessingMetrics {
	ps.metricsMu.RLock()
	defer ps.metricsMu.RUnlock()

	// Return a copy to avoid race conditions
	return &ProcessingMetrics{
		TotalProcessed:  ps.metrics.TotalProcessed,
		TotalFailed:     ps.metrics.TotalFailed,
		AverageLatency:  ps.metrics.AverageLatency,
		ActiveWorkers:   ps.metrics.ActiveWorkers,
		QueuedMessages:  ps.metrics.QueuedMessages,
		LastActivity:    ps.metrics.LastActivity,
	}
}

// GetWorkers returns information about active workers
func (ps *ProcessingService) GetWorkers() map[string]*ProcessingWorker {
	ps.workersMu.RLock()
	defer ps.workersMu.RUnlock()

	workers := make(map[string]*ProcessingWorker)
	for id, worker := range ps.workers {
		workerCopy := *worker
		workers[id] = &workerCopy
	}

	return workers
}

// BasicMessageProcessor is a simple message processor implementation
type BasicMessageProcessor struct {
	name string
}

// NewBasicMessageProcessor creates a new basic message processor
func NewBasicMessageProcessor(name string) *BasicMessageProcessor {
	return &BasicMessageProcessor{name: name}
}

// Process processes a message (basic implementation)
func (bmp *BasicMessageProcessor) Process(ctx context.Context, msg *proto.Message) (*proto.Message, error) {
	// Basic processing: add processing timestamp
	if msg.Headers == nil {
		msg.Headers = make(map[string]string)
	}
	
	msg.Headers[fmt.Sprintf("processed_by_%s", bmp.name)] = fmt.Sprintf("%d", time.Now().Unix())
	
	return msg, nil
}

// Name returns the processor name
func (bmp *BasicMessageProcessor) Name() string {
	return bmp.name
}

// ValidationProcessor validates message format
type ValidationProcessor struct{}

// NewValidationProcessor creates a new validation processor
func NewValidationProcessor() *ValidationProcessor {
	return &ValidationProcessor{}
}

// Process validates the message format
func (vp *ValidationProcessor) Process(ctx context.Context, msg *proto.Message) (*proto.Message, error) {
	// Validate required fields
	if msg.ID == "" {
		return nil, fmt.Errorf("message ID is required")
	}
	
	if len(msg.Data) == 0 {
		return nil, fmt.Errorf("message data is required")
	}
	
	if msg.Timestamp == nil {
		now := time.Now()
		msg.Timestamp = &now
	}
	
	return msg, nil
}

// Name returns the processor name
func (vp *ValidationProcessor) Name() string {
	return "validation"
}

// EnrichmentProcessor enriches messages with additional data
type EnrichmentProcessor struct{}

// NewEnrichmentProcessor creates a new enrichment processor
func NewEnrichmentProcessor() *EnrichmentProcessor {
	return &EnrichmentProcessor{}
}

// Process enriches the message with additional metadata
func (ep *EnrichmentProcessor) Process(ctx context.Context, msg *proto.Message) (*proto.Message, error) {
	if msg.Headers == nil {
		msg.Headers = make(map[string]string)
	}
	
	// Add enrichment metadata
	msg.Headers["enriched_at"] = fmt.Sprintf("%d", time.Now().Unix())
	msg.Headers["processor_version"] = "1.0.0"
	
	// Add content hash for integrity
	msg.Headers["content_hash"] = fmt.Sprintf("%x", len(msg.Data))
	
	return msg, nil
}

// Name returns the processor name
func (ep *EnrichmentProcessor) Name() string {
	return "enrichment"
}