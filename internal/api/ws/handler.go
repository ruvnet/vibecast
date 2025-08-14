// Package ws provides WebSocket handlers for real-time communication
package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/dto"
	"github.com/ruvnet/alienator/internal/errors"
	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/internal/services"
	"go.uber.org/zap"
)

// MessageType represents different WebSocket message types
type MessageType string

const (
	// Client to Server messages
	TypeSubscribe   MessageType = "subscribe"
	TypeUnsubscribe MessageType = "unsubscribe"
	TypePing        MessageType = "ping"
	TypeAnalyze     MessageType = "analyze"
	TypeAuth        MessageType = "auth"
	
	// Server to Client messages
	TypePong            MessageType = "pong"
	TypeError           MessageType = "error"
	TypeAnomalyAlert    MessageType = "anomaly_alert"
	TypeAnalysisResult  MessageType = "analysis_result"
	TypeSystemNotice    MessageType = "system_notice"
	TypeSubscribed      MessageType = "subscribed"
	TypeUnsubscribed    MessageType = "unsubscribed"
	TypeWelcome         MessageType = "welcome"
)

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      MessageType `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	ID        string      `json:"id,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	Error     *errors.APIError `json:"error,omitempty"`
}

// Client represents a WebSocket client connection
type Client struct {
	ID           uuid.UUID
	UserID       *uuid.UUID
	Conn         *websocket.Conn
	Send         chan *WebSocketMessage
	Hub          *Hub
	Subscriptions map[string]bool
	LastPing     time.Time
	Authenticated bool
	ClientInfo   map[string]string
	mutex        sync.RWMutex
}

// Hub manages WebSocket client connections
type Hub struct {
	clients    map[uuid.UUID]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *WebSocketMessage
	detector   *core.AnomalyDetector
	authService *services.AuthService
	logger     *zap.Logger
	mutex      sync.RWMutex
}

// Handler handles WebSocket connections
type Handler struct {
	hub      *Hub
	upgrader websocket.Upgrader
	logger   *zap.Logger
}

// NewHandler creates a new WebSocket handler
func NewHandler(detector *core.AnomalyDetector, authService *services.AuthService, upgrader websocket.Upgrader, logger *zap.Logger) *Handler {
	hub := &Hub{
		clients:     make(map[uuid.UUID]*Client),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast:   make(chan *WebSocketMessage),
		detector:    detector,
		authService: authService,
		logger:      logger,
	}

	// Start the hub
	go hub.run()

	return &Handler{
		hub:      hub,
		upgrader: upgrader,
		logger:   logger,
	}
}

// HandleWebSocket handles WebSocket connection requests
func (h *Handler) HandleWebSocket(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
		return
	}

	// Create new client
	client := &Client{
		ID:            uuid.New(),
		Conn:          conn,
		Send:          make(chan *WebSocketMessage, 256),
		Hub:           h.hub,
		Subscriptions: make(map[string]bool),
		LastPing:      time.Now(),
		Authenticated: false,
		ClientInfo:    make(map[string]string),
	}

	// Register client
	h.hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()

	// Send welcome message
	welcomeMsg := &WebSocketMessage{
		Type:      TypeWelcome,
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"client_id": client.ID.String(),
			"message":   "Connected to VibeCast WebSocket API",
			"version":   "2.0.0",
		},
	}
	client.Send <- welcomeMsg

	h.logger.Info("WebSocket client connected", 
		zap.String("client_id", client.ID.String()),
		zap.String("remote_addr", c.Request.RemoteAddr),
	)
}

// Hub methods

func (h *Hub) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client.ID] = client
			h.mutex.Unlock()
			h.logger.Debug("Client registered", zap.String("client_id", client.ID.String()))

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
				h.logger.Debug("Client unregistered", zap.String("client_id", client.ID.String()))
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.ID)
				}
			}
			h.mutex.RUnlock()

		case <-ticker.C:
			// Cleanup inactive clients
			h.cleanup()
		}
	}
}

func (h *Hub) cleanup() {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	now := time.Now()
	for id, client := range h.clients {
		if now.Sub(client.LastPing) > 60*time.Second {
			client.Conn.Close()
			close(client.Send)
			delete(h.clients, id)
			h.logger.Debug("Client cleaned up due to inactivity", zap.String("client_id", id.String()))
		}
	}
}

// BroadcastToSubscribers broadcasts a message to all clients subscribed to a topic
func (h *Hub) BroadcastToSubscribers(topic string, message *WebSocketMessage) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for _, client := range h.clients {
		client.mutex.RLock()
		subscribed := client.Subscriptions[topic]
		client.mutex.RUnlock()

		if subscribed {
			select {
			case client.Send <- message:
			default:
				// Client's send channel is full, skip
			}
		}
	}
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID uuid.UUID, message *WebSocketMessage) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for _, client := range h.clients {
		if client.UserID != nil && *client.UserID == userID {
			select {
			case client.Send <- message:
			default:
				// Client's send channel is full, skip
			}
		}
	}
}

// Client methods

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	// Set read deadline and pong handler
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.LastPing = time.Now()
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Hub.logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}

		var msg WebSocketMessage
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			c.sendError("Invalid message format", err)
			continue
		}

		c.handleMessage(&msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				c.Hub.logger.Error("Failed to write WebSocket message", zap.Error(err))
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg *WebSocketMessage) {
	switch msg.Type {
	case TypeAuth:
		c.handleAuth(msg)
	case TypeSubscribe:
		c.handleSubscribe(msg)
	case TypeUnsubscribe:
		c.handleUnsubscribe(msg)
	case TypePing:
		c.handlePing(msg)
	case TypeAnalyze:
		c.handleAnalyze(msg)
	default:
		c.sendError("Unknown message type", fmt.Errorf("unknown type: %s", msg.Type))
	}
}

