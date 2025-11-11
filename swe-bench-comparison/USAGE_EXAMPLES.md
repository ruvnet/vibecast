# Usage Examples

Practical examples for running SWE-Bench comparisons with agentic-flow.

## Quick Examples

### 1. Basic Comparison (Fastest)

Test a single fast model to see agentic enhancements in action:

```bash
# Set API key
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Run with DeepSeek (fast & cheap)
node comparison-runner.js deepseek/deepseek-chat
```

**Expected time**: ~5-10 minutes
**Cost**: ~$0.01-0.05
**Output**: Full comparison report showing baseline vs agentic

### 2. Multi-Model Comparison

Compare agentic enhancements across different model types:

```bash
node comparison-runner.js \
  deepseek/deepseek-chat \
  meta-llama/llama-3.3-70b-instruct \
  openai/gpt-3.5-turbo
```

**Expected time**: ~15-30 minutes
**Cost**: ~$0.05-0.20
**Output**: Cross-model comparison showing which models benefit most

### 3. Individual Mode Testing

Test baseline or agentic mode separately:

```bash
# Baseline only (no enhancements)
node baseline-runner.js deepseek/deepseek-chat

# Agentic only (with enhancements)
node agentic-runner.js deepseek/deepseek-chat
```

## Advanced Examples

### 4. Premium Model Testing

Test high-quality models to see if agentic features still add value:

```bash
node comparison-runner.js anthropic/claude-3.5-sonnet
```

**Question**: Do agentic enhancements help premium models?
**Expected**: Improvements may be smaller but still measurable

### 5. Free Model Testing

Test completely free models:

```bash
node comparison-runner.js google/gemini-flash-1.5:free
```

**Cost**: $0.00 (free tier)
**Great for**: Learning and experimentation

### 6. Custom Model List

Create a text file with models to test:

```bash
# models.txt
deepseek/deepseek-chat
meta-llama/llama-3.3-70b-instruct
google/gemini-pro-1.5
openai/gpt-4o-mini

# Run comparison
node comparison-runner.js $(cat models.txt)
```

## NPM Scripts

Use convenient npm scripts from `package.json`:

```bash
# Quick single-model test
npm run compare:quick

# Full multi-model test
npm run compare:full

# Just baseline
npm run baseline deepseek/deepseek-chat

# Just agentic
npm run agentic deepseek/deepseek-chat
```

## Interpreting Results

### Success Rate Improvement

```
Success Rate: 60% → 80% (+20%)
```

**Interpretation**:
- ✅ **+20% improvement** = Agentic features significantly help
- ⚠️ **+5% improvement** = Modest benefit
- ❌ **-5% or less** = No clear benefit (or model already excellent)

### Score Improvement

```
Avg Score: 65% → 82% (+17%)
```

**Interpretation**:
- Solution quality improved by 17%
- More complete and correct solutions
- Better handling of edge cases

### Memory Hits

```
Memory Hits: 4
```

**Interpretation**:
- AgentDB successfully reused learned patterns 4 times
- System is learning from previous tasks
- Future runs will benefit even more

### Reflexion Applied

```
Reflexion Applied: 3
```

**Interpretation**:
- Self-correction improved 3 borderline solutions
- System identified and fixed its own mistakes
- Can boost scores by 10-30% on affected tasks

## Understanding Time Trade-offs

### Baseline: 2000ms average per task
### Agentic: 2400ms average per task (+20%)

**Why slower?**
1. Memory queries: ~50-100ms overhead
2. Reflexion: +500-1000ms for retries (when triggered)
3. Enhanced prompts: Slightly more tokens to process

**Is it worth it?**
- If success rate improves 15%+ → **Yes, definitely**
- Quality matters more than speed for complex tasks
- In production, cache memory queries to reduce overhead

## Real-World Scenarios

### Scenario 1: Code Review Bot

**Question**: Can agentic features improve code review accuracy?

```bash
# Test on error_handling, security, validation tasks
node agentic-runner.js deepseek/deepseek-chat
```

**Look for**:
- High success rate on security tasks
- Memory learning validation patterns
- Consistent quality across reviews

### Scenario 2: Automated Refactoring

**Question**: Do agentic features help with refactoring tasks?

