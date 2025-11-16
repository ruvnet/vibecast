# Installation Guide

This guide covers installing Agentic Robotics from npm or building from source.

## Prerequisites

### Required
- **Node.js** 18.0.0 or higher ([download](https://nodejs.org/))
- **npm** 8.0.0 or higher (comes with Node.js)

### For Building from Source
- **Rust** 1.75 or higher ([install via rustup](https://rustup.rs/))
- **Cargo** (comes with Rust)
- **Build tools** for your platform:
  - Linux: `build-essential` package
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools

## Quick Install (npm)

### Install Main Package

```bash
npm install agentic-robotics
```

This will automatically install the appropriate platform-specific binary for your system.

### Install Specific Packages

If you only need specific components:

```bash
# Core Node.js bindings only
npm install @agentic-robotics/core

# CLI tools only
npm install @agentic-robotics/cli

# MCP server only
npm install @agentic-robotics/mcp
```

## Build from Source

### 1. Clone Repository

```bash
git clone https://github.com/ruvnet/agentic-robotics.git
cd agentic-robotics
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Rust Crates

```bash
# Development build (faster)
cargo build

# Release build (optimized)
cargo build --release
```

### 4. Build Node.js Bindings

```bash
# Build native bindings
npm run build

# This runs: napi build --platform --release
```

### 5. Run Tests

```bash
# Rust tests
cargo test

# Node.js tests
npm test

# Run all tests
npm run test:all
```

## Platform-Specific Installation

### Linux (x64)

```bash
npm install @agentic-robotics/linux-x64-gnu
```

**Requirements:**
- glibc 2.17 or higher
- Works on Ubuntu 14.04+, Debian 8+, CentOS 7+, Fedora, etc.

### Linux (ARM64)

```bash
npm install @agentic-robotics/linux-arm64-gnu
```

**Requirements:**
- ARMv8 or higher
- glibc 2.17 or higher
- Works on Raspberry Pi 3/4, Jetson Nano, etc.

### macOS (Intel)

```bash
npm install @agentic-robotics/darwin-x64
```

**Requirements:**
- macOS 10.15 (Catalina) or higher
- Intel x86_64 processor

### macOS (Apple Silicon)

```bash
npm install @agentic-robotics/darwin-arm64
```

**Requirements:**
- macOS 11.0 (Big Sur) or higher
- Apple M1/M2/M3 processor

## Verify Installation

### Check Version

```bash
npx agentic-robotics --version
```

### Run Test Program

Create a file `test.js`:

```javascript
const { AgenticNode } = require('agentic-robotics');

async function main() {
  console.log('Creating node...');
  const node = new AgenticNode('test-node');

  console.log('Creating publisher...');
  const publisher = await node.createPublisher('/test/topic');

  console.log('Publishing message...');
  await publisher.publish(JSON.stringify({
    message: 'Hello from Agentic Robotics!',
    timestamp: Date.now()
  }));

  const stats = publisher.getStats();
  console.log('Stats:', stats);
  console.log('✅ Installation verified!');
}

main().catch(console.error);
```

Run it:

```bash
node test.js
```

Expected output:
```
Creating node...
Creating publisher...
Publishing message...
Stats: { messages: 1, bytes: 58 }
✅ Installation verified!
```

## Troubleshooting

### Error: Cannot find module '@agentic-robotics/...'

**Solution:** Install the platform-specific package:
```bash
npm install @agentic-robotics/linux-x64-gnu  # or your platform
```

### Error: GLIBC version too old

**Solution:** Upgrade your Linux distribution or use a newer base image for Docker.

### Error: Rust compiler not found

**Solution:** Install Rust via rustup:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Build Error: napi command not found

**Solution:** Install NAPI-RS CLI:
```bash
npm install -g @napi-rs/cli
```

### macOS: "cannot be opened because the developer cannot be verified"

**Solution:** Allow the binary in System Preferences > Security & Privacy.

### Windows: Build tools not found

**Solution:** Install Visual Studio Build Tools:
```bash
npm install --global windows-build-tools
```

## Docker Installation

### Using Docker

```dockerfile
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache \
    build-base \
    python3

# Install agentic-robotics
RUN npm install -g agentic-robotics

# Your application
COPY . /app
WORKDIR /app

CMD ["node", "index.js"]
```

Build and run:
```bash
docker build -t my-robot-app .
docker run -it my-robot-app
```

## Development Setup

### Install Development Dependencies

```bash
# Install Rust nightly (for some features)
rustup install nightly

# Install cargo tools
cargo install cargo-watch
cargo install cargo-criterion

# Install Node.js dev dependencies
npm install --save-dev \
  @types/node \
  typescript \
  ts-node
```

### Configure IDE

#### VS Code

Install extensions:
- rust-analyzer
- CodeLLDB (for debugging)
- Even Better TOML

Create `.vscode/settings.json`:
```json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy"
}
```

#### JetBrains IDEs

Install plugins:
- Rust
- TOML

## Next Steps

- Read the [API Reference](API.md)
- Explore [MCP Tools](MCP_TOOLS.md)
- Check out [Examples](../examples/)
- Review [Performance Report](../PERFORMANCE_REPORT.md)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/ruvnet/agentic-robotics/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ruvnet/agentic-robotics/discussions)
- **Homepage**: [ruv.io](https://ruv.io)
