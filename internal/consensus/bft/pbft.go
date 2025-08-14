package bft

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// PBFT implements the Practical Byzantine Fault Tolerance consensus algorithm
type PBFT struct {
	mu     sync.RWMutex
	nodeID consensus.NodeID
	config *consensus.Config

	// PBFT state
	view         uint64
	sequenceNum  uint64
	primary      consensus.NodeID
	state        consensus.ConsensusState
	faultCount   int
	totalNodes   int

	// Message logs
	prePrepareLog map[string]*PrePrepareMessage
	prepareLog    map[string]map[consensus.NodeID]*PrepareMessage
	commitLog     map[string]map[consensus.NodeID]*CommitMessage
	checkpointLog map[uint64]map[consensus.NodeID]*CheckpointMessage
	
	// Request tracking
	requestLog    map[string]*ClientRequest
	replyLog      map[string]*ReplyMessage
	lastExecuted  uint64

	// View change state
	viewChangeLog map[uint64]map[consensus.NodeID]*ViewChangeMessage
	newViewLog    map[uint64]*NewViewMessage

	// Components
	transport    consensus.Transport
	stateMachine consensus.StateMachine
	storage      consensus.Storage

	// Control channels
	requestCh     chan *ClientRequest
	timeoutCh     chan struct{}
	viewChangeCh  chan struct{}

	// Context and cancellation
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Timers
	requestTimer  *time.Timer
	viewTimer     *time.Timer
	checkpointTimer *time.Timer
}

// PBFT Message Types
type PrePrepareMessage struct {
	View        uint64         `json:"view"`
	SequenceNum uint64         `json:"sequence_num"`
	Digest      string         `json:"digest"`
	Request     *ClientRequest `json:"request"`
}

type PrepareMessage struct {
	View        uint64 `json:"view"`
	SequenceNum uint64 `json:"sequence_num"`
	Digest      string `json:"digest"`
	NodeID      consensus.NodeID `json:"node_id"`
}

type CommitMessage struct {
	View        uint64 `json:"view"`
	SequenceNum uint64 `json:"sequence_num"`
	Digest      string `json:"digest"`
	NodeID      consensus.NodeID `json:"node_id"`
}

type CheckpointMessage struct {
	SequenceNum uint64 `json:"sequence_num"`
	Digest      string `json:"digest"`
	NodeID      consensus.NodeID `json:"node_id"`
}

type ViewChangeMessage struct {
	View        uint64 `json:"view"`
	SequenceNum uint64 `json:"sequence_num"`
	CheckpointProof map[consensus.NodeID]*CheckpointMessage `json:"checkpoint_proof"`
	PrepareProof map[string]*PrepareProof `json:"prepare_proof"`
	NodeID      consensus.NodeID `json:"node_id"`
}

type NewViewMessage struct {
	View         uint64 `json:"view"`
	ViewChangeProof map[consensus.NodeID]*ViewChangeMessage `json:"view_change_proof"`
	PrePrepareMessages []*PrePrepareMessage `json:"pre_prepare_messages"`
}

type PrepareProof struct {
	PrePrepare *PrePrepareMessage `json:"pre_prepare"`
	Prepares   map[consensus.NodeID]*PrepareMessage `json:"prepares"`
}

type ClientRequest struct {
	Timestamp  time.Time `json:"timestamp"`
	ClientID   string    `json:"client_id"`
	Operation  string    `json:"operation"`
	Data       []byte    `json:"data"`
	Signature  string    `json:"signature,omitempty"`
}

type ReplyMessage struct {
	View       uint64    `json:"view"`
	Timestamp  time.Time `json:"timestamp"`
	ClientID   string    `json:"client_id"`
	NodeID     consensus.NodeID `json:"node_id"`
	Result     []byte    `json:"result"`
}

