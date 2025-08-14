package raft

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// AppendEntriesRequest represents an AppendEntries RPC request
type AppendEntriesRequest struct {
	Term         consensus.Term           `json:"term"`
	LeaderID     consensus.NodeID         `json:"leader_id"`
	PrevLogIndex consensus.LogIndex       `json:"prev_log_index"`
	PrevLogTerm  consensus.Term           `json:"prev_log_term"`
	Entries      []*consensus.LogEntry    `json:"entries"`
	LeaderCommit consensus.LogIndex       `json:"leader_commit"`
}

// AppendEntriesResponse represents an AppendEntries RPC response
type AppendEntriesResponse struct {
	Term    consensus.Term      `json:"term"`
	Success bool               `json:"success"`
	XTerm   consensus.Term      `json:"xterm,omitempty"`   // term of conflicting entry
	XIndex  consensus.LogIndex  `json:"xindex,omitempty"`  // index of first entry of XTerm
	XLen    consensus.LogIndex  `json:"xlen,omitempty"`    // log length
}

// handleAppendEntries processes AppendEntries RPC
func (r *Raft) handleAppendEntries(msg *consensus.ConsensusMessage) {
	var req AppendEntriesRequest
	if err := json.Unmarshal(msg.Data, &req); err != nil {
		fmt.Printf("Failed to unmarshal AppendEntries: %v\n", err)
		return
	}

	response := AppendEntriesResponse{
		Term:    r.currentTerm,
		Success: false,
	}

	// Reply false if term < currentTerm
	if req.Term < r.currentTerm {
		r.sendAppendEntriesResponse(msg.From, response)
		return
	}

	// Reset election timer since we heard from leader
	r.lastContact = time.Now()
	r.resetElectionTimer()

	// Update leader and step down if necessary
	if req.Term > r.currentTerm || (req.Term == r.currentTerm && r.state == consensus.Candidate) {
		r.currentTerm = req.Term
		r.votedFor = ""
		r.stepDown()
		r.saveState()
	}

	r.leader = req.LeaderID

	// Reply false if log doesn't contain an entry at prevLogIndex
	// whose term matches prevLogTerm
	if !r.logMatches(req.PrevLogIndex, req.PrevLogTerm) {
		// Optimize: include information to help leader find the right nextIndex
		response.XLen = consensus.LogIndex(len(r.log))
		if req.PrevLogIndex > 0 && int(req.PrevLogIndex) <= len(r.log) {
			// Case 1: leader doesn't have XTerm
			conflictTerm := r.log[req.PrevLogIndex-1].Term
			response.XTerm = conflictTerm
			
			// Find first index of XTerm
			for i := int(req.PrevLogIndex) - 1; i >= 0; i-- {
				if r.log[i].Term != conflictTerm {
					response.XIndex = consensus.LogIndex(i + 2)
					break
				}
				if i == 0 {
					response.XIndex = 1
				}
			}
		}
		r.sendAppendEntriesResponse(msg.From, response)
		return
	}

	// If an existing entry conflicts with a new one (same index
	// but different terms), delete the existing entry and all that follow it
	if len(req.Entries) > 0 {
		r.handleLogConflicts(req.PrevLogIndex, req.Entries)
	}

	// Append any new entries not already in the log
	r.appendNewEntries(req.PrevLogIndex, req.Entries)

	// If leaderCommit > commitIndex, set commitIndex = min(leaderCommit, index of last new entry)
	if req.LeaderCommit > r.commitIndex {
		lastNewIndex := req.PrevLogIndex + consensus.LogIndex(len(req.Entries))
		r.commitIndex = min(req.LeaderCommit, lastNewIndex)
	}

	response.Success = true
	r.sendAppendEntriesResponse(msg.From, response)
	r.saveState()
}

