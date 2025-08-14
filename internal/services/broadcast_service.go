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

// BroadcastService handles broadcasting functionality
type BroadcastService struct {
	messageBroker core.MessageBroker
	eventBus      core.EventBus
	logger        *zap.Logger
	
	// Channel management
	channels map[string]*proto.Channel
	channelsMu sync.RWMutex
	
	// Subscription management
	subscriptions map[string]*proto.Subscription
	subscriptionsMu sync.RWMutex
	
	// Metrics
	metrics *BroadcastMetrics
	metricsMu sync.RWMutex
}

// BroadcastMetrics holds broadcasting metrics
type BroadcastMetrics struct {
	TotalChannels      int64
	TotalSubscriptions int64
	MessagesBroadcast  int64
	MessagesDelivered  int64
	LastActivity       time.Time
}

// NewBroadcastService creates a new broadcast service
func NewBroadcastService(broker core.MessageBroker, eventBus core.EventBus, logger *zap.Logger) *BroadcastService {
	return &BroadcastService{
		messageBroker:   broker,
		eventBus:        eventBus,
		logger:          logger,
		channels:        make(map[string]*proto.Channel),
		subscriptions:   make(map[string]*proto.Subscription),
		metrics:         &BroadcastMetrics{},
	}
}

// CreateChannel creates a new broadcast channel
func (bs *BroadcastService) CreateChannel(ctx context.Context, channelID, name, description string) (*proto.Channel, error) {
	bs.channelsMu.Lock()
	defer bs.channelsMu.Unlock()

	// Check if channel already exists
	if _, exists := bs.channels[channelID]; exists {
		return nil, fmt.Errorf("channel %s already exists", channelID)
	}

	channel := &proto.Channel{
		Id:              channelID,
		Name:            name,
		Description:     description,
		Status:          "active",
		CreatedAt:       time.Now().Unix(),
		UpdatedAt:       time.Now().Unix(),
		SubscriberCount: 0,
		Config:          make(map[string]string),
		TTL:             3600, // Default 1 hour TTL
	}

	bs.channels[channelID] = channel

	bs.metricsMu.Lock()
	bs.metrics.TotalChannels++
	bs.metrics.LastActivity = time.Now()
	bs.metricsMu.Unlock()

	// Emit channel creation event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "channel.created",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"channel_id":   channelID,
			"channel_name": name,
		},
	}); err != nil {
		bs.logger.Error("Failed to emit channel creation event", zap.Error(err))
	}

	bs.logger.Info("Channel created",
		zap.String("channel_id", channelID),
		zap.String("name", name),
	)

	return channel, nil
}

// GetChannel retrieves a channel by ID
func (bs *BroadcastService) GetChannel(ctx context.Context, channelID string) (*proto.Channel, error) {
	bs.channelsMu.RLock()
	defer bs.channelsMu.RUnlock()

	channel, exists := bs.channels[channelID]
	if !exists {
		return nil, fmt.Errorf("channel %s not found", channelID)
	}

	// Return a copy to avoid race conditions
	channelCopy := *channel
	return &channelCopy, nil
}

// ListChannels lists all active channels
func (bs *BroadcastService) ListChannels(ctx context.Context) ([]*proto.Channel, error) {
	bs.channelsMu.RLock()
	defer bs.channelsMu.RUnlock()

	channels := make([]*proto.Channel, 0, len(bs.channels))
	for _, channel := range bs.channels {
		if channel.Status == "active" {
			channelCopy := *channel
			channels = append(channels, &channelCopy)
		}
	}

	return channels, nil
}

