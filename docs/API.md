# API Reference

Complete API reference for Agentic Robotics.

## Node.js API

### AgenticNode

The main entry point for creating a robot node.

#### Constructor

```javascript
const node = new AgenticNode(name: string)
```

**Parameters:**
- `name` (string): Unique identifier for this node

**Example:**
```javascript
const { AgenticNode } = require('agentic-robotics');
const node = new AgenticNode('my-robot');
```

#### Methods

##### `createPublisher(topic)`

Creates a publisher for sending messages on a topic.

```javascript
const publisher = await node.createPublisher(topic: string)
```

**Parameters:**
- `topic` (string): Topic name (e.g., `/sensors/temperature`)

**Returns:** `Promise<AgenticPublisher>`

**Example:**
```javascript
const publisher = await node.createPublisher('/cmd_vel');
```

##### `createSubscriber(topic)`

Creates a subscriber for receiving messages on a topic.

```javascript
const subscriber = await node.createSubscriber(topic: string)
```

**Parameters:**
- `topic` (string): Topic name to subscribe to

**Returns:** `Promise<AgenticSubscriber>`

**Example:**
```javascript
const subscriber = await node.createSubscriber('/sensors/lidar');
```

---

### AgenticPublisher

Publishes messages to a topic.

#### Methods

##### `publish(message)`

Publishes a message to the topic.

```javascript
await publisher.publish(message: string)
```

**Parameters:**
- `message` (string): JSON-serialized message data

**Returns:** `Promise<void>`

**Example:**
```javascript
await publisher.publish(JSON.stringify({
  x: 1.0,
  y: 2.0,
  z: 0.0
}));
```

##### `getStats()`

Gets publisher statistics.

```javascript
const stats = publisher.getStats()
```

**Returns:** `{ messages: number, bytes: number }`

**Example:**
```javascript
const stats = publisher.getStats();
console.log(`Sent ${stats.messages} messages (${stats.bytes} bytes)`);
```

---

### AgenticSubscriber

Receives messages from a topic.

#### Methods

##### `subscribe(callback)`

Subscribes to the topic with a callback function.

```javascript
await subscriber.subscribe(callback: (message: string) => void)
```

**Parameters:**
- `callback` (function): Called when a message is received
  - `message` (string): JSON-serialized message data

**Returns:** `Promise<void>`

**Example:**
```javascript
await subscriber.subscribe((message) => {
  const data = JSON.parse(message);
  console.log('Received:', data);
});
```

##### `unsubscribe()`

Unsubscribes from the topic.

```javascript
await subscriber.unsubscribe()
```

**Returns:** `Promise<void>`

**Example:**
```javascript
await subscriber.unsubscribe();
```

---

## Rust API

### Core Types

#### Publisher<T>

Generic publisher for any serializable message type.

```rust
use agentic_robotics_core::{Publisher, Message};

pub struct Publisher<T: Message> {
    // ...
}
```

**Methods:**

```rust
// Create with default CDR serialization
pub fn new(topic: impl Into<String>) -> Self

// Create with specific format
pub fn with_format(topic: impl Into<String>, format: Format) -> Self

// Publish a message
pub async fn publish(&self, msg: &T) -> Result<()>

// Get statistics
pub fn stats(&self) -> PublisherStats
```

**Example:**

```rust
use agentic_robotics_core::{Publisher, serialization::Format};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct Position {
    x: f64,
    y: f64,
    z: f64,
}

let publisher = Publisher::<Position>::with_format(
    "/robot/position",
    Format::Json
);

publisher.publish(&Position {
    x: 1.0,
    y: 2.0,
    z: 0.0,
}).await?;
```

#### Subscriber<T>

Generic subscriber for any deserializable message type.

```rust
use agentic_robotics_core::Subscriber;

pub struct Subscriber<T: Message> {
    // ...
}
```

**Methods:**

```rust
// Create subscriber
pub fn new(topic: impl Into<String>) -> Self

// Receive message (blocking)
pub fn recv(&self) -> Result<T>

// Receive message (async)
pub async fn recv_async(&self) -> Result<T>

// Try receive (non-blocking)
pub fn try_recv(&self) -> Result<Option<T>>
```

**Example:**

