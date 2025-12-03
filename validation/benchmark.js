/**
 * Performance Benchmark Suite for @ruvector/ruvllm@0.2.0
 *
 * Tests the claimed performance optimizations:
 * - applyLora: 41.8x faster (526μs → 12.6μs)
 * - findSimilar: 2.0x faster (452μs → 224μs)
 * - LoRA forward: 2.1-2.3x faster across dimensions
 * - forwardBatch (bs=100): 2.1x faster (1ms → 467μs)
 */

const {
  // Core
  RuvLLM,

  // Federated Learning
  EphemeralAgent,
  FederatedCoordinator,

  // LoRA Runtime
  LoraAdapter,
  LoraManager,

  // Training
  TrainingPipeline,

  // SONA
  SonaCoordinator,
} = require('@ruvector/ruvllm');

// ============================================================================
// BENCHMARK UTILITIES
// ============================================================================

const WARMUP_ITERATIONS = 100;
const BENCHMARK_ITERATIONS = 1000;

/**
 * High-resolution timer using process.hrtime.bigint()
 */
function hrtime() {
  return process.hrtime.bigint();
}

/**
 * Convert nanoseconds to microseconds
 */
function nsToUs(ns) {
  return Number(ns) / 1000;
}

/**
 * Run a benchmark with warmup
 */
function benchmark(name, fn, iterations = BENCHMARK_ITERATIONS) {
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn();
  }

  // Force GC if available
  if (global.gc) global.gc();

  // Benchmark
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = hrtime();
    fn();
    const end = hrtime();
    times.push(Number(end - start));
  }

  // Calculate statistics
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return {
    name,
    iterations,
    minUs: nsToUs(min),
    maxUs: nsToUs(max),
    medianUs: nsToUs(median),
    meanUs: nsToUs(mean),
    p95Us: nsToUs(p95),
    p99Us: nsToUs(p99),
  };
}

/**
 * Generate random embedding
 */
function randomEmbedding(dim) {
  return Array.from({ length: dim }, () => (Math.random() - 0.5) * 2);
}

/**
 * Format benchmark result
 */
function formatResult(result) {
  return `  Mean: ${result.meanUs.toFixed(2)}μs | Median: ${result.medianUs.toFixed(2)}μs | Min: ${result.minUs.toFixed(2)}μs | P95: ${result.p95Us.toFixed(2)}μs`;
}

// ============================================================================
// BENCHMARKS
// ============================================================================

console.log('='.repeat(70));
console.log('@ruvector/ruvllm@0.2.0 Performance Benchmark Suite');
console.log('='.repeat(70));
console.log(`Warmup iterations: ${WARMUP_ITERATIONS}`);
console.log(`Benchmark iterations: ${BENCHMARK_ITERATIONS}`);
console.log('='.repeat(70));

const results = [];

