/**
 * 03-skill-library.js - Lifelong Learning Skills
 *
 * Demonstrates SkillLibrary for managing reusable skills learned from
 * agent trajectories, including skill relationships, search, composition
 * plans, and automated consolidation from episodes.
 *
 * Based on: "Voyager: An Open-Ended Embodied Agent with Large Language Models"
 * https://arxiv.org/abs/2305.16291
 *
 * Usage: node examples/practical/03-skill-library.js
 */

import { createDatabase, SkillLibrary, ReflexionMemory } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Mock Embedder ─────────────────────────────────────────────────────
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

// ─── Skill Definitions ─────────────────────────────────────────────────
const SKILLS = [
  {
    name: 'jwt_auth',
    description: 'JWT authentication with access and refresh token management, token rotation, and blacklisting',
    code: `import jwt from 'jsonwebtoken';

export function createToken(payload, secret, expiresIn = '15m') {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

export function createRefreshToken(userId, secret) {
  return jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: '7d' });
}`,
    signature: { inputs: { payload: 'object', secret: 'string' }, outputs: { token: 'string', refreshToken: 'string' } },
    successRate: 0.94,
    uses: 35,
    avgReward: 0.91,
    metadata: { domain: 'security', complexity: 'medium' },
  },
  {
    name: 'sql_injection_scanner',
    description: 'Detect and prevent SQL injection by scanning queries for dangerous patterns and enforcing parameterized queries',
    code: `const DANGEROUS_PATTERNS = [
  /('|--|;|\\*|UNION|SELECT|DROP|DELETE|UPDATE|INSERT)/gi,
  /\\b(OR|AND)\\s+\\d+=\\d+/gi,
  /\\/\\*.*\\*\\//g,
];

export function scanForInjection(input) {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

export function sanitize(input) {
  return input.replace(/['"\\\\;--]/g, '');
}`,
    signature: { inputs: { query: 'string' }, outputs: { isSafe: 'boolean', sanitized: 'string' } },
    successRate: 0.89,
    uses: 28,
    avgReward: 0.86,
    metadata: { domain: 'security', complexity: 'low' },
  },
  {
    name: 'api_rate_limiter',
    description: 'Sliding window rate limiter using token bucket algorithm with Redis backend for distributed systems',
    code: `export class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const clientRequests = this.requests.get(clientId) || [];
    const validRequests = clientRequests.filter(ts => ts > windowStart);
    if (validRequests.length >= this.maxRequests) return false;
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }
}`,
    signature: { inputs: { clientId: 'string', config: 'object' }, outputs: { allowed: 'boolean', remaining: 'number' } },
    successRate: 0.91,
    uses: 22,
    avgReward: 0.88,
    metadata: { domain: 'infrastructure', complexity: 'medium' },
  },
  {
    name: 'cache_invalidation',
    description: 'Cache invalidation strategy with TTL, tag-based invalidation, and write-through/write-behind patterns',
    code: `export class CacheManager {
  constructor(ttlMs = 300000) {
    this.cache = new Map();
    this.tags = new Map();
    this.ttlMs = ttlMs;
  }

  set(key, value, tags = []) {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs, tags });
    tags.forEach(tag => {
      if (!this.tags.has(tag)) this.tags.set(tag, new Set());
      this.tags.get(tag).add(key);
    });
  }

  invalidateByTag(tag) {
    const keys = this.tags.get(tag) || new Set();
    keys.forEach(key => this.cache.delete(key));
    this.tags.delete(tag);
  }
}`,
    signature: { inputs: { key: 'string', value: 'any', tags: 'string[]' }, outputs: { cached: 'boolean' } },
    successRate: 0.82,
    uses: 18,
    avgReward: 0.79,
    metadata: { domain: 'infrastructure', complexity: 'high' },
  },
  {
    name: 'error_boundary',
    description: 'React error boundary component with fallback UI, error reporting, and automatic retry with exponential backoff',
    code: `import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.props.onError?.(error, info);
  }

  retry = () => {
    this.setState(prev => ({
      hasError: false, error: null,
      retryCount: prev.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback?.({ error: this.state.error, retry: this.retry })
        || <div>Something went wrong. <button onClick={this.retry}>Retry</button></div>;
    }
    return this.props.children;
  }
}`,
    signature: { inputs: { children: 'ReactNode', fallback: 'function' }, outputs: { wrappedComponent: 'ReactNode' } },
    successRate: 0.87,
    uses: 42,
    avgReward: 0.84,
    metadata: { domain: 'frontend', complexity: 'medium' },
  },
  {
    name: 'load_balancer',
    description: 'Application-level load balancer with round-robin, least-connections, and weighted strategies with health checks',
    code: `export class LoadBalancer {
  constructor(servers, strategy = 'round-robin') {
    this.servers = servers.map(s => ({ ...s, connections: 0, healthy: true }));
    this.strategy = strategy;
    this.current = 0;
  }

  getServer() {
    const healthy = this.servers.filter(s => s.healthy);
    if (healthy.length === 0) throw new Error('No healthy servers');
    if (this.strategy === 'round-robin') {
      const server = healthy[this.current % healthy.length];
      this.current++;
      return server;
    }
    if (this.strategy === 'least-connections') {
      return healthy.sort((a, b) => a.connections - b.connections)[0];
    }
    return healthy[Math.floor(Math.random() * healthy.length)];
  }

  async healthCheck() {
    for (const server of this.servers) {
      try {
        const res = await fetch(server.url + '/health');
        server.healthy = res.ok;
      } catch { server.healthy = false; }
    }
  }
}`,
    signature: { inputs: { servers: 'object[]', strategy: 'string' }, outputs: { selectedServer: 'object' } },
    successRate: 0.86,
    uses: 14,
    avgReward: 0.83,
    metadata: { domain: 'infrastructure', complexity: 'high' },
  },
  {
    name: 'data_pipeline',
    description: 'ETL data pipeline with configurable extraction, transformation, and loading stages, backpressure, and error recovery',
    code: `export class Pipeline {
  constructor() { this.stages = []; }

  addStage(name, fn) {
    this.stages.push({ name, fn, stats: { processed: 0, errors: 0 } });
    return this;
  }

  async run(data) {
    let result = data;
    for (const stage of this.stages) {
      try {
        result = await stage.fn(result);
        stage.stats.processed++;
      } catch (err) {
        stage.stats.errors++;
        console.error(\`Pipeline error at \${stage.name}:\`, err.message);
        throw err;
      }
    }
    return result;
  }

  getStats() {
    return this.stages.map(s => ({ name: s.name, ...s.stats }));
  }
}`,
    signature: { inputs: { data: 'any', stages: 'function[]' }, outputs: { result: 'any', stats: 'object' } },
    successRate: 0.78,
    uses: 11,
    avgReward: 0.75,
    metadata: { domain: 'data-engineering', complexity: 'high' },
  },
  {
    name: 'circuit_breaker',
    description: 'Circuit breaker pattern for external service calls with failure threshold, half-open state, and automatic recovery',
    code: `export class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit is OPEN');
      }
    }
    try {
      const result = await this.fn(...args);
      if (this.state === 'HALF_OPEN') this.state = 'CLOSED';
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.failureThreshold) this.state = 'OPEN';
      throw err;
    }
  }
}`,
    signature: { inputs: { fn: 'function', options: 'object' }, outputs: { result: 'any' } },
    successRate: 0.90,
    uses: 19,
    avgReward: 0.87,
    metadata: { domain: 'infrastructure', complexity: 'medium' },
  },
];

