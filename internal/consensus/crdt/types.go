package crdt

import (
	"encoding/json"
	"fmt"
	"sync"
)

// GCounter implements a grow-only counter CRDT
type GCounter struct {
	mu      sync.RWMutex
	nodeID  string
	counter map[string]uint64
}

// NewGCounter creates a new grow-only counter
func NewGCounter(nodeID string) *GCounter {
	return &GCounter{
		nodeID:  nodeID,
		counter: make(map[string]uint64),
	}
}

// Update applies an increment operation
func (g *GCounter) Update(operation Operation) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if operation.Type != IncrementOperation {
		return fmt.Errorf("unsupported operation type for GCounter: %v", operation.Type)
	}

	increment, ok := operation.Value.(float64) // JSON numbers are float64
	if !ok {
		increment = 1 // Default increment
	}

	g.counter[string(operation.NodeID)] += uint64(increment)
	return nil
}

// Merge merges another GCounter
func (g *GCounter) Merge(other CRDT) error {
	otherGC, ok := other.(*GCounter)
	if !ok {
		return fmt.Errorf("cannot merge different CRDT types")
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	otherGC.mu.RLock()
	defer otherGC.mu.RUnlock()

	for nodeID, value := range otherGC.counter {
		if g.counter[nodeID] < value {
			g.counter[nodeID] = value
		}
	}

	return nil
}

// State returns the current sum of all counters
func (g *GCounter) State() interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var sum uint64
	for _, value := range g.counter {
		sum += value
	}
	return sum
}

// Clone creates a deep copy
func (g *GCounter) Clone() CRDT {
	g.mu.RLock()
	defer g.mu.RUnlock()

	clone := &GCounter{
		nodeID:  g.nodeID,
		counter: make(map[string]uint64),
	}

	for nodeID, value := range g.counter {
		clone.counter[nodeID] = value
	}

	return clone
}

// Serialize converts to bytes
func (g *GCounter) Serialize() ([]byte, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return json.Marshal(g.counter)
}

// Deserialize converts from bytes
func (g *GCounter) Deserialize(data []byte) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	return json.Unmarshal(data, &g.counter)
}

// PNCounter implements a positive-negative counter CRDT
type PNCounter struct {
	mu       sync.RWMutex
	nodeID   string
	positive map[string]uint64
	negative map[string]uint64
}

// NewPNCounter creates a new positive-negative counter
func NewPNCounter(nodeID string) *PNCounter {
	return &PNCounter{
		nodeID:   nodeID,
		positive: make(map[string]uint64),
		negative: make(map[string]uint64),
	}
}

// Update applies increment/decrement operations
func (p *PNCounter) Update(operation Operation) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	value, ok := operation.Value.(float64)
	if !ok {
		value = 1
	}

	nodeID := string(operation.NodeID)

	switch operation.Type {
	case IncrementOperation:
		p.positive[nodeID] += uint64(value)
	case DecrementOperation:
		p.negative[nodeID] += uint64(value)
	default:
		return fmt.Errorf("unsupported operation type for PNCounter: %v", operation.Type)
	}

	return nil
}

// Merge merges another PNCounter
func (p *PNCounter) Merge(other CRDT) error {
	otherPN, ok := other.(*PNCounter)
	if !ok {
		return fmt.Errorf("cannot merge different CRDT types")
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	otherPN.mu.RLock()
	defer otherPN.mu.RUnlock()

	// Merge positive counters
	for nodeID, value := range otherPN.positive {
		if p.positive[nodeID] < value {
			p.positive[nodeID] = value
		}
	}

	// Merge negative counters
	for nodeID, value := range otherPN.negative {
		if p.negative[nodeID] < value {
			p.negative[nodeID] = value
		}
	}

	return nil
}

// State returns the current value (positive - negative)
func (p *PNCounter) State() interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var pos, neg uint64
	for _, value := range p.positive {
		pos += value
	}
	for _, value := range p.negative {
		neg += value
	}

	return int64(pos) - int64(neg)
}

// Clone creates a deep copy
func (p *PNCounter) Clone() CRDT {
	p.mu.RLock()
	defer p.mu.RUnlock()

	clone := &PNCounter{
		nodeID:   p.nodeID,
		positive: make(map[string]uint64),
		negative: make(map[string]uint64),
	}

	for nodeID, value := range p.positive {
		clone.positive[nodeID] = value
	}
	for nodeID, value := range p.negative {
		clone.negative[nodeID] = value
	}

	return clone
}

// Serialize converts to bytes
func (p *PNCounter) Serialize() ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	data := struct {
		Positive map[string]uint64 `json:"positive"`
		Negative map[string]uint64 `json:"negative"`
	}{
		Positive: p.positive,
		Negative: p.negative,
	}

	return json.Marshal(data)
}

// Deserialize converts from bytes
func (p *PNCounter) Deserialize(data []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	var deserializedData struct {
		Positive map[string]uint64 `json:"positive"`
		Negative map[string]uint64 `json:"negative"`
	}

	if err := json.Unmarshal(data, &deserializedData); err != nil {
		return err
	}

	p.positive = deserializedData.Positive
	p.negative = deserializedData.Negative

	return nil
}

// GSet implements a grow-only set CRDT
type GSet struct {
	mu     sync.RWMutex
	nodeID string
	set    map[string]bool
}

// NewGSet creates a new grow-only set
func NewGSet(nodeID string) *GSet {
	return &GSet{
		nodeID: nodeID,
		set:    make(map[string]bool),
	}
}

// Update applies add operations
func (g *GSet) Update(operation Operation) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if operation.Type != AddOperation {
		return fmt.Errorf("unsupported operation type for GSet: %v", operation.Type)
	}

	value, ok := operation.Value.(string)
	if !ok {
		return fmt.Errorf("GSet values must be strings")
	}

	g.set[value] = true
	return nil
}

