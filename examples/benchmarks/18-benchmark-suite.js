#!/usr/bin/env node

/**
 * 18-benchmark-suite.js - Performance Benchmarking
 *
 * Runs AgentDB's built-in benchmark suite and adds custom benchmarks
 * for pattern storage, episode retrieval, batch vs sequential inserts,
 * and cache hit ratio measurement.
 *
 * agentdb@3.0.0-alpha.3 (ESM-only)
 */

import {
  BenchmarkSuite,
  Benchmark,
  VectorInsertBenchmark,
  VectorSearchBenchmark,
  MemoryUsageBenchmark,
  ConcurrencyBenchmark,
  QuantizationBenchmark,
  runBenchmarks,
  formatReportAsMarkdown,
  createDatabase,
  QueryCache,
  QuantizedVectorStore,
  quantize8bit,
  dequantize8bit,
  getQuantizationStats,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock embedder
// ---------------------------------------------------------------------------
class MockEmbedder {
  constructor(dim = 384) { this.dim = dim; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    for (let i = 0; i < this.dim; i++) { hash = ((hash << 5) - hash + i) | 0; arr[i] = (hash & 0xFFFF) / 65536 - 0.5; }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

function randomVector(dim = 384) {
  const arr = new Float32Array(dim);
  for (let i = 0; i < dim; i++) arr[i] = Math.random() * 2 - 1;
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < dim; i++) arr[i] /= norm;
  return arr;
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------
function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatOps(ops) {
  if (ops > 1_000_000) return `${(ops / 1_000_000).toFixed(1)}M ops/sec`;
  if (ops > 1000) return `${(ops / 1000).toFixed(1)}K ops/sec`;
  return `${ops.toFixed(0)} ops/sec`;
}

// =========================================================================
// Custom Benchmarks
// =========================================================================

/**
 * Pattern Storage Throughput Benchmark
 */
class PatternStorageBenchmark extends Benchmark {
  name = 'PatternStorage';
  description = 'Reasoning pattern storage throughput with embeddings';
  db;
  embedder;

  constructor() {
    super();
    this.embedder = new MockEmbedder(384);
  }

  async setup() {
    this.db = await createDatabase(':memory:');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reasoning_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER DEFAULT (strftime('%s', 'now')),
        task_type TEXT NOT NULL,
        approach TEXT NOT NULL,
        context TEXT,
        success_rate REAL NOT NULL DEFAULT 0.0,
        outcome TEXT,
        uses INTEGER DEFAULT 0,
        tags TEXT,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        pattern_id INTEGER PRIMARY KEY,
        embedding BLOB NOT NULL
      );
    `);
  }

  async run() {
    const patternCounts = [50, 100, 200];
    const results = [];
    const latencies = [];

    for (const count of patternCounts) {
      const patterns = [];
      for (let i = 0; i < count; i++) {
        patterns.push({
          taskType: `task_type_${i % 10}`,
          approach: `Use approach ${i} with method ${i % 5}`,
          context: `Context for pattern ${i}`,
          successRate: Math.random(),
        });
      }

      // Generate embeddings
      const texts = patterns.map(p => `${p.taskType}\n${p.approach}\n${p.context}`);
      const embeddings = await this.embedder.embedBatch(texts);

      const start = performance.now();

      // Insert patterns with embeddings
      const patternStmt = this.db.prepare(
        `INSERT INTO reasoning_patterns (task_type, approach, context, success_rate)
         VALUES (?, ?, ?, ?)`
      );
      const embStmt = this.db.prepare(
        `INSERT INTO pattern_embeddings (pattern_id, embedding) VALUES (?, ?)`
      );

      const insertFn = this.db.transaction(() => {
        for (let i = 0; i < patterns.length; i++) {
          const p = patterns[i];
          const insertStart = performance.now();
          const result = patternStmt.run(p.taskType, p.approach, p.context, p.successRate);
          const pid = typeof result.lastInsertRowid === 'bigint'
            ? Number(result.lastInsertRowid)
            : result.lastInsertRowid;
          embStmt.run(pid, Buffer.from(embeddings[i].buffer));
          latencies.push(performance.now() - insertStart);
        }
      });
      insertFn();

      const duration = performance.now() - start;
      const opsPerSec = (count / duration) * 1000;
      results.push({ count, duration, opsPerSec });
      console.log(`    ${count} patterns: ${formatMs(duration)} (${formatOps(opsPerSec)})`);
    }

    const totalOps = results.reduce((s, r) => s + r.count, 0);
    const totalDuration = results.reduce((s, r) => s + r.duration, 0);

    return {
      name: this.name,
      opsPerSecond: (totalOps / totalDuration) * 1000,
      latencyMs: this.calculateLatencyStats(latencies),
      memoryMB: this.getMemoryUsageMB(),
      duration: totalDuration,
      operations: totalOps,
      metadata: { breakdown: results },
    };
  }

  async teardown() {
    this.db?.close();
  }
}

/**
 * Episode Retrieval Latency Benchmark
 */
class EpisodeRetrievalBenchmark extends Benchmark {
  name = 'EpisodeRetrieval';
  description = 'Episode retrieval latency with similarity search';
  db;
  embedder;

  constructor() {
    super();
    this.embedder = new MockEmbedder(384);
  }

  async setup() {
    this.db = await createDatabase(':memory:');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER DEFAULT (strftime('%s', 'now')),
        session_id TEXT,
        task TEXT NOT NULL,
        input TEXT,
        output TEXT,
        critique TEXT,
        reward REAL,
        success INTEGER,
        latency_ms REAL,
        tokens_used INTEGER,
        tags TEXT,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS episode_embeddings (
        episode_id INTEGER PRIMARY KEY,
        embedding BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_reward ON episodes(reward);
      CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
    `);

    // Seed with 500 episodes
    console.log('  Seeding 500 episodes...');
    const tasks = [
      'Code review for authentication module',
      'Data pipeline optimization',
      'API endpoint design',
      'Database schema migration',
      'Performance profiling and tuning',
      'Security audit of user inputs',
      'Frontend component refactoring',
      'ML model training pipeline',
      'CI/CD pipeline configuration',
      'Documentation update for API v2',
    ];

    const insertEp = this.db.prepare(
      `INSERT INTO episodes (session_id, task, critique, reward, success)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertEmb = this.db.prepare(
      `INSERT INTO episode_embeddings (episode_id, embedding) VALUES (?, ?)`
    );

    const seedFn = this.db.transaction(() => {
      for (let i = 0; i < 500; i++) {
        const task = tasks[i % tasks.length] + ` (iteration ${i})`;
        const embedding = randomVector(384);
        const result = insertEp.run(
          `session-${i % 20}`,
          task,
          `Critique for iteration ${i}`,
          Math.random(),
          Math.random() > 0.3 ? 1 : 0,
        );
        const eid = typeof result.lastInsertRowid === 'bigint'
          ? Number(result.lastInsertRowid) : result.lastInsertRowid;
        insertEmb.run(eid, Buffer.from(embedding.buffer));
      }
    });
    seedFn();
  }

  async run() {
    const queryCount = 200;
    const latencies = [];

    // Retrieve all embeddings into memory for brute-force similarity
    const allEmbeddings = this.db.prepare(
      `SELECT ee.episode_id, ee.embedding, e.task, e.reward
       FROM episode_embeddings ee
       JOIN episodes e ON e.id = ee.episode_id`
    ).all();

    const parsedEmbeddings = allEmbeddings.map(row => ({
      id: row.episode_id,
      task: row.task,
      reward: row.reward,
      embedding: new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      ),
    }));

    // Run similarity searches
    for (let q = 0; q < queryCount; q++) {
      const queryVec = randomVector(384);
      const start = performance.now();

      // Brute-force cosine similarity
      const scores = parsedEmbeddings.map(item => {
        let dot = 0, mag1 = 0, mag2 = 0;
        for (let i = 0; i < 384; i++) {
          dot += queryVec[i] * item.embedding[i];
          mag1 += queryVec[i] * queryVec[i];
          mag2 += item.embedding[i] * item.embedding[i];
        }
        return { id: item.id, similarity: dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) };
      });

      // Top-10
      scores.sort((a, b) => b.similarity - a.similarity);
      const top10 = scores.slice(0, 10);

      latencies.push(performance.now() - start);
    }

    const stats = this.calculateLatencyStats(latencies);
    console.log(`    ${queryCount} queries over 500 episodes: p50=${formatMs(stats.p50)}, p95=${formatMs(stats.p95)}, p99=${formatMs(stats.p99)}`);

    return {
      name: this.name,
      opsPerSecond: (queryCount / latencies.reduce((a, b) => a + b, 0)) * 1000,
      latencyMs: stats,
      memoryMB: this.getMemoryUsageMB(),
      duration: latencies.reduce((a, b) => a + b, 0),
      operations: queryCount,
      metadata: { episodeCount: 500, queryCount, k: 10 },
    };
  }

  async teardown() {
    this.db?.close();
  }
}

/**
 * Batch vs Sequential Insert Comparison
 */
class BatchVsSequentialBenchmark extends Benchmark {
  name = 'BatchVsSequential';
  description = 'Batch insert vs sequential insert comparison';

  async setup() {}

  async run() {
    const itemCount = 500;
    const latencies = [];

    // Sequential inserts
    const seqDb = await createDatabase(':memory:');
    seqDb.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT, score REAL)`);

    const seqStart = performance.now();
    const seqStmt = seqDb.prepare(`INSERT INTO test (value, score) VALUES (?, ?)`);
    for (let i = 0; i < itemCount; i++) {
      const iStart = performance.now();
      seqStmt.run(`value-${i}`, Math.random());
      latencies.push(performance.now() - iStart);
    }
    const seqDuration = performance.now() - seqStart;
    seqDb.close();

    // Batch inserts (with transaction)
    const batchDb = await createDatabase(':memory:');
    batchDb.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT, score REAL)`);

    const batchStart = performance.now();
    const batchStmt = batchDb.prepare(`INSERT INTO test (value, score) VALUES (?, ?)`);
    const batchFn = batchDb.transaction(() => {
      for (let i = 0; i < itemCount; i++) {
        batchStmt.run(`value-${i}`, Math.random());
      }
    });
    batchFn();
    const batchDuration = performance.now() - batchStart;
    batchDb.close();

    const speedup = seqDuration / batchDuration;
    const seqOps = (itemCount / seqDuration) * 1000;
    const batchOps = (itemCount / batchDuration) * 1000;

    console.log(`    Sequential: ${formatMs(seqDuration)} (${formatOps(seqOps)})`);
    console.log(`    Batch:      ${formatMs(batchDuration)} (${formatOps(batchOps)})`);
    console.log(`    Speedup:    ${speedup.toFixed(1)}x`);

    return {
      name: this.name,
      opsPerSecond: batchOps,
      latencyMs: this.calculateLatencyStats(latencies),
      memoryMB: this.getMemoryUsageMB(),
      duration: seqDuration + batchDuration,
      operations: itemCount * 2,
      metadata: {
        sequential: { duration: seqDuration, opsPerSec: seqOps },
        batch: { duration: batchDuration, opsPerSec: batchOps },
        speedup,
        itemCount,
      },
    };
  }

  async teardown() {}
}

/**
 * Cache Hit Ratio Benchmark
 */
class CacheHitRatioBenchmark extends Benchmark {
  name = 'CacheHitRatio';
  description = 'Query cache hit ratio and performance impact';

  async setup() {}

  async run() {
    const cache = new QueryCache({
      maxSize: 200,
      defaultTTL: 60000,
    });

    const queryCount = 1000;
    const uniqueQueries = 50;
    const latencies = [];

    // Simulate queries with Zipf-like distribution (some queries are much more common)
    const queries = [];
    for (let i = 0; i < uniqueQueries; i++) {
      queries.push({
        sql: `SELECT * FROM episodes WHERE task LIKE ? AND reward > ?`,
        params: [`%task_${i}%`, Math.random()],
        result: Array.from({ length: Math.floor(Math.random() * 20) }, (_, j) => ({
          id: j, task: `task_${i}_${j}`, reward: Math.random(),
        })),
      });
    }

    // Phase 1: Cold cache -- all misses
    const coldStart = performance.now();
    for (let i = 0; i < queryCount; i++) {
      // Zipf-like: lower indices queried more often
      const idx = Math.floor(Math.pow(Math.random(), 2) * uniqueQueries);
      const q = queries[idx];
      const key = cache.generateKey(q.sql, q.params, 'episodes');

      const qStart = performance.now();
      let result = cache.get(key);
      if (result === undefined) {
        // Simulate "executing" the query
        result = q.result;
        cache.set(key, result);
      }
      latencies.push(performance.now() - qStart);
    }
    const coldDuration = performance.now() - coldStart;

    const statsAfterCold = cache.getStatistics();
    console.log(`    Cold phase (${queryCount} queries):`);
    console.log(`      Hit rate: ${statsAfterCold.hitRate.toFixed(1)}%`);
    console.log(`      Cache size: ${statsAfterCold.size}/${statsAfterCold.capacity}`);

    // Phase 2: Warm cache -- should have hits
    cache.resetStatistics();
    const warmStart = performance.now();
    for (let i = 0; i < queryCount; i++) {
      const idx = Math.floor(Math.pow(Math.random(), 2) * uniqueQueries);
      const q = queries[idx];
      const key = cache.generateKey(q.sql, q.params, 'episodes');

      const qStart = performance.now();
      let result = cache.get(key);
      if (result === undefined) {
        result = q.result;
        cache.set(key, result);
      }
      latencies.push(performance.now() - qStart);
    }
    const warmDuration = performance.now() - warmStart;

    const statsAfterWarm = cache.getStatistics();
    console.log(`    Warm phase (${queryCount} queries):`);
    console.log(`      Hit rate: ${statsAfterWarm.hitRate.toFixed(1)}%`);
    console.log(`      Evictions: ${statsAfterWarm.evictions}`);
    console.log(`      Memory used: ${(statsAfterWarm.memoryUsed / 1024).toFixed(1)}KB`);

    // Phase 3: Category invalidation test
    const invalidated = cache.invalidateCategory('episodes');
    const statsAfterInvalidation = cache.getStatistics();
    console.log(`    After invalidation:`);
    console.log(`      Invalidated entries: ${invalidated}`);
    console.log(`      Remaining cache size: ${statsAfterInvalidation.size}`);

    const speedup = coldDuration / warmDuration;
    console.log(`    Cache speedup: ${speedup.toFixed(2)}x`);

    return {
      name: this.name,
      opsPerSecond: (queryCount * 2 / (coldDuration + warmDuration)) * 1000,
      latencyMs: this.calculateLatencyStats(latencies),
      memoryMB: this.getMemoryUsageMB(),
      duration: coldDuration + warmDuration,
      operations: queryCount * 2,
      metadata: {
        coldHitRate: statsAfterCold.hitRate,
        warmHitRate: statsAfterWarm.hitRate,
        cacheSpeedup: speedup,
        evictions: statsAfterWarm.evictions,
        uniqueQueries,
      },
    };
  }

  async teardown() {}
}

// =========================================================================
// MAIN
// =========================================================================
async function main() {
  console.log('='.repeat(72));
  console.log('  AgentDB Performance Benchmark Suite');
  console.log('='.repeat(72));
  console.log();

  // -----------------------------------------------------------------------
  // Part 1: Built-in Benchmark Suite (scaled down for demo)
  // -----------------------------------------------------------------------
  console.log('--- PART 1: BUILT-IN BENCHMARK SUITE ---');
  console.log();

  let builtinReport = null;
  try {
    // Use smaller scales to keep demo fast
    builtinReport = await runBenchmarks({
      vectorDimension: 384,
      warmupIterations: 10,
      insertCounts: [100, 500, 1000],
      searchQueries: 100,
      searchK: 10,
      concurrencyLevels: [1, 4, 8],
      runMemoryTests: true,
      runQuantizationTests: true,
    });

    console.log();
    console.log('--- BUILT-IN RESULTS (Markdown) ---');
    console.log();
    console.log(formatReportAsMarkdown(builtinReport));
  } catch (err) {
    console.log(`[WARN] Built-in benchmark suite encountered an error: ${err.message}`);
    console.log('  This is expected if optional native backends are not installed.');
    console.log('  Proceeding with custom benchmarks...');
    console.log();
  }

  // -----------------------------------------------------------------------
  // Part 2: Custom Benchmarks
  // -----------------------------------------------------------------------
  console.log();
  console.log('--- PART 2: CUSTOM BENCHMARKS ---');
  console.log();

  const customSuite = new BenchmarkSuite({
    vectorDimension: 384,
    warmupIterations: 10,
    insertCounts: [100, 500],
    searchQueries: 100,
    searchK: 10,
    concurrencyLevels: [1, 4],
    runMemoryTests: false,
    runQuantizationTests: false,
  });

  // Remove built-in benchmarks and add custom ones
  for (const name of customSuite.listBenchmarks()) {
    customSuite.unregister(name);
  }

  customSuite.register(new PatternStorageBenchmark());
  customSuite.register(new EpisodeRetrievalBenchmark());
  customSuite.register(new BatchVsSequentialBenchmark());
  customSuite.register(new CacheHitRatioBenchmark());

  console.log('Registered custom benchmarks:');
  for (const name of customSuite.listBenchmarks()) {
    console.log(`  - ${name}`);
  }
  console.log();

  // Run custom benchmarks individually for better error handling
  const customResults = [];
  for (const name of customSuite.listBenchmarks()) {
    try {
      const result = await customSuite.runByName(name);
      customResults.push(result);
    } catch (err) {
      console.log(`  [WARN] ${name} failed: ${err.message}`);
      customResults.push({
        name,
        opsPerSecond: 0,
        latencyMs: { p50: 0, p95: 0, p99: 0, mean: 0, max: 0, min: 0 },
        memoryMB: 0,
        duration: 0,
        operations: 0,
        metadata: { error: err.message },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Part 3: Comprehensive Results Table
  // -----------------------------------------------------------------------
  console.log();
  console.log('='.repeat(72));
  console.log('  COMPREHENSIVE RESULTS');
  console.log('='.repeat(72));
  console.log();

  // Combine all results
  const allResults = [
    ...(builtinReport?.results || []),
    ...customResults,
  ];

  // Header
  const colWidths = { name: 22, ops: 16, p50: 12, p95: 12, p99: 12, mem: 10 };
  const header =
    'Benchmark'.padEnd(colWidths.name) +
    'Ops/sec'.padStart(colWidths.ops) +
    'p50 (ms)'.padStart(colWidths.p50) +
    'p95 (ms)'.padStart(colWidths.p95) +
    'p99 (ms)'.padStart(colWidths.p99) +
    'Mem (MB)'.padStart(colWidths.mem);

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of allResults) {
    const row =
      r.name.padEnd(colWidths.name) +
      formatOps(r.opsPerSecond).padStart(colWidths.ops) +
      r.latencyMs.p50.toFixed(3).padStart(colWidths.p50) +
      r.latencyMs.p95.toFixed(3).padStart(colWidths.p95) +
      r.latencyMs.p99.toFixed(3).padStart(colWidths.p99) +
      r.memoryMB.toFixed(1).padStart(colWidths.mem);
    console.log(row);
  }

  console.log('-'.repeat(header.length));
  console.log();

  // Show metadata details for custom benchmarks
  console.log('--- CUSTOM BENCHMARK DETAILS ---');
  console.log();

  for (const r of customResults) {
    console.log(`${r.name}:`);
    if (r.metadata?.error) {
      console.log(`  Error: ${r.metadata.error}`);
    } else if (r.name === 'BatchVsSequential' && r.metadata) {
      console.log(`  Sequential: ${formatMs(r.metadata.sequential.duration)} (${formatOps(r.metadata.sequential.opsPerSec)})`);
      console.log(`  Batch:      ${formatMs(r.metadata.batch.duration)} (${formatOps(r.metadata.batch.opsPerSec)})`);
      console.log(`  Speedup:    ${r.metadata.speedup.toFixed(1)}x`);
    } else if (r.name === 'CacheHitRatio' && r.metadata) {
      console.log(`  Cold hit rate:  ${r.metadata.coldHitRate.toFixed(1)}%`);
      console.log(`  Warm hit rate:  ${r.metadata.warmHitRate.toFixed(1)}%`);
      console.log(`  Cache speedup:  ${r.metadata.cacheSpeedup.toFixed(2)}x`);
      console.log(`  Evictions:      ${r.metadata.evictions}`);
    } else if (r.name === 'EpisodeRetrieval' && r.metadata) {
      console.log(`  Episodes: ${r.metadata.episodeCount}`);
      console.log(`  Queries:  ${r.metadata.queryCount}`);
      console.log(`  k:        ${r.metadata.k}`);
    } else if (r.name === 'PatternStorage' && r.metadata?.breakdown) {
      for (const b of r.metadata.breakdown) {
        console.log(`  ${b.count} patterns: ${formatMs(b.duration)} (${formatOps(b.opsPerSec)})`);
      }
    }
    console.log();
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('='.repeat(72));
  console.log('  SUMMARY');
  console.log('='.repeat(72));
  console.log();

  const totalBenchmarks = allResults.length;
  const passedBenchmarks = allResults.filter(r => r.opsPerSecond > 0 || r.name === 'MemoryUsage').length;
  const totalOps = allResults.reduce((s, r) => s + r.operations, 0);
  const totalDuration = allResults.reduce((s, r) => s + r.duration, 0);
  const peakMemory = Math.max(...allResults.map(r => r.memoryMB), 0);

  console.log(`  Benchmarks run:   ${passedBenchmarks}/${totalBenchmarks}`);
  console.log(`  Total operations: ${totalOps.toLocaleString()}`);
  console.log(`  Total duration:   ${formatMs(totalDuration)}`);
  console.log(`  Peak memory:      ${peakMemory.toFixed(1)} MB`);
  console.log(`  Platform:         ${process.platform} ${process.arch} (Node ${process.version})`);
  console.log();
  console.log('='.repeat(72));
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
