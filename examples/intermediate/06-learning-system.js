/**
 * Example 06 - Reinforcement Learning System (9 Algorithms)
 *
 * Demonstrates agentdb's LearningSystem with all 9 RL algorithm types:
 *   q-learning, sarsa, dqn, policy-gradient, actor-critic, ppo,
 *   decision-transformer, mcts, model-based
 *
 * Each algorithm runs through a simulated predict -> feedback -> train loop.
 * After all sessions complete we compare metrics, demonstrate transfer
 * learning between sessions, and show explainAction output.
 *
 * @module examples/intermediate/06-learning-system
 */

import {
  LearningSystem,
  EmbeddingService,
  createDatabase,
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
// Simulated environment actions & states
// ---------------------------------------------------------------------------
const STATES  = ['idle', 'processing', 'waiting', 'error', 'completed'];
const ACTIONS = ['retry', 'skip', 'escalate', 'cache', 'parallelize'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Simple reward function for the simulated environment.
 * Returns a reward in [0, 1] and a boolean success flag.
 */
function simulateStep(state, action) {
  // Deterministic-ish reward mapping
  const goodPairs = {
    'error|retry': 0.9,
    'waiting|skip': 0.7,
    'processing|parallelize': 0.85,
    'idle|cache': 0.6,
    'completed|skip': 0.5,
  };
  const key = `${state}|${action}`;
  const baseReward = goodPairs[key] ?? 0.2 + Math.random() * 0.3;
  const noise = (Math.random() - 0.5) * 0.1;
  const reward = Math.max(0, Math.min(1, baseReward + noise));
  const success = reward >= 0.5;
  return { reward: parseFloat(reward.toFixed(4)), success };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(72));
  console.log('  Example 06 - Reinforcement Learning System (9 Algorithms)');
  console.log('='.repeat(72));

  // Create an in-memory database via agentdb's createDatabase
  const db = await createDatabase(':memory:');
  const embedder = new MockEmbedder(384);

  // We also need a causal_edges table because explainAction queries it
  db.exec(`
    CREATE TABLE IF NOT EXISTS causal_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_memory_id INTEGER,
      to_memory_id INTEGER,
      uplift REAL,
      edge_type TEXT
    );
  `);

  // LearningSystem expects an EmbeddingService-compatible object.
  // Our MockEmbedder matches the interface (embed / embedBatch).
  const learningSystem = new LearningSystem(db, embedder);

  // -----------------------------------------------------------------------
  // Part 1: Run all 9 algorithms through predict -> feedback -> train cycles
  // -----------------------------------------------------------------------
  console.log('\n--- Part 1: Training All 9 Algorithms ---\n');

  const algorithms = [
    'q-learning', 'sarsa', 'dqn',
    'policy-gradient', 'actor-critic', 'ppo',
    'decision-transformer', 'mcts', 'model-based',
  ];

  const sessionIds = {};
  const sessionResults = {};

  for (const algo of algorithms) {
    console.log(`\n  Algorithm: ${algo}`);
    console.log('  ' + '-'.repeat(50));

    const config = {
      learningRate: 0.1,
      discountFactor: 0.95,
      explorationRate: 0.2,
      batchSize: 4,
    };

    const sessionId = await learningSystem.startSession('user-demo', algo, config);
    sessionIds[algo] = sessionId;

    let totalReward = 0;
    let successes = 0;
    const CYCLES = 5;

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const state = randomChoice(STATES);

      // 1) Predict
      const prediction = await learningSystem.predict(sessionId, state);

      // 2) Simulate environment
      const { reward, success } = simulateStep(state, prediction.action);
      totalReward += reward;
      if (success) successes++;

      const nextState = randomChoice(STATES);

      // 3) Submit feedback
      await learningSystem.submitFeedback({
        sessionId,
        action: prediction.action,
        state,
        reward,
        nextState,
        success,
        timestamp: Date.now(),
      });

      // 4) Train after each cycle
      const trainResult = await learningSystem.train(sessionId, 2, 4, config.learningRate);

      console.log(
        `    Cycle ${cycle + 1}: state=${state.padEnd(11)} ` +
        `action=${prediction.action.padEnd(13)} ` +
        `reward=${reward.toFixed(3)} ` +
        `loss=${trainResult.finalLoss.toFixed(4)} ` +
        `conv=${trainResult.convergenceRate.toFixed(3)}`
      );
    }

    sessionResults[algo] = {
      avgReward: totalReward / CYCLES,
      successRate: successes / CYCLES,
    };

    // End session
    await learningSystem.endSession(sessionId);
  }

  // -----------------------------------------------------------------------
  // Part 2: Compare algorithm performance
  // -----------------------------------------------------------------------
  console.log('\n--- Part 2: Algorithm Performance Comparison ---\n');

  console.log('  Algorithm               Avg Reward   Success Rate');
  console.log('  ' + '-'.repeat(55));
  for (const algo of algorithms) {
    const r = sessionResults[algo];
    console.log(
      `  ${algo.padEnd(24)} ${r.avgReward.toFixed(4).padStart(10)}   ${(r.successRate * 100).toFixed(1).padStart(10)}%`
    );
  }

  // Determine best performer
  let bestAlgo = algorithms[0];
  for (const algo of algorithms) {
    if (sessionResults[algo].avgReward > sessionResults[bestAlgo].avgReward) {
      bestAlgo = algo;
    }
  }
  console.log(`\n  Best performer by avg reward: ${bestAlgo} (${sessionResults[bestAlgo].avgReward.toFixed(4)})`);

  // -----------------------------------------------------------------------
  // Part 3: Transfer Learning
  // -----------------------------------------------------------------------
  console.log('\n--- Part 3: Transfer Learning Between Sessions ---\n');

  // Transfer experiences from q-learning session to a new ppo session
  const sourceSession = sessionIds['q-learning'];

  // Start a new target session for transfer
  const targetSessionId = await learningSystem.startSession('user-demo', 'ppo', {
    learningRate: 0.05,
    discountFactor: 0.99,
    explorationRate: 0.1,
  });

  const transferResult = await learningSystem.transferLearning({
    sourceSession,
    targetSession: targetSessionId,
    transferType: 'episodes',
    maxTransfers: 5,
  });

  console.log('  Transfer result:');
  console.log(`    Success         : ${transferResult.success}`);
  console.log(`    Episodes moved  : ${transferResult.transferred.episodes}`);
  console.log(`    Skills moved    : ${transferResult.transferred.skills}`);
  console.log(`    Causal edges    : ${transferResult.transferred.causalEdges}`);
  console.log(`    Source session  : ${transferResult.source.session}`);
  console.log(`    Target session  : ${transferResult.target.session}`);
  console.log(`    Transfer type   : ${transferResult.transferType}`);

  await learningSystem.endSession(targetSessionId);

  // -----------------------------------------------------------------------
  // Part 4: Explain Action (XAI)
  // -----------------------------------------------------------------------
  console.log('\n--- Part 4: Explainable Action Recommendations (XAI) ---\n');

  const explanation = await learningSystem.explainAction({
    query: 'error state needs resolution',
    k: 5,
    explainDepth: 'detailed',
    includeEvidence: true,
    includeCausal: false,  // we have a minimal causal_edges table
  });

  console.log(`  Query: "${explanation.query}"`);
  console.log(`  Explain depth: ${explanation.explainDepth}`);
  console.log(`  Recommendations (${explanation.recommendations.length}):`);
  for (const rec of explanation.recommendations) {
    console.log(
      `    Action: ${rec.action.padEnd(13)} ` +
      `confidence=${rec.confidence.toFixed(3)} ` +
      `avgReward=${rec.avgReward.toFixed(3)} ` +
      `successRate=${rec.successRate.toFixed(2)} ` +
      `examples=${rec.supportingExamples}`
    );
    if (rec.evidence && rec.evidence.length > 0) {
      for (const ev of rec.evidence.slice(0, 2)) {
        console.log(
          `      evidence: state="${ev.state}" reward=${ev.reward.toFixed(3)} ` +
          `similarity=${ev.similarity.toFixed(3)}`
        );
      }
    }
  }

  if (explanation.reasoning) {
    console.log('\n  Reasoning:');
    console.log(`    Similar experiences found : ${explanation.reasoning.similarExperiencesFound}`);
    console.log(`    Avg similarity            : ${explanation.reasoning.avgSimilarity.toFixed(4)}`);
    console.log(`    Unique actions considered  : ${explanation.reasoning.uniqueActions}`);
  }

  // -----------------------------------------------------------------------
  // Part 5: Metrics
  // -----------------------------------------------------------------------
  console.log('\n--- Part 5: Comprehensive Metrics ---\n');

  const metrics = await learningSystem.getMetrics({
    timeWindowDays: 1,
    includeTrends: true,
    groupBy: 'session',
  });

  console.log('  Time window:');
  console.log(`    Days : ${metrics.timeWindow.days}`);
  console.log(`    Start: ${new Date(metrics.timeWindow.startTimestamp).toISOString()}`);
  console.log(`    End  : ${new Date(metrics.timeWindow.endTimestamp).toISOString()}`);

  console.log('\n  Overall:');
  console.log(`    Total episodes : ${metrics.overall.totalEpisodes}`);
  console.log(`    Avg reward     : ${metrics.overall.avgReward.toFixed(4)}`);
  console.log(`    Success rate   : ${(metrics.overall.successRate * 100).toFixed(1)}%`);
  console.log(`    Min reward     : ${metrics.overall.minReward.toFixed(4)}`);
  console.log(`    Max reward     : ${metrics.overall.maxReward.toFixed(4)}`);

  console.log(`\n  Grouped metrics (by session): ${metrics.groupedMetrics.length} group(s)`);
  for (const g of metrics.groupedMetrics.slice(0, 5)) {
    console.log(
      `    Session ${g.key.substring(0, 30).padEnd(30)} ` +
      `count=${String(g.count).padStart(3)} ` +
      `avgReward=${g.avgReward.toFixed(3)} ` +
      `success=${(g.successRate * 100).toFixed(0)}%`
    );
  }

  if (metrics.trends.length > 0) {
    console.log(`\n  Trends (${metrics.trends.length} data point(s)):`);
    for (const t of metrics.trends) {
      console.log(
        `    ${t.date}  count=${t.count}  avgReward=${t.avgReward.toFixed(3)}  ` +
        `success=${(t.successRate * 100).toFixed(0)}%`
      );
    }
  }

  console.log(`\n  Policy improvement:`);
  console.log(`    Versions          : ${metrics.policyImprovement.versions}`);
  console.log(`    Q-value improvement: ${metrics.policyImprovement.qValueImprovement.toFixed(4)}`);

  // -----------------------------------------------------------------------
  // Part 6: Reward calculation helper
  // -----------------------------------------------------------------------
  console.log('\n--- Part 6: Reward Shaping Functions ---\n');

  const rewardFunctions = ['standard', 'sparse', 'dense', 'shaped'];
  for (const fn of rewardFunctions) {
    const r = learningSystem.calculateReward({
      success: true,
      targetAchieved: true,
      efficiencyScore: 0.8,
      qualityScore: 0.9,
      timeTakenMs: 200,
      expectedTimeMs: 500,
      includeCausal: false,
      rewardFunction: fn,
    });
    console.log(`  ${fn.padEnd(12)} -> reward = ${r.toFixed(4)}`);
  }

  // Cleanup
  db.close();

  console.log('\n' + '='.repeat(72));
  console.log('  Example 06 complete.');
  console.log('='.repeat(72) + '\n');
}

main().then(() => { process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
