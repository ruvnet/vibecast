package gossip

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// GossipProtocol implements a gossip-based consensus protocol
type GossipProtocol struct {
	mu       sync.RWMutex
	nodeID   consensus.NodeID
	config   *consensus.Config
	nodes    map[consensus.NodeID]string
	
	// Gossip state
	state         consensus.ConsensusState
	messageStore  map[string]*GossipMessage
	vectorClock   map[consensus.NodeID]uint64
	suspicion     map[consensus.NodeID]time.Time
	alive         map[consensus.NodeID]time.Time
	
	// Epidemic parameters
	fanout        int           // Number of nodes to gossip to
	gossipPeriod  time.Duration // How often to gossip
	suspectTime   time.Duration // How long before suspecting a node
	maxTTL        int          // Maximum time-to-live for messages

	// Components
	transport    consensus.Transport
	stateMachine consensus.StateMachine
	storage      consensus.Storage

	// Control channels
	gossipTicker  *time.Ticker
	cleanupTicker *time.Ticker
	messageCh     chan *GossipMessage

	// Context and cancellation
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// GossipMessage represents a message in the gossip protocol
type GossipMessage struct {
	ID          string                    `json:"id"`
	Type        GossipMessageType         `json:"type"`
	From        consensus.NodeID          `json:"from"`
	TTL         int                      `json:"ttl"`
	Timestamp   time.Time                `json:"timestamp"`
	VectorClock map[consensus.NodeID]uint64 `json:"vector_clock"`
	Payload     []byte                   `json:"payload"`
	Signature   string                   `json:"signature,omitempty"`
}

// GossipMessageType defines types of gossip messages
type GossipMessageType int

const (
	DataMessage GossipMessageType = iota
	AckMessage
	SyncMessage
	AliveMessage
	SuspectMessage
	ConfirmMessage
)

// MembershipInfo contains information about cluster membership
type MembershipInfo struct {
	NodeID      consensus.NodeID `json:"node_id"`
	Status      NodeStatus      `json:"status"`
	LastSeen    time.Time       `json:"last_seen"`
	Incarnation uint64          `json:"incarnation"`
}

// NodeStatus represents the status of a node
type NodeStatus int

const (
	NodeAlive NodeStatus = iota
	NodeSuspected
	NodeDead
	NodeLeft
)

// NewGossipProtocol creates a new gossip protocol instance
func NewGossipProtocol(config *consensus.Config, transport consensus.Transport, stateMachine consensus.StateMachine, storage consensus.Storage) *GossipProtocol {
	ctx, cancel := context.WithCancel(context.Background())
	
	g := &GossipProtocol{
		nodeID:        config.NodeID,
		config:        config,
		nodes:         make(map[consensus.NodeID]string),
		state:         consensus.Follower,
		messageStore:  make(map[string]*GossipMessage),
		vectorClock:   make(map[consensus.NodeID]uint64),
		suspicion:     make(map[consensus.NodeID]time.Time),
		alive:         make(map[consensus.NodeID]time.Time),
		fanout:        3,                    // Typical gossip fanout
		gossipPeriod:  200 * time.Millisecond,
		suspectTime:   5 * time.Second,
		maxTTL:        10,
		transport:     transport,
		stateMachine:  stateMachine,
		storage:       storage,
		messageCh:     make(chan *GossipMessage, 1000),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Initialize node list
	for _, nodeAddr := range config.Nodes {
		nodeID := consensus.NodeID(nodeAddr) // Simplified
		g.nodes[nodeID] = nodeAddr
		g.vectorClock[nodeID] = 0
		g.alive[nodeID] = time.Now()
	}

	return g
}

// Start begins the gossip protocol
func (g *GossipProtocol) Start(ctx context.Context) error {
	// Start transport
	if err := g.transport.Start(); err != nil {
		return fmt.Errorf("failed to start transport: %w", err)
	}

	// Start tickers
	g.gossipTicker = time.NewTicker(g.gossipPeriod)
	g.cleanupTicker = time.NewTicker(10 * time.Second)

	// Start handlers
	g.wg.Add(4)
	go g.messageHandler()
	go g.gossipHandler()
	go g.cleanupHandler()
	go g.membershipHandler()

	// Send initial alive message
	g.sendAliveMessage()

	return nil
}

// Stop gracefully shuts down the gossip protocol
func (g *GossipProtocol) Stop() error {
	g.cancel()
	
	if g.gossipTicker != nil {
		g.gossipTicker.Stop()
	}
	if g.cleanupTicker != nil {
		g.cleanupTicker.Stop()
	}
	
	g.wg.Wait()
	
	return g.transport.Stop()
}

// Propose submits a new proposal through gossip
func (g *GossipProtocol) Propose(ctx context.Context, data []byte) error {
	g.mu.Lock()
	g.vectorClock[g.nodeID]++
	vectorClock := make(map[consensus.NodeID]uint64)
	for k, v := range g.vectorClock {
		vectorClock[k] = v
	}
	g.mu.Unlock()

	msg := &GossipMessage{
		ID:          g.generateMessageID(),
		Type:        DataMessage,
		From:        g.nodeID,
		TTL:         g.maxTTL,
		Timestamp:   time.Now(),
		VectorClock: vectorClock,
		Payload:     data,
	}

	return g.gossipMessage(msg)
}

// GetState returns the current consensus state
func (g *GossipProtocol) GetState() consensus.ConsensusState {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.state
}

// GetLeader returns the current leader (not applicable for gossip)
func (g *GossipProtocol) GetLeader() consensus.NodeID {
	return ""
}

// IsLeader returns false (gossip is leaderless)
func (g *GossipProtocol) IsLeader() bool {
	return false
}

// GetTerm returns the current term (not applicable for gossip)
func (g *GossipProtocol) GetTerm() consensus.Term {
	return 0
}

// AddNode adds a new node to the cluster
func (g *GossipProtocol) AddNode(nodeID consensus.NodeID, address string) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	
	g.nodes[nodeID] = address
	g.vectorClock[nodeID] = 0
	g.alive[nodeID] = time.Now()
	
	return nil
}

// RemoveNode removes a node from the cluster
func (g *GossipProtocol) RemoveNode(nodeID consensus.NodeID) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	
	delete(g.nodes, nodeID)
	delete(g.vectorClock, nodeID)
	delete(g.alive, nodeID)
	delete(g.suspicion, nodeID)
	
	return nil
}

