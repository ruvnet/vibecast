# 🧠 Vibecast - Self-Learning Research System

Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## Current Branch: Agentic Research System

A production-ready self-learning research system powered by:
- 🤖 **Agentic-Flow** - Multi-agent orchestration with 213 MCP tools
- 🧠 **AgentDB** - Vector-based memory with reflexion learning
- 🚀 **Kimi K2** - 1T parameter MoE model via OpenRouter
- 🐝 **Research Swarm** - Collaborative agent intelligence

## 🎯 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# 3. Run your first research
npm start -- research "Artificial Intelligence" -q "Latest trends in AI agents"

# 4. Try interactive mode
npm run dev
```

## 📖 Documentation

See [RESEARCH_SYSTEM.md](./RESEARCH_SYSTEM.md) for comprehensive documentation.

## ✨ Features

- **Multi-Agent Swarm**: 5+ specialized agents working together
- **Three Research Strategies**: Parallel, Sequential, Hierarchical
- **Self-Learning**: Iterative improvement with feedback loops
- **Persistent Memory**: Vector-based semantic search
- **Reflexion**: Agents critique and improve their own work
- **Batch Processing**: Research multiple topics simultaneously

## 🎬 Usage Examples

### Single Topic Research
```bash
npm start -- research "Quantum Computing" --feedback-loop
```

### Batch Research
```bash
npm start -- batch "AI Agents" "Machine Learning" "Neural Networks"
```

### Interactive Mode
```bash
npm run dev
```

### View Statistics
```bash
npm run stats
```

## 🏗️ Project Structure

```
src/
├── agents/          # Research agents and swarm coordination
├── memory/          # AgentDB-style memory system
├── config/          # Configuration for OpenRouter & research
├── research-system.ts  # Main orchestrator
└── cli.ts           # Command-line interface
```

## 🔧 Tech Stack

- TypeScript
- OpenAI SDK (OpenRouter)
- Agentic-Flow
- Commander (CLI)
- Node.js

## 📊 How It Works

1. **Initialize Swarm**: Create multiple specialized agents
2. **Execute Research**: Choose parallel, sequential, or hierarchical strategy
3. **Store in Memory**: Save results with vector embeddings
4. **Learn & Improve**: Use reflexion and feedback loops
5. **Export Results**: Generate markdown or JSON reports

## 🌟 Powered By

- [Agentic-Flow](https://github.com/ruvnet/agentic-flow) - Agent orchestration
- [Kimi K2](https://openrouter.ai/moonshotai/kimi-k2) - Trillion-parameter MoE model
- [OpenRouter](https://openrouter.ai) - Multi-model API platform

## 📝 License

MIT

---

Part of the Vibecast weekly live coding series by rUv 
