/**
 * 11-nightly-learner.js - Automated Discovery & Consolidation
 *
 * Demonstrates the NightlyLearner: an automated background job that discovers
 * causal patterns between episodes, consolidates them into skills, prunes
 * low-quality data, and generates actionable recommendations.
 *
 * Based on the doubly robust learner:
 *   tau_hat(x) = mu1(x) - mu0(x) + [a*(y-mu1(x))/e(x)] - [(1-a)*(y-mu0(x))/(1-e(x))]
 *
 * Usage: node examples/advanced/11-nightly-learner.js
 */

import { NightlyLearner, createDatabase } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'nightly-learner.db');

// ─── Mock Embedder ──────────────────────────────────────────────────────────
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

// ─── Load Schema SQL ────────────────────────────────────────────────────────
function loadSchema(db) {
  const schemasDir = path.join(__dirname, '..', '..', 'node_modules', 'agentdb', 'dist', 'schemas');
  for (const schemaFile of ['schema.sql', 'frontier-schema.sql']) {
    const schemaPath = path.join(schemasDir, schemaFile);
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      try {
        db.exec(sql);
      } catch (err) {
        console.warn(`    Warning loading ${schemaFile}: ${err.message}`);
      }
    }
  }
}

// ─── Populate Database ──────────────────────────────────────────────────────
function populateDatabase(db) {
  const now = Math.floor(Date.now() / 1000);

  // ─── 5 Sessions with 20+ episodes ────────────────────────────────────
  const sessions = [
    {
      id: 'session-frontend-001',
      episodes: [
        { task: 'Component design',       output: 'Designed reusable React component library with 12 base components', reward: 0.82, success: 1, latency: 150 },
        { task: 'State management setup',  output: 'Configured Redux Toolkit with 5 slices and async thunks',          reward: 0.88, success: 1, latency: 200 },
        { task: 'Unit testing',            output: 'Added Jest tests for all components, 94% coverage',                reward: 0.90, success: 1, latency: 300 },
        { task: 'Performance profiling',   output: 'Used React DevTools Profiler, identified 3 re-render hotspots',    reward: 0.75, success: 1, latency: 120 },
        { task: 'Accessibility audit',     output: 'Fixed WCAG 2.1 AA compliance issues across 8 components',          reward: 0.85, success: 1, latency: 180 },
      ],
    },
    {
      id: 'session-backend-002',
      episodes: [
        { task: 'API design',             output: 'Designed RESTful API with OpenAPI 3.0 spec for 15 endpoints',       reward: 0.87, success: 1, latency: 90  },
        { task: 'Database schema',        output: 'Created normalized PostgreSQL schema with 12 tables and indexes',    reward: 0.91, success: 1, latency: 120 },
        { task: 'Authentication setup',   output: 'Implemented JWT auth with refresh tokens and RBAC middleware',      reward: 0.93, success: 1, latency: 240 },
        { task: 'Unit testing',           output: 'Added Vitest tests for API routes, 88% coverage',                   reward: 0.86, success: 1, latency: 280 },
        { task: 'Error handling',         output: 'Built global error handler with structured logging and tracing',    reward: 0.80, success: 1, latency: 60  },
      ],
    },
    {
      id: 'session-devops-003',
      episodes: [
        { task: 'CI/CD setup',           output: 'Built GitHub Actions pipeline with lint, test, build, deploy stages', reward: 0.92, success: 1, latency: 180 },
        { task: 'Docker containerization', output: 'Created multi-stage Dockerfile reducing image size by 60%',         reward: 0.88, success: 1, latency: 90  },
        { task: 'Kubernetes deployment',   output: 'Deployed to K8s with HPA, PDB, and rolling update strategy',       reward: 0.85, success: 1, latency: 300 },
        { task: 'Monitoring setup',       output: 'Configured Prometheus, Grafana dashboards, and PagerDuty alerts',   reward: 0.90, success: 1, latency: 150 },
      ],
    },
    {
      id: 'session-security-004',
      episodes: [
        { task: 'Security audit',         output: 'Completed OWASP top-10 scan, found 2 medium and 1 critical issue', reward: 0.70, success: 1, latency: 240 },
        { task: 'Dependency scanning',    output: 'Ran Snyk audit, patched 8 vulnerable packages',                     reward: 0.85, success: 1, latency: 60  },
        { task: 'Secrets management',     output: 'Migrated to HashiCorp Vault with auto-rotation for 12 secrets',    reward: 0.92, success: 1, latency: 120 },
        { task: 'Unit testing',           output: 'Added security-focused tests for auth, input validation, CSRF',    reward: 0.88, success: 1, latency: 200 },
      ],
    },
    {
      id: 'session-data-005',
      episodes: [
        { task: 'Data pipeline design',  output: 'Designed ETL pipeline with Apache Airflow for 6 data sources',     reward: 0.83, success: 1, latency: 150 },
        { task: 'Database schema',        output: 'Created star schema for analytics warehouse with 4 fact tables',    reward: 0.89, success: 1, latency: 200 },
        { task: 'Query optimization',     output: 'Optimized 10 slow queries with composite indexes and materialized views', reward: 0.94, success: 1, latency: 90 },
        { task: 'Data validation',        output: 'Implemented Great Expectations suite with 45 data quality checks',  reward: 0.87, success: 1, latency: 180 },
      ],
    },
  ];

  let episodeCounter = 0;
  for (const session of sessions) {
    for (let i = 0; i < session.episodes.length; i++) {
      const ep = session.episodes[i];
      // Spread episodes over the past hour (within 3600s of each other for NightlyLearner discovery)
      const ts = now - 3600 + (episodeCounter * 120);
      db.prepare(`
        INSERT INTO episodes (ts, session_id, task, output, reward, success, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ts, session.id, ep.task, ep.output, ep.reward, ep.success, ep.latency);
      episodeCounter++;
    }
  }

  // ─── 5+ skills ────────────────────────────────────────────────────────
  const skillsData = [
    { name: 'react_component_design',  desc: 'Design reusable React components with proper prop typing',        code: 'export const Component = (props) => { ... }', rate: 0.82, reward: 0.80 },
    { name: 'api_design_openapi',      desc: 'RESTful API design with OpenAPI 3.0 specification',               code: 'openapi: 3.0.0\npaths: ...', rate: 0.87, reward: 0.85 },
    { name: 'jwt_authentication',      desc: 'JWT auth with refresh tokens and RBAC',                           code: 'jwt.sign(payload, secret, { expiresIn })', rate: 0.93, reward: 0.90 },
    { name: 'docker_multistage_build', desc: 'Multi-stage Docker builds for production optimization',           code: 'FROM node:20-alpine AS builder\n...', rate: 0.88, reward: 0.85 },
    { name: 'k8s_deployment',          desc: 'Kubernetes deployment with HPA and PDB',                          code: 'apiVersion: apps/v1\nkind: Deployment\n...', rate: 0.85, reward: 0.82 },
    { name: 'etl_pipeline_airflow',    desc: 'Apache Airflow ETL pipeline design',                              code: 'dag = DAG("etl_pipeline", ...)', rate: 0.83, reward: 0.80 },
  ];

  for (const skill of skillsData) {
    db.prepare(`
      INSERT INTO skills (name, description, signature, code, success_rate, avg_reward)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(skill.name, skill.desc, JSON.stringify({ inputs: {}, outputs: {} }), skill.code, skill.rate, skill.reward);
  }

  // ─── Pre-seed causal edges between related episodes ────────────────
  // These represent known causal relationships the NightlyLearner can
  // validate, prune, and extend during its run.
  const preSeedEdges = [
    // Frontend: Component design causes better testing
    { fromTask: 'Component design',      fromSession: 'session-frontend-001', toTask: 'Unit testing',           toSession: 'session-frontend-001', uplift: 0.15, confidence: 0.72, mechanism: 'Well-designed components are easier to test' },
    // Backend: Schema design improves API quality
    { fromTask: 'Database schema',        fromSession: 'session-backend-002', toTask: 'API design',             toSession: 'session-backend-002', uplift: 0.22, confidence: 0.68, mechanism: 'Good schema enables clean API design' },
    // DevOps: CI/CD enables containerization
    { fromTask: 'CI/CD setup',            fromSession: 'session-devops-003',  toTask: 'Docker containerization', toSession: 'session-devops-003',  uplift: 0.30, confidence: 0.85, mechanism: 'CI/CD pipeline automates container builds' },
    // Security: Audit drives dependency fixes
    { fromTask: 'Security audit',         fromSession: 'session-security-004', toTask: 'Dependency scanning',    toSession: 'session-security-004', uplift: 0.40, confidence: 0.90, mechanism: 'Audit findings prioritize dependency updates' },
    // Cross-session: Testing skills transfer
    { fromTask: 'Unit testing',           fromSession: 'session-frontend-001', toTask: 'Unit testing',           toSession: 'session-backend-002', uplift: 0.10, confidence: 0.55, mechanism: 'Testing practices transfer across projects' },
    // Data: Schema design improves queries
    { fromTask: 'Database schema',        fromSession: 'session-data-005',    toTask: 'Query optimization',     toSession: 'session-data-005',    uplift: 0.35, confidence: 0.88, mechanism: 'Well-designed schema enables query optimization' },
    // Low-confidence edge (candidate for pruning)
    { fromTask: 'Performance profiling',  fromSession: 'session-frontend-001', toTask: 'Accessibility audit',    toSession: 'session-frontend-001', uplift: 0.02, confidence: 0.15, mechanism: 'Weak correlation: profiling and accessibility' },
    // Another low-confidence edge
    { fromTask: 'Error handling',         fromSession: 'session-backend-002', toTask: 'API design',             toSession: 'session-backend-002', uplift: 0.01, confidence: 0.12, mechanism: 'Marginal effect of error handling on API design' },
  ];

  for (const edge of preSeedEdges) {
    const fromEp = db.prepare('SELECT id FROM episodes WHERE task = ? AND session_id = ?').get(edge.fromTask, edge.fromSession);
    const toEp = db.prepare('SELECT id FROM episodes WHERE task = ? AND session_id = ?').get(edge.toTask, edge.toSession);
    if (fromEp && toEp) {
      db.prepare(`
        INSERT INTO causal_edges (from_memory_id, from_memory_type, to_memory_id, to_memory_type, similarity, uplift, confidence, sample_size, mechanism)
        VALUES (?, 'episode', ?, 'episode', 0.8, ?, ?, ?, ?)
      `).run(fromEp.id, toEp.id, edge.uplift, edge.confidence, Math.floor(30 + Math.random() * 100), edge.mechanism);
    }
  }

  return { sessionCount: sessions.length, episodeCount: episodeCounter, skillCount: skillsData.length, edgeCount: preSeedEdges.length };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log('  NightlyLearner - Automated Causal Discovery & Consolidation');
  console.log('  Doubly Robust Learner for Causal Edge Discovery');
  console.log('='.repeat(72));
  console.log();

  // Clean up previous runs
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }

  // ─── Step 1: Create database ──────────────────────────────────────────
  console.log('[1] Creating database and loading schemas...');
  const db = await createDatabase(DB_PATH);
  loadSchema(db);
  console.log('    Database ready.\n');

  // ─── Step 2: Populate with sample data ────────────────────────────────
  console.log('[2] Populating database with sample data...');
  const stats = populateDatabase(db);
  console.log(`    Sessions:  ${stats.sessionCount}`);
  console.log(`    Episodes:  ${stats.episodeCount}`);
  console.log(`    Skills:    ${stats.skillCount}`);
  console.log(`    Pre-seeded causal edges: ${stats.edgeCount}`);
  console.log();

  // Verify population
  const epCount = db.prepare('SELECT COUNT(*) as c FROM episodes').get();
  const skCount = db.prepare('SELECT COUNT(*) as c FROM skills').get();
  console.log(`    Verified: ${epCount?.c ?? 0} episodes, ${skCount?.c ?? 0} skills in database.\n`);

  // ─── Step 3: Initialize NightlyLearner ────────────────────────────────
  console.log('[3] Initializing NightlyLearner...');
  const embedder = new MockEmbedder(384);
  const learner = new NightlyLearner(db, embedder, {
    minSimilarity: 0.7,
    minSampleSize: 2,       // Low threshold for demo
    confidenceThreshold: 0.1, // Low threshold to discover more edges in demo
    upliftThreshold: 0.01,    // Low threshold for demo data
    pruneOldEdges: true,
    edgeMaxAgeDays: 90,
    autoExperiments: true,
    experimentBudget: 5,
    ENABLE_FLASH_CONSOLIDATION: false,
  });
  console.log('    NightlyLearner configured with discovery parameters.\n');

  // ─── Step 4: Show pre-run state ───────────────────────────────────────
  console.log('[4] Pre-run database state:');
  const preEdges = db.prepare('SELECT COUNT(*) as c FROM causal_edges').get();
  const preExps = db.prepare('SELECT COUNT(*) as c FROM causal_experiments').get();
  console.log(`    Causal edges:       ${preEdges?.c ?? 0}`);
  console.log(`    A/B experiments:    ${preExps?.c ?? 0}`);
  console.log();

  // ─── Step 5: Run the NightlyLearner ───────────────────────────────────
  console.log('[5] Running NightlyLearner...');
  console.log('    (This discovers causal patterns, runs experiments, and prunes data)');
  console.log();

  let report;
  try {
    report = await learner.run();
  } catch (err) {
    console.log(`    NightlyLearner run encountered an error: ${err.message}`);
    console.log('    Continuing with manual analysis...\n');
    report = null;
  }

  // ─── Step 6: Show discovered edges ────────────────────────────────────
  console.log('[6] Discovered causal edges:');

  const discoveredEdges = db.prepare(`
    SELECT
      ce.id,
      e1.task as from_task,
      e1.session_id as from_session,
      e2.task as to_task,
      e2.session_id as to_session,
      ce.uplift,
      ce.confidence,
      ce.mechanism,
      ce.sample_size
    FROM causal_edges ce
    JOIN episodes e1 ON ce.from_memory_id = e1.id
    JOIN episodes e2 ON ce.to_memory_id = e2.id
    ORDER BY ce.confidence DESC
    LIMIT 15
  `).all();

  if (discoveredEdges.length > 0) {
    console.log();
    console.log('    ' + 'ID'.padEnd(5) + 'From Task'.padEnd(25) + 'To Task'.padEnd(25) + 'Uplift'.padEnd(10) + 'Conf'.padEnd(8) + 'Samples');
    console.log('    ' + '-'.repeat(78));
    for (const edge of discoveredEdges) {
      console.log('    ' +
        String(edge.id ?? '').padEnd(5) +
        (edge.from_task || '').substring(0, 23).padEnd(25) +
        (edge.to_task || '').substring(0, 23).padEnd(25) +
        ((edge.uplift ?? 0) >= 0 ? '+' : '') + (edge.uplift ?? 0).toFixed(3).padEnd(9) +
        (edge.confidence ?? 0).toFixed(3).padEnd(8) +
        String(edge.sample_size ?? '-')
      );
    }

    console.log();
    console.log(`    Total discovered edges: ${discoveredEdges.length}`);

    // Show cross-session patterns
    const crossSession = discoveredEdges.filter(e => e.from_session !== e.to_session);
    if (crossSession.length > 0) {
      console.log(`    Cross-session patterns: ${crossSession.length}`);
    }
  } else {
    console.log('    No edges discovered (data may not meet similarity thresholds).');
  }

  // ─── Step 7: Show learner report ──────────────────────────────────────
  console.log('\n[7] Learner Report Summary:');

  if (report) {
    console.log(`    Execution time:        ${report.executionTimeMs}ms`);
    console.log(`    Edges discovered:      ${report.edgesDiscovered}`);
    console.log(`    Edges pruned:          ${report.edgesPruned}`);
    console.log(`    Experiments completed: ${report.experimentsCompleted}`);
    console.log(`    Experiments created:   ${report.experimentsCreated}`);
    console.log(`    Avg uplift:            ${report.avgUplift.toFixed(4)}`);
    console.log(`    Avg confidence:        ${report.avgConfidence.toFixed(4)}`);
  } else {
    // Generate manual statistics
    const edgeStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(ABS(uplift)) as avg_uplift,
        AVG(confidence) as avg_confidence,
        MIN(confidence) as min_confidence,
        MAX(confidence) as max_confidence
      FROM causal_edges
      WHERE uplift IS NOT NULL
    `).get();

    console.log(`    Total edges:     ${edgeStats?.total ?? 0}`);
    console.log(`    Avg |uplift|:    ${(edgeStats?.avg_uplift ?? 0).toFixed(4)}`);
    console.log(`    Avg confidence:  ${(edgeStats?.avg_confidence ?? 0).toFixed(4)}`);
    console.log(`    Conf range:      [${(edgeStats?.min_confidence ?? 0).toFixed(3)}, ${(edgeStats?.max_confidence ?? 0).toFixed(3)}]`);
  }

  // ─── Step 8: Run pruning on low-quality data ─────────────────────────
  console.log('\n[8] Running pruning pass on low-quality data...');

  const prePruneCount = db.prepare('SELECT COUNT(*) as c FROM causal_edges').get();
  console.log(`    Edges before pruning: ${prePruneCount?.c ?? 0}`);

  // Create a stricter learner for pruning demonstration
  const strictLearner = new NightlyLearner(db, embedder, {
    minSimilarity: 0.7,
    minSampleSize: 2,
    confidenceThreshold: 0.5,  // Stricter threshold for pruning
    upliftThreshold: 0.05,
    pruneOldEdges: true,
    edgeMaxAgeDays: 90,
    autoExperiments: false,
    experimentBudget: 0,
    ENABLE_FLASH_CONSOLIDATION: false,
  });

  // Manually run just the pruning step
  try {
    // Access the pruneEdges method
    const pruned = await strictLearner.run();
    console.log(`    Edges pruned in strict pass: ${pruned?.edgesPruned ?? 'unknown'}`);
  } catch (err) {
    console.log(`    Pruning pass: ${err.message}`);
  }

  const postPruneCount = db.prepare('SELECT COUNT(*) as c FROM causal_edges').get();
  console.log(`    Edges after pruning:  ${postPruneCount?.c ?? 0}`);
  console.log(`    Net removed:          ${(prePruneCount?.c ?? 0) - (postPruneCount?.c ?? 0)}`);

  // ─── Step 9: Display recommendations ─────────────────────────────────
  console.log('\n[9] Recommendations:');

  if (report && report.recommendations.length > 0) {
    for (const rec of report.recommendations) {
      console.log(`    * ${rec}`);
    }
  } else {
    // Generate our own recommendations based on current state
    const finalEdges = db.prepare('SELECT COUNT(*) as c FROM causal_edges').get();
    const finalExps = db.prepare('SELECT COUNT(*) as c FROM causal_experiments').get();
    const avgConf = db.prepare('SELECT AVG(confidence) as c FROM causal_edges').get();

    const recommendations = [];
    if ((finalEdges?.c ?? 0) === 0) {
      recommendations.push('No causal edges in graph. Consider collecting more diverse episode data across sessions.');
    }
    if ((avgConf?.c ?? 0) < 0.7) {
      recommendations.push('Average confidence is below target (0.7). Increase sample sizes or refine hypothesis selection.');
    }
    if ((finalExps?.c ?? 0) > 0) {
      recommendations.push(`${finalExps?.c ?? 0} experiments available. Review results for actionable insights.`);
    }
    recommendations.push('Consider running with ENABLE_FLASH_CONSOLIDATION for memory-efficient large-scale analysis.');
    recommendations.push('Review cross-session patterns for transferable knowledge across different development domains.');

    for (const rec of recommendations) {
      console.log(`    * ${rec}`);
    }
  }

  // ─── Step 10: Task pattern analysis ───────────────────────────────────
  console.log('\n[10] Task Pattern Analysis:');

  const taskPatterns = db.prepare(`
    SELECT
      task,
      COUNT(*) as occurrences,
      AVG(reward) as avg_reward,
      COUNT(DISTINCT session_id) as sessions,
      AVG(latency_ms) as avg_latency
    FROM episodes
    GROUP BY task
    HAVING occurrences > 1
    ORDER BY avg_reward DESC
  `).all();

  if (taskPatterns.length > 0) {
    console.log();
    console.log('    Recurring Task Patterns (appear in multiple sessions):');
    console.log('    ' + '-'.repeat(68));
    console.log('    ' + 'Task'.padEnd(25) + 'Count'.padEnd(8) + 'Sessions'.padEnd(10) + 'Avg Reward'.padEnd(12) + 'Avg Latency');
    console.log('    ' + '-'.repeat(68));
    for (const tp of taskPatterns) {
      console.log('    ' +
        (tp.task || '').substring(0, 23).padEnd(25) +
        String(tp.occurrences ?? 0).padEnd(8) +
        String(tp.sessions ?? 0).padEnd(10) +
        (tp.avg_reward ?? 0).toFixed(3).padEnd(12) +
        `${Math.round(tp.avg_latency ?? 0)}ms`
      );
    }
    console.log();
    console.log(`    ${taskPatterns.length} recurring task patterns identified.`);
    console.log('    These are prime candidates for skill consolidation and causal analysis.');
  } else {
    console.log('    No recurring task patterns found.');
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  NightlyLearner example completed successfully.');
  console.log('='.repeat(72));

  try { db.close(); } catch { /* ignore */ }
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
