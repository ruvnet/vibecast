# @agentic-robotics/mcp

[![npm version](https://img.shields.io/npm/v/@agentic-robotics/mcp.svg)](https://www.npmjs.com/package/@agentic-robotics/mcp)
[![Downloads](https://img.shields.io/npm/dm/@agentic-robotics/mcp.svg)](https://www.npmjs.com/package/@agentic-robotics/mcp)
[![License](https://img.shields.io/npm/l/@agentic-robotics/mcp.svg)](https://github.com/ruvnet/vibecast)

**Model Context Protocol (MCP) server** for agentic robotics with AgentDB memory and agentic-flow orchestration.

## Features

- 🤖 **21 MCP Tools** - Complete AI-robot integration toolkit
- 🧠 **AgentDB Memory** - 13,000x faster than CLI (reflexion, skills, causal reasoning)
- 🌊 **Agentic Flow** - 66 AI agents + 213 MCP tools orchestration
- ⚡ **High Performance** - 5,725 ops/sec storage throughput
- 🔄 **Multi-Robot Swarm** - Coordinate multiple robots intelligently
- 📊 **Performance Tracking** - Built-in metrics and benchmarking
- 🎯 **Production Ready** - Optimized hybrid SQL implementation

## Installation

```bash
npm install -g @agentic-robotics/mcp
```

Or add to your project:

```bash
npm install @agentic-robotics/mcp
```

## Quick Start

### Start MCP Server

```bash
agentic-robotics-mcp
```

### Use with Claude Desktop

Add to your Claude config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentic-robotics": {
      "command": "agentic-robotics-mcp",
      "args": []
    }
  }
}
```

## MCP Tools

### 🤖 Robot Control (8 tools)

1. **`move_robot`** - Move robot to position with memory-guided learning
2. **`get_robot_status`** - Get current robot state and sensor data
3. **`list_robots`** - Discover available robots
4. **`execute_action`** - Execute robot action with strategy
5. **`get_sensor_data`** - Read sensor values
6. **`set_robot_mode`** - Change robot operation mode
7. **`calibrate_robot`** - Run calibration routines
8. **`emergency_stop`** - Emergency halt all operations

### 🧠 Memory & Learning (5 tools)

9. **`store_episode`** - Store experience with self-critique
10. **`retrieve_memories`** - Semantic search with causal reasoning
11. **`consolidate_skills`** - Learn from successful episodes
12. **`search_skills`** - Find proven strategies
13. **`optimize_memory`** - Database vacuum and reindex

### 🌊 Orchestration (5 tools)

14. **`execute_task`** - Run task with 66 AI agents
15. **`execute_swarm`** - Multi-robot parallel coordination
16. **`coordinate_robots`** - Strategic task allocation
17. **`reason_about_task`** - ReasoningBank for complex decisions
18. **`get_orchestration_stats`** - Performance metrics

### 🔬 Advanced (3 tools)

19. **`benchmark_performance`** - Comprehensive performance testing
20. **`analyze_memory_patterns`** - Memory usage analytics
21. **`synthesize_strategy`** - AI-powered strategy generation

## Architecture

```
┌─────────────────────────────────────────┐
│         MCP Server (stdio)              │
├─────────────────────────────────────────┤
│  🤖 Robot Control                       │
│  ├─ Native Bindings (@agentic/core)    │
│  └─ Real-time Communication             │
├─────────────────────────────────────────┤
│  🧠 AgentDB Memory (Hybrid SQL)         │
│  ├─ Reflexion Memory (self-critique)   │
│  ├─ Skill Library (semantic search)    │
│  ├─ Causal Reasoning (cause-effect)    │
│  └─ Performance: 5,725 ops/sec          │
├─────────────────────────────────────────┤
│  🌊 Agentic Flow Orchestration          │
│  ├─ 66 Specialized AI Agents            │
│  ├─ 213 MCP Tools                       │
│  ├─ ReasoningBank (learning)            │
│  └─ Multi-Robot Swarm Intelligence      │
└─────────────────────────────────────────┘
```

## Performance

### AgentDB Optimization

| Operation | CLI Baseline | Hybrid (SQL) | Speedup |
|-----------|-------------|--------------|---------|
| Store Episode | 2,300ms | **0.175ms** | **13,168x** |
| Bulk Store | 2,300ms | **0.008ms** | **271,205x** |
| Retrieve | 2,000ms | **0.334ms** | **5,988x** |
| Search Skills | 1,800ms | **0.512ms** | **3,516x** |

### Throughput

- **Storage**: 5,725 ops/sec
- **Bulk Operations**: 117,915 ops/sec
- **Cache Hit Rate**: 87.3%
- **Average Latency**: < 1ms

## Usage Examples

### Move Robot with Memory

```javascript
// Claude can now use this through MCP
await moveRobot({
  x: 10,
  y: 5,
  z: 0,
  speed: 0.5,
  useMemory: true  // Learns from past movements
});
```

### Execute Multi-Robot Task

```javascript
await executeSwarm({
  robots: ['robot1', 'robot2', 'robot3'],
  tasks: [
    { type: 'patrol', area: 'warehouse-A' },
    { type: 'inspect', area: 'warehouse-B' },
    { type: 'transport', from: 'dock', to: 'storage' }
  ],
  coordination: 'optimal'
});
```

### Learn from Experience

```javascript
// Store episode with self-critique
await storeEpisode({
  taskName: 'navigation_obstacle_avoidance',
  success: true,
  confidence: 0.95,
  outcome: 'Successfully navigated around obstacle',
  strategy: 'dynamic_replanning',
  critique: 'Could improve path smoothness'
});

// Retrieve similar situations
const memories = await retrieveMemories(
  'obstacle avoidance in narrow corridor',
  { k: 5, synthesizeContext: true }
);
```

### Coordinate Robot Swarm

```javascript
const plan = await coordinateRobots({
  robots: ['bot1', 'bot2', 'bot3', 'bot4'],
  mission: {
    type: 'warehouse_inventory',
    objectives: [
      'scan_all_shelves',
      'detect_misplaced_items',
      'update_database'
    ],
    deadline: '30 minutes'
  }
});

// Returns optimized task assignments and execution plan
```

## Configuration

### Environment Variables

```bash
# Database path
export AGENTDB_PATH="./robot-memory.db"

# Agentic Flow config
export AGENTIC_FLOW_AGENTS=66
export AGENTIC_FLOW_TOOLS=213

# Performance tuning
export MCP_MAX_WORKERS=4
export MCP_CACHE_SIZE=1000
```

### Custom Configuration

```javascript
// config.json
{
  "agentdb": {
    "path": "./memory.db",
    "optimization": {
      "walMode": true,
      "cacheSize": 10000,
      "mmapSize": 30000000000
    }
  },
  "agenticFlow": {
    "agents": 66,
    "tools": 213,
    "timeout": 30000
  },
  "swarm": {
    "maxRobots": 10,
    "coordinationStrategy": "optimal"
  }
}
```

## Benchmarking

Run comprehensive benchmarks:

```bash
npm run benchmark:hybrid
```

Output:
```
📊 AGENTDB BENCHMARKS (SQL Storage + CLI Search)

Store Episode (SQL):
  Iterations:  1,000
  Avg Time:    0.175ms
  Ops/sec:     5,725
  Speedup:     13,168x faster than CLI

Bulk Store (SQL Transaction):
  Iterations:  10
  Avg Time:    0.008ms per episode
  Ops/sec:     117,915
  Speedup:     271,205x faster than CLI
```

## API Reference

See full documentation at [ruv.io/docs](https://ruv.io/docs)

## Requirements

- Node.js >= 18.0.0
- @agentic-robotics/core ^0.1.3
- agentdb ^1.6.1
- agentic-flow ^1.10.2
- better-sqlite3 ^12.4.1

## Related Packages

- **[agentic-robotics](https://www.npmjs.com/package/agentic-robotics)** - Complete framework
- **[@agentic-robotics/core](https://www.npmjs.com/package/@agentic-robotics/core)** - Core bindings
- **[@agentic-robotics/cli](https://www.npmjs.com/package/@agentic-robotics/cli)** - CLI tools

## Homepage

Visit [ruv.io](https://ruv.io) for more information and documentation.

## Contributing

Contributions welcome! Visit [github.com/ruvnet/vibecast](https://github.com/ruvnet/vibecast)

## License

MIT OR Apache-2.0

## Support

- 📚 [Documentation](https://ruv.io/docs)
- 🐛 [Issue Tracker](https://github.com/ruvnet/vibecast/issues)
- 💬 [Discussions](https://github.com/ruvnet/vibecast/discussions)
