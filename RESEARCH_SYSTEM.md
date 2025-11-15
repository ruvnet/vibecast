# Vibecast Self-Learning Research System

A production-ready AI research system that leverages multiple advanced technologies to create an autonomous, self-improving research platform.

## 🚀 Features

### Core Technologies

1. **Agentic-Flow** - Production-ready AI agent orchestration platform
   - 66 specialized agents
   - 213 MCP tools
   - Neural networks with memory persistence
   - Support for multiple LLM providers

2. **AgentDB Concepts** - Vector-based memory system
   - Semantic search capabilities
   - Reflexion memory with self-critique
   - Skill library with auto-consolidation
   - 96x-164x performance boost

3. **Kimi K2 (OpenRouter)** - Trillion-parameter MoE model
   - 1T total parameters, 32B active per forward pass
   - Up to 256K context window
   - Optimized for reasoning, coding, and tool use
   - Superior performance on agentic tasks

### Research Capabilities

- **Multi-Agent Swarm Intelligence**: Coordinate multiple specialized agents (researcher, analyst, synthesizer, critic, explorer)
- **Three Research Strategies**:
  - **Parallel**: All agents research simultaneously
  - **Sequential**: Agents build on each other's findings
  - **Hierarchical**: Deep exploration with sub-task generation
- **Self-Learning Feedback Loop**: Iteratively improve research quality until target confidence is reached
- **Reflexion Memory**: Agents critique their own work and learn from mistakes
- **Persistent Memory**: Vector-based semantic search across past research
- **Batch Processing**: Research multiple topics in parallel

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd vibecast

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# OpenRouter API Key (required)
OPENROUTER_API_KEY=your_api_key_here

# Model Configuration
KIMI_MODEL=moonshotai/kimi-k2-0905

# Research System Configuration
MAX_RESEARCH_DEPTH=3
MAX_CONCURRENT_AGENTS=5
MEMORY_RETENTION_DAYS=30

# Agent Database Configuration
AGENTDB_PATH=./data/agentdb
ENABLE_VECTOR_SEARCH=true
ENABLE_REFLEXION_MEMORY=true

# Logging
LOG_LEVEL=info
```

## 🎯 Usage

### CLI Commands

#### 1. Single Research Topic

```bash
# Basic research
npm run research "Artificial Intelligence" -- -q "Latest trends in AI agents"

# With custom strategy
npm run research "Quantum Computing" -- -s parallel -a 3

# With self-learning feedback loop
npm run research "Climate Change" -- --feedback-loop -c 0.85
```

#### 2. Interactive Mode

```bash
npm run dev
# or
npm start -- interactive
```

#### 3. Batch Research

```bash
npm start -- batch "AI Agents" "Machine Learning" "Neural Networks"
```

#### 4. View Statistics

```bash
npm run stats
```

#### 5. Export Research History

```bash
npm start -- export -f markdown
npm start -- export -f json
```

### Programmatic Usage

```typescript
import { ResearchSystem } from './src/research-system';

// Initialize the system
const system = new ResearchSystem({
  agentCount: 5,
  saveResults: true,
});

// Single research task
const result = await system.research(
  'Artificial Intelligence',
  'Latest developments in multi-agent systems',
  'hierarchical'
);

// Self-learning research with feedback loop
const improvedResult = await system.researchWithFeedbackLoop(
  'Quantum Computing',
  'Quantum algorithms for machine learning',
  0.85  // target confidence
);

// Batch research
const results = await system.parallelResearch([
  'AI Safety',
  'AGI Development',
  'Ethical AI'
]);

