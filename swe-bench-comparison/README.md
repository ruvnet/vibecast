# SWE-Bench Comparison: Baseline vs Agentic-Enhanced

Comprehensive benchmarking framework comparing OpenRouter LLM models with and without agentic enhancements (agentic-flow/agentdb).

## 🎯 Purpose

This project provides an empirical comparison of LLM performance on software engineering tasks, measuring the impact of agentic features like:

- **AgentDB**: Persistent memory with causal reasoning
- **ReasoningBank**: Pattern learning and semantic search
- **Reflexion Memory**: Self-correction and error learning
- **Agent Booster**: Automatic code optimization (352x faster)

## 📊 What This Measures

### Baseline Mode (Control)
- Direct API calls to OpenRouter
- No memory or learning systems
- Each task treated independently
- No self-correction or reflexion

### Agentic Mode (Enhanced)
- **Memory System**: AgentDB stores successful patterns
- **Learning**: ReasoningBank learns from past attempts
- **Reflexion**: Automatically retries and improves borderline solutions
- **Context**: Causal reasoning provides task context
- **Optimization**: Agent Booster accelerates code operations

### Key Metrics
1. **Success Rate**: % of tasks solved correctly
2. **Solution Quality**: Average score (0-100%)
3. **Execution Time**: Time per task
4. **Token Usage**: API token consumption
5. **Learning Impact**: Memory hits, reflexion improvements

## 🚀 Quick Start

### Prerequisites

```bash
# Required: OpenRouter API key
export OPENROUTER_API_KEY=sk-or-v1-...

# Get your key at: https://openrouter.ai/keys
```

### Installation

```bash
cd swe-bench-comparison
npm install
```

### Run Comparison

```bash
# Quick test with one model
npm run compare:quick

# Full test with multiple models
npm run compare:full

# Or specify custom models
node comparison-runner.js deepseek/deepseek-chat anthropic/claude-3.5-sonnet
```

### Run Individual Modes

```bash
# Baseline only (no agentic features)
npm run baseline deepseek/deepseek-chat

# Agentic only (with enhancements)
npm run agentic deepseek/deepseek-chat
```

## 📁 Project Structure

```
swe-bench-comparison/
├── swe-bench-tasks.json       # 10 coding tasks (easy/medium/hard)
├── baseline-runner.js         # Baseline test runner
├── agentic-runner.js          # Agentic-enhanced test runner
├── comparison-runner.js       # Full comparison framework
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## 🧪 Test Tasks

The benchmark includes 10 real-world coding tasks:

| ID | Title | Difficulty | Category |
|----|-------|-----------|----------|
| task_001 | Fix string concatenation bug | Easy | syntax_error |
| task_002 | Implement missing error handling | Medium | error_handling |
| task_003 | Optimize array filtering performance | Hard | performance |
| task_004 | Fix async/await race condition | Hard | async_optimization |
| task_005 | Add input validation | Medium | validation |
| task_006 | Fix memory leak in event listeners | Hard | memory_management |
| task_007 | Implement caching mechanism | Medium | caching |
| task_008 | Fix SQL injection vulnerability | Hard | security |
| task_009 | Refactor nested callbacks | Medium | refactoring |
| task_010 | Add TypeScript type definitions | Easy | types |

Each task includes:
- **Description**: What needs to be fixed
- **Current Code**: Buggy/incomplete code
- **Expected Fix**: Reference solution
- **Test Case**: Validation criteria
- **Category & Difficulty**: Classification

## 📈 Interpreting Results

### Sample Output

```
==========================================================================
FINAL COMPARISON REPORT
==========================================================================

📊 Overall Statistics:
   • Average Success Rate Improvement: +15.3%
   • Average Score Improvement: +22.8%
   • Average Time Change: +18.5%
   • Models with Improvement: 3/3 (100%)
   • Total Memory Hits: 12
   • Total Reflexion Applied: 8

🔍 Per-Model Results:

   deepseek/deepseek-chat:
      Success Rate: 60% → 80% (+20%)
      Avg Score: 65% → 82% (+17%)
      Agentic Features: 4 memory hits, 3 reflexion applied

💡 Conclusions:

   1. ✅ Agentic enhancements improved success rate by an average of 15.3%
   2. ✅ Solution quality improved by 22.8% on average
   3. ⚠️ Agentic mode increased execution time by 18.5% (due to reflexion)
   4. 🧠 Memory system was utilized 12 times across all tests
   5. 🔄 Reflexion system improved solutions 8 times
   6. 🎯 STRONG EVIDENCE: Agentic enhancements improved performance in 100% of models
```

### What to Look For

**✅ Positive Indicators:**
- Success rate improvement > 10%
- Score improvement > 15%
- Memory hits > 0 (system is learning)
- Reflexion applied > 0 (self-correction working)

**⚠️ Trade-offs:**
- Execution time may increase 10-30% (reflexion adds overhead)
- Token usage may increase slightly (enhanced prompts)

**🎯 Key Insight:**
If agentic mode consistently improves success rate and quality despite small time overhead, the enhancements are effective.

## 🔬 Methodology

### Evaluation Process

1. **Task Selection**: 10 diverse coding tasks covering common software engineering challenges
2. **Model Testing**: Each model tested in both baseline and agentic modes
3. **Scoring**: Solutions evaluated against expected fixes using keyword matching
4. **Statistical Analysis**: Aggregate results across all tasks and models

### Scoring Algorithm

```javascript
// Extract key elements from expected solution
keywords = extractKeywords(expectedFix)
matched = keywords.filter(k => solution.includes(k))