// handleAppendEntriesResponse processes AppendEntriesResponse RPC
func (r *Raft) handleAppendEntriesResponse(msg *consensus.ConsensusMessage) {
	if r.state != consensus.Leader {
		return
	}

	var resp AppendEntriesResponse
	if err := json.Unmarshal(msg.Data, &resp); err != nil {
		fmt.Printf("Failed to unmarshal AppendEntriesResponse: %v\n", err)
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

	fromNode := msg.From
	
	if resp.Success {
		// Update nextIndex and matchIndex for follower
		newMatchIndex := r.nextIndex[fromNode] - 1 + consensus.LogIndex(len(r.getEntriesFrom(r.nextIndex[fromNode])))
		r.matchIndex[fromNode] = newMatchIndex
		r.nextIndex[fromNode] = newMatchIndex + 1
		
		// Update commitIndex if possible
		r.updateCommitIndex()
	} else {
		// Optimize nextIndex decrement using information from response
		if resp.XTerm != 0 {
			// Case 1: leader has XTerm
			lastIndexOfXTerm := r.findLastIndexOfTerm(resp.XTerm)
			if lastIndexOfXTerm != 0 {
				r.nextIndex[fromNode] = lastIndexOfXTerm + 1
			} else {
				// Case 2: leader doesn't have XTerm
				r.nextIndex[fromNode] = resp.XIndex
			}
		} else {
			// Case 3: follower's log is too short
			r.nextIndex[fromNode] = resp.XLen + 1
		}
		
		// Ensure nextIndex doesn't go below 1
		if r.nextIndex[fromNode] < 1 {
			r.nextIndex[fromNode] = 1
		}
		
		// Retry immediately
		go r.sendAppendEntries(fromNode)
	}
}

// sendAppendEntriesResponse sends an AppendEntriesResponse
func (r *Raft) sendAppendEntriesResponse(to consensus.NodeID, response AppendEntriesResponse) {
	data, err := json.Marshal(response)
	if err != nil {
		fmt.Printf("Failed to marshal AppendEntriesResponse: %v\n", err)
		return
	}

	msg := &consensus.ConsensusMessage{
		Type:      consensus.AppendEntriesResponseMsg,
		Term:      r.currentTerm,
		From:      r.nodeID,
		To:        to,
		Data:      data,
		Timestamp: time.Now(),
	}

	if err := r.transport.Send(to, msg); err != nil {
		fmt.Printf("Failed to send AppendEntriesResponse: %v\n", err)
	}
}

// logMatches checks if the log contains an entry at prevLogIndex with prevLogTerm
func (r *Raft) logMatches(prevLogIndex consensus.LogIndex, prevLogTerm consensus.Term) bool {
	// If prevLogIndex is 0, it always matches (leader is trying to replicate from the beginning)
	if prevLogIndex == 0 {
		return true
	}

	// Check if we have an entry at prevLogIndex
	if int(prevLogIndex) > len(r.log) {
		return false
	}

	// Check if the term matches
	return r.log[prevLogIndex-1].Term == prevLogTerm
}

// handleLogConflicts removes conflicting entries from the log
func (r *Raft) handleLogConflicts(prevLogIndex consensus.LogIndex, entries []*consensus.LogEntry) {
	for i, entry := range entries {
		logIndex := prevLogIndex + consensus.LogIndex(i+1)
		
		// If we have an entry at this index, check for conflicts
		if int(logIndex) <= len(r.log) {
			existingEntry := r.log[logIndex-1]
			
			// If terms differ, remove this entry and all following entries
			if existingEntry.Term != entry.Term {
				r.log = r.log[:logIndex-1]
				break
			}
		}
	}
}

// appendNewEntries appends new entries to the log
func (r *Raft) appendNewEntries(prevLogIndex consensus.LogIndex, entries []*consensus.LogEntry) {
	for i, entry := range entries {
		logIndex := prevLogIndex + consensus.LogIndex(i+1)
		
		// If this is a new entry, append it
		if int(logIndex) > len(r.log) {
			r.log = append(r.log, entry)
		}
	}
}

// updateCommitIndex updates the commit index based on matchIndex of followers
func (r *Raft) updateCommitIndex() {
	if r.state != consensus.Leader {
		return
	}

	// Find the highest index that is replicated on a majority of servers
	for n := consensus.LogIndex(len(r.log)); n > r.commitIndex; n-- {
		if int(n) <= len(r.log) && r.log[n-1].Term == r.currentTerm {
			count := 1 // Count self
			
			for _, matchIndex := range r.matchIndex {
				if matchIndex >= n {
					count++
				}
			}
			
			// If majority of servers have replicated this index
			if count > len(r.config.Nodes)/2 {
				r.commitIndex = n
				break
			}
		}
	}
}

// getEntriesFrom returns log entries starting from the given index
func (r *Raft) getEntriesFrom(startIndex consensus.LogIndex) []*consensus.LogEntry {
	if int(startIndex) > len(r.log) {
		return []*consensus.LogEntry{}
	}
	
	return r.log[startIndex-1:]
}

// findLastIndexOfTerm finds the last index of entries with the given term
func (r *Raft) findLastIndexOfTerm(term consensus.Term) consensus.LogIndex {
	for i := len(r.log) - 1; i >= 0; i-- {
		if r.log[i].Term == term {
			return consensus.LogIndex(i + 1)
		}
	}
	return 0
}

// marshalAppendEntries marshals AppendEntries request data
func (r *Raft) marshalAppendEntries(prevLogIndex consensus.LogIndex, prevLogTerm consensus.Term, entries []*consensus.LogEntry, commitIndex consensus.LogIndex) []byte {
	req := AppendEntriesRequest{
		Term:         r.currentTerm,
		LeaderID:     r.nodeID,
		PrevLogIndex: prevLogIndex,
		PrevLogTerm:  prevLogTerm,
		Entries:      entries,
		LeaderCommit: commitIndex,
	}
	
	data, err := json.Marshal(req)
	if err != nil {
		fmt.Printf("Failed to marshal AppendEntries: %v\n", err)
		return []byte(`{}`)
	}
	
	return data
}

// min returns the minimum of two LogIndex values
func min(a, b consensus.LogIndex) consensus.LogIndex {
	if a < b {
		return a
	}
	return b
}