// Merge merges another GSet
func (g *GSet) Merge(other CRDT) error {
	otherGS, ok := other.(*GSet)
	if !ok {
		return fmt.Errorf("cannot merge different CRDT types")
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	otherGS.mu.RLock()
	defer otherGS.mu.RUnlock()

	for value := range otherGS.set {
		g.set[value] = true
	}

	return nil
}

// State returns the current set as a slice
func (g *GSet) State() interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()

	result := make([]string, 0, len(g.set))
	for value := range g.set {
		result = append(result, value)
	}
	return result
}

// Clone creates a deep copy
func (g *GSet) Clone() CRDT {
	g.mu.RLock()
	defer g.mu.RUnlock()

	clone := &GSet{
		nodeID: g.nodeID,
		set:    make(map[string]bool),
	}

	for value := range g.set {
		clone.set[value] = true
	}

	return clone
}

// Serialize converts to bytes
func (g *GSet) Serialize() ([]byte, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	values := make([]string, 0, len(g.set))
	for value := range g.set {
		values = append(values, value)
	}

	return json.Marshal(values)
}

// Deserialize converts from bytes
func (g *GSet) Deserialize(data []byte) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	var values []string
	if err := json.Unmarshal(data, &values); err != nil {
		return err
	}

	g.set = make(map[string]bool)
	for _, value := range values {
		g.set[value] = true
	}

	return nil
}

// ORSet implements an observed-remove set CRDT
type ORSet struct {
	mu      sync.RWMutex
	nodeID  string
	added   map[string]map[string]bool // element -> {unique_tag -> true}
	removed map[string]map[string]bool // element -> {unique_tag -> true}
}

// NewORSet creates a new observed-remove set
func NewORSet(nodeID string) *ORSet {
	return &ORSet{
		nodeID:  nodeID,
		added:   make(map[string]map[string]bool),
		removed: make(map[string]map[string]bool),
	}
}

// Update applies add/remove operations
func (o *ORSet) Update(operation Operation) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	value, ok := operation.Value.(string)
	if !ok {
		return fmt.Errorf("ORSet values must be strings")
	}

	// Generate unique tag
	tag := fmt.Sprintf("%s-%d", operation.NodeID, operation.Timestamp.UnixNano())

	switch operation.Type {
	case AddOperation:
		if o.added[value] == nil {
			o.added[value] = make(map[string]bool)
		}
		o.added[value][tag] = true
	case RemoveOperation:
		if o.removed[value] == nil {
			o.removed[value] = make(map[string]bool)
		}
		// Remove all current tags for this element
		if addedTags, exists := o.added[value]; exists {
			for addedTag := range addedTags {
				o.removed[value][addedTag] = true
			}
		}
	default:
		return fmt.Errorf("unsupported operation type for ORSet: %v", operation.Type)
	}

	return nil
}

// Merge merges another ORSet
func (o *ORSet) Merge(other CRDT) error {
	otherOR, ok := other.(*ORSet)
	if !ok {
		return fmt.Errorf("cannot merge different CRDT types")
	}

	o.mu.Lock()
	defer o.mu.Unlock()
	otherOR.mu.RLock()
	defer otherOR.mu.RUnlock()

	// Merge added elements
	for element, tags := range otherOR.added {
		if o.added[element] == nil {
			o.added[element] = make(map[string]bool)
		}
		for tag := range tags {
			o.added[element][tag] = true
		}
	}

	// Merge removed elements
	for element, tags := range otherOR.removed {
		if o.removed[element] == nil {
			o.removed[element] = make(map[string]bool)
		}
		for tag := range tags {
			o.removed[element][tag] = true
		}
	}

	return nil
}

// State returns the current set (added - removed)
func (o *ORSet) State() interface{} {
	o.mu.RLock()
	defer o.mu.RUnlock()

	result := make([]string, 0)
	for element, addedTags := range o.added {
		hasLiveTags := false
		removedTags := o.removed[element]

		for tag := range addedTags {
			if removedTags == nil || !removedTags[tag] {
				hasLiveTags = true
				break
			}
		}

		if hasLiveTags {
			result = append(result, element)
		}
	}

	return result
}

// Clone creates a deep copy
func (o *ORSet) Clone() CRDT {
	o.mu.RLock()
	defer o.mu.RUnlock()

	clone := &ORSet{
		nodeID:  o.nodeID,
		added:   make(map[string]map[string]bool),
		removed: make(map[string]map[string]bool),
	}

	for element, tags := range o.added {
		clone.added[element] = make(map[string]bool)
		for tag := range tags {
			clone.added[element][tag] = true
		}
	}

	for element, tags := range o.removed {
		clone.removed[element] = make(map[string]bool)
		for tag := range tags {
			clone.removed[element][tag] = true
		}
	}

	return clone
}

// Serialize converts to bytes
func (o *ORSet) Serialize() ([]byte, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	data := struct {
		Added   map[string]map[string]bool `json:"added"`
		Removed map[string]map[string]bool `json:"removed"`
	}{
		Added:   o.added,
		Removed: o.removed,
	}

	return json.Marshal(data)
}

// Deserialize converts from bytes
func (o *ORSet) Deserialize(data []byte) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	var deserializedData struct {
		Added   map[string]map[string]bool `json:"added"`
		Removed map[string]map[string]bool `json:"removed"`
	}

	if err := json.Unmarshal(data, &deserializedData); err != nil {
		return err
	}

	o.added = deserializedData.Added
	o.removed = deserializedData.Removed

	return nil
}