// messageHandler processes incoming gossip messages
func (g *GossipProtocol) messageHandler() {
	defer g.wg.Done()

	for {
		select {
		case <-g.ctx.Done():
			return
		case rawMsg := <-g.transport.Receive():
			var gossipMsg GossipMessage
			if err := json.Unmarshal(rawMsg.Data, &gossipMsg); err != nil {
				fmt.Printf("Failed to unmarshal gossip message: %v\n", err)
				continue
			}
			g.handleGossipMessage(&gossipMsg)
		}
	}
}

// gossipHandler periodically gossips messages
func (g *GossipProtocol) gossipHandler() {
	defer g.wg.Done()

	for {
		select {
		case <-g.ctx.Done():
			return
		case <-g.gossipTicker.C:
			g.doGossipRound()
		}
	}
}

// cleanupHandler periodically cleans up old messages and updates membership
func (g *GossipProtocol) cleanupHandler() {
	defer g.wg.Done()

	for {
		select {
		case <-g.ctx.Done():
			return
		case <-g.cleanupTicker.C:
			g.cleanupMessages()
			g.updateMembership()
		}
	}
}

// membershipHandler manages node membership and failure detection
func (g *GossipProtocol) membershipHandler() {
	defer g.wg.Done()

	membershipTicker := time.NewTicker(1 * time.Second)
	defer membershipTicker.Stop()

	for {
		select {
		case <-g.ctx.Done():
			return
		case <-membershipTicker.C:
			g.checkMembership()
		}
	}
}

// handleGossipMessage processes a received gossip message
func (g *GossipProtocol) handleGossipMessage(msg *GossipMessage) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Check if we've seen this message before
	if _, exists := g.messageStore[msg.ID]; exists {
		return
	}

	// Check TTL
	if msg.TTL <= 0 {
		return
	}

	// Update vector clock
	for nodeID, clock := range msg.VectorClock {
		if clock > g.vectorClock[nodeID] {
			g.vectorClock[nodeID] = clock
		}
	}

	// Store the message
	g.messageStore[msg.ID] = msg

	switch msg.Type {
	case DataMessage:
		g.handleDataMessage(msg)
	case AliveMessage:
		g.handleAliveMessage(msg)
	case SuspectMessage:
		g.handleSuspectMessage(msg)
	case ConfirmMessage:
		g.handleConfirmMessage(msg)
	case SyncMessage:
		g.handleSyncMessage(msg)
	case AckMessage:
		g.handleAckMessage(msg)
	}

	// Propagate the message (with decremented TTL)
	if msg.TTL > 1 {
		g.propagateMessage(msg)
	}
}

