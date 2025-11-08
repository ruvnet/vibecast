# Agent System Architecture

## Overview

The Vibecast Franchise Platform implements a sophisticated multi-agent system using OpenRouter's DeepSeek-Chat model. This document describes the technical architecture, design patterns, and integration points.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (initializeMultiAgentPlatform, Quick Start Examples)       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  Orchestration Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Agent Swarm                              │  │
│  │  - Task Distribution                                  │  │
│  │  - Sequential/Parallel/Conditional Execution          │  │
│  │  - Message Passing                                    │  │
│  │  - Resource Management                                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   Framework Layer                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Agentic-    │  │ Lean-        │  │ Strange-        │   │
│  │ Flow        │  │ Agentic      │  │ Loops           │   │
│  │             │  │              │  │                 │   │
│  │ Workflows   │  │ Lightweight  │  │ Recursive       │   │
│  │ Multi-step  │  │ Operations   │  │ Patterns        │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                     Agent Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Franchise   │  │   Growth     │  │  Territory   │     │
│  │  Analysis    │  │   Planning   │  │  Management  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Compliance   │  │  Reporting   │                        │
│  └──────────────┘  └──────────────┘                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           OpenRouter Client                           │  │
│  │  - DeepSeek-Chat Integration                          │  │
│  │  - Rate Limiting (P-Queue)                            │  │
│  │  - Retry Logic (P-Retry)                              │  │
│  │  - Streaming Support                                  │  │
│  │  - Error Handling                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Configuration System                         │  │
│  │  - Zod Validation                                      │  │
│  │  - Environment Variables                               │  │
│  │  - Model Parameters                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. OpenRouter Client

**Location**: `src/lib/openrouter-client.ts`

**Responsibilities**:
- Communicate with OpenRouter API
- Use DeepSeek-Chat model (configurable)
- Manage rate limits and quotas
- Handle retries with exponential backoff
- Support streaming responses
- Emit events for monitoring

**Key Features**:
```typescript
class OpenRouterClient extends EventEmitter {
  - complete(options): Promise<CompletionResult>
  - completeStream(options): AsyncGenerator<string>
  - getRateLimitStatus(): RateLimitStatus
  - destroy(): void
}
```

**Rate Limiting Strategy**:
- Uses P-Queue for concurrency control
- Tracks requests and tokens per minute
- Automatic reset every 60 seconds
- Configurable limits via environment

**Retry Strategy**:
- Uses P-Retry for automatic retries
- Exponential backoff (configurable multiplier)
- Max retries configurable
- Logs retry attempts

### 2. Base Agent

**Location**: `src/lib/base-agent.ts`

**Responsibilities**:
- Abstract base class for all agents
- Conversation history management
- Message sending to LLM
- Event emission for monitoring
- Common agent functionality

**Abstract Methods**:
```typescript
abstract class BaseAgent extends EventEmitter {
  protected abstract execute(input: any, context?: AgentContext): Promise<AgentResponse>
}
```

**Provided Methods**:
- `processTask()`: Main task processing entry point
- `sendMessage()`: Send message to LLM
- `sendMessageStream()`: Streaming message
- `clearHistory()`: Clear conversation history
- `getInfo()`: Get agent metadata
- `getHistory()`: Get conversation history

### 3. Specialized Agents

Each specialized agent extends BaseAgent and implements domain-specific logic:

#### FranchiseAnalysisAgent
- **Temperature**: 0.3 (more deterministic)
- **Max Tokens**: 2048
- **Specialization**: Performance analysis, trend identification, risk assessment
- **Input Validation**: Zod schema for type safety

#### GrowthPlanningAgent
- **Temperature**: 0.4 (balanced creativity)
- **Max Tokens**: 2048
- **Specialization**: Strategic planning, ROI analysis, market evaluation
- **Scenario Generation**: Conservative, moderate, aggressive plans

#### TerritoryAgent
- **Temperature**: 0.3 (deterministic)
- **Max Tokens**: 2048
- **Specialization**: Geographic optimization, conflict resolution
- **Calculations**: Territory metrics, density analysis

#### ComplianceAgent
- **Temperature**: 0.2 (very deterministic)
- **Max Tokens**: 2048
- **Specialization**: Regulatory compliance, standards enforcement
- **Compliance Types**: Regulatory, operational, financial, quality, safety

#### ReportingAgent
- **Temperature**: 0.4 (creative presentation)
- **Max Tokens**: 3072 (longer reports)
- **Specialization**: Report generation, data visualization descriptions
- **Report Types**: Executive, dashboard, financial, trend, comparative

### 4. Framework Integrations

#### Agentic-Flow Engine

**Purpose**: Multi-step workflow orchestration

**Key Concepts**:
- **Workflows**: Define multi-step processes
- **Steps**: Individual workflow steps with conditions
- **Context**: Shared state across workflow
- **Retries**: Per-step retry configuration

**Example Workflow**:
```typescript
{
  id: 'franchise-evaluation',
  steps: [
    {
      id: 'analysis',
      agentRole: 'franchise-analysis',
      input: (context) => context.data.franchises,
      output: 'analysisResult'
    },
    {
      id: 'compliance',
      agentRole: 'compliance',
      input: (context) => context.data.franchises,
      condition: (context) => context.results.analysisResult.needsReview,
      output: 'complianceResult'
    }
  ]
}
```

#### Lean-Agentic Engine

**Purpose**: Lightweight, fast agent operations

