# Quick Start Guide: @neural-trader/predictor Benchmarking

This guide will help you quickly set up and run benchmarks for the `@neural-trader/predictor` package.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- 512 MB available memory

## Installation

```bash
# Install dependencies
npm install
```

## Running Benchmarks

### Quick Test (2 minutes)

Run the core benchmark suite:

```bash
npm run benchmark
```

This will execute:
1. ✅ Basic Predictions (alpha values: 0.05, 0.1, 0.2)
2. ✅ Implementation Comparison (pure JS/WASM/native)
3. ✅ Stress Testing (calibration scaling, streaming updates)

### Individual Benchmarks

```bash
# Basic predictions only
npm run benchmark:basic

# Implementation comparison
npm run benchmark:impl

# Stress testing
npm run benchmark:stress

# AgentDB integration (requires setup)
npm run benchmark:agentdb

# Full suite with AgentDB
npm run benchmark:all
```

## Understanding Results

### Console Output

The benchmark will display:

```
╔══════════════════════════════════════════════════════════════╗
║  @neural-trader/predictor Core Benchmark Suite              ║
╚══════════════════════════════════════════════════════════════╝

🎯 Key Performance Metrics:
   • Implementation: pure
   • Coverage Accuracy: 74.80% (target: 90%)
   • Prediction Throughput: 691,630 predictions/sec
   • Avg Prediction Time: 1.45μs
   ...
```

### JSON Results

Detailed results are saved to `benchmark-results.json`:

```json
{
  "metadata": {
    "timestamp": "2025-11-15T19:29:21.714Z",
    "nodeVersion": "v22.21.1",
    "platform": "linux"
  },
  "benchmarks": {
    "basic": { ... },
    "implementation": { ... },
    "stress": { ... }
  }
}
```

## Key Metrics Explained

| Metric | Description | Good Value |
|--------|-------------|------------|
| **Throughput** | Predictions per second | > 100,000 |
| **Latency** | Time per prediction | < 10 μs |
| **Coverage** | % of actuals in intervals | 85-95% |
| **Width** | Average interval size | Depends on use case |

## Interpreting Results

### High-Frequency Trading

✅ **Ready for HFT if:**
- Throughput > 500,000 pred/sec
- Latency < 5 μs
- Coverage 90-95%

### Risk Management

✅ **Ready for Risk Mgmt if:**
- Throughput > 10,000 pred/sec
- Latency < 100 μs
- Coverage 95-99%

### Research/Backtesting

✅ **Ready for Research if:**
- Throughput > 1,000 pred/sec
- Any latency acceptable
- Coverage 80-95%

## Customizing Benchmarks

### Modify Data Size

Edit `benchmarks/utils.js`:

```javascript
export function generateTradingData(
  n = 1000,           // Change this
  basePrice = 100,
  volatility = 0.02
) { ... }
```

### Modify Alpha Values

Edit `benchmarks/basic-predictions.js`:

```javascript
const alphas = [0.05, 0.1, 0.2];  // Add/remove alphas
```

### Add Custom Tests

Create a new file `benchmarks/my-test.js`:

```javascript
import { createPredictor } from '@neural-trader/predictor';

async function runMyTest() {
  const { predictor } = await createPredictor({ alpha: 0.1 });

  // Your test logic here...

  return results;
}

export { runMyTest };
```

## Troubleshooting

### Low Coverage (< 70%)

**Possible causes:**
1. Calibration set too small
2. Synthetic data not realistic
3. Wrong alpha value

**Solutions:**
```javascript
// Increase calibration size
await predictor.calibrate(
  predictions.slice(0, 2000),  // Was 500
  actuals.slice(0, 2000)
);

// Use real market data
const marketData = await fetchHistoricalData();
```

### Slow Performance

**Possible causes:**
1. Pure JS implementation (native not installed)
2. Small batch size
3. Frequent recalibration

**Solutions:**
```bash
# Install native addon
npm install @neural-trader/predictor-native
```

```javascript
// Batch predictions
const intervals = predictions.map(p => predictor.predict(p));

// Not:
for (const p of predictions) {
  predictor.predict(p);  // Slower
}
```

### Memory Issues

**Solution:**
```javascript
// Limit calibration size
const { predictor } = await createPredictor({
  alpha: 0.1,
  calibrationSize: 2000  // Don't exceed 10,000
});
```

## Next Steps

1. ✅ Review `REVIEW.md` for detailed analysis
2. ✅ Check `benchmark-results.json` for raw data
3. ✅ Experiment with different configurations
4. ✅ Test with your own trading data
5. ✅ Integrate with production systems

## AgentDB Integration

For long-term analysis and pattern recognition:

```javascript
import { createDatabase } from 'agentdb';

const db = await createDatabase({ filename: 'trading.db' });

// Store predictions
await db.run(
  `INSERT INTO predictions (interval_data, metadata) VALUES (?, ?)`,
  [JSON.stringify(interval), JSON.stringify({ timestamp: Date.now() })]
);

// Query patterns
const widePredictions = await db.all(
  `SELECT * FROM predictions
   WHERE json_extract(metadata, '$.width') > 10`
);
```

## Performance Tips

### 1. Use Native Implementation

```bash
npm install @neural-trader/predictor-native
```

Expected speedup: 5-10x

### 2. Batch Processing

```javascript
// Good
const intervals = predictions.map(p => predictor.predict(p));

// Better (parallel)
const intervals = await Promise.all(
  predictions.map(p => predictor.predict(p))
);
```

### 3. Optimal Calibration Size

| Use Case | Recommended Size |
|----------|------------------|
| HFT | 500-1,000 |
| Day Trading | 1,000-2,000 |
| Swing Trading | 2,000-5,000 |
| Research | 5,000-10,000 |

### 4. Streaming Updates

```javascript
// Enable efficient online updates
const { predictor } = await createPredictor({
  alpha: 0.1,
  recalibrationFreq: 100  // Recalibrate every 100 updates
});

for await (const [pred, actual] of stream) {
  await predictor.update(pred, actual);
}
```

## Support

- 📖 Full Review: `REVIEW.md`
- 📊 Benchmark Code: `benchmarks/`
- 📝 NPM Package: https://www.npmjs.com/package/@neural-trader/predictor
- 🐛 Issues: https://github.com/ruvnet/neural-trader/issues

---

Happy Benchmarking! 🚀
