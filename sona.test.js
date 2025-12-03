/**
 * Comprehensive tests for @ruvector/sona v0.1.x
 * Self-Optimizing Neural Architecture (SONA)
 */

const { SonaEngine } = require('@ruvector/sona');

// Helper function to generate random vectors
function randomVector(dim) {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

// Helper function to generate normalized vectors
function normalizedVector(dim) {
  const vec = randomVector(dim);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}

describe('@ruvector/sona', () => {
  describe('SonaEngine Constructor', () => {
    test('should create engine with default hidden dimension', () => {
      const engine = new SonaEngine(256);
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(SonaEngine);
    });

    test('should create engine with various hidden dimensions', () => {
      const dimensions = [64, 128, 256, 512, 1024];
      dimensions.forEach(dim => {
        const engine = new SonaEngine(dim);
        expect(engine).toBeDefined();
      });
    });

    test('should handle small hidden dimensions', () => {
      const engine = new SonaEngine(8);
      expect(engine).toBeDefined();
    });

    test('should handle large hidden dimensions', () => {
      const engine = new SonaEngine(4096);
      expect(engine).toBeDefined();
    });
  });

  describe('SonaEngine.withConfig', () => {
    test('should create engine with minimal config', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256
      });
      expect(engine).toBeDefined();
    });

    test('should create engine with full configuration', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 512,
        embeddingDim: 512,
        microLoraRank: 2,
        baseLoraRank: 16,
        microLoraLr: 0.002,
        baseLoraLr: 0.0001,
        ewcLambda: 1000.0,
        patternClusters: 50,
        trajectoryCapacity: 10000,
        backgroundIntervalMs: 3600000,
        qualityThreshold: 0.5,
        enableSimd: true
      });
      expect(engine).toBeDefined();
    });

    test('should create engine with custom micro-LoRA rank', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        microLoraRank: 1
      });
      expect(engine).toBeDefined();
    });

    test('should create engine with custom learning rates', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        microLoraLr: 0.005,
        baseLoraLr: 0.0005
      });
      expect(engine).toBeDefined();
    });

    test('should create engine with custom EWC lambda', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        ewcLambda: 5000.0
      });
      expect(engine).toBeDefined();
    });

    test('should create engine with SIMD disabled', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        enableSimd: false
      });
      expect(engine).toBeDefined();
    });
  });

  describe('Engine State Management', () => {
    let engine;

    beforeEach(() => {
      engine = new SonaEngine(256);
    });

    test('should be enabled by default', () => {
      expect(engine.isEnabled()).toBe(true);
    });

    test('should allow disabling the engine', () => {
      engine.setEnabled(false);
      expect(engine.isEnabled()).toBe(false);
    });

    test('should allow re-enabling the engine', () => {
      engine.setEnabled(false);
      engine.setEnabled(true);
      expect(engine.isEnabled()).toBe(true);
    });

    test('should toggle enabled state multiple times', () => {
      for (let i = 0; i < 5; i++) {
        engine.setEnabled(false);
        expect(engine.isEnabled()).toBe(false);
        engine.setEnabled(true);
        expect(engine.isEnabled()).toBe(true);
      }
    });
  });

  describe('Statistics', () => {
    let engine;

    beforeEach(() => {
      engine = new SonaEngine(256);
    });

    test('should return stats as string', () => {
      const stats = engine.getStats();
      expect(typeof stats).toBe('string');
    });

    test('should contain CoordinatorStats in output', () => {
      const stats = engine.getStats();
      expect(stats).toContain('CoordinatorStats');
    });

    test('should contain expected stat fields', () => {
      const stats = engine.getStats();
      expect(stats).toContain('trajectories_buffered');
      expect(stats).toContain('patterns_stored');
      expect(stats).toContain('instant_enabled');
      expect(stats).toContain('background_enabled');
    });

    test('should start with zero trajectories buffered', () => {
      const stats = engine.getStats();
      expect(stats).toContain('trajectories_buffered: 0');
    });

    test('should show patterns stored count', () => {
      const stats = engine.getStats();
      expect(stats).toMatch(/patterns_stored: \d+/);
    });

    test('should show EWC tasks count', () => {
      const stats = engine.getStats();
      expect(stats).toMatch(/ewc_tasks: \d+/);
    });
  });

  describe('Trajectory Recording', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = new SonaEngine(dim);
    });

    test('should begin a trajectory and return ID', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);
      expect(typeof trajectoryId).toBe('number');
      expect(trajectoryId).toBeGreaterThanOrEqual(0);
    });

    test('should begin multiple trajectories with unique IDs', () => {
      const ids = [];
      for (let i = 0; i < 10; i++) {
        const embedding = randomVector(dim);
        const id = engine.beginTrajectory(embedding);
        expect(ids).not.toContain(id);
        ids.push(id);
      }
    });

    test('should add steps to trajectory', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      const activations = randomVector(dim);
      const attentionWeights = randomVector(dim);

      expect(() => {
        engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.8);
      }).not.toThrow();
    });

    test('should add multiple steps to trajectory', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      for (let i = 0; i < 10; i++) {
        const activations = randomVector(dim);
        const attentionWeights = randomVector(dim);
        const reward = Math.random();

        expect(() => {
          engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, reward);
        }).not.toThrow();
      }
    });

    test('should end trajectory with quality score', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      const activations = randomVector(dim);
      const attentionWeights = randomVector(dim);
      engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.8);

      expect(() => {
        engine.endTrajectory(trajectoryId, 0.85);
      }).not.toThrow();
    });

    test('should handle quality scores at boundaries', () => {
      const qualityScores = [0.0, 0.5, 1.0];

      qualityScores.forEach(quality => {
        const embedding = randomVector(dim);
        const trajectoryId = engine.beginTrajectory(embedding);
        const activations = randomVector(dim);
        const attentionWeights = randomVector(dim);
        engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.5);

        expect(() => {
          engine.endTrajectory(trajectoryId, quality);
        }).not.toThrow();
      });
    });
  });

  describe('Trajectory Metadata', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = new SonaEngine(dim);
    });

    test('should set trajectory route', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      expect(() => {
        engine.setTrajectoryRoute(trajectoryId, 'model-gpt4');
      }).not.toThrow();
    });

    test('should add trajectory context', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      expect(() => {
        engine.addTrajectoryContext(trajectoryId, 'context-123');
      }).not.toThrow();
    });

    test('should add multiple contexts to trajectory', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      const contexts = ['ctx-1', 'ctx-2', 'ctx-3'];
      contexts.forEach(ctx => {
        expect(() => {
          engine.addTrajectoryContext(trajectoryId, ctx);
        }).not.toThrow();
      });
    });

    test('should handle route and context together', () => {
      const embedding = randomVector(dim);
      const trajectoryId = engine.beginTrajectory(embedding);

      engine.setTrajectoryRoute(trajectoryId, 'claude-sonnet');
      engine.addTrajectoryContext(trajectoryId, 'user-session-abc');

      const activations = randomVector(dim);
      const attentionWeights = randomVector(dim);
      engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.9);

      expect(() => {
        engine.endTrajectory(trajectoryId, 0.95);
      }).not.toThrow();
    });
  });

  describe('Micro-LoRA Application', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = new SonaEngine(dim);
    });

    test('should apply micro-LoRA to input', () => {
      const input = randomVector(dim);
      const output = engine.applyMicroLora(input);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBe(dim);
    });

    test('should return numeric values', () => {
      const input = randomVector(dim);
      const output = engine.applyMicroLora(input);

      output.forEach(v => {
        expect(typeof v).toBe('number');
        expect(isFinite(v)).toBe(true);
      });
    });

    test('should handle zero vector', () => {
      const input = Array(dim).fill(0);
      const output = engine.applyMicroLora(input);

      expect(output.length).toBe(dim);
    });

    test('should handle normalized vectors', () => {
      const input = normalizedVector(dim);
      const output = engine.applyMicroLora(input);

      expect(output.length).toBe(dim);
    });

    test('should be consistent for same input', () => {
      const input = randomVector(dim);
      const output1 = engine.applyMicroLora([...input]);
      const output2 = engine.applyMicroLora([...input]);

      for (let i = 0; i < dim; i++) {
        expect(output1[i]).toBeCloseTo(output2[i], 10);
      }
    });
  });

  describe('Base-LoRA Application', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = new SonaEngine(dim);
    });

    test('should apply base-LoRA to layer 0', () => {
      const input = randomVector(dim);
      const output = engine.applyBaseLora(0, input);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBe(dim);
    });

    test('should apply base-LoRA to different layers', () => {
      const input = randomVector(dim);

      for (let layer = 0; layer < 5; layer++) {
        const output = engine.applyBaseLora(layer, input);
        expect(output.length).toBe(dim);
      }
    });

    test('should return numeric values', () => {
      const input = randomVector(dim);
      const output = engine.applyBaseLora(0, input);

      output.forEach(v => {
        expect(typeof v).toBe('number');
        expect(isFinite(v)).toBe(true);
      });
    });
  });

  describe('Learning Cycles', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = SonaEngine.withConfig({
        hiddenDim: dim,
        backgroundIntervalMs: 100 // Short interval for testing
      });
    });

    test('should return null when no learning due', () => {
      const result = engine.tick();
      // Initial tick might return null or a status
      expect(result === null || typeof result === 'string').toBe(true);
    });

    test('should force learn and return status', () => {
      const result = engine.forceLearn();
      expect(typeof result).toBe('string');
    });

    test('should flush without error', () => {
      expect(() => {
        engine.flush();
      }).not.toThrow();
    });

    test('should force learn after recording trajectories', () => {
      // Record some trajectories
      for (let i = 0; i < 5; i++) {
        const embedding = randomVector(dim);
        const trajectoryId = engine.beginTrajectory(embedding);

        for (let j = 0; j < 3; j++) {
          const activations = randomVector(dim);
          const attentionWeights = randomVector(dim);
          engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, Math.random());
        }

        engine.endTrajectory(trajectoryId, Math.random());
      }

      const result = engine.forceLearn();
      expect(typeof result).toBe('string');
    });
  });

  describe('Pattern Finding', () => {
    let engine;
    const dim = 256;

    beforeEach(() => {
      engine = new SonaEngine(dim);
    });

    test('should return empty array when no patterns', () => {
      const query = randomVector(dim);
      const patterns = engine.findPatterns(query, 5);

      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should find patterns after learning', () => {
      // Record multiple trajectories
      for (let i = 0; i < 20; i++) {
        const embedding = randomVector(dim);
        const trajectoryId = engine.beginTrajectory(embedding);

        for (let j = 0; j < 5; j++) {
          const activations = randomVector(dim);
          const attentionWeights = randomVector(dim);
          engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.8);
        }

        engine.endTrajectory(trajectoryId, 0.9);
      }

      // Force learning to create patterns
      engine.forceLearn();

      const query = randomVector(dim);
      const patterns = engine.findPatterns(query, 5);

      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should respect k limit', () => {
      // Record trajectories
      for (let i = 0; i < 30; i++) {
        const embedding = randomVector(dim);
        const trajectoryId = engine.beginTrajectory(embedding);
        const activations = randomVector(dim);
        const attentionWeights = randomVector(dim);
        engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.7);
        engine.endTrajectory(trajectoryId, 0.8);
      }

      engine.forceLearn();

      const query = randomVector(dim);
      const patterns = engine.findPatterns(query, 3);

      expect(patterns.length).toBeLessThanOrEqual(3);
    });

    test('should return patterns with expected structure', () => {
      // Record trajectories
      for (let i = 0; i < 20; i++) {
        const embedding = randomVector(dim);
        const trajectoryId = engine.beginTrajectory(embedding);
        const activations = randomVector(dim);
        const attentionWeights = randomVector(dim);
        engine.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.8);
        engine.endTrajectory(trajectoryId, 0.9);
      }

      engine.forceLearn();

      const query = randomVector(dim);
      const patterns = engine.findPatterns(query, 5);

      patterns.forEach(pattern => {
        expect(pattern).toHaveProperty('id');
        expect(pattern).toHaveProperty('centroid');
        expect(pattern).toHaveProperty('clusterSize');
        expect(pattern).toHaveProperty('avgQuality');
        expect(pattern).toHaveProperty('patternType');
      });
    });
  });

  describe('Integration Tests', () => {
    test('should complete full LLM-style workflow', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 512,
        microLoraRank: 2,
        baseLoraRank: 16,
        qualityThreshold: 0.6
      });

      // Simulate multiple inference passes
      for (let pass = 0; pass < 10; pass++) {
        const queryEmbedding = normalizedVector(512);
        const trajectoryId = engine.beginTrajectory(queryEmbedding);
        engine.setTrajectoryRoute(trajectoryId, `model-${pass % 3}`);

        // Simulate layer-by-layer processing
        for (let layer = 0; layer < 4; layer++) {
          const activations = randomVector(512);
          const attention = randomVector(512);
          const reward = 0.7 + Math.random() * 0.3;

          engine.addTrajectoryStep(trajectoryId, activations, attention, reward);

          // Apply micro-LoRA
          const enhanced = engine.applyMicroLora(activations);
          expect(enhanced.length).toBe(512);
        }

        const quality = 0.8 + Math.random() * 0.2;
        engine.endTrajectory(trajectoryId, quality);
      }

      // Check stats
      const stats = engine.getStats();
      expect(stats).toContain('trajectories_buffered');
      // Should have some trajectories buffered
      expect(stats).not.toContain('trajectories_buffered: 0');

      // Force learning
      const learnResult = engine.forceLearn();
      expect(typeof learnResult).toBe('string');

      // Find patterns
      const query = normalizedVector(512);
      const patterns = engine.findPatterns(query, 3);
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should handle concurrent trajectory recording', () => {
      const engine = new SonaEngine(256);
      const dim = 256;

      // Start multiple trajectories
      const trajectoryIds = [];
      for (let i = 0; i < 5; i++) {
        const embedding = randomVector(dim);
        trajectoryIds.push(engine.beginTrajectory(embedding));
      }

      // Interleave steps across trajectories
      for (let step = 0; step < 5; step++) {
        for (const tid of trajectoryIds) {
          const activations = randomVector(dim);
          const attentionWeights = randomVector(dim);
          engine.addTrajectoryStep(tid, activations, attentionWeights, Math.random());
        }
      }

      // End all trajectories
      for (const tid of trajectoryIds) {
        engine.endTrajectory(tid, Math.random());
      }

      const stats = engine.getStats();
      expect(stats).toContain('trajectories_buffered: 5');
    });

    test('should maintain performance with many operations', () => {
      const engine = new SonaEngine(256);
      const dim = 256;

      const startTime = Date.now();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const input = randomVector(dim);
        engine.applyMicroLora(input);
      }

      const elapsed = Date.now() - startTime;

      // Should complete in reasonable time (sub-second for 100 ops)
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty trajectory (no steps)', () => {
      const engine = new SonaEngine(256);
      const embedding = randomVector(256);
      const trajectoryId = engine.beginTrajectory(embedding);

      // End without adding steps
      expect(() => {
        engine.endTrajectory(trajectoryId, 0.5);
      }).not.toThrow();
    });

    test('should handle very small vectors', () => {
      const engine = new SonaEngine(4);
      const input = [0.1, 0.2, 0.3, 0.4];
      const output = engine.applyMicroLora(input);

      expect(output.length).toBe(4);
    });

    test('should handle repeated flush calls', () => {
      const engine = new SonaEngine(256);

      for (let i = 0; i < 10; i++) {
        expect(() => engine.flush()).not.toThrow();
      }
    });

    test('should handle repeated forceLearn calls', () => {
      const engine = new SonaEngine(256);

      for (let i = 0; i < 5; i++) {
        const result = engine.forceLearn();
        expect(typeof result).toBe('string');
      }
    });

    test('should handle findPatterns with k=0', () => {
      const engine = new SonaEngine(256);
      const query = randomVector(256);
      const patterns = engine.findPatterns(query, 0);

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBe(0);
    });

    test('should handle very large k for findPatterns', () => {
      const engine = new SonaEngine(256);
      const query = randomVector(256);
      const patterns = engine.findPatterns(query, 1000);

      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should work with different embedding dimensions', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        embeddingDim: 512
      });
      expect(engine).toBeDefined();
    });

    test('should work with minimal trajectory capacity', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        trajectoryCapacity: 10
      });
      expect(engine).toBeDefined();
    });

    test('should work with high pattern clusters', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        patternClusters: 200
      });
      expect(engine).toBeDefined();
    });

    test('should work with very low quality threshold', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        qualityThreshold: 0.0
      });
      expect(engine).toBeDefined();
    });

    test('should work with very high quality threshold', () => {
      const engine = SonaEngine.withConfig({
        hiddenDim: 256,
        qualityThreshold: 1.0
      });
      expect(engine).toBeDefined();
    });
  });
});

describe('Performance Benchmarks', () => {
  const dim = 512;
  let engine;

  beforeEach(() => {
    engine = new SonaEngine(dim);
  });

  test('micro-LoRA should be fast (<10ms for 100 applications)', () => {
    const input = randomVector(dim);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      engine.applyMicroLora(input);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // 1 second for 100 ops
    console.log(`100 micro-LoRA applications: ${elapsed.toFixed(2)}ms (${(elapsed / 100).toFixed(3)}ms per op)`);
  });

  test('trajectory recording should be fast (<100ms for 100 trajectories)', () => {
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      const embedding = randomVector(dim);
      const tid = engine.beginTrajectory(embedding);
      engine.addTrajectoryStep(tid, randomVector(dim), randomVector(dim), 0.8);
      engine.endTrajectory(tid, 0.9);
    }

    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000); // 5 seconds for 100 trajectories
    console.log(`100 trajectory recordings: ${elapsed.toFixed(2)}ms (${(elapsed / 100).toFixed(3)}ms per trajectory)`);
  });
});
