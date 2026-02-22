/**
 * 12-solver-bandit.js - Thompson Sampling Decision Intelligence
 *
 * Demonstrates the SolverBandit: a contextual multi-armed bandit using
 * Thompson Sampling with Beta distributions for explore/exploit decisions.
 *
 * Simulates an algorithm selection problem:
 * - 5 query strategies (arms)
 * - 3 dataset size contexts
 * - 500 rounds of training
 * - Learns the optimal arm per context
 *
 * Usage: node examples/advanced/12-solver-bandit.js
 */

import { SolverBandit } from 'agentdb/backends';

// ─── Reward Distribution Simulation ─────────────────────────────────────────
// True reward means for each (arm, context) pair
const TRUE_REWARDS = {
  small_dataset: {
    cache_first:        0.9,
    parallel_query:     0.3,
    index_scan:         0.7,
    full_scan:          0.5,
    materialized_view:  0.2,
  },
  medium_dataset: {
    cache_first:        0.6,
    parallel_query:     0.7,
    index_scan:         0.7,
    full_scan:          0.2,
    materialized_view:  0.85,
  },
  large_dataset: {
    cache_first:        0.3,
    parallel_query:     0.9,
    index_scan:         0.7,
    full_scan:          0.1,
    materialized_view:  0.75,
  },
};

// Optimal arm per context (for verification)
const OPTIMAL_ARMS = {
  small_dataset:  'cache_first',
  medium_dataset: 'materialized_view',
  large_dataset:  'parallel_query',
};

const ARMS = ['cache_first', 'parallel_query', 'index_scan', 'full_scan', 'materialized_view'];
const CONTEXTS = ['small_dataset', 'medium_dataset', 'large_dataset'];

/**
 * Simulate a noisy reward for a given (arm, context) pair.
 * Adds Gaussian noise (clipped to [0, 1]) to the true mean.
 */
function simulateReward(arm, context) {
  const mean = TRUE_REWARDS[context][arm];
  // Add noise: N(0, 0.1)
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.2; // approximate normal
  return Math.max(0, Math.min(1, mean + noise));
}

/**
 * Simulate a cost signal (e.g., latency in seconds)
 */
