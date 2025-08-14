package raft

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// Raft implements the Raft consensus algorithm
type Raft struct {
	mu     sync.RWMutex
	nodeID consensus.NodeID
	config *consensus.Config

	// Persistent state
	currentTerm consensus.Term
	votedFor    consensus.NodeID
	log         []*consensus.LogEntry

	// Volatile state
	commitIndex consensus.LogIndex
	lastApplied consensus.LogIndex

	// Leader state
	nextIndex  map[consensus.NodeID]consensus.LogIndex
	matchIndex map[consensus.NodeID]consensus.LogIndex

	// Raft specific state
	state       consensus.ConsensusState
	leader      consensus.NodeID
	votes       map[consensus.NodeID]bool
	lastContact time.Time

	// Components
	transport    consensus.Transport
	stateMachine consensus.StateMachine
	storage      consensus.Storage

	// Control channels
	applyCh       chan *consensus.LogEntry
	stepDownCh    chan struct{}
	electionTimer *time.Timer
	heartbeatTimer *time.Timer

	// Context and cancellation
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewRaft creates a new Raft consensus instance
func NewRaft(config *consensus.Config, transport consensus.Transport, stateMachine consensus.StateMachine, storage consensus.Storage) *Raft {
	ctx, cancel := context.WithCancel(context.Background())
	
	r := &Raft{
		nodeID:       config.NodeID,
		config:       config,
		currentTerm:  0,
		votedFor:     "",
		log:          make([]*consensus.LogEntry, 0),
		commitIndex:  0,
		lastApplied:  0,
		nextIndex:    make(map[consensus.NodeID]consensus.LogIndex),
		matchIndex:   make(map[consensus.NodeID]consensus.LogIndex),
		state:        consensus.Follower,
		votes:        make(map[consensus.NodeID]bool),
		transport:    transport,
		stateMachine: stateMachine,
		storage:      storage,
		applyCh:      make(chan *consensus.LogEntry, 100),
		stepDownCh:   make(chan struct{}, 1),
		ctx:          ctx,
		cancel:       cancel,
	}

	r.resetElectionTimer()
	return r
}

// Start begins the Raft consensus protocol
func (r *Raft) Start(ctx context.Context) error {
	// Load persistent state
	if err := r.loadState(); err != nil {
		return fmt.Errorf("failed to load state: %w", err)
	}

	// Start transport
	if err := r.transport.Start(); err != nil {
		return fmt.Errorf("failed to start transport: %w", err)
	}

	// Start main loop
	r.wg.Add(3)
	go r.messageHandler()
	go r.electionHandler()
	go r.applyHandler()

	return nil
}

// Stop gracefully shuts down the Raft instance
func (r *Raft) Stop() error {
	r.cancel()
	r.wg.Wait()

	if err := r.transport.Stop(); err != nil {
		return fmt.Errorf("failed to stop transport: %w", err)
	}

	return r.saveState()
}

// Propose submits a new proposal to the consensus
func (r *Raft) Propose(ctx context.Context, data []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.state != consensus.Leader {
		return fmt.Errorf("not leader")
	}

	// Create new log entry
	entry := &consensus.LogEntry{
		Index:     consensus.LogIndex(len(r.log) + 1),
		Term:      r.currentTerm,
		Data:      data,
		Timestamp: time.Now(),
		Committed: false,
	}

	r.log = append(r.log, entry)
	r.saveState()

	// Replicate to followers immediately
	r.replicateLog()

	return nil
}

// GetState returns the current consensus state
func (r *Raft) GetState() consensus.ConsensusState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.state
}

// GetLeader returns the current leader node ID
func (r *Raft) GetLeader() consensus.NodeID {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.leader
}

// IsLeader returns true if this node is the leader
func (r *Raft) IsLeader() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.state == consensus.Leader
}

// GetTerm returns the current term
func (r *Raft) GetTerm() consensus.Term {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.currentTerm
}

