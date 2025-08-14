package consensus

import (
	"context"
	"time"
)

// NodeID represents a unique identifier for a consensus node
type NodeID string

// Term represents a consensus term/epoch
type Term uint64

// LogIndex represents an index in the consensus log
type LogIndex uint64

// ConsensusMessage represents a generic consensus message
type ConsensusMessage struct {
	Type      MessageType   `json:"type"`
	Term      Term         `json:"term"`
	From      NodeID       `json:"from"`
	To        NodeID       `json:"to"`
	Data      []byte       `json:"data"`
	Timestamp time.Time    `json:"timestamp"`
}

// MessageType defines the type of consensus messages
type MessageType int

const (
	// Raft messages
	RequestVoteMsg MessageType = iota
	RequestVoteResponseMsg
	AppendEntriesMsg
	AppendEntriesResponseMsg
	
	// PBFT messages
	PrePrepareMsg
	PrepareMsg
	CommitMsg
	CheckpointMsg
	ViewChangeMsg
	NewViewMsg
	
	// Gossip messages
	GossipDataMsg
	GossipAckMsg
	GossipSyncMsg
	
	// CRDT messages
	CRDTUpdateMsg
	CRDTMergeMsg
	CRDTSyncMsg
	
	// Quorum messages
	QuorumVoteMsg
	QuorumResultMsg
)

// ConsensusState represents the current state of a consensus node
type ConsensusState int

const (
	Follower ConsensusState = iota
	Candidate
	Leader
	Primary
	Backup
	Recovering
)

// LogEntry represents an entry in the consensus log
type LogEntry struct {
	Index     LogIndex    `json:"index"`
	Term      Term        `json:"term"`
	Type      string      `json:"type"`
	Data      []byte      `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	Committed bool        `json:"committed"`
}

// Consensus defines the interface for consensus algorithms
type Consensus interface {
	// Start begins the consensus protocol
	Start(ctx context.Context) error
	
	// Stop gracefully shuts down the consensus protocol
	Stop() error
	
	// Propose submits a new proposal to the consensus
	Propose(ctx context.Context, data []byte) error
	
	// GetState returns the current consensus state
	GetState() ConsensusState
	
	// GetLeader returns the current leader node ID
	GetLeader() NodeID
	
	// IsLeader returns true if this node is the leader
	IsLeader() bool
	
	// GetTerm returns the current term
	GetTerm() Term
	
	// AddNode adds a new node to the cluster
	AddNode(nodeID NodeID, address string) error
	
	// RemoveNode removes a node from the cluster
	RemoveNode(nodeID NodeID) error
}

// StateMachine defines the interface for state machines
type StateMachine interface {
	// Apply applies a log entry to the state machine
	Apply(entry *LogEntry) ([]byte, error)
	
	// Snapshot creates a snapshot of the current state
	Snapshot() ([]byte, error)
	
	// Restore restores state from a snapshot
	Restore(snapshot []byte) error
	
	// GetState returns the current state
	GetState() interface{}
}

// Transport defines the interface for network transport
type Transport interface {
	// Send sends a message to a specific node
	Send(nodeID NodeID, msg *ConsensusMessage) error
	
	// Broadcast sends a message to all nodes
	Broadcast(msg *ConsensusMessage) error
	
	// Receive returns a channel for receiving messages
	Receive() <-chan *ConsensusMessage
	
	// Start starts the transport layer
	Start() error
	
	// Stop stops the transport layer
	Stop() error
	
	// GetAddress returns the address for a node
	GetAddress(nodeID NodeID) string
}

// Storage defines the interface for persistent storage
type Storage interface {
	// SaveState saves consensus state
	SaveState(state interface{}) error
	
	// LoadState loads consensus state
	LoadState(state interface{}) error
	
	// SaveLog saves log entries
	SaveLog(entries []*LogEntry) error
	
	// LoadLog loads log entries
	LoadLog(startIndex, endIndex LogIndex) ([]*LogEntry, error)
	
	// SaveSnapshot saves a state machine snapshot
	SaveSnapshot(snapshot []byte) error
	
	// LoadSnapshot loads a state machine snapshot
	LoadSnapshot() ([]byte, error)
	
	// Close closes the storage
	Close() error
}

// Config represents configuration for consensus protocols
type Config struct {
	NodeID              NodeID        `json:"node_id"`
	Nodes               []string      `json:"nodes"`
	ElectionTimeout     time.Duration `json:"election_timeout"`
	HeartbeatTimeout    time.Duration `json:"heartbeat_timeout"`
	RequestTimeout      time.Duration `json:"request_timeout"`
	MaxLogEntries       int           `json:"max_log_entries"`
	SnapshotInterval    int           `json:"snapshot_interval"`
	BatchSize           int           `json:"batch_size"`
	Byzantine           bool          `json:"byzantine"`
	FaultTolerance      int           `json:"fault_tolerance"`
}

// Metrics represents consensus metrics
type Metrics struct {
	CurrentTerm        Term          `json:"current_term"`
	VotesReceived      int           `json:"votes_received"`
	LastLogIndex       LogIndex      `json:"last_log_index"`
	CommitIndex        LogIndex      `json:"commit_index"`
	MessagesSent       uint64        `json:"messages_sent"`
	MessagesReceived   uint64        `json:"messages_received"`
	Latency           time.Duration `json:"latency"`
	Throughput        float64       `json:"throughput"`
}