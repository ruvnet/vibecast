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

// StreamService handles streaming functionality
type StreamService struct {
	messageQueue core.MessageQueue
	eventBus     core.EventBus
	logger       *zap.Logger
	
	// Stream management
	streams   map[string]*proto.Stream
	streamsMu sync.RWMutex
	
	// Metrics
	metrics   *StreamMetrics
	metricsMu sync.RWMutex
}

// StreamMetrics holds streaming metrics
type StreamMetrics struct {
	TotalStreams     int64
	ActiveStreams    int64
	MessagesStreamed int64
	BytesStreamed    int64
	LastActivity     time.Time
}

// NewStreamService creates a new stream service
func NewStreamService(queue core.MessageQueue, eventBus core.EventBus, logger *zap.Logger) *StreamService {
	return &StreamService{
		messageQueue: queue,
		eventBus:     eventBus,
		logger:       logger,
		streams:      make(map[string]*proto.Stream),
		metrics:      &StreamMetrics{},
	}
}

// CreateStream creates a new stream
func (ss *StreamService) CreateStream(ctx context.Context, stream *proto.Stream) error {
	ss.streamsMu.Lock()
	defer ss.streamsMu.Unlock()

	// Check if stream already exists
	if _, exists := ss.streams[stream.Id]; exists {
		return fmt.Errorf("stream %s already exists", stream.Id)
	}

	// Initialize stream
	stream.CreatedAt = time.Now().Unix()
	stream.UpdatedAt = time.Now().Unix()
	stream.Status = "created"
	stream.Metrics = &proto.StreamMetrics{
		MessageCount:    0,
		ByteCount:       0,
		SubscriberCount: 0,
		Throughput:      0,
		Latency:         0,
		ErrorRate:       0,
		LastActivity:    time.Now().Unix(),
	}

	ss.streams[stream.Id] = stream

	ss.metricsMu.Lock()
	ss.metrics.TotalStreams++
	ss.metrics.LastActivity = time.Now()
	ss.metricsMu.Unlock()

	// Emit stream creation event
	if err := ss.eventBus.Emit(ctx, &proto.Event{
		Type:   "stream.created",
		Source: "stream_service",
		Data: map[string]interface{}{
			"stream_id":   stream.Id,
			"stream_name": stream.Name,
		},
	}); err != nil {
		ss.logger.Error("Failed to emit stream creation event", zap.Error(err))
	}

	ss.logger.Info("Stream created",
		zap.String("stream_id", stream.Id),
		zap.String("name", stream.Name),
	)

	return nil
}

// StartStream starts a stream
func (ss *StreamService) StartStream(ctx context.Context, streamID string) error {
	ss.streamsMu.Lock()
	stream, exists := ss.streams[streamID]
	if !exists {
		ss.streamsMu.Unlock()
		return fmt.Errorf("stream %s not found", streamID)
	}

	if stream.Status == "active" {
		ss.streamsMu.Unlock()
		return fmt.Errorf("stream %s is already active", streamID)
	}

	stream.Status = "active"
	stream.UpdatedAt = time.Now().Unix()
	ss.streamsMu.Unlock()

	ss.metricsMu.Lock()
	ss.metrics.ActiveStreams++
	ss.metrics.LastActivity = time.Now()
	ss.metricsMu.Unlock()

	// Emit stream started event
	if err := ss.eventBus.Emit(ctx, &proto.Event{
		Type:   "stream.started",
		Source: "stream_service",
		Data: map[string]interface{}{
			"stream_id": streamID,
		},
	}); err != nil {
		ss.logger.Error("Failed to emit stream started event", zap.Error(err))
	}

	ss.logger.Info("Stream started", zap.String("stream_id", streamID))
	return nil
}

// StopStream stops a stream
func (ss *StreamService) StopStream(ctx context.Context, streamID string) error {
	ss.streamsMu.Lock()
	stream, exists := ss.streams[streamID]
	if !exists {
		ss.streamsMu.Unlock()
		return fmt.Errorf("stream %s not found", streamID)
	}

	if stream.Status != "active" {
		ss.streamsMu.Unlock()
		return fmt.Errorf("stream %s is not active", streamID)
	}

	stream.Status = "stopped"
	stream.UpdatedAt = time.Now().Unix()
	ss.streamsMu.Unlock()

	ss.metricsMu.Lock()
	if ss.metrics.ActiveStreams > 0 {
		ss.metrics.ActiveStreams--
	}
	ss.metrics.LastActivity = time.Now()
	ss.metricsMu.Unlock()

	// Emit stream stopped event
	if err := ss.eventBus.Emit(ctx, &proto.Event{
		Type:   "stream.stopped",
		Source: "stream_service",
		Data: map[string]interface{}{
			"stream_id": streamID,
		},
	}); err != nil {
		ss.logger.Error("Failed to emit stream stopped event", zap.Error(err))
	}

	ss.logger.Info("Stream stopped", zap.String("stream_id", streamID))
	return nil
}