// AddNode adds a new node to the cluster
func (r *Raft) AddNode(nodeID consensus.NodeID, address string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.state == consensus.Leader {
		r.nextIndex[nodeID] = consensus.LogIndex(len(r.log) + 1)
		r.matchIndex[nodeID] = 0
	}

	return nil
}

// RemoveNode removes a node from the cluster
func (r *Raft) RemoveNode(nodeID consensus.NodeID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.nextIndex, nodeID)
	delete(r.matchIndex, nodeID)
	delete(r.votes, nodeID)

	return nil
}

// messageHandler handles incoming messages
func (r *Raft) messageHandler() {
	defer r.wg.Done()

	for {
		select {
		case <-r.ctx.Done():
			return
		case msg := <-r.transport.Receive():
			r.handleMessage(msg)
		}
	}
}

// handleMessage processes a consensus message
func (r *Raft) handleMessage(msg *consensus.ConsensusMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if message is from a newer term
	if msg.Term > r.currentTerm {
		r.currentTerm = msg.Term
		r.votedFor = ""
		r.stepDown()
		r.saveState()
	}

	switch msg.Type {
	case consensus.RequestVoteMsg:
		r.handleRequestVote(msg)
	case consensus.RequestVoteResponseMsg:
		r.handleRequestVoteResponse(msg)
	case consensus.AppendEntriesMsg:
		r.handleAppendEntries(msg)
	case consensus.AppendEntriesResponseMsg:
		r.handleAppendEntriesResponse(msg)
	}
}

// electionHandler manages election timeouts and leadership
func (r *Raft) electionHandler() {
	defer r.wg.Done()

	for {
		select {
		case <-r.ctx.Done():
			return
		case <-r.electionTimer.C:
			r.startElection()
		case <-r.stepDownCh:
			r.mu.Lock()
			if r.state == consensus.Leader {
				r.state = consensus.Follower
				r.leader = ""
				r.resetElectionTimer()
				if r.heartbeatTimer != nil {
					r.heartbeatTimer.Stop()
				}
			}
			r.mu.Unlock()
		}
	}
}

// applyHandler applies committed entries to the state machine
func (r *Raft) applyHandler() {
	defer r.wg.Done()

	for {
		select {
		case <-r.ctx.Done():
			return
		case entry := <-r.applyCh:
			if _, err := r.stateMachine.Apply(entry); err != nil {
				fmt.Printf("Failed to apply entry %d: %v\n", entry.Index, err)
			}
			r.mu.Lock()
			r.lastApplied = entry.Index
			r.mu.Unlock()
		default:
			r.mu.Lock()
			for r.lastApplied < r.commitIndex {
				r.lastApplied++
				if int(r.lastApplied) <= len(r.log) {
					entry := r.log[r.lastApplied-1]
					entry.Committed = true
					select {
					case r.applyCh <- entry:
					default:
					}
				}
			}
			r.mu.Unlock()
			time.Sleep(10 * time.Millisecond)
		}
	}
}

// startElection initiates a new election
func (r *Raft) startElection() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Transition to candidate
	r.state = consensus.Candidate
	r.currentTerm++
	r.votedFor = r.nodeID
	r.leader = ""
	r.votes = make(map[consensus.NodeID]bool)
	r.votes[r.nodeID] = true
	r.resetElectionTimer()
	r.saveState()

	// Get last log info
	lastLogIndex := consensus.LogIndex(len(r.log))
	lastLogTerm := consensus.Term(0)
	if len(r.log) > 0 {
		lastLogTerm = r.log[len(r.log)-1].Term
	}

	// Send RequestVote to all other nodes
	for _, nodeAddr := range r.config.Nodes {
		// Skip self (this is simplified - in practice you'd have a node registry)
		go r.sendRequestVote(consensus.NodeID(nodeAddr), lastLogIndex, lastLogTerm)
	}
}

