# VibeCast

AI-powered entertainment discovery platform that solves the **45-minute decision problem** - the time people waste every night deciding what to watch.

Built for the **Agentics Foundation TV5 Hackathon** (Entertainment Discovery Track).

## The Problem

Every night, millions of people spend up to 45 minutes scrolling through streaming services trying to decide what to watch. With content fragmented across Netflix, Amazon Prime, Disney+, Hulu, and more, finding the perfect match for your mood is harder than ever.

## The Solution

VibeCast uses a **multi-agent AI swarm** powered by:
- **AgenticFlow** - Production AI orchestration with 4 specialized agents
- **RuVector** - Vector embeddings for semantic content understanding
- **MAKER Framework** - Error correction with voting-based consensus (arXiv:2511.09030)
- Natural language **conversational discovery**

### VibeCast Pro Features
- **Mood Analyst Agent** - Understands emotional context from natural language
- **Semantic Curator Agent** - Deep content matching using vector embeddings
- **Trend Spotter Agent** - Identifies culturally relevant and trending content
- **Personalization Agent** - Learns individual taste patterns
- **Swarm Orchestrator** - Coordinates agents for optimal recommendations
- **MAKER-Enhanced Orchestrator** - Error correction with First-to-Ahead-by-k voting

## Quick Start

```bash
# Install dependencies
npm install

# Run the basic demo
npm start

# Run VibeCast Pro (multi-agent) demo
npm run start:pro

# Run MAKER Framework benchmark
npm run benchmark

# Run tests
npm test
```

## VibeCast Pro Demo

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    🚀 PRO - Multi-Agent Discovery 🚀                      ║
║         Powered by AgenticFlow + RuVector | TV5 Hackathon                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

🧠 Building semantic vector index...
   ✓ Indexed 10 content items

🤖 Agent Swarm Status:
   • Mood Analyst [idle]
   • Semantic Curator [idle]
   • Trend Spotter [idle]
   • Personalization Expert [idle]

🎯 MULTI-AGENT DISCOVERY
Query: "I want something mind-bending and exciting, not too long"

⚡ Orchestration complete in 6ms

📈 Agent Contributions:
   mood-analyst         [████                ] 18.2%
   semantic-curator     [████████            ] 42.0%
   trend-spotter        [██                  ] 9.8%
   personalization      [██████              ] 30.1%

🎬 TOP RECOMMENDATIONS:

⭐ 1. "Cosmic Mysteries"
   Score: 66.3% | Consensus: moderate
   Sources: Mood Analyst, Semantic Curator, Trend Spotter, Personalization Expert
```

## Architecture

```
src/
├── agents/
│   ├── recommendation-agent.ts    # Basic recommendation engine
│   └── swarm/                     # Multi-agent swarm
│       ├── base-agent.ts          # Agent interface
│       ├── mood-analyst.ts        # Emotional understanding
│       ├── semantic-curator.ts    # Vector-based matching
│       ├── trend-spotter.ts       # Cultural relevance
│       ├── personalization-agent.ts # Individual taste
│       ├── orchestrator.ts        # Agent coordination
│       └── maker-orchestrator.ts  # MAKER-enhanced orchestrator
├── maker/                         # MAKER Framework (arXiv:2511.09030)
│   ├── types.ts                   # MAKER types & formulas
│   ├── voting.ts                  # First-to-Ahead-by-k voting
│   ├── microagent.ts              # Microagent executor
│   └── executor.ts                # MAKER pipeline executor
├── benchmark/                     # Performance benchmarking
│   └── benchmark.ts               # Benchmark runner & analysis
├── embeddings/
│   └── vector-store.ts            # Semantic vector embeddings
├── discovery/
│   └── conversational.ts          # Natural language interface
├── services/
│   ├── content-catalog.ts         # Content management
│   └── user-profile.ts            # User preferences
├── types/                         # TypeScript schemas (Zod)
├── utils/                         # Scoring & validation
├── index.ts                       # Basic demo
├── demo-pro.ts                    # Multi-agent demo
└── demo-maker.ts                  # MAKER benchmark demo
```

## Key Technologies

| Technology | Purpose |
|-----------|---------|
| **AgenticFlow** | Multi-agent orchestration framework |
| **RuVector** | Vector embeddings & semantic search |
| **MAKER Framework** | Error correction via First-to-Ahead-by-k voting |
| **TypeScript** | Type-safe development |
| **Zod** | Runtime validation & schema definition |
| **Jest** | Testing framework (164 tests) |

## Multi-Agent System

### How It Works

1. **User Query** → Natural language input ("Something exciting for date night")
2. **Context Parsing** → Extracts mood, social context, constraints
3. **Parallel Processing** → All 4 agents analyze simultaneously
4. **Score Aggregation** → Weighted combination with confidence
5. **Consensus Building** → Strong/moderate/weak consensus levels
6. **Explanation** → Human-readable reasoning for each pick

### Agent Weights (Tunable)
```typescript
{
  moodAnalyst: 0.30,      // Emotional matching
  semanticCurator: 0.25,  // Deep content understanding
  trendSpotter: 0.15,     // Cultural relevance
  personalization: 0.30   // Individual preferences
}
```

## API Usage

### Basic Usage
```typescript
import { createRecommendationAgent, getUserProfileService } from 'vibecast';