// Subscribe subscribes a user to a channel
func (bs *BroadcastService) Subscribe(ctx context.Context, userID, channelID string) (*proto.Subscription, error) {
	// Check if channel exists
	bs.channelsMu.RLock()
	_, exists := bs.channels[channelID]
	if !exists {
		bs.channelsMu.RUnlock()
		return nil, fmt.Errorf("channel %s not found", channelID)
	}
	bs.channelsMu.RUnlock()

	subscriptionID := fmt.Sprintf("sub_%s_%s_%d", userID, channelID, time.Now().UnixNano())

	subscription := &proto.Subscription{
		Id:         subscriptionID,
		UserId:     userID,
		ResourceId: channelID,
		Type:       "channel",
		Status:     "active",
		CreatedAt:  time.Now().Unix(),
		UpdatedAt:  time.Now().Unix(),
		Config:     make(map[string]string),
	}

	bs.subscriptionsMu.Lock()
	bs.subscriptions[subscriptionID] = subscription
	bs.subscriptionsMu.Unlock()

	// Update channel subscriber count
	bs.channelsMu.Lock()
	if ch, exists := bs.channels[channelID]; exists {
		ch.SubscriberCount++
		ch.UpdatedAt = time.Now().Unix()
	}
	bs.channelsMu.Unlock()

	bs.metricsMu.Lock()
	bs.metrics.TotalSubscriptions++
	bs.metrics.LastActivity = time.Now()
	bs.metricsMu.Unlock()

	// Subscribe to channel messages via message broker
	topic := fmt.Sprintf("channel.%s", channelID)
	_, err := bs.messageBroker.Subscribe(ctx, topic, func(ctx context.Context, msg *proto.Message) error {
		return bs.handleChannelMessage(ctx, userID, channelID, msg)
	})

	if err != nil {
		return nil, fmt.Errorf("failed to subscribe to channel messages: %w", err)
	}

	// Emit subscription event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "channel.subscribed",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"user_id":        userID,
			"channel_id":     channelID,
			"subscription_id": subscriptionID,
		},
	}); err != nil {
		bs.logger.Error("Failed to emit subscription event", zap.Error(err))
	}

	bs.logger.Info("User subscribed to channel",
		zap.String("user_id", userID),
		zap.String("channel_id", channelID),
		zap.String("subscription_id", subscriptionID),
	)

	return subscription, nil
}

// Unsubscribe unsubscribes a user from a channel
func (bs *BroadcastService) Unsubscribe(ctx context.Context, subscriptionID string) error {
	bs.subscriptionsMu.Lock()
	subscription, exists := bs.subscriptions[subscriptionID]
	if !exists {
		bs.subscriptionsMu.Unlock()
		return fmt.Errorf("subscription %s not found", subscriptionID)
	}

	subscription.Status = "inactive"
	subscription.UpdatedAt = time.Now().Unix()
	delete(bs.subscriptions, subscriptionID)
	bs.subscriptionsMu.Unlock()

	// Update channel subscriber count
	bs.channelsMu.Lock()
	if channel, exists := bs.channels[subscription.ResourceId]; exists {
		if channel.SubscriberCount > 0 {
			channel.SubscriberCount--
		}
		channel.UpdatedAt = time.Now().Unix()
	}
	bs.channelsMu.Unlock()

	bs.metricsMu.Lock()
	if bs.metrics.TotalSubscriptions > 0 {
		bs.metrics.TotalSubscriptions--
	}
	bs.metrics.LastActivity = time.Now()
	bs.metricsMu.Unlock()

	// Emit unsubscription event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "channel.unsubscribed",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"user_id":         subscription.UserId,
			"channel_id":      subscription.ResourceId,
			"subscription_id": subscriptionID,
		},
	}); err != nil {
		bs.logger.Error("Failed to emit unsubscription event", zap.Error(err))
	}

	bs.logger.Info("User unsubscribed from channel",
		zap.String("user_id", subscription.UserId),
		zap.String("channel_id", subscription.ResourceId),
		zap.String("subscription_id", subscriptionID),
	)

	return nil
}

