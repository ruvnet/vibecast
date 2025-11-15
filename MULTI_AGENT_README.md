# Multi-Agent Franchise Platform

> **Agent Swarm 4: Agent Orchestration Engineer - Mission Complete**

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY

# Run tests
npm test

# Try the examples
npx tsx examples/basic-usage.ts
npx tsx examples/swarm-example.ts
```

## 📦 What's Included

### OpenRouter Integration ✅
- DeepSeek-Chat model integration
- Rate limiting (60 req/min, 100K tokens/min)
- Automatic retries with exponential backoff
- Streaming response support
- Comprehensive error handling

### 5 Specialized Agents ✅

1. **FranchiseAnalysisAgent** - Performance analysis and insights
2. **GrowthPlanningAgent** - Strategic expansion planning
3. **TerritoryAgent** - Geographic territory management
4. **ComplianceAgent** - Regulatory compliance monitoring
5. **ReportingAgent** - Comprehensive reporting and analytics

### 3 Agent Frameworks ✅

1. **Agentic-Flow** - Multi-step workflow orchestration
2. **Lean-Agentic** - Lightweight agent operations
3. **Strange-Loops** - Recursive agent patterns

### Agent Swarm Orchestration ✅

- Sequential execution (pipeline)
- Parallel execution (concurrent)
- Conditional execution (dynamic)
- Agent-to-agent message passing
- Resource management and cleanup

## 🎯 Key Features

### Intelligent Analysis
```typescript
const system = await initializeMultiAgentPlatform();

// Analyze franchise performance
const analysis = await system.agents.franchiseAnalysis.processTask({
  input: {
    franchiseData: [...],
    analysisType: 'performance',
    includeRecommendations: true
  }
});
```

### Strategic Planning
```typescript
// Generate growth plans
const growthPlan = await system.agents.growthPlanning.processTask({
  input: {
    currentFranchises: [...],
    budget: 2000000,
    timeframe: '24 months'
  }
});
```

### Compliance Monitoring
```typescript
// Check compliance
const compliance = await system.agents.compliance.processTask({
  input: {
    franchiseData: [...],
    complianceType: 'operational',
    standards: ['Food Safety', 'Labor Laws']
  }
});
```

### Multi-Agent Coordination
```typescript
const swarm = createFranchiseSwarm();

// Execute agents in sequence
await swarm.executeSwarmTask({
  name: 'Full Analysis',
  agents: ['franchise-analysis', 'compliance', 'reporting'],
  coordination: 'sequential',
  input: data
});
```

## 📊 Architecture

```
Application Layer
     ↓
Orchestration Layer (Agent Swarm)
     ↓
Framework Layer (Agentic-Flow, Lean-Agentic, Strange-Loops)
     ↓
Agent Layer (5 Specialized Agents)
     ↓
Infrastructure Layer (OpenRouter Client + Config)
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=your_key_here

# Model Configuration
DEEPSEEK_MODEL=deepseek/deepseek-chat
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Agent Settings
MAX_CONCURRENT_AGENTS=5
AGENT_TIMEOUT_MS=30000
ENABLE_AGENT_LOGGING=true

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_TOKENS_PER_MINUTE=100000

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Model Parameters
MODEL_TEMPERATURE=0.7
MODEL_MAX_TOKENS=4096
```

## 📚 Documentation

- **[MULTI_AGENT_SYSTEM.md](docs/MULTI_AGENT_SYSTEM.md)** - Complete system documentation
- **[AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md)** - Technical architecture details
- **[AGENT_SUMMARY.md](docs/AGENT_SUMMARY.md)** - Executive summary

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Test suites included:
- OpenRouter client tests
- Agent behavior tests
- Orchestration tests
- Framework integration tests

## 📁 Project Structure

```
src/
├── agents/                    # Specialized agents
│   ├── franchise-analysis-agent.ts
│   ├── growth-planning-agent.ts
│   ├── territory-agent.ts
│   ├── compliance-agent.ts
│   └── reporting-agent.ts
├── lib/                       # Core libraries
│   ├── openrouter-client.ts   # OpenRouter integration
│   ├── base-agent.ts          # Base agent class
│   └── frameworks/            # Agent frameworks
│       ├── agentic-flow.ts
│       ├── lean-agentic.ts
│       └── strange-loops.ts
├── orchestration/             # Agent coordination
│   ├── agent-swarm.ts
│   └── index.ts
├── config/                    # Configuration
│   └── index.ts
├── types/                     # TypeScript types
│   └── index.ts
└── tests/                     # Test suites
    ├── openrouter-client.test.ts
    ├── agents.test.ts
    ├── orchestration.test.ts
    └── frameworks.test.ts