// handleDataMessage processes data messages
func (g *GossipProtocol) handleDataMessage(msg *GossipMessage) {
	// Apply to state machine
	entry := &consensus.LogEntry{
		Index:     consensus.LogIndex(len(g.messageStore)),
		Term:      0, // Not applicable for gossip
		Data:      msg.Payload,
		Timestamp: msg.Timestamp,
		Committed: true, // Gossip messages are immediately committed
	}

	if _, err := g.stateMachine.Apply(entry); err != nil {
		fmt.Printf("Failed to apply gossip message: %v\n", err)
	}
}

// handleAliveMessage processes alive messages
func (g *GossipProtocol) handleAliveMessage(msg *GossipMessage) {
	g.alive[msg.From] = time.Now()
	delete(g.suspicion, msg.From)
}

// handleSuspectMessage processes suspect messages
func (g *GossipProtocol) handleSuspectMessage(msg *GossipMessage) {
	// Extract suspected node from payload
	var suspectedNode consensus.NodeID
	json.Unmarshal(msg.Payload, &suspectedNode)
	
	if _, exists := g.suspicion[suspectedNode]; !exists {
		g.suspicion[suspectedNode] = time.Now()
	}
}

// handleConfirmMessage processes confirm messages
func (g *GossipProtocol) handleConfirmMessage(msg *GossipMessage) {
	// Extract confirmed node from payload
	var confirmedNode consensus.NodeID
	json.Unmarshal(msg.Payload, &confirmedNode)
	
	// Remove from alive and suspicion lists (node is confirmed dead)
	delete(g.alive, confirmedNode)
	delete(g.suspicion, confirmedNode)
}

// handleSyncMessage processes synchronization messages
func (g *GossipProtocol) handleSyncMessage(msg *GossipMessage) {
	// Send back our message store digest for anti-entropy
	g.sendSyncResponse(msg.From)
}

// handleAckMessage processes acknowledgment messages
func (g *GossipProtocol) handleAckMessage(msg *GossipMessage) {
	// Handle acknowledgments for reliability
}

// doGossipRound performs one round of gossip
func (g *GossipProtocol) doGossipRound() {
	g.mu.RLock()
	// Select random subset of nodes
	targets := g.selectGossipTargets()
	
	// Select random messages to gossip
	messages := g.selectMessagesToGossip()
	g.mu.RUnlock()

	// Gossip messages to targets
	for _, target := range targets {
		for _, msg := range messages {
			g.sendMessageToNode(target, msg)
		}
	}
}

// selectGossipTargets selects random nodes for gossiping
func (g *GossipProtocol) selectGossipTargets() []consensus.NodeID {
	nodes := make([]consensus.NodeID, 0, len(g.nodes))
	for nodeID := range g.nodes {
		if nodeID != g.nodeID {
			nodes = append(nodes, nodeID)
		}
	}

	// Shuffle and select fanout number of nodes
	for i := len(nodes) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		nodes[i], nodes[j] = nodes[j], nodes[i]
	}

	fanout := g.fanout
	if len(nodes) < fanout {
		fanout = len(nodes)
	}

	return nodes[:fanout]
}

// selectMessagesToGossip selects messages to gossip in this round
func (g *GossipProtocol) selectMessagesToGossip() []*GossipMessage {
	messages := make([]*GossipMessage, 0)
	
	// Select recent messages or messages we haven't gossiped much
	for _, msg := range g.messageStore {
		if msg.TTL > 0 && time.Since(msg.Timestamp) < 30*time.Second {
			messages = append(messages, msg)
		}
	}
	
	return messages
}

