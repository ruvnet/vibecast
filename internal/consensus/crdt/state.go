package crdt

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// CRDTSynchronizer implements CRDT-based synchronization for consensus
type CRDTSynchronizer struct {
	mu     sync.RWMutex
	nodeID consensus.NodeID
	config *consensus.Config

	// CRDT state
	state         consensus.ConsensusState
	crdtStates    map[string]CRDT
	vectorClocks  map[consensus.NodeID]VectorClock
	mergeLog      []MergeOperation
	
	// Synchronization parameters
	syncInterval  time.Duration
	maxMergeOps   int

	// Components
	transport    consensus.Transport
	stateMachine consensus.StateMachine
	storage      consensus.Storage

	// Control channels
	syncTicker   *time.Ticker
	mergeCh      chan *CRDTMessage

	// Context and cancellation
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// CRDT interface defines operations for Conflict-free Replicated Data Types
type CRDT interface {
	// Update applies a local update to the CRDT
	Update(operation Operation) error
	
	// Merge merges another CRDT state with this one
	Merge(other CRDT) error
	
	// State returns the current state of the CRDT
	State() interface{}
	
	// Clone creates a deep copy of the CRDT
	Clone() CRDT
	
	// Serialize converts the CRDT to bytes
	Serialize() ([]byte, error)
	
	// Deserialize converts bytes back to CRDT
	Deserialize(data []byte) error
}

// Operation represents an operation on a CRDT
type Operation struct {
	ID        string                    `json:"id"`
	Type      OperationType            `json:"type"`
	Key       string                   `json:"key"`
	Value     interface{}              `json:"value"`
	Metadata  map[string]interface{}   `json:"metadata"`
	Timestamp time.Time                `json:"timestamp"`
	NodeID    consensus.NodeID         `json:"node_id"`
}

// OperationType defines types of CRDT operations
type OperationType int

const (
	AddOperation OperationType = iota
	RemoveOperation
	UpdateOperation
	IncrementOperation
	DecrementOperation
	SetOperation
	MergeOperation
)

// VectorClock represents a vector clock for causality tracking
type VectorClock map[consensus.NodeID]uint64

// CRDTMessage represents a message containing CRDT synchronization data
type CRDTMessage struct {
	Type         CRDTMessageType           `json:"type"`
	From         consensus.NodeID          `json:"from"`
	CRDTStates   map[string][]byte         `json:"crdt_states"`
	Operations   []Operation               `json:"operations"`
	VectorClock  VectorClock               `json:"vector_clock"`
	Timestamp    time.Time                 `json:"timestamp"`
}

// CRDTMessageType defines types of CRDT synchronization messages
type CRDTMessageType int

const (
	StateSync CRDTMessageType = iota
	OperationSync
	MergeRequest
	MergeResponse
)

// MergeOperation represents a merge operation in the log
type MergeOperation struct {
	ID          string           `json:"id"`
	From        consensus.NodeID `json:"from"`
	CRDTKey     string           `json:"crdt_key"`
	OldState    []byte           `json:"old_state"`
	NewState    []byte           `json:"new_state"`
	Timestamp   time.Time        `json:"timestamp"`
	VectorClock VectorClock      `json:"vector_clock"`
}

// NewCRDTSynchronizer creates a new CRDT synchronizer
func NewCRDTSynchronizer(config *consensus.Config, transport consensus.Transport, stateMachine consensus.StateMachine, storage consensus.Storage) *CRDTSynchronizer {
	ctx, cancel := context.WithCancel(context.Background())
	
	c := &CRDTSynchronizer{
		nodeID:        config.NodeID,
		config:        config,
		state:         consensus.Follower,
		crdtStates:    make(map[string]CRDT),
		vectorClocks:  make(map[consensus.NodeID]VectorClock),
		mergeLog:      make([]MergeOperation, 0),
		syncInterval:  1 * time.Second,
		maxMergeOps:   1000,
		transport:     transport,
		stateMachine:  stateMachine,
		storage:       storage,
		mergeCh:       make(chan *CRDTMessage, 100),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Initialize vector clocks
	for _, nodeAddr := range config.Nodes {
		nodeID := consensus.NodeID(nodeAddr)
		c.vectorClocks[nodeID] = make(VectorClock)
	}

	return c
}

// Start begins the CRDT synchronization
func (c *CRDTSynchronizer) Start(ctx context.Context) error {
	// Load persistent state
	if err := c.loadState(); err != nil {
		return fmt.Errorf("failed to load CRDT state: %w", err)
	}

	// Start transport
	if err := c.transport.Start(); err != nil {
		return fmt.Errorf("failed to start transport: %w", err)
	}

	// Start sync ticker
	c.syncTicker = time.NewTicker(c.syncInterval)

	// Start handlers
	c.wg.Add(3)
	go c.messageHandler()
	go c.syncHandler()
	go c.mergeHandler()

	return nil
}

// Stop gracefully shuts down the CRDT synchronizer
func (c *CRDTSynchronizer) Stop() error {
	c.cancel()
	
	if c.syncTicker != nil {
		c.syncTicker.Stop()
	}
	
	c.wg.Wait()
	
	// Save state
	if err := c.saveState(); err != nil {
		fmt.Printf("Failed to save CRDT state: %v\n", err)
	}
	
	return c.transport.Stop()
}

// Propose submits a new proposal through CRDT operations
func (c *CRDTSynchronizer) Propose(ctx context.Context, data []byte) error {
	var operation Operation
	if err := json.Unmarshal(data, &operation); err != nil {
		return fmt.Errorf("failed to unmarshal operation: %w", err)
	}

	operation.NodeID = c.nodeID
	operation.Timestamp = time.Now()

	return c.applyOperation(&operation)
}

// GetState returns the current consensus state
func (c *CRDTSynchronizer) GetState() consensus.ConsensusState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

// GetLeader returns empty (CRDT is leaderless)
func (c *CRDTSynchronizer) GetLeader() consensus.NodeID {
	return ""
}

// IsLeader returns false (CRDT is leaderless)
func (c *CRDTSynchronizer) IsLeader() bool {
	return false
}

// GetTerm returns 0 (not applicable for CRDT)
func (c *CRDTSynchronizer) GetTerm() consensus.Term {
	return 0
}

// AddNode adds a new node to the cluster
func (c *CRDTSynchronizer) AddNode(nodeID consensus.NodeID, address string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.vectorClocks[nodeID] == nil {
		c.vectorClocks[nodeID] = make(VectorClock)
	}
	
	return nil
}

// RemoveNode removes a node from the cluster
func (c *CRDTSynchronizer) RemoveNode(nodeID consensus.NodeID) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	delete(c.vectorClocks, nodeID)
	
	return nil
}

// RegisterCRDT registers a CRDT instance with a key
func (c *CRDTSynchronizer) RegisterCRDT(key string, crdt CRDT) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.crdtStates[key] = crdt
}

