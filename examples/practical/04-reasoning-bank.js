/**
 * 04-reasoning-bank.js - Pattern Learning
 *
 * Demonstrates ReasoningBank for storing, searching, and improving
 * reasoning patterns. The bank learns which approaches work best for
 * different task types and tracks improvement over time.
 *
 * Usage: node examples/practical/04-reasoning-bank.js
 */

import { createDatabase, ReasoningBank } from 'agentdb';
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

// ─── Reasoning Patterns ────────────────────────────────────────────────
// 12 patterns across 6 task types, each with a distinct approach.

const PATTERNS = [
  // Code Review patterns
  {
    taskType: 'code_review',
    approach: 'Systematic checklist review: Check input validation, error handling, logging, test coverage, security patterns, and performance implications in order. Start with the diff summary, then review each file top-to-bottom.',
    successRate: 0.88,
    uses: 45,
    avgReward: 0.85,
    tags: ['systematic', 'checklist'],
    metadata: { avgTimeMinutes: 25, filesPerReview: 8 },
  },
  {
    taskType: 'code_review',
    approach: 'Risk-based review: Prioritize files by change complexity and blast radius. Focus on security-sensitive code first (auth, payments, data access), then public API changes, then internal refactors. Skip formatting-only changes.',
    successRate: 0.92,
    uses: 32,
    avgReward: 0.90,
    tags: ['risk-based', 'prioritization'],
    metadata: { avgTimeMinutes: 18, filesPerReview: 12 },
  },

  // Debugging patterns
  {
    taskType: 'debugging',
    approach: 'Binary search debugging: Reproduce the bug, identify the last known working state, then bisect through commits/changes to isolate the breaking change. Use git bisect for regressions.',
    successRate: 0.85,
    uses: 28,
    avgReward: 0.82,
    tags: ['bisect', 'regression'],
    metadata: { avgResolutionMinutes: 45 },
  },
  {
    taskType: 'debugging',
    approach: 'Observability-first debugging: Start with logs and metrics to form a hypothesis. Add targeted instrumentation (tracing, debug logs). Verify hypothesis with minimal reproduction. Fix and verify with the same observability tools.',
    successRate: 0.78,
    uses: 22,
    avgReward: 0.76,
    tags: ['observability', 'metrics', 'tracing'],
    metadata: { avgResolutionMinutes: 60 },
  },

  // Architecture patterns
  {
    taskType: 'architecture',
    approach: 'Domain-driven decomposition: Identify bounded contexts using event storming. Define aggregates and entities. Design context maps with clear integration patterns (anti-corruption layers, shared kernel, or open host).',
    successRate: 0.82,
    uses: 15,
    avgReward: 0.80,
    tags: ['ddd', 'bounded-context', 'event-storming'],
    metadata: { projectScale: 'large', teamSize: '5-15' },
  },
  {
    taskType: 'architecture',
    approach: 'Evolutionary architecture: Start with a modular monolith. Define fitness functions for key quality attributes (latency, throughput, coupling). Extract services only when fitness functions indicate the monolith is constraining.',
    successRate: 0.86,
    uses: 12,
    avgReward: 0.84,
    tags: ['evolutionary', 'modular-monolith', 'fitness-functions'],
    metadata: { projectScale: 'medium', teamSize: '3-8' },
  },

  // Testing patterns
  {
    taskType: 'testing',
    approach: 'Testing trophy strategy: Few end-to-end tests for critical paths, more integration tests for service boundaries, many unit tests for business logic. Use testing-library principles - test behavior, not implementation.',
    successRate: 0.90,
    uses: 38,
    avgReward: 0.87,
    tags: ['testing-trophy', 'integration', 'behavior'],
    metadata: { coverageTarget: '80%', avgTestsPerFile: 6 },
  },
  {
    taskType: 'testing',
    approach: 'Property-based testing: Define invariants and properties that should always hold. Use generators to create random inputs. Focus on edge cases the generator finds. Supplement with example-based tests for documentation.',
    successRate: 0.75,
    uses: 14,
    avgReward: 0.73,
    tags: ['property-based', 'fuzzing', 'invariants'],
    metadata: { coverageTarget: '90%', avgTestsPerFile: 3 },
  },

  // Deployment patterns
  {
    taskType: 'deployment',
    approach: 'Blue-green deployment: Maintain two identical production environments. Deploy to inactive environment, run smoke tests, then switch traffic. Keep old environment as instant rollback. Automate health checks at each stage.',
    successRate: 0.93,
    uses: 25,
    avgReward: 0.91,
    tags: ['blue-green', 'zero-downtime', 'rollback'],
    metadata: { rollbackTimeSeconds: 30, avgDeployMinutes: 8 },
  },
  {
    taskType: 'deployment',
    approach: 'Canary release with progressive delivery: Route 1% traffic to new version, monitor error rates and latency for 10 minutes. Gradually increase to 5%, 25%, 50%, 100% with automated rollback on anomaly detection.',
    successRate: 0.89,
    uses: 18,
    avgReward: 0.87,
    tags: ['canary', 'progressive', 'automated-rollback'],
    metadata: { rollbackTimeSeconds: 15, avgDeployMinutes: 35 },
  },

  // Security Audit patterns
  {
    taskType: 'security_audit',
    approach: 'OWASP Top 10 audit: Systematically check each OWASP category - injection, broken auth, sensitive data exposure, XXE, broken access control, misconfig, XSS, insecure deserialization, known vulnerabilities, insufficient logging.',
    successRate: 0.87,
    uses: 20,
    avgReward: 0.85,
    tags: ['owasp', 'systematic', 'comprehensive'],
    metadata: { vulnerabilitiesFound: 4.2, auditHours: 16 },
  },
  {
    taskType: 'security_audit',
    approach: 'Threat modeling with STRIDE: Identify assets and entry points. Apply STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege) to each component. Prioritize by risk score (impact * likelihood).',
    successRate: 0.84,
    uses: 16,
    avgReward: 0.82,
    tags: ['stride', 'threat-modeling', 'risk-assessment'],
    metadata: { vulnerabilitiesFound: 5.8, auditHours: 24 },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log('  ReasoningBank - Pattern Learning');
  console.log('='.repeat(70));
  console.log();

  // ─── Initialize ──────────────────────────────────────────────────────
  console.log('[1] Initializing database and reasoning bank...');
  const db = await createDatabase(':memory:');
  const embedder = new MockEmbedder();

  // Load schemas (ReasoningBank creates its own tables, but we need the
  // base schema for any shared references)
  const schemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/schema.sql');
  const frontierSchemaPath = path.join(__dirname, '../../node_modules/agentdb/dist/schemas/frontier-schema.sql');
  if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  if (fs.existsSync(frontierSchemaPath)) db.exec(fs.readFileSync(frontierSchemaPath, 'utf-8'));

  const bank = new ReasoningBank(db, embedder);
  console.log('    ReasoningBank initialized with mock embedder');
  console.log();

  // ─── Store Patterns ──────────────────────────────────────────────────
  console.log('[2] Storing 12 reasoning patterns across 6 task types...');
  const patternIds = [];
  for (const pattern of PATTERNS) {
    const id = await bank.storePattern(pattern);
    patternIds.push(id);
    console.log(`    [${id}] ${pattern.taskType}: "${pattern.approach.substring(0, 55)}..."`);
    console.log(`        Success: ${(pattern.successRate * 100).toFixed(0)}% | Uses: ${pattern.uses} | Tags: ${pattern.tags.join(', ')}`);
  }
  console.log(`    Total patterns stored: ${patternIds.length}`);
  console.log();

  // ─── Search Patterns ─────────────────────────────────────────────────
  console.log('[3] Searching for patterns related to "performance optimization"...');
  const perfPatterns = await bank.searchPatterns({
    task: 'performance optimization and query tuning',
    k: 5,
  });
  console.log(`    Found ${perfPatterns.length} patterns:`);
  for (const p of perfPatterns) {
    const sim = p.similarity ? ` (similarity: ${p.similarity.toFixed(3)})` : '';
    console.log(`    - [${p.taskType}] "${p.approach.substring(0, 60)}..."${sim}`);
    console.log(`      Success: ${(p.successRate * 100).toFixed(0)}% | Uses: ${p.uses}`);
  }
  console.log();

  // ─── Search for Security Patterns ────────────────────────────────────
  console.log('[4] Searching for "security vulnerability assessment" patterns...');
  const secPatterns = await bank.searchPatterns({
    task: 'security vulnerability assessment and penetration testing',
    k: 5,
  });
  console.log(`    Found ${secPatterns.length} patterns:`);
  for (const p of secPatterns) {
    const sim = p.similarity ? ` (similarity: ${p.similarity.toFixed(3)})` : '';
    console.log(`    - [${p.taskType}] "${p.approach.substring(0, 60)}..."${sim}`);
    console.log(`      Success: ${(p.successRate * 100).toFixed(0)}% | Uses: ${p.uses}`);
  }
  console.log();

  // ─── Search for Deployment Patterns ──────────────────────────────────
  console.log('[5] Searching for "zero downtime deployment" patterns...');
  const deployPatterns = await bank.searchPatterns({
    task: 'zero downtime deployment with rollback capability',
    k: 3,
  });
  console.log(`    Found ${deployPatterns.length} patterns:`);
  for (const p of deployPatterns) {
    const sim = p.similarity ? ` (similarity: ${p.similarity.toFixed(3)})` : '';
    console.log(`    - [${p.taskType}] "${p.approach.substring(0, 60)}..."${sim}`);
    console.log(`      Success: ${(p.successRate * 100).toFixed(0)}% | Uses: ${p.uses} | AvgReward: ${p.avgReward.toFixed(2)}`);
  }
  console.log();

  // ─── Get Pattern Statistics ──────────────────────────────────────────
  console.log('[6] Getting pattern statistics...');
  const stats = bank.getPatternStats();
  console.log(`    Total patterns: ${stats.totalPatterns}`);
  console.log(`    Average success rate: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
  console.log(`    Average uses: ${stats.avgUses.toFixed(1)}`);
  console.log(`    High performing patterns (>=80%): ${stats.highPerformingPatterns}`);
  console.log(`    Recent patterns (last 7 days): ${stats.recentPatterns}`);
  console.log(`    Top task types:`);
  for (const tt of stats.topTaskTypes) {
    console.log(`      - ${tt.taskType}: ${tt.count} patterns`);
  }
  console.log();

  // ─── Record Outcomes and Track Learning ──────────────────────────────
  console.log('[7] Recording outcomes to simulate learning improvement...');
  console.log();

  // Pick a few patterns to update with new outcomes
  const learningPatterns = [
    { id: patternIds[0], name: 'Systematic checklist review', outcomes: [] },
    { id: patternIds[2], name: 'Binary search debugging', outcomes: [] },
    { id: patternIds[8], name: 'Blue-green deployment', outcomes: [] },
  ];

  // Record initial state
  console.log('    Initial state:');
  for (const lp of learningPatterns) {
    const pattern = bank.getPattern(lp.id);
    console.log(`    - [${pattern.taskType}] "${lp.name}"`);
    console.log(`      Success rate: ${(pattern.successRate * 100).toFixed(1)}% | Uses: ${pattern.uses}`);
  }
  console.log();

  // Simulate 10 rounds of outcomes with improving success rate
  console.log('    Simulating 10 rounds of usage with learning improvement...');
  for (let round = 0; round < 10; round++) {
    for (const lp of learningPatterns) {
      // Success probability increases with rounds (simulating learning)
      const baseProb = 0.6 + (round * 0.04); // 60% -> 96% over 10 rounds
      const success = Math.random() < baseProb;
      const reward = success ? (0.7 + Math.random() * 0.3) : (0.1 + Math.random() * 0.3);

      bank.updatePatternStats(lp.id, success, reward);
      lp.outcomes.push({ round, success, reward });
    }
  }

  // Show improvement
  console.log();
  console.log('    After 10 rounds of learning:');
  for (const lp of learningPatterns) {
    const pattern = bank.getPattern(lp.id);
    const totalOutcomes = lp.outcomes.length;
    const successCount = lp.outcomes.filter(o => o.success).length;
    const avgOutcomeReward = lp.outcomes.reduce((s, o) => s + o.reward, 0) / totalOutcomes;

    console.log(`    - [${pattern.taskType}] "${lp.name}"`);
    console.log(`      Updated success rate: ${(pattern.successRate * 100).toFixed(1)}%`);
    console.log(`      Updated uses: ${pattern.uses}`);
    console.log(`      Updated avg reward: ${pattern.avgReward.toFixed(3)}`);
    console.log(`      Recent outcomes: ${successCount}/${totalOutcomes} successful (avg reward: ${avgOutcomeReward.toFixed(2)})`);
  }
  console.log();

  // ─── recordOutcome API ───────────────────────────────────────────────
  console.log('[8] Using recordOutcome API for structured learning...');

  // Record explicit outcomes with the recordOutcome method
  const targetPatternId = patternIds[6]; // Testing trophy strategy
  const beforePattern = bank.getPattern(targetPatternId);
  console.log(`    Pattern: [${beforePattern.taskType}] "${beforePattern.approach.substring(0, 50)}..."`);
  console.log(`    Before: success=${(beforePattern.successRate * 100).toFixed(1)}% uses=${beforePattern.uses}`);

  // Simulate structured outcomes
  const outcomes = [
    { success: true, reward: 0.95 },
    { success: true, reward: 0.88 },
    { success: false, reward: 0.3 },
    { success: true, reward: 0.92 },
    { success: true, reward: 0.97 },
  ];
  for (const outcome of outcomes) {
    await bank.recordOutcome(targetPatternId, outcome.success, outcome.reward);
  }

  const afterPattern = bank.getPattern(targetPatternId);
  console.log(`    After 5 outcomes: success=${(afterPattern.successRate * 100).toFixed(1)}% uses=${afterPattern.uses}`);
  console.log(`    Avg reward: ${afterPattern.avgReward.toFixed(3)}`);
  console.log();

  // ─── Get Individual Pattern Details ──────────────────────────────────
  console.log('[9] Inspecting individual patterns...');
  for (let i = 0; i < 3; i++) {
    const pattern = bank.getPattern(patternIds[i]);
    console.log(`    Pattern ${pattern.id}:`);
    console.log(`      Task type: ${pattern.taskType}`);
    console.log(`      Approach: ${pattern.approach.substring(0, 80)}...`);
    console.log(`      Success rate: ${(pattern.successRate * 100).toFixed(1)}%`);
    console.log(`      Uses: ${pattern.uses}`);
    console.log(`      Avg reward: ${pattern.avgReward.toFixed(3)}`);
    console.log(`      Tags: ${pattern.tags?.join(', ') || 'none'}`);
    console.log(`      Has embedding: ${pattern.embedding ? 'yes' : 'no'}`);
  }
  console.log();

  // ─── Updated Statistics ──────────────────────────────────────────────
  console.log('[10] Final pattern statistics after learning:');
  bank.clearCache(); // Clear cache to get fresh stats
  const finalStats = bank.getPatternStats();
  console.log(`    Total patterns: ${finalStats.totalPatterns}`);
  console.log(`    Average success rate: ${(finalStats.avgSuccessRate * 100).toFixed(1)}%`);
  console.log(`    Average uses: ${finalStats.avgUses.toFixed(1)}`);
  console.log(`    High performing (>=80%): ${finalStats.highPerformingPatterns}`);
  console.log();

  // Show all patterns sorted by success rate
  console.log('    All patterns ranked by success rate:');
  console.log('    ' + '-'.repeat(66));
  console.log(`    ${'Task Type'.padEnd(18)} ${'Success'.padEnd(10)} ${'Uses'.padEnd(8)} ${'AvgReward'.padEnd(10)} Approach`);
  console.log('    ' + '-'.repeat(66));

  const allPatterns = db.prepare(`
    SELECT task_type, approach, success_rate, uses, avg_reward
    FROM reasoning_patterns
    ORDER BY success_rate DESC
  `).all();
  for (const p of allPatterns) {
    const taskType = p.task_type.padEnd(18);
    const success = `${(p.success_rate * 100).toFixed(1)}%`.padEnd(10);
    const uses = String(p.uses).padEnd(8);
    const reward = p.avg_reward.toFixed(3).padEnd(10);
    const approach = p.approach.substring(0, 40) + '...';
    console.log(`    ${taskType} ${success} ${uses} ${reward} ${approach}`);
  }
  console.log();

  // ─── Cleanup ─────────────────────────────────────────────────────────
  db.close();

  console.log('='.repeat(70));
  console.log('  ReasoningBank Demo Complete');
  console.log('  Key features demonstrated:');
  console.log('  - Store reasoning patterns with embeddings for semantic search');
  console.log('  - Search patterns by natural language similarity');
  console.log('  - Track pattern statistics across task types');
  console.log('  - Record outcomes to update pattern success rates');
  console.log('  - Observe learning improvement over simulated usage');
  console.log('  - Query individual patterns with full metadata');
  console.log('='.repeat(70));
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
