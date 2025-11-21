# Vibecast PubNub Integration

> Real-time messaging and agent orchestration using PubNub with ruv.io patterns

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![PubNub](https://img.shields.io/badge/PubNub-8.2-red.svg)](https://www.pubnub.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project implements a comprehensive PubNub integration with various **ruv.io** patterns for agent orchestration, swarm coordination, and workflow management. Perfect for building real-time distributed systems and AI agent networks.

## 🌟 Features

- **🔌 Core PubNub Service**: Full-featured real-time messaging with presence and history
- **🤖 Agent Orchestration**: Distributed agent task execution and coordination
- **🐝 Swarm Coordination**: Multi-agent systems with parallel, sequential, and hierarchical execution
- **🌊 Flow-Nexus Integration**: Workflow orchestration with decision trees, loops, and parallel execution
- **📡 MCP Protocol**: Model Context Protocol implementation for structured communication
- **⚡ Real-time**: All communication happens instantly via PubNub's global network
- **🔄 Scalable**: Designed to handle hundreds of agents and thousands of messages

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Install dependencies
npm install

# Build the project
npm run build
```

## 🚀 Quick Start

### Basic Messaging

```typescript
import { PubNubService, MessageType } from 'vibecast-pubnub';

// Initialize PubNub with demo keys
const pubnub = new PubNubService({
  publishKey: 'demo',
  subscribeKey: 'demo',
  userId: 'my-user-id'
});

// Subscribe to a channel
pubnub.subscribe('my-channel');

// Listen for messages
pubnub.onMessage('my-channel', (message) => {
  console.log('Received:', message.payload);
});

// Publish a message
await pubnub.publish('my-channel', MessageType.TEXT, {
  text: 'Hello, Vibecast!'
});
```

### Agent Orchestration

```typescript
import { PubNubService, AgentOrchestrator } from 'vibecast-pubnub';

const pubnub = new PubNubService({ publishKey: 'demo', subscribeKey: 'demo' });
const agent = new AgentOrchestrator(pubnub, 'my-agent');

// Register a task handler
agent.registerTaskHandler('process_data', async (task) => {
  const result = await processData(task.payload);
  return result;
});

// Assign a task
const taskId = await agent.assignTask('process_data', { data: [1, 2, 3] });

// Wait for response
const response = await agent.waitForResponse(taskId);
console.log('Result:', response.result);
```

### Swarm Coordination

```typescript
import { PubNubService, SwarmCoordinator } from 'vibecast-pubnub';

const pubnub = new PubNubService({ publishKey: 'demo', subscribeKey: 'demo' });
const swarm = new SwarmCoordinator(pubnub, {
  swarmId: 'my-swarm',
  agents: [],
  strategy: 'parallel'
});

// Create agents
for (let i = 0; i < 5; i++) {
  const agent = swarm.createAgent(`worker-${i}`);
  agent.registerTaskHandler('compute', async (task) => {
    return task.payload.value * 2;
  });
}

// Execute tasks in parallel
const tasks = [
  { taskId: '1', agentId: '', type: 'compute', payload: { value: 10 } },
  { taskId: '2', agentId: '', type: 'compute', payload: { value: 20 } },
  { taskId: '3', agentId: '', type: 'compute', payload: { value: 30 } }
];

const results = await swarm.executeTasks(tasks);
console.log('Results:', results);
```

## 📚 Examples

Run the included examples to see everything in action:

```bash
# Basic messaging
npm run example:basic

# Agent orchestration
npm run example:agent

# Swarm coordination
npm run example:swarm

# Flow-Nexus workflows
ts-node examples/flow-nexus.ts

# MCP Protocol
ts-node examples/mcp-protocol.ts
```

## 🏗️ Architecture

### Core Components

#### PubNubService
The foundation for all real-time communication. Handles pub/sub, presence, history, and state management.

```typescript
src/core/PubNubService.ts    // Core service implementation
src/core/types.ts            // TypeScript type definitions
```

#### Agent Orchestration
Distributed agent system for task execution and coordination.

```typescript
src/agents/AgentOrchestrator.ts    // Single agent management
src/agents/SwarmCoordinator.ts     // Multi-agent swarm coordination
```

#### Integrations
Advanced patterns inspired by ruv.io projects.

```typescript
src/integrations/FlowNexusIntegration.ts    // Workflow orchestration
src/utils/MCPProtocol.ts                     // Model Context Protocol
```

## 🔑 Configuration

Create a `.env` file (see `.env.example`):

```bash
# Demo keys (rate-limited, for testing only)
PUBNUB_PUBLISH_KEY=demo
PUBNUB_SUBSCRIBE_KEY=demo

# Production keys (sign up at pubnub.com)
# PUBNUB_PUBLISH_KEY=your-publish-key
# PUBNUB_SUBSCRIBE_KEY=your-subscribe-key
```

## 🎯 Use Cases

### Live Coding Sessions
Perfect for Vibecast's weekly live coding sessions with synchronized state and real-time communication.

### Multi-Agent AI Systems
Build distributed AI agent systems inspired by ruv-swarm with 84.8% SWE-Bench solve rate patterns.

### Workflow Automation
Create complex workflows with Flow-Nexus patterns including decisions, loops, and parallel execution.

### Real-time Collaboration
Enable real-time collaboration with presence, state synchronization, and message history.

## 🔗 Integration with ruv.io Projects

This implementation draws inspiration from:

- **[flow-nexus](https://www.npmjs.com/package/flow-nexus)**: Agentic platform with MCP standard
- **[claude-flow](https://github.com/ruvnet/claude-flow)**: Agent orchestration for Claude
- **[ruv-swarm](https://www.npmjs.com/package/ruv-swarm)**: High-performance multi-agent systems
- **[@ruv/sparc-ui](https://www.npmjs.com/package/@ruv/sparc-ui)**: SPARC methodology framework

## 📖 API Reference

### PubNubService

```typescript
class PubNubService {
  constructor(config: PubNubConfig)
  subscribe(channels: string | string[], withPresence?: boolean): void
  unsubscribe(channels: string | string[]): void
  publish(channel: string, type: MessageType, payload: any, metadata?): Promise<void>
  onMessage(channel: string, handler: MessageHandler): () => void
  onPresence(channel: string, handler: PresenceHandler): () => void
  getHistory(channel: string, count?: number): Promise<Message[]>
  hereNow(channel: string): Promise<string[]>
  setState(channel: string, state: Record<string, any>): Promise<void>
  getState(channel: string, uuid?: string): Promise<Record<string, any>>
  disconnect(): void
}
```

### AgentOrchestrator

```typescript
class AgentOrchestrator {
  constructor(pubnub: PubNubService, agentId?: string)
  registerTaskHandler(taskType: string, handler: (task: AgentTask) => Promise<any>): void
  assignTask(taskType: string, payload: any, targetAgentId?: string): Promise<string>
  waitForResponse(taskId: string, timeoutMs?: number): Promise<AgentResponse>
  getAgentId(): string
  getCapabilities(): string[]
}
```

### SwarmCoordinator

```typescript
class SwarmCoordinator {
  constructor(pubnub: PubNubService, config: SwarmConfig)
  createAgent(agentId?: string): AgentOrchestrator
  addAgent(agent: AgentOrchestrator): void
  executeTasks(tasks: AgentTask[]): Promise<AgentResponse[]>
  getSwarmId(): string
  getAgents(): AgentOrchestrator[]
}
```

### FlowNexusIntegration

```typescript
class FlowNexusIntegration {
  constructor(pubnub: PubNubService)
  createFlow(name: string, steps: FlowStep[]): string
  startFlow(flowId: string, initialData?: Record<string, any>): Promise<void>
  pauseFlow(flowId: string): Promise<void>
  resumeFlow(flowId: string): Promise<void>
  getFlow(flowId: string): FlowState | undefined
  onFlowComplete(flowId: string, handler: (flow: FlowState) => void): void
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## 🤝 Contributing

Weekly Vibecast live coding sessions! Check branches for each week's work.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🎬 Weekly Sessions

This project is developed during weekly Vibecast live coding sessions with rUv. Each week's work is in its own branch:

- Week 1: PubNub integration basics
- Week 2: Agent orchestration
- Week 3: Swarm coordination
- Week 4: Flow-Nexus integration
- Week 5: MCP protocol implementation

## 🔗 Links

- [PubNub Documentation](https://www.pubnub.com/docs)
- [ruv.io Projects](https://github.com/ruvnet)
- [Vibecast Sessions](https://github.com/ruvnet/vibecast)

## 💡 Support

For questions and discussions, join our community or open an issue on GitHub.

---

**Built with ❤️ during Vibecast sessions**
