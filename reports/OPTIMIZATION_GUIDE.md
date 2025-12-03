# SONA Optimization Guide for LLM Integration

## Quick Start

```javascript
const { SonaEngine } = require('@ruvector/sona');

// Optimal balanced configuration for Phi-4
const engine = SonaEngine.withConfig({
  hiddenDim: 3072,        // Match your model's hidden dimension
  microLoraRank: 2,       // Best speed/quality tradeoff
  baseLoraRank: 8,        // Good adaptation depth
  microLoraLr: 0.001,     // Stable learning
  qualityThreshold: 0.4,  // Filter low-quality trajectories
  enableSimd: true,       // Enable SIMD acceleration
});
```

---

## Configuration Parameters

### Core Parameters

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `hiddenDim` | Required | 64-8192 | Must match model |
| `microLoraRank` | 1 | 1-2 | **2 is faster** |
| `baseLoraRank` | 8 | 4-32 | Higher = more adaptation |
| `enableSimd` | true | bool | 10% speedup |

### Learning Parameters

| Parameter | Default | Optimal | Impact |
|-----------|---------|---------|--------|
| `microLoraLr` | 0.001 | **0.002** | Max quality gain |
| `baseLoraLr` | 0.0001 | 0.0002 | Background learning |
| `ewcLambda` | 1000 | 1500-2000 | Prevents forgetting |
| `qualityThreshold` | 0.5 | 0.2-0.4 | Lower = more learning |

### Capacity Parameters

| Parameter | Default | Range | Memory Impact |
|-----------|---------|-------|---------------|
| `trajectoryCapacity` | 10000 | 100-50000 | ~3KB each |
| `patternClusters` | 50 | 25-200 | ~10KB each |
| `backgroundIntervalMs` | 3600000 | 60000+ | Learning frequency |

---

## Optimization Profiles

### 1. Real-Time Chat / Streaming

**Goal:** Minimum latency, maximum tokens/sec

```javascript
const realtimeConfig = {
  hiddenDim: 3072,
  microLoraRank: 2,        // Faster than rank-1!
  baseLoraRank: 4,         // Minimal base adaptation
  microLoraLr: 0.0005,     // Conservative learning
  qualityThreshold: 0.7,   // Only high-quality updates
  patternClusters: 25,     // Fast routing
  trajectoryCapacity: 500, // Small buffer
  enableSimd: true,
};
```

**Expected Performance:**
- Micro-LoRA: 2200 ops/sec
- Streaming: 2000+ tokens/sec
- Latency: <0.5ms per token

---

### 2. Batch API Processing

**Goal:** High throughput with good adaptation

```javascript
const batchConfig = {
  hiddenDim: 3072,
  microLoraRank: 2,
  baseLoraRank: 8,
  microLoraLr: 0.001,
  qualityThreshold: 0.5,
  patternClusters: 50,
  trajectoryCapacity: 5000,
  backgroundIntervalMs: 1800000, // 30 min
  enableSimd: true,
};
```

**Expected Performance:**
- Inferences/sec: 50+
- Batch of 32: 14ms total
- Quality improvement: +25%

---

### 3. Research / Fine-Tuning

**Goal:** Maximum quality improvement

```javascript
const researchConfig = {
  hiddenDim: 3072,
  microLoraRank: 2,
  baseLoraRank: 16,        // Deep adaptation
  microLoraLr: 0.002,      // Aggressive learning
  baseLoraLr: 0.0002,
  ewcLambda: 2000,         // Strong regularization
  qualityThreshold: 0.2,   // Learn from more data
  patternClusters: 100,
  trajectoryCapacity: 10000,
  backgroundIntervalMs: 900000, // 15 min
  enableSimd: true,
};
```

**Expected Performance:**
- Quality improvement: +50-55%
- Pattern learning: Comprehensive
- Inference overhead: ~25ms

---

### 4. Edge / Mobile Deployment

**Goal:** Minimal memory and CPU usage

```javascript
const edgeConfig = {
  hiddenDim: 3072,
  microLoraRank: 1,
  baseLoraRank: 4,
  microLoraLr: 0.001,
  qualityThreshold: 0.6,
  patternClusters: 15,
  trajectoryCapacity: 200,
  backgroundIntervalMs: 7200000, // 2 hours
  enableSimd: true,
};
```

