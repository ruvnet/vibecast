# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## Coding Methodology Benchmark

This branch contains a comprehensive benchmark comparing traditional sequential code development with swarm-based concurrent development using Claude Flow.

### Quick Start

#### Running Benchmarks

```bash
# Install dependencies
npm install

# Run quick benchmark (2 scenarios, ~20 seconds)
npm run benchmark:quick

# Run full benchmark (5 scenarios, ~60 seconds)
npm run benchmark

# Run scalability benchmark (9 configurations, ~3 minutes)
npm run benchmark:scalability

# Run enhanced features benchmark
npm run benchmark:enhanced
```

#### Using Swarm Development (Claude Code Web)

```bash
# 1. Initialize swarm with optimal configuration
npx claude-flow@alpha init --force

# 2. Enable advanced features
npx claude-flow@alpha agent booster enable
npx claude-flow@alpha agent memory init

# 3. Use the workflow templates:
# - See docs/SWARM-DEVELOPMENT-PROMPT.md for complete guide
# - See docs/SWARM-PROMPT-BRIEF.md for quick copy-paste
# - See docs/SWARM-QUICK-REFERENCE.md for commands reference
```

### Results Summary

**The swarm approach won 5 out of 5 scenarios:**

- ⚡ **79.92% average speed improvement**
- 🚀 **399% average throughput increase**
- 💾 **Lower memory usage** (average -12 MB)
- 🔄 **5x concurrency** (5 agents vs sequential)
- ✅ **100% success rate** across all scenarios

**Scalability Analysis (2-50 agents tested):**

- 🏆 **Optimal: 5 agents** - Fastest execution (1.48s), highest throughput (10.14 t/s)
- 🎯 **Sweet Spot: 2-5 agents** - 100% utilization, best efficiency score
- ⚠️ **Diminishing Returns: 10+ agents** - Performance plateaus, throughput drops
- 🚫 **System Bottleneck: ~15 concurrent tasks** - Hard limit detected
- 📉 **20+ agents: No benefit** - Same performance, 60-70% agents idle

### Documentation

#### Analysis & Research
- **[ANALYSIS.md](./ANALYSIS.md)** - Comprehensive analysis of benchmark results
- **[SCALABILITY-ANALYSIS.md](./SCALABILITY-ANALYSIS.md)** - Swarm scalability study (2-50 agents)
- **[ADVANCED-FEATURES-ANALYSIS.md](./ADVANCED-FEATURES-ANALYSIS.md)** - Agent Booster, ReasoningBank, AgentDB analysis
- **[benchmark/README.md](./benchmark/README.md)** - Benchmark framework documentation
- **[benchmark/results/](./benchmark/results/)** - Detailed results and reports

#### Practical Usage Guides
- **[docs/SWARM-DEVELOPMENT-PROMPT.md](./docs/SWARM-DEVELOPMENT-PROMPT.md)** - Complete workflow template for Claude Code Web
- **[docs/SWARM-PROMPT-BRIEF.md](./docs/SWARM-PROMPT-BRIEF.md)** - Copy-paste ready brief version
- **[docs/SWARM-QUICK-REFERENCE.md](./docs/SWARM-QUICK-REFERENCE.md)** - Quick reference card

### Technologies

- Claude Flow v2.0.0 with swarm capabilities
- ReasoningBank for AI-powered memory
- Hive Mind collective intelligence
- SQLite databases (memory.db, hive.db)
- Multi-agent concurrent execution 
