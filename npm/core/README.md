# @agentic-robotics/core

[![npm version](https://img.shields.io/npm/v/@agentic-robotics/core.svg)](https://www.npmjs.com/package/@agentic-robotics/core)
[![Downloads](https://img.shields.io/npm/dm/@agentic-robotics/core.svg)](https://www.npmjs.com/package/@agentic-robotics/core)
[![License](https://img.shields.io/npm/l/@agentic-robotics/core.svg)](https://github.com/ruvnet/vibecast)
[![Node](https://img.shields.io/node/v/@agentic-robotics/core.svg)](https://nodejs.org)

Core native bindings for the **agentic-robotics** framework - High-performance robotics middleware with ROS2 compatibility.

## Features

- 🚀 **High Performance** - Native Rust implementation via NAPI-RS
- 🤖 **ROS2 Compatible** - Full ROS2 message compatibility
- 📡 **Pub/Sub Pattern** - Efficient publisher/subscriber communication
- 🔄 **Real-time Capable** - Low-latency message passing
- 📊 **Statistics Tracking** - Built-in performance metrics
- 🌐 **Cross-platform** - Linux (x64, ARM64), macOS (x64, ARM64)
- 💪 **Type-safe** - Full TypeScript support
- ⚡ **Zero-copy** - Efficient memory management

## Installation

```bash
npm install @agentic-robotics/core
```

Platform-specific binaries are automatically installed based on your system.

## Quick Start

### Create a Node

```javascript
const { AgenticNode } = require('@agentic-robotics/core');

const node = new AgenticNode('my-robot');
console.log('Node created:', node.getName());
```

### Publish Messages

```javascript
const publisher = await node.createPublisher('/sensors/temperature');

await publisher.publish(JSON.stringify({
  value: 25.5,
  unit: 'celsius',
  timestamp: Date.now()
}));

console.log('Stats:', publisher.getStats());
// { messages: 1, bytes: 66 }
```

### Subscribe to Messages

```javascript
const subscriber = await node.createSubscriber('/sensors/temperature');

// Non-blocking receive
const message = await subscriber.tryRecv();
if (message) {
  const data = JSON.parse(message);
  console.log('Temperature:', data.value, data.unit);
}

// Blocking receive (waits for message)
const nextMessage = await subscriber.recv();
console.log('Received:', JSON.parse(nextMessage));
```

### Full Example

```javascript
const { AgenticNode } = require('@agentic-robotics/core');

async function main() {
  // Create nodes
  const publisher_node = new AgenticNode('temperature-sensor');
  const subscriber_node = new AgenticNode('temperature-monitor');

  // Set up publisher
  const pub = await publisher_node.createPublisher('/temperature');

  // Set up subscriber
  const sub = await subscriber_node.createSubscriber('/temperature');

  // Publish temperature readings
  setInterval(async () => {
    const reading = {
      value: 20 + Math.random() * 10,
      timestamp: Date.now()
    };

    await pub.publish(JSON.stringify(reading));
    console.log('Published:', reading);
  }, 1000);

  // Monitor temperature
  setInterval(async () => {
    const msg = await sub.tryRecv();
    if (msg) {
      const data = JSON.parse(msg);
      console.log('Received:', data);

      if (data.value > 28) {
        console.warn('⚠️  High temperature detected!');
      }
    }
  }, 500);
}

main().catch(console.error);
```

## API Reference

### `AgenticNode`

Main class for creating publishers and subscribers.

#### Constructor

```typescript
new AgenticNode(name: string): AgenticNode
```

Creates a new node with the given name.

#### Methods

**`createPublisher(topic: string): Promise<AgenticPublisher>`**

Creates a publisher for the specified topic.

**`createSubscriber(topic: string): Promise<AgenticSubscriber>`**

Creates a subscriber for the specified topic.

**`getName(): string`**

Returns the node name.

**`listPublishers(): Promise<string[]>`**

Lists all active publisher topics.

**`listSubscribers(): Promise<string[]>`**

Lists all active subscriber topics.

---

### `AgenticPublisher`

Publisher for sending messages to a topic.

#### Methods

**`publish(data: string): Promise<void>`**

Publishes a JSON string message to the topic.

**`getStats(): PublisherStats`**

Returns publisher statistics:
```typescript
interface PublisherStats {
  messages: number;  // Total messages published
  bytes: number;     // Total bytes sent
}
```

---

### `AgenticSubscriber`

Subscriber for receiving messages from a topic.

#### Methods

**`tryRecv(): Promise<string | null>`**

Non-blocking receive. Returns message as JSON string or `null` if no message available.

**`recv(): Promise<string>`**

Blocking receive. Waits for and returns the next message as JSON string.

## Performance

- **Message Latency**: < 1ms (same process)
- **Throughput**: 10,000+ msgs/sec
- **Memory Overhead**: ~100 bytes per message
- **Serialization**: JSON format (efficient)

## Platform Support

| Platform | Architecture | Status |
|----------|-------------|--------|
| Linux | x86_64 | ✅ Supported |
| Linux | ARM64 | ✅ Supported |
| macOS | x86_64 | ✅ Supported |
| macOS | ARM64 (M1/M2) | ✅ Supported |

## Requirements

- Node.js >= 14.0.0
- Platform-specific native module (automatically installed)

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { AgenticNode, AgenticPublisher, AgenticSubscriber, PublisherStats } from '@agentic-robotics/core';
```

## Error Handling

```javascript
try {
  const publisher = await node.createPublisher('/topic');
  await publisher.publish(JSON.stringify({ data: 'test' }));
} catch (error) {
  console.error('Publisher error:', error.message);
}

try {
  const invalidJson = '{ not valid json }';
  await publisher.publish(invalidJson);
} catch (error) {
  console.error('Invalid JSON:', error.message);
  // Error: Invalid JSON: expected ident at line 1 column 2
}
```

## Advanced Usage

### Multiple Publishers

```javascript
const sensors = ['temperature', 'pressure', 'humidity'];
const publishers = await Promise.all(
  sensors.map(sensor =>
    node.createPublisher(`/sensors/${sensor}`)
  )
);

// Publish to all sensors
await Promise.all(
  publishers.map(pub =>
    pub.publish(JSON.stringify({ value: Math.random() }))
  )
);
```

### Message Batching

```javascript
const messages = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  value: Math.random()
}));

for (const msg of messages) {
  await publisher.publish(JSON.stringify(msg));
}

const stats = publisher.getStats();
console.log(`Sent ${stats.messages} messages (${stats.bytes} bytes)`);
```

## Related Packages

- **[agentic-robotics](https://www.npmjs.com/package/agentic-robotics)** - Complete framework (recommended)
- **[@agentic-robotics/cli](https://www.npmjs.com/package/@agentic-robotics/cli)** - Command-line tools
- **[@agentic-robotics/mcp](https://www.npmjs.com/package/@agentic-robotics/mcp)** - MCP server with AI integration

## Homepage

Visit [ruv.io](https://ruv.io) for more information and documentation.

## Contributing

Contributions welcome! Visit [github.com/ruvnet/vibecast](https://github.com/ruvnet/vibecast)

## License

MIT OR Apache-2.0

## Support

- 📚 [Documentation](https://docs.rs/agentic-robotics)
- 🐛 [Issue Tracker](https://github.com/ruvnet/vibecast/issues)
- 💬 [Discussions](https://github.com/ruvnet/vibecast/discussions)
