# VibeCast

AI-powered entertainment discovery platform that solves the **45-minute decision problem** - the time people waste every night deciding what to watch.

Built for the **Agentics Foundation TV5 Hackathon** (Entertainment Discovery Track).

## The Problem

Every night, millions of people spend up to 45 minutes scrolling through streaming services trying to decide what to watch. With content fragmented across Netflix, Amazon Prime, Disney+, Hulu, and more, finding the perfect match for your mood is harder than ever.

## The Solution

VibeCast uses a **multi-agent AI swarm** powered by:
- **AgenticFlow** - Production AI orchestration with 4 specialized agents
- **RuVector** - Vector embeddings for semantic content understanding
- Natural language **conversational discovery**

### VibeCast Pro Features
- **Mood Analyst Agent** - Understands emotional context from natural language
- **Semantic Curator Agent** - Deep content matching using vector embeddings
- **Trend Spotter Agent** - Identifies culturally relevant and trending content
- **Personalization Agent** - Learns individual taste patterns
- **Swarm Orchestrator** - Coordinates agents for optimal recommendations

## Quick Start

```bash
# Install dependencies
npm install

# Run the basic demo
npm start

# Run VibeCast Pro (multi-agent) demo
npm run start:pro

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
│       └── orchestrator.ts        # Agent coordination
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
└── demo-pro.ts                    # Multi-agent demo
```

## Key Technologies

| Technology | Purpose |
|-----------|---------|
| **AgenticFlow** | Multi-agent orchestration framework |
| **RuVector** | Vector embeddings & semantic search |
| **TypeScript** | Type-safe development |
| **Zod** | Runtime validation & schema definition |
| **Jest** | Testing framework (121 tests) |

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
| `npm test` | Run 121 tests |
| `npm run test:coverage` | Coverage report |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint check |

## Test Coverage

```
Tests:       121 passed, 121 total
Test Suites: 7 passed, 7 total

Key Coverage:
- SwarmOrchestrator: Full multi-agent testing
- VectorStore: Semantic embedding tests
- All Agents: Individual agent tests
```

## Hackathon Entry

**Track**: Entertainment Discovery
**Challenge**: Solve the 45-minute decision problem
**Solution**: Multi-agent AI swarm with semantic understanding

### Innovation Highlights
- **Semantic Vector Matching** - Goes beyond keywords to understand meaning
- **Agent Consensus** - Multiple AI perspectives for better recommendations
- **Conversational Interface** - Natural language queries
- **Explainable AI** - Clear reasoning for every recommendation

## License

MIT

---

Built with ❤️ for the **Agentics Foundation TV5 Hackathon**
Powered by **AgenticFlow** + **RuVector**