// GetStreamStatus returns the status of a stream
func (ss *StreamService) GetStreamStatus(ctx context.Context, streamID string) (*proto.Stream, error) {
	ss.streamsMu.RLock()
	defer ss.streamsMu.RUnlock()

	stream, exists := ss.streams[streamID]
	if !exists {
		return nil, fmt.Errorf("stream %s not found", streamID)
	}

	// Return a copy to avoid race conditions
	streamCopy := *stream
	if stream.Metrics != nil {
		metricsCopy := *stream.Metrics
		streamCopy.Metrics = &metricsCopy
	}

	return &streamCopy, nil
}

// ListStreams lists all streams
func (ss *StreamService) ListStreams(ctx context.Context) ([]*proto.Stream, error) {
	ss.streamsMu.RLock()
	defer ss.streamsMu.RUnlock()

	streams := make([]*proto.Stream, 0, len(ss.streams))
	for _, stream := range ss.streams {
		streamCopy := *stream
		if stream.Metrics != nil {
			metricsCopy := *stream.Metrics
			streamCopy.Metrics = &metricsCopy
		}
		streams = append(streams, &streamCopy)
	}

	return streams, nil
}

// PushData pushes data to a stream
func (ss *StreamService) PushData(ctx context.Context, streamID string, data *proto.StreamData) error {
	// Check if stream exists and is active
	ss.streamsMu.RLock()
	stream, exists := ss.streams[streamID]
	if !exists {
		ss.streamsMu.RUnlock()
		return fmt.Errorf("stream %s not found", streamID)
	}

	if stream.Status != "active" {
		ss.streamsMu.RUnlock()
		return fmt.Errorf("stream %s is not active", streamID)
	}
	ss.streamsMu.RUnlock()

	// Set stream ID and timestamp if not provided
	if data.StreamId == "" {
		data.StreamId = streamID
	}
	if data.Timestamp == 0 {
		data.Timestamp = time.Now().Unix()
	}

	// Convert stream data to message for queuing
	timestamp := time.Unix(data.Timestamp, 0)
	message := &proto.Message{
		ID:        fmt.Sprintf("stream_data_%d", time.Now().UnixNano()),
		Topic:     fmt.Sprintf("stream.%s", streamID),
		Data:      data.Data,
		Timestamp: &timestamp,
		Headers: map[string]string{
			"sender":    "stream_service",
			"type":      "stream_data",
			"stream_id": streamID,
			"sequence":  fmt.Sprintf("%d", data.Sequence),
		},
	}

	// Enqueue message for processing
	queueName := fmt.Sprintf("stream_%s", streamID)
	if err := ss.messageQueue.Enqueue(ctx, queueName, message); err != nil {
		return fmt.Errorf("failed to enqueue stream data: %w", err)
	}

	// Update stream metrics
	ss.streamsMu.Lock()
	if s, exists := ss.streams[streamID]; exists && s.Metrics != nil {
		s.Metrics.MessageCount++
		s.Metrics.ByteCount += int64(len(data.Data))
		s.Metrics.LastActivity = time.Now().Unix()
		s.UpdatedAt = time.Now().Unix()
	}
	ss.streamsMu.Unlock()

	ss.metricsMu.Lock()
	ss.metrics.MessagesStreamed++
	ss.metrics.BytesStreamed += int64(len(data.Data))
	ss.metrics.LastActivity = time.Now()
	ss.metricsMu.Unlock()

	// Emit data pushed event
	if err := ss.eventBus.Emit(ctx, &proto.Event{
		Type:   "stream.data_pushed",
		Source: "stream_service",
		Data: map[string]interface{}{
			"stream_id": streamID,
			"sequence":  data.Sequence,
			"size":      len(data.Data),
		},
	}); err != nil {
		ss.logger.Error("Failed to emit data pushed event", zap.Error(err))
	}

	ss.logger.Debug("Data pushed to stream",
		zap.String("stream_id", streamID),
		zap.Int64("sequence", data.Sequence),
		zap.Int("size", len(data.Data)),
	)

	return nil
}