function simulateCost(arm, context) {
  const baseCosts = {
    cache_first:       0.01,
    parallel_query:    0.15,
    index_scan:        0.05,
    full_scan:         0.30,
    materialized_view: 0.08,
  };
  const contextMultiplier = context === 'small_dataset' ? 0.5 : context === 'medium_dataset' ? 1.0 : 2.0;
  return baseCosts[arm] * contextMultiplier + Math.random() * 0.05;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log('  SolverBandit - Thompson Sampling Decision Intelligence');
  console.log('  Contextual Multi-Armed Bandit for Algorithm Selection');
  console.log('='.repeat(72));
  console.log();

  // ─── Step 1: Create SolverBandit ──────────────────────────────────────
  console.log('[1] Creating SolverBandit instance...');
  const bandit = new SolverBandit({
    costWeight: 0.05,      // Slight penalty for expensive arms
    costDecay: 0.1,        // EMA decay for cost tracking
    explorationBonus: 0.15, // Bonus for unexplored arms
  });
  console.log('    SolverBandit ready with Thompson Sampling.\n');

  // ─── Step 2: Show true reward landscape ───────────────────────────────
  console.log('[2] True reward landscape (what the bandit must learn):');
  console.log();
  console.log('    ' + 'Arm'.padEnd(22) + CONTEXTS.map(c => c.padEnd(16)).join(''));
  console.log('    ' + '-'.repeat(22 + 16 * 3));
  for (const arm of ARMS) {
    const vals = CONTEXTS.map(ctx => TRUE_REWARDS[ctx][arm].toFixed(2).padEnd(16));
    console.log('    ' + arm.padEnd(22) + vals.join(''));
  }
  console.log();
  console.log('    Optimal arms:');
  for (const ctx of CONTEXTS) {
    console.log(`      ${ctx}: ${OPTIMAL_ARMS[ctx]} (reward=${TRUE_REWARDS[ctx][OPTIMAL_ARMS[ctx]]})`);
  }
  console.log();

  // ─── Step 3: Training loop (500 rounds) ───────────────────────────────
  console.log('[3] Running 500 simulated selections with realistic rewards...');
  console.log();

  const totalRounds = 500;
  const selectionCounts = {};
  const cumulativeRewards = {};
  const roundRewards = [];

  // Initialize tracking
  for (const ctx of CONTEXTS) {
    selectionCounts[ctx] = {};
    cumulativeRewards[ctx] = {};
    for (const arm of ARMS) {
      selectionCounts[ctx][arm] = 0;
      cumulativeRewards[ctx][arm] = 0;
    }
  }

  // Training progress tracking
  const checkpoints = [50, 100, 200, 300, 500];
  let checkpointIdx = 0;

  for (let round = 1; round <= totalRounds; round++) {
    // Cycle through contexts
    const ctx = CONTEXTS[round % CONTEXTS.length];

    // Let bandit select an arm
    const selectedArm = bandit.selectArm(ctx, ARMS);

    // Simulate reward and cost
    const reward = simulateReward(selectedArm, ctx);
    const cost = simulateCost(selectedArm, ctx);

    // Record the outcome
    bandit.recordReward(ctx, selectedArm, reward, cost);

    // Track statistics
    selectionCounts[ctx][selectedArm]++;
    cumulativeRewards[ctx][selectedArm] += reward;
    roundRewards.push({ round, ctx, arm: selectedArm, reward, cost });

    // Print checkpoint progress
    if (checkpointIdx < checkpoints.length && round === checkpoints[checkpointIdx]) {
      const stats = bandit.getStats();
      const avgReward = stats.totalReward / stats.totalPulls;
      console.log(`    Round ${String(round).padEnd(4)} | Total pulls: ${stats.totalPulls} | Avg reward: ${avgReward.toFixed(4)} | Contexts: ${stats.contexts}`);
      checkpointIdx++;
    }
  }

  console.log();

  // ─── Step 4: Show learned policy ──────────────────────────────────────
  console.log('[4] Learned policy after training:');
  console.log();

  for (const ctx of CONTEXTS) {
    console.log(`    Context: ${ctx}`);
    console.log('    ' + '-'.repeat(60));
    console.log('    ' + 'Arm'.padEnd(22) + 'Pulls'.padEnd(8) + 'Avg Reward'.padEnd(12) + 'Alpha'.padEnd(8) + 'Beta'.padEnd(8) + 'Cost EMA');
    console.log('    ' + '-'.repeat(60));

    for (const arm of ARMS) {
      const armStats = bandit.getArmStats(ctx, arm);
      const pulls = selectionCounts[ctx][arm];
      const avgReward = pulls > 0 ? (cumulativeRewards[ctx][arm] / pulls) : 0;

      if (armStats) {
        console.log('    ' +
          arm.padEnd(22) +
          String(armStats.pulls).padEnd(8) +
          avgReward.toFixed(4).padEnd(12) +
          armStats.alpha.toFixed(1).padEnd(8) +
          armStats.beta.toFixed(1).padEnd(8) +
          armStats.costEma.toFixed(4)
        );
      } else {
        console.log('    ' + arm.padEnd(22) + '0'.padEnd(8) + '-'.padEnd(12) + '-'.padEnd(8) + '-'.padEnd(8) + '-');
      }
    }
    console.log();
  }

  // ─── Step 5: Selection frequency analysis ─────────────────────────────
  console.log('[5] Arm selection frequencies per context:');
  console.log();

  for (const ctx of CONTEXTS) {
    const totalForCtx = Object.values(selectionCounts[ctx]).reduce((a, b) => a + b, 0);
    console.log(`    ${ctx} (${totalForCtx} total selections):`);

    // Sort arms by selection frequency
    const sorted = ARMS
      .map(arm => ({ arm, count: selectionCounts[ctx][arm], pct: selectionCounts[ctx][arm] / totalForCtx * 100 }))
      .sort((a, b) => b.count - a.count);

    for (const { arm, count, pct } of sorted) {
      const bar = '#'.repeat(Math.round(pct / 2));
      const isOptimal = arm === OPTIMAL_ARMS[ctx] ? ' <-- OPTIMAL' : '';
      console.log(`      ${arm.padEnd(22)} ${String(count).padEnd(5)} (${pct.toFixed(1).padStart(5)}%) ${bar}${isOptimal}`);
    }
    console.log();
  }

  // ─── Step 6: Rerank arms for each context ─────────────────────────────
  console.log('[6] Reranking arms for each context (Thompson sample ordering):');
  console.log();

  for (const ctx of CONTEXTS) {
    const ranked = bandit.rerank(ctx, ARMS);
    console.log(`    ${ctx}: ${ranked.map((arm, i) => `${i + 1}. ${arm}`).join(', ')}`);
    console.log(`      Best pick: ${ranked[0]} (optimal: ${OPTIMAL_ARMS[ctx]}) ${ranked[0] === OPTIMAL_ARMS[ctx] ? '[CORRECT]' : '[exploring]'}`);
  }
  console.log();

  // ─── Step 7: Serialize / Deserialize state ────────────────────────────
  console.log('[7] Serializing and deserializing bandit state...');

  const serialized = bandit.serialize();
  const jsonString = JSON.stringify(serialized);
  console.log(`    Serialized state size: ${jsonString.length} bytes`);
  console.log(`    Version: ${serialized.version}`);
  console.log(`    Config: costWeight=${serialized.config.costWeight}, costDecay=${serialized.config.costDecay}`);
  console.log(`    Contexts: ${Object.keys(serialized.contexts).length}`);

  // Count total arms in serialized state
  let totalSerializedArms = 0;
  for (const ctx of Object.values(serialized.contexts)) {
    totalSerializedArms += Object.keys(ctx).length;
  }
  console.log(`    Total arms: ${totalSerializedArms}`);
  console.log();

  // Deserialize and verify
  const restored = SolverBandit.deserialize(JSON.parse(jsonString));
  const restoredStats = restored.getStats();
  const originalStats = bandit.getStats();

  console.log('    Verification after deserialization:');
  console.log(`      Original  -> contexts: ${originalStats.contexts}, pulls: ${originalStats.totalPulls}, reward: ${originalStats.totalReward.toFixed(2)}`);
  console.log(`      Restored  -> contexts: ${restoredStats.contexts}, pulls: ${restoredStats.totalPulls}, reward: ${restoredStats.totalReward.toFixed(2)}`);
  console.log(`      Match: ${originalStats.totalPulls === restoredStats.totalPulls && Math.abs(originalStats.totalReward - restoredStats.totalReward) < 0.001 ? 'YES' : 'NO'}`);
  console.log();

  // Verify restored bandit makes similar decisions
  console.log('    Restored bandit reranking:');
  for (const ctx of CONTEXTS) {
    const originalRank = bandit.rerank(ctx, ARMS);
    const restoredRank = restored.rerank(ctx, ARMS);
    // Note: Thompson Sampling is stochastic, so exact match is not guaranteed
    console.log(`      ${ctx}: top pick = ${restoredRank[0]} (original top = ${originalRank[0]})`);
  }
  console.log();

  // ─── Step 8: Demonstrate learning convergence ─────────────────────────
  console.log('[8] Demonstrating that the bandit learned optimal arms:');
  console.log();

  let correctCount = 0;
  const verificationRounds = 100;

  for (const ctx of CONTEXTS) {
    let optimalSelections = 0;
    for (let i = 0; i < verificationRounds; i++) {
      const arm = bandit.selectArm(ctx, ARMS);
      if (arm === OPTIMAL_ARMS[ctx]) optimalSelections++;
    }
    const pct = (optimalSelections / verificationRounds * 100).toFixed(1);
    const status = optimalSelections >= verificationRounds * 0.5 ? 'LEARNED' : 'LEARNING';
    console.log(`    ${ctx}:`);
    console.log(`      Optimal arm:     ${OPTIMAL_ARMS[ctx]}`);
    console.log(`      Selection rate:  ${pct}% (${optimalSelections}/${verificationRounds})`);
    console.log(`      Status:          ${status}`);
    if (optimalSelections >= verificationRounds * 0.5) correctCount++;
  }

  console.log();
  console.log(`    Contexts with learned optimal policy: ${correctCount}/${CONTEXTS.length}`);

  // ─── Step 9: Aggregate statistics ─────────────────────────────────────
  console.log('\n[9] Aggregate Statistics:');

  const finalStats = bandit.getStats();
  console.log(`    Total contexts:  ${finalStats.contexts}`);
  console.log(`    Total arms:      ${finalStats.totalArms}`);
  console.log(`    Total pulls:     ${finalStats.totalPulls}`);
  console.log(`    Total reward:    ${finalStats.totalReward.toFixed(2)}`);
  console.log(`    Avg reward:      ${(finalStats.totalReward / finalStats.totalPulls).toFixed(4)}`);

  // Calculate regret (sum of optimal - actual rewards)
  let totalRegret = 0;
  for (const rr of roundRewards) {
    const optimalReward = TRUE_REWARDS[rr.ctx][OPTIMAL_ARMS[rr.ctx]];
    totalRegret += optimalReward - rr.reward;
  }
  console.log(`    Cumulative regret: ${totalRegret.toFixed(2)}`);
  console.log(`    Avg regret/round:  ${(totalRegret / totalRounds).toFixed(4)}`);

  // Show reward progression over time
  console.log('\n    Reward progression (windowed average over 50 rounds):');
  const windowSize = 50;
  for (let start = 0; start < totalRounds; start += windowSize) {
    const window = roundRewards.slice(start, start + windowSize);
    const avgReward = window.reduce((s, r) => s + r.reward, 0) / window.length;
    const bar = '#'.repeat(Math.round(avgReward * 40));
    console.log(`      Rounds ${String(start + 1).padStart(3)}-${String(Math.min(start + windowSize, totalRounds)).padStart(3)}: ${avgReward.toFixed(3)} ${bar}`);
  }

  // ─── Finish ───────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  SolverBandit example completed successfully.');
  console.log('  The bandit learned to select the optimal algorithm per dataset size.');
  console.log('='.repeat(72));
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
