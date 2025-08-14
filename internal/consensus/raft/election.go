package raft

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// RequestVoteRequest represents a RequestVote RPC request
type RequestVoteRequest struct {
	Term         consensus.Term      `json:"term"`
	CandidateID  consensus.NodeID    `json:"candidate_id"`
	LastLogIndex consensus.LogIndex  `json:"last_log_index"`
	LastLogTerm  consensus.Term      `json:"last_log_term"`
}

// RequestVoteResponse represents a RequestVote RPC response
type RequestVoteResponse struct {
	Term        consensus.Term `json:"term"`
	VoteGranted bool          `json:"vote_granted"`
}

// handleRequestVote processes RequestVote RPC
func (r *Raft) handleRequestVote(msg *consensus.ConsensusMessage) {
	var req RequestVoteRequest
	if err := json.Unmarshal(msg.Data, &req); err != nil {
		fmt.Printf("Failed to unmarshal RequestVote: %v\n", err)
		return
	}

	response := RequestVoteResponse{
		Term:        r.currentTerm,
		VoteGranted: false,
	}

	// Reply false if term < currentTerm
	if req.Term < r.currentTerm {
		r.sendRequestVoteResponse(msg.From, response)
		return
	}

	// If votedFor is null or candidateId, and candidate's log is at
	// least as up-to-date as receiver's log, grant vote
	if (r.votedFor == "" || r.votedFor == req.CandidateID) && r.isLogUpToDate(req.LastLogIndex, req.LastLogTerm) {
		r.votedFor = req.CandidateID
		r.lastContact = time.Now()
		response.VoteGranted = true
		r.resetElectionTimer()
		r.saveState()
	}

	r.sendRequestVoteResponse(msg.From, response)
}

// handleRequestVoteResponse processes RequestVoteResponse RPC
func (r *Raft) handleRequestVoteResponse(msg *consensus.ConsensusMessage) {
	if r.state != consensus.Candidate {
		return
	}

	var resp RequestVoteResponse
	if err := json.Unmarshal(msg.Data, &resp); err != nil {
		fmt.Printf("Failed to unmarshal RequestVoteResponse: %v\n", err)
		return
	}

	// If response contains term T > currentTerm: set currentTerm = T, convert to follower
	if resp.Term > r.currentTerm {
		r.currentTerm = resp.Term
		r.votedFor = ""
		r.stepDown()
		r.saveState()
		return
	}

	// Count votes
	if resp.VoteGranted {
		r.votes[msg.From] = true
	}

	// Check if we have majority
	if r.hasMajority() {
		r.becomeLeader()
	}
}

// sendRequestVoteResponse sends a RequestVoteResponse
func (r *Raft) sendRequestVoteResponse(to consensus.NodeID, response RequestVoteResponse) {
	data, err := json.Marshal(response)
	if err != nil {
		fmt.Printf("Failed to marshal RequestVoteResponse: %v\n", err)
		return
	}

	msg := &consensus.ConsensusMessage{
		Type:      consensus.RequestVoteResponseMsg,
		Term:      r.currentTerm,
		From:      r.nodeID,
		To:        to,
		Data:      data,
		Timestamp: time.Now(),
	}

	if err := r.transport.Send(to, msg); err != nil {
		fmt.Printf("Failed to send RequestVoteResponse: %v\n", err)
	}
}

// isLogUpToDate determines if candidate's log is at least as up-to-date
func (r *Raft) isLogUpToDate(lastLogIndex consensus.LogIndex, lastLogTerm consensus.Term) bool {
	ourLastIndex := consensus.LogIndex(len(r.log))
	ourLastTerm := consensus.Term(0)
	
	if len(r.log) > 0 {
		ourLastTerm = r.log[len(r.log)-1].Term
	}

	// If the logs have last entries with different terms, then
	// the log with the later term is more up-to-date
	if lastLogTerm != ourLastTerm {
		return lastLogTerm > ourLastTerm
	}

	// If the logs end with the same term, then whichever log
	// is longer is more up-to-date
	return lastLogIndex >= ourLastIndex
}

