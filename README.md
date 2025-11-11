# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## OpenRouter API Testing

This branch includes comprehensive OpenRouter API integration and testing tools.

### Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Test connectivity (no API key required):**
   ```bash
   python3 openrouter_demo.py test
   ```

3. **Explore available models:**
   ```bash
   # List all models
   python3 openrouter_demo.py list

   # List free models
   python3 openrouter_demo.py list --free

   # List models from specific provider
   python3 openrouter_demo.py list --provider anthropic
   ```

4. **Use chat API (requires API key):**
   ```bash
   # Set your API key
   export OPENROUTER_API_KEY=your_key_here

   # Send a message
   python3 openrouter_demo.py chat "Hello, world!"
   ```

### Files

- `openrouter_demo.py` - Full-featured CLI tool for OpenRouter API
- `OPENROUTER_GUIDE.md` - Complete integration guide and examples
- `.env.example` - Template for environment configuration
- `requirements.txt` - Python dependencies

### Features

✅ **342+ AI models** from 55+ providers
✅ **47 free models** available for testing
✅ **Chat completions** with streaming support
✅ **Cost estimation** for API calls
✅ **Model discovery** and filtering
✅ **Production-ready** Python client

See `OPENROUTER_GUIDE.md` for detailed documentation.

## SWE-Bench Comparison: Agentic vs Baseline

This branch also includes a comprehensive benchmarking framework that compares OpenRouter models with and without agentic enhancements (agentic-flow/agentdb).

### What's Tested

**Baseline Mode** (Control):
- Direct OpenRouter API calls
- No memory or learning
- Independent task processing

**Agentic Mode** (Enhanced):
- ✨ **AgentDB**: Persistent memory with causal reasoning
- 🧠 **ReasoningBank**: Pattern learning across tasks
- 🔄 **Reflexion**: Automatic self-correction
- ⚡ **Agent Booster**: 352x faster code operations

### Quick Start

```bash
cd swe-bench-comparison
npm install

# Set your OpenRouter API key
export OPENROUTER_API_KEY=sk-or-v1-...

# Run quick comparison with one model
npm run compare:quick

# Run full comparison with multiple models
npm run compare:full
```

### Benchmark Tasks

10 real-world software engineering tasks:
- 🐛 Bug fixes (syntax errors, race conditions)
- 🔒 Security (SQL injection, input validation)
- ⚡ Performance (optimization, caching)
- 🔧 Refactoring (async/await, memory leaks)
- 📝 Type safety (TypeScript definitions)

Difficulty levels: Easy (3) | Medium (4) | Hard (3)

### What Gets Measured

| Metric | Description |
|--------|-------------|
| **Success Rate** | % of tasks solved correctly |
| **Solution Quality** | Average score (0-100%) |
| **Execution Time** | Time per task |
| **Token Usage** | API tokens consumed |
| **Memory Hits** | Times learned patterns were used |
| **Reflexion Applied** | Self-correction improvements |

### Expected Results

Based on agentic-flow capabilities:
- 📈 **Success rate**: +10-25% improvement
- 📊 **Solution quality**: +15-30% improvement
- 🧠 **Learning**: Memory system learns from past tasks
- 🔄 **Self-correction**: Reflexion improves borderline solutions
- ⏱️ **Time trade-off**: +10-30% (reflexion adds overhead)

### Example Output

```
==========================================================
FINAL COMPARISON REPORT
==========================================================

📊 Overall Statistics:
   • Average Success Rate Improvement: +15.3%
   • Average Score Improvement: +22.8%
   • Models with Improvement: 3/3 (100%)
   • Total Memory Hits: 12
   • Total Reflexion Applied: 8

💡 Conclusion:
   🎯 STRONG EVIDENCE: Agentic enhancements improved
   performance in 100% of models tested
```

### Reports Generated

- `comparison-report-<timestamp>.json` - Complete data
- `comparison-report-<timestamp>.md` - Markdown summary

See `swe-bench-comparison/README.md` for full documentation.

## Project Structure

```
vibecast/
├── openrouter_demo.py           # Python OpenRouter CLI
├── OPENROUTER_GUIDE.md          # OpenRouter integration guide
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
└── swe-bench-comparison/        # Benchmarking framework
    ├── README.md                # Comparison documentation
    ├── swe-bench-tasks.json     # 10 coding tasks
    ├── baseline-runner.js       # Baseline tests
    ├── agentic-runner.js        # Agentic-enhanced tests
    ├── comparison-runner.js     # Full comparison
    └── package.json             # Node dependencies
``` 