// ─── Skill Relationships ───────────────────────────────────────────────
// Defines how skills relate to each other.
const RELATIONSHIPS = [
  // jwt_auth requires sql_injection_scanner for secure DB operations
  { parent: 'jwt_auth', child: 'sql_injection_scanner', relationship: 'prerequisite', weight: 0.8 },
  // jwt_auth and api_rate_limiter work together for API security
  { parent: 'jwt_auth', child: 'api_rate_limiter', relationship: 'composition', weight: 0.9 },
  // circuit_breaker is an alternative to error_boundary for backend
  { parent: 'error_boundary', child: 'circuit_breaker', relationship: 'alternative', weight: 0.7 },
  // load_balancer composes with circuit_breaker for resilience
  { parent: 'load_balancer', child: 'circuit_breaker', relationship: 'composition', weight: 0.85 },
  // data_pipeline composes with cache_invalidation
  { parent: 'data_pipeline', child: 'cache_invalidation', relationship: 'composition', weight: 0.75 },
  // api_rate_limiter can be used as alternative to circuit_breaker
  { parent: 'circuit_breaker', child: 'api_rate_limiter', relationship: 'alternative', weight: 0.6 },
];

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log('  SkillLibrary - Lifelong Learning Skills');
  console.log('='.repeat(70));
  console.log();

  // ─── Initialize ──────────────────────────────────────────────────────
  console.log('[1] Initializing database and skill library...');
  const db = await createDatabase(':memory:');
  const embedder = new MockEmbedder();

  // Load schemas
  const schemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/schema.sql');
  const frontierSchemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/frontier-schema.sql');
  if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  if (fs.existsSync(frontierSchemaPath)) db.exec(fs.readFileSync(frontierSchemaPath, 'utf-8'));

  const library = new SkillLibrary(db, embedder);
  console.log('    SkillLibrary initialized with mock embedder (384 dimensions)');
  console.log();

  // ─── Create Skills ───────────────────────────────────────────────────
  console.log('[2] Creating 8 skills across different domains...');
  const skillIds = {};
  for (const skill of SKILLS) {
    const id = await library.createSkill(skill);
    skillIds[skill.name] = id;
    console.log(`    [${id}] ${skill.name} - ${skill.description.substring(0, 60)}...`);
    console.log(`        Success: ${(skill.successRate * 100).toFixed(0)}% | Uses: ${skill.uses} | Domain: ${skill.metadata.domain}`);
  }
  console.log(`    Total skills created: ${Object.keys(skillIds).length}`);
  console.log();

  // ─── Link Skills ─────────────────────────────────────────────────────
  console.log('[3] Linking skills with relationships...');
  for (const rel of RELATIONSHIPS) {
    const parentId = skillIds[rel.parent];
    const childId = skillIds[rel.child];
    library.linkSkills({
      parentSkillId: parentId,
      childSkillId: childId,
      relationship: rel.relationship,
      weight: rel.weight,
    });
    console.log(`    ${rel.parent} --[${rel.relationship} (${rel.weight})]-> ${rel.child}`);
  }
  console.log();

  // ─── Search Skills ───────────────────────────────────────────────────
  console.log('[4] Searching for skills related to "security authentication"...');
  const securitySkills = await library.searchSkills({
    task: 'security authentication token validation',
    k: 5,
    minSuccessRate: 0.0,
  });
  console.log(`    Found ${securitySkills.length} relevant skills:`);
  for (const sk of securitySkills) {
    const sim = sk.similarity ? ` (similarity: ${sk.similarity.toFixed(3)})` : '';
    console.log(`    - "${sk.name}" success=${(sk.successRate * 100).toFixed(0)}% uses=${sk.uses}${sim}`);
  }
  console.log();

  // ─── Search for Infrastructure Skills ────────────────────────────────
  console.log('[5] Searching for "distributed system resilience" skills...');
  const infraSkills = await library.searchSkills({
    task: 'distributed system resilience fault tolerance',
    k: 5,
    minSuccessRate: 0.0,
  });
  console.log(`    Found ${infraSkills.length} relevant skills:`);
  for (const sk of infraSkills) {
    const sim = sk.similarity ? ` (similarity: ${sk.similarity.toFixed(3)})` : '';
    console.log(`    - "${sk.name}" success=${(sk.successRate * 100).toFixed(0)}% uses=${sk.uses}${sim}`);
  }
  console.log();

  // ─── Get Skill Plan ──────────────────────────────────────────────────
  console.log('[6] Getting skill plan for jwt_auth...');
  const plan = library.getSkillPlan(skillIds['jwt_auth']);
  console.log(`    Main skill: "${plan.skill.name}" (success: ${(plan.skill.successRate * 100).toFixed(0)}%)`);
  console.log(`    Prerequisites (${plan.prerequisites.length}):`);
  for (const p of plan.prerequisites) {
    console.log(`      - "${p.name}" (success: ${(p.successRate * 100).toFixed(0)}%)`);
  }
  console.log(`    Alternatives (${plan.alternatives.length}):`);
  for (const a of plan.alternatives) {
    console.log(`      - "${a.name}" (success: ${(a.successRate * 100).toFixed(0)}%)`);
  }
  console.log(`    Refinements (${plan.refinements.length}):`);
  if (plan.refinements.length === 0) console.log('      (none)');
  console.log();

  console.log('    Getting skill plan for load_balancer...');
  const lbPlan = library.getSkillPlan(skillIds['load_balancer']);
  console.log(`    Main skill: "${lbPlan.skill.name}"`);
  console.log(`    Prerequisites: ${lbPlan.prerequisites.length}`);
  console.log(`    Alternatives: ${lbPlan.alternatives.length}`);
  console.log(`    Compositions (linked children):`);
  // The getSkillPlan treats "composition" as a general link
  // Let's show all links for this skill
  const lbLinks = db.prepare(`
    SELECT sl.relationship, sl.weight, s.name, s.success_rate
    FROM skill_links sl
    JOIN skills s ON s.id = sl.child_skill_id
    WHERE sl.parent_skill_id = ?
    ORDER BY sl.weight DESC
  `).all(skillIds['load_balancer']);
  for (const link of lbLinks) {
    console.log(`      - [${link.relationship}] "${link.name}" (success: ${(link.success_rate * 100).toFixed(0)}%, weight: ${link.weight})`);
  }
  console.log();

  // ─── Update Skill Stats ──────────────────────────────────────────────
  console.log('[7] Simulating skill usage and updating stats...');
  const simulations = [
    { name: 'jwt_auth', successes: 8, failures: 2 },
    { name: 'circuit_breaker', successes: 12, failures: 1 },
    { name: 'cache_invalidation', successes: 5, failures: 4 },
  ];

  for (const sim of simulations) {
    const id = skillIds[sim.name];
    const beforeSkill = db.prepare('SELECT success_rate, uses, avg_reward FROM skills WHERE id = ?').get(id);
    console.log(`    ${sim.name} (before): success=${(beforeSkill.success_rate * 100).toFixed(1)}% uses=${beforeSkill.uses}`);

    // Simulate uses
    for (let i = 0; i < sim.successes; i++) {
      library.updateSkillStats(id, true, 0.8 + Math.random() * 0.2, 100 + Math.random() * 500);
    }
    for (let i = 0; i < sim.failures; i++) {
      library.updateSkillStats(id, false, 0.1 + Math.random() * 0.3, 200 + Math.random() * 1000);
    }

    const afterSkill = db.prepare('SELECT success_rate, uses, avg_reward FROM skills WHERE id = ?').get(id);
    console.log(`    ${sim.name} (after):  success=${(afterSkill.success_rate * 100).toFixed(1)}% uses=${afterSkill.uses} avgReward=${afterSkill.avg_reward.toFixed(3)}`);
  }
  console.log();

  // ─── Consolidate Episodes into Skills ────────────────────────────────
  console.log('[8] Demonstrating episode-to-skill consolidation...');
  console.log('    First, creating episodes to consolidate from...');

  // Create ReflexionMemory to store episodes
  const memory = new ReflexionMemory(db, embedder);

  // Store several high-reward episodes for the same task
  const consolidationTask = 'Deploy microservice to Kubernetes cluster';
  for (let i = 0; i < 5; i++) {
    await memory.storeEpisode({
      sessionId: `consolidation-session-${i}`,
      task: consolidationTask,
      input: `Microservice v${i + 1} deployment request`,
      output: `Successfully deployed with rolling update, health checks passed, zero downtime achieved`,
      critique: 'Good deployment with proper health checks and rollback plan',
      reward: 0.8 + Math.random() * 0.2,
      success: true,
      latencyMs: 1000 + Math.random() * 2000,
      tokensUsed: 400 + Math.floor(Math.random() * 200),
      tags: ['deployment', 'kubernetes'],
    });
  }
  console.log(`    Stored 5 high-reward episodes for "${consolidationTask}"`);

  const consolidated = await library.consolidateEpisodesIntoSkills({
    minAttempts: 3,
    minReward: 0.7,
    timeWindowDays: 30,
    extractPatterns: true,
  });
  console.log(`    Consolidation results:`);
  console.log(`      Skills created: ${consolidated.created}`);
  console.log(`      Skills updated: ${consolidated.updated}`);
  if (consolidated.patterns && consolidated.patterns.length > 0) {
    console.log(`      Patterns extracted:`);
    for (const p of consolidated.patterns) {
      console.log(`        Task: "${p.task}"`);
      console.log(`        Avg reward: ${p.avgReward.toFixed(3)}`);
      if (p.commonPatterns.length > 0) {
        console.log(`        Common patterns: ${p.commonPatterns.join('; ')}`);
      }
      if (p.successIndicators.length > 0) {
        console.log(`        Success indicators: ${p.successIndicators.join('; ')}`);
      }
    }
  }
  console.log();

  // ─── Final Skill Inventory ───────────────────────────────────────────
  console.log('[9] Final skill inventory:');
  const allSkills = db.prepare(`
    SELECT id, name, success_rate, uses, avg_reward, created_at
    FROM skills
    ORDER BY success_rate DESC
  `).all();
  console.log(`    Total skills: ${allSkills.length}`);
  console.log('    ' + '-'.repeat(66));
  console.log(`    ${'Name'.padEnd(30)} ${'Success'.padEnd(10)} ${'Uses'.padEnd(8)} ${'AvgReward'.padEnd(10)}`);
  console.log('    ' + '-'.repeat(66));
  for (const sk of allSkills) {
    const name = sk.name.substring(0, 29).padEnd(30);
    const success = `${(sk.success_rate * 100).toFixed(1)}%`.padEnd(10);
    const uses = String(sk.uses).padEnd(8);
    const reward = sk.avg_reward.toFixed(3).padEnd(10);
    console.log(`    ${name} ${success} ${uses} ${reward}`);
  }
  console.log();

  // ─── Cleanup ─────────────────────────────────────────────────────────
  db.close();

  console.log('='.repeat(70));
  console.log('  SkillLibrary Demo Complete');
  console.log('  Key features demonstrated:');
  console.log('  - Create skills with code, signatures, and metadata');
  console.log('  - Semantic skill search across domains');
  console.log('  - Skill relationships (prerequisite, alternative, composition)');
  console.log('  - Skill composition plans with dependency resolution');
  console.log('  - Dynamic stats updates from simulated usage');
  console.log('  - Episode-to-skill consolidation with pattern extraction');
  console.log('='.repeat(70));
}

main().then(() => { process.exit(0); }).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