// Provide feedback to improve future research
await system.provideFeedback(
  result.taskId,
  'Great insights on multi-agent coordination',
  5
);
```

## 🏗️ Architecture

```
vibecast/
├── src/
│   ├── agents/
│   │   ├── research-agent.ts      # Individual agent with Kimi K2
│   │   └── research-swarm.ts      # Multi-agent coordination
│   ├── memory/
│   │   └── agent-memory.ts        # AgentDB-style memory system
│   ├── config/
│   │   ├── openrouter.ts          # OpenRouter/Kimi K2 config
│   │   └── research.ts            # Research system config
│   ├── research-system.ts         # Main orchestrator
│   ├── cli.ts                     # Command-line interface
│   └── index.ts                   # Public API exports
├── data/
│   ├── agentdb/                   # Memory storage
│   └── results/                   # Research results
├── .env                           # Environment configuration
└── package.json
```

## 🧠 How It Works

### 1. Agent Initialization
- System creates a swarm of specialized agents (researcher, analyst, synthesizer, critic, explorer)
- Each agent has access to shared memory (AgentDB-style)
- Agents use Kimi K2 via OpenRouter for reasoning and research

### 2. Research Execution
Depending on the strategy:

**Hierarchical** (default):
1. Primary agent conducts initial research
2. System generates sub-tasks based on findings
3. Secondary agents explore sub-tasks in parallel
4. Optional third-level deep dive on interesting findings

**Parallel**:
- All agents research the same topic simultaneously
- Results are aggregated and synthesized

**Sequential**:
- Agents work one after another
- Each agent builds on previous agent's findings

### 3. Memory & Learning

- **Memory Storage**: All research is stored in vector-based memory
- **Semantic Search**: Find relevant past research for context
- **Reflexion**: Low-confidence results trigger self-critique
- **Continuous Improvement**: System learns from feedback and past research

### 4. Self-Learning Feedback Loop

When enabled, the system:
1. Conducts initial research
2. Evaluates confidence level
3. If below threshold, refines query based on insights
4. Repeats until target confidence is reached (max 3 iterations)

## 📊 Output Format

### SwarmResult Structure
```typescript
{
  taskId: string;
  topic: string;
  query: string;
  aggregatedFindings: string;      // Synthesized markdown report
  allInsights: string[];           // Unique insights from all agents
  confidence: number;              // 0-1 score
  agentResults: ResearchResult[];  // Individual agent outputs
  duration: number;                // Milliseconds
  timestamp: Date;
}
```

## 🔧 Advanced Features

### Custom Agent Types

```typescript
import { ResearchAgent } from './src/agents/research-agent';
import { AgentMemory } from './src/memory/agent-memory';

const memory = new AgentMemory();
const specialist = new ResearchAgent('specialist', memory);

const result = await specialist.research({
  id: 'task-1',
  topic: 'Specialized Topic',
  query: 'Deep dive into specific area',
  depth: 1
});
```

### Memory Statistics

```typescript
const stats = system.getSystemStats();
console.log(stats.memory.totalMemories);
console.log(stats.memory.averageConfidence);
console.log(stats.recentResearch);
```

### Export Options

- **Markdown**: Human-readable research reports
- **JSON**: Machine-readable structured data

## 🌟 Use Cases

1. **Research & Development**: Explore emerging technologies and trends
2. **Literature Review**: Synthesize information across multiple domains
3. **Competitive Analysis**: Gather and analyze market intelligence
4. **Knowledge Base Building**: Create comprehensive knowledge repositories
5. **Learning & Education**: Deep dive into complex topics
6. **Content Creation**: Generate insights for articles and reports

## 🚀 Performance

- **Parallel Processing**: Research multiple topics simultaneously
- **Semantic Caching**: Reuse relevant past research for context
- **Optimized Token Usage**: 256K context window with Kimi K2
- **Fast Inference**: MoE architecture activates only 32B parameters per call

## 🔐 Security & Privacy

- API keys stored in environment variables
- No data sent to third parties except OpenRouter
- Local memory storage in `./data/`
- Results saved locally

## 📈 Future Enhancements

- [ ] Web interface for research visualization
- [ ] Integration with external knowledge bases
- [ ] Advanced vector embeddings for better semantic search
- [ ] Multi-modal research (images, PDFs, web scraping)
- [ ] Collaborative research with human-in-the-loop
- [ ] Custom agent personas and specializations
- [ ] Real-time research streaming
- [ ] Research quality scoring and validation

## 🤝 Contributing

This is part of the Vibecast weekly live coding sessions. Check different branches for weekly progress!

## 📝 License

MIT

## 🙏 Acknowledgments

- **Agentic-Flow**: @ruvnet's production-ready agent orchestration platform
- **Kimi K2**: Moonshot AI's trillion-parameter model
- **OpenRouter**: Multi-model API platform
- **Claude Code**: Development environment

---

Built with ❤️ for the Vibecast community