// NewPBFT creates a new PBFT consensus instance
func NewPBFT(config *consensus.Config, transport consensus.Transport, stateMachine consensus.StateMachine, storage consensus.Storage) *PBFT {
	ctx, cancel := context.WithCancel(context.Background())
	
	totalNodes := len(config.Nodes)
	faultCount := (totalNodes - 1) / 3 // f = (n-1)/3 for PBFT

	p := &PBFT{
		nodeID:         config.NodeID,
		config:         config,
		view:           0,
		sequenceNum:    0,
		primary:        consensus.NodeID(config.Nodes[0]), // Simple primary selection
		state:          consensus.Backup,
		faultCount:     faultCount,
		totalNodes:     totalNodes,
		prePrepareLog:  make(map[string]*PrePrepareMessage),
		prepareLog:     make(map[string]map[consensus.NodeID]*PrepareMessage),
		commitLog:      make(map[string]map[consensus.NodeID]*CommitMessage),
		checkpointLog:  make(map[uint64]map[consensus.NodeID]*CheckpointMessage),
		requestLog:     make(map[string]*ClientRequest),
		replyLog:       make(map[string]*ReplyMessage),
		viewChangeLog:  make(map[uint64]map[consensus.NodeID]*ViewChangeMessage),
		newViewLog:     make(map[uint64]*NewViewMessage),
		transport:      transport,
		stateMachine:   stateMachine,
		storage:        storage,
		requestCh:      make(chan *ClientRequest, 100),
		timeoutCh:      make(chan struct{}, 1),
		viewChangeCh:   make(chan struct{}, 1),
		ctx:            ctx,
		cancel:         cancel,
	}

	if p.nodeID == p.primary {
		p.state = consensus.Primary
	}

	return p
}

// Start begins the PBFT consensus protocol
func (p *PBFT) Start(ctx context.Context) error {
	// Load persistent state
	if err := p.loadState(); err != nil {
		return fmt.Errorf("failed to load state: %w", err)
	}

	// Start transport
	if err := p.transport.Start(); err != nil {
		return fmt.Errorf("failed to start transport: %w", err)
	}

	// Start message handlers
	p.wg.Add(3)
	go p.messageHandler()
	go p.requestHandler()
	go p.timerHandler()

	return nil
}

// Stop gracefully shuts down the PBFT instance
func (p *PBFT) Stop() error {
	p.cancel()
	p.wg.Wait()

	if err := p.transport.Stop(); err != nil {
		return fmt.Errorf("failed to stop transport: %w", err)
	}

	return p.saveState()
}

// Propose submits a new proposal to the consensus
func (p *PBFT) Propose(ctx context.Context, data []byte) error {
	request := &ClientRequest{
		Timestamp: time.Now(),
		ClientID:  string(p.nodeID),
		Operation: "propose",
		Data:      data,
	}

	select {
	case p.requestCh <- request:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return fmt.Errorf("request channel full")
	}
}

// GetState returns the current consensus state
func (p *PBFT) GetState() consensus.ConsensusState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state
}

// GetLeader returns the current primary node ID
func (p *PBFT) GetLeader() consensus.NodeID {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.primary
}

// IsLeader returns true if this node is the primary
func (p *PBFT) IsLeader() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state == consensus.Primary
}

// GetTerm returns the current view (equivalent to term in other algorithms)
func (p *PBFT) GetTerm() consensus.Term {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return consensus.Term(p.view)
}

// AddNode adds a new node to the cluster
func (p *PBFT) AddNode(nodeID consensus.NodeID, address string) error {
	// PBFT typically requires reconfiguration for adding nodes
	// This is a simplified implementation
	p.mu.Lock()
	defer p.mu.Unlock()
	
	p.totalNodes++
	p.faultCount = (p.totalNodes - 1) / 3
	
	return nil
}

// RemoveNode removes a node from the cluster
func (p *PBFT) RemoveNode(nodeID consensus.NodeID) error {
	// PBFT typically requires reconfiguration for removing nodes
	p.mu.Lock()
	defer p.mu.Unlock()
	
	if p.totalNodes > 1 {
		p.totalNodes--
		p.faultCount = (p.totalNodes - 1) / 3
	}
	
	return nil
}

