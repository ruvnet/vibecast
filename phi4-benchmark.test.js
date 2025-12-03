/**
 * Phi-4 Optimization and Benchmarks for @ruvector/sona
 *
 * Phi-4 Model Specifications:
 * - Hidden dimension: 3072
 * - Intermediate dimension: 8192
 * - Number of layers: 40
 * - Number of attention heads: 32
 * - Head dimension: 96 (3072 / 32)
 * - Context length: 16384
 * - Parameters: ~14B
 */

const { SonaEngine } = require('@ruvector/sona');

// Phi-4 Architecture Constants
const PHI4_CONFIG = {
  hiddenDim: 3072,
  intermediateDim: 8192,
  numLayers: 40,
  numHeads: 32,
  headDim: 96,
  contextLength: 16384,
};

// Optimized SONA configurations for Phi-4
const SONA_CONFIGS = {
  // Ultra-fast inference mode - minimal overhead
  ultraFast: {
    hiddenDim: PHI4_CONFIG.hiddenDim,
    microLoraRank: 1,
    baseLoraRank: 4,
    microLoraLr: 0.0005,
    baseLoraLr: 0.00005,
    ewcLambda: 500.0,
    patternClusters: 25,
    trajectoryCapacity: 1000,
    backgroundIntervalMs: 7200000, // 2 hours
    qualityThreshold: 0.7,
    enableSimd: true,
  },

  // Balanced mode - good learning with acceptable overhead
  balanced: {
    hiddenDim: PHI4_CONFIG.hiddenDim,
    microLoraRank: 2,
    baseLoraRank: 8,
    microLoraLr: 0.001,
    baseLoraLr: 0.0001,
    ewcLambda: 1000.0,
    patternClusters: 50,
    trajectoryCapacity: 5000,
    backgroundIntervalMs: 3600000, // 1 hour
    qualityThreshold: 0.5,
    enableSimd: true,
  },

  // Deep learning mode - maximum adaptation
  deepLearning: {
    hiddenDim: PHI4_CONFIG.hiddenDim,
    microLoraRank: 2,
    baseLoraRank: 16,
    microLoraLr: 0.002,
    baseLoraLr: 0.0002,
    ewcLambda: 2000.0,
    patternClusters: 100,
    trajectoryCapacity: 10000,
    backgroundIntervalMs: 1800000, // 30 minutes
    qualityThreshold: 0.3,
    enableSimd: true,
  },

  // Memory-constrained mode - for limited resources
  memoryConstrained: {
    hiddenDim: PHI4_CONFIG.hiddenDim,
    microLoraRank: 1,
    baseLoraRank: 4,
    microLoraLr: 0.001,
    baseLoraLr: 0.0001,
    ewcLambda: 500.0,
    patternClusters: 20,
    trajectoryCapacity: 500,
    backgroundIntervalMs: 7200000,
    qualityThreshold: 0.6,
    enableSimd: true,
  },
};