**Key Concepts**:
- **Priority Queues**: High, normal, low priority
- **Immediate Execution**: Bypass queue for urgent tasks
- **Lightweight Handlers**: Minimal overhead
- **Timeout Management**: Per-agent timeout configuration

**Use Cases**:
- Quick health checks
- Real-time alerts
- Fast calculations
- Status updates

#### Strange-Loops Engine

**Purpose**: Recursive agent patterns and self-reflection

**Key Concepts**:
- **Recursive Patterns**: Base case, recursive case, combine
- **Max Depth**: Prevent infinite recursion
- **Reflection**: Periodic self-assessment
- **Fixed-Point Iteration**: Convergence testing

**Common Patterns**:
- Divide and conquer
- Iterative refinement
- Self-improving loops
- Convergent optimization

### 5. Agent Swarm Orchestration

**Location**: `src/orchestration/agent-swarm.ts`

**Coordination Modes**:

1. **Sequential**: Agents execute one after another
   - Results passed to next agent
   - Good for pipelines
   - Each agent builds on previous results

2. **Parallel**: Agents execute simultaneously
   - Independent processing
   - Faster execution
   - Combined results

3. **Conditional**: Agents execute based on conditions
   - Dynamic workflow
   - Condition evaluated after each agent
   - Adaptive processing

**Message Passing**:
- Direct agent-to-agent communication
- Asynchronous message delivery
- Response tracking
- Event emission for monitoring

## Configuration System

**Location**: `src/config/index.ts`

**Configuration Schema**:
```typescript
{
  openRouter: {
    apiKey: string,
    baseUrl: string,
    model: string
  },
  agents: {
    maxConcurrent: number,
    timeoutMs: number,
    enableLogging: boolean
  },
  rateLimiting: {
    requestsPerMinute: number,
    tokensPerMinute: number
  },
  retry: {
    maxRetries: number,
    initialDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number
  },
  modelDefaults: {
    temperature: number,
    maxTokens: number,
    topP: number,
    frequencyPenalty: number,
    presencePenalty: number
  }
}
```

**Validation**:
- Zod schema validation
- Type-safe configuration
- Clear error messages
- Default values

## Event System

All components emit events for monitoring and debugging:

**OpenRouter Client Events**:
- `request-start`
- `request-complete`
- `request-error`
- `stream-chunk`
- `rate-limit-reset`

**Agent Events**:
- `agent-initialized`
- `task-start`
- `task-complete`
- `task-error`
- `history-cleared`

**Swarm Events**:
- `swarm-start`
- `swarm-complete`
- `swarm-error`
- `agent-assigned`
- `agent-complete`
- `agent-error`
- `agent-skipped`
- `message-sent`
- `message-received`

**Framework Events**:
- `workflow-start/complete/error`
- `step-start/complete/error/skipped`
- `task-queued/start/complete/error`
- `loop-start/complete/iteration`
- `reflection-start/complete`

## Error Handling Strategy

1. **Validation Errors**: Caught at input with Zod
2. **API Errors**: Retry with exponential backoff
3. **Rate Limit Errors**: Queue management
4. **Timeout Errors**: Configurable timeouts
5. **Agent Errors**: Isolated, logged, reported to swarm

## Performance Optimization

1. **Connection Pooling**: Reuse HTTP connections
2. **Rate Limiting**: Prevent API throttling
3. **Concurrent Execution**: Parallel agent processing
4. **Streaming**: Reduce latency for long responses
5. **Caching**: Results cached where appropriate
6. **Queue Management**: Priority-based processing

## Security Considerations

1. **API Keys**: Environment variables only
2. **Input Validation**: Zod schemas on all inputs
3. **Output Sanitization**: No sensitive data in logs
4. **Rate Limiting**: Prevent abuse
5. **Timeout Protection**: Prevent hanging requests

## Scalability

The system is designed to scale:

1. **Horizontal**: Multiple swarm instances
2. **Vertical**: Configurable concurrency
3. **Framework Flexibility**: Choose appropriate framework per use case
4. **Stateless Agents**: Easy to replicate
5. **Event-Driven**: Loosely coupled components

## Testing Strategy

1. **Unit Tests**: Individual agent logic
2. **Integration Tests**: Agent coordination
3. **Framework Tests**: Pattern validation
4. **E2E Tests**: Complete workflows
5. **Mock API**: No real API calls in tests

## Future Enhancements

1. **Agent Memory**: Persistent conversation history
2. **Learning**: Agent improvement over time
3. **Multi-Model**: Support for multiple LLMs
4. **Distributed**: Multi-server coordination
5. **Monitoring**: Real-time dashboard
6. **A/B Testing**: Compare agent strategies

## Dependencies

- **openai**: OpenRouter API client
- **zod**: Schema validation
- **p-queue**: Rate limiting and concurrency
- **p-retry**: Retry logic
- **nanoid**: Unique ID generation
- **eventemitter3**: Event system
- **dotenv**: Configuration management

## Model Configuration

**Current Model**: `deepseek/deepseek-chat`

**Alternative Models** (if needed):
- `openai/gpt-4-turbo`
- `anthropic/claude-3-opus`
- `google/gemini-pro`

**Model Selection Criteria**:
- Response quality
- Speed
- Cost
- Token limits
- Availability

## Conclusion

The multi-agent system provides a robust, scalable, and flexible framework for franchise management operations. The modular architecture allows for easy extension, testing, and maintenance while providing powerful AI-driven capabilities through OpenRouter's DeepSeek-Chat model.
