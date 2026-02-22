/**
 * Example 08 - Memory Synthesis & MMR Diversity Ranking
 *
 * Demonstrates two complementary agentdb controllers:
 *
 * 1. ContextSynthesizer - Generates coherent narratives from memory patterns
 *    including summary, patterns, successRate, recommendations, keyInsights.
 *
 * 2. MMRDiversityRanker - Maximal Marginal Relevance algorithm for selecting
 *    diverse results that balance relevance with novelty.
 *
 * @module examples/intermediate/08-context-synthesizer
 */

import {
  ContextSynthesizer,
  MMRDiversityRanker,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock Embedder (deterministic, no external model needed)
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

// ---------------------------------------------------------------------------
// Memory patterns dataset (15 entries with varied outcomes)
// ---------------------------------------------------------------------------
const memories = [
  // ---- Successful tasks ----
  {
    task: 'api-design',
    reward: 0.95,
    success: true,
    critique: 'Use RESTful conventions. Implement proper error codes. Add pagination for list endpoints.',
    input: 'Design user management API',
    output: 'Created OpenAPI spec with 12 endpoints',
    similarity: 0.92,
  },
  {
    task: 'database-optimization',
    reward: 0.90,
    success: true,
    critique: 'Use composite indexes. Implement query plan analysis. Add connection pooling.',
    input: 'Optimize slow queries on orders table',
    output: 'Reduced p99 latency from 800ms to 45ms',
    similarity: 0.88,
  },
  {
    task: 'auth-implementation',
    reward: 0.92,
    success: true,
    critique: 'Use JWT with short expiry. Implement refresh token rotation. Add rate limiting on auth endpoints.',
    input: 'Implement authentication system',
    output: 'Deployed JWT + refresh token auth with RBAC',
    similarity: 0.85,
  },
  {
    task: 'caching-strategy',
    reward: 0.88,
    success: true,
    critique: 'Use multi-layer caching. Implement cache invalidation patterns. Add cache warming on deploy.',
    input: 'Reduce API response times',
    output: 'Implemented Redis + CDN caching, 70% cache hit rate',
    similarity: 0.80,
  },
  {
    task: 'testing-framework',
    reward: 0.85,
    success: true,
    critique: 'Use property-based testing for edge cases. Implement contract testing between services. Add mutation testing.',
    input: 'Improve test coverage and quality',
    output: 'Coverage increased from 45% to 92%',
    similarity: 0.78,
  },
  {
    task: 'ci-cd-pipeline',
    reward: 0.93,
    success: true,
    critique: 'Implement blue-green deployments. Add automated rollback. Use canary releases for critical services.',
    input: 'Build deployment pipeline',
    output: 'Zero-downtime deployments with 5-minute rollback',
    similarity: 0.75,
  },
  {
    task: 'monitoring-setup',
    reward: 0.82,
    success: true,
    critique: 'Use structured logging. Implement distributed tracing. Add SLO-based alerting.',
    input: 'Set up observability stack',
    output: 'Deployed Grafana + Prometheus + Jaeger',
    similarity: 0.70,
  },
  {
    task: 'api-design',
    reward: 0.91,
    success: true,
    critique: 'Use GraphQL for flexible queries. Implement DataLoader for N+1 prevention. Add rate limiting.',
    input: 'Design product catalog API',
    output: 'GraphQL schema with 8 types and federation support',
    similarity: 0.90,
  },
  // ---- Failed tasks ----
  {
    task: 'migration-rollback',
    reward: 0.25,
    success: false,
    critique: 'Fix migration ordering. Use transactional DDL. Add pre-migration backup step.',
    input: 'Migrate from MongoDB to PostgreSQL',
    output: 'Migration failed due to circular foreign keys',
    similarity: 0.65,
  },
  {
    task: 'performance-tuning',
    reward: 0.30,
    success: false,
    critique: 'Improve profiling methodology. Use flame graphs for hotspot detection.',
    input: 'Fix memory leak in worker service',
    output: 'Identified leak but fix introduced regression',
    similarity: 0.60,
  },
  {
    task: 'security-audit',
    reward: 0.40,
    success: false,
    critique: 'Add SAST scanning to pipeline. Implement dependency audit. Fix CORS misconfiguration.',
    input: 'Security review of payment service',
    output: 'Found 3 critical vulnerabilities, 1 unresolved',
    similarity: 0.55,
  },
  {
    task: 'data-pipeline',
    reward: 0.35,
    success: false,
    critique: 'Use idempotent operations. Implement exactly-once processing. Add dead letter queue.',
    input: 'Build real-time analytics pipeline',
    output: 'Pipeline works but loses ~2% of events under load',
    similarity: 0.50,
  },
  // ---- Mixed results ----
  {
    task: 'microservices-split',
    reward: 0.60,
    success: true,
    critique: 'Use domain-driven design for service boundaries. Implement saga pattern. Add circuit breakers.',
    input: 'Split monolith into microservices',
    output: 'Extracted 3 services but coupling remains for orders',
    similarity: 0.72,
  },
  {
    task: 'load-testing',
    reward: 0.55,
    success: false,
    critique: 'Use realistic traffic patterns. Implement chaos engineering. Add auto-scaling policies.',
    input: 'Validate system handles 10x traffic',
    output: 'System handles 6x before degradation',
    similarity: 0.68,
  },
  {
    task: 'documentation',
    reward: 0.70,
    success: true,
    critique: 'Use architecture decision records. Add runbooks for incidents. Create onboarding guide.',
    input: 'Document system architecture',
    output: 'Published 15 ADRs and 8 runbooks',
    similarity: 0.62,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(72));
  console.log('  Example 08 - Context Synthesizer & MMR Diversity Ranker');
  console.log('='.repeat(72));

  // -----------------------------------------------------------------------
  // Part 1: Context Synthesis from memories
  // -----------------------------------------------------------------------
  console.log('\n--- Part 1: Context Synthesis ---\n');

  const context = ContextSynthesizer.synthesize(memories, {
    minPatternFrequency: 2,
    includeRecommendations: true,
    maxSummaryLength: 500,
  });

  console.log('  Summary:');
  console.log(`    ${context.summary}\n`);

  console.log(`  Total memories analyzed: ${context.totalMemories}`);
  console.log(`  Success rate           : ${(context.successRate * 100).toFixed(1)}%`);
  console.log(`  Average reward         : ${context.averageReward.toFixed(3)}`);

  console.log(`\n  Patterns (${context.patterns.length}):`);
  for (const p of context.patterns) {
    console.log(`    - ${p}`);
  }

  console.log(`\n  Key Insights (${context.keyInsights.length}):`);
  for (const insight of context.keyInsights) {
    console.log(`    * ${insight}`);
  }

  console.log(`\n  Recommendations (${context.recommendations.length}):`);
  for (const rec of context.recommendations) {
    console.log(`    > ${rec}`);
  }

  // -----------------------------------------------------------------------
  // Part 2: Extract actionable steps from successful memories
  // -----------------------------------------------------------------------
  console.log('\n--- Part 2: Actionable Steps from Successes ---\n');

  const steps = ContextSynthesizer.extractActionableSteps(memories);
  if (steps.length > 0) {
    for (const step of steps) {
      console.log(`    ${step}`);
    }
  } else {
    console.log('    (No numbered steps found in critiques)');
  }

  // -----------------------------------------------------------------------
  // Part 3: Synthesize subsets for comparison
  // -----------------------------------------------------------------------
  console.log('\n--- Part 3: Subset Synthesis Comparison ---\n');

  const successOnly = memories.filter(m => m.success);
  const failedOnly  = memories.filter(m => !m.success);

  const successContext = ContextSynthesizer.synthesize(successOnly);
  const failedContext  = ContextSynthesizer.synthesize(failedOnly);

  console.log('  Successes only:');
  console.log(`    Count          : ${successContext.totalMemories}`);
  console.log(`    Success rate   : ${(successContext.successRate * 100).toFixed(0)}%`);
  console.log(`    Avg reward     : ${successContext.averageReward.toFixed(3)}`);
  console.log(`    Key insights   : ${successContext.keyInsights.length}`);
  console.log(`    Recommendations: ${successContext.recommendations.length}`);

  console.log('\n  Failures only:');
  console.log(`    Count          : ${failedContext.totalMemories}`);
  console.log(`    Success rate   : ${(failedContext.successRate * 100).toFixed(0)}%`);
  console.log(`    Avg reward     : ${failedContext.averageReward.toFixed(3)}`);
  console.log(`    Key insights   : ${failedContext.keyInsights.length}`);
  console.log(`    Recommendations: ${failedContext.recommendations.length}`);

  // -----------------------------------------------------------------------
  // Part 4: MMR Diversity Ranker
  // -----------------------------------------------------------------------
  console.log('\n--- Part 4: MMR Diversity Ranking ---\n');

  const embedder = new MockEmbedder(64);  // smaller dimension for readability

  // Create 10 candidate results with mock embeddings
  const candidateTexts = [
    'JWT authentication with refresh tokens',
    'OAuth2 PKCE authentication flow',
    'Session-based authentication cookies',
    'API key authentication middleware',
    'Redis caching for session storage',
    'Database connection pooling optimization',
    'SQL query performance tuning',
    'GraphQL schema design best practices',
    'REST API endpoint versioning',
    'WebSocket real-time communication',
  ];

  const queryText = 'authentication and security';
  const queryEmbedding = Array.from(await embedder.embed(queryText));

  const candidates = [];
  for (let i = 0; i < candidateTexts.length; i++) {
    const emb = await embedder.embed(candidateTexts[i]);
    const embArray = Array.from(emb);

    // Calculate similarity to query
    let dot = 0, m1 = 0, m2 = 0;
    for (let j = 0; j < queryEmbedding.length; j++) {
      dot += queryEmbedding[j] * embArray[j];
      m1  += queryEmbedding[j] * queryEmbedding[j];
      m2  += embArray[j] * embArray[j];
    }
    const similarity = dot / (Math.sqrt(m1) * Math.sqrt(m2));

    candidates.push({
      id: i,
      embedding: embArray,
      similarity,
      text: candidateTexts[i],
    });
  }

  console.log('  Candidates (sorted by raw similarity to query):');
  const sortedCandidates = [...candidates].sort((a, b) => b.similarity - a.similarity);
  for (const c of sortedCandidates) {
    console.log(`    #${String(c.id).padStart(2)}  sim=${c.similarity.toFixed(4)}  "${c.text}"`);
  }

  // -----------------------------------------------------------------------
  // Part 5: Rerank with different lambda values
  // -----------------------------------------------------------------------
  console.log('\n--- Part 5: Lambda Comparison (Relevance vs Diversity) ---\n');

  const lambdaValues = [0.3, 0.5, 0.7, 0.9];

  for (const lambda of lambdaValues) {
    const selected = MMRDiversityRanker.selectDiverse(
      candidates,
      queryEmbedding,
      { lambda, k: 5, metric: 'cosine' },
    );

    const diversityScore = MMRDiversityRanker.calculateDiversityScore(selected, 'cosine');

    console.log(`  Lambda = ${lambda} (${lambda <= 0.3 ? 'max diversity' : lambda >= 0.9 ? 'max relevance' : 'balanced'})`);
    console.log(`    Diversity score: ${diversityScore.toFixed(4)}`);
    console.log('    Selected:');
    for (const s of selected) {
      console.log(`      #${String(s.id).padStart(2)}  sim=${s.similarity.toFixed(4)}  "${s.text}"`);
    }
    console.log();
  }

  // -----------------------------------------------------------------------
  // Part 6: Diversity score analysis
  // -----------------------------------------------------------------------
  console.log('--- Part 6: Diversity Score Analysis ---\n');

  // Compare diversity of top-5 by pure relevance vs MMR-selected
  const topByRelevance = sortedCandidates.slice(0, 5);
  const mmrSelected    = MMRDiversityRanker.selectDiverse(
    candidates, queryEmbedding, { lambda: 0.5, k: 5 },
  );

  const relevanceDiversity = MMRDiversityRanker.calculateDiversityScore(topByRelevance, 'cosine');
  const mmrDiversity       = MMRDiversityRanker.calculateDiversityScore(mmrSelected, 'cosine');

  console.log('  Top-5 by raw relevance:');
  for (const c of topByRelevance) {
    console.log(`    #${String(c.id).padStart(2)}  sim=${c.similarity.toFixed(4)}  "${c.text}"`);
  }
  console.log(`    Diversity score: ${relevanceDiversity.toFixed(4)}`);

  console.log('\n  Top-5 by MMR (lambda=0.5):');
  for (const c of mmrSelected) {
    console.log(`    #${String(c.id).padStart(2)}  sim=${c.similarity.toFixed(4)}  "${c.text}"`);
  }
  console.log(`    Diversity score: ${mmrDiversity.toFixed(4)}`);

  const improvement = ((mmrDiversity - relevanceDiversity) / Math.max(relevanceDiversity, 0.0001)) * 100;
  console.log(`\n  Diversity improvement with MMR: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);

  // Average similarity comparison
  const avgSimRelevance = topByRelevance.reduce((s, c) => s + c.similarity, 0) / topByRelevance.length;
  const avgSimMMR       = mmrSelected.reduce((s, c) => s + c.similarity, 0) / mmrSelected.length;
  console.log(`  Avg relevance (top-5)   : ${avgSimRelevance.toFixed(4)}`);
  console.log(`  Avg relevance (MMR)     : ${avgSimMMR.toFixed(4)}`);
  console.log(`  Relevance trade-off     : ${((1 - avgSimMMR / avgSimRelevance) * 100).toFixed(1)}% reduction`);

  // -----------------------------------------------------------------------
  // Part 7: Different similarity metrics
  // -----------------------------------------------------------------------
  console.log('\n--- Part 7: Similarity Metrics Comparison ---\n');

  const metrics = ['cosine', 'euclidean', 'dot'];
  for (const metric of metrics) {
    const selected = MMRDiversityRanker.selectDiverse(
      candidates, queryEmbedding, { lambda: 0.5, k: 5, metric },
    );
    const diversity = MMRDiversityRanker.calculateDiversityScore(selected, metric);
    const ids = selected.map(s => `#${s.id}`).join(', ');
    console.log(`  Metric: ${metric.padEnd(10)} -> diversity=${diversity.toFixed(4)}  selected=[${ids}]`);
  }

  // -----------------------------------------------------------------------
  // Part 8: Edge cases
  // -----------------------------------------------------------------------
  console.log('\n--- Part 8: Edge Cases ---\n');

  // Empty memories
  const emptyCtx = ContextSynthesizer.synthesize([]);
  console.log(`  Empty memories  : summary="${emptyCtx.summary}", total=${emptyCtx.totalMemories}`);

  // Single candidate for MMR
  const singleResult = MMRDiversityRanker.selectDiverse(
    [candidates[0]], queryEmbedding, { k: 5 },
  );
  console.log(`  Single candidate: selected ${singleResult.length} item(s)`);
  const singleDiv = MMRDiversityRanker.calculateDiversityScore(singleResult);
  console.log(`  Single diversity: ${singleDiv.toFixed(4)}`);

  // All candidates when k > length
  const allSelected = MMRDiversityRanker.selectDiverse(
    candidates.slice(0, 3), queryEmbedding, { k: 10 },
  );
  console.log(`  k > candidates  : requested 10, got ${allSelected.length}`);

  console.log('\n' + '='.repeat(72));
  console.log('  Example 08 complete.');
  console.log('='.repeat(72) + '\n');
}

main().then(() => { process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
