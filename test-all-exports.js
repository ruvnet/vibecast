/**
 * @ruvector/attention v0.1.1 - Complete Feature Test
 *
 * Tests all 39 exports across 6 categories
 */

const attention = require('@ruvector/attention');

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const DIM = 64;
const NUM_KEYS = 10;

// Helper to create test vectors
const vec = (dim = DIM) => {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
  return v;
};

const normalize = (v) => {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] ** 2;
  norm = Math.sqrt(norm);
  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] / norm;
  return result;
};

// Test data
const query = normalize(vec());
const keys = Array.from({ length: NUM_KEYS }, () => normalize(vec()));
const values = Array.from({ length: NUM_KEYS }, () => normalize(vec()));

// ============================================================================
// RESULTS TRACKING
// ============================================================================

const results = { passed: 0, failed: 0, errors: [] };

const test = (name, fn) => {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        results.passed++;
        console.log(`   ✅ ${name}`);
      }).catch(err => {
        results.failed++;
        results.errors.push({ name, error: err.message });
        console.log(`   ❌ ${name}: ${err.message}`);
      });
    }
    results.passed++;
    console.log(`   ✅ ${name}`);
  } catch (err) {
    results.failed++;
    results.errors.push({ name, error: err.message });
    console.log(`   ❌ ${name}: ${err.message}`);
  }
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('═'.repeat(70));
  console.log('   @ruvector/attention v0.1.1 - Complete Feature Test');
  console.log('═'.repeat(70));

  // ---------------------------------------------------------------------------
  // 1. CORE ATTENTION (6 exports)
  // ---------------------------------------------------------------------------
  console.log('\n📦 Core Attention Mechanisms\n');

  test('DotProductAttention', () => {
    const dpa = new attention.DotProductAttention(DIM);
    const out = dpa.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('MultiHeadAttention', () => {
    const mha = new attention.MultiHeadAttention(DIM, 8);
    const out = mha.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('HyperbolicAttention', () => {
    const hyp = new attention.HyperbolicAttention(DIM, 1.0);
    const out = hyp.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('FlashAttention', () => {
    const flash = new attention.FlashAttention(DIM, 16);
    const out = flash.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('LinearAttention', () => {
    const lin = new attention.LinearAttention(DIM, 32);
    const out = lin.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('MoEAttention', () => {
    const moe = new attention.MoEAttention({ dim: DIM, numExperts: 4, topK: 2 });
    const out = moe.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  // ---------------------------------------------------------------------------
  // 2. GRAPH ATTENTION (4 exports)
  // ---------------------------------------------------------------------------
  console.log('\n📊 Graph Attention Mechanisms\n');

  test('GraphRoPeAttention', () => {
    const rope = new attention.GraphRoPeAttention({ dim: DIM, maxPosition: 16 });
    const out = rope.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('EdgeFeaturedAttention', () => {
    const edge = new attention.EdgeFeaturedAttention({ nodeDim: DIM, edgeDim: 16, numHeads: 4 });
    const out = edge.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('DualSpaceAttention', () => {
    const dual = new attention.DualSpaceAttention({
      dim: DIM,
      curvature: 1.0,
      euclideanWeight: 0.5,
      hyperbolicWeight: 0.5
    });
    const out = dual.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  test('LocalGlobalAttention', () => {
    const lg = new attention.LocalGlobalAttention(DIM, 4, 2);
    const out = lg.compute(query, keys, values);
    if (out.length !== DIM) throw new Error(`Expected ${DIM}, got ${out.length}`);
  });

  // ---------------------------------------------------------------------------
  // 3. TRAINING (11 exports)
  // ---------------------------------------------------------------------------
  console.log('\n🎓 Training Utilities\n');

  test('AdamOptimizer', () => {
    const adam = new attention.AdamOptimizer(0.001, 0.9, 0.999, 1e-8);
    if (typeof adam.learningRate !== 'number') throw new Error('Missing learningRate');
    if (typeof adam.step !== 'function') throw new Error('Missing step');
  });

  test('AdamWOptimizer', () => {
    const adamw = new attention.AdamWOptimizer(0.001, 0.9, 0.999, 1e-8, 0.01);
    if (typeof adamw.learningRate !== 'number') throw new Error('Missing learningRate');
  });

  test('SgdOptimizer', () => {
    const sgd = new attention.SgdOptimizer(0.01, 0.9);
    if (typeof sgd.learningRate !== 'number') throw new Error('Missing learningRate');
  });

  test('InfoNceLoss', () => {
    const loss = new attention.InfoNceLoss(0.07);
    const anchor = normalize(vec());
    const positive = normalize(vec());
    const negatives = [normalize(vec()), normalize(vec())];
    const l = loss.compute(anchor, positive, negatives);
    if (typeof l !== 'number' || isNaN(l)) throw new Error('Invalid loss value');
  });

  test('LocalContrastiveLoss', () => {
    const loss = new attention.LocalContrastiveLoss(0.07, 1.0);
    if (typeof loss !== 'object') throw new Error('Failed to create');
  });

  test('SpectralRegularization', () => {
    const reg = new attention.SpectralRegularization(0.01, 5);
    if (typeof reg !== 'object') throw new Error('Failed to create');
  });

  test('CurriculumScheduler', () => {
    const sched = new attention.CurriculumScheduler([
      { startEpoch: 0, endEpoch: 10, startValue: 0.1, endValue: 1.0 }
    ]);
    if (typeof sched !== 'object') throw new Error('Failed to create');
  });

  test('TemperatureAnnealing', () => {
    const anneal = new attention.TemperatureAnnealing(1.0, 0.1, 100, attention.DecayType.Cosine);
    if (typeof anneal !== 'object') throw new Error('Failed to create');
  });

  test('LearningRateScheduler', () => {
    const sched = new attention.LearningRateScheduler(0.001, 100, 1000);
    const lr = sched.getLr();
    if (typeof lr !== 'number') throw new Error('Invalid learning rate');
  });

  test('HardNegativeMiner', () => {
    const miner = new attention.HardNegativeMiner(5, 0.8);
    if (typeof miner !== 'object') throw new Error('Failed to create');
  });

  test('InBatchMiner', () => {
    const miner = new attention.InBatchMiner(true);
    if (typeof miner !== 'object') throw new Error('Failed to create');
  });

  // ---------------------------------------------------------------------------
  // 4. ASYNC/BATCH OPERATIONS
  // ---------------------------------------------------------------------------
  console.log('\n⚡ Async/Batch Operations\n');

  await test('parallelAttentionCompute', async () => {
    const result = await attention.parallelAttentionCompute(
      attention.AttentionType.ScaledDotProduct,
      [query],
      [keys],
      [values],
      2
    );
    if (!Array.isArray(result) || result.length !== 1) throw new Error('Invalid result');
  });

  await test('batchAttentionCompute', async () => {
    const result = await attention.batchAttentionCompute(
      attention.AttentionType.ScaledDotProduct,
      [query, query],
      [keys, keys],
      [values, values],
      { batchSize: 2 }
    );
    if (!Array.isArray(result)) throw new Error('Invalid result');
  });

  await test('computeAttentionAsync', async () => {
    const result = await attention.computeAttentionAsync(
      attention.AttentionType.ScaledDotProduct,
      query,
      keys,
      values,
      {}
    );
    if (result.length !== DIM) throw new Error('Invalid result');
  });

  await test('computeFlashAttentionAsync', async () => {
    const result = await attention.computeFlashAttentionAsync(query, keys, values, 16);
    if (result.length !== DIM) throw new Error('Invalid result');
  });

  await test('computeHyperbolicAttentionAsync', async () => {
    const result = await attention.computeHyperbolicAttentionAsync(query, keys, values, 1.0);
    if (result.length !== DIM) throw new Error('Invalid result');
  });

  test('StreamProcessor', () => {
    const stream = new attention.StreamProcessor(4, 100);
    if (typeof stream !== 'object') throw new Error('Failed to create');
  });

  test('benchmarkAttention', () => {
    const result = attention.benchmarkAttention(
      attention.AttentionType.ScaledDotProduct,
      DIM,
      NUM_KEYS,
      100
    );
    if (typeof result !== 'object') throw new Error('Invalid result');
  });

  await test('batchFlashAttentionCompute', async () => {
    const result = await attention.batchFlashAttentionCompute(
      [query],
      [keys],
      [values],
      16
    );
    if (!Array.isArray(result)) throw new Error('Invalid result');
  });

  // ---------------------------------------------------------------------------
  // 5. HYPERBOLIC MATH (5 exports)
  // ---------------------------------------------------------------------------
  console.log('\n🔮 Hyperbolic Math Functions\n');

  test('projectToPoincareBall', () => {
    const v = vec();
    const proj = attention.projectToPoincareBall(v, 1.0);
    if (proj.length !== DIM) throw new Error('Invalid projection');
  });

  test('poincareDistance', () => {
    const a = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const b = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const dist = attention.poincareDistance(a, b, 1.0);
    if (typeof dist !== 'number' || isNaN(dist)) throw new Error('Invalid distance');
  });

  test('mobiusAddition', () => {
    const a = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const b = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const sum = attention.mobiusAddition(a, b, 1.0);
    if (sum.length !== DIM) throw new Error('Invalid sum');
  });

  test('expMap', () => {
    const base = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const tangent = new Float32Array(DIM).fill(0.01);
    const result = attention.expMap(base, tangent, 1.0);
    if (result.length !== DIM) throw new Error('Invalid result');
  });

  test('logMap', () => {
    const base = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const point = attention.projectToPoincareBall(normalize(vec()), 1.0);
    const result = attention.logMap(base, point, 1.0);
    if (result.length !== DIM) throw new Error('Invalid result');
  });

  // ---------------------------------------------------------------------------
  // 6. UTILITIES
  // ---------------------------------------------------------------------------
  console.log('\n🛠️ Utilities\n');

  test('version', () => {
    const v = attention.version();
    if (typeof v !== 'string') throw new Error('Invalid version');
  });

  test('info', () => {
    const i = attention.info();
    if (!i.name || !i.version || !Array.isArray(i.features)) throw new Error('Invalid info');
  });

  test('AttentionType enum', () => {
    const types = attention.AttentionType;
    if (!types.ScaledDotProduct || !types.Flash) throw new Error('Missing types');
  });

  test('DecayType enum', () => {
    const types = attention.DecayType;
    if (!types.Linear || !types.Cosine) throw new Error('Missing types');
  });

  test('MiningStrategy enum', () => {
    const types = attention.MiningStrategy;
    if (typeof types !== 'object') throw new Error('Missing strategies');
  });

  // ============================================================================
  // BENCHMARK
  // ============================================================================

  console.log('\n' + '─'.repeat(70));
  console.log('⚡ Performance Benchmark (1000 iterations)');
  console.log('─'.repeat(70) + '\n');

  const benchmarks = [
    ['DotProduct', () => new attention.DotProductAttention(DIM)],
    ['MultiHead', () => new attention.MultiHeadAttention(DIM, 8)],
    ['Flash', () => new attention.FlashAttention(DIM, 16)],
    ['Linear', () => new attention.LinearAttention(DIM, 32)],
    ['Hyperbolic', () => new attention.HyperbolicAttention(DIM, 1.0)],
    ['MoE', () => new attention.MoEAttention({ dim: DIM, numExperts: 4, topK: 2 })],
    ['GraphRoPE', () => new attention.GraphRoPeAttention({ dim: DIM, maxPosition: 16 })],
    ['DualSpace', () => new attention.DualSpaceAttention({ dim: DIM, curvature: 1.0, euclideanWeight: 0.5, hyperbolicWeight: 0.5 })],
    ['LocalGlobal', () => new attention.LocalGlobalAttention(DIM, 4, 2)],
    ['EdgeFeatured', () => new attention.EdgeFeaturedAttention({ nodeDim: DIM, edgeDim: 16, numHeads: 4 })],
  ];

  const iterations = 1000;

  for (const [name, factory] of benchmarks) {
    const attn = factory();
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      attn.compute(query, keys, values);
    }
    const elapsed = performance.now() - start;
    const opsPerSec = Math.round(iterations / (elapsed / 1000));
    const bar = '▓'.repeat(Math.min(25, Math.round(opsPerSec / 4000)));
    console.log(`   ${name.padEnd(14)} ${(elapsed / iterations).toFixed(3).padStart(6)}ms  ${opsPerSec.toLocaleString().padStart(7)} ops/s ${bar}`);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '═'.repeat(70));
  console.log('📊 Test Summary');
  console.log('═'.repeat(70));

  const info = attention.info();
  console.log(`
   Package:   @ruvector/attention@0.1.1
   Features:  ${info.features.length} (${info.features.slice(0, 5).join(', ')}...)

   Tests Passed: ${results.passed}
   Tests Failed: ${results.failed}
   Total:        ${results.passed + results.failed}
`);

  if (results.errors.length > 0) {
    console.log('   Errors:');
    for (const { name, error } of results.errors) {
      console.log(`      - ${name}: ${error}`);
    }
    console.log();
  }

  console.log('═'.repeat(70));
  if (results.failed === 0) {
    console.log('   ✅ ALL TESTS PASSED - All 39 exports working!');
  } else {
    console.log(`   ⚠️  ${results.failed} test(s) need API adjustments`);
    console.log(`   ✅ ${results.passed} exports verified working`);
  }
  console.log('═'.repeat(70) + '\n');
}

runTests().catch(console.error);
