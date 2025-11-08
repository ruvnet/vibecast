# Multi-Agent Franchise Platform

## Overview

The Vibecast Multi-Agent Franchise Platform is a sophisticated AI-powered system that uses specialized agents to manage, analyze, and optimize franchise operations. Built with OpenRouter's DeepSeek-Chat model and multiple agent orchestration frameworks.

## Architecture

### Core Components

1. **OpenRouter Client** (`src/lib/openrouter-client.ts`)
   - Integration with OpenRouter API
   - DeepSeek-Chat model support
   - Rate limiting and retry logic
   - Streaming response handling
   - Error recovery

2. **Base Agent** (`src/lib/base-agent.ts`)
   - Abstract base class for all agents
   - Common agent functionality
   - Message handling
   - Conversation history management
   - Event emission

3. **Specialized Agents** (`src/agents/`)
   - **FranchiseAnalysisAgent**: Performance analysis and insights
   - **GrowthPlanningAgent**: Expansion strategies and planning
   - **TerritoryAgent**: Geographic territory management
   - **ComplianceAgent**: Regulatory and standards compliance
   - **ReportingAgent**: Comprehensive reporting and analytics

4. **Agent Frameworks** (`src/lib/frameworks/`)
   - **Agentic-Flow**: Workflow orchestration
   - **Lean-Agentic**: Lightweight agent operations
   - **Strange-Loops**: Recursive agent patterns

5. **Orchestration** (`src/orchestration/`)
   - **AgentSwarm**: Multi-agent coordination
   - Task distribution and execution
   - Message passing between agents
   - Parallel and sequential execution

## Agent Capabilities

### Franchise Analysis Agent

**Purpose**: Analyzes franchise performance and provides actionable insights

**Capabilities**:
- Performance analysis (revenue, profit, efficiency)
- Comparative analysis between franchises
- Trend identification and forecasting
- Risk assessment
- Quick health checks

**Input**:
```typescript
{
  franchiseData: FranchiseData[],
  analysisType: 'performance' | 'comparison' | 'trend' | 'risk',
  timeframe?: string,
  includeRecommendations: boolean
}
```

**Output**:
```typescript
{
  summary: string,
  insights: string[],
  metrics: Record<string, number>,
  trends: Trend[],
  recommendations: string[],
  riskFactors: RiskFactor[]
}
```

### Growth Planning Agent

**Purpose**: Develops strategic growth plans and expansion strategies

**Capabilities**:
- Market opportunity assessment
- Financial modeling and ROI analysis
- Risk evaluation
- Territory evaluation
- Scenario generation (conservative, moderate, aggressive)

**Input**:
```typescript
{
  currentFranchises: any[],
  targetTerritories?: any[],
  budget?: number,
  timeframe?: string,
  goals?: string[]
}
```

**Output**:
```typescript
{
  targetTerritory: string,
  projectedRevenue: number,
  investmentRequired: number,
  roi: number,
  timeline: string,
  risks: string[],
  recommendations: string[]
}
```

### Territory Agent

**Purpose**: Manages franchise territories and geographic allocation

**Capabilities**:
- Territory allocation
- Optimization and rebalancing
- Conflict detection
- Coverage analysis
- Metric calculation

**Input**:
```typescript
{
  territories: TerritoryData[],
  franchises: any[],
  action: 'allocate' | 'optimize' | 'analyze' | 'rebalance',
  constraints?: {
    minPopulation?: number,
    maxDistance?: number,
    allowOverlap?: boolean
  }
}
```

### Compliance Agent

**Purpose**: Ensures regulatory compliance and standards adherence

**Capabilities**:
- Regulatory compliance checks
- Operational compliance review
- Financial compliance audit
- Quality assurance
- Safety compliance

**Compliance Types**:
- Regulatory (licenses, permits, certifications)
- Operational (SOPs, training, protocols)
- Financial (reporting, accounting, audits)
- Quality (brand standards, customer satisfaction)
- Safety (workplace safety, OSHA, emergency procedures)

### Reporting Agent

**Purpose**: Generates comprehensive reports and analytics

**Capabilities**:
- Executive summaries
- Performance dashboards
- Financial analysis
- Trend reports
- Comparative analysis
- Custom reports

**Report Types**:
- `executive-summary`: High-level overview for executives
- `performance-dashboard`: Real-time KPIs and metrics
- `financial-analysis`: Deep financial insights
- `trend-report`: Pattern and trend analysis
- `comparative-analysis`: Franchise comparisons

## Framework Integration

### Agentic-Flow

Workflow orchestration for multi-step agent processes.

```typescript
import { AgenticFlowEngine } from './lib/frameworks/agentic-flow';

const engine = new AgenticFlowEngine();

// Register workflow
engine.registerWorkflow({
  id: 'franchise-onboarding',
  name: 'Franchise Onboarding',
  description: 'Complete onboarding process',
  steps: [
    {
      id: 'compliance-check',
      name: 'Compliance Verification',
      agentRole: 'compliance',
      input: (context) => context.data.franchiseData,
      output: 'complianceResult'
    },
    {
      id: 'territory-allocation',
      name: 'Territory Assignment',
      agentRole: 'territory-management',
      input: (context) => context.data.territoryData,
      output: 'territoryResult'
    }
  ]
});

// Execute workflow
const result = await engine.executeWorkflow(
  'franchise-onboarding',
  { franchiseData, territoryData },
  agentExecutor
);
```

