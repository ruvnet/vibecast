package queue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/services"
	"go.uber.org/zap"
)

// MessageConsumer consumes messages from queues for processing
type MessageConsumer struct {
	detector          core.AnomalyDetector
	processingService *services.ProcessingService
	logger            *zap.Logger
	
	// Consumer management
	running   bool
	mu        sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// NewMessageConsumer creates a new message consumer
func NewMessageConsumer(detector core.AnomalyDetector, processingService *services.ProcessingService, logger *zap.Logger) *MessageConsumer {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &MessageConsumer{
		detector:          detector,
		processingService: processingService,
		logger:            logger,
		ctx:               ctx,
		cancel:            cancel,
	}
}

// Start starts the message consumer
func (mc *MessageConsumer) Start(ctx context.Context) error {
	mc.mu.Lock()
	if mc.running {
		mc.mu.Unlock()
		return fmt.Errorf("message consumer is already running")
	}
	mc.running = true
	mc.mu.Unlock()

	mc.logger.Info("Starting message consumer")

	// Register processors
	mc.processingService.RegisterProcessor(services.NewValidationProcessor())
	mc.processingService.RegisterProcessor(services.NewBasicMessageProcessor("anomaly_detection"))
	mc.processingService.RegisterProcessor(services.NewEnrichmentProcessor())

	// Start processing workers for different queues
	queues := []string{
		"messages",
		"priority_messages", 
		"system_messages",
		"notifications",
	}

	for _, queueName := range queues {
		mc.wg.Add(1)
		go mc.processQueueWorker(queueName)
	}

	mc.logger.Info("Message consumer started successfully")
	return nil
}

// Stop stops the message consumer
func (mc *MessageConsumer) Stop() {
	mc.mu.Lock()
	if !mc.running {
		mc.mu.Unlock()
		return
	}
	mc.running = false
	mc.mu.Unlock()

	mc.logger.Info("Stopping message consumer")

	// Cancel context to stop workers
	mc.cancel()

	// Wait for all workers to finish
	mc.wg.Wait()

	mc.logger.Info("Message consumer stopped")
}

// processQueueWorker processes messages from a specific queue
func (mc *MessageConsumer) processQueueWorker(queueName string) {
	defer mc.wg.Done()

	mc.logger.Info("Starting queue worker", zap.String("queue", queueName))

	timeout := 30 * time.Second
	if err := mc.processingService.ProcessQueue(mc.ctx, queueName, timeout); err != nil {
		if err != context.Canceled {
			mc.logger.Error("Queue worker error",
				zap.String("queue", queueName),
				zap.Error(err),
			)
		}
	}

	mc.logger.Info("Queue worker stopped", zap.String("queue", queueName))
}

// BroadcastConsumer consumes broadcast messages
type BroadcastConsumer struct {
	broadcastService *services.BroadcastService
	logger           *zap.Logger
	
	// Consumer management
	running bool
	mu      sync.RWMutex
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// NewBroadcastConsumer creates a new broadcast consumer
func NewBroadcastConsumer(broadcastService *services.BroadcastService, logger *zap.Logger) *BroadcastConsumer {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &BroadcastConsumer{
		broadcastService: broadcastService,
		logger:           logger,
		ctx:              ctx,
		cancel:           cancel,
	}
}

// Start starts the broadcast consumer
func (bc *BroadcastConsumer) Start(ctx context.Context) error {
	bc.mu.Lock()
	if bc.running {
		bc.mu.Unlock()
		return fmt.Errorf("broadcast consumer is already running")
	}
	bc.running = true
	bc.mu.Unlock()

	bc.logger.Info("Starting broadcast consumer")

	// Start broadcast monitoring
	bc.wg.Add(1)
	go bc.monitorBroadcasts()

	bc.logger.Info("Broadcast consumer started successfully")
	return nil
}

// Stop stops the broadcast consumer
func (bc *BroadcastConsumer) Stop() {
	bc.mu.Lock()
	if !bc.running {
		bc.mu.Unlock()
		return
	}
	bc.running = false
	bc.mu.Unlock()

	bc.logger.Info("Stopping broadcast consumer")

	// Cancel context to stop workers
	bc.cancel()

	// Wait for all workers to finish
	bc.wg.Wait()

	bc.logger.Info("Broadcast consumer stopped")
}

// monitorBroadcasts monitors broadcast activity
func (bc *BroadcastConsumer) monitorBroadcasts() {
	defer bc.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := bc.broadcastService.GetMetrics()
			bc.logger.Debug("Broadcast metrics",
				zap.Int64("total_channels", metrics.TotalChannels),
				zap.Int64("total_subscriptions", metrics.TotalSubscriptions),
				zap.Int64("messages_broadcast", metrics.MessagesBroadcast),
				zap.Int64("messages_delivered", metrics.MessagesDelivered),
			)
		case <-bc.ctx.Done():
			return
		}
	}
}

// StreamConsumer consumes stream messages
type StreamConsumer struct {
	streamService *services.StreamService
	logger        *zap.Logger
	
	// Consumer management
	running bool
	mu      sync.RWMutex
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// NewStreamConsumer creates a new stream consumer
func NewStreamConsumer(streamService *services.StreamService, logger *zap.Logger) *StreamConsumer {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &StreamConsumer{
		streamService: streamService,
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Start starts the stream consumer
func (sc *StreamConsumer) Start(ctx context.Context) error {
	sc.mu.Lock()
	if sc.running {
		sc.mu.Unlock()
		return fmt.Errorf("stream consumer is already running")
	}
	sc.running = true
	sc.mu.Unlock()

	sc.logger.Info("Starting stream consumer")

	// Start stream monitoring and metrics calculation
	sc.wg.Add(1)
	go sc.monitorStreams()

	sc.wg.Add(1)
	go sc.calculateMetrics()

	sc.logger.Info("Stream consumer started successfully")
	return nil
}

// Stop stops the stream consumer
func (sc *StreamConsumer) Stop() {
	sc.mu.Lock()
	if !sc.running {
		sc.mu.Unlock()
		return
	}
	sc.running = false
	sc.mu.Unlock()

	sc.logger.Info("Stopping stream consumer")

	// Cancel context to stop workers
	sc.cancel()

	// Wait for all workers to finish
	sc.wg.Wait()

	sc.logger.Info("Stream consumer stopped")
}

// monitorStreams monitors stream activity
func (sc *StreamConsumer) monitorStreams() {
	defer sc.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := sc.streamService.GetMetrics()
			sc.logger.Debug("Stream metrics",
				zap.Int64("total_streams", metrics.TotalStreams),
				zap.Int64("active_streams", metrics.ActiveStreams),
				zap.Int64("messages_streamed", metrics.MessagesStreamed),
				zap.Int64("bytes_streamed", metrics.BytesStreamed),
			)
		case <-sc.ctx.Done():
			return
		}
	}
}

// calculateMetrics periodically calculates stream metrics
func (sc *StreamConsumer) calculateMetrics() {
	defer sc.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sc.streamService.CalculateMetrics(sc.ctx)
		case <-sc.ctx.Done():
			return
		}
	}
}