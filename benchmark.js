/**
 * Benchmark for @ruvector packages on Linux x64
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          @ruvector Linux x64 Performance Benchmark          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Environment:');
console.log(`  Platform: ${process.platform}-${process.arch}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  CPUs: ${os.cpus().length}x ${os.cpus()[0]?.model || 'unknown'}`);
console.log(`  Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB\n`);

function formatNumber(n) {
  return n.toLocaleString();
}

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function benchmark(name, iterations, fn) {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations / 10); i++) {
    await fn();
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = process.hrtime.bigint();

  const totalMs = Number(end - start) / 1_000_000;
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  console.log(`  ${name}`);
  console.log(`    Iterations: ${formatNumber(iterations)}`);
  console.log(`    Total time: ${formatTime(totalMs)}`);
  console.log(`    Avg/op: ${formatTime(avgMs)}`);
  console.log(`    Ops/sec: ${formatNumber(opsPerSec)}`);
  console.log('');

  return { name, iterations, totalMs, avgMs, opsPerSec };
}

async function benchmarkTinyDancer() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  @ruvector/tiny-dancer Benchmarks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tinyDancer = require('@ruvector/tiny-dancer');
  const results = [];

  results.push(await benchmark('version()', 100000, () => {
    tinyDancer.version();
  }));

  results.push(await benchmark('hello()', 100000, () => {
    tinyDancer.hello();
  }));

  return results;
}

async function benchmarkRouter() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  @ruvector/router Benchmarks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const router = require('@ruvector/router');
  const results = [];

  const DIMS = 128;
  const storageFile = path.join(os.tmpdir(), `bench-${Date.now()}.db`);

  // Create database
  const db = new router.VectorDb({
    dimensions: DIMS,
    maxElements: 200,
    distanceMetric: router.DistanceMetric.Cosine,
    storagePath: storageFile
  });

  // Generate test vectors
  const vectors = [];
  for (let i = 0; i < 100; i++) {
    const vec = new Float32Array(DIMS);
    for (let j = 0; j < DIMS; j++) {
      vec[j] = Math.random() * 2 - 1;
    }
    vectors.push(vec);
  }

  // Pre-populate DB with one vector for search benchmarks
  console.log('  Populating database...');
  const insertStart = Date.now();
  await db.insertAsync('seed-vec', vectors[0]);
  console.log(`  Database ready (${Date.now() - insertStart}ms)\n`);

  // Benchmark count (sync operation)
  results.push(await benchmark('count()', 10000, () => {
    db.count();
  }));

  // Benchmark search with small DB
  const queryVec = vectors[0];
  results.push(await benchmark('searchAsync() k=1', 100, async () => {
    await db.searchAsync(queryVec, 1);
  }));

  // Benchmark getAllIds
  results.push(await benchmark('getAllIds()', 10000, () => {
    db.getAllIds();
  }));

  // Benchmark VectorDb creation
  let dbIdx = 0;
  results.push(await benchmark('new VectorDb()', 100, () => {
    const tmpFile = path.join(os.tmpdir(), `bench-create-${dbIdx++}.db`);
    new router.VectorDb({
      dimensions: 64,
      maxElements: 100,
      storagePath: tmpFile
    });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }));

  // Cleanup
  try { fs.unlinkSync(storageFile); } catch (e) {}

  return results;
}

async function main() {
  const allResults = [];

  try {
    allResults.push(...await benchmarkTinyDancer());
  } catch (e) {
    console.error('tiny-dancer benchmark failed:', e.message);
  }

  try {
    allResults.push(...await benchmarkRouter());
  } catch (e) {
    console.error('router benchmark failed:', e.message);
  }

  // Summary
  console.log('══════════════════════════════════════════════════════════════');
  console.log('                      BENCHMARK SUMMARY                       ');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('| Operation | Ops/sec | Avg Time |');
  console.log('|-----------|---------|----------|');
  for (const r of allResults) {
    console.log(`| ${r.name.padEnd(35)} | ${formatNumber(r.opsPerSec).padStart(7)} | ${formatTime(r.avgMs).padStart(8)} |`);
  }
  console.log('');
}

main().catch(console.error);
