/**
 * 09-causal-memory-graph.js - Causal Reasoning with p(y|do(x))
 *
 * Demonstrates CausalMemoryGraph: intervention-based reasoning over agent memories.
 * Builds a DevOps pipeline causal knowledge graph with A/B experiments,
 * uplift estimation, confounder detection, and causal gain calculation.
 *
 * Based on Pearl's do-calculus and uplift modeling from A/B testing.
 *
 * Usage: node examples/advanced/09-causal-memory-graph.js
 */

import { CausalMemoryGraph, createDatabase } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'causal-memory-graph.db');

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

// ─── Helper: Pretty print a table ──────────────────────────────────────────
function printTable(title, rows, columns) {
  console.log(`\n  ${title}`);
  console.log('  ' + '-'.repeat(70));
  if (rows.length === 0) {
    console.log('  (no rows)');
    return;
  }
  // Header
  const header = columns.map(c => c.label.padEnd(c.width)).join(' | ');
  console.log('  ' + header);
  console.log('  ' + columns.map(c => '-'.repeat(c.width)).join('-+-'));
  // Rows
  for (const row of rows) {
    const line = columns.map(c => {
      const val = c.format ? c.format(row[c.key]) : String(row[c.key] ?? '');
      return val.padEnd(c.width);
    }).join(' | ');
    console.log('  ' + line);
  }
}

