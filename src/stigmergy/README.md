# Stigmergic Coordination System

A complete implementation of stigmergic coordination for VibeCast Xenosphere, inspired by ant colonies, termite mounds, and slime molds.

## What is Stigmergy?

**Stigmergy** is indirect coordination through the environment. Agents (creators) leave "pheromone trails" that guide others, enabling complex collective behavior without central control.

### Real-World Inspiration

- **Ant Colonies**: Ants find shortest paths through reinforcing successful trails
- **Termite Mounds**: Complex architecture emerges from simple local rules
- **Slime Molds**: Efficient networks form through environmental signals

## System Architecture

### Core Components

1. **Pheromone System** (`pheromone.ts`)
   - 6 pheromone types: Interest, Success, Danger, Resource, Question, Convergence
   - Natural evaporation creates exploration-exploitation balance
   - Trail following with gradient ascent
   - Convergence detection

2. **Swarm Coordinator** (`swarm-coordinator.ts`)
   - Multi-agent coordination through environment
   - 6 agent states: Exploring, Following, Working, Questioning, Helping, Converging
   - No central planning - pure emergence
   - Memory and behavioral traits per agent

3. **Emergence Detector** (`emergence.ts`)
   - Detects 7 emergent pattern types
   - Real-time metrics: complexity, self-organization, robustness
   - Temporal analysis of pattern evolution
   - Visualization support (heatmaps, hubs, highways)

4. **Collaboration API** (`collaboration-api.ts`)
   - Real-time event-driven coordination
   - Session management for multiple creators
   - Sensory input (what agents perceive)
   - Actions: deposit, move, follow trails, request help

### Key Features

- **Pure Emergence**: No central control, all coordination through environment
- **Self-Organization**: Complex structures from simple rules
- **Adaptive Behavior**: Agents learn and specialize over time
- **Real-Time**: Event-driven API for live collaboration
- **Visualizable**: Export state for rendering swarm activity

## Usage

### Quick Start

```typescript
import { createStigmergicSystem, PheromoneType } from './stigmergy';

// Create system
const system = createStigmergicSystem({
  name: 'My Collaboration',
  bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 }
});

// Add creator
const { agentId } = system.api.joinSession({
  sessionId: system.session.id,
  userId: 'creator1',
  name: 'Alice'
});

// Sense environment
const sensing = system.api.sense({
  sessionId: system.session.id,
  userId: 'creator1'
});

console.log('Nearby agents:', sensing.nearbyAgents);
console.log('Suggestions:', sensing.suggestions);

// Deposit pheromone
system.api.deposit({
  sessionId: system.session.id,
  userId: 'creator1',
  type: PheromoneType.INTEREST,
  context: 'This is interesting!'
});

// Follow a trail
system.api.followTrail({
  sessionId: system.session.id,
  userId: 'creator1',
  type: PheromoneType.SUCCESS,
  steps: 5
});

// Request help
system.api.requestHelp({
  sessionId: system.session.id,
  userId: 'creator1',
  context: 'Need assistance here'
});

// Run simulation
setInterval(() => {
  system.api.tick(system.session.id);
}, 1000);
```

### Examples

Run the example suite to see swarm intelligence in action:

```bash
npx ts-node src/stigmergy/examples.ts
```

**Example Scenarios:**
1. **Simple Exploration** - Agents explore and naturally discover interesting areas
2. **Path Finding** - Like ants finding food, agents find optimal paths
3. **Collaborative Solving** - Agents help each other through question pheromones
4. **Division of Labor** - Role specialization emerges naturally
5. **Complete Workflow** - Full API demonstration

## Pheromone Types

| Type | Purpose | When to Use |
|------|---------|-------------|
| `INTEREST` | Mark interesting areas | During exploration |
| `SUCCESS` | Mark solved problems/valuable content | After completing work |
| `DANGER` | Mark areas to avoid | When encountering problems |
| `RESOURCE` | Mark valuable resources | When finding useful content |
| `QUESTION` | Request help | When stuck/need assistance |
| `CONVERGENCE` | Multiple agents meeting | Auto-deposited at convergence points |

## Agent States