// GetCRDT retrieves a CRDT instance by key
func (c *CRDTSynchronizer) GetCRDT(key string) (CRDT, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	crdt, exists := c.crdtStates[key]
	return crdt, exists
}

// applyOperation applies an operation to a CRDT
func (c *CRDTSynchronizer) applyOperation(operation *Operation) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update vector clock
	c.vectorClocks[c.nodeID][c.nodeID]++
	
	// Apply to CRDT
	crdt, exists := c.crdtStates[operation.Key]
	if !exists {
		return fmt.Errorf("CRDT not found: %s", operation.Key)
	}

	if err := crdt.Update(*operation); err != nil {
		return fmt.Errorf("failed to apply operation: %w", err)
	}

	// Broadcast operation to other nodes
	c.broadcastOperation(operation)

	return nil
}

// messageHandler processes incoming CRDT messages
func (c *CRDTSynchronizer) messageHandler() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			return
		case rawMsg := <-c.transport.Receive():
			if rawMsg.Type == consensus.CRDTUpdateMsg ||
			   rawMsg.Type == consensus.CRDTMergeMsg ||
			   rawMsg.Type == consensus.CRDTSyncMsg {
				var crdtMsg CRDTMessage
				if err := json.Unmarshal(rawMsg.Data, &crdtMsg); err != nil {
					fmt.Printf("Failed to unmarshal CRDT message: %v\n", err)
					continue
				}
				c.handleCRDTMessage(&crdtMsg)
			}
		}
	}
}

// syncHandler performs periodic synchronization
func (c *CRDTSynchronizer) syncHandler() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-c.syncTicker.C:
			c.performSync()
		}
	}
}