// ConsumeData consumes data from a stream
func (ss *StreamService) ConsumeData(ctx context.Context, streamID string, timeout time.Duration) (*proto.StreamData, error) {
	// Check if stream exists
	ss.streamsMu.RLock()
	_, exists := ss.streams[streamID]
	if !exists {
		ss.streamsMu.RUnlock()
		return nil, fmt.Errorf("stream %s not found", streamID)
	}
	ss.streamsMu.RUnlock()

	// Dequeue message from stream queue
	queueName := fmt.Sprintf("stream_%s", streamID)
	queueMsg, err := ss.messageQueue.Dequeue(ctx, queueName, timeout)
	if err != nil {
		return nil, fmt.Errorf("failed to dequeue stream data: %w", err)
	}

	if queueMsg == nil {
		return nil, nil // No data available
	}

	// Convert message back to stream data
	streamData := &proto.StreamData{
		StreamId:  streamID,
		Timestamp: queueMsg.Message.Timestamp.Unix(),
		Data:      []byte(string(queueMsg.Message.Data)),
		Metadata:  make(map[string]interface{}),
	}

	// Extract sequence from headers
	if seq, exists := queueMsg.Message.Headers["sequence"]; exists {
		fmt.Sscanf(seq, "%d", &streamData.Sequence)
	}

	// Acknowledge message
	if err := ss.messageQueue.Ack(ctx, queueMsg.Id); err != nil {
		ss.logger.Error("Failed to acknowledge stream message",
			zap.String("queue_message_id", queueMsg.Id),
			zap.Error(err),
		)
	}

	ss.logger.Debug("Data consumed from stream",
		zap.String("stream_id", streamID),
		zap.Int64("sequence", streamData.Sequence),
		zap.Int("size", len(streamData.Data)),
	)

	return streamData, nil
}

// DeleteStream deletes a stream
func (ss *StreamService) DeleteStream(ctx context.Context, streamID string) error {
	ss.streamsMu.Lock()
	stream, exists := ss.streams[streamID]
	if !exists {
		ss.streamsMu.Unlock()
		return fmt.Errorf("stream %s not found", streamID)
	}

	// Stop stream if active
	wasActive := stream.Status == "active"
	stream.Status = "deleted"
	stream.UpdatedAt = time.Now().Unix()
	delete(ss.streams, streamID)
	ss.streamsMu.Unlock()

	ss.metricsMu.Lock()
	if ss.metrics.TotalStreams > 0 {
		ss.metrics.TotalStreams--
	}
	if wasActive && ss.metrics.ActiveStreams > 0 {
		ss.metrics.ActiveStreams--
	}
	ss.metrics.LastActivity = time.Now()
	ss.metricsMu.Unlock()

	// Purge stream queue
	queueName := fmt.Sprintf("stream_%s", streamID)
	if err := ss.messageQueue.PurgeQueue(ctx, queueName); err != nil {
		ss.logger.Error("Failed to purge stream queue",
			zap.String("stream_id", streamID),
			zap.Error(err),
		)
	}

	// Emit stream deletion event
	if err := ss.eventBus.Emit(ctx, &proto.Event{
		Type:   "stream.deleted",
		Source: "stream_service",
		Data: map[string]interface{}{
			"stream_id": streamID,
		},
	}); err != nil {
		ss.logger.Error("Failed to emit stream deletion event", zap.Error(err))
	}

	ss.logger.Info("Stream deleted", zap.String("stream_id", streamID))
	return nil
}

// GetMetrics returns stream service metrics
func (ss *StreamService) GetMetrics() *StreamMetrics {
	ss.metricsMu.RLock()
	defer ss.metricsMu.RUnlock()

	// Return a copy to avoid race conditions
	return &StreamMetrics{
		TotalStreams:     ss.metrics.TotalStreams,
		ActiveStreams:    ss.metrics.ActiveStreams,
		MessagesStreamed: ss.metrics.MessagesStreamed,
		BytesStreamed:    ss.metrics.BytesStreamed,
		LastActivity:     ss.metrics.LastActivity,
	}
}

// CalculateMetrics calculates and updates stream metrics
func (ss *StreamService) CalculateMetrics(ctx context.Context) {
	ss.streamsMu.Lock()
	defer ss.streamsMu.Unlock()

	now := time.Now()
	for _, stream := range ss.streams {
		if stream.Metrics == nil {
			continue
		}

		// Calculate throughput (messages per second)
		if stream.Metrics.LastActivity > 0 {
			lastActivity := time.Unix(stream.Metrics.LastActivity, 0)
			timeDiff := now.Sub(lastActivity).Seconds()
			if timeDiff > 0 {
				stream.Metrics.Throughput = float64(stream.Metrics.MessageCount) / timeDiff
			}
		}

		// Update last calculation time
		stream.UpdatedAt = now.Unix()
	}
}