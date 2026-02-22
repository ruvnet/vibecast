/**
 * 01-unified-agentdb.js - Core AgentDB Unified Mode
 *
 * Demonstrates the AgentDB unified interface that provides a single entry point
 * to all three controllers (reflexion, skills, causal) with automatic persistence
 * to a single .rvf file.
 *
 * Usage: node examples/practical/01-unified-agentdb.js
 */

import { AgentDB } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'test-unified.rvf');

// Clean up any previous test file
function cleanup() {
  try {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  } catch { /* ignore */ }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  AgentDB Unified Mode - Single-File Database Demo');
  console.log('='.repeat(70));
  console.log();

  cleanup();

  // ─── Step 1: Create and Initialize AgentDB ───────────────────────────
  console.log('[1] Creating AgentDB instance with unified .rvf backend...');
  const db = new AgentDB({
    dbPath: DB_PATH,
    vectorDimension: 384,
  });

  await db.initialize();
  console.log(`    Mode: ${db.isUnifiedMode ? 'Unified .rvf' : 'Legacy'}`);
  console.log(`    WASM: ${db.isWasm}`);
  console.log(`    Vector backend: ${db.vectorBackendName}`);
  console.log();

  // ─── Step 2: Get All 3 Controllers ───────────────────────────────────
  console.log('[2] Getting controllers...');
  const reflexion = db.getController('reflexion');
  const skills = db.getController('skills');
  const causal = db.getController('causal');
  console.log('    Reflexion controller:', reflexion.constructor.name);
  console.log('    Skills controller:', skills.constructor.name);
  console.log('    Causal controller:', causal.constructor.name);
  console.log();

  // ─── Step 3: Store Episodes ──────────────────────────────────────────
  console.log('[3] Storing 3 episodes with different outcomes...');

  const episode1Id = await reflexion.storeEpisode({
    sessionId: 'session-unified-001',
    task: 'Fix SQL injection vulnerability in login form',
    input: 'User login form with raw SQL concatenation',
    output: 'Replaced string concatenation with parameterized queries using prepared statements',
    critique: 'Good fix but should also add input validation layer',
    reward: 0.85,
    success: true,
    latencyMs: 1200,
    tokensUsed: 450,
    tags: ['security', 'sql-injection'],
  });
  console.log(`    Episode 1 (success): id=${episode1Id}`);

  const episode2Id = await reflexion.storeEpisode({
    sessionId: 'session-unified-001',
    task: 'Optimize database query for user dashboard',
    input: 'Dashboard loading takes 5 seconds due to N+1 queries',
    output: 'Added eager loading but forgot to add index on foreign key',
    critique: 'Partial fix - eager loading helps but missing index still causes slow scans',
    reward: 0.4,
    success: false,
    latencyMs: 2500,
    tokensUsed: 680,
    tags: ['performance', 'database'],
  });
  console.log(`    Episode 2 (failure): id=${episode2Id}`);

  const episode3Id = await reflexion.storeEpisode({
    sessionId: 'session-unified-002',
    task: 'Implement JWT authentication middleware',
    input: 'API endpoints need authentication',
    output: 'Created middleware with token validation, refresh tokens, and role-based access',
    critique: 'Comprehensive solution with proper token rotation',
    reward: 0.95,
    success: true,
    latencyMs: 1800,
    tokensUsed: 920,
    tags: ['auth', 'jwt', 'middleware'],
  });
  console.log(`    Episode 3 (success): id=${episode3Id}`);
  console.log();

  // ─── Step 4: Create Skills ───────────────────────────────────────────
  console.log('[4] Creating 2 skills...');

  const skill1Id = await skills.createSkill({
    name: 'sql_injection_fix',
    description: 'Fix SQL injection vulnerabilities by converting to parameterized queries',
    code: `function fixSqlInjection(query) {
  // Replace string concatenation with parameterized queries
  return query.replace(/\\+ *['"].*?['"] *\\+/g, '?');
}`,
    signature: {
      inputs: { query: 'string', params: 'object' },
      outputs: { safeQuery: 'string' },
    },
    successRate: 0.92,
    uses: 15,
    avgReward: 0.88,
  });
  console.log(`    Skill 1 (sql_injection_fix): id=${skill1Id}`);

  const skill2Id = await skills.createSkill({
    name: 'jwt_auth_middleware',
    description: 'Create JWT authentication middleware with refresh token support',
    code: `function createAuthMiddleware(secret) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      req.user = jwt.verify(token, secret);
      next();
    } catch { res.status(403).json({ error: 'Invalid token' }); }
  };
}`,
    signature: {
      inputs: { secret: 'string', options: 'object' },
      outputs: { middleware: 'function' },
    },
    successRate: 0.95,
    uses: 22,
    avgReward: 0.91,
  });
  console.log(`    Skill 2 (jwt_auth_middleware): id=${skill2Id}`);
  console.log();

  // ─── Step 5: Add Causal Edge ─────────────────────────────────────────
  console.log('[5] Adding causal edge: episode -> skill relationship...');

  const edgeId = await causal.addCausalEdge({
    fromMemoryId: episode1Id,
    fromMemoryType: 'episode',
    toMemoryId: skill1Id,
    toMemoryType: 'skill',
    similarity: 0.92,
    uplift: 0.35,
    confidence: 0.88,
    sampleSize: 15,
    mechanism: 'SQL injection fix episode led to reusable parameterized query skill',
    metadata: { autoGenerated: false },
  });
  console.log(`    Causal edge created: id=${edgeId}`);
  console.log('    From: episode (SQL injection fix) -> To: skill (sql_injection_fix)');
  console.log('    Uplift: 0.35, Confidence: 0.88');
  console.log();

  // ─── Step 6: Query Data Back ─────────────────────────────────────────
  console.log('[6] Querying data back...');

  // Retrieve relevant episodes for a security task
  const relevantEpisodes = await reflexion.retrieveRelevant({
    task: 'security vulnerability in user input handling',
    k: 3,
  });
  console.log(`    Relevant episodes for "security vulnerability": ${relevantEpisodes.length} found`);
  for (const ep of relevantEpisodes) {
    console.log(`      - [${ep.success ? 'OK' : 'FAIL'}] "${ep.task}" (reward: ${ep.reward})`);
  }

  // Search for security-related skills
  const securitySkills = await skills.searchSkills({
    task: 'security authentication protection',
    k: 5,
    minSuccessRate: 0.0,
  });
  console.log(`    Security skills found: ${securitySkills.length}`);
  for (const sk of securitySkills) {
    console.log(`      - "${sk.name}" (success: ${(sk.successRate * 100).toFixed(0)}%, uses: ${sk.uses})`);
  }

  // Query causal effects
  const causalEffects = causal.queryCausalEffects({
    interventionMemoryId: episode1Id,
    interventionMemoryType: 'episode',
    minConfidence: 0.5,
  });
  console.log(`    Causal effects from episode ${episode1Id}: ${causalEffects.length} edges`);
  for (const edge of causalEffects) {
    console.log(`      - ${edge.fromMemoryType}(${edge.fromMemoryId}) -> ${edge.toMemoryType}(${edge.toMemoryId}), uplift: ${edge.uplift}`);
  }
  console.log();

  // ─── Step 7: Save and Close ──────────────────────────────────────────
  console.log('[7] Saving and closing database...');
  await db.save();
  await db.close();
  const fileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  console.log(`    Database saved to: ${DB_PATH}`);
  console.log(`    File size: ${(fileSize / 1024).toFixed(1)} KB`);
  console.log();

  // ─── Step 8: Reopen and Verify Persistence ───────────────────────────
  console.log('[8] Reopening database and verifying persistence...');
  const db2 = new AgentDB({
    dbPath: DB_PATH,
    vectorDimension: 384,
  });
  await db2.initialize();

  const reflexion2 = db2.getController('reflexion');
  const skills2 = db2.getController('skills');
  const causal2 = db2.getController('causal');

  // Verify episodes persisted (use direct SQL to confirm data survived reopen)
  const rawDb2 = db2.database;
  const episodeRows = rawDb2.prepare('SELECT id, task, reward, success FROM episodes ORDER BY id').all();
  console.log(`    Episodes after reopen: ${episodeRows.length} persisted`);
  for (const ep of episodeRows) {
    console.log(`      - id=${ep.id} "${ep.task}" (reward: ${ep.reward}, success: ${ep.success === 1})`);
  }

  // Verify skills persisted via SQL + semantic search
  const skillRows = rawDb2.prepare('SELECT id, name, success_rate FROM skills ORDER BY id').all();
  console.log(`    Skills after reopen: ${skillRows.length} persisted`);
  for (const sk of skillRows) {
    console.log(`      - id=${sk.id} "${sk.name}" (success: ${(sk.success_rate * 100).toFixed(0)}%)`);
  }

  // Also test semantic search on reopened database
  const reloadedSkills = await skills2.searchSkills({
    task: 'authentication',
    k: 5,
    minSuccessRate: 0.0,
  });
  console.log(`    Skill search after reopen: ${reloadedSkills.length} found for "authentication"`);

  // Verify causal edges persisted
  const reloadedEdges = causal2.queryCausalEffects({
    interventionMemoryId: episode1Id,
    interventionMemoryType: 'episode',
    minConfidence: 0.5,
  });
  console.log(`    Causal edges after reopen: ${reloadedEdges.length} found`);

  await db2.close();

  // ─── Cleanup ─────────────────────────────────────────────────────────
  cleanup();

  console.log();
  console.log('='.repeat(70));
  console.log('  Unified Mode Demo Complete');
  console.log('  - All 3 controllers work through a single AgentDB instance');
  console.log('  - Data persists to a single .rvf file');
  console.log('  - Reopening restores episodes, skills, and causal edges');
  console.log('='.repeat(70));
}

main().then(() => { process.exit(0); }).catch((err) => {
  console.error('Error:', err);
  cleanup();
  process.exit(1);
});