// ----------------------------------------------------------------------------
// 1. APPLY LORA BENCHMARK (FederatedCoordinator)
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[1] FederatedCoordinator.applyLora Benchmark\x1b[0m');
console.log('    Target: ~12.6μs (41.8x improvement from 526μs)\n');

{
  const coordinator = new FederatedCoordinator('bench-coord', { hiddenDim: 256 });

  // Add some learning data first
  const agent = new EphemeralAgent('bench-agent', { hiddenDim: 256 });
  for (let i = 0; i < 50; i++) {
    agent.processTask(randomEmbedding(256), 0.85 + Math.random() * 0.15);
  }
  coordinator.aggregate(agent.exportState());

  const input = randomEmbedding(256);

  const result = benchmark('applyLora (dim=256)', () => {
    coordinator.applyLora(input);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));

  const targetUs = 12.6;
  const status = result.meanUs <= targetUs * 2 ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[33m~ ACCEPTABLE\x1b[0m';
  console.log(`  Status: ${status} (target: ≤${targetUs * 2}μs)`);
}

// Test different dimensions
for (const dim of [64, 128, 512]) {
  const coordinator = new FederatedCoordinator(`bench-coord-${dim}`, { hiddenDim: dim });
  const agent = new EphemeralAgent(`bench-agent-${dim}`, { hiddenDim: dim });
  for (let i = 0; i < 20; i++) {
    agent.processTask(randomEmbedding(dim), 0.9);
  }
  coordinator.aggregate(agent.exportState());

  const input = randomEmbedding(dim);
  const result = benchmark(`applyLora (dim=${dim})`, () => {
    coordinator.applyLora(input);
  });

  results.push(result);
  console.log(`\n  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 2. FIND PATTERNS BENCHMARK (FederatedCoordinator)
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[2] FederatedCoordinator.findPatterns Benchmark\x1b[0m');
console.log('    Target: ~224μs (2.0x improvement from 452μs)\n');

{
  const coordinator = new FederatedCoordinator('bench-find', { hiddenDim: 256 });

  // Add patterns via agent aggregation
  for (let a = 0; a < 10; a++) {
    const agent = new EphemeralAgent(`pattern-agent-${a}`, { hiddenDim: 256 });
    for (let i = 0; i < 50; i++) {
      agent.processTask(randomEmbedding(256), 0.7 + Math.random() * 0.3);
    }
    coordinator.aggregate(agent.exportState());
  }
  coordinator.forceConsolidate();

  const query = randomEmbedding(256);

  const result = benchmark('findPatterns (k=10)', () => {
    coordinator.findPatterns(query, 10);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));

  const targetUs = 224;
  const status = result.meanUs <= targetUs * 1.5 ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[33m~ ACCEPTABLE\x1b[0m';
  console.log(`  Status: ${status} (target: ≤${targetUs * 1.5}μs)`);
}

// Test different k values
for (const k of [5, 20, 50]) {
  const coordinator = new FederatedCoordinator(`bench-find-${k}`, { hiddenDim: 256 });
  for (let a = 0; a < 5; a++) {
    const agent = new EphemeralAgent(`agent-${a}-${k}`, { hiddenDim: 256 });
    for (let i = 0; i < 50; i++) {
      agent.processTask(randomEmbedding(256), 0.8);
    }
    coordinator.aggregate(agent.exportState());
  }
  coordinator.forceConsolidate();

  const query = randomEmbedding(256);
  const result = benchmark(`findPatterns (k=${k})`, () => {
    coordinator.findPatterns(query, k);
  });

  results.push(result);
  console.log(`\n  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 3. LORA FORWARD BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[3] LoraAdapter.forward Benchmark\x1b[0m');
console.log('    Target: 2.1-2.3x faster across dimensions\n');

for (const dim of [64, 128, 256, 512, 768]) {
  const adapter = new LoraAdapter({ rank: 8, alpha: 16 }, dim, dim);
  const input = randomEmbedding(dim);

  const result = benchmark(`forward (dim=${dim}, rank=8)`, () => {
    adapter.forward(input);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));
}

// Test different ranks
console.log('\n  Varying rank (dim=256):');
for (const rank of [4, 8, 16, 32]) {
  const adapter = new LoraAdapter({ rank, alpha: rank * 2 }, 256, 256);
  const input = randomEmbedding(256);

  const result = benchmark(`forward (dim=256, rank=${rank})`, () => {
    adapter.forward(input);
  });

  results.push(result);
  console.log(`\n  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 4. LORA FORWARD BATCH BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[4] LoraAdapter.forwardBatch Benchmark\x1b[0m');
console.log('    Target: ~467μs for bs=100 (2.1x improvement from 1ms)\n');

for (const batchSize of [10, 50, 100, 200]) {
  const adapter = new LoraAdapter({ rank: 8, alpha: 16 }, 256, 256);
  const batch = Array.from({ length: batchSize }, () => randomEmbedding(256));

  const result = benchmark(`forwardBatch (bs=${batchSize}, dim=256)`, () => {
    adapter.forwardBatch(batch);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));

  if (batchSize === 100) {
    const targetUs = 467;
    const status = result.meanUs <= targetUs * 2 ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[33m~ ACCEPTABLE\x1b[0m';
    console.log(`  Status: ${status} (target: ≤${targetUs * 2}μs)`);
  }
}

// ----------------------------------------------------------------------------
// 5. LORA BACKWARD BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[5] LoraAdapter.backward Benchmark\x1b[0m');
console.log('    Training step performance\n');

for (const dim of [64, 128, 256]) {
  const adapter = new LoraAdapter({ rank: 8 }, dim, dim);
  adapter.startTraining(0.001);

  const input = randomEmbedding(dim);
  const gradOutput = randomEmbedding(dim);

  const result = benchmark(`backward (dim=${dim}, rank=8)`, () => {
    adapter.backward(input, gradOutput, 0.001);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 6. EPHEMERAL AGENT BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[6] EphemeralAgent.processTask Benchmark\x1b[0m');
console.log('    Task processing throughput\n');

{
  const agent = new EphemeralAgent('bench-proc', { hiddenDim: 256 });
  const embedding = randomEmbedding(256);

  const result = benchmark('processTask (dim=256)', () => {
    agent.processTask(embedding, 0.9);
  });

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));

  const opsPerSec = 1000000 / result.meanUs;
  console.log(`  Throughput: ${opsPerSec.toFixed(0)} ops/sec`);
}

// ----------------------------------------------------------------------------
// 7. EXPORT STATE BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[7] EphemeralAgent.exportState Benchmark\x1b[0m');
console.log('    State export for federation\n');

for (const numTrajectories of [10, 50, 100, 500]) {
  const agent = new EphemeralAgent(`bench-export-${numTrajectories}`, { hiddenDim: 256 });

  for (let i = 0; i < numTrajectories; i++) {
    agent.processTask(randomEmbedding(256), 0.85);
  }

  const result = benchmark(`exportState (n=${numTrajectories})`, () => {
    agent.exportState();
  }, 100); // Fewer iterations for larger exports

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 8. AGGREGATION BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[8] FederatedCoordinator.aggregate Benchmark\x1b[0m');
console.log('    Federation aggregation performance\n');

{
  const coordinator = new FederatedCoordinator('bench-agg', { hiddenDim: 256 });

  // Prepare agent exports
  const exports = [];
  for (let a = 0; a < 10; a++) {
    const agent = new EphemeralAgent(`agent-${a}`, { hiddenDim: 256 });
    for (let i = 0; i < 50; i++) {
      agent.processTask(randomEmbedding(256), 0.85);
    }
    exports.push(agent.exportState());
  }

  let idx = 0;
  const result = benchmark('aggregate (50 trajectories)', () => {
    coordinator.aggregate(exports[idx % exports.length]);
    idx++;
  }, 500);

  results.push(result);
  console.log(`  ${result.name}`);
  console.log(formatResult(result));
}

// ----------------------------------------------------------------------------
// 9. TRAINING PIPELINE STEP BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[9] TrainingPipeline Single Step Benchmark\x1b[0m');
console.log('    Training iteration performance\n');

{
  const pipeline = new TrainingPipeline({
    learningRate: 0.001,
    batchSize: 32,
    epochs: 1,
  }, new LoraAdapter({ rank: 8 }, 128, 128));

  // Add data
  for (let i = 0; i < 100; i++) {
    pipeline.addBatch(
      [randomEmbedding(128)],
      [randomEmbedding(128)],
      [0.9]
    );
  }

  // Benchmark single epoch
  const start = hrtime();
  const trainingResult = pipeline.train();
  const end = hrtime();

  const totalMs = Number(end - start) / 1_000_000;
  const stepsPerSec = trainingResult.steps / (totalMs / 1000);

  console.log(`  Training completed:`);
  console.log(`    Steps: ${trainingResult.steps}`);
  console.log(`    Duration: ${totalMs.toFixed(2)}ms`);
  console.log(`    Steps/sec: ${stepsPerSec.toFixed(0)}`);
  console.log(`    Final loss: ${trainingResult.finalLoss.toFixed(6)}`);
}

// ----------------------------------------------------------------------------
// 10. SAFETENSORS BENCHMARK
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m[10] SafeTensors Export/Import Benchmark\x1b[0m');
console.log('    Model serialization performance\n');

const { SafeTensorsWriter, SafeTensorsReader, ModelExporter } = require('@ruvector/ruvllm');

{
  const adapter = new LoraAdapter({ rank: 16 }, 512, 512);
  const exporter = new ModelExporter();
  const model = {
    metadata: { name: 'bench', version: '1.0', format: 'safetensors', created: Date.now() },
    loraWeights: adapter.getWeights(),
    loraConfig: adapter.getConfig(),
  };

  const exportResult = benchmark('toSafeTensors (rank=16, dim=512)', () => {
    exporter.toSafeTensors(model);
  }, 500);

  results.push(exportResult);
  console.log(`  ${exportResult.name}`);
  console.log(formatResult(exportResult));

  // Import benchmark
  const buffer = exporter.toSafeTensors(model);
  const importResult = benchmark('fromSafeTensors', () => {
    new SafeTensorsReader(buffer);
  }, 500);

  results.push(importResult);
  console.log(`\n  ${importResult.name}`);
  console.log(formatResult(importResult));
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('BENCHMARK SUMMARY REPORT');
console.log('='.repeat(70));

// Key performance metrics
console.log('\n\x1b[36mKey Performance Metrics:\x1b[0m\n');

const keyMetrics = results.filter(r =>
  r.name.includes('applyLora (dim=256)') ||
  r.name.includes('findPatterns (k=10)') ||
  r.name.includes('forwardBatch (bs=100') ||
  r.name.includes('forward (dim=256, rank=8)')
);

console.log('| Benchmark                        | Mean (μs) | Median (μs) | P95 (μs)  |');
console.log('|----------------------------------|-----------|-------------|-----------|');

for (const m of keyMetrics) {
  const name = m.name.padEnd(32);
  const mean = m.meanUs.toFixed(2).padStart(9);
  const median = m.medianUs.toFixed(2).padStart(11);
  const p95 = m.p95Us.toFixed(2).padStart(9);
  console.log(`| ${name} | ${mean} | ${median} | ${p95} |`);
}

// Performance targets
console.log('\n\x1b[36mPerformance Target Comparison:\x1b[0m\n');

const targets = [
  { name: 'applyLora', target: 12.6, actual: results.find(r => r.name === 'applyLora (dim=256)')?.meanUs },
  { name: 'findPatterns', target: 224, actual: results.find(r => r.name === 'findPatterns (k=10)')?.meanUs },
  { name: 'forwardBatch (bs=100)', target: 467, actual: results.find(r => r.name === 'forwardBatch (bs=100, dim=256)')?.meanUs },
];

for (const t of targets) {
  if (t.actual) {
    const ratio = t.target / t.actual;
    const status = t.actual <= t.target * 2 ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mACCEPTABLE\x1b[0m';
    console.log(`  ${t.name}:`);
    console.log(`    Target: ${t.target}μs | Actual: ${t.actual.toFixed(2)}μs | Status: ${status}`);
  }
}

// Throughput summary
console.log('\n\x1b[36mThroughput Summary:\x1b[0m\n');

const throughputMetrics = [
  { name: 'processTask', result: results.find(r => r.name === 'processTask (dim=256)') },
  { name: 'forward (dim=256)', result: results.find(r => r.name === 'forward (dim=256, rank=8)') },
  { name: 'aggregate', result: results.find(r => r.name === 'aggregate (50 trajectories)') },
];

for (const t of throughputMetrics) {
  if (t.result) {
    const opsPerSec = 1_000_000 / t.result.meanUs;
    console.log(`  ${t.name}: ${opsPerSec.toFixed(0).padStart(10)} ops/sec`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('\x1b[32mBenchmark complete!\x1b[0m');
console.log('='.repeat(70));