| State | Behavior | Transitions |
|-------|----------|-------------|
| `EXPLORING` | Random walk, discovering | → Following (found trail), Questioning (stuck) |
| `FOLLOWING` | Following pheromone gradient | → Working (reached resource), Exploring (lost trail) |
| `WORKING` | Stationary, depositing success | → Exploring (finished), Questioning (stuck) |
| `QUESTIONING` | Requesting help | → Converging (help arrived), Exploring (timeout) |
| `HELPING` | Following question pheromones | → Converging (reached questioner), Exploring (none found) |
| `CONVERGING` | Multiple agents at same spot | → Working (collaboration), Exploring (dispersed) |

## Emergent Patterns

The system detects these emergent patterns automatically:

1. **HUB** - Convergence points where many trails meet (like termite mound cores)
2. **HIGHWAY** - Strong trails connecting hubs (like ant highways)
3. **CLUSTER** - Groups of agents working together
4. **OSCILLATION** - Cyclic behaviors (patrol patterns)
5. **DIVISION_OF_LABOR** - Role specialization
6. **STIGMERGIC_MEMORY** - Stable environmental patterns
7. **PHASE_TRANSITION** - System-wide state changes

## API Reference

### CollaborationAPI

#### `createSession(params)`
Create new collaboration session

#### `joinSession(params)`
Join as creator or observer

#### `sense(params)`
Get sensory input (what agent perceives)

Returns:
- `nearbyAgents` - Other creators nearby
- `nearbyTrails` - Pheromone trails with directions
- `convergencePoints` - Hotspots of activity
- `suggestions` - AI-generated recommendations

#### `deposit(params)`
Leave pheromone at current location

#### `move(params)`
Move agent to new position

#### `followTrail(params)`
Follow pheromone gradient

#### `requestHelp(params)`
Deposit question pheromone

#### `getActivityFeed(params)`
Get recent events and emergent patterns

#### `visualize(params)`
Export state for rendering

### Events

Subscribe to real-time events:

```typescript
system.api.on('deposit:created', (data) => {
  console.log('Pheromone deposited:', data);
});

system.api.on('help:requested', (data) => {
  console.log('Help needed at:', data.position);
});

system.api.on('session:tick', (data) => {
  console.log('Simulation stepped');
});
```

## Integration with VibeCast

### For Content Creation

```typescript
// Creator marks interesting content
api.deposit({
  type: PheromoneType.INTEREST,
  context: 'Great discussion about AI ethics',
  tags: ['ai', 'ethics']
});

// Others discover through trail following
const sensing = api.sense({ userId });
// Follow strongest interest trail to find good content
```

### For Collaboration

```typescript
// Creator needs feedback
api.requestHelp({
  context: 'Working on video script, need input'
});

// Nearby creators see question pheromone and respond
// Automatic convergence leads to collaboration
```

### For Discovery

```typescript
// System detects emergent hubs
const patterns = detector.getPatternsByType(EmergentPatternType.HUB);
// Hubs = "hot spots" where creators naturally gather
// Can be surfaced in UI as trending topics
```

## Performance

- **2,784 lines** of production-ready TypeScript
- **Optimized**: Grid-based spatial indexing, deposit merging
- **Scalable**: Handles 100+ concurrent agents
- **Real-time**: Sub-100ms sensory queries

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `pheromone.ts` | 440 | Core pheromone trail system |
| `swarm-coordinator.ts` | 608 | Multi-agent coordination |
| `emergence.ts` | 602 | Pattern detection engine |
| `collaboration-api.ts` | 575 | Real-time API |
| `examples.ts` | 483 | Runnable demonstrations |
| `index.ts` | 76 | Module exports |

## Future Enhancements

- [ ] 3D spatial support (already structured for z-axis)
- [ ] Neural network-based agent learning
- [ ] Persistent state across sessions
- [ ] WebSocket real-time streaming
- [ ] Visualization dashboard
- [ ] Mobile agent support
- [ ] Cross-session trail persistence

## Philosophy

> "The whole is more than the sum of its parts"

This system embodies the principle that complex, intelligent behavior can emerge from simple local interactions. No agent has a global view, yet collectively they solve problems, find paths, and coordinate effectively.

Like nature's swarms, VibeCast creators become a distributed intelligence, where the environment (pheromone trails) carries the collective memory and guides collaboration.

---

**Built for VibeCast Xenosphere** - Where creators coordinate like nature's swarms