```

## 💡 Usage Examples

### Basic Agent Usage

```typescript
import { initializeMultiAgentPlatform } from './src';

const system = await initializeMultiAgentPlatform();

// Quick health check
const health = await system.agents.franchiseAnalysis.quickHealthCheck(franchiseData);
console.log(`Health Score: ${health.score}/100`);

// Territory metrics
const metrics = system.agents.territory.calculateTerritoryMetrics(territoryData);
console.log(`Population Density: ${metrics.populationDensity}`);
```

### Workflow Orchestration

```typescript
import { AgenticFlowEngine } from './src/lib/frameworks/agentic-flow';

const engine = new AgenticFlowEngine();

engine.registerWorkflow({
  id: 'franchise-evaluation',
  name: 'Complete Franchise Evaluation',
  steps: [
    { id: 'analysis', agentRole: 'franchise-analysis', input: (ctx) => ctx.data },
    { id: 'compliance', agentRole: 'compliance', input: (ctx) => ctx.data },
    { id: 'report', agentRole: 'reporting', input: (ctx) => ctx.results }
  ]
});

const result = await engine.executeWorkflow('franchise-evaluation', data, executor);
```

### Swarm Coordination

```typescript
import { createFranchiseSwarm } from './src/orchestration';

const swarm = createFranchiseSwarm();

// Parallel analysis
await swarm.executeSwarmTask({
  id: 'parallel-analysis',
  name: 'Multi-Perspective Analysis',
  agents: ['franchise-analysis', 'territory-management', 'compliance'],
  coordination: 'parallel',
  input: franchiseData
});

// Message passing
const response = await swarm.sendMessage(
  'franchise-analysis',
  'growth-planning',
  { analysisResults: data }
);
```

## 🔐 Security

- ✅ API keys in environment variables only
- ✅ Input validation with Zod schemas
- ✅ Rate limiting to prevent abuse
- ✅ Timeout protection
- ✅ No sensitive data in logs

## 📈 Performance

- **Concurrency**: Up to 5 agents simultaneously
- **Rate Limiting**: 60 requests/minute
- **Token Limit**: 100K tokens/minute
- **Retry Logic**: 3 attempts with backoff
- **Timeout**: 30 seconds default

## 🎨 Agent Capabilities

| Agent | Primary Function | Temperature | Max Tokens |
|-------|-----------------|-------------|------------|
| FranchiseAnalysis | Performance analysis | 0.3 | 2048 |
| GrowthPlanning | Strategic planning | 0.4 | 2048 |
| Territory | Geographic optimization | 0.3 | 2048 |
| Compliance | Regulatory monitoring | 0.2 | 2048 |
| Reporting | Analytics & reports | 0.4 | 3072 |

## 🚦 Status

✅ **Complete and Ready**

- [x] OpenRouter client with DeepSeek-Chat
- [x] Rate limiting and error handling
- [x] 5 specialized agents
- [x] 3 framework integrations
- [x] Agent swarm orchestration
- [x] Message passing
- [x] Comprehensive tests
- [x] Full documentation
- [x] Usage examples

## 📝 Next Steps

1. Set your `OPENROUTER_API_KEY` in `.env`
2. Run `npm install`
3. Try the examples
4. Integrate with your franchise data
5. Customize agent prompts for your use case

## 🤝 Integration

The multi-agent system integrates with:
- Domain models and entities
- Database layer for data access
- Event system for monitoring
- API layer for external access
- CLI for command-line usage

## 📞 Support

For issues or questions:
1. Check documentation in `docs/`
2. Review examples in `examples/`
3. Run tests to verify setup
4. Check OpenRouter API status

## 📄 License

MIT License - See LICENSE file for details

---

**Built by Agent Swarm 4: Agent Orchestration Engineer**

*Transforming franchise management with AI-powered multi-agent orchestration*