// mergeHandler handles merge operations
func (c *CRDTSynchronizer) mergeHandler() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			return
		case msg := <-c.mergeCh:
			c.processMergeMessage(msg)
		}
	}
}

// handleCRDTMessage processes a received CRDT message
func (c *CRDTSynchronizer) handleCRDTMessage(msg *CRDTMessage) {
	switch msg.Type {
	case StateSync:
		c.handleStateSync(msg)
	case OperationSync:
		c.handleOperationSync(msg)
	case MergeRequest:
		c.handleMergeRequest(msg)
	case MergeResponse:
		c.handleMergeResponse(msg)
	}
}

// handleStateSync processes state synchronization messages
func (c *CRDTSynchronizer) handleStateSync(msg *CRDTMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update vector clock
	c.mergeVectorClock(msg.VectorClock)

	// Merge CRDT states
	for key, stateData := range msg.CRDTStates {
		localCRDT, exists := c.crdtStates[key]
		if !exists {
			continue
		}

		// Deserialize remote state
		remoteCRDT := localCRDT.Clone()
		if err := remoteCRDT.Deserialize(stateData); err != nil {
			fmt.Printf("Failed to deserialize CRDT state: %v\n", err)
			continue
		}

		// Merge states
		if err := localCRDT.Merge(remoteCRDT); err != nil {
			fmt.Printf("Failed to merge CRDT states: %v\n", err)
			continue
		}

		// Log the merge operation
		c.logMergeOperation(key, msg.From, stateData)
	}
}

// handleOperationSync processes operation synchronization messages
func (c *CRDTSynchronizer) handleOperationSync(msg *CRDTMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update vector clock
	c.mergeVectorClock(msg.VectorClock)

	// Apply operations
	for _, operation := range msg.Operations {
		crdt, exists := c.crdtStates[operation.Key]
		if !exists {
			continue
		}

		if err := crdt.Update(operation); err != nil {
			fmt.Printf("Failed to apply remote operation: %v\n", err)
		}
	}
}

// handleMergeRequest processes merge request messages
func (c *CRDTSynchronizer) handleMergeRequest(msg *CRDTMessage) {
	// Enqueue for processing
	select {
	case c.mergeCh <- msg:
	default:
		fmt.Printf("Merge channel full, dropping message\n")
	}
}

// handleMergeResponse processes merge response messages
func (c *CRDTSynchronizer) handleMergeResponse(msg *CRDTMessage) {
	// Handle merge responses
	c.handleStateSync(msg)
}

// performSync performs periodic synchronization with other nodes
func (c *CRDTSynchronizer) performSync() {
	c.mu.RLock()
	
	// Serialize all CRDT states
	crdtStates := make(map[string][]byte)
	for key, crdt := range c.crdtStates {
		if data, err := crdt.Serialize(); err == nil {
			crdtStates[key] = data
		}
	}
	
	// Copy vector clock
	vectorClock := make(VectorClock)
	for nodeID, clock := range c.vectorClocks[c.nodeID] {
		vectorClock[nodeID] = clock
	}
	c.mu.RUnlock()

	// Create sync message
	syncMsg := &CRDTMessage{
		Type:        StateSync,
		From:        c.nodeID,
		CRDTStates:  crdtStates,
		VectorClock: vectorClock,
		Timestamp:   time.Now(),
	}

	// Broadcast to all nodes
	c.broadcastCRDTMessage(syncMsg, consensus.CRDTSyncMsg)
}

// broadcastOperation broadcasts an operation to all nodes
func (c *CRDTSynchronizer) broadcastOperation(operation *Operation) {
	opMsg := &CRDTMessage{
		Type:       OperationSync,
		From:       c.nodeID,
		Operations: []Operation{*operation},
		VectorClock: c.vectorClocks[c.nodeID],
		Timestamp:  time.Now(),
	}

	c.broadcastCRDTMessage(opMsg, consensus.CRDTUpdateMsg)
}

