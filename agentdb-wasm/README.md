# AgentDB WASM

High-performance WebAssembly database layer for franchise platform agent management, written in Rust.

## Overview

AgentDB WASM is a lightweight, fast, and efficient in-memory database specifically designed for managing agents and franchises in distributed systems. It provides:

- **In-memory storage** with optimized data structures
- **Event sourcing** for complete audit trails
- **Query interface** with filtering and pagination
- **WASM compilation** for cross-platform compatibility
- **Type-safe TypeScript bindings**

## Architecture

### Core Components

1. **Database Layer** (`database.rs`)
   - In-memory HashMap storage
   - Efficient indexing for fast queries
   - CRUD operations for agents and franchises
   - Event sourcing for audit trails

2. **Type System** (`types.rs`)
   - Strong typing for all entities
   - Serde serialization/deserialization
   - Builder patterns for ergonomic APIs

3. **WASM Bindings** (`wasm_bindings.rs`)
   - JavaScript/TypeScript interfaces
   - Error handling and result types
   - Performance optimization hooks

## Features

### Agent Management
- Create, read, update, delete agents
- Query agents by status, role, franchise
- Assign agents to franchises
- Track agent capabilities and metadata

### Franchise Operations
- Manage franchise entities
- Track franchise ownership and locations
- Query franchises with filters
- Monitor franchise-agent relationships

### Event Sourcing
- Complete audit trail of all operations
- Time-stamped event history
- Queryable event log
- Support for event replay

### Performance
- Optimized for WASM execution
- Efficient memory usage
- Fast query performance
- Minimal serialization overhead

## Building

### Prerequisites
- Rust 1.70+ (`rustup`)
- wasm-pack (`cargo install wasm-pack`)

### Build Commands

```bash
# Development build
wasm-pack build --dev --target bundler

# Production build
wasm-pack build --target bundler

# With specific output directory
wasm-pack build --target bundler --out-dir pkg
```

### Build Targets
- `bundler` - For webpack/rollup
- `nodejs` - For Node.js
- `web` - For direct browser usage
- `no-modules` - For legacy browsers

## Testing

```bash
# Run unit tests
cargo test

# Run WASM tests (requires browser driver)
wasm-pack test --headless --firefox
wasm-pack test --headless --chrome

# Run specific test
cargo test test_agent_creation
```

## Benchmarking

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench agent_creation

# View results
open target/criterion/report/index.html
```

## Usage in Rust

```rust
use agentdb_wasm::{AgentDb, Agent, AgentRole, Franchise};

// Create database
let mut db = AgentDb::new();

// Create an agent
let agent = Agent::new("Alice".to_string(), AgentRole::Manager);
let agent = db.upsert_agent(agent)?;

// Create a franchise
let franchise = Franchise::new(
    "TechCorp".to_string(),
    agent.id.clone(),
    "New York".to_string(),
);
let franchise = db.upsert_franchise(franchise)?;

// Assign agent to franchise
db.assign_agent_to_franchise(&agent.id, &franchise.id)?;

// Query agents
let filter = QueryFilter {
    franchise_id: Some(franchise.id.clone()),
    ..Default::default()
};
let agents = db.query_agents(&filter);

// Get statistics
let stats = db.get_stats();
println!("Total agents: {}", stats.total_agents);
```

## Usage in JavaScript/TypeScript

See the npm package documentation for JavaScript/TypeScript usage.

## Performance Characteristics

### Time Complexity
- Agent CRUD: O(1) average
- Agent query (unfiltered): O(n)
- Agent query (by franchise): O(k) where k = agents in franchise
- Franchise CRUD: O(1) average
- Event retrieval: O(m) where m = number of events

### Space Complexity
- Per Agent: ~300-500 bytes
- Per Franchise: ~200-400 bytes
- Per Event: ~150-300 bytes
- Indices: O(n) additional space

### Benchmark Results

Typical performance on modern hardware:

```
Agent Creation:         ~50-100 ns/op
Agent Query (indexed):  ~100-200 ns/op
Agent Assignment:       ~150-250 ns/op
Export (1000 agents):   ~500 μs
Import (1000 agents):   ~1-2 ms
```

## Memory Management

The database uses Rust's ownership system for memory safety:
- No garbage collection overhead
- Predictable memory usage
- No memory leaks
- Efficient allocation patterns

## Error Handling

All operations return `Result<T, DbError>` types:

```rust
pub enum DbError {
    NotFound(String),
    InvalidQuery(String),
    DuplicateEntity(String),
    SerializationError(String),
    ConstraintViolation(String),
}
```

## Event Sourcing

Every mutation generates an event:

```rust
pub struct Event {
    pub id: String,
    pub event_type: EventType,
    pub entity_id: String,
    pub entity_type: EntityType,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
}
```

Event types:
- `Created` - New entity created
- `Updated` - Entity modified
- `Deleted` - Entity removed
- `StatusChanged` - Status field changed
- `Assigned` - Agent assigned to franchise
- `Unassigned` - Agent removed from franchise

## Export/Import

Support for database serialization:

```rust
// Export to JSON
let json = db.export()?;

// Import from JSON
db.import(&json)?;
```

Use cases:
- Database backups
- State persistence
- Migration between instances
- Testing fixtures

## Contributing

1. Write tests for new features
2. Run `cargo fmt` before committing
3. Ensure `cargo clippy` passes
4. Add benchmarks for performance-critical code

## License

MIT License - see LICENSE file for details