const userService = getUserProfileService();
const user = userService.create('Alex');
const agent = createRecommendationAgent(user.id);

const picks = agent.getRecommendations({
  mood: 'exciting',
  limit: 5,
  excludeWatched: true
});
```

### Pro Usage (Multi-Agent)
```typescript
import { getSwarmOrchestrator, getConversationalDiscovery } from 'vibecast';

// Orchestrated discovery
const orchestrator = getSwarmOrchestrator();
const result = await orchestrator.orchestrate({
  userId: user.id,
  query: 'Something mind-bending for tonight',
  signals: { socialContext: 'alone', timeOfDay: 'night' }
}, 5);

// Conversational discovery
const discovery = getConversationalDiscovery();
const response = await discovery.quickDiscover(
  user.id,
  'What should I watch with friends?'
);
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Basic demo |
| `npm run start:pro` | Multi-agent Pro demo |
| `npm run benchmark` | MAKER Framework benchmark |
| `npm test` | Run 164 tests |
| `npm run test:coverage` | Coverage report |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint check |

## Test Coverage

```
Tests:       164 passed, 164 total
Test Suites: 10 passed, 10 total

Key Coverage:
- SwarmOrchestrator: Full multi-agent testing
- VectorStore: Semantic embedding tests
- MAKER Framework: Voting, microagent, executor tests
- Benchmark: Performance measurement tests
- All Agents: Individual agent tests
```

## MAKER Framework Integration

VibeCast integrates concepts from the paper ["Solving a Million-Step LLM Task with Zero Errors"](https://arxiv.org/abs/2511.09030) by Meyerson et al.

### Key Concepts

- **First-to-Ahead-by-k Voting**: Error correction through consensus voting
- **Microagent Architecture**: Focused single-step execution with validation
- **Red-Flagging**: Anomaly detection for confused states
- **Theoretical Guarantees**: Formula for full-task success probability

### Success Probability Formula

```
p_full = (1 + ((1-p)/p)^k)^(-s/m)

Where:
- p = per-step accuracy
- k = voting threshold
- s = total steps
- m = steps per agent
```

### Benchmark Results

```
Scenario                    k=1      k=3      k=5      k=7
10 steps, p=0.7              2.8%    46.9%    86.6%    97.4%
100 steps, p=0.7             0.0%     0.1%    23.8%    76.7%
10 steps, p=0.9             34.9%    98.6%   100.0%   100.0%
```

## Hackathon Entry

**Track**: Entertainment Discovery
**Challenge**: Solve the 45-minute decision problem
**Solution**: Multi-agent AI swarm with semantic understanding

### Innovation Highlights
- **Semantic Vector Matching** - Goes beyond keywords to understand meaning
- **Agent Consensus** - Multiple AI perspectives for better recommendations
- **MAKER Error Correction** - Voting-based reliability guarantees
- **Conversational Interface** - Natural language queries
- **Explainable AI** - Clear reasoning for every recommendation
- **Benchmarked Performance** - Theoretical + empirical validation

## License

MIT

---

Built with ❤️ for the **Agentics Foundation TV5 Hackathon**
Powered by **AgenticFlow** + **RuVector**