score = (matched.length / keywords.length) * 100
correct = score >= 70%  // 70% threshold for correctness
```

### Agentic Features

**Memory System**:
```bash
# Stores successful patterns by category
npx agentdb reflexion store <session> <task> <score> <success> <note>
```

**Reflexion**:
- Triggered when score is 50-80% (borderline solutions)
- Provides feedback on missing elements
- Retries with improved context
- Can boost scores by 10-30%

**Learning**:
- Successful solutions (score ≥ 80%) stored as skills
- Future tasks in same category get context boost
- Patterns improve over multiple runs

## 📊 Report Outputs

### JSON Report (`comparison-report-<timestamp>.json`)

Complete data including:
- Per-task results for all models
- Detailed metrics (tokens, time, scores)
- Agentic feature usage statistics
- Raw API responses

### Markdown Report (`comparison-report-<timestamp>.md`)

Human-readable summary including:
- Executive summary
- Overall statistics tables
- Per-model breakdowns
- Methodology explanation
- Conclusions and insights

## 🛠️ AgentDB Commands

The agentic runner uses these AgentDB features:

```bash
# View reflexion memory
npx agentdb reflexion query

# List learned skills
npx agentdb skill list

# Search for patterns
npx agentdb skill search "error_handling" 10

# View causal memory
npx agentdb causal query "" "code_quality" 0.8

# Check available commands
npx agentdb --help
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...

# Optional
OPENROUTER_SITE_URL=https://yourdomain.com  # For rankings
OPENROUTER_APP_NAME=SWE-Bench-Comparison    # For display
```

### Model Selection

Recommended models for testing:

**Fast & Cost-Effective:**
- `deepseek/deepseek-chat` - $0.14/$0.28 per 1M tokens
- `google/gemini-flash-1.5:free` - Free tier available

**Balanced:**
- `meta-llama/llama-3.3-70b-instruct` - $0.30/$0.30 per 1M tokens
- `openai/gpt-3.5-turbo` - $0.50/$1.50 per 1M tokens

**Premium:**
- `anthropic/claude-3.5-sonnet` - $3/$15 per 1M tokens
- `openai/gpt-4-turbo` - $10/$30 per 1M tokens

## 📝 Example Usage

### Quick Single Model Test

```bash
# Test DeepSeek (fast, cheap)
node comparison-runner.js deepseek/deepseek-chat
```

### Multi-Model Comparison

```bash
# Compare 3 models across all tasks
node comparison-runner.js \
  deepseek/deepseek-chat \
  meta-llama/llama-3.3-70b-instruct \
  openai/gpt-3.5-turbo
```

### Custom Task Subset

```javascript
// Edit swe-bench-tasks.json to test specific categories
{
  "tasks": [
    // Only include tasks with "category": "security"
  ]
}
```

## 🔍 Troubleshooting

### Common Issues

**"OPENROUTER_API_KEY not set"**
```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Rate Limiting**
- Built-in delays between requests (1-3 seconds)
- If you hit limits, increase delays in runner files

**AgentDB Commands Failing**
- AgentDB is integrated into agentic-flow
- Ensure agentic-flow is installed: `npm install`
- Check with: `npx agentdb --help`

**Module Import Errors**
- Ensure package.json has `"type": "module"`
- Use Node.js 18+ for ESM support

## 📚 Additional Resources

### agentic-flow Documentation
- Main Repo: https://github.com/ruvnet/agentic-flow
- AgentDB Docs: https://github.com/ruvnet/agentic-flow/tree/main/src/agentdb
- ReasoningBank Docs: https://github.com/ruvnet/agentic-flow/tree/main/src/reasoningbank

### OpenRouter
- Dashboard: https://openrouter.ai
- API Docs: https://openrouter.ai/docs
- Model List: https://openrouter.ai/models

### SWE-Bench
- Original Benchmark: https://www.swebench.com
- Paper: https://arxiv.org/abs/2310.06770

## 🤝 Contributing

Suggestions for improving the benchmark:

1. **Add More Tasks**: Expand task variety and difficulty
2. **Add More Categories**: Cover more software engineering domains
3. **Improve Scoring**: Enhance evaluation accuracy
4. **Add More Models**: Test additional OpenRouter models
5. **Add Visualizations**: Generate charts and graphs

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

Created by rUv for testing agentic-flow capabilities

## 🙏 Acknowledgments

- **agentic-flow**: https://github.com/ruvnet/agentic-flow
- **OpenRouter**: https://openrouter.ai
- **SWE-Bench**: Original benchmark inspiration

---

**Ready to test?**

```bash
export OPENROUTER_API_KEY=your_key
npm run compare:quick
```

Results will be saved to `comparison-report-<timestamp>.json` and `.md` files.