// sendRequestVote sends a RequestVote RPC to a node
func (r *Raft) sendRequestVote(nodeID consensus.NodeID, lastLogIndex consensus.LogIndex, lastLogTerm consensus.Term) {
	msg := &consensus.ConsensusMessage{
		Type: consensus.RequestVoteMsg,
		Term: r.currentTerm,
		From: r.nodeID,
		To:   nodeID,
		Data: []byte(fmt.Sprintf(`{"last_log_index":%d,"last_log_term":%d}`, lastLogIndex, lastLogTerm)),
		Timestamp: time.Now(),
	}

	if err := r.transport.Send(nodeID, msg); err != nil {
		fmt.Printf("Failed to send RequestVote to %s: %v\n", nodeID, err)
	}
}

// resetElectionTimer resets the election timeout
func (r *Raft) resetElectionTimer() {
	if r.electionTimer != nil {
		r.electionTimer.Stop()
	}
	
	timeout := r.config.ElectionTimeout + time.Duration(rand.Intn(int(r.config.ElectionTimeout)))
	r.electionTimer = time.NewTimer(timeout)
}

// replicateLog replicates log entries to all followers
func (r *Raft) replicateLog() {
	if r.state != consensus.Leader {
		return
	}

	for nodeID := range r.nextIndex {
		if nodeID == r.nodeID {
			continue
		}
		go r.sendAppendEntries(nodeID)
	}
}

// sendAppendEntries sends AppendEntries RPC to a follower
func (r *Raft) sendAppendEntries(nodeID consensus.NodeID) {
	r.mu.RLock()
	nextIndex := r.nextIndex[nodeID]
	prevLogIndex := nextIndex - 1
	prevLogTerm := consensus.Term(0)
	
	if prevLogIndex > 0 && int(prevLogIndex) <= len(r.log) {
		prevLogTerm = r.log[prevLogIndex-1].Term
	}

	entries := []*consensus.LogEntry{}
	if int(nextIndex) <= len(r.log) {
		entries = r.log[nextIndex-1:]
	}

	msg := &consensus.ConsensusMessage{
		Type: consensus.AppendEntriesMsg,
		Term: r.currentTerm,
		From: r.nodeID,
		To:   nodeID,
		Data: r.marshalAppendEntries(prevLogIndex, prevLogTerm, entries, r.commitIndex),
		Timestamp: time.Now(),
	}
	r.mu.RUnlock()

	if err := r.transport.Send(nodeID, msg); err != nil {
		fmt.Printf("Failed to send AppendEntries to %s: %v\n", nodeID, err)
	}
}

// Helper methods for message handling would go here
func (r *Raft) handleRequestVote(msg *consensus.ConsensusMessage) {
	// Implementation for handling RequestVote messages
}

func (r *Raft) handleRequestVoteResponse(msg *consensus.ConsensusMessage) {
	// Implementation for handling RequestVoteResponse messages
}

func (r *Raft) handleAppendEntries(msg *consensus.ConsensusMessage) {
	// Implementation for handling AppendEntries messages
}

func (r *Raft) handleAppendEntriesResponse(msg *consensus.ConsensusMessage) {
	// Implementation for handling AppendEntriesResponse messages
}

func (r *Raft) stepDown() {
	if r.state == consensus.Leader {
		select {
		case r.stepDownCh <- struct{}{}:
		default:
		}
	}
	r.state = consensus.Follower
}

func (r *Raft) loadState() error {
	// Load persistent state from storage
	return nil
}

func (r *Raft) saveState() error {
	// Save persistent state to storage
	return nil
}

func (r *Raft) marshalAppendEntries(prevLogIndex consensus.LogIndex, prevLogTerm consensus.Term, entries []*consensus.LogEntry, commitIndex consensus.LogIndex) []byte {
	// Marshal AppendEntries data
	return []byte(`{}`)
}