# Agentic Robotics - NPM Package Structure

## Overview

Proper NAPI-RS multi-package structure with scoped packages under `@agentic-robotics/*`.

## Package Hierarchy

```
agentic-robotics (meta-package)
├── @agentic-robotics/core (core bindings + loader)
├── @agentic-robotics/cli (CLI tools)
├── @agentic-robotics/mcp (MCP server with AgentDB)
└── Platform-specific packages (auto-installed):
    ├── @agentic-robotics/linux-x64-gnu
    ├── @agentic-robotics/linux-arm64-gnu
    ├── @agentic-robotics/darwin-x64
    └── @agentic-robotics/darwin-arm64
```

## Package Details

### 1. `agentic-robotics` (Main Package)
**Version:** 0.1.3
**Purpose:** Meta-package that installs everything
**Provides:**
- `agentic-robotics` CLI command
- `agentic-robotics-mcp` MCP server command
- All dependencies via sub-packages

**Install:**
```bash
npm install -g agentic-robotics
```

**Usage:**
```bash
agentic-robotics test           # Test framework
agentic-robotics info           # Show info
agentic-robotics-mcp            # Start MCP server
```

---

### 2. `@agentic-robotics/core` (Core Bindings)
**Version:** 0.1.3
**Purpose:** Core native bindings loader
**Provides:**
- `AgenticNode` class
- `AgenticPublisher` class
- `AgenticSubscriber` class
- TypeScript definitions

**Install:**
```bash
npm install @agentic-robotics/core
```

**Usage:**
```javascript
const { AgenticNode } = require('@agentic-robotics/core');

const node = new AgenticNode('my-robot');
const pub = await node.createPublisher('/topic');
await pub.publish(JSON.stringify({ data: 'hello' }));
```

**Dependencies:**
- Automatically installs correct platform package via `optionalDependencies`

---

### 3. `@agentic-robotics/cli` (CLI Tools)
**Version:** 0.1.3
**Purpose:** Command-line interface
**Provides:**
- `agentic-robotics` binary
- Testing commands
- Framework utilities

**Install:**
```bash
npm install -g @agentic-robotics/cli
```

**Commands:**
- `test` - Test node creation and communication
- `info` - Show framework information

**Dependencies:**
- `@agentic-robotics/core`
- `commander` (CLI framework)

---

### 4. `@agentic-robotics/mcp` (MCP Server)
**Version:** 0.1.3
**Purpose:** Model Context Protocol server with AI integration
**Provides:**
- `agentic-robotics-mcp` binary
- 21 MCP tools for AI-robot integration
- AgentDB memory (13,000x optimized)
- agentic-flow orchestration (66 agents, 213 tools)

**Install:**
```bash
npm install -g @agentic-robotics/mcp
```

**Features:**
- Robot control tools (move, sense, actuate)
- Enhanced memory with AgentDB (reflexion, skills, causal reasoning)
- Swarm orchestration with agentic-flow
- Hybrid SQL optimization (5,725 ops/sec)

**Dependencies:**
- `@agentic-robotics/core`
- `@modelcontextprotocol/sdk`
- `agentdb` v1.6.1
- `agentic-flow` v1.10.2
- `better-sqlite3`

---

### 5. Platform Packages (Native Bindings)

#### `@agentic-robotics/linux-x64-gnu`
- Linux x64 (GNU libc)
- 854 KB compiled .node binary

#### `@agentic-robotics/linux-arm64-gnu`
- Linux ARM64 (GNU libc)
- For Raspberry Pi 4+, ARM servers

#### `@agentic-robotics/darwin-x64`
- macOS Intel (x64)

#### `@agentic-robotics/darwin-arm64`
- macOS Apple Silicon (M1/M2/M3)

**Note:** These are automatically installed based on your platform. No manual installation needed.

---

## Publishing Order

To publish all packages correctly:

```bash
# 1. Publish platform packages first
cd npm/linux-x64-gnu && npm publish
cd npm/linux-arm64-gnu && npm publish  # (when built)
cd npm/darwin-x64 && npm publish       # (when built)
cd npm/darwin-arm64 && npm publish     # (when built)

# 2. Publish core (depends on platform packages)
cd npm/core && npm publish

# 3. Publish CLI (depends on core)
cd npm/cli && npm publish

# 4. Publish MCP (depends on core)
cd npm/mcp && npm publish

# 5. Publish meta-package (depends on all)
cd npm/agentic-robotics && npm publish
```

## Environment Setup

Set npm token before publishing:

```bash
export NPM_TOKEN=your_npm_token_here
```

Or create `.npmrc` in each package:
```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

## Installation Examples

### For End Users (Everything)
```bash
npm install -g agentic-robotics
```

### For Developers (Just Core)
```bash
npm install @agentic-robotics/core
```

### For AI Integration (MCP Server)
```bash
npm install -g @agentic-robotics/mcp
```

### For Automation (CLI Only)
```bash
npm install -g @agentic-robotics/cli
```

## Directory Structure

```
vibecast/
├── npm/                                    # NPM packages
│   ├── agentic-robotics/                  # Meta-package
│   │   ├── package.json
│   │   └── README.md
│   ├── core/                              # @agentic-robotics/core
│   │   ├── package.json
│   │   ├── index.js
│   │   └── index.d.ts
│   ├── cli/                               # @agentic-robotics/cli
│   │   ├── package.json
│   │   └── bin/cli.js
│   ├── mcp/                               # @agentic-robotics/mcp
│   │   ├── package.json
│   │   ├── src/
│   │   └── tsconfig.json
│   ├── linux-x64-gnu/                     # Platform package
│   │   ├── package.json
│   │   └── agentic-robotics.linux-x64-gnu.node
│   ├── linux-arm64-gnu/                   # Platform package
│   ├── darwin-x64/                        # Platform package
│   └── darwin-arm64/                      # Platform package
└── crates/                                # Rust source
    └── agentic-robotics-node/             # NAPI-RS bindings
```

## Benefits of This Structure

1. **Modular** - Install only what you need
2. **Optimized** - Platform-specific binaries auto-installed
3. **Professional** - Follows NAPI-RS best practices
4. **Scoped** - `@agentic-robotics/*` namespace
5. **Flexible** - Core, CLI, MCP can be used independently
6. **Easy Updates** - Update individual components
7. **Clear Dependencies** - Explicit package relationships

## Performance

- **Storage:** 13,168x faster (0.175ms vs 2,300ms)
- **Throughput:** 5,725 ops/sec
- **Native Speed:** Rust via NAPI-RS
- **Memory Efficient:** Optimized SQLite with WAL mode

## License

MIT OR Apache-2.0
