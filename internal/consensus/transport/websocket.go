package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ruvnet/alienator/internal/consensus"
)

// WebSocketTransport implements the Transport interface using WebSockets
type WebSocketTransport struct {
	nodeID      consensus.NodeID
	address     string
	nodes       map[consensus.NodeID]string
	connections map[consensus.NodeID]*websocket.Conn
	connMu      sync.RWMutex
	msgChan     chan *consensus.ConsensusMessage
	stopChan    chan struct{}
	wg          sync.WaitGroup
	upgrader    websocket.Upgrader
	server      *http.Server
}

// NewWebSocketTransport creates a new WebSocket transport
func NewWebSocketTransport(nodeID consensus.NodeID, address string, nodes map[consensus.NodeID]string) *WebSocketTransport {
	return &WebSocketTransport{
		nodeID:      nodeID,
		address:     address,
		nodes:       nodes,
		connections: make(map[consensus.NodeID]*websocket.Conn),
		msgChan:     make(chan *consensus.ConsensusMessage, 1000),
		stopChan:    make(chan struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow connections from any origin
			},
		},
	}
}

// Start starts the WebSocket transport
func (w *WebSocketTransport) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/consensus", w.handleWebSocket)

	w.server = &http.Server{
		Addr:    w.address,
		Handler: mux,
	}

	// Start HTTP server
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		if err := w.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("WebSocket server error: %v\n", err)
		}
	}()

	// Initialize connections to other nodes
	w.wg.Add(1)
	go w.connectToNodes()

	return nil
}

// Stop stops the WebSocket transport
func (w *WebSocketTransport) Stop() error {
	close(w.stopChan)

	// Close server
	if w.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		w.server.Shutdown(ctx)
	}

	// Close all connections
	w.connMu.Lock()
	for _, conn := range w.connections {
		conn.Close()
	}
	w.connMu.Unlock()

	w.wg.Wait()
	return nil
}

// Send sends a message to a specific node
func (w *WebSocketTransport) Send(nodeID consensus.NodeID, msg *consensus.ConsensusMessage) error {
	if nodeID == w.nodeID {
		// Local message
		select {
		case w.msgChan <- msg:
			return nil
		default:
			return fmt.Errorf("message channel full")
		}
	}

	w.connMu.RLock()
	conn, exists := w.connections[nodeID]
	w.connMu.RUnlock()

	if !exists {
		return fmt.Errorf("no connection to node %s", nodeID)
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	return conn.WriteMessage(websocket.TextMessage, data)
}

// Broadcast sends a message to all nodes
func (w *WebSocketTransport) Broadcast(msg *consensus.ConsensusMessage) error {
	var wg sync.WaitGroup
	errors := make(chan error, len(w.nodes))

	w.connMu.RLock()
	connections := make(map[consensus.NodeID]*websocket.Conn)
	for nodeID, conn := range w.connections {
		if nodeID != w.nodeID {
			connections[nodeID] = conn
		}
	}
	w.connMu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	for nodeID, conn := range connections {
		wg.Add(1)
		go func(nid consensus.NodeID, c *websocket.Conn) {
			defer wg.Done()
			if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
				errors <- fmt.Errorf("failed to send to %s: %w", nid, err)
			}
		}(nodeID, conn)
	}

	wg.Wait()
	close(errors)

	// Collect any errors
	var errs []error
	for err := range errors {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("broadcast errors: %v", errs)
	}

	return nil
}

// Receive returns a channel for receiving messages
func (w *WebSocketTransport) Receive() <-chan *consensus.ConsensusMessage {
	return w.msgChan
}

// GetAddress returns the address for a node
func (w *WebSocketTransport) GetAddress(nodeID consensus.NodeID) string {
	return w.nodes[nodeID]
}

// handleWebSocket handles incoming WebSocket connections
func (w *WebSocketTransport) handleWebSocket(rw http.ResponseWriter, r *http.Request) {
	conn, err := w.upgrader.Upgrade(rw, r, nil)
	if err != nil {
		fmt.Printf("WebSocket upgrade error: %v\n", err)
		return
	}
	defer conn.Close()

	// Read the first message to identify the node
	_, data, err := conn.ReadMessage()
	if err != nil {
		fmt.Printf("Failed to read identification message: %v\n", err)
		return
	}

	var identMsg struct {
		NodeID consensus.NodeID `json:"node_id"`
	}
	if err := json.Unmarshal(data, &identMsg); err != nil {
		fmt.Printf("Failed to unmarshal identification message: %v\n", err)
		return
	}

	nodeID := identMsg.NodeID
	w.connMu.Lock()
	w.connections[nodeID] = conn
	w.connMu.Unlock()

	// Send identification response
	response := map[string]interface{}{
		"node_id": w.nodeID,
		"status":  "connected",
	}
	if data, err := json.Marshal(response); err == nil {
		conn.WriteMessage(websocket.TextMessage, data)
	}

	// Handle messages from this connection
	w.wg.Add(1)
	go w.handleConnection(nodeID, conn)
}

// handleConnection handles messages from a specific connection
func (w *WebSocketTransport) handleConnection(nodeID consensus.NodeID, conn *websocket.Conn) {
	defer w.wg.Done()
	defer func() {
		w.connMu.Lock()
		delete(w.connections, nodeID)
		w.connMu.Unlock()
	}()

	for {
		select {
		case <-w.stopChan:
			return
		default:
			_, data, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("WebSocket error from %s: %v\n", nodeID, err)
				}
				return
			}

			var msg consensus.ConsensusMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				fmt.Printf("Failed to unmarshal message from %s: %v\n", nodeID, err)
				continue
			}

			select {
			case w.msgChan <- &msg:
			default:
				fmt.Printf("Message channel full, dropping message from %s\n", nodeID)
			}
		}
	}
}

// connectToNodes establishes connections to all other nodes
func (w *WebSocketTransport) connectToNodes() {
	defer w.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			for nodeID, address := range w.nodes {
				if nodeID == w.nodeID {
					continue
				}

				w.connMu.RLock()
				_, exists := w.connections[nodeID]
				w.connMu.RUnlock()

				if !exists {
					go w.connectToNode(nodeID, address)
				}
			}
		}
	}
}

// connectToNode establishes a connection to a specific node
func (w *WebSocketTransport) connectToNode(nodeID consensus.NodeID, address string) {
	url := fmt.Sprintf("ws://%s/consensus", address)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return // Silently fail, will retry later
	}

	// Send identification message
	identMsg := map[string]interface{}{
		"node_id": w.nodeID,
	}
	data, _ := json.Marshal(identMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		conn.Close()
		return
	}

	// Read identification response
	_, _, err = conn.ReadMessage()
	if err != nil {
		conn.Close()
		return
	}

	w.connMu.Lock()
	w.connections[nodeID] = conn
	w.connMu.Unlock()

	// Handle messages from this connection
	w.wg.Add(1)
	go w.handleConnection(nodeID, conn)
}