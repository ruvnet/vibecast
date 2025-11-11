# 🚀 Agentic Flow

<div align="center">

[![npm version](https://badge.fury.io/js/agentic-flow.svg)](https://www.npmjs.com/package/agentic-flow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.83-orange.svg)](https://www.rust-lang.org/)
[![Performance](https://img.shields.io/badge/Performance-2600x_faster-brightgreen.svg)](#-performance)

**Ultra-fast LangGraph-compatible agentic workflow engine powered by Rust/WASM**

[Quick Start](#-quick-start) • [Documentation](#-documentation) • [CLI](#-cli) • [Performance](#-performance) • [MCP Server](#-mcp-server)

</div>

---

## 📖 Introduction

**Agentic Flow** is a **drop-in replacement** for Python LangGraph that delivers **650-2,600x performance improvement** through Rust/WASM. Build complex agentic workflows with microsecond latency.

### Why Agentic Flow?

- 🚄 **2,600x faster** than Python LangGraph
- 🎯 **100% API compatible** with LangGraph
- 🦀 **Rust-powered** for maximum performance
- 🌐 **WASM-ready** for browser/edge deployment
- 🧠 **AgentDB** with pattern storage & reflexion
- 🔌 **MCP Server** (stdio & SSE support)
- 📊 **Built-in benchmarking**
- 🎨 **Beautiful CLI** with TypeScript SDK

---

## 🚀 Quick Start

### NPX (No Installation)

```bash
# Run commands directly with npx
npx agent-graph info
npx agent-graph benchmark
npx agentdb stats
```

### Install Globally

```bash
npm install -g agentic-flow

# Now use directly
agent-graph --help
agentdb --help
```

### Use as Library

```bash
npm install agentic-flow
```

```typescript
import { StateGraph } from 'agentic-flow';

const workflow = new StateGraph({ name: 'MyWorkflow' });

workflow
  .addNode('start', (state) => ({ ...state, count: 0 }))
  .addNode('process', (state) => ({ ...state, count: state.count + 1 }))
  .addEdge('start', 'process')
  .setEntry('start')
  .setFinish('process')
  .compile();

const result = await workflow.invoke({});
console.log(result.state); // { count: 1 }
```

---

## 🎮 CLI

### agent-graph CLI

```bash
# Info and metrics
agent-graph info

# Benchmarks
agent-graph benchmark
agent-graph benchmark --output results.json

# Create workflow
agent-graph create my-workflow

# Validate
agent-graph validate workflow.json

# Execute
agent-graph execute workflow.json --input '{"data":"test"}'

# MCP Server
agent-graph mcp --mode stdio
agent-graph mcp --mode sse --port 3000
```

### agentdb CLI

```bash
# Store patterns
agentdb store "pattern-name" "content"

# Search
agentdb search "query" --limit 10

# Record executions
agentdb record-success "name" '{"state":"data"}' --score 0.95
agentdb record-failure "name" '{"state":"data"}' "error message"

# Recall similar
agentdb recall '{"state":"data"}' --limit 5

# Stats
agentdb stats

# Export/Import
agentdb export patterns.json
agentdb import patterns.json
```

---

## 📚 Documentation

### Full Tutorials

See [FULL-DOCS.md](FULL-DOCS.md) for:
- Complete tutorials
- API reference
- Migration guide
- Performance optimization
- Advanced patterns

### Core Example

```typescript
import { StateGraph } from 'agentic-flow';

// Conditional workflow
const workflow = new StateGraph();

workflow
  .addNode('check', (s) => ({ ...s, value: Math.random() }))
  .addNode('high', (s) => ({ ...s, branch: 'high' }))
  .addNode('low', (s) => ({ ...s, branch: 'low' }))
  .addConditionalEdge('check', 'high', (s) => s.value > 0.5)
  .addConditionalEdge('check', 'low', (s) => s.value <= 0.5)
  .setEntry('check')
  .setFinish('high')
  .setFinish('low')
  .compile();

const result = await workflow.invoke({});
```

---

## ⚡ Performance

| Operation | Python | Agentic Flow | Speedup |
|-----------|--------|--------------|---------|
| Graph Compilation | 1.450 ms | 0.001 ms | **1,450x** |
| Node Execution | 641.7 μs | 0.245 μs | **2,619x** |
| Multi-Node (20) | 3.629 ms | 0.006 ms | **605x** |

```bash
# Run benchmarks
npx agent-graph benchmark
```

See [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md) for full details.

---

## 🔌 MCP Server

### Start Server

```bash
# Stdio mode
npx agent-graph mcp --mode stdio

# SSE mode
npx agent-graph mcp --mode sse --port 3000
```

### Available Methods

- `graph.create`, `graph.execute`, `graph.list`, `graph.delete`
- `agentdb.store`, `agentdb.search`, `agentdb.stats`
- `reflexion.recordSuccess`, `reflexion.recordFailure`, `reflexion.recall`
- `benchmark.run`
- `info.version`, `info.methods`

### Example Request

```bash
echo '{"id":"1","method":"graph.list","params":{}}' | npx agent-graph mcp --mode stdio
```

---

## 🛠️ Development

```bash
# Clone
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Install
npm install

# Build
npm run build

# Test
npm test

# Benchmark
npm run benchmark
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE)

---

## 🔗 Links

- **NPM:** https://www.npmjs.com/package/agentic-flow
- **GitHub:** https://github.com/ruvnet/vibecast
- **Issues:** https://github.com/ruvnet/vibecast/issues
- **Benchmarks:** [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md)

---

<div align="center">

**⭐ Star us on GitHub!**

Made with ❤️ using Rust + WASM

</div>