// sendMessageToNode sends a message to a specific node
func (g *GossipProtocol) sendMessageToNode(nodeID consensus.NodeID, msg *GossipMessage) {
	// Create a copy with decremented TTL
	msgCopy := *msg
	msgCopy.TTL--
	
	data, err := json.Marshal(&msgCopy)
	if err != nil {
		fmt.Printf("Failed to marshal gossip message: %v\n", err)
		return
	}

	consensusMsg := &consensus.ConsensusMessage{
		Type:      consensus.GossipDataMsg,
		From:      g.nodeID,
		To:        nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}

	if err := g.transport.Send(nodeID, consensusMsg); err != nil {
		fmt.Printf("Failed to send gossip message to %s: %v\n", nodeID, err)
	}
}

// gossipMessage initiates gossip for a new message
func (g *GossipProtocol) gossipMessage(msg *GossipMessage) error {
	g.mu.Lock()
	g.messageStore[msg.ID] = msg
	g.mu.Unlock()

	// Immediately gossip to random nodes
	targets := g.selectGossipTargets()
	for _, target := range targets {
		g.sendMessageToNode(target, msg)
	}

	return nil
}

// propagateMessage propagates a received message
func (g *GossipProtocol) propagateMessage(msg *GossipMessage) {
	// Probabilistic propagation to prevent message storms
	if rand.Float64() < 0.5 { // 50% chance of propagation
		targets := g.selectGossipTargets()
		for _, target := range targets {
			if target != msg.From { // Don't send back to sender
				g.sendMessageToNode(target, msg)
			}
		}
	}
}

// sendAliveMessage broadcasts an alive message
func (g *GossipProtocol) sendAliveMessage() {
	msg := &GossipMessage{
		ID:        g.generateMessageID(),
		Type:      AliveMessage,
		From:      g.nodeID,
		TTL:       g.maxTTL,
		Timestamp: time.Now(),
		Payload:   []byte(`{}`),
	}

	g.gossipMessage(msg)
}

// checkMembership checks for suspected/failed nodes
func (g *GossipProtocol) checkMembership() {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()
	
	for nodeID, lastSeen := range g.alive {
		if nodeID == g.nodeID {
			continue
		}
		
		// Check if node should be suspected
		if now.Sub(lastSeen) > g.suspectTime {
			if _, alreadySuspected := g.suspicion[nodeID]; !alreadySuspected {
				// Start suspecting this node
				g.suspicion[nodeID] = now
				g.sendSuspectMessage(nodeID)
			}
		}
	}
}

// sendSuspectMessage broadcasts a suspect message
func (g *GossipProtocol) sendSuspectMessage(suspectedNode consensus.NodeID) {
	payload, _ := json.Marshal(suspectedNode)
	
	msg := &GossipMessage{
		ID:        g.generateMessageID(),
		Type:      SuspectMessage,
		From:      g.nodeID,
		TTL:       g.maxTTL,
		Timestamp: time.Now(),
		Payload:   payload,
	}

	g.gossipMessage(msg)
}

// sendSyncResponse sends a sync response
func (g *GossipProtocol) sendSyncResponse(nodeID consensus.NodeID) {
	// Implementation would include message digest for anti-entropy
}

// cleanupMessages removes old messages
func (g *GossipProtocol) cleanupMessages() {
	g.mu.Lock()
	defer g.mu.Unlock()

	cutoff := time.Now().Add(-5 * time.Minute)
	for id, msg := range g.messageStore {
		if msg.Timestamp.Before(cutoff) {
			delete(g.messageStore, id)
		}
	}
}

// updateMembership updates the membership view
func (g *GossipProtocol) updateMembership() {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()
	confirmTimeout := 2 * g.suspectTime

	for nodeID, suspectTime := range g.suspicion {
		if now.Sub(suspectTime) > confirmTimeout {
			// Confirm node as dead
			delete(g.alive, nodeID)
			delete(g.suspicion, nodeID)
			g.sendConfirmMessage(nodeID)
		}
	}
}

// sendConfirmMessage broadcasts a confirm message
func (g *GossipProtocol) sendConfirmMessage(confirmedNode consensus.NodeID) {
	payload, _ := json.Marshal(confirmedNode)
	
	msg := &GossipMessage{
		ID:        g.generateMessageID(),
		Type:      ConfirmMessage,
		From:      g.nodeID,
		TTL:       g.maxTTL,
		Timestamp: time.Now(),
		Payload:   payload,
	}

	g.gossipMessage(msg)
}

// generateMessageID generates a unique message ID
func (g *GossipProtocol) generateMessageID() string {
	return fmt.Sprintf("%s-%d-%d", g.nodeID, time.Now().UnixNano(), rand.Int63())
}