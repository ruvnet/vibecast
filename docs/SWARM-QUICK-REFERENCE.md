# Swarm Development Quick Reference Card

## 🚀 Optimal Configuration (Benchmark-Proven)

| Setting | Value | Impact |
|---------|-------|--------|
| **Agents** | 5 (1 queen + 4 workers) | 79.92% faster |
| **Max Concurrent** | 6 tasks | 100% utilization |
| **Agent Booster** | Enabled | +70% task speed |
| **ReasoningBank** | Enabled | +46% over time |
| **Throughput** | 10+ tasks/sec | 399% increase |

## 📋 Three-Phase Workflow

### 1️⃣ Research (Goal Agents)
```bash
# Analyze requirements, design architecture
# 3-5 goal-oriented agents
```
Tasks: Requirements → Patterns → Architecture → Tech Stack → Risks

### 2️⃣ Development (Swarm)
```bash
npx claude-flow@alpha agent booster enable
npx claude-flow@alpha agent memory init
# 5 agents, 6 concurrent tasks
```
Tasks: Core → API → Data → Frontend → Integration → Docs

### 3️⃣ Testing (QA Swarm)
```bash
# 5 specialized testing agents
```
Tasks: Unit → Integration → E2E → Performance → Security → Review

## ⚡ Quick Commands

```bash
# Initialize swarm
npx claude-flow@alpha init --force

# Enable advanced features
npx claude-flow@alpha agent booster enable
npx claude-flow@alpha agent memory init

# Optional: AgentDB (15% improvement for VCS workflows)
npx agentic-jujutsu init

# Check status
npx claude-flow@alpha swarm status
npx claude-flow@alpha agent list
```

## ✅ DO / ❌ DON'T

### ✅ DO
- Use 5 agents for optimal speed
- Enable Agent Booster + ReasoningBank
- Aim for 3-5 tasks per agent
- Target 80%+ utilization
- Use memory.db for persistence

### ❌ DON'T
- Use 20+ agents (no benefit)
- Exceed ~15 concurrent tasks (system limit)
- Disable reasoning bank (-46% efficiency)
- Over-provision for small tasks

## 🎯 When to Scale

| Task Count | Agents | Concurrent | Expected Duration |
|------------|--------|------------|-------------------|
| < 10 tasks | 2-3 | 4 | ~1.5s |
| 10-30 tasks | 5 | 6 | ~1.5s |
| 30-60 tasks | 10 | 12 | ~3.0s |
| 60+ tasks | 15 | 18 | ~5.0s |

## 📊 Performance Metrics

Monitor these:
- **Duration**: Target < 2s for 15 tasks
- **Throughput**: Target > 10 tasks/sec
- **Utilization**: Target > 80%
- **Concurrency**: Watch for 15-task ceiling

## 🔧 Troubleshooting

**Problem**: Low utilization (< 70%)
**Solution**: Reduce agent count

**Problem**: Tasks waiting
**Solution**: You hit ~15 concurrent limit (expected)

**Problem**: Slower than expected
**Solution**: Enable Agent Booster + ReasoningBank

---

**Source**: vibecast benchmarks (2025-11-22)
**Full Analysis**: ANALYSIS.md, SCALABILITY-ANALYSIS.md, ADVANCED-FEATURES-ANALYSIS.md
