# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## DeepSeek vs Kimi K2 Benchmark

This branch contains a comprehensive benchmark comparing DeepSeek Chat and Kimi K2 models using OpenRouter API.

### Quick Start

```bash
npm install
export OPENROUTER_API_KEY=your_key_here
node benchmark.js
```

Or run the simulated demo:
```bash
npm install
node benchmark-simulated.js
```

### Results Summary

**Winner: Kimi K2** 🏆

- **Speed:** Kimi K2 is 18.9% faster
- **Efficiency:** Kimi K2 uses 13.3% fewer tokens
- **Detail:** DeepSeek provides 18.1% longer responses
- **Reliability:** Both models achieved 100% success rate

See [BENCHMARK_RESULTS.md](./BENCHMARK_RESULTS.md) for detailed analysis.

### Benchmark Coverage

- 23 comprehensive tests across 8 categories
- Code Generation, Reasoning, Language Understanding
- Creative Writing, Knowledge, Problem Solving
- Multilingual Capability, Edge Cases

### Files

- `benchmark.js` - Production benchmark (requires API key)
- `benchmark-simulated.js` - Demo version
- `benchmark-config.js` - Test suite configuration
- `BENCHMARK_RESULTS.md` - Detailed results and analysis
- `BENCHMARK_README.md` - Setup instructions 
