# DeepSeek vs Kimi K2 Benchmark

A comprehensive benchmark comparing DeepSeek Chat and Kimi K2 models using OpenRouter API.

## Overview

This benchmark suite evaluates both models across 8 different categories:
- **Code Generation**: Testing ability to write correct, efficient code
- **Reasoning & Logic**: Mathematical reasoning, logical puzzles, causal analysis
- **Language Understanding**: Sentiment analysis, summarization, context comprehension
- **Creative Writing**: Story writing, technical docs, persuasive content
- **Knowledge & Facts**: Scientific knowledge, technical concepts, historical context
- **Problem Solving**: Debugging, system design, optimization
- **Multilingual Capability**: Translation and cultural nuance handling
- **Edge Cases & Robustness**: Handling ambiguity, impossible requests, contradictions

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your OpenRouter API key:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

   Or create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

3. Get an API key from [OpenRouter](https://openrouter.ai/)

## Running the Benchmark

### Using npx agentic-flow:
```bash
npx agentic-flow
```

### Or run directly:
```bash
npm run benchmark
```

## What Gets Measured

For each model, the benchmark tracks:
- ✅ Success rate per category
- ⚡ Average response time
- 📝 Response length and detail
- 🎯 Token usage
- 📊 Category-specific performance
- 🔍 Detailed response quality

## Results

Results are saved to timestamped JSON files (`benchmark-results-*.json`) containing:
- Summary statistics for both models
- Detailed results for each test
- Category breakdowns
- Raw responses for manual evaluation

## Models Tested

- **DeepSeek Chat** (`deepseek/deepseek-chat`)
- **Kimi K2** (`moonshot/kimi-k2`)

Both models are accessed through OpenRouter API.

## Benchmark Categories

### 1. Code Generation (3 tests)
- Simple function implementation
- Algorithm implementation
- Complex data processing

### 2. Reasoning & Logic (3 tests)
- Mathematical reasoning
- Logical puzzles
- Causal reasoning

### 3. Language Understanding (3 tests)
- Sentiment analysis
- Text summarization
- Context understanding

### 4. Creative Writing (3 tests)
- Story beginning
- Technical writing
- Persuasive writing

### 5. Knowledge & Facts (3 tests)
- Scientific knowledge
- Historical context
- Technical concepts

### 6. Problem Solving (3 tests)
- Debugging scenarios
- System design
- Optimization problems

### 7. Multilingual Capability (2 tests)
- Translation tasks
- Code comment translation

### 8. Edge Cases & Robustness (3 tests)
- Ambiguous queries
- Impossible requests
- Contradictory constraints

**Total: 23 comprehensive tests**

## Understanding the Results

The benchmark provides:

1. **Performance Metrics**:
   - Response time comparison
   - Success rates
   - Token efficiency

2. **Category Analysis**:
   - Which model performs better in specific domains
   - Consistency across different task types

3. **Detailed Responses**:
   - Full responses saved for manual quality assessment
   - Allows for subjective evaluation of output quality

## Example Output

```
🚀 Starting LLM Benchmark: DeepSeek vs Kimi K2
======================================================================

📊 Testing DeepSeek Chat
----------------------------------------------------------------------
Code Generation:
  Testing: Simple Function...
    ✓ Completed in 1234ms
  ...

📈 BENCHMARK RESULTS
======================================================================

🤖 DeepSeek Chat:
   Total Tests: 23
   Successful: 23 ✓
   Failed: 0 ✗
   Avg Response Time: 1456ms
   Avg Response Length: 456 chars
   Total Tokens Used: 12345

🤖 Kimi K2:
   Total Tests: 23
   Successful: 23 ✓
   Failed: 0 ✗
   Avg Response Time: 1234ms
   Avg Response Length: 523 chars
   Total Tokens Used: 13456

📊 Performance Comparison:
----------------------------------------------------------------------
   ⚡ Speed Winner: Kimi K2 (15.2% faster)
   📝 More Detailed: Kimi K2 (14.7% longer responses)
   ✅ Success Rate: DeepSeek 100.0% | Kimi K2 100.0%
```

## Notes

- Tests run sequentially with 1-second delays to avoid rate limiting
- Each test uses temperature 0.7 for balanced creativity/consistency
- Maximum 2000 tokens per response
- Results include both quantitative metrics and qualitative responses

## Contributing

Feel free to add more test cases to `benchmark-config.js` to expand the benchmark coverage!
