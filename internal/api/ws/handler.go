// Package ws provides WebSocket functionality
package ws

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/vibecast/anomaly-detector/internal/core"
	"github.com/vibecast/anomaly-detector/internal/models"
	"go.uber.org/zap"
)

// Handler manages WebSocket connections
type Handler struct {
	detector  *core.AnomalyDetector
	upgrader  websocket.Upgrader
	logger    *zap.Logger
	clients   map[*Client]bool
	broadcast chan []byte
	register  chan *Client
	unregister chan *Client
	mu        sync.RWMutex
}

// Client represents a WebSocket client connection
type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	hub    *Handler
}

// NewHandler creates a new WebSocket handler
func NewHandler(detector *core.AnomalyDetector, upgrader websocket.Upgrader, logger *zap.Logger) *Handler {
	handler := &Handler{
		detector:   detector,
		upgrader:   upgrader,
		logger:     logger,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}

	// Start the hub
	go handler.run()

	return handler
}

// run starts the WebSocket hub
func (h *Handler) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			
			h.logger.Info("Client connected", 
				zap.String("user_id", client.userID.String()),
				zap.Int("total_clients", len(h.clients)),
			)

			// Send welcome message
			welcome := models.WebSocketMessage{
				Type:      "connection",
				Data:      map[string]string{"status": "connected"},
				Timestamp: time.Now(),
				UserID:    client.userID,
			}
			if data, err := json.Marshal(welcome); err == nil {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

			h.logger.Info("Client disconnected", 
				zap.String("user_id", client.userID.String()),
				zap.Int("total_clients", len(h.clients)),
			)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// HandleWebSocket handles WebSocket connection requests
func (h *Handler) HandleWebSocket(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}

	// Get user ID from query parameter or context
	userIDStr := c.Query("user_id")
	var userID uuid.UUID
	
	if userIDStr != "" {
		if id, err := uuid.Parse(userIDStr); err == nil {
			userID = id
		} else {
			userID = uuid.New() // Generate anonymous ID
		}
	} else {
		userID = uuid.New() // Generate anonymous ID
	}

	// Create client
	client := &Client{
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
		hub:    h,
	}

	// Register client
	h.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump handles reading messages from the client
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	// Set read deadline and pong handler
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var message models.WebSocketMessage
		err := c.conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.logger.Error("WebSocket read error", zap.Error(err))
			}
			break
		}

		// Process the message
		c.handleMessage(&message)
	}
}

// writePump handles writing messages to the client
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(message *models.WebSocketMessage) {
	c.hub.logger.Debug("Received WebSocket message",
		zap.String("type", message.Type),
		zap.String("user_id", c.userID.String()),
	)

	switch message.Type {
	case "ping":
		// Respond with pong
		response := models.WebSocketMessage{
			Type:      "pong",
			Data:      map[string]string{"status": "alive"},
			Timestamp: time.Now(),
			UserID:    c.userID,
		}
		c.sendMessage(&response)

	case "anomaly_detection":
		// Handle real-time anomaly detection request
		if data, ok := message.Data.(map[string]interface{}); ok {
			c.processAnomalyDetection(data)
		}

	case "subscribe":
		// Handle subscription to specific events
		c.handleSubscription(message.Data)

	case "unsubscribe":
		// Handle unsubscription from events
		c.handleUnsubscription(message.Data)

	case "status":
		// Send status update
		status := models.WebSocketMessage{
			Type: "status_update",
			Data: map[string]interface{}{
				"connected_clients": len(c.hub.clients),
				"user_id":          c.userID,
				"connection_time":  time.Now(),
			},
			Timestamp: time.Now(),
			UserID:    c.userID,
		}
		c.sendMessage(&status)

	default:
		c.hub.logger.Warn("Unknown message type", zap.String("type", message.Type))
	}
}

// processAnomalyDetection handles real-time anomaly detection
func (c *Client) processAnomalyDetection(data map[string]interface{}) {
	// In a real implementation, this would trigger anomaly detection
	// For now, we'll simulate a response
	
	result := models.WebSocketMessage{
		Type: "anomaly_result",
		Data: map[string]interface{}{
			"is_anomaly":      false,
			"score":          0.3,
			"confidence":     0.8,
			"processing_time": 150,
			"algorithm":      "isolation_forest",
		},
		Timestamp: time.Now(),
		UserID:    c.userID,
	}

	c.sendMessage(&result)
}

// handleSubscription processes subscription requests
func (c *Client) handleSubscription(data interface{}) {
	if subscriptions, ok := data.(map[string]interface{}); ok {
		c.hub.logger.Info("Client subscribed to events",
			zap.String("user_id", c.userID.String()),
			zap.Any("subscriptions", subscriptions),
		)

		response := models.WebSocketMessage{
			Type: "subscription_confirmed",
			Data: map[string]interface{}{
				"subscriptions": subscriptions,
				"status":       "confirmed",
			},
			Timestamp: time.Now(),
			UserID:    c.userID,
		}
		c.sendMessage(&response)
	}
}

// handleUnsubscription processes unsubscription requests
func (c *Client) handleUnsubscription(data interface{}) {
	if unsubscriptions, ok := data.(map[string]interface{}); ok {
		c.hub.logger.Info("Client unsubscribed from events",
			zap.String("user_id", c.userID.String()),
			zap.Any("unsubscriptions", unsubscriptions),
		)

		response := models.WebSocketMessage{
			Type: "unsubscription_confirmed",
			Data: map[string]interface{}{
				"unsubscriptions": unsubscriptions,
				"status":         "confirmed",
			},
			Timestamp: time.Now(),
			UserID:    c.userID,
		}
		c.sendMessage(&response)
	}
}

// sendMessage sends a message to the client
func (c *Client) sendMessage(message *models.WebSocketMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		c.hub.logger.Error("Failed to marshal WebSocket message", zap.Error(err))
		return
	}

	select {
	case c.send <- data:
	default:
		close(c.send)
		delete(c.hub.clients, c)
	}
}

// BroadcastToAll sends a message to all connected clients
func (h *Handler) BroadcastToAll(message *models.WebSocketMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		h.logger.Error("Failed to marshal broadcast message", zap.Error(err))
		return
	}

	h.broadcast <- data
}

// BroadcastToUser sends a message to a specific user's connections
func (h *Handler) BroadcastToUser(userID uuid.UUID, message *models.WebSocketMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		h.logger.Error("Failed to marshal user message", zap.Error(err))
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

// GetConnectedClients returns the number of connected clients
func (h *Handler) GetConnectedClients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// GetUserClients returns the number of clients for a specific user
func (h *Handler) GetUserClients(userID uuid.UUID) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	count := 0
	for client := range h.clients {
		if client.userID == userID {
			count++
		}
	}
	return count
}

// NotifyAnomalyDetected sends anomaly detection notifications
func (h *Handler) NotifyAnomalyDetected(userID uuid.UUID, result *models.DetectionResult) {
	message := models.WebSocketMessage{
		Type:      "anomaly_detected",
		Data:      result,
		Timestamp: time.Now(),
		UserID:    userID,
	}

	h.BroadcastToUser(userID, &message)
	h.logger.Info("Anomaly detection notification sent",
		zap.String("user_id", userID.String()),
		zap.Bool("is_anomaly", result.IsAnomaly),
	)
}

// NotifySystemStatus sends system status updates
func (h *Handler) NotifySystemStatus(status map[string]interface{}) {
	message := models.WebSocketMessage{
		Type:      "system_status",
		Data:      status,
		Timestamp: time.Now(),
	}

	h.BroadcastToAll(&message)
	h.logger.Debug("System status notification sent")
}