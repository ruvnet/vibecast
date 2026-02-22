/**
 * 10-explainable-recall.js - Provenance Certificates & Merkle Proofs
 *
 * Demonstrates ExplainableRecall and CausalRecall:
 * - Recall certificates with Merkle proof chains
 * - Justification paths for each retrieved chunk
 * - Full provenance lineage tracing
 * - CausalRecall utility reranking: U = alpha*similarity + beta*uplift - gamma*latencyCost
 * - Certificate quality audit metrics
 *
 * Usage: node examples/advanced/10-explainable-recall.js
 */

import { ExplainableRecall, CausalRecall, createDatabase } from 'agentdb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'explainable-recall.db');

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

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log('  Explainable Recall - Provenance Certificates & Merkle Proofs');
  console.log('='.repeat(72));
  console.log();

  // Clean up previous runs
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }

  // ─── Step 1: Create database ──────────────────────────────────────────
  console.log('[1] Creating database and loading schemas...');
  const db = await createDatabase(DB_PATH);
  loadSchema(db);
  const embedder = new MockEmbedder(384);
  console.log('    Database ready.\n');

  // ─── Step 2: Initialize controllers ───────────────────────────────────
  console.log('[2] Initializing ExplainableRecall and CausalRecall...');
  const explainableRecall = new ExplainableRecall(db, embedder);
  const causalRecall = new CausalRecall(db, embedder, null, {
    alpha: 0.7,
    beta: 0.2,
    gamma: 0.1,
    minConfidence: 0.5,
  });
  console.log('    Controllers initialized.\n');

  // ─── Step 3: Populate sample data ─────────────────────────────────────
  console.log('[3] Populating sample episodes, skills, and provenance sources...');
  const now = Math.floor(Date.now() / 1000);
  const sessionId = 'api-optimization-session';

  const episodes = [
    { task: 'API caching strategy',     output: 'Implemented Redis caching layer with TTL-based invalidation for API responses',           reward: 0.88, latency: 150 },
    { task: 'Database query optimization', output: 'Added composite indexes and query plan analysis reducing avg query time by 60%',       reward: 0.92, latency: 200 },
    { task: 'Connection pooling',       output: 'Configured connection pool with min=5 max=50 idle=10s for PostgreSQL connections',          reward: 0.85, latency: 45  },
    { task: 'API rate limiting',        output: 'Implemented token bucket rate limiter at 1000 req/min with graceful degradation',           reward: 0.80, latency: 30  },
    { task: 'Response compression',     output: 'Enabled gzip compression for responses >1KB reducing bandwidth by 70%',                    reward: 0.75, latency: 5   },
    { task: 'API versioning strategy',  output: 'Implemented URL-based versioning with automatic migration of deprecated endpoints',        reward: 0.70, latency: 120 },
    { task: 'Load balancer tuning',     output: 'Configured Nginx upstream with least_conn and health checks every 5s',                     reward: 0.90, latency: 60  },
    { task: 'API monitoring setup',     output: 'Deployed distributed tracing with OpenTelemetry and Jaeger for API call analysis',          reward: 0.87, latency: 90  },
  ];

  const episodeIds = [];
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    db.prepare(`
      INSERT INTO episodes (ts, session_id, task, output, reward, success, latency_ms)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(now + i * 60, sessionId, ep.task, ep.output, ep.reward, ep.latency);
    const row = db.prepare("SELECT MAX(id) as id FROM episodes").get();
    episodeIds.push(row?.id ?? (i + 1));
  }

  // Add skills
  const skills = [
    { name: 'cache_implementation', desc: 'Redis caching patterns with TTL and invalidation', code: 'redis.set(key, val, {EX: ttl})', rate: 0.88 },
    { name: 'query_optimizer',      desc: 'Database query analysis and index optimization',    code: 'EXPLAIN ANALYZE SELECT ...', rate: 0.92 },
    { name: 'rate_limiter',         desc: 'Token bucket rate limiting implementation',          code: 'new TokenBucket(rate, burst)', rate: 0.80 },
    { name: 'compression_handler',  desc: 'Response compression middleware',                    code: 'app.use(compression())',     rate: 0.75 },
    { name: 'load_balancer_config', desc: 'Nginx upstream configuration and health checks',    code: 'upstream { least_conn; }',   rate: 0.90 },
  ];

  for (const skill of skills) {
    db.prepare(`
      INSERT INTO skills (name, description, signature, code, success_rate)
      VALUES (?, ?, ?, ?, ?)
    `).run(skill.name, skill.desc, JSON.stringify({ inputs: {}, outputs: {} }), skill.code, skill.rate);
  }

  // Add provenance sources for episodes
  const crypto = await import('crypto');
  for (let i = 0; i < episodeIds.length; i++) {
    const ep = episodes[i];
    const contentHash = crypto.createHash('sha256')
      .update(`${ep.task}:${ep.output}`)
      .digest('hex');
    try {
      db.prepare(`
        INSERT OR IGNORE INTO provenance_sources (source_type, source_id, content_hash, creator)
        VALUES (?, ?, ?, ?)
      `).run('episode', episodeIds[i], contentHash, 'api-optimization-agent');
    } catch { /* ignore duplicate */ }
  }

  // Add some causal edges for the CausalRecall demo
  const causalEdges = [
    { from: 0, to: 1, uplift: 0.35, confidence: 0.88, mechanism: 'Caching reduces DB load enabling optimization' },
    { from: 1, to: 6, uplift: 0.28, confidence: 0.82, mechanism: 'Optimized queries improve load balancer throughput' },
    { from: 3, to: 7, uplift: 0.22, confidence: 0.75, mechanism: 'Rate limiting provides predictable metrics for monitoring' },
    { from: 2, to: 1, uplift: 0.15, confidence: 0.70, mechanism: 'Connection pooling improves query execution efficiency' },
  ];

  for (const edge of causalEdges) {
    db.prepare(`
      INSERT INTO causal_edges (from_memory_id, from_memory_type, to_memory_id, to_memory_type, similarity, uplift, confidence, sample_size, mechanism)
      VALUES (?, 'episode', ?, 'episode', 0.8, ?, ?, 100, ?)
    `).run(episodeIds[edge.from], episodeIds[edge.to], edge.uplift, edge.confidence, edge.mechanism);
  }

  console.log(`    Inserted ${episodes.length} episodes, ${skills.length} skills, ${causalEdges.length} causal edges.\n`);

  // ─── Step 4: Create recall certificate ────────────────────────────────
  console.log('[4] Creating recall certificate for "API optimization strategies"...');
  console.log();

  const queryText = 'API optimization strategies for high-throughput systems';
  const queryId = 'query-api-opt-001';

  // Build chunks for the certificate (simulating retrieval results)
  const chunks = episodes.map((ep, i) => ({
    id: String(episodeIds[i]),
    type: 'episode',
    content: `${ep.task}: ${ep.output}`,
    relevance: ep.reward, // Use reward as proxy for relevance
  }));

  const requirements = ['caching', 'optimization', 'monitoring', 'compression', 'rate limiting'];

  const certificate = await explainableRecall.createCertificate({
    queryId,
    queryText,
    chunks,
    requirements,
    accessLevel: 'internal',
  });

  console.log('    Certificate Created:');
  console.log(`      ID:                 ${certificate.id.substring(0, 24)}...`);
  console.log(`      Query:              "${certificate.queryText}"`);
  console.log(`      Chunks included:    ${certificate.chunkIds.length}`);
  console.log(`      Minimal hitting set: ${certificate.minimalWhy.length} chunks`);
  console.log(`      Redundancy ratio:   ${certificate.redundancyRatio.toFixed(2)}x`);
  console.log(`      Completeness:       ${(certificate.completenessScore * 100).toFixed(1)}%`);
  console.log(`      Merkle root:        ${certificate.merkleRoot.substring(0, 24)}...`);
  console.log(`      Proof chain items:  ${certificate.proofChain.length}`);
  console.log(`      Latency:            ${certificate.latencyMs}ms`);
  console.log(`      Access level:       ${certificate.accessLevel}`);

  // ─── Step 5: Verify the certificate ───────────────────────────────────
  console.log('\n[5] Verifying certificate integrity...');

  const verification = explainableRecall.verifyCertificate(certificate.id);
  console.log(`    Valid:   ${verification.valid}`);
  if (verification.issues.length > 0) {
    console.log(`    Issues:  ${verification.issues.join(', ')}`);
  } else {
    console.log('    Issues:  none (all checks passed)');
  }

  // ─── Step 6: Get justification paths ──────────────────────────────────
  console.log('\n[6] Justification paths for each chunk...');
  console.log();

  for (const chunkId of certificate.chunkIds) {
    const justification = explainableRecall.getJustification(certificate.id, chunkId);
    if (justification) {
      const isEssential = certificate.minimalWhy.includes(chunkId);
      console.log(`    Chunk #${chunkId} [${isEssential ? 'ESSENTIAL' : 'supporting'}]:`);
      console.log(`      Type:            ${justification.chunkType}`);
      console.log(`      Reason:          ${justification.reason}`);
      console.log(`      Necessity score: ${justification.necessityScore.toFixed(3)}`);
      console.log(`      Path:            ${justification.pathElements.join(' -> ')}`);
    }
  }

  // ─── Step 7: Trace full provenance lineage ────────────────────────────
  console.log('\n[7] Tracing full provenance lineage...');

  try {
    const provenance = explainableRecall.traceProvenance(certificate.id);
    console.log(`    Provenance graph nodes: ${provenance.graph.nodes.length}`);
    console.log(`    Provenance graph edges: ${provenance.graph.edges.length}`);
    console.log();

    console.log('    Provenance Graph:');
    for (const node of provenance.graph.nodes) {
      console.log(`      [${node.type}] ${node.label}`);
    }
    console.log();
    for (const edge of provenance.graph.edges.slice(0, 10)) {
      const fromNode = provenance.graph.nodes.find(n => n.id === edge.from);
      const toNode = provenance.graph.nodes.find(n => n.id === edge.to);
      console.log(`      ${fromNode?.label ?? edge.from} --[${edge.type}]--> ${toNode?.label ?? edge.to}`);
    }

    // Show source lineage details
    console.log();
    console.log('    Source Lineage Details:');
    let lineageCount = 0;
    for (const [hash, lineage] of provenance.sources) {
      if (lineageCount >= 3) { console.log('    ... (truncated)'); break; }
      if (lineage.length > 0) {
        console.log(`      Hash: ${hash.substring(0, 24)}...`);
        for (const source of lineage) {
          console.log(`        ${source.sourceType} #${source.sourceId} (creator: ${source.creator ?? 'unknown'})`);
        }
        lineageCount++;
      }
    }
  } catch (err) {
    console.log(`    Provenance tracing encountered an issue: ${err.message}`);
  }

  // ─── Step 8: Audit the certificate ────────────────────────────────────
  console.log('\n[8] Auditing certificate quality...');

  try {
    const audit = explainableRecall.auditCertificate(certificate.id);
    console.log('    Quality Metrics:');
    console.log(`      Completeness:      ${(audit.quality.completeness * 100).toFixed(1)}%`);
    console.log(`      Redundancy ratio:  ${audit.quality.redundancy.toFixed(2)}x`);
    console.log(`      Avg necessity:     ${audit.quality.avgNecessity.toFixed(3)}`);
    console.log(`      Justifications:    ${audit.justifications.length}`);
    console.log();

    // Show justification breakdown by reason
    const reasonCounts = {};
    for (const j of audit.justifications) {
      reasonCounts[j.reason] = (reasonCounts[j.reason] || 0) + 1;
    }
    console.log('    Justification Breakdown:');
    for (const [reason, count] of Object.entries(reasonCounts)) {
      console.log(`      ${reason}: ${count} chunk(s)`);
    }
  } catch (err) {
    console.log(`    Audit encountered an issue: ${err.message}`);
  }

  // ─── Step 9: CausalRecall with utility reranking ──────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  CausalRecall - Utility-Based Reranking');
  console.log('  U = alpha * similarity + beta * uplift - gamma * latencyCost');
  console.log('='.repeat(72));
  console.log();

  console.log('[9] Demonstrating CausalRecall with different weight configurations...');
  console.log();

  // We will manually rerank using the CausalRecall's rerankByUtility method
  // since we don't have a real vector backend for full recall
  const candidatesForRerank = episodes.map((ep, i) => ({
    id: String(episodeIds[i]),
    type: 'episode',
    content: `${ep.task}: ${ep.output}`,
    similarity: 0.5 + ep.reward * 0.5, // Simulate similarity scores
    latencyMs: ep.latency,
  }));

  // Build a causal edge map for the candidates
  const edgeMap = new Map();
  for (const edge of causalEdges) {
    const fromId = String(episodeIds[edge.from]);
    if (!edgeMap.has(fromId)) edgeMap.set(fromId, []);
    edgeMap.get(fromId).push({
      id: 0,
      fromMemoryId: episodeIds[edge.from],
      fromMemoryType: 'episode',
      toMemoryId: episodeIds[edge.to],
      toMemoryType: 'episode',
      similarity: 0.8,
      uplift: edge.uplift,
      confidence: edge.confidence,
      mechanism: edge.mechanism,
    });
  }

  const weightConfigs = [
    { name: 'Similarity-heavy',   alpha: 0.8, beta: 0.1, gamma: 0.1 },
    { name: 'Balanced',           alpha: 0.5, beta: 0.3, gamma: 0.2 },
    { name: 'Causal-heavy',       alpha: 0.3, beta: 0.6, gamma: 0.1 },
    { name: 'Latency-sensitive',  alpha: 0.4, beta: 0.2, gamma: 0.4 },
  ];

  for (const wc of weightConfigs) {
    // Create a temporary CausalRecall with these weights
    const tempRecall = new CausalRecall(db, embedder, null, {
      alpha: wc.alpha,
      beta: wc.beta,
      gamma: wc.gamma,
      minConfidence: 0.5,
    });

    // Access the private rerank method via the prototype
    const reranked = tempRecall.rerankByUtility(
      candidatesForRerank.map(c => ({ ...c })),
      edgeMap
    );

    console.log(`    ${wc.name} (alpha=${wc.alpha}, beta=${wc.beta}, gamma=${wc.gamma}):`);
    console.log('    ' + '-'.repeat(64));
    console.log('    ' + 'Rank'.padEnd(6) + 'Task'.padEnd(30) + 'Utility'.padEnd(10) + 'Sim'.padEnd(8) + 'Uplift');
    console.log('    ' + '-'.repeat(64));
    for (const r of reranked.slice(0, 5)) {
      // Get task name from content
      const taskName = r.content.split(':')[0].substring(0, 28);
      console.log('    ' +
        `#${r.rank}`.padEnd(6) +
        taskName.padEnd(30) +
        r.utilityScore.toFixed(4).padEnd(10) +
        r.similarity.toFixed(3).padEnd(8) +
        (r.uplift >= 0 ? '+' : '') + r.uplift.toFixed(3)
      );
    }
    console.log();
  }

  // ─── Step 10: Certificate quality metrics comparison ──────────────────
  console.log('[10] Certificate Quality Metrics Summary:');
  console.log();

  try {
    const certQuality = db.prepare(`
      SELECT
        id,
        completeness_score,
        redundancy_ratio,
        latency_ms,
        access_level
      FROM recall_certificates
    `).all();

    if (certQuality.length > 0) {
      for (const cq of certQuality) {
        console.log(`    Certificate ${(cq.id || '').substring(0, 16)}...`);
        console.log(`      Completeness:  ${((cq.completeness_score ?? 0) * 100).toFixed(1)}%`);
        console.log(`      Redundancy:    ${(cq.redundancy_ratio ?? 0).toFixed(2)}x`);
        console.log(`      Latency:       ${cq.latency_ms ?? 0}ms`);
        console.log(`      Access:        ${cq.access_level ?? 'unknown'}`);
      }
    }

    // Show justification quality distribution
    const justStats = db.prepare(`
      SELECT
        reason,
        COUNT(*) as count,
        AVG(necessity_score) as avg_necessity,
        MIN(necessity_score) as min_necessity,
        MAX(necessity_score) as max_necessity
      FROM justification_paths
      GROUP BY reason
      ORDER BY avg_necessity DESC
    `).all();

    if (justStats.length > 0) {
      console.log();
      console.log('    Justification Quality Distribution:');
      console.log('    ' + '-'.repeat(60));
      console.log('    ' + 'Reason'.padEnd(18) + 'Count'.padEnd(8) + 'Avg'.padEnd(8) + 'Min'.padEnd(8) + 'Max');
      console.log('    ' + '-'.repeat(60));
      for (const js of justStats) {
        console.log('    ' +
          (js.reason || '').padEnd(18) +
          String(js.count ?? 0).padEnd(8) +
          (js.avg_necessity ?? 0).toFixed(3).padEnd(8) +
          (js.min_necessity ?? 0).toFixed(3).padEnd(8) +
          (js.max_necessity ?? 0).toFixed(3)
        );
      }
    }
  } catch (err) {
    console.log(`    Quality metrics query failed: ${err.message}`);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  Explainable Recall example completed successfully.');
  console.log('='.repeat(72));

  try { db.close(); } catch { /* ignore */ }
  try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
