package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/rpc"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/consensus"
)

// RPCTransport implements the Transport interface using Go RPC
type RPCTransport struct {
	nodeID    consensus.NodeID
	address   string
	nodes     map[consensus.NodeID]string
	server    *rpc.Server
	listener  net.Listener
	clients   map[consensus.NodeID]*rpc.Client
	clientMu  sync.RWMutex
	msgChan   chan *consensus.ConsensusMessage
	stopChan  chan struct{}
	wg        sync.WaitGroup
	timeout   time.Duration
}

// RPCService handles RPC calls for consensus messages
type RPCService struct {
	transport *RPCTransport
}

// SendMessageArgs represents arguments for SendMessage RPC call
type SendMessageArgs struct {
	Message *consensus.ConsensusMessage `json:"message"`
}

// SendMessageReply represents reply for SendMessage RPC call
type SendMessageReply struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// NewRPCTransport creates a new RPC transport
func NewRPCTransport(nodeID consensus.NodeID, address string, nodes map[consensus.NodeID]string) *RPCTransport {
	return &RPCTransport{
		nodeID:   nodeID,
		address:  address,
		nodes:    nodes,
		clients:  make(map[consensus.NodeID]*rpc.Client),
		msgChan:  make(chan *consensus.ConsensusMessage, 1000),
		stopChan: make(chan struct{}),
		timeout:  5 * time.Second,
	}
}

// Start starts the RPC transport
func (r *RPCTransport) Start() error {
	// Create RPC server
	r.server = rpc.NewServer()
	service := &RPCService{transport: r}
	if err := r.server.Register(service); err != nil {
		return fmt.Errorf("failed to register RPC service: %w", err)
	}

	// Start listening
	var err error
	r.listener, err = net.Listen("tcp", r.address)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", r.address, err)
	}

	// Start accepting connections
	r.wg.Add(1)
	go r.acceptConnections()

	// Initialize client connections
	r.wg.Add(1)
	go r.initializeClients()

	return nil
}

// Stop stops the RPC transport
func (r *RPCTransport) Stop() error {
	close(r.stopChan)
	
	if r.listener != nil {
		r.listener.Close()
	}

	// Close all client connections
	r.clientMu.Lock()
	for _, client := range r.clients {
		client.Close()
	}
	r.clientMu.Unlock()

	r.wg.Wait()
	return nil
}

// Send sends a message to a specific node
func (r *RPCTransport) Send(nodeID consensus.NodeID, msg *consensus.ConsensusMessage) error {
	if nodeID == r.nodeID {
		// Local message
		select {
		case r.msgChan <- msg:
			return nil
		default:
			return fmt.Errorf("message channel full")
		}
	}

	client, err := r.getClient(nodeID)
	if err != nil {
		return fmt.Errorf("failed to get client for node %s: %w", nodeID, err)
	}

	args := &SendMessageArgs{Message: msg}
	reply := &SendMessageReply{}

	// Use a timeout context for the RPC call
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	callChan := make(chan error, 1)
	go func() {
		callChan <- client.Call("RPCService.SendMessage", args, reply)
	}()

	select {
	case err := <-callChan:
		if err != nil {
			return fmt.Errorf("RPC call failed: %w", err)
		}
		if !reply.Success {
			return fmt.Errorf("remote error: %s", reply.Error)
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("RPC call timeout")
	}
}

// Broadcast sends a message to all nodes
func (r *RPCTransport) Broadcast(msg *consensus.ConsensusMessage) error {
	var wg sync.WaitGroup
	errors := make(chan error, len(r.nodes))

	for nodeID := range r.nodes {
		if nodeID == r.nodeID {
			continue // Skip self
		}

		wg.Add(1)
		go func(nid consensus.NodeID) {
			defer wg.Done()
			if err := r.Send(nid, msg); err != nil {
				errors <- fmt.Errorf("failed to send to %s: %w", nid, err)
			}
		}(nodeID)
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
func (r *RPCTransport) Receive() <-chan *consensus.ConsensusMessage {
	return r.msgChan
}

// GetAddress returns the address for a node
func (r *RPCTransport) GetAddress(nodeID consensus.NodeID) string {
	return r.nodes[nodeID]
}

// getClient gets or creates an RPC client for a node
func (r *RPCTransport) getClient(nodeID consensus.NodeID) (*rpc.Client, error) {
	r.clientMu.RLock()
	if client, exists := r.clients[nodeID]; exists {
		r.clientMu.RUnlock()
		return client, nil
	}
	r.clientMu.RUnlock()

	r.clientMu.Lock()
	defer r.clientMu.Unlock()

	// Double-check after acquiring write lock
	if client, exists := r.clients[nodeID]; exists {
		return client, nil
	}

	address, exists := r.nodes[nodeID]
	if !exists {
		return nil, fmt.Errorf("unknown node: %s", nodeID)
	}

	client, err := rpc.Dial("tcp", address)
	if err != nil {
		return nil, fmt.Errorf("failed to dial %s: %w", address, err)
	}

	r.clients[nodeID] = client
	return client, nil
}

// initializeClients initializes client connections to all nodes
func (r *RPCTransport) initializeClients() {
	defer r.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopChan:
			return
		case <-ticker.C:
			for nodeID := range r.nodes {
				if nodeID == r.nodeID {
					continue
				}
				r.getClient(nodeID) // Ignore errors, will retry
			}
		}
	}
}

// acceptConnections accepts incoming RPC connections
func (r *RPCTransport) acceptConnections() {
	defer r.wg.Done()

	for {
		select {
		case <-r.stopChan:
			return
		default:
			conn, err := r.listener.Accept()
			if err != nil {
				select {
				case <-r.stopChan:
					return
				default:
					continue
				}
			}

			go r.server.ServeConn(conn)
		}
	}
}

// SendMessage handles incoming RPC calls to send messages
func (s *RPCService) SendMessage(args *SendMessageArgs, reply *SendMessageReply) error {
	if args.Message == nil {
		reply.Success = false
		reply.Error = "nil message"
		return nil
	}

	select {
	case s.transport.msgChan <- args.Message:
		reply.Success = true
	default:
		reply.Success = false
		reply.Error = "message channel full"
	}

	return nil
}