**Expected Performance:**
- Memory: <5MB total
- Per-trajectory: ~3KB
- Overhead: <20ms

---

## Performance Tuning Tips

### 1. Maximize Throughput

```javascript
// Use rank-2 (counterintuitively faster)
microLoraRank: 2

// Use batch size 32 for optimal per-vector latency
const batchSize = 32;
inputs.forEach(input => engine.applyMicroLora(input));

// Reduce pattern clusters for faster routing
patternClusters: 25
```

### 2. Maximize Quality

```javascript
// Use optimal learning rate
microLoraLr: 0.002

// Lower quality threshold to learn from more data
qualityThreshold: 0.2

// More pattern clusters for better categorization
patternClusters: 100

// Deeper base adaptation
baseLoraRank: 16
```

### 3. Minimize Latency

```javascript
// Always enable SIMD
enableSimd: true

// Use rank-2 (faster due to vectorization)
microLoraRank: 2

// Minimal base rank
baseLoraRank: 4

// Fewer clusters
patternClusters: 25
```

### 4. Reduce Memory

```javascript
// Small trajectory buffer
trajectoryCapacity: 200

// Fewer pattern clusters
patternClusters: 15

// Use rank-1 (smaller matrices)
microLoraRank: 1
baseLoraRank: 4
```

---

## Integration Patterns

### Basic LLM Enhancement

```javascript
async function enhancedInference(prompt) {
  const embedding = await embed(prompt);
  const tid = engine.beginTrajectory(embedding);

  let hidden = embedding;
  for (let layer = 0; layer < numLayers; layer++) {
    // Apply SONA micro-LoRA at each layer
    hidden = engine.applyMicroLora(hidden);

    // Your model's layer processing here
    hidden = await modelLayer(layer, hidden);
  }

  // Record trajectory for learning
  const quality = assessQuality(hidden);
  engine.addTrajectoryStep(tid, hidden, attentionWeights, quality);
  engine.endTrajectory(tid, quality);

  // Periodic background learning
  engine.tick();

  return decode(hidden);
}
```

### Pattern-Based Routing

```javascript
function routeQuery(queryEmbedding) {
  const patterns = engine.findPatterns(queryEmbedding, 3);

  if (patterns.length > 0 && patterns[0].avgQuality > 0.8) {
    const patternType = patterns[0].patternType;

    switch (patternType) {
      case 'CodeGen':
        return 'code-specialized-model';
      case 'Reasoning':
        return 'cot-model';
      case 'Creative':
        return 'creative-model';
      default:
        return 'general-model';
    }
  }

  return 'default-model';
}
```

### Continuous Learning Loop

```javascript
// Process inference batches with learning
for (const batch of batches) {
  for (const request of batch) {
    const result = await enhancedInference(request);
    // Quality feedback is recorded in trajectory
  }

  // Force learning every N batches
  if (batchCount % 25 === 0) {
    engine.forceLearn();
  }
}
```

---

## Troubleshooting

### Low Throughput
- Enable SIMD: `enableSimd: true`
- Use rank-2: `microLoraRank: 2`
- Reduce pattern clusters: `patternClusters: 25`

### Poor Quality Improvement
- Increase learning rate: `microLoraLr: 0.002`
- Lower threshold: `qualityThreshold: 0.2`
- More training data: `trajectoryCapacity: 10000`

### High Memory Usage
- Reduce capacity: `trajectoryCapacity: 200`
- Fewer clusters: `patternClusters: 15`
- Use rank-1: `microLoraRank: 1`

### Catastrophic Forgetting
- Increase EWC: `ewcLambda: 2000`
- Balance training across tasks
- Use lower learning rates

---

## Key Metrics to Monitor

```javascript
const stats = engine.getStats();
// Returns: CoordinatorStats {
//   trajectories_buffered: N,
//   patterns_stored: N,
//   instant_enabled: true,
//   background_enabled: true
// }

// Force learning when buffer is full
if (trajectoriesBuffered > trajectoryCapacity * 0.8) {
  engine.forceLearn();
}
```

---

## Version Compatibility

| SONA Version | Node.js | Platforms |
|--------------|---------|-----------|
| 0.1.x | >= 16 | Linux, macOS, Windows |

---

*Guide based on 134 automated benchmarks on @ruvector/sona v0.1.1*