// hasMajority checks if we have received votes from a majority of nodes
func (r *Raft) hasMajority() bool {
	totalNodes := len(r.config.Nodes)
	votesNeeded := (totalNodes / 2) + 1
	votesReceived := 0
	
	for _, granted := range r.votes {
		if granted {
			votesReceived++
		}
	}
	
	return votesReceived >= votesNeeded
}

// becomeLeader transitions this node to leader state
func (r *Raft) becomeLeader() {
	if r.state != consensus.Candidate {
		return
	}

	r.state = consensus.Leader
	r.leader = r.nodeID
	
	// Initialize leader state
	lastLogIndex := consensus.LogIndex(len(r.log))
	for nodeID := range r.config.Nodes {
		if consensus.NodeID(nodeID) != r.nodeID {
			r.nextIndex[consensus.NodeID(nodeID)] = lastLogIndex + 1
			r.matchIndex[consensus.NodeID(nodeID)] = 0
		}
	}

	// Send initial heartbeats
	r.sendHeartbeats()
	
	// Start heartbeat timer
	r.startHeartbeatTimer()
	
	fmt.Printf("Node %s became leader for term %d\n", r.nodeID, r.currentTerm)
}

// startHeartbeatTimer starts the heartbeat timer for leaders
func (r *Raft) startHeartbeatTimer() {
	if r.heartbeatTimer != nil {
		r.heartbeatTimer.Stop()
	}
	
	r.heartbeatTimer = time.NewTimer(r.config.HeartbeatTimeout)
	
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		
		for {
			select {
			case <-r.ctx.Done():
				return
			case <-r.heartbeatTimer.C:
				r.mu.RLock()
				if r.state == consensus.Leader {
					r.mu.RUnlock()
					r.sendHeartbeats()
					r.heartbeatTimer.Reset(r.config.HeartbeatTimeout)
				} else {
					r.mu.RUnlock()
					return
				}
			}
		}
	}()
}

// sendHeartbeats sends heartbeat messages to all followers
func (r *Raft) sendHeartbeats() {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	if r.state != consensus.Leader {
		return
	}
	
	for nodeID := range r.nextIndex {
		if nodeID == r.nodeID {
			continue
		}
		
		go r.sendHeartbeat(nodeID)
	}
}

// sendHeartbeat sends a heartbeat (empty AppendEntries) to a follower
func (r *Raft) sendHeartbeat(nodeID consensus.NodeID) {
	r.mu.RLock()
	nextIndex := r.nextIndex[nodeID]
	prevLogIndex := nextIndex - 1
	prevLogTerm := consensus.Term(0)
	
	if prevLogIndex > 0 && int(prevLogIndex) <= len(r.log) {
		prevLogTerm = r.log[prevLogIndex-1].Term
	}
	
	appendEntries := AppendEntriesRequest{
		Term:         r.currentTerm,
		LeaderID:     r.nodeID,
		PrevLogIndex: prevLogIndex,
		PrevLogTerm:  prevLogTerm,
		Entries:      []*consensus.LogEntry{}, // Empty for heartbeat
		LeaderCommit: r.commitIndex,
	}
	r.mu.RUnlock()
	
	data, err := json.Marshal(appendEntries)
	if err != nil {
		fmt.Printf("Failed to marshal heartbeat: %v\n", err)
		return
	}
	
	msg := &consensus.ConsensusMessage{
		Type:      consensus.AppendEntriesMsg,
		Term:      r.currentTerm,
		From:      r.nodeID,
		To:        nodeID,
		Data:      data,
		Timestamp: time.Now(),
	}
	
	if err := r.transport.Send(nodeID, msg); err != nil {
		fmt.Printf("Failed to send heartbeat to %s: %v\n", nodeID, err)
	}
}