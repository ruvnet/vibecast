#!/usr/bin/env node

/**
 * 19-query-cache-optimizer.js - Performance Optimization
 *
 * Demonstrates QueryCache, QueryOptimizer, and BatchOperations
 * for maximizing AgentDB throughput with caching, query analysis,
 * and bulk data operations.
 *
 * agentdb@3.0.0-alpha.3 (ESM-only)
 */

import {
  QueryCache,
  QueryOptimizer,
  BatchOperations,
  createDatabase,
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

// ---------------------------------------------------------------------------
// Database schema setup helper
// ---------------------------------------------------------------------------
function setupSchema(db) {
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER DEFAULT (strftime('%s', 'now')),
      name TEXT NOT NULL,
      description TEXT,
      signature TEXT,
      code TEXT,
      success_rate REAL DEFAULT 0.0,
      uses INTEGER DEFAULT 0,
      avg_reward REAL DEFAULT 0.0,
      avg_latency_ms REAL DEFAULT 0.0,
      tags TEXT,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS skill_embeddings (
      skill_id INTEGER PRIMARY KEY,
      embedding BLOB NOT NULL
    );
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
    CREATE TABLE IF NOT EXISTS causal_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER DEFAULT (strftime('%s', 'now')),
      from_memory_id INTEGER,
      from_memory_type TEXT,
      to_memory_id INTEGER,
      to_memory_type TEXT,
      similarity REAL,
      uplift REAL,
      confidence REAL,
      sample_size INTEGER,
      evidence_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_reward ON episodes(reward);
    CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_task ON episodes(task);
    CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
    CREATE INDEX IF NOT EXISTS idx_patterns_task_type ON reasoning_patterns(task_type);
  `);
}

// =========================================================================
// MAIN
// =========================================================================
async function main() {
  console.log('='.repeat(72));
  console.log('  AgentDB Query Cache & Optimizer Demo');
  console.log('='.repeat(72));
  console.log();

  // -----------------------------------------------------------------------
  // SECTION 1: QueryCache
  // -----------------------------------------------------------------------
  console.log('--- SECTION 1: QueryCache ---');
  console.log();

  const cache = new QueryCache({
    maxSize: 500,
    defaultTTL: 60000,  // 60 seconds
    enabled: true,
    maxResultSize: 10 * 1024 * 1024,
  });

  const config = cache.getConfig();
  console.log('Cache configuration:');
  console.log(`  Max size:       ${config.maxSize}`);
  console.log(`  Default TTL:    ${config.defaultTTL}ms`);
  console.log(`  Enabled:        ${config.enabled}`);
  console.log(`  Max result size: ${(config.maxResultSize / 1024 / 1024).toFixed(0)}MB`);
  console.log();

  // 1a. Key generation for various queries
  console.log('1a. Cache key generation:');
  const keys = [
    {
      sql: 'SELECT * FROM episodes WHERE reward > ?',
      params: [0.8],
      category: 'episodes',
    },
    {
      sql: 'SELECT * FROM episodes WHERE reward > ?',
      params: [0.9],
      category: 'episodes',
    },
    {
      sql: 'SELECT * FROM skills WHERE success_rate > ?',
      params: [0.7],
      category: 'skills',
    },
    {
      sql: 'SELECT * FROM reasoning_patterns WHERE task_type = ?',
      params: ['code_review'],
      category: 'patterns',
    },
  ];

  for (const q of keys) {
    const key = cache.generateKey(q.sql, q.params, q.category);
    console.log(`  "${q.sql}" [${q.params}] => ${key}`);
  }
  console.log();

  // 1b. Set/get cache entries
  console.log('1b. Setting and getting cache entries:');
  const mockResults = {
    highReward: [
      { id: 1, task: 'Code review', reward: 0.95 },
      { id: 2, task: 'Data analysis', reward: 0.88 },
    ],
    topSkills: [
      { id: 1, name: 'debugging', success_rate: 0.92 },
      { id: 2, name: 'refactoring', success_rate: 0.85 },
    ],
    patterns: [
      { id: 1, task_type: 'code_review', approach: 'systematic' },
    ],
  };

  // Set entries
  const key1 = cache.generateKey('SELECT * FROM episodes WHERE reward > ?', [0.8], 'episodes');
  cache.set(key1, mockResults.highReward);

  const key2 = cache.generateKey('SELECT * FROM skills WHERE success_rate > ?', [0.7], 'skills');
  cache.set(key2, mockResults.topSkills);

  const key3 = cache.generateKey('SELECT * FROM reasoning_patterns WHERE task_type = ?', ['code_review'], 'patterns');
  cache.set(key3, mockResults.patterns);

  // Get entries
  const retrieved1 = cache.get(key1);
  const retrieved2 = cache.get(key2);
  const missKey = cache.generateKey('SELECT * FROM nonexistent', [], 'other');
  const retrieved3 = cache.get(missKey);

  console.log(`  Hit for episodes query: ${retrieved1 ? 'YES (' + retrieved1.length + ' results)' : 'MISS'}`);
  console.log(`  Hit for skills query:   ${retrieved2 ? 'YES (' + retrieved2.length + ' results)' : 'MISS'}`);
  console.log(`  Hit for unknown query:  ${retrieved3 ? 'YES' : 'MISS (expected)'}`);
  console.log();

  // 1c. Hit rate measurement
  console.log('1c. Hit rate measurement (1000 queries):');
  cache.resetStatistics();

  for (let i = 0; i < 1000; i++) {
    // 70% chance of querying cached keys, 30% uncached
    if (Math.random() < 0.7) {
      const idx = Math.floor(Math.random() * 3);
      const cachedKey = [key1, key2, key3][idx];
      cache.get(cachedKey);
    } else {
      const randomKey = cache.generateKey(`SELECT * FROM episodes LIMIT ?`, [i], 'random');
      cache.get(randomKey);
    }
  }

  const hitStats = cache.getStatistics();
  console.log(`  Hits:       ${hitStats.hits}`);
  console.log(`  Misses:     ${hitStats.misses}`);
  console.log(`  Hit rate:   ${hitStats.hitRate.toFixed(1)}%`);
  console.log(`  Cache size: ${hitStats.size}/${hitStats.capacity}`);
  console.log(`  Evictions:  ${hitStats.evictions}`);
  console.log(`  Memory:     ${(hitStats.memoryUsed / 1024).toFixed(1)}KB`);
  console.log();

  // 1d. Category-based invalidation
  console.log('1d. Category-based invalidation:');
  console.log(`  Cache size before: ${cache.getStatistics().size}`);
  const invalidatedEpisodes = cache.invalidateCategory('episodes');
  console.log(`  Invalidated 'episodes' category: ${invalidatedEpisodes} entries`);
  console.log(`  Cache size after:  ${cache.getStatistics().size}`);

  // Verify episode query is gone but skills/patterns still cached
  const episodeResult = cache.get(key1);
  const skillResult = cache.get(key2);
  console.log(`  Episodes query still cached: ${episodeResult ? 'YES' : 'NO (correctly invalidated)'}`);
  console.log(`  Skills query still cached:   ${skillResult ? 'YES (correctly retained)' : 'NO'}`);
  console.log();

  // 1e. Cache warming
  console.log('1e. Cache warming with common queries:');
  cache.clear();
  cache.resetStatistics();

  await cache.warm(async (c) => {
    // Pre-populate cache with common query results
    const commonQueries = [
      { sql: 'SELECT COUNT(*) FROM episodes', key: 'stats:episode_count', value: 500 },
      { sql: 'SELECT AVG(reward) FROM episodes', key: 'stats:avg_reward', value: 0.72 },
      { sql: 'SELECT COUNT(*) FROM skills', key: 'stats:skill_count', value: 25 },
      { sql: 'SELECT * FROM episodes ORDER BY reward DESC LIMIT 10', key: 'top:episodes', value: [{id: 1}] },
      { sql: 'SELECT * FROM skills ORDER BY success_rate DESC LIMIT 5', key: 'top:skills', value: [{id: 1}] },
    ];
    for (const q of commonQueries) {
      c.set(q.key, q.value);
    }
    console.log(`  Warmed cache with ${commonQueries.length} common queries`);
  });

  const warmStats = cache.getStatistics();
  console.log(`  Cache size after warming: ${warmStats.size}`);
  console.log(`  Categories: ${JSON.stringify(warmStats.entriesByCategory)}`);
  console.log();

  // 1f. Final cache statistics
  console.log('1f. Final cache statistics:');
  const finalStats = cache.getStatistics();
  console.log(`  Total hits:     ${finalStats.hits}`);
  console.log(`  Total misses:   ${finalStats.misses}`);
  console.log(`  Hit rate:       ${finalStats.hitRate.toFixed(1)}%`);
  console.log(`  Size:           ${finalStats.size}/${finalStats.capacity}`);
  console.log(`  Evictions:      ${finalStats.evictions}`);
  console.log(`  Memory used:    ${(finalStats.memoryUsed / 1024).toFixed(1)}KB`);
  console.log(`  By category:    ${JSON.stringify(finalStats.entriesByCategory)}`);
  console.log();

  // -----------------------------------------------------------------------
  // SECTION 2: QueryOptimizer
  // -----------------------------------------------------------------------
  console.log('--- SECTION 2: QueryOptimizer ---');
  console.log();

  const db = await createDatabase(':memory:');
  setupSchema(db);

  // Seed database with test data
  console.log('Seeding database with test data...');
  const seedEp = db.prepare(
    `INSERT INTO episodes (session_id, task, critique, reward, success, latency_ms, tokens_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const seedEmb = db.prepare(
    `INSERT INTO episode_embeddings (episode_id, embedding) VALUES (?, ?)`
  );

  const seedTx = db.transaction(() => {
    const tasks = [
      'Implement authentication', 'Optimize database queries', 'Write unit tests',
      'Design API endpoints', 'Profile memory usage', 'Fix race condition',
      'Refactor legacy code', 'Deploy to production', 'Set up monitoring',
      'Review pull request',
    ];
    for (let i = 0; i < 200; i++) {
      const result = seedEp.run(
        `session-${i % 10}`,
        tasks[i % tasks.length] + ` (v${Math.floor(i / 10)})`,
        `Critique: ${i % 2 === 0 ? 'Good approach' : 'Needs improvement'}`,
        Math.random(),
        Math.random() > 0.3 ? 1 : 0,
        Math.floor(Math.random() * 500) + 50,
        Math.floor(Math.random() * 2000) + 100,
      );
      const eid = typeof result.lastInsertRowid === 'bigint'
        ? Number(result.lastInsertRowid) : result.lastInsertRowid;
      seedEmb.run(eid, Buffer.from(randomVector(384).buffer));
    }
  });
  seedTx();

  // Seed skills
  const seedSkill = db.prepare(
    `INSERT INTO skills (name, description, success_rate, uses, avg_reward)
     VALUES (?, ?, ?, ?, ?)`
  );
  const seedSkillTx = db.transaction(() => {
    const skillNames = [
      'debugging', 'refactoring', 'testing', 'code_review',
      'performance_tuning', 'security_audit', 'api_design',
      'data_modeling', 'deployment', 'documentation',
    ];
    for (let i = 0; i < 30; i++) {
      seedSkill.run(
        skillNames[i % skillNames.length] + `_v${Math.floor(i / 10)}`,
        `Skill for ${skillNames[i % skillNames.length]}`,
        Math.random(),
        Math.floor(Math.random() * 100),
        Math.random(),
      );
    }
  });
  seedSkillTx();

  // Seed patterns
  const seedPattern = db.prepare(
    `INSERT INTO reasoning_patterns (task_type, approach, context, success_rate)
     VALUES (?, ?, ?, ?)`
  );
  const seedPatternTx = db.transaction(() => {
    for (let i = 0; i < 50; i++) {
      seedPattern.run(
        `type_${i % 5}`,
        `Approach ${i}: use systematic analysis`,
        `Context for pattern ${i}`,
        Math.random(),
      );
    }
  });
  seedPatternTx();

  console.log('  200 episodes, 30 skills, 50 patterns seeded');
  console.log();

  // Create QueryOptimizer
  const optimizer = new QueryOptimizer(db, {
    maxSize: 500,
    ttl: 30000,
    enabled: true,
  });

  // 2a. Run queries through optimizer
  console.log('2a. Running queries through optimizer:');
  const testQueries = [
    { sql: 'SELECT * FROM episodes WHERE reward > ? ORDER BY reward DESC LIMIT 10', params: [0.8], desc: 'High-reward episodes' },
    { sql: 'SELECT * FROM episodes WHERE session_id = ? AND success = 1', params: ['session-3'], desc: 'Successful episodes for session' },
    { sql: 'SELECT AVG(reward), COUNT(*) FROM episodes WHERE success = 1', params: [], desc: 'Average reward for successes' },
    { sql: 'SELECT * FROM skills WHERE success_rate > ? ORDER BY uses DESC', params: [0.7], desc: 'Top performing skills' },
    { sql: 'SELECT task_type, AVG(success_rate) as avg_sr FROM reasoning_patterns GROUP BY task_type', params: [], desc: 'Pattern success by type' },
  ];

  for (const q of testQueries) {
    const start = performance.now();
    const result = optimizer.query(q.sql, q.params);
    const duration = performance.now() - start;
    console.log(`  ${q.desc}: ${result.length} rows in ${formatMs(duration)}`);
  }
  console.log();

  // 2b. Repeat queries to test cache
  console.log('2b. Repeating queries (should hit cache):');
  for (const q of testQueries) {
    const start = performance.now();
    const result = optimizer.query(q.sql, q.params);
    const duration = performance.now() - start;
    console.log(`  ${q.desc}: ${result.length} rows in ${formatMs(duration)} (cached)`);
  }
  console.log();

  // 2c. Query analysis and suggestions
  console.log('2c. Query analysis:');
  for (const q of testQueries) {
    try {
      const analysis = optimizer.analyzeQuery(q.sql);
      console.log(`  "${q.desc}":`);
      console.log(`    Uses index:      ${analysis.usesIndex}`);
      console.log(`    Full scan:       ${analysis.plan.toLowerCase().includes('scan')}`);
      console.log(`    Estimated cost:  ${analysis.estimatedCost}`);
    } catch (err) {
      console.log(`  "${q.desc}": Analysis skipped (${err.message})`);
    }
  }
  console.log();

  // 2d. Cache statistics
  console.log('2d. Optimizer cache statistics:');
  const optimizerCacheStats = optimizer.getCacheStats();
  console.log(`  Cache size:    ${optimizerCacheStats.size}`);
  console.log(`  Hit rate:      ${(optimizerCacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Total hits:    ${optimizerCacheStats.totalHits}`);
  console.log(`  Total misses:  ${optimizerCacheStats.totalMisses}`);
  console.log();

  // 2e. Cached vs uncached timing comparison
  console.log('2e. Cached vs uncached timing comparison:');
  const comparisonQuery = 'SELECT * FROM episodes WHERE reward > ? AND success = 1 ORDER BY reward DESC LIMIT 20';

  // Uncached (clear and run)
  optimizer.clearCache();
  const uncachedTimings = [];
  for (let i = 0; i < 50; i++) {
    optimizer.clearCache();
    const start = performance.now();
    optimizer.query(comparisonQuery, [0.5]);
    uncachedTimings.push(performance.now() - start);
  }
  const avgUncached = uncachedTimings.reduce((a, b) => a + b, 0) / uncachedTimings.length;

  // Cached (first run populates, rest are cached)
  optimizer.query(comparisonQuery, [0.5]); // populate
  const cachedTimings = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    optimizer.query(comparisonQuery, [0.5]);
    cachedTimings.push(performance.now() - start);
  }
  const avgCached = cachedTimings.reduce((a, b) => a + b, 0) / cachedTimings.length;
  const cacheSpeedup = avgUncached / avgCached;

  console.log(`  Uncached avg: ${formatMs(avgUncached)}`);
  console.log(`  Cached avg:   ${formatMs(avgCached)}`);
  console.log(`  Speedup:      ${cacheSpeedup.toFixed(1)}x`);
  console.log();

  // 2f. Query statistics
  console.log('2f. Top query statistics (by total time):');
  const queryStats = optimizer.getStats().slice(0, 5);
  for (const stat of queryStats) {
    console.log(`  Query:     ${stat.query.substring(0, 60)}...`);
    console.log(`    Runs:    ${stat.executionCount}`);
    console.log(`    Avg:     ${formatMs(stat.avgTime)}`);
    console.log(`    Total:   ${formatMs(stat.totalTime)}`);
    console.log(`    Hits:    ${stat.cacheHits} / Misses: ${stat.cacheMisses}`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // SECTION 3: BatchOperations
  // -----------------------------------------------------------------------
  console.log('--- SECTION 3: BatchOperations ---');
  console.log();

  const batchDb = await createDatabase(':memory:');
  setupSchema(batchDb);

  const embedder = new MockEmbedder(384);
  const batchOps = new BatchOperations(batchDb, embedder, {
    batchSize: 50,
    parallelism: 4,
    progressCallback: (completed, total) => {
      if (completed % 25 === 0 || completed === total) {
        process.stdout.write(`\r  Progress: ${completed}/${total}`);
      }
    },
  });

  // 3a. Batch insert episodes
  console.log('3a. Batch insert 100 episodes:');
  const episodes = [];
  for (let i = 0; i < 100; i++) {
    episodes.push({
      sessionId: `batch-session-${i % 5}`,
      task: `Batch task ${i}: implement feature ${i % 10}`,
      input: `Input data for task ${i}`,
      output: `Output result for task ${i}`,
      critique: `Critique: ${i % 2 === 0 ? 'Excellent work' : 'Needs refinement'}`,
      reward: Math.random(),
      success: Math.random() > 0.3,
      latencyMs: Math.floor(Math.random() * 500) + 50,
      tokensUsed: Math.floor(Math.random() * 2000) + 100,
      tags: ['batch', `group-${i % 5}`],
      metadata: { iteration: i, priority: i % 3 === 0 ? 'high' : 'normal' },
    });
  }

  const epStart = performance.now();
  const episodesInserted = await batchOps.insertEpisodes(episodes);
  const epDuration = performance.now() - epStart;
  console.log();
  console.log(`  Inserted: ${episodesInserted} episodes in ${formatMs(epDuration)}`);
  console.log(`  Rate:     ${((episodesInserted / epDuration) * 1000).toFixed(0)} episodes/sec`);
  console.log();

  // 3b. Batch insert skills
  console.log('3b. Batch insert 50 skills:');
  const skills = [];
  for (let i = 0; i < 50; i++) {
    skills.push({
      name: `batch-skill-${i}`,
      description: `Skill ${i}: automated ${['testing', 'debugging', 'refactoring', 'optimization', 'analysis'][i % 5]}`,
      signature: { inputs: { code: 'string' }, outputs: { result: 'string' } },
      code: `function skill_${i}(code) { return process(code); }`,
      successRate: Math.random(),
      uses: Math.floor(Math.random() * 50),
      avgReward: Math.random(),
      avgLatencyMs: Math.floor(Math.random() * 300) + 20,
      tags: ['batch-skill'],
      metadata: { version: 1, category: i % 5 },
    });
  }

  const skillStart = performance.now();
  const skillIds = await batchOps.insertSkills(skills);
  const skillDuration = performance.now() - skillStart;
  console.log();
  console.log(`  Inserted: ${skillIds.length} skills in ${formatMs(skillDuration)}`);
  console.log(`  Rate:     ${((skillIds.length / skillDuration) * 1000).toFixed(0)} skills/sec`);
  console.log();

  // 3c. Batch insert patterns
  console.log('3c. Batch insert 50 patterns:');
  const patterns = [];
  for (let i = 0; i < 50; i++) {
    patterns.push({
      taskType: `task_type_${i % 5}`,
      approach: `Pattern ${i}: use ${['systematic', 'heuristic', 'analytical', 'creative', 'iterative'][i % 5]} approach`,
      context: `Context for reasoning pattern ${i}`,
      successRate: Math.random(),
      outcome: i % 3 === 0 ? 'optimal' : 'satisfactory',
      tags: ['batch-pattern'],
      metadata: { source: 'auto-generated', batch: true },
    });
  }

  const patStart = performance.now();
  const patternIds = await batchOps.insertPatterns(patterns);
  const patDuration = performance.now() - patStart;
  console.log();
  console.log(`  Inserted: ${patternIds.length} patterns in ${formatMs(patDuration)}`);
  console.log(`  Rate:     ${((patternIds.length / patDuration) * 1000).toFixed(0)} patterns/sec`);
  console.log();

  // 3d. Compare with sequential insert timing
  console.log('3d. Batch vs sequential comparison:');

  // Sequential insert
  const seqDb = await createDatabase(':memory:');
  setupSchema(seqDb);
  const seqEmbedder = new MockEmbedder(384);

  const seqStart = performance.now();
  const seqEpStmt = seqDb.prepare(
    `INSERT INTO episodes (session_id, task, critique, reward, success) VALUES (?, ?, ?, ?, ?)`
  );
  const seqEmbStmt = seqDb.prepare(
    `INSERT INTO episode_embeddings (episode_id, embedding) VALUES (?, ?)`
  );
  for (let i = 0; i < 100; i++) {
    const embedding = await seqEmbedder.embed(`Sequential task ${i}`);
    const result = seqEpStmt.run(`seq-${i % 5}`, `Sequential task ${i}`, `Critique ${i}`, Math.random(), 1);
    const eid = typeof result.lastInsertRowid === 'bigint'
      ? Number(result.lastInsertRowid) : result.lastInsertRowid;
    seqEmbStmt.run(eid, Buffer.from(embedding.buffer));
  }
  const seqDuration = performance.now() - seqStart;
  seqDb.close();

  const speedup = seqDuration / epDuration;
  console.log(`  Sequential: ${formatMs(seqDuration)} for 100 episodes`);
  console.log(`  Batch:      ${formatMs(epDuration)} for 100 episodes`);
  console.log(`  Speedup:    ${speedup.toFixed(1)}x`);
  console.log();

  // 3e. Prune old data (dry run)
  console.log('3e. Data pruning (dry run):');
  try {
    const pruneResult = await batchOps.pruneData({
      maxAge: 1,     // 1 day (everything is "old" for demo)
      minReward: 0.3,
      minSuccessRate: 0.5,
      maxRecords: 100000,
      dryRun: true,
    });
    console.log(`  Episodes to prune:  ${pruneResult.episodesPruned}`);
    console.log(`  Skills to prune:    ${pruneResult.skillsPruned}`);
    console.log(`  Patterns to prune:  ${pruneResult.patternsPruned}`);
  } catch (err) {
    console.log(`  Pruning not available in this mode: ${err.message}`);
  }
  console.log();

  // 3f. Database statistics
  console.log('3f. Database statistics:');
  try {
    const stats = batchOps.getStats();
    console.log(`  Total database size: ${(stats.totalSize / 1024).toFixed(1)}KB`);
    console.log(`  Tables:`);
    for (const table of stats.tableStats) {
      console.log(`    ${table.name}: ${table.rows} rows (${(table.size / 1024).toFixed(1)}KB)`);
    }
  } catch (err) {
    // Fallback: manual count
    const episodeCount = batchDb.prepare('SELECT COUNT(*) as count FROM episodes').get();
    const skillCount = batchDb.prepare('SELECT COUNT(*) as count FROM skills').get();
    const patternCount = batchDb.prepare('SELECT COUNT(*) as count FROM reasoning_patterns').get();
    console.log(`  Episodes: ${episodeCount.count} rows`);
    console.log(`  Skills:   ${skillCount.count} rows`);
    console.log(`  Patterns: ${patternCount.count} rows`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('='.repeat(72));
  console.log('  PERFORMANCE OPTIMIZATION SUMMARY');
  console.log('='.repeat(72));
  console.log();
  console.log('  QueryCache:');
  console.log(`    Hit rate achieved:    ${hitStats.hitRate.toFixed(1)}%`);
  console.log(`    Category invalidation works for selective cache clearing`);
  console.log(`    Cache warming pre-populates common queries`);
  console.log();
  console.log('  QueryOptimizer:');
  console.log(`    Cache speedup:        ${cacheSpeedup.toFixed(1)}x`);
  console.log(`    Query analysis:       Index usage and cost estimation`);
  console.log(`    Statistics tracking:  Per-query timing and cache metrics`);
  console.log();
  console.log('  BatchOperations:');
  console.log(`    Episodes:             ${episodesInserted} in ${formatMs(epDuration)}`);
  console.log(`    Skills:               ${skillIds.length} in ${formatMs(skillDuration)}`);
  console.log(`    Patterns:             ${patternIds.length} in ${formatMs(patDuration)}`);
  console.log(`    Batch vs sequential:  ${speedup.toFixed(1)}x speedup`);
  console.log();
  console.log('='.repeat(72));

  // Cleanup
  db.close();
  batchDb.close();
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