// Broadcast broadcasts a message to a channel
func (bs *BroadcastService) Broadcast(ctx context.Context, channelID string, message *proto.Message) error {
	// Check if channel exists and is active
	bs.channelsMu.RLock()
	channel, exists := bs.channels[channelID]
	if !exists || channel.Status != "active" {
		bs.channelsMu.RUnlock()
		return fmt.Errorf("channel %s not found or inactive", channelID)
	}
	bs.channelsMu.RUnlock()

	// Set topic and timestamp if not provided
	if message.Topic == "" {
		message.Topic = channelID
	}
	if message.Timestamp == nil {
		now := time.Now()
		message.Timestamp = &now
	}

	// Publish message to channel topic
	topic := fmt.Sprintf("channel.%s", channelID)
	if err := bs.messageBroker.Publish(ctx, topic, message); err != nil {
		return fmt.Errorf("failed to publish message to channel %s: %w", channelID, err)
	}

	bs.metricsMu.Lock()
	bs.metrics.MessagesBroadcast++
	bs.metrics.MessagesDelivered += channel.SubscriberCount
	bs.metrics.LastActivity = time.Now()
	bs.metricsMu.Unlock()

	// Update channel last activity
	bs.channelsMu.Lock()
	if ch, exists := bs.channels[channelID]; exists {
		ch.UpdatedAt = time.Now().Unix()
	}
	bs.channelsMu.Unlock()

	// Emit broadcast event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "message.broadcast",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"channel_id":        channelID,
			"message_id":        message.ID,
			"subscriber_count":  channel.SubscriberCount,
		},
	}); err != nil {
		bs.logger.Error("Failed to emit broadcast event", zap.Error(err))
	}

	bs.logger.Info("Message broadcast to channel",
		zap.String("channel_id", channelID),
		zap.String("message_id", message.ID),
		zap.Int64("subscribers", channel.SubscriberCount),
	)

	return nil
}

// handleChannelMessage handles incoming channel messages for a user
func (bs *BroadcastService) handleChannelMessage(ctx context.Context, userID, channelID string, message *proto.Message) error {
	bs.logger.Debug("Handling channel message",
		zap.String("user_id", userID),
		zap.String("channel_id", channelID),
		zap.String("message_id", message.ID),
	)

	// Emit message received event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "message.received",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"user_id":    userID,
			"channel_id": channelID,
			"message_id": message.ID,
			"timestamp":  time.Now().Unix(),
		},
	}); err != nil {
		bs.logger.Error("Failed to emit message received event", zap.Error(err))
	}

	return nil
}

// GetMetrics returns broadcast service metrics
func (bs *BroadcastService) GetMetrics() *BroadcastMetrics {
	bs.metricsMu.RLock()
	defer bs.metricsMu.RUnlock()

	// Return a copy to avoid race conditions
	return &BroadcastMetrics{
		TotalChannels:      bs.metrics.TotalChannels,
		TotalSubscriptions: bs.metrics.TotalSubscriptions,
		MessagesBroadcast:  bs.metrics.MessagesBroadcast,
		MessagesDelivered:  bs.metrics.MessagesDelivered,
		LastActivity:       bs.metrics.LastActivity,
	}
}

// DeleteChannel deletes a channel
func (bs *BroadcastService) DeleteChannel(ctx context.Context, channelID string) error {
	bs.channelsMu.Lock()
	channel, exists := bs.channels[channelID]
	if !exists {
		bs.channelsMu.Unlock()
		return fmt.Errorf("channel %s not found", channelID)
	}

	channel.Status = "deleted"
	channel.UpdatedAt = time.Now().Unix()
	delete(bs.channels, channelID)
	bs.channelsMu.Unlock()

	// Remove all subscriptions for this channel
	bs.subscriptionsMu.Lock()
	subscribersRemoved := 0
	for subID, sub := range bs.subscriptions {
		if sub.ResourceId == channelID {
			delete(bs.subscriptions, subID)
			subscribersRemoved++
		}
	}
	bs.subscriptionsMu.Unlock()

	bs.metricsMu.Lock()
	if bs.metrics.TotalChannels > 0 {
		bs.metrics.TotalChannels--
	}
	bs.metrics.TotalSubscriptions -= int64(subscribersRemoved)
	if bs.metrics.TotalSubscriptions < 0 {
		bs.metrics.TotalSubscriptions = 0
	}
	bs.metrics.LastActivity = time.Now()
	bs.metricsMu.Unlock()

	// Emit channel deletion event
	if err := bs.eventBus.Emit(ctx, &proto.Event{
		Type:   "channel.deleted",
		Source: "broadcast_service",
		Data: map[string]interface{}{
			"channel_id":          channelID,
			"subscribers_removed": subscribersRemoved,
		},
	}); err != nil {
		bs.logger.Error("Failed to emit channel deletion event", zap.Error(err))
	}

	bs.logger.Info("Channel deleted",
		zap.String("channel_id", channelID),
		zap.Int("subscribers_removed", subscribersRemoved),
	)

	return nil
}