// ─── Load Schema SQL ────────────────────────────────────────────────────────
function loadSchema(db) {
  // Load both base and frontier schemas using db.exec() which handles
  // multi-statement SQL (triggers, views, etc.) correctly.
  const schemasDir = path.join(__dirname, '..', '..', 'node_modules', 'agentdb', 'dist', 'schemas');
  for (const schemaFile of ['schema.sql', 'frontier-schema.sql']) {
    const schemaPath = path.join(schemasDir, schemaFile);
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      try {
        db.exec(sql);
      } catch (err) {
        // Some PRAGMA statements may fail in WASM mode - that is fine
        console.warn(`    Warning loading ${schemaFile}: ${err.message}`);
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log('  Causal Memory Graph - DevOps Pipeline Causal Reasoning');
  console.log('  p(y|do(x)) - Intervention-Based Causal Inference');
  console.log('='.repeat(72));
  console.log();

  // Clean up previous runs
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }

  // ─── Step 1: Create database and initialize schema ──────────────────────
  console.log('[1] Creating database and loading schemas...');
  const db = await createDatabase(DB_PATH);
  loadSchema(db);
  console.log('    Database created with causal memory schema.\n');

  // ─── Step 2: Create CausalMemoryGraph with mock embedder ───────────────
  console.log('[2] Initializing CausalMemoryGraph with MockEmbedder...');
  const embedder = new MockEmbedder(384);
  const causalGraph = new CausalMemoryGraph(db, undefined, embedder);
  console.log('    CausalMemoryGraph ready.\n');

  // ─── Step 3: Populate episodes for the DevOps pipeline ─────────────────
  console.log('[3] Populating episodes (DevOps pipeline activities)...');
  const now = Math.floor(Date.now() / 1000);
  const sessionId = 'devops-pipeline-001';

  const devOpsActivities = [
    { task: 'Code review',           output: 'Performed thorough code review with 15 comments',          reward: 0.85, success: 1, latency: 120 },
    { task: 'Bug reduction',         output: 'Reduced bug count from 23 to 8 after review cycles',       reward: 0.90, success: 1, latency: 45  },
    { task: 'Unit testing',          output: 'Added 47 unit tests with 92% coverage',                    reward: 0.88, success: 1, latency: 200 },
    { task: 'Deployment success',    output: 'Zero-downtime deployment completed in 3 minutes',           reward: 0.95, success: 1, latency: 180 },
    { task: 'Load testing',          output: 'Load tested at 10k concurrent users, p99 < 200ms',         reward: 0.80, success: 1, latency: 300 },
    { task: 'Performance improvement', output: 'Reduced API latency from 450ms to 120ms',                reward: 0.92, success: 1, latency: 60  },
    { task: 'Security audit',        output: 'Completed OWASP top-10 audit, found 3 critical issues',    reward: 0.75, success: 1, latency: 240 },
    { task: 'Vulnerability reduction', output: 'Patched all critical CVEs, zero high-severity remaining', reward: 0.97, success: 1, latency: 90  },
    { task: 'Knowledge sharing',     output: 'Conducted 4 knowledge transfer sessions with team',        reward: 0.70, success: 1, latency: 60  },
    { task: 'Monitoring setup',      output: 'Deployed Prometheus+Grafana with 25 alerting rules',       reward: 0.88, success: 1, latency: 150 },
    { task: 'Incident response time', output: 'Reduced MTTR from 45 min to 12 min',                     reward: 0.93, success: 1, latency: 30  },
    { task: 'Documentation',         output: 'Created API docs, runbooks, and architecture diagrams',    reward: 0.72, success: 1, latency: 180 },
    { task: 'Onboarding speed',      output: 'New engineer productive in 3 days instead of 2 weeks',     reward: 0.85, success: 1, latency: 4320},
    { task: 'CI/CD pipeline',        output: 'Built GitHub Actions pipeline with 12 stages',             reward: 0.90, success: 1, latency: 120 },
    { task: 'Deployment frequency',  output: 'Increased deploys from weekly to 5x daily',                reward: 0.94, success: 1, latency: 15  },
  ];

  const episodeIds = {};
  for (let i = 0; i < devOpsActivities.length; i++) {
    const a = devOpsActivities[i];
    db.prepare(`
      INSERT INTO episodes (ts, session_id, task, output, reward, success, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(now + i * 60, sessionId, a.task, a.output, a.reward, a.success, a.latency);

    // Track the episode ID for each task
    const row = db.prepare('SELECT last_insert_rowid() as id').get();
    // For sql.js the ID comes from the exec approach; re-query
    const ep = db.prepare("SELECT id FROM episodes WHERE task = ? AND session_id = ?").get(a.task, sessionId);
    episodeIds[a.task] = ep?.id ?? (i + 1);
  }

  const totalEpisodes = db.prepare('SELECT COUNT(*) as count FROM episodes').get();
  console.log(`    Inserted ${totalEpisodes?.count ?? devOpsActivities.length} DevOps episodes.\n`);

  // ─── Step 4: Add causal edges ──────────────────────────────────────────
  console.log('[4] Building causal knowledge graph (8 edges)...');

  const causalEdges = [
    { from: 'Code review',     to: 'Bug reduction',          uplift: 0.35,  confidence: 0.92, mechanism: 'Peer review catches defects before they reach production' },
    { from: 'Unit testing',    to: 'Deployment success',     uplift: 0.42,  confidence: 0.88, mechanism: 'Comprehensive tests prevent regression failures during deploy' },
    { from: 'Load testing',    to: 'Performance improvement', uplift: 0.28,  confidence: 0.85, mechanism: 'Load testing identifies bottlenecks enabling targeted optimization' },
    { from: 'Security audit',  to: 'Vulnerability reduction', uplift: 0.55,  confidence: 0.95, mechanism: 'Systematic audit discovers and prioritizes vulnerability remediation' },
    { from: 'Code review',     to: 'Knowledge sharing',      uplift: 0.20,  confidence: 0.78, mechanism: 'Review comments spread domain knowledge across team members' },
    { from: 'Monitoring setup', to: 'Incident response time', uplift: -0.40, confidence: 0.90, mechanism: 'Proactive monitoring reduces detection time and enables rapid response' },
    { from: 'Documentation',   to: 'Onboarding speed',       uplift: 0.30,  confidence: 0.82, mechanism: 'Well-documented systems accelerate new engineer ramp-up' },
    { from: 'CI/CD pipeline',  to: 'Deployment frequency',   uplift: 0.60,  confidence: 0.93, mechanism: 'Automated pipelines remove manual bottlenecks from release process' },
  ];

  const edgeIdMap = {};
  for (const edge of causalEdges) {
    const fromId = episodeIds[edge.from];
    const toId = episodeIds[edge.to];

    const edgeId = await causalGraph.addCausalEdge({
      fromMemoryId: fromId,
      fromMemoryType: 'episode',
      toMemoryId: toId,
      toMemoryType: 'episode',
      similarity: 0.8,
      uplift: edge.uplift,
      confidence: edge.confidence,
      sampleSize: Math.floor(50 + Math.random() * 200),
      mechanism: edge.mechanism,
      metadata: { domain: 'devops', pipeline: 'ci-cd' },
    });
    edgeIdMap[`${edge.from} -> ${edge.to}`] = edgeId;
    console.log(`    + ${edge.from} --[uplift: ${edge.uplift >= 0 ? '+' : ''}${edge.uplift.toFixed(2)}, conf: ${edge.confidence}]--> ${edge.to}`);
  }

  console.log(`\n    Total causal edges: ${Object.keys(edgeIdMap).length}\n`);

  // ─── Step 5: Create A/B experiments ────────────────────────────────────
  console.log('[5] Creating A/B experiments for key interventions...');

  const experiments = [
    {
      name: 'Code Review Impact on Bug Reduction',
      hypothesis: 'Mandatory code review reduces production bugs by >25%',
      treatmentId: episodeIds['Code review'],
      treatmentType: 'episode',
    },
    {
      name: 'CI/CD Pipeline Impact on Deploy Frequency',
      hypothesis: 'Automated CI/CD pipeline increases deployment frequency by >50%',
      treatmentId: episodeIds['CI/CD pipeline'],
      treatmentType: 'episode',
    },
    {
      name: 'Monitoring Impact on Incident Response',
      hypothesis: 'Proactive monitoring reduces MTTR by >30%',
      treatmentId: episodeIds['Monitoring setup'],
      treatmentType: 'episode',
    },
  ];

  const experimentIds = [];
  for (const exp of experiments) {
    const expId = causalGraph.createExperiment({
      ...exp,
      startTime: now,
      sampleSize: 0,
      status: 'running',
      metadata: { autoGenerated: false, domain: 'devops' },
    });
    experimentIds.push(expId);
    console.log(`    Experiment #${expId}: "${exp.name}"`);
  }

  // ─── Step 6: Record observations ──────────────────────────────────────
  console.log('\n[6] Recording observations for experiments...');

  // Simulate observations for each experiment
  function simulateObservations(experimentId, treatmentMean, controlMean, n) {
    for (let i = 0; i < n; i++) {
      // Treatment group
      const treatmentOutcome = treatmentMean + (Math.random() - 0.5) * 0.3;
      causalGraph.recordObservation({
        experimentId,
        episodeId: 1, // reference episode
        isTreatment: true,
        outcomeValue: Math.max(0, Math.min(1, treatmentOutcome)),
        outcomeType: 'reward',
      });
      // Control group
      const controlOutcome = controlMean + (Math.random() - 0.5) * 0.3;
      causalGraph.recordObservation({
        experimentId,
        episodeId: 1,
        isTreatment: false,
        outcomeValue: Math.max(0, Math.min(1, controlOutcome)),
        outcomeType: 'reward',
      });
    }
  }

  simulateObservations(experimentIds[0], 0.88, 0.55, 50); // Code review
  simulateObservations(experimentIds[1], 0.92, 0.40, 50); // CI/CD
  simulateObservations(experimentIds[2], 0.85, 0.50, 50); // Monitoring

  const obsCount = db.prepare('SELECT COUNT(*) as count FROM causal_observations').get();
  console.log(`    Recorded ${obsCount?.count ?? 300} observations across ${experimentIds.length} experiments.\n`);

  // ─── Step 7: Calculate uplift with statistical significance ───────────
  console.log('[7] Calculating uplift with statistical significance...');
  console.log();

  for (let i = 0; i < experimentIds.length; i++) {
    const result = causalGraph.calculateUplift(experimentIds[i]);
    const exp = experiments[i];
    const significance = result.pValue < 0.05 ? 'SIGNIFICANT' : 'not significant';
    const stars = result.pValue < 0.001 ? '***' : result.pValue < 0.01 ? '**' : result.pValue < 0.05 ? '*' : '';

    console.log(`    Experiment: "${exp.name}"`);
    console.log(`      Uplift:              ${result.uplift >= 0 ? '+' : ''}${result.uplift.toFixed(4)}`);
    console.log(`      p-value:             ${result.pValue.toFixed(6)} ${stars}`);
    console.log(`      95% CI:              [${result.confidenceInterval[0].toFixed(4)}, ${result.confidenceInterval[1].toFixed(4)}]`);
    console.log(`      Statistical test:    ${significance}`);
    console.log();
  }

  // ─── Step 8: Query causal effects ─────────────────────────────────────
  console.log('[8] Querying causal effects from "Code review"...');

  const codeReviewEffects = causalGraph.queryCausalEffects({
    interventionMemoryId: episodeIds['Code review'],
    interventionMemoryType: 'episode',
    minConfidence: 0.5,
    minUplift: 0.0,
  });

  if (codeReviewEffects.length > 0) {
    printTable('Causal Effects of Code Review (do(Code Review))', codeReviewEffects, [
      { key: 'toMemoryId', label: 'Target ID', width: 10 },
      { key: 'mechanism',  label: 'Mechanism', width: 35, format: v => (v || '').substring(0, 35) },
      { key: 'uplift',     label: 'Uplift',    width: 10, format: v => (v >= 0 ? '+' : '') + (v ?? 0).toFixed(3) },
      { key: 'confidence', label: 'Confidence', width: 10, format: v => (v ?? 0).toFixed(3) },
    ]);
  } else {
    console.log('    No causal effects found (this is normal with SQLite fallback).\n');
  }

  // ─── Step 9: Find similar causal patterns ─────────────────────────────
  console.log('\n[9] Finding similar causal patterns to "testing prevents failures"...');

  try {
    const similarPatterns = await causalGraph.findSimilarCausalPatterns(
      'testing prevents failures in production',
      5,
      0.5
    );

    if (similarPatterns.length > 0) {
      printTable('Similar Causal Patterns', similarPatterns, [
        { key: 'mechanism',  label: 'Mechanism',   width: 40, format: v => (v || '').substring(0, 40) },
        { key: 'uplift',     label: 'Uplift',      width: 10, format: v => (v >= 0 ? '+' : '') + (v ?? 0).toFixed(3) },
        { key: 'similarity', label: 'Similarity',  width: 10, format: v => (v ?? 0).toFixed(3) },
      ]);
    } else {
      console.log('    No similar patterns found (vector backend not available for similarity search).');
    }
  } catch (err) {
    console.log(`    Pattern search skipped: ${err.message}`);
  }

  // ─── Step 10: Detect confounders ──────────────────────────────────────
  console.log('\n[10] Detecting potential confounders...');

  const edgeKeys = Object.keys(edgeIdMap);
  for (const key of edgeKeys.slice(0, 3)) {
    const edgeId = edgeIdMap[key];
    try {
      const result = causalGraph.detectConfounders(edgeId);
      const confCount = result.confounders?.length ?? 0;
      console.log(`    Edge "${key}" (id=${edgeId}): ${confCount} potential confounder(s)`);
      if (result.confounders && result.confounders.length > 0) {
        for (const conf of result.confounders.slice(0, 3)) {
          console.log(`      - Memory #${conf.memoryId}: score=${conf.confounderScore.toFixed(3)}, ` +
            `treatment_corr=${conf.correlationWithTreatment.toFixed(3)}, ` +
            `outcome_corr=${conf.correlationWithOutcome.toFixed(3)}`);
        }
      }
    } catch (err) {
      console.log(`    Edge "${key}": confounder detection skipped (${err.message})`);
    }
  }

  // ─── Step 11: Calculate causal gain ───────────────────────────────────
  console.log('\n[11] Calculating causal gain E[outcome|do(treatment)] - E[outcome]...');

  const treatmentTasks = ['Code review', 'Unit testing', 'CI/CD pipeline', 'Security audit'];
  for (const task of treatmentTasks) {
    const treatmentId = episodeIds[task];
    try {
      const gain = causalGraph.calculateCausalGain(treatmentId, 'reward');
      console.log(`    do(${task}):`);
      console.log(`      Causal Gain:  ${gain.causalGain >= 0 ? '+' : ''}${gain.causalGain.toFixed(4)}`);
      console.log(`      Confidence:   ${gain.confidence.toFixed(3)}`);
      console.log(`      Mechanism:    ${gain.mechanism}`);
    } catch (err) {
      console.log(`    do(${task}): calculation failed (${err.message})`);
    }
  }

  // ─── Step 12: Display full causal graph structure ─────────────────────
  console.log('\n[12] Full Causal Graph Structure:');
  console.log();

  const allEdges = db.prepare(`
    SELECT
      ce.id,
      e1.task as from_task,
      e2.task as to_task,
      ce.uplift,
      ce.confidence,
      ce.mechanism,
      ce.sample_size
    FROM causal_edges ce
    JOIN episodes e1 ON ce.from_memory_id = e1.id
    JOIN episodes e2 ON ce.to_memory_id = e2.id
    ORDER BY ABS(ce.uplift) * ce.confidence DESC
  `).all();

  if (allEdges.length > 0) {
    console.log('    Causal Impact Ranking (sorted by |uplift| x confidence):');
    console.log('    ' + '-'.repeat(68));
    console.log('    ' + 'Rank'.padEnd(6) + 'Cause'.padEnd(22) + 'Effect'.padEnd(22) + 'Impact'.padEnd(10) + 'Conf');
    console.log('    ' + '-'.repeat(68));

    allEdges.forEach((edge, idx) => {
      const impact = (Math.abs(edge.uplift ?? 0) * (edge.confidence ?? 0)).toFixed(3);
      const direction = (edge.uplift ?? 0) >= 0 ? '+' : '-';
      console.log('    ' +
        `#${idx + 1}`.padEnd(6) +
        (edge.from_task || '').substring(0, 20).padEnd(22) +
        (edge.to_task || '').substring(0, 20).padEnd(22) +
        `${direction}${impact}`.padEnd(10) +
        (edge.confidence ?? 0).toFixed(2)
      );
    });

    console.log();
    console.log('    Graph Summary:');
    console.log(`      Total edges:          ${allEdges.length}`);
    console.log(`      Positive effects:     ${allEdges.filter(e => (e.uplift ?? 0) > 0).length}`);
    console.log(`      Negative effects:     ${allEdges.filter(e => (e.uplift ?? 0) < 0).length}`);
    console.log(`      Avg confidence:       ${(allEdges.reduce((s, e) => s + (e.confidence ?? 0), 0) / allEdges.length).toFixed(3)}`);
    console.log(`      Avg |uplift|:         ${(allEdges.reduce((s, e) => s + Math.abs(e.uplift ?? 0), 0) / allEdges.length).toFixed(3)}`);

    // Identify the highest-impact interventions
    console.log();
    console.log('    Highest-Impact Interventions:');
    const topInterventions = allEdges.slice(0, 3);
    for (const edge of topInterventions) {
      console.log(`      * ${edge.from_task} --> ${edge.to_task}`);
      console.log(`        Mechanism: ${(edge.mechanism || 'unknown').substring(0, 60)}`);
    }
  } else {
    console.log('    No edges found in graph.');
  }

  // ─── Step 13: Experiment summary ──────────────────────────────────────
  console.log('\n[13] Experiment Summary:');
  const completedExps = db.prepare(`
    SELECT name, hypothesis, uplift, p_value, confidence_interval_low, confidence_interval_high, status
    FROM causal_experiments
    WHERE status = 'completed'
  `).all();

  if (completedExps.length > 0) {
    for (const exp of completedExps) {
      const sig = (exp.p_value ?? 1) < 0.05;
      console.log(`    [${sig ? 'PASS' : 'FAIL'}] ${exp.name}`);
      console.log(`          Hypothesis: ${exp.hypothesis}`);
      console.log(`          Uplift: ${(exp.uplift ?? 0).toFixed(4)}, p=${(exp.p_value ?? 1).toFixed(6)}`);
      console.log(`          CI: [${(exp.confidence_interval_low ?? 0).toFixed(4)}, ${(exp.confidence_interval_high ?? 0).toFixed(4)}]`);
    }
  } else {
    console.log('    No completed experiments found.');
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  Causal Memory Graph example completed successfully.');
  console.log('='.repeat(72));

  try { db.close(); } catch { /* ignore */ }
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
