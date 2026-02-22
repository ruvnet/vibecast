/**
 * 02-reflexion-memory.js - Episodic Memory with Self-Critique
 *
 * Demonstrates ReflexionMemory for storing agent episodes with self-critique,
 * retrieving relevant past experiences, analyzing task statistics, and
 * extracting strategies from successes and failures.
 *
 * Based on: "Reflexion: Language Agents with Verbal Reinforcement Learning"
 * https://arxiv.org/abs/2303.11366
 *
 * Usage: node examples/practical/02-reflexion-memory.js
 */

import { createDatabase, ReflexionMemory, EmbeddingService } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Mock Embedder ─────────────────────────────────────────────────────
// Deterministic hash-based embedder for reproducible results without
// downloading the real model (~90MB). Replace with EmbeddingService
// for production use.

class MockEmbedder {
  constructor() { this.dim = 384; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < this.dim; i++) {
      hash = ((hash << 5) - hash + i) | 0;
      arr[i] = (hash & 0xFFFF) / 65536 - 0.5;
    }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

// ─── Initialize Embedder ───────────────────────────────────────────────
async function createEmbedder() {
  try {
    const svc = new EmbeddingService({
      model: 'Xenova/all-MiniLM-L6-v2',
      dimension: 384,
      provider: 'transformers',
    });
    await svc.initialize();
    // Test if it actually produces embeddings (pipeline may be null)
    const test = await svc.embed('test');
    if (test && test.length === 384) {
      console.log('    Using real Xenova/all-MiniLM-L6-v2 embeddings');
      return svc;
    }
  } catch (e) {
    // Fall through to mock
  }
  console.log('    Using mock embedder (deterministic hash-based, dim=384)');
  return new MockEmbedder();
}

// ─── Episode Data ──────────────────────────────────────────────────────
// Simulating a code review agent that learns from experience.

const EPISODES = [
  {
    sessionId: 'code-review-session-01',
    task: 'Fix SQL injection vulnerability in login form',
    input: 'Login form uses string concatenation for SQL queries',
    output: 'Replaced all string concatenation with parameterized prepared statements. Added input sanitization layer.',
    critique: 'Thorough fix with defense-in-depth. Could have also added rate limiting.',
    reward: 0.92,
    success: true,
    latencyMs: 1100,
    tokensUsed: 520,
    tags: ['security', 'sql-injection', 'critical'],
  },
  {
    sessionId: 'code-review-session-01',
    task: 'Optimize database query for dashboard loading',
    input: 'Dashboard takes 8 seconds to load, N+1 query problem detected',
    output: 'Attempted to add eager loading but introduced a circular dependency',
    critique: 'Failed to analyze dependency graph before modifying queries. Should have mapped relationships first.',
    reward: 0.2,
    success: false,
    latencyMs: 3200,
    tokensUsed: 890,
    tags: ['performance', 'database', 'n+1'],
  },
  {
    sessionId: 'code-review-session-02',
    task: 'Review authentication PR for JWT implementation',
    input: 'PR adds JWT-based auth with refresh tokens',
    output: 'Approved PR after verifying token expiry, secure storage, and CSRF protection. Suggested adding token revocation list.',
    critique: 'Good review. Caught the missing token revocation mechanism.',
    reward: 0.88,
    success: true,
    latencyMs: 1500,
    tokensUsed: 620,
    tags: ['auth', 'jwt', 'code-review'],
  },
  {
    sessionId: 'code-review-session-02',
    task: 'Refactor API endpoints for REST compliance',
    input: 'API uses POST for all operations, no proper status codes',
    output: 'Converted to proper REST verbs (GET, POST, PUT, DELETE) with correct HTTP status codes and content negotiation',
    critique: 'Clean refactoring with backward compatibility. Added deprecation headers for old endpoints.',
    reward: 0.85,
    success: true,
    latencyMs: 2100,
    tokensUsed: 750,
    tags: ['api', 'rest', 'refactoring'],
  },
  {
    sessionId: 'code-review-session-03',
    task: 'Fix memory leak in WebSocket connection handler',
    input: 'Server memory grows unbounded with WebSocket connections',
    output: 'Tried adding connection cleanup timer but set interval too short, causing premature disconnects',
    critique: 'Incorrect timer interval. Should have profiled actual connection lifetimes before choosing cleanup period.',
    reward: 0.15,
    success: false,
    latencyMs: 4500,
    tokensUsed: 1200,
    tags: ['memory-leak', 'websocket', 'debugging'],
  },
  {
    sessionId: 'code-review-session-03',
    task: 'Fix memory leak in event listener cleanup',
    input: 'React component leaks event listeners on unmount',
    output: 'Added proper cleanup in useEffect return function. Verified with Chrome DevTools memory profiler.',
    critique: 'Correct approach with verification. Should become standard practice.',
    reward: 0.90,
    success: true,
    latencyMs: 900,
    tokensUsed: 380,
    tags: ['memory-leak', 'react', 'frontend'],
  },
  {
    sessionId: 'code-review-session-04',
    task: 'Implement rate limiting for public API',
    input: 'API has no rate limiting, vulnerable to abuse',
    output: 'Added sliding window rate limiter with Redis backend, per-IP and per-user limits, with configurable thresholds',
    critique: 'Comprehensive solution. Considered both anonymous and authenticated users.',
    reward: 0.93,
    success: true,
    latencyMs: 1700,
    tokensUsed: 680,
    tags: ['security', 'rate-limiting', 'api'],
  },
  {
    sessionId: 'code-review-session-04',
    task: 'Review cross-site scripting prevention in user profile page',
    input: 'User profile allows HTML in bio field',
    output: 'Missed the stored XSS vector in the bio field, only checked reflected XSS',
    critique: 'Incomplete review - focused only on reflected XSS, missed stored XSS vulnerability in user bio. Need to check all user input fields systematically.',
    reward: 0.25,
    success: false,
    latencyMs: 2800,
    tokensUsed: 950,
    tags: ['security', 'xss', 'code-review'],
  },
  {
    sessionId: 'code-review-session-05',
    task: 'Optimize database query with proper indexing',
    input: 'Slow query on users table - full table scan on email lookup',
    output: 'Added composite index on (email, status) columns. Query time reduced from 2s to 5ms.',
    critique: 'Excellent targeted fix with measurable improvement. Index choice matched the WHERE clause pattern.',
    reward: 0.95,
    success: true,
    latencyMs: 800,
    tokensUsed: 290,
    tags: ['performance', 'database', 'indexing'],
  },
  {
    sessionId: 'code-review-session-05',
    task: 'Fix CORS configuration for microservices',
    input: 'Frontend cannot call backend API due to CORS errors',
    output: 'Set Access-Control-Allow-Origin to wildcard (*) for all endpoints',
    critique: 'Overly permissive CORS - used wildcard instead of specific allowed origins. This creates a security hole for credential-based requests.',
    reward: 0.3,
    success: false,
    latencyMs: 600,
    tokensUsed: 250,
    tags: ['security', 'cors', 'configuration'],
  },
];

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log('  ReflexionMemory - Episodic Memory with Self-Critique');
  console.log('='.repeat(70));
  console.log();