// broadcastCRDTMessage broadcasts a CRDT message
func (c *CRDTSynchronizer) broadcastCRDTMessage(crdtMsg *CRDTMessage, msgType consensus.MessageType) {
	data, err := json.Marshal(crdtMsg)
	if err != nil {
		fmt.Printf("Failed to marshal CRDT message: %v\n", err)
		return
	}

	consensusMsg := &consensus.ConsensusMessage{
		Type:      msgType,
		From:      c.nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}

	if err := c.transport.Broadcast(consensusMsg); err != nil {
		fmt.Printf("Failed to broadcast CRDT message: %v\n", err)
	}
}

// processMergeMessage processes a merge message
func (c *CRDTSynchronizer) processMergeMessage(msg *CRDTMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Process merge request
	for key, stateData := range msg.CRDTStates {
		localCRDT, exists := c.crdtStates[key]
		if !exists {
			continue
		}

		// Create response with our current state
		localData, err := localCRDT.Serialize()
		if err != nil {
			continue
		}

		responseMsg := &CRDTMessage{
			Type:        MergeResponse,
			From:        c.nodeID,
			CRDTStates:  map[string][]byte{key: localData},
			VectorClock: c.vectorClocks[c.nodeID],
			Timestamp:   time.Now(),
		}

		c.sendCRDTMessageToNode(msg.From, responseMsg, consensus.CRDTMergeMsg)

		// Merge the incoming state
		remoteCRDT := localCRDT.Clone()
		if err := remoteCRDT.Deserialize(stateData); err == nil {
			localCRDT.Merge(remoteCRDT)
			c.logMergeOperation(key, msg.From, stateData)
		}
	}
}

// sendCRDTMessageToNode sends a CRDT message to a specific node
func (c *CRDTSynchronizer) sendCRDTMessageToNode(nodeID consensus.NodeID, crdtMsg *CRDTMessage, msgType consensus.MessageType) {
	data, err := json.Marshal(crdtMsg)
	if err != nil {
		fmt.Printf("Failed to marshal CRDT message: %v\n", err)
		return
	}

	consensusMsg := &consensus.ConsensusMessage{
		Type:      msgType,
		From:      c.nodeID,
		To:        nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}

	if err := c.transport.Send(nodeID, consensusMsg); err != nil {
		fmt.Printf("Failed to send CRDT message: %v\n", err)
	}
}

// mergeVectorClock merges a remote vector clock with local one
func (c *CRDTSynchronizer) mergeVectorClock(remote VectorClock) {
	for nodeID, remoteClock := range remote {
		if localClock, exists := c.vectorClocks[nodeID]; exists {
			for node, clock := range remoteClock {
				if localClock[node] < clock {
					localClock[node] = clock
				}
			}
		} else {
			c.vectorClocks[nodeID] = make(VectorClock)
			for node, clock := range remoteClock {
				c.vectorClocks[nodeID][node] = clock
			}
		}
	}
}

// logMergeOperation logs a merge operation
func (c *CRDTSynchronizer) logMergeOperation(crdtKey string, from consensus.NodeID, newState []byte) {
	if len(c.mergeLog) >= c.maxMergeOps {
		// Remove oldest entry
		c.mergeLog = c.mergeLog[1:]
	}

	mergeOp := MergeOperation{
		ID:          fmt.Sprintf("%s-%d", c.nodeID, time.Now().UnixNano()),
		From:        from,
		CRDTKey:     crdtKey,
		NewState:    newState,
		Timestamp:   time.Now(),
		VectorClock: c.vectorClocks[c.nodeID],
	}

	c.mergeLog = append(c.mergeLog, mergeOp)
}

// loadState loads CRDT state from storage
func (c *CRDTSynchronizer) loadState() error {
	// Implementation would load from persistent storage
	return nil
}

// saveState saves CRDT state to storage
func (c *CRDTSynchronizer) saveState() error {
	// Implementation would save to persistent storage
	return nil
}

// GetMergeLog returns the merge operation log
func (c *CRDTSynchronizer) GetMergeLog() []MergeOperation {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	result := make([]MergeOperation, len(c.mergeLog))
	copy(result, c.mergeLog)
	return result
}

// GetVectorClock returns the current vector clock
func (c *CRDTSynchronizer) GetVectorClock() map[consensus.NodeID]VectorClock {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	result := make(map[consensus.NodeID]VectorClock)
	for nodeID, clock := range c.vectorClocks {
		result[nodeID] = make(VectorClock)
		for node, value := range clock {
			result[nodeID][node] = value
		}
	}
	return result
}