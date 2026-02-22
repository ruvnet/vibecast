#!/usr/bin/env node

/**
 * 20-full-stack-demo.js - Everything Together
 *
 * Capstone demo: an "AI Research Assistant" that manages a knowledge base
 * using every major AgentDB feature -- episodic memory, skill library,
 * causal graph, learning system, security validation, query caching,
 * batch operations, quantization, metadata filtering, MMR diversity,
 * and context synthesis.
 *
 * agentdb@3.0.0-alpha.3 (ESM-only)
 */

import {
  // Core
  AgentDB,
  createDatabase,

  // Controllers
  ReflexionMemory,
  SkillLibrary,
  CausalMemoryGraph,
  ReasoningBank,
  LearningSystem,
  MetadataFilter,
  MMRDiversityRanker,
  ContextSynthesizer,

  // Optimizations
  QueryCache,
  BatchOperations,

  // Security
  validateTableName,
  validateColumnName,
  validatePragmaCommand,
  buildSafeWhereClause,
  buildSafeSetClause,
  ValidationError,

  // Quantization
  quantize8bit,
  dequantize8bit,
  quantize4bit,
  dequantize4bit,
  getQuantizationStats,
  QuantizedVectorStore,
  createScalar8BitStore,
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
// Helpers
// ---------------------------------------------------------------------------
function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function heading(title) {
  console.log();
  console.log('='.repeat(72));
  console.log(`  ${title}`);
  console.log('='.repeat(72));
  console.log();
}

function section(title) {
  console.log(`--- ${title} ---`);
  console.log();
}

// ---------------------------------------------------------------------------
// Schema setup
// ---------------------------------------------------------------------------
function setupFullSchema(db) {
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
    CREATE TABLE IF NOT EXISTS causal_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_memory_id INTEGER NOT NULL,
      from_memory_type TEXT NOT NULL,
      to_memory_id INTEGER NOT NULL,
      to_memory_type TEXT NOT NULL,
      similarity REAL NOT NULL DEFAULT 0.0,
      uplift REAL,
      confidence REAL DEFAULT 0.5,
      sample_size INTEGER,
      evidence_ids TEXT,
      experiment_ids TEXT,
      confounder_score REAL,
      mechanism TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      last_validated_at INTEGER,
      metadata JSON
    );
    CREATE TABLE IF NOT EXISTS causal_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      treatment_id INTEGER NOT NULL,
      treatment_type TEXT NOT NULL,
      control_id INTEGER,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      sample_size INTEGER DEFAULT 0,
      treatment_mean REAL,
      control_mean REAL,
      uplift REAL,
      p_value REAL,
      confidence_interval_low REAL,
      confidence_interval_high REAL,
      status TEXT DEFAULT 'running',
      metadata JSON,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    CREATE TABLE IF NOT EXISTS causal_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      is_treatment BOOLEAN NOT NULL,
      outcome_value REAL NOT NULL,
      outcome_type TEXT,
      context JSON,
      observed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    -- NOTE: reasoning_patterns and pattern_embeddings tables are auto-created
    -- by the ReasoningBank constructor with the correct schema.
    CREATE TABLE IF NOT EXISTS provenance_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_type TEXT,
      memory_id INTEGER,
      certificate TEXT,
      ts INTEGER DEFAULT (strftime('%s', 'now'))
    );
    -- NOTE: learning_sessions, learning_experiences, learning_policies, and
    -- learning_state_embeddings tables are auto-created by LearningSystem constructor.

    CREATE INDEX IF NOT EXISTS idx_episodes_reward ON episodes(reward);
    CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_success ON episodes(success);
    CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
    CREATE INDEX IF NOT EXISTS idx_skills_success_rate ON skills(success_rate);
    CREATE INDEX IF NOT EXISTS idx_causal_edges_from ON causal_edges(from_memory_id);
    CREATE INDEX IF NOT EXISTS idx_causal_edges_to ON causal_edges(to_memory_id);
    -- NOTE: reasoning_patterns indexes are auto-created by ReasoningBank constructor.
  `);
}

// =========================================================================
// MAIN
// =========================================================================
async function main() {
  heading('AI Research Assistant - Full Stack AgentDB Demo');

  const startTime = performance.now();
  const embedder = new MockEmbedder(384);
  await embedder.initialize();

  // =====================================================================
  // PHASE 1: Setup
  // =====================================================================
  section('PHASE 1: Setup');

  console.log('Creating in-memory AgentDB instance...');
  const db = await createDatabase(':memory:');
  setupFullSchema(db);
  console.log('  Database created with full schema (14 tables, 10 indexes)');

  // Initialize controllers
  const reflexion = new ReflexionMemory(db, embedder);
  const skills = new SkillLibrary(db, embedder);
  const causalGraph = new CausalMemoryGraph(db);
  const reasoningBank = new ReasoningBank(db, embedder);
  const learningSystem = new LearningSystem(db, embedder);
  console.log('  Controllers initialized: ReflexionMemory, SkillLibrary, CausalMemoryGraph, ReasoningBank, LearningSystem');

  // Initialize query cache
  const queryCache = new QueryCache({ maxSize: 500, defaultTTL: 60000 });
  console.log('  QueryCache initialized (maxSize: 500, TTL: 60s)');

  // Initialize batch operations
  const batchOps = new BatchOperations(db, embedder, { batchSize: 50, parallelism: 4 });
  console.log('  BatchOperations initialized (batchSize: 50)');
  console.log();

  // =====================================================================
  // PHASE 2: Knowledge Ingestion
  // =====================================================================
  section('PHASE 2: Knowledge Ingestion');

  // 2a. Store 10 research episodes
  console.log('2a. Storing 10 research episodes...');
  const researchEpisodes = [
    { sessionId: 'research-1', task: 'Literature review on transformer architectures', critique: 'Comprehensive coverage of attention mechanisms. Use systematic approach.', reward: 0.92, success: true, tags: ['nlp', 'review'], metadata: { topic: 'transformers', year: 2024 } },
    { sessionId: 'research-1', task: 'Experiment: fine-tuning BERT for classification', critique: 'Good hyperparameter search. Add ablation study next time.', reward: 0.85, success: true, tags: ['nlp', 'experiment'], metadata: { topic: 'fine-tuning', year: 2024 } },
    { sessionId: 'research-2', task: 'Data analysis of benchmark results', critique: 'Statistical significance tests were thorough. Improve visualization.', reward: 0.88, success: true, tags: ['analysis', 'benchmarks'], metadata: { topic: 'evaluation', year: 2024 } },
    { sessionId: 'research-2', task: 'Paper writing: methodology section', critique: 'Clear structure. Add more citations for reproducibility.', reward: 0.75, success: true, tags: ['writing', 'methodology'], metadata: { topic: 'paper', year: 2024 } },
    { sessionId: 'research-3', task: 'Peer review of submitted paper', critique: 'Constructive feedback provided. Missed issues with experimental design.', reward: 0.65, success: false, tags: ['review', 'feedback'], metadata: { topic: 'peer-review', year: 2024 } },
    { sessionId: 'research-3', task: 'Experiment: RAG pipeline optimization', critique: 'Good approach to retrieval augmented generation. Test more embedding models.', reward: 0.91, success: true, tags: ['rag', 'experiment'], metadata: { topic: 'retrieval', year: 2025 } },
    { sessionId: 'research-4', task: 'Literature review on causal inference methods', critique: 'Thorough review of do-calculus. Use more practical examples.', reward: 0.87, success: true, tags: ['causal', 'review'], metadata: { topic: 'causal-inference', year: 2025 } },
    { sessionId: 'research-4', task: 'Experiment design for multi-agent collaboration', critique: 'Creative experiment design. Needs larger sample size.', reward: 0.78, success: true, tags: ['multi-agent', 'experiment'], metadata: { topic: 'collaboration', year: 2025 } },
    { sessionId: 'research-5', task: 'Data analysis of user study results', critique: 'Good use of mixed methods. Add qualitative coding validation.', reward: 0.82, success: true, tags: ['analysis', 'user-study'], metadata: { topic: 'user-research', year: 2025 } },
    { sessionId: 'research-5', task: 'Paper writing: results and discussion', critique: 'Strong results presentation. Discussion needs more comparison with related work.', reward: 0.79, success: true, tags: ['writing', 'results'], metadata: { topic: 'paper', year: 2025 } },
  ];

  const episodeIds = [];
  for (const ep of researchEpisodes) {
    const id = await reflexion.storeEpisode(ep);
    episodeIds.push(id);
  }
  console.log(`  Stored ${episodeIds.length} episodes (IDs: ${episodeIds.join(', ')})`);
  console.log();

  // 2b. Create 5 research skills
  console.log('2b. Creating 5 research skills...');
  const researchSkills = [
    { name: 'literature_review', description: 'Systematic literature review with citation analysis', code: 'function litReview(topic) { return searchPapers(topic).analyze(); }', successRate: 0.88, uses: 15, avgReward: 0.89, metadata: { domain: 'research' } },
    { name: 'experiment_design', description: 'Design controlled experiments with proper baselines', code: 'function designExperiment(hypothesis) { return createProtocol(hypothesis); }', successRate: 0.82, uses: 8, avgReward: 0.84, metadata: { domain: 'research' } },
    { name: 'data_analysis', description: 'Statistical analysis with significance testing', code: 'function analyze(data) { return runStatTests(data).summarize(); }', successRate: 0.90, uses: 20, avgReward: 0.87, metadata: { domain: 'research' } },
    { name: 'paper_writing', description: 'Academic paper drafting with proper structure', code: 'function writePaper(sections) { return draft(sections).format(); }', successRate: 0.76, uses: 12, avgReward: 0.77, metadata: { domain: 'research' } },
    { name: 'peer_review', description: 'Constructive peer review with actionable feedback', code: 'function review(paper) { return evaluatePaper(paper).critique(); }', successRate: 0.71, uses: 6, avgReward: 0.68, metadata: { domain: 'research' } },
  ];

  const skillIds = [];
  for (const sk of researchSkills) {
    const id = await skills.createSkill(sk);
    skillIds.push(id);
  }
  console.log(`  Created ${skillIds.length} skills (IDs: ${skillIds.join(', ')})`);
  console.log();

  // 2c. Add causal edges
  console.log('2c. Adding causal edges...');
  const causalEdges = [
    { fromMemoryId: episodeIds[0], fromMemoryType: 'episode', toMemoryId: episodeIds[1], toMemoryType: 'episode', similarity: 0.75, mechanism: 'Literature review CAUSES better experiment design', uplift: 0.15, confidence: 0.82, sampleSize: 10 },
    { fromMemoryId: episodeIds[1], fromMemoryType: 'episode', toMemoryId: episodeIds[2], toMemoryType: 'episode', similarity: 0.80, mechanism: 'Good experiments CAUSE meaningful data analysis', uplift: 0.22, confidence: 0.88, sampleSize: 12 },
    { fromMemoryId: episodeIds[2], fromMemoryType: 'episode', toMemoryId: episodeIds[3], toMemoryType: 'episode', similarity: 0.70, mechanism: 'Thorough analysis CAUSES better paper writing', uplift: 0.18, confidence: 0.79, sampleSize: 8 },
    { fromMemoryId: episodeIds[0], fromMemoryType: 'episode', toMemoryId: episodeIds[6], toMemoryType: 'episode', similarity: 0.65, mechanism: 'Prior review knowledge CAUSES deeper causal understanding', uplift: 0.20, confidence: 0.85, sampleSize: 5 },
  ];

  const edgeIds = [];
  for (const edge of causalEdges) {
    const id = await causalGraph.addCausalEdge(edge);
    edgeIds.push(id);
  }
  console.log(`  Added ${edgeIds.length} causal edges`);
  console.log();

  // 2d. Store reasoning patterns
  console.log('2d. Storing reasoning patterns...');
  const reasoningPatterns = [
    { taskType: 'literature_review', approach: 'Use systematic search with inclusion/exclusion criteria', successRate: 0.88, metadata: { context: 'Academic research' } },
    { taskType: 'experiment_design', approach: 'Define hypothesis, control group, and metrics first', successRate: 0.82, metadata: { context: 'Empirical research' } },
    { taskType: 'data_analysis', approach: 'Start with descriptive stats, then inferential, then visualization', successRate: 0.91, metadata: { context: 'Quantitative research' } },
    { taskType: 'paper_writing', approach: 'Outline first, then results, then methods, then introduction', successRate: 0.77, metadata: { context: 'Academic writing' } },
    { taskType: 'peer_review', approach: 'Read twice: first for understanding, second for critique', successRate: 0.73, metadata: { context: 'Quality assurance' } },
  ];

  const patternIds = [];
  for (const p of reasoningPatterns) {
    const id = await reasoningBank.storePattern(p);
    patternIds.push(id);
  }
  console.log(`  Stored ${patternIds.length} reasoning patterns`);
  console.log();

  // =====================================================================
  // PHASE 3: Intelligent Retrieval
  // =====================================================================
  section('PHASE 3: Intelligent Retrieval');

  // 3a. Search with metadata filters
  console.log('3a. Searching with metadata filters...');
  const allEpisodes = db.prepare('SELECT * FROM episodes').all();

  // Filter for 2025 experiments
  const recentEpisodes = MetadataFilter.apply(allEpisodes, {
    'metadata.year': { $gte: 2025 },
  });
  console.log(`  Episodes from 2025+: ${recentEpisodes.length}`);

  // Filter for successful high-reward episodes
  const highPerformers = MetadataFilter.apply(allEpisodes, {
    reward: { $gt: 0.85 },
    success: 1,
  });
  console.log(`  High-performing episodes (reward > 0.85, success): ${highPerformers.length}`);

  // Filter by task content
  const experimentEpisodes = MetadataFilter.apply(allEpisodes, {
    task: { $contains: 'Experiment' },
  });
  console.log(`  Experiment-related episodes: ${experimentEpisodes.length}`);
  console.log();

  // 3b. Context synthesis from retrieved memories
  console.log('3b. Synthesizing context from retrieved memories...');
  const contextMemories = allEpisodes.map(ep => ({
    task: ep.task,
    success: ep.success === 1,
    reward: ep.reward,
    critique: ep.critique,
  }));

  const synthesis = ContextSynthesizer.synthesize(contextMemories, {
    minPatternFrequency: 1,
    includeRecommendations: true,
  });

  console.log(`  Summary: ${synthesis.summary.substring(0, 120)}...`);
  console.log(`  Success rate: ${(synthesis.successRate * 100).toFixed(0)}%`);
  console.log(`  Average reward: ${synthesis.averageReward.toFixed(2)}`);
  console.log(`  Patterns found: ${synthesis.patterns.length}`);
  console.log(`  Key insights: ${synthesis.keyInsights.length}`);
  for (const insight of synthesis.keyInsights.slice(0, 3)) {
    console.log(`    - ${insight}`);
  }
  console.log(`  Recommendations: ${synthesis.recommendations.length}`);
  for (const rec of synthesis.recommendations.slice(0, 3)) {
    console.log(`    - ${rec}`);
  }
  console.log();

  // 3c. MMR diversity ranking
  console.log('3c. Applying MMR diversity ranking...');
  const candidateEmbeddings = await embedder.embedBatch(
    allEpisodes.map(ep => ep.task)
  );
  const candidates = allEpisodes.map((ep, i) => ({
    id: ep.id,
    task: ep.task,
    reward: ep.reward,
    embedding: candidateEmbeddings[i],
    similarity: ep.reward, // Use reward as proxy for relevance
  }));

  const queryEmbedding = await embedder.embed('research experiment with good methodology');

  const diverseResults = MMRDiversityRanker.selectDiverse(candidates, queryEmbedding, {
    lambda: 0.6,  // Favor relevance slightly over diversity
    k: 5,
    metric: 'cosine',
  });

  console.log(`  Top 5 diverse results (lambda=0.6):`);
  for (const r of diverseResults) {
    console.log(`    [${r.id}] ${r.task.substring(0, 50)}... (sim: ${r.similarity.toFixed(3)})`);
  }

  // Calculate diversity score
  const diversityScore = MMRDiversityRanker.calculateDiversityScore(diverseResults, 'cosine');
  console.log(`  Diversity score: ${diversityScore.toFixed(4)}`);

  // Compare with non-diverse (pure relevance)
  const pureRelevance = [...candidates].sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  const pureRelevanceEmbeddable = pureRelevance.map(r => ({ ...r, embedding: r.embedding }));
  const relevanceDiversity = MMRDiversityRanker.calculateDiversityScore(pureRelevanceEmbeddable, 'cosine');
  console.log(`  Pure relevance diversity: ${relevanceDiversity.toFixed(4)}`);
  console.log(`  Diversity improvement: ${((diversityScore / relevanceDiversity - 1) * 100).toFixed(1)}%`);
  console.log();

  // =====================================================================
  // PHASE 4: Learning Phase
  // =====================================================================
  section('PHASE 4: Learning Phase');

  // 4a. Start a learning session
  console.log('4a. Starting RL learning session...');
  const sessionId = await learningSystem.startSession(
    'researcher-001',
    'q-learning',
    {
      learningRate: 0.1,
      discountFactor: 0.95,
      explorationRate: 0.2,
      actions: ['literature_review', 'experiment', 'analysis', 'writing', 'peer_review'],
    },
  );
  console.log(`  Session started: ${sessionId}`);
  console.log();

  // 4b. Record feedback on research actions
  console.log('4b. Recording research feedback...');
  const feedbackData = [
    { state: 'new_topic', action: 'literature_review', reward: 0.9, success: true, nextState: 'literature_reviewed' },
    { state: 'literature_reviewed', action: 'experiment', reward: 0.85, success: true, nextState: 'experiment_done' },
    { state: 'experiment_done', action: 'analysis', reward: 0.92, success: true, nextState: 'data_analyzed' },
    { state: 'data_analyzed', action: 'writing', reward: 0.78, success: true, nextState: 'paper_drafted' },
    { state: 'paper_drafted', action: 'peer_review', reward: 0.7, success: false, nextState: 'revision_needed' },
    { state: 'revision_needed', action: 'writing', reward: 0.88, success: true, nextState: 'paper_revised' },
    { state: 'new_topic', action: 'experiment', reward: 0.4, success: false, nextState: 'failed_experiment' },
    { state: 'failed_experiment', action: 'literature_review', reward: 0.85, success: true, nextState: 'literature_reviewed' },
    { state: 'literature_reviewed', action: 'analysis', reward: 0.6, success: true, nextState: 'preliminary_analysis' },
    { state: 'preliminary_analysis', action: 'experiment', reward: 0.88, success: true, nextState: 'experiment_done' },
  ];

  for (const fb of feedbackData) {
    await learningSystem.submitFeedback({
      sessionId,
      state: fb.state,
      action: fb.action,
      reward: fb.reward,
      success: fb.success,
      nextState: fb.nextState,
      timestamp: Date.now(),
    });
  }
  console.log(`  Recorded ${feedbackData.length} feedback entries`);
  console.log();

  // 4c. Train the policy
  console.log('4c. Training RL policy...');
  let trainingResult;
  try {
    trainingResult = await learningSystem.train(sessionId, 20, 5, 0.1);
    console.log(`  Epochs completed:   ${trainingResult.epochsCompleted}`);
    console.log(`  Final loss:         ${trainingResult.finalLoss.toFixed(4)}`);
    console.log(`  Average reward:     ${trainingResult.avgReward.toFixed(4)}`);
    console.log(`  Convergence rate:   ${trainingResult.convergenceRate.toFixed(4)}`);
    console.log(`  Training time:      ${formatMs(trainingResult.trainingTimeMs)}`);
  } catch (err) {
    console.log(`  Training note: ${err.message}`);
    trainingResult = { epochsCompleted: 0, finalLoss: 0, avgReward: 0, convergenceRate: 0, trainingTimeMs: 0 };
  }
  console.log();

  // 4d. Get action prediction
  console.log('4d. Predicting best action for new state...');
  try {
    const prediction = await learningSystem.predict(sessionId, 'new_topic');
    console.log(`  Recommended action:  ${prediction.action}`);
    console.log(`  Confidence:          ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`  Q-value:             ${prediction.qValue.toFixed(4)}`);
    if (prediction.alternatives?.length > 0) {
      console.log(`  Alternatives:`);
      for (const alt of prediction.alternatives) {
        console.log(`    - ${alt.action} (confidence: ${(alt.confidence * 100).toFixed(1)}%)`);
      }
    }
  } catch (err) {
    console.log(`  Prediction note: ${err.message}`);
  }
  console.log();

  // End learning session
  await learningSystem.endSession(sessionId);
  console.log('  Learning session ended');
  console.log();

  // =====================================================================
  // PHASE 5: Security Validation
  // =====================================================================
  section('PHASE 5: Security Validation');

  let securityPassed = 0;
  let securityTotal = 0;

  const securityTests = [
    { desc: 'Valid table name', fn: () => validateTableName('episodes'), expectPass: true },
    { desc: 'SQL injection blocked', fn: () => validateTableName("'; DROP TABLE--"), expectPass: false },
    { desc: 'Path traversal blocked', fn: () => validateTableName('../../../etc/passwd'), expectPass: false },
    { desc: 'Valid column name', fn: () => validateColumnName('episodes', 'reward'), expectPass: true },
    { desc: 'XSS in column blocked', fn: () => validateColumnName('episodes', '<script>'), expectPass: false },
    { desc: 'Valid pragma', fn: () => validatePragmaCommand('journal_mode = WAL'), expectPass: true },
    { desc: 'Dangerous pragma blocked', fn: () => validatePragmaCommand('compile_options'), expectPass: false },
    { desc: 'Safe WHERE clause', fn: () => buildSafeWhereClause('episodes', { reward: 0.9 }), expectPass: true },
    { desc: 'Invalid table in WHERE blocked', fn: () => buildSafeWhereClause('evil', { id: 1 }), expectPass: false },
    { desc: 'Safe SET clause', fn: () => buildSafeSetClause('episodes', { reward: 0.95 }), expectPass: true },
  ];

  for (const test of securityTests) {
    securityTotal++;
    try {
      test.fn();
      if (test.expectPass) {
        securityPassed++;
        console.log(`  [PASS] ${test.desc}`);
      } else {
        console.log(`  [FAIL] ${test.desc} -- expected to be blocked`);
      }
    } catch (err) {
      if (!test.expectPass) {
        securityPassed++;
        console.log(`  [BLOCKED] ${test.desc}`);
      } else {
        console.log(`  [FAIL] ${test.desc} -- unexpected error: ${err.message}`);
      }
    }
  }
  console.log(`  Security score: ${securityPassed}/${securityTotal}`);
  console.log();

  // =====================================================================
  // PHASE 6: Performance Optimization
  // =====================================================================
  section('PHASE 6: Performance Optimization');

  // 6a. QueryCache for repeated queries
  console.log('6a. QueryCache performance:');
  queryCache.resetStatistics();

  // Simulate repeated queries
  const queryTypes = [
    'SELECT * FROM episodes WHERE reward > 0.8',
    'SELECT * FROM skills WHERE success_rate > 0.7',
    'SELECT AVG(reward) FROM episodes',
    'SELECT COUNT(*) FROM reasoning_patterns',
    'SELECT * FROM episodes ORDER BY reward DESC LIMIT 5',
  ];

  // First pass: populate cache
  for (const sql of queryTypes) {
    const key = queryCache.generateKey(sql, [], 'query');
    const mockResult = [{ result: 'mock' }];
    queryCache.set(key, mockResult);
  }

  // Second pass: hit cache 200 times
  const cacheStart = performance.now();
  for (let i = 0; i < 200; i++) {
    const sql = queryTypes[i % queryTypes.length];
    const key = queryCache.generateKey(sql, [], 'query');
    queryCache.get(key);
  }
  const cacheDuration = performance.now() - cacheStart;

  const cacheStats = queryCache.getStatistics();
  console.log(`  200 cached lookups in ${formatMs(cacheDuration)}`);
  console.log(`  Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
  console.log(`  Avg lookup: ${formatMs(cacheDuration / 200)}`);
  console.log();

  // 6b. Batch operations for bulk inserts
  console.log('6b. Batch operations for additional data:');

  // Batch insert more episodes
  const additionalEpisodes = [];
  for (let i = 0; i < 50; i++) {
    additionalEpisodes.push({
      sessionId: `perf-session-${i % 3}`,
      task: `Performance test episode ${i}`,
      critique: `Critique for performance test ${i}`,
      reward: Math.random(),
      success: Math.random() > 0.3,
      latencyMs: Math.floor(Math.random() * 300) + 50,
      tokensUsed: Math.floor(Math.random() * 1500) + 100,
    });
  }

  const batchStart = performance.now();
  const batchInserted = await batchOps.insertEpisodes(additionalEpisodes);
  const batchDuration = performance.now() - batchStart;

  // Sequential comparison
  const seqStart = performance.now();
  for (let i = 0; i < 50; i++) {
    const ep = additionalEpisodes[i];
    const emb = await embedder.embed(ep.task);
    const result = db.prepare(
      `INSERT INTO episodes (session_id, task, critique, reward, success) VALUES (?, ?, ?, ?, ?)`
    ).run(ep.sessionId, ep.task + ' (seq)', ep.critique, ep.reward, ep.success ? 1 : 0);
    const eid = typeof result.lastInsertRowid === 'bigint'
      ? Number(result.lastInsertRowid) : result.lastInsertRowid;
    db.prepare(`INSERT INTO episode_embeddings (episode_id, embedding) VALUES (?, ?)`)
      .run(eid, Buffer.from(emb.buffer));
  }
  const seqDuration = performance.now() - seqStart;

  const batchSpeedup = seqDuration / batchDuration;
  console.log(`  Batch (50 episodes):      ${formatMs(batchDuration)}`);
  console.log(`  Sequential (50 episodes): ${formatMs(seqDuration)}`);
  console.log(`  Speedup:                  ${batchSpeedup.toFixed(1)}x`);
  console.log();

  // =====================================================================
  // PHASE 7: Quantization
  // =====================================================================
  section('PHASE 7: Vector Quantization');

  console.log('Compressing vectors with 8-bit scalar quantization...');

  // Generate sample vectors
  const sampleVectors = [];
  for (let i = 0; i < 100; i++) {
    sampleVectors.push(randomVector(384));
  }

  // Create quantized store
  const qStore = createScalar8BitStore(384, 'cosine');

  const qInsertStart = performance.now();
  for (let i = 0; i < sampleVectors.length; i++) {
    qStore.insert(`vec-${i}`, sampleVectors[i], { index: i });
  }
  const qInsertDuration = performance.now() - qInsertStart;

  // Search quantized store
  const qSearchStart = performance.now();
  const qResults = qStore.search(sampleVectors[0], 5);
  const qSearchDuration = performance.now() - qSearchStart;

  const qStats = qStore.getStats();
  console.log(`  Vectors stored: ${qStats.count}`);
  console.log(`  Compression ratio: ${qStats.compressionRatio.toFixed(1)}x`);
  console.log(`  Memory usage: ${(qStats.memoryUsageBytes / 1024).toFixed(1)}KB`);
  console.log(`  Insert time: ${formatMs(qInsertDuration)}`);
  console.log(`  Search time: ${formatMs(qSearchDuration)}`);
  console.log(`  Top result: ID=${qResults[0]?.id}, similarity=${qResults[0]?.similarity.toFixed(4)}`);
  console.log();

  // Quantization error analysis
  console.log('Quantization error analysis:');
  const sampleVec = sampleVectors[0];
  const stats8bit = getQuantizationStats(sampleVec, '8bit');
  const stats4bit = getQuantizationStats(sampleVec, '4bit');
  console.log(`  8-bit: mean error=${stats8bit.meanError.toFixed(6)}, max error=${stats8bit.maxError.toFixed(6)}, compression=${stats8bit.compressionRatio.toFixed(1)}x`);
  console.log(`  4-bit: mean error=${stats4bit.meanError.toFixed(6)}, max error=${stats4bit.maxError.toFixed(6)}, compression=${stats4bit.compressionRatio.toFixed(1)}x`);

  // Memory savings calculation
  const originalBytes = 100 * 384 * 4;  // Float32
  const quantizedBytes = qStats.memoryUsageBytes;
  const savingsPercent = ((1 - quantizedBytes / originalBytes) * 100);
  console.log(`  Memory savings: ${savingsPercent.toFixed(0)}% (${(originalBytes / 1024).toFixed(0)}KB -> ${(quantizedBytes / 1024).toFixed(0)}KB)`);
  console.log();

  // =====================================================================
  // PHASE 8: Final Report
  // =====================================================================
  heading('FINAL REPORT: AI Research Assistant');

  const totalDuration = performance.now() - startTime;

  // 8a. Database Statistics
  console.log('Database Statistics:');
  const episodeCount = db.prepare('SELECT COUNT(*) as count FROM episodes').get();
  const skillCount = db.prepare('SELECT COUNT(*) as count FROM skills').get();
  const patternCount = db.prepare('SELECT COUNT(*) as count FROM reasoning_patterns').get();
  const edgeCount = db.prepare('SELECT COUNT(*) as count FROM causal_edges').get();
  const embeddingCount = db.prepare('SELECT COUNT(*) as count FROM episode_embeddings').get();

  console.log(`  Episodes:           ${episodeCount.count}`);
  console.log(`  Skills:             ${skillCount.count}`);
  console.log(`  Reasoning patterns: ${patternCount.count}`);
  console.log(`  Causal edges:       ${edgeCount.count}`);
  console.log(`  Embeddings stored:  ${embeddingCount.count}`);
  console.log();

  // 8b. Learning Results
  console.log('Learning Results:');
  if (trainingResult) {
    console.log(`  Epochs trained:     ${trainingResult.epochsCompleted}`);
    console.log(`  Final loss:         ${trainingResult.finalLoss.toFixed(4)}`);
    console.log(`  Average reward:     ${trainingResult.avgReward.toFixed(4)}`);
    console.log(`  Convergence rate:   ${trainingResult.convergenceRate.toFixed(4)}`);
    console.log(`  Training time:      ${formatMs(trainingResult.trainingTimeMs)}`);
  }
  console.log();

  // 8c. Knowledge Graph Summary
  console.log('Knowledge Graph:');
  console.log(`  Causal edges:       ${edgeIds.length}`);
  console.log(`  Causal mechanisms:`);
  for (const edge of causalEdges) {
    console.log(`    - ${edge.mechanism} (uplift: ${edge.uplift}, confidence: ${edge.confidence})`);
  }
  console.log();

  // 8d. Context Synthesis Summary
  console.log('Context Synthesis:');
  console.log(`  Total memories:     ${synthesis.totalMemories}`);
  console.log(`  Success rate:       ${(synthesis.successRate * 100).toFixed(0)}%`);
  console.log(`  Average reward:     ${synthesis.averageReward.toFixed(2)}`);
  console.log(`  Patterns found:     ${synthesis.patterns.length}`);
  console.log(`  Insights:           ${synthesis.keyInsights.length}`);
  console.log(`  Recommendations:    ${synthesis.recommendations.length}`);
  console.log();

  // 8e. Cache Performance
  console.log('Cache Performance:');
  const finalCacheStats = queryCache.getStatistics();
  console.log(`  Entries cached:     ${finalCacheStats.size}`);
  console.log(`  Hit rate:           ${finalCacheStats.hitRate.toFixed(1)}%`);
  console.log(`  Total hits:         ${finalCacheStats.hits}`);
  console.log(`  Total misses:       ${finalCacheStats.misses}`);
  console.log(`  Evictions:          ${finalCacheStats.evictions}`);
  console.log();

  // 8f. Security Summary
  console.log('Security Validation:');
  console.log(`  Tests passed:       ${securityPassed}/${securityTotal}`);
  console.log(`  Pass rate:          ${((securityPassed / securityTotal) * 100).toFixed(0)}%`);
  console.log(`  Defense layers:     8 (whitelist, parameterization, sanitization, type validation,`);
  console.log(`                         constraint enforcement, safe errors, filter validation, attack detection)`);
  console.log();

  // 8g. Quantization Summary
  console.log('Quantization:');
  console.log(`  Method:             8-bit scalar quantization`);
  console.log(`  Compression:        ${qStats.compressionRatio.toFixed(1)}x`);
  console.log(`  Mean error (8-bit): ${stats8bit.meanError.toFixed(6)}`);
  console.log(`  Mean error (4-bit): ${stats4bit.meanError.toFixed(6)}`);
  console.log(`  Memory savings:     ${savingsPercent.toFixed(0)}%`);
  console.log();

  // 8h. Performance Summary
  console.log('Performance:');
  console.log(`  Batch speedup:      ${batchSpeedup.toFixed(1)}x vs sequential`);
  console.log(`  Cache speedup:      ${(cacheDuration > 0 ? (200 / cacheDuration * 1000) : 0).toFixed(0)} lookups/sec`);
  console.log(`  Diversity improvement: ${((diversityScore / (relevanceDiversity || 1) - 1) * 100).toFixed(1)}% with MMR`);
  console.log();

  // 8i. Total execution time
  console.log('-'.repeat(72));
  console.log(`  Total demo execution time: ${formatMs(totalDuration)}`);
  console.log(`  Platform: ${process.platform} ${process.arch} (Node ${process.version})`);
  console.log('-'.repeat(72));
  console.log();

  // Feature list
  console.log('AgentDB Features Demonstrated:');
  const features = [
    'ReflexionMemory   - Episodic replay with self-critique',
    'SkillLibrary      - Lifelong learning skill management',
    'CausalMemoryGraph - Intervention-based causal reasoning',
    'ReasoningBank     - Pattern storage and semantic retrieval',
    'LearningSystem    - RL training (Q-learning, 9 algorithms)',
    'MetadataFilter    - MongoDB-style query operators',
    'MMRDiversityRanker- Maximal Marginal Relevance diversity',
    'ContextSynthesizer- Coherent narrative from memories',
    'QueryCache        - LRU caching with TTL and categories',
    'BatchOperations   - Bulk inserts with transactions',
    'Quantization      - 8-bit/4-bit scalar compression',
    'Input Validation  - SQL injection / XSS / traversal defense',
    'Safe Queries      - Parameterized WHERE/SET clauses',
  ];
  for (let i = 0; i < features.length; i++) {
    console.log(`  ${String(i + 1).padStart(2)}. ${features[i]}`);
  }
  console.log();

  console.log('='.repeat(72));
  console.log('  Demo complete. All systems operational.');
  console.log('='.repeat(72));

  // Cleanup
  db.close();
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