  // ─── Initialize ──────────────────────────────────────────────────────
  console.log('[1] Initializing database and embedding service...');
  const db = await createDatabase(':memory:');
  const embedder = await createEmbedder();

  // Load schema
  const schemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/schema.sql');
  const frontierSchemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/frontier-schema.sql');
  if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  if (fs.existsSync(frontierSchemaPath)) db.exec(fs.readFileSync(frontierSchemaPath, 'utf-8'));

  const memory = new ReflexionMemory(db, embedder);
  console.log('    ReflexionMemory initialized (in-memory mode)');
  console.log();

  // ─── Store Episodes ──────────────────────────────────────────────────
  console.log('[2] Storing 10 episodes simulating a code review agent...');
  const episodeIds = [];
  for (const ep of EPISODES) {
    const id = await memory.storeEpisode(ep);
    episodeIds.push(id);
    const status = ep.success ? 'SUCCESS' : 'FAILURE';
    console.log(`    [${status}] id=${id} "${ep.task}" (reward: ${ep.reward})`);
  }
  console.log(`    Total episodes stored: ${episodeIds.length}`);
  console.log();

  // ─── Retrieve Relevant Episodes ──────────────────────────────────────
  console.log('[3] Retrieving episodes relevant to "security vulnerability review"...');
  const relevant = await memory.retrieveRelevant({
    task: 'security vulnerability review',
    k: 5,
  });
  console.log(`    Found ${relevant.length} relevant episodes:`);
  for (const ep of relevant) {
    const sim = ep.similarity ? ` (similarity: ${ep.similarity.toFixed(3)})` : '';
    console.log(`    - [${ep.success ? 'OK' : 'FAIL'}] "${ep.task}" reward=${ep.reward}${sim}`);
  }
  console.log();