// messageHandler processes incoming consensus messages
func (p *PBFT) messageHandler() {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case msg := <-p.transport.Receive():
			p.handleMessage(msg)
		}
	}
}

// handleMessage processes a consensus message based on its type
func (p *PBFT) handleMessage(msg *consensus.ConsensusMessage) {
	switch msg.Type {
	case consensus.PrePrepareMsg:
		p.handlePrePrepare(msg)
	case consensus.PrepareMsg:
		p.handlePrepare(msg)
	case consensus.CommitMsg:
		p.handleCommit(msg)
	case consensus.CheckpointMsg:
		p.handleCheckpoint(msg)
	case consensus.ViewChangeMsg:
		p.handleViewChange(msg)
	case consensus.NewViewMsg:
		p.handleNewView(msg)
	}
}

// requestHandler processes client requests (for primary)
func (p *PBFT) requestHandler() {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case request := <-p.requestCh:
			if p.IsLeader() {
				p.processClientRequest(request)
			}
		}
	}
}

// timerHandler manages various timeouts
func (p *PBFT) timerHandler() {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-p.timeoutCh:
			p.handleTimeout()
		case <-p.viewChangeCh:
			p.initiateViewChange()
		}
	}
}

// processClientRequest processes a client request (primary only)
func (p *PBFT) processClientRequest(request *ClientRequest) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.state != consensus.Primary {
		return
	}

	p.sequenceNum++
	digest := p.computeDigest(request)

	// Store the request
	p.requestLog[digest] = request

	// Create pre-prepare message
	prePrepare := &PrePrepareMessage{
		View:        p.view,
		SequenceNum: p.sequenceNum,
		Digest:      digest,
		Request:     request,
	}

	// Store pre-prepare
	p.prePrepareLog[digest] = prePrepare

	// Broadcast pre-prepare to all backups
	p.broadcastPrePrepare(prePrepare)
}

