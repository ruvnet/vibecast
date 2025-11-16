# @agentic-robotics/cli

[![npm version](https://img.shields.io/npm/v/@agentic-robotics/cli.svg)](https://www.npmjs.com/package/@agentic-robotics/cli)
[![Downloads](https://img.shields.io/npm/dm/@agentic-robotics/cli.svg)](https://www.npmjs.com/package/@agentic-robotics/cli)
[![License](https://img.shields.io/npm/l/@agentic-robotics/cli.svg)](https://github.com/ruvnet/vibecast)

Command-line tools for the **agentic-robotics** framework.

## Features

- 🛠️ **Test Framework** - Validate node creation and communication
- 📊 **System Info** - Display framework version and capabilities
- ⚡ **Quick Testing** - Rapid prototyping and debugging
- 🔍 **Diagnostics** - Built-in health checks
- 🎯 **Simple Interface** - Easy-to-use commands

## Installation

Global installation (recommended):

```bash
npm install -g @agentic-robotics/cli
```

Or use with npx:

```bash
npx @agentic-robotics/cli test
```

## Commands

### `test` - Test Node Communication

Test node creation, publisher, and message publishing:

```bash
agentic-robotics test
```

**Output:**
```
🤖 Testing Agentic Robotics Node...
✅ Node created successfully
✅ Publisher created
✅ Message published
✅ Message received
📊 Stats: { messages: 1, bytes: 66 }
```

### `info` - Framework Information

Display framework version and capabilities:

```bash
agentic-robotics info
```

**Output:**
```
🤖 Agentic Robotics Framework v0.1.3
📦 ROS3-compatible robotics middleware
⚡ High-performance native bindings

Available commands:
  test     - Test node creation and communication
  info     - Show this information
```

## Quick Start

### Test Your Installation

```bash
# Install globally
npm install -g @agentic-robotics/cli

# Run test
agentic-robotics test

# Should output: ✅ All tests passed
```

### Use in Scripts

```json
{
  "scripts": {
    "test:robot": "agentic-robotics test",
    "info": "agentic-robotics info"
  }
}
```

## Usage Examples

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Robot Framework

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g @agentic-robotics/cli
      - run: agentic-robotics test
```

### Docker Health Check

```dockerfile
FROM node:18
RUN npm install -g @agentic-robotics/cli
HEALTHCHECK CMD agentic-robotics test || exit 1
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
agentic-robotics test || {
  echo "❌ Robot framework test failed"
  exit 1
}
```

## API

The CLI uses the `@agentic-robotics/core` package internally:

```javascript
const { AgenticNode } = require('@agentic-robotics/core');

// Test creates a node
const node = new AgenticNode('test-node');

// Creates a publisher
const publisher = await node.createPublisher('/test');

// Publishes a test message
await publisher.publish(JSON.stringify({
  message: 'Hello, World!',
  timestamp: Date.now()
}));

// Checks stats
const stats = publisher.getStats();
console.log('📊 Stats:', stats);
```

## Exit Codes

- `0` - Success (all tests passed)
- `1` - Failure (test failed or error occurred)

## Requirements

- Node.js >= 14.0.0
- @agentic-robotics/core (peer dependency)

## Related Packages

- **[agentic-robotics](https://www.npmjs.com/package/agentic-robotics)** - Complete framework
- **[@agentic-robotics/core](https://www.npmjs.com/package/@agentic-robotics/core)** - Core bindings
- **[@agentic-robotics/mcp](https://www.npmjs.com/package/@agentic-robotics/mcp)** - MCP server

## Homepage

Visit [ruv.io](https://ruv.io) for more information and documentation.

## License

MIT OR Apache-2.0