```bash
# Focus on refactoring, performance categories
node comparison-runner.js meta-llama/llama-3.3-70b-instruct
```

**Look for**:
- Improvement on medium/hard refactoring tasks
- Pattern learning for common refactoring strategies

### Scenario 3: Cost Optimization

**Question**: Can cheap models + agentic features compete with expensive models?

```bash
# Compare cheap + agentic vs expensive baseline
node agentic-runner.js deepseek/deepseek-chat
node baseline-runner.js openai/gpt-4-turbo

# Compare results
```

**Look for**:
- DeepSeek + agentic approaching GPT-4 baseline quality
- Cost savings: 98% cheaper with comparable results

## Debugging & Monitoring

### View AgentDB Memory

```bash
# Check what the system learned
npx agentdb reflexion query
npx agentdb skill list
npx agentdb skill search "error_handling" 10
```

### Analyze Specific Task

```bash
# Run single task verbosely
DEBUG=1 node agentic-runner.js deepseek/deepseek-chat
```

### Compare Difficulty Levels

Look at the per-difficulty breakdown in reports:

```json
"byDifficulty": {
  "easy": {
    "baseline": 100,
    "agentic": 100,
    "improvement": 0  // Already perfect
  },
  "medium": {
    "baseline": 75,
    "agentic": 87.5,
    "improvement": 12.5  // Clear benefit
  },
  "hard": {
    "baseline": 33.3,
    "agentic": 66.7,
    "improvement": 33.4  // Major benefit
  }
}
```

**Interpretation**: Agentic features help most on hard tasks!

## Best Practices

### 1. Start Small

```bash
# Test one model first
npm run compare:quick
```

### 2. Use Cost-Effective Models

```bash
# Start with cheap models
node comparison-runner.js deepseek/deepseek-chat
```

### 3. Run Multiple Times

```bash
# Run 3 times to see consistency
for i in {1..3}; do
  echo "Run $i"
  node comparison-runner.js deepseek/deepseek-chat
  sleep 5
done
```

### 4. Save Results

```bash
# Auto-save with timestamps
node comparison-runner.js deepseek/deepseek-chat 2>&1 | tee comparison-log-$(date +%s).txt
```

### 5. Compare Reports

```bash
# Generate multiple reports
node comparison-runner.js model1 > report1.txt
node comparison-runner.js model2 > report2.txt

# Use diff or compare tools
diff report1.txt report2.txt
```

## Troubleshooting Examples

### Rate Limiting

```bash
# If you hit rate limits, modify runner files:
# Change: await new Promise(resolve => setTimeout(resolve, 1000));
# To:     await new Promise(resolve => setTimeout(resolve, 3000));
```

### Low Success Rates

If both baseline and agentic show low success rates:
- Model may not be well-suited for coding tasks
- Try a different model
- Check if API key has proper permissions

### No Memory Hits

If agentic shows 0 memory hits:
- First run has nothing to learn from (expected)
- Run multiple times to build memory
- Check AgentDB is working: `npx agentdb --help`

### Reflexion Not Triggering

If reflexion count is 0:
- Tasks may be too easy (100% correct) or too hard (0% correct)
- Reflexion triggers on 50-80% scores
- This is normal and doesn't indicate a problem

## Cost Estimation

### Approximate costs per full comparison (baseline + agentic, 10 tasks each):

| Model | Per Task | Per Comparison | Notes |
|-------|----------|----------------|-------|
| DeepSeek Chat | $0.0003 | $0.006 | Ultra-cheap |
| Llama 3.3 70B | $0.0008 | $0.016 | Balanced |
| GPT-3.5 Turbo | $0.0015 | $0.030 | Popular |
| GPT-4 Turbo | $0.008 | $0.160 | Premium |
| Claude 3.5 Sonnet | $0.010 | $0.200 | Best quality |

**Note**: Agentic mode may use 10-20% more tokens (enhanced prompts + reflexion)

## Next Steps

After running comparisons:

1. **Analyze reports** - Look for patterns in improvements
2. **Adjust tasks** - Add tasks from your specific domain
3. **Tune parameters** - Modify scoring thresholds if needed
4. **Deploy** - Use agentic mode for production if results are positive
5. **Share results** - Contribute findings back to community

## Questions?

Check `README.md` for full documentation or open an issue on GitHub.