  // ─── Task Statistics ─────────────────────────────────────────────────
  console.log('[4] Getting task statistics...');
  const tasksToCheck = [
    'Fix SQL injection vulnerability in login form',
    'Optimize database query for dashboard loading',
    'Fix memory leak in WebSocket connection handler',
  ];
  for (const task of tasksToCheck) {
    const stats = memory.getTaskStats(task);
    console.log(`    Task: "${task}"`);
    console.log(`      Total attempts: ${stats.totalAttempts}`);
    console.log(`      Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`      Avg reward: ${stats.avgReward.toFixed(3)}`);
    console.log(`      Avg latency: ${stats.avgLatency ? stats.avgLatency.toFixed(0) + 'ms' : 'N/A'}`);
    console.log(`      Improvement trend: ${(stats.improvementTrend * 100).toFixed(1)}%`);
  }
  console.log();

  // ─── Critique Summary for Failures ───────────────────────────────────
  console.log('[5] Getting critique summary for failed security reviews...');
  const critiqueSummary = await memory.getCritiqueSummary({
    task: 'security vulnerability code review',
    k: 5,
  });
  console.log('    ' + critiqueSummary.replace(/\n/g, '\n    '));
  console.log();

  // ─── Success Strategies ──────────────────────────────────────────────
  console.log('[6] Getting successful strategies for security tasks...');
  const strategies = await memory.getSuccessStrategies({
    task: 'security vulnerability prevention',
    k: 3,
  });
  console.log('    ' + strategies.replace(/\n/g, '\n    '));
  console.log();

  // ─── Retrieve Only Failures ──────────────────────────────────────────
  console.log('[7] Retrieving only failed episodes for learning...');
  const failures = await memory.retrieveRelevant({
    task: 'code review common mistakes',
    k: 10,
    onlyFailures: true,
  });
  console.log(`    Found ${failures.length} failed episodes:`);
  for (const ep of failures) {
    console.log(`    - "${ep.task}" (reward: ${ep.reward})`);
    if (ep.critique) {
      console.log(`      Critique: ${ep.critique.substring(0, 100)}...`);
    }
  }
  console.log();

  // ─── Retrieve Only Successes with High Reward ────────────────────────
  console.log('[8] Retrieving high-reward successes for reinforcement...');
  const successes = await memory.retrieveRelevant({
    task: 'best practices for code review',
    k: 10,
    onlySuccesses: true,
    minReward: 0.85,
  });
  console.log(`    Found ${successes.length} high-reward successes:`);
  for (const ep of successes) {
    console.log(`    - "${ep.task}" (reward: ${ep.reward})`);
  }
  console.log();

  // ─── Recent Session Episodes ─────────────────────────────────────────
  console.log('[9] Getting recent episodes for session "code-review-session-01"...');
  const sessionEpisodes = await memory.getRecentEpisodes('code-review-session-01', 5);
  console.log(`    Found ${sessionEpisodes.length} episodes in session:`);
  for (const ep of sessionEpisodes) {
    console.log(`    - [${ep.success ? 'OK' : 'FAIL'}] "${ep.task}" (reward: ${ep.reward})`);
  }
  console.log();

  // ─── Cache Statistics ────────────────────────────────────────────────
  console.log('[10] Cache statistics:');
  const cacheStats = memory.getCacheStats();
  console.log(`    Size: ${cacheStats.size}`);
  console.log(`    Hits: ${cacheStats.hits}`);
  console.log(`    Misses: ${cacheStats.misses}`);
  console.log(`    Hit rate: ${cacheStats.hitRate.toFixed(2)}`);
  console.log();

  // ─── Cleanup ─────────────────────────────────────────────────────────
  db.close();

  console.log('='.repeat(70));
  console.log('  ReflexionMemory Demo Complete');
  console.log('  Key features demonstrated:');
  console.log('  - Store episodes with self-critique and reward signals');
  console.log('  - Semantic retrieval of relevant past experiences');
  console.log('  - Task-level statistics and improvement tracking');
  console.log('  - Critique summaries from failures for learning');
  console.log('  - Success strategy extraction for reinforcement');
  console.log('  - Filtered queries (failures only, high-reward only)');
  console.log('  - Built-in query caching for performance');
  console.log('='.repeat(70));
}

main().then(() => { process.exit(0); }).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
