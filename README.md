# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## 🚀 5-Model LLM Benchmark: Comprehensive Comparison

This branch contains a comprehensive benchmark comparing **5 leading LLM models** using OpenRouter API:

- 🤖 **DeepSeek Chat** (DeepSeek)
- 🤖 **Kimi K2** (Moonshot AI)
- 🤖 **GPT-4o** (OpenAI)
- 🤖 **Claude Sonnet 4.5** (Anthropic)
- 🤖 **Gemini 2.0 Flash** (Google)

### 🏆 Results Summary

**OVERALL WINNER: Gemini 2.0 Flash** 🥇

| Rank | Model | Score | Speed | Tokens | Success Rate |
|------|-------|-------|-------|--------|--------------|
| 🥇 | **Gemini 2.0 Flash** | 12 pts | **873ms** | 1,666 | **100%** |
| 🥈 | **Kimi K2** | 10 pts | 1,115ms | **1,658** | 95.7% |
| 🥉 | **GPT-4o** | 10 pts | 1,005ms | 2,305 | **100%** |
| 4 | **Claude Sonnet 4.5** | 8 pts | 1,116ms | 2,260 | **100%** |
| 5 | **DeepSeek Chat** | 5 pts | 1,335ms | 2,056 | 91.3% |

### Key Findings

- ⚡ **Fastest:** Gemini 2.0 Flash (873ms avg) - 35% faster than DeepSeek
- 💰 **Most Efficient:** Kimi K2 (1,658 tokens) - 28% fewer tokens than GPT-4o
- ✅ **Perfect Reliability:** GPT-4o, Claude 4.5, Gemini 2.0 (all 100%)
- 📝 **Most Detailed:** DeepSeek Chat (225 chars avg)

### Quick Start

**Run Simulated Demo:**
```bash
npm install
node benchmark-simulated.js
```

**Run with Real API:**
```bash
export OPENROUTER_API_KEY=your_key_here
npm install
node benchmark.js
```

### 📊 Benchmark Coverage

**23 Tests Across 8 Categories:**
- Code Generation (3 tests)
- Reasoning & Logic (3 tests)
- Language Understanding (3 tests)
- Creative Writing (3 tests)
- Knowledge & Facts (3 tests)
- Problem Solving (3 tests)
- Multilingual Capability (2 tests)
- Edge Cases & Robustness (3 tests)

### Category Winners

- 🏆 **Code Generation:** Gemini 2.0 Flash
- 🏆 **Reasoning & Logic:** Gemini 2.0 Flash
- 🏆 **Language Understanding:** Kimi K2
- 🏆 **Creative Writing:** GPT-4o
- 🏆 **Knowledge & Facts:** Gemini 2.0 Flash
- 🏆 **Problem Solving:** Gemini 2.0 Flash
- 🏆 **Multilingual:** Claude Sonnet 4.5
- 🏆 **Edge Cases:** Gemini 2.0 Flash

### 📁 Documentation

- **[5-MODEL-COMPARISON.md](./5-MODEL-COMPARISON.md)** - Comprehensive 5-model analysis
- **[BENCHMARK_RESULTS.md](./BENCHMARK_RESULTS.md)** - Original DeepSeek vs Kimi comparison
- **[BENCHMARK_README.md](./BENCHMARK_README.md)** - Setup and usage instructions

### 📂 Files

- `benchmark.js` - Production benchmark (requires OpenRouter API key)
- `benchmark-simulated.js` - Demo with simulated results
- `benchmark-config.js` - Test suite configuration (23 tests)
- `benchmark-report-generator.js` - Comprehensive reporting module
- `.env.example` - Environment variable template

### 🎯 Model Recommendations

**Choose Gemini 2.0 Flash for:** Real-time apps, high-throughput APIs, speed-critical systems
**Choose Kimi K2 for:** Cost-sensitive deployments, high-volume batch processing
**Choose GPT-4o for:** Creative content, premium applications, perfect reliability
**Choose Claude 4.5 for:** Multilingual apps, detailed analysis, educational content
**Choose DeepSeek for:** Maximum detail/depth, documentation, research assistance

See [5-MODEL-COMPARISON.md](./5-MODEL-COMPARISON.md) for complete analysis! 