// handlePrePrepare processes PrePrepare messages (backup nodes)
func (p *PBFT) handlePrePrepare(msg *consensus.ConsensusMessage) {
	var prePrepare PrePrepareMessage
	if err := json.Unmarshal(msg.Data, &prePrepare); err != nil {
		fmt.Printf("Failed to unmarshal PrePrepare: %v\n", err)
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	// Ignore if not from primary
	if msg.From != p.primary {
		return
	}

	// Check view
	if prePrepare.View != p.view {
		return
	}

	// Verify digest
	expectedDigest := p.computeDigest(prePrepare.Request)
	if prePrepare.Digest != expectedDigest {
		return
	}

	// Store pre-prepare and request
	p.prePrepareLog[prePrepare.Digest] = &prePrepare
	p.requestLog[prePrepare.Digest] = prePrepare.Request

	// Send prepare message
	prepare := &PrepareMessage{
		View:        prePrepare.View,
		SequenceNum: prePrepare.SequenceNum,
		Digest:      prePrepare.Digest,
		NodeID:      p.nodeID,
	}

	p.broadcastPrepare(prepare)
}

// handlePrepare processes Prepare messages
func (p *PBFT) handlePrepare(msg *consensus.ConsensusMessage) {
	var prepare PrepareMessage
	if err := json.Unmarshal(msg.Data, &prepare); err != nil {
		fmt.Printf("Failed to unmarshal Prepare: %v\n", err)
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	// Check view
	if prepare.View != p.view {
		return
	}

	// Store prepare message
	if p.prepareLog[prepare.Digest] == nil {
		p.prepareLog[prepare.Digest] = make(map[consensus.NodeID]*PrepareMessage)
	}
	p.prepareLog[prepare.Digest][msg.From] = &prepare

	// Check if we have enough prepare messages (2f + 1)
	if len(p.prepareLog[prepare.Digest]) >= 2*p.faultCount+1 {
		// Check if we have the corresponding pre-prepare
		if _, exists := p.prePrepareLog[prepare.Digest]; exists {
			// Send commit message
			commit := &CommitMessage{
				View:        prepare.View,
				SequenceNum: prepare.SequenceNum,
				Digest:      prepare.Digest,
				NodeID:      p.nodeID,
			}
			p.broadcastCommit(commit)
		}
	}
}

// handleCommit processes Commit messages
func (p *PBFT) handleCommit(msg *consensus.ConsensusMessage) {
	var commit CommitMessage
	if err := json.Unmarshal(msg.Data, &commit); err != nil {
		fmt.Printf("Failed to unmarshal Commit: %v\n", err)
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	// Check view
	if commit.View != p.view {
		return
	}

	// Store commit message
	if p.commitLog[commit.Digest] == nil {
		p.commitLog[commit.Digest] = make(map[consensus.NodeID]*CommitMessage)
	}
	p.commitLog[commit.Digest][msg.From] = &commit

	// Check if we have enough commit messages (2f + 1)
	if len(p.commitLog[commit.Digest]) >= 2*p.faultCount+1 {
		// Execute the request
		p.executeRequest(commit.Digest, commit.SequenceNum)
	}
}

// executeRequest executes a client request
func (p *PBFT) executeRequest(digest string, sequenceNum uint64) {
	request, exists := p.requestLog[digest]
	if !exists {
		return
	}

	// Apply to state machine
	entry := &consensus.LogEntry{
		Index:     consensus.LogIndex(sequenceNum),
		Term:      consensus.Term(p.view),
		Data:      request.Data,
		Timestamp: request.Timestamp,
		Committed: true,
	}

	result, err := p.stateMachine.Apply(entry)
	if err != nil {
		fmt.Printf("Failed to apply entry: %v\n", err)
		return
	}

	// Update last executed
	p.lastExecuted = sequenceNum

	// Send reply to client
	reply := &ReplyMessage{
		View:      p.view,
		Timestamp: request.Timestamp,
		ClientID:  request.ClientID,
		NodeID:    p.nodeID,
		Result:    result,
	}

	p.replyLog[request.ClientID] = reply
	p.sendReply(reply)
}

// Helper methods for broadcasting messages
func (p *PBFT) broadcastPrePrepare(prePrepare *PrePrepareMessage) {
	data, _ := json.Marshal(prePrepare)
	msg := &consensus.ConsensusMessage{
		Type:      consensus.PrePrepareMsg,
		Term:      consensus.Term(p.view),
		From:      p.nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}
	p.transport.Broadcast(msg)
}

func (p *PBFT) broadcastPrepare(prepare *PrepareMessage) {
	data, _ := json.Marshal(prepare)
	msg := &consensus.ConsensusMessage{
		Type:      consensus.PrepareMsg,
		Term:      consensus.Term(p.view),
		From:      p.nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}
	p.transport.Broadcast(msg)
}

func (p *PBFT) broadcastCommit(commit *CommitMessage) {
	data, _ := json.Marshal(commit)
	msg := &consensus.ConsensusMessage{
		Type:      consensus.CommitMsg,
		Term:      consensus.Term(p.view),
		From:      p.nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}
	p.transport.Broadcast(msg)
}

// computeDigest computes SHA-256 digest of a request
func (p *PBFT) computeDigest(request *ClientRequest) string {
	data, _ := json.Marshal(request)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// Helper methods (stubs for brevity)
func (p *PBFT) handleCheckpoint(msg *consensus.ConsensusMessage) {}
func (p *PBFT) handleViewChange(msg *consensus.ConsensusMessage) {}
func (p *PBFT) handleNewView(msg *consensus.ConsensusMessage) {}
func (p *PBFT) handleTimeout() {}
func (p *PBFT) initiateViewChange() {}
func (p *PBFT) sendReply(reply *ReplyMessage) {}
func (p *PBFT) loadState() error { return nil }
func (p *PBFT) saveState() error { return nil }