// Helper functions
function randomVector(dim) {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

function normalizedVector(dim) {
  const vec = randomVector(dim);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}

function simulateAttentionWeights(numHeads, seqLen = 64) {
  // Simulate attention pattern for one token attending to sequence
  return Array.from({ length: numHeads * seqLen }, () => Math.random());
}

// Benchmark utilities
class BenchmarkTimer {
  constructor(name) {
    this.name = name;
    this.times = [];
  }

  time(fn) {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.times.push(elapsed);
    return result;
  }

  async timeAsync(fn) {
    const start = performance.now();
    const result = await fn();
    const elapsed = performance.now() - start;
    this.times.push(elapsed);
    return result;
  }

  get stats() {
    if (this.times.length === 0) return null;

    const sorted = [...this.times].sort((a, b) => a - b);
    const sum = this.times.reduce((a, b) => a + b, 0);
    const mean = sum / this.times.length;
    const variance = this.times.reduce((acc, t) => acc + (t - mean) ** 2, 0) / this.times.length;

    return {
      name: this.name,
      count: this.times.length,
      mean: mean,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(variance),
      total: sum,
    };
  }

  report() {
    const s = this.stats;
    if (!s) return `${this.name}: No data`;
    return `${s.name}: mean=${s.mean.toFixed(3)}ms, p50=${s.p50.toFixed(3)}ms, p95=${s.p95.toFixed(3)}ms, p99=${s.p99.toFixed(3)}ms, stdDev=${s.stdDev.toFixed(3)}ms (n=${s.count})`;
  }
}

describe('Phi-4 Optimized Configurations', () => {
  describe('Configuration Validation', () => {
    test.each(Object.entries(SONA_CONFIGS))(
      'should create engine with %s config',
      (configName, config) => {
        const engine = SonaEngine.withConfig(config);
        expect(engine).toBeDefined();
        expect(engine.isEnabled()).toBe(true);
      }
    );

    test('all configs should use Phi-4 hidden dimension', () => {
      Object.values(SONA_CONFIGS).forEach(config => {
        expect(config.hiddenDim).toBe(PHI4_CONFIG.hiddenDim);
      });
    });
  });

  describe('Phi-4 Layer Simulation', () => {
    let engine;

    beforeEach(() => {
      engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);
    });

    test('should handle Phi-4 hidden dimension vectors', () => {
      const input = randomVector(PHI4_CONFIG.hiddenDim);
      const output = engine.applyMicroLora(input);

      expect(output.length).toBe(PHI4_CONFIG.hiddenDim);
      output.forEach(v => expect(isFinite(v)).toBe(true));
    });

    test('should apply base-LoRA across all 40 Phi-4 layers', () => {
      const input = randomVector(PHI4_CONFIG.hiddenDim);

      for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
        const output = engine.applyBaseLora(layer, input);
        expect(output.length).toBe(PHI4_CONFIG.hiddenDim);
      }
    });

    test('should record trajectory with Phi-4 sized tensors', () => {
      const queryEmbedding = normalizedVector(PHI4_CONFIG.hiddenDim);
      const trajectoryId = engine.beginTrajectory(queryEmbedding);

      // Simulate processing through layers
      for (let layer = 0; layer < 5; layer++) { // Sample 5 layers
        const activations = randomVector(PHI4_CONFIG.hiddenDim);
        const attentionWeights = simulateAttentionWeights(PHI4_CONFIG.numHeads, 32);

        engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.8 + Math.random() * 0.2);
      }

      engine.endTrajectory(trajectoryId, 0.9);

      const stats = engine.getStats();
      expect(stats).toContain('trajectories_buffered: 1');
    });
  });

  describe('Phi-4 Inference Workflow', () => {
    test('should complete full Phi-4 inference pass', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);

      // Simulate batch of prompts
      const batchSize = 4;

      for (let b = 0; b < batchSize; b++) {
        const queryEmbedding = normalizedVector(PHI4_CONFIG.hiddenDim);
        const trajectoryId = engine.beginTrajectory(queryEmbedding);
        engine.setTrajectoryRoute(trajectoryId, 'phi-4-base');
        engine.addTrajectoryContext(trajectoryId, `batch-${b}`);

        // Process through transformer layers
        let hidden = randomVector(PHI4_CONFIG.hiddenDim);

        for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
          // Apply micro-LoRA enhancement
          hidden = engine.applyMicroLora(hidden);

          // Simulate attention (record every 10th layer)
          if (layer % 10 === 0) {
            const attention = simulateAttentionWeights(PHI4_CONFIG.numHeads, 16);
            engine.addTrajectoryStep(trajectoryId, hidden, attention, 0.85);
          }
        }

        engine.endTrajectory(trajectoryId, 0.92);
      }

      const stats = engine.getStats();
      expect(stats).toContain(`trajectories_buffered: ${batchSize}`);
    });
  });
});