```rust
use agentic_robotics_core::Subscriber;

let subscriber = Subscriber::<Position>::new("/robot/position");

// Async receive
while let Ok(msg) = subscriber.recv_async().await {
    println!("Position: {:?}", msg);
}

// Non-blocking receive
if let Ok(Some(msg)) = subscriber.try_recv() {
    println!("Got message: {:?}", msg);
}
```

### Serialization

#### Format

Serialization format enum.

```rust
pub enum Format {
    Json,      // JSON format
    Cdr,       // CDR (DDS-compatible)
    Rkyv,      // Zero-copy rkyv
}
```

#### Serializer

```rust
use agentic_robotics_core::serialization::Serializer;

let serializer = Serializer::new(Format::Json);

// Serialize
let bytes = serializer.serialize(&msg)?;

// Deserialize
let msg: MyType = serializer.deserialize(&bytes)?;
```

### Message Trait

All publishable types must implement the `Message` trait.

```rust
use agentic_robotics_core::Message;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyMessage {
    pub data: String,
    pub timestamp: u64,
}

impl Message for MyMessage {
    // Automatically implemented if Serialize + Deserialize
}
```

### Error Handling

```rust
use agentic_robotics_core::error::{Error, Result};

pub enum Error {
    SerializationError(String),
    DeserializationError(String),
    PublishError(String),
    SubscriptionError(String),
    IoError(std::io::Error),
}

pub type Result<T> = std::result::Result<T, Error>;
```

**Example:**

```rust
match publisher.publish(&msg).await {
    Ok(()) => println!("Published successfully"),
    Err(Error::SerializationError(e)) => {
        eprintln!("Serialization failed: {}", e);
    }
    Err(e) => eprintln!("Error: {}", e),
}
```

## MCP API

### MCP Tools

The MCP server exposes 21 robotics tools. See [MCP Tools Guide](MCP_TOOLS.md) for complete documentation.

### Tool Categories

1. **Robot Control** (3 tools)
   - `move_robot`, `get_pose`, `stop_robot`

2. **Sensing** (3 tools)
   - `read_lidar`, `read_camera`, `detect_objects`

3. **Memory & Learning** (4 tools)
   - `store_episode`, `retrieve_episodes`, `consolidate_skills`, `query_memory`

4. **Planning & Navigation** (3 tools)
   - `plan_path`, `execute_trajectory`, `avoid_obstacles`

5. **Multi-Robot** (3 tools)
   - `broadcast_state`, `discover_robots`, `coordinate_task`

6. **Utilities** (5 tools)
   - `set_parameter`, `get_parameter`, `log_message`, `get_diagnostics`, `emergency_stop`

## TypeScript Types

### Message Types

```typescript
interface Position {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Pose {
  position: Position;
  orientation: Quaternion;
}

interface Twist {
  linear: Position;
  angular: Position;
}
```

### Stats Types

```typescript
interface PublisherStats {
  messages: number;
  bytes: number;
}

interface SubscriberStats {
  messages: number;
  bytes: number;
  dropped: number;
}
```

## Performance

### Benchmarks

All performance metrics measured on:
- CPU: AMD Ryzen 9 5900X
- RAM: 32GB DDR4
- OS: Ubuntu 22.04

| Operation | Latency | Throughput |
|-----------|---------|------------|
| `publish()` | 10-50µs | 20,000 msg/s |
| `recv_async()` | 15-60µs | 16,000 msg/s |
| JSON serialize | 2-5µs | 200,000 ops/s |
| CDR serialize | 1-3µs | 330,000 ops/s |
| Store episode | 175µs | 5,700 ops/s |

### Memory Usage

| Component | Memory |
|-----------|--------|
| AgenticNode | 12 KB |
| Publisher | 4 KB |
| Subscriber | 8 KB |
| Message (avg) | 256 B |

## Examples

See the [examples directory](../examples/) for complete working examples:

- `basic_pubsub.js` - Simple publisher/subscriber
- `multi_robot.js` - Multi-robot coordination
- `mcp_integration.js` - Using MCP tools
- `performance_test.js` - Benchmarking

## See Also

- [Installation Guide](INSTALL.md)
- [MCP Tools Guide](MCP_TOOLS.md)
- [Performance Report](../PERFORMANCE_REPORT.md)
- [Test Report](../TEST_REPORT.md)