func (c *Client) handleAuth(msg *WebSocketMessage) {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid auth data", nil)
		return
	}

	token, ok := data["token"].(string)
	if !ok {
		c.sendError("Missing token", nil)
		return
	}

	// Validate token
	claims, err := c.Hub.authService.ValidateToken(token)
	if err != nil {
		c.sendError("Invalid token", err)
		return
	}

	// Set user info
	c.mutex.Lock()
	c.UserID = &claims.UserID
	c.Authenticated = true
	c.mutex.Unlock()

	// Send success response
	response := &WebSocketMessage{
		Type:      TypeWelcome,
		ID:        msg.ID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"authenticated": true,
			"user_id":       claims.UserID.String(),
			"role":          claims.Role,
		},
	}
	c.Send <- response

	c.Hub.logger.Info("WebSocket client authenticated", 
		zap.String("client_id", c.ID.String()),
		zap.String("user_id", claims.UserID.String()),
	)
}

func (c *Client) handleSubscribe(msg *WebSocketMessage) {
	if !c.Authenticated {
		c.sendError("Authentication required", nil)
		return
	}

	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid subscribe data", nil)
		return
	}

	topic, ok := data["topic"].(string)
	if !ok {
		c.sendError("Missing topic", nil)
		return
	}

	// Add subscription
	c.mutex.Lock()
	c.Subscriptions[topic] = true
	c.mutex.Unlock()

	// Send confirmation
	response := &WebSocketMessage{
		Type:      TypeSubscribed,
		ID:        msg.ID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"topic":      topic,
			"subscribed": true,
		},
	}
	c.Send <- response

	c.Hub.logger.Debug("Client subscribed to topic", 
		zap.String("client_id", c.ID.String()),
		zap.String("topic", topic),
	)
}

func (c *Client) handleUnsubscribe(msg *WebSocketMessage) {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid unsubscribe data", nil)
		return
	}

	topic, ok := data["topic"].(string)
	if !ok {
		c.sendError("Missing topic", nil)
		return
	}

	// Remove subscription
	c.mutex.Lock()
	delete(c.Subscriptions, topic)
	c.mutex.Unlock()

	// Send confirmation
	response := &WebSocketMessage{
		Type:      TypeUnsubscribed,
		ID:        msg.ID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"topic":        topic,
			"unsubscribed": true,
		},
	}
	c.Send <- response
}

func (c *Client) handlePing(msg *WebSocketMessage) {
	c.LastPing = time.Now()
	response := &WebSocketMessage{
		Type:      TypePong,
		ID:        msg.ID,
		Timestamp: time.Now(),
	}
	c.Send <- response
}

func (c *Client) handleAnalyze(msg *WebSocketMessage) {
	if !c.Authenticated {
		c.sendError("Authentication required", nil)
		return
	}

	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid analyze data", nil)
		return
	}

	text, ok := data["text"].(string)
	if !ok {
		c.sendError("Missing text", nil)
		return
	}

	// Perform analysis
	result, err := c.Hub.detector.AnalyzeText(text)
	if err != nil {
		c.sendError("Analysis failed", err)
		return
	}

	// Send result
	response := &WebSocketMessage{
		Type:      TypeAnalysisResult,
		ID:        msg.ID,
		Timestamp: time.Now(),
		Data: dto.TextAnalysisResponse{
			BaseResponse: dto.BaseResponse{
				Success:   true,
				Message:   "Analysis completed",
				Timestamp: time.Now(),
			},
			Result: result,
		},
	}
	c.Send <- response

	// If anomaly detected, broadcast alert to subscribers
	if result.IsAnomalous {
		alertMsg := &WebSocketMessage{
			Type:      TypeAnomalyAlert,
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"user_id": c.UserID.String(),
				"score":   result.Score,
				"confidence": result.Confidence,
				"text_preview": text[:min(100, len(text))],
			},
		}
		c.Hub.BroadcastToSubscribers("anomaly_alerts", alertMsg)
	}
}

func (c *Client) sendError(message string, err error) {
	apiErr := errors.NewBadRequestError(message)
	if err != nil {
		apiErr.WithMetadata("details", err.Error())
	}

	errorMsg := &WebSocketMessage{
		Type:      TypeError,
		Timestamp: time.Now(),
		Error:     apiErr,
	}
	c.Send <- errorMsg
}

// Helper functions

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// NotifyAnomalyDetected sends anomaly alerts to subscribed clients
func (h *Handler) NotifyAnomalyDetected(userID uuid.UUID, result *models.AnomalyResult) {
	message := &WebSocketMessage{
		Type:      TypeAnomalyAlert,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"user_id":    userID.String(),
			"score":      result.Score,
			"confidence": result.Confidence,
			"timestamp":  result.Timestamp,
			"details":    result.Details,
		},
	}

	// Broadcast to all subscribers of anomaly alerts
	h.hub.BroadcastToSubscribers("anomaly_alerts", message)
	
	// Also send directly to the user
	h.hub.SendToUser(userID, message)
}

// NotifySystemEvent sends system notifications to all connected clients
func (h *Handler) NotifySystemEvent(eventType, message string, data map[string]interface{}) {
	msg := &WebSocketMessage{
		Type:      TypeSystemNotice,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"event_type": eventType,
			"message":    message,
			"data":       data,
		},
	}

	h.hub.broadcast <- msg
}

// GetConnectedClients returns the number of connected clients
func (h *Handler) GetConnectedClients() int {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()
	return len(h.hub.clients)
}

// GetAuthenticatedClients returns the number of authenticated clients
func (h *Handler) GetAuthenticatedClients() int {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()
	
	count := 0
	for _, client := range h.hub.clients {
		if client.Authenticated {
			count++
		}
	}
	return count
}