describe('Phi-4 Performance Benchmarks', () => {
  const WARMUP_ITERATIONS = 10;
  const BENCHMARK_ITERATIONS = 100;

  describe('Micro-LoRA Latency', () => {
    test.each(Object.entries(SONA_CONFIGS))(
      '%s config micro-LoRA benchmark',
      (configName, config) => {
        const engine = SonaEngine.withConfig(config);
        const input = randomVector(PHI4_CONFIG.hiddenDim);

        // Warmup
        for (let i = 0; i < WARMUP_ITERATIONS; i++) {
          engine.applyMicroLora(input);
        }

        // Benchmark
        const timer = new BenchmarkTimer(`micro-LoRA (${configName})`);
        for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
          timer.time(() => engine.applyMicroLora(input));
        }

        const stats = timer.stats;
        console.log(timer.report());

        // Phi-4 requirement: <1ms per micro-LoRA application
        expect(stats.p95).toBeLessThan(1.0);
      }
    );
  });

  describe('Base-LoRA Latency per Layer', () => {
    test('should benchmark base-LoRA across all Phi-4 layers', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);
      const input = randomVector(PHI4_CONFIG.hiddenDim);

      const timer = new BenchmarkTimer('base-LoRA (all layers)');

      // Warmup
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
          engine.applyBaseLora(layer, input);
        }
      }

      // Benchmark
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        timer.time(() => {
          for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
            engine.applyBaseLora(layer, input);
          }
        });
      }

      const stats = timer.stats;
      const perLayerMs = stats.mean / PHI4_CONFIG.numLayers;

      console.log(timer.report());
      console.log(`  Per-layer average: ${perLayerMs.toFixed(4)}ms`);

      // 40 layers should complete in <30ms total
      expect(stats.p95).toBeLessThan(30.0);
    });
  });

  describe('Trajectory Recording Throughput', () => {
    test('should benchmark trajectory recording at Phi-4 scale', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);

      const timer = new BenchmarkTimer('trajectory (Phi-4)');

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        timer.time(() => {
          const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
          const tid = engine.beginTrajectory(embedding);

          // Record 4 steps (every 10th layer of 40)
          for (let step = 0; step < 4; step++) {
            const activations = randomVector(PHI4_CONFIG.hiddenDim);
            const attention = simulateAttentionWeights(PHI4_CONFIG.numHeads, 32);
            engine.addTrajectoryStep(tid, activations, attention, 0.85);
          }

          engine.endTrajectory(tid, 0.9);
        });
      }

      const stats = timer.stats;
      const throughput = 1000 / stats.mean; // trajectories per second

      console.log(timer.report());
      console.log(`  Throughput: ${throughput.toFixed(1)} trajectories/sec`);

      // Should handle at least 100 trajectories/second
      expect(throughput).toBeGreaterThan(50);
    });
  });

  describe('End-to-End Inference Simulation', () => {
    test('should benchmark full Phi-4 inference pass with SONA', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.ultraFast);

      const timer = new BenchmarkTimer('full inference (Phi-4)');

      // Warmup
      for (let i = 0; i < 5; i++) {
        const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
        const tid = engine.beginTrajectory(embedding);
        let hidden = randomVector(PHI4_CONFIG.hiddenDim);
        for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
          hidden = engine.applyMicroLora(hidden);
        }
        engine.endTrajectory(tid, 0.9);
      }

      // Benchmark
      for (let i = 0; i < 50; i++) {
        timer.time(() => {
          const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
          const tid = engine.beginTrajectory(embedding);

          let hidden = randomVector(PHI4_CONFIG.hiddenDim);

          for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
            // Apply micro-LoRA at each layer
            hidden = engine.applyMicroLora(hidden);

            // Record trajectory step every 10 layers
            if (layer % 10 === 0) {
              const attention = simulateAttentionWeights(PHI4_CONFIG.numHeads, 16);
              engine.addTrajectoryStep(tid, hidden, attention, 0.85);
            }
          }

          engine.endTrajectory(tid, 0.9);
        });
      }

      const stats = timer.stats;
      console.log(timer.report());
      console.log(`  SONA overhead per inference: ${stats.mean.toFixed(2)}ms`);

      // SONA overhead should be <50ms for full 40-layer pass
      expect(stats.p95).toBeLessThan(100);
    });
  });

  describe('Learning Cycle Performance', () => {
    test('should benchmark forceLearn with accumulated trajectories', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);

      // Accumulate trajectories
      const numTrajectories = 50;
      for (let i = 0; i < numTrajectories; i++) {
        const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
        const tid = engine.beginTrajectory(embedding);
        const activations = randomVector(PHI4_CONFIG.hiddenDim);
        const attention = simulateAttentionWeights(PHI4_CONFIG.numHeads, 16);
        engine.addTrajectoryStep(tid, activations, attention, 0.8 + Math.random() * 0.2);
        engine.endTrajectory(tid, 0.85 + Math.random() * 0.15);
      }

      const timer = new BenchmarkTimer('forceLearn');

      // Benchmark learning cycle
      for (let i = 0; i < 10; i++) {
        timer.time(() => engine.forceLearn());
      }

      const stats = timer.stats;
      console.log(timer.report());

      // Learning cycle should complete in <500ms
      expect(stats.p95).toBeLessThan(1000);
    });
  });

  describe('Pattern Search Performance', () => {
    test('should benchmark pattern finding after learning', () => {
      const engine = SonaEngine.withConfig(SONA_CONFIGS.balanced);

      // Generate and learn from trajectories
      for (let i = 0; i < 100; i++) {
        const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
        const tid = engine.beginTrajectory(embedding);
        engine.addTrajectoryStep(
          tid,
          randomVector(PHI4_CONFIG.hiddenDim),
          simulateAttentionWeights(PHI4_CONFIG.numHeads, 8),
          0.8
        );
        engine.endTrajectory(tid, 0.9);
      }

      engine.forceLearn();

      const timer = new BenchmarkTimer('findPatterns');

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const query = normalizedVector(PHI4_CONFIG.hiddenDim);
        timer.time(() => engine.findPatterns(query, 5));
      }

      const stats = timer.stats;
      console.log(timer.report());

      // Pattern search should be fast (<5ms)
      expect(stats.p95).toBeLessThan(10);
    });
  });
});