### Lean-Agentic

Lightweight agent operations with priority queues.

```typescript
import { LeanAgenticEngine } from './lib/frameworks/lean-agentic';

const engine = new LeanAgenticEngine();

// Register lightweight agent
engine.registerAgent({
  id: 'quick-analysis',
  name: 'Quick Analysis',
  handler: async (input) => {
    // Fast processing logic
    return { result: 'analyzed' };
  },
  timeout: 5000,
  priority: 10
});

// Queue task
await engine.queueTask('quick-analysis', {
  id: 'task-1',
  type: 'quick-analysis',
  input: data,
  priority: 10,
  status: 'pending'
});

// Execute immediately
const result = await engine.executeImmediate('quick-analysis', data);
```

### Strange-Loops

Recursive agent patterns and self-referential reasoning.

```typescript
import { StrangeLoopsEngine, CommonPatterns } from './lib/frameworks/strange-loops';

const engine = new StrangeLoopsEngine();

// Register recursive pattern
engine.registerPattern({
  id: 'iterative-optimization',
  name: 'Iterative Optimization',
  baseCase: (input, context) => context.depth >= 5,
  recursiveCase: (input, context) => optimizeInput(input),
  combineResults: (results, context) => mergeResults(results),
  maxDepth: 10
});

// Execute with recursion
const result = await engine.executeRecursive(
  'iterative-optimization',
  initialData,
  async (input, depth) => {
    // Process at this depth
    return processedData;
  }
);

// Execute with reflection
const reflectiveResult = await engine.executeWithReflection(
  'iterative-optimization',
  initialData,
  executor,
  reflectionExecutor,
  {
    enabled: true,
    reflectionPrompt: 'Analyze your reasoning...',
    reflectionInterval: 3
  }
);
```

## Agent Swarm Orchestration

The Agent Swarm coordinates multiple agents working together.

```typescript
import { createFranchiseSwarm } from './orchestration';

const swarm = createFranchiseSwarm();

// Sequential execution
await swarm.executeSwarmTask({
  id: 'comprehensive-analysis',
  name: 'Comprehensive Franchise Analysis',
  agents: ['franchise-analysis', 'compliance', 'reporting'],
  coordination: 'sequential',
  input: franchiseData
});

// Parallel execution
await swarm.executeSwarmTask({
  id: 'multi-analysis',
  name: 'Parallel Analysis',
  agents: ['franchise-analysis', 'growth-planning'],
  coordination: 'parallel',
  input: franchiseData
});

// Conditional execution
await swarm.executeSwarmTask({
  id: 'conditional-flow',
  name: 'Conditional Analysis',
  agents: ['franchise-analysis', 'compliance', 'growth-planning'],
  coordination: 'conditional',
  input: franchiseData,
  condition: (results) => {
    const analysis = results.get('franchise-analysis');
    return analysis?.metadata?.needsGrowthPlan === true;
  }
});

// Message passing
await swarm.sendMessage(
  'franchise-analysis',
  'growth-planning',
  { analysisResults: data }
);
```

## Configuration

Configuration is managed through environment variables and Zod validation.

### Environment Variables

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek/deepseek-chat
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Agent Configuration
MAX_CONCURRENT_AGENTS=5
AGENT_TIMEOUT_MS=30000
ENABLE_AGENT_LOGGING=true

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_TOKENS_PER_MINUTE=100000

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=1000
MAX_RETRY_DELAY_MS=10000
RETRY_BACKOFF_MULTIPLIER=2

# Model Parameters
MODEL_TEMPERATURE=0.7
MODEL_MAX_TOKENS=4096
MODEL_TOP_P=1
MODEL_FREQUENCY_PENALTY=0
MODEL_PRESENCE_PENALTY=0
```

### Configuration Validation

```typescript
import { validateConfig, appConfig } from './config';

// Validate configuration
validateConfig();

// Access configuration
console.log(appConfig.openRouter.model);
console.log(appConfig.agents.maxConcurrent);
```

## Usage Examples

See `examples/` directory for complete examples:
- `basic-usage.ts`: Simple agent usage
- `workflow-example.ts`: Workflow orchestration
- `swarm-example.ts`: Multi-agent coordination
- `advanced-patterns.ts`: Advanced framework patterns

## API Reference

Complete API documentation available in `docs/API.md`.

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Error Handling

The system includes comprehensive error handling:

- Rate limit errors with automatic retry
- Network errors with exponential backoff
- Validation errors with detailed messages
- Agent-specific error recovery
- Timeout handling

## Performance Considerations

- **Rate Limiting**: Respects OpenRouter rate limits
- **Concurrency**: Configurable concurrent agent execution
- **Caching**: Automatic response caching where appropriate
- **Streaming**: Supports streaming for long responses
- **Queue Management**: Priority-based task queues

## Security

- API keys stored in environment variables
- No sensitive data in logs (when configured)
- Input validation on all agent inputs
- Rate limiting to prevent abuse

## License

MIT License - see LICENSE file for details