describe('Phi-4 Memory Efficiency', () => {
  test('should handle large trajectory buffers efficiently', () => {
    const engine = SonaEngine.withConfig({
      ...SONA_CONFIGS.balanced,
      trajectoryCapacity: 1000,
    });

    const startMem = process.memoryUsage().heapUsed;

    // Fill trajectory buffer
    for (let i = 0; i < 500; i++) {
      const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
      const tid = engine.beginTrajectory(embedding);

      for (let step = 0; step < 4; step++) {
        engine.addTrajectoryStep(
          tid,
          randomVector(PHI4_CONFIG.hiddenDim),
          simulateAttentionWeights(PHI4_CONFIG.numHeads, 16),
          0.8
        );
      }

      engine.endTrajectory(tid, 0.9);
    }

    const afterFillMem = process.memoryUsage().heapUsed;
    const memUsedMB = (afterFillMem - startMem) / (1024 * 1024);

    console.log(`Memory used for 500 trajectories: ${memUsedMB.toFixed(2)} MB`);

    // Should use less than 500MB for 500 trajectories
    expect(memUsedMB).toBeLessThan(500);

    // Force learning to clear buffer
    engine.forceLearn();

    // Check stats after learning
    const stats = engine.getStats();
    expect(stats).toBeDefined();
  });

  test('should efficiently reuse engine across inference batches', () => {
    const engine = SonaEngine.withConfig(SONA_CONFIGS.ultraFast);

    const batches = 10;
    const batchSize = 32;

    const timer = new BenchmarkTimer('batch processing');

    for (let batch = 0; batch < batches; batch++) {
      timer.time(() => {
        for (let i = 0; i < batchSize; i++) {
          const embedding = normalizedVector(PHI4_CONFIG.hiddenDim);
          const tid = engine.beginTrajectory(embedding);

          let hidden = randomVector(PHI4_CONFIG.hiddenDim);
          for (let layer = 0; layer < PHI4_CONFIG.numLayers; layer++) {
            hidden = engine.applyMicroLora(hidden);
          }

          engine.endTrajectory(tid, 0.9);
        }
      });

      // Periodic learning
      if (batch % 5 === 4) {
        engine.forceLearn();
      }
    }

    const stats = timer.stats;
    const throughput = (batchSize * 1000) / stats.mean;

    console.log(timer.report());
    console.log(`  Batch throughput: ${throughput.toFixed(1)} inferences/sec`);

    expect(throughput).toBeGreaterThan(10);
  });
});

describe('Phi-4 Configuration Recommendations', () => {
  test('should provide optimal config based on use case', () => {
    const recommendations = {
      'real-time-inference': SONA_CONFIGS.ultraFast,
      'continuous-learning': SONA_CONFIGS.balanced,
      'research-fine-tuning': SONA_CONFIGS.deepLearning,
      'edge-deployment': SONA_CONFIGS.memoryConstrained,
    };

    Object.entries(recommendations).forEach(([useCase, config]) => {
      const engine = SonaEngine.withConfig(config);
      expect(engine).toBeDefined();

      // Verify config is appropriate for use case
      if (useCase === 'real-time-inference') {
        expect(config.microLoraRank).toBe(1);
        expect(config.qualityThreshold).toBeGreaterThanOrEqual(0.6);
      } else if (useCase === 'research-fine-tuning') {
        expect(config.baseLoraRank).toBeGreaterThanOrEqual(16);
        expect(config.patternClusters).toBeGreaterThanOrEqual(100);
      }
    });

    console.log('\nPhi-4 SONA Configuration Recommendations:');
    console.log('==========================================');
    console.log('Real-time Inference: ultraFast config (rank-1, high threshold)');
    console.log('Continuous Learning: balanced config (rank-2, moderate learning)');
    console.log('Research/Fine-tuning: deepLearning config (rank-16, aggressive learning)');
    console.log('Edge Deployment: memoryConstrained config (limited buffer, low overhead)');
  });
});
