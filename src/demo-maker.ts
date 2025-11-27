/**
 * VibeCast Pro - MAKER Framework Benchmark Demo
 *
 * Demonstrates the integration of concepts from
 * "Solving a Million-Step LLM Task with Zero Errors" (arXiv:2511.09030)
 *
 * Runs benchmarks comparing:
 * - Standard orchestration vs MAKER-enhanced
 * - Different k (voting threshold) values
 * - Parallel vs sequential voting
 */

import { getUserProfileService, resetUserProfileService } from './services/user-profile';
import { getContentCatalog, resetContentCatalog } from './services/content-catalog';
import { getVectorStore, resetVectorStore } from './embeddings/vector-store';
import { getSwarmOrchestrator, resetSwarmOrchestrator } from './agents/swarm/orchestrator';
import {
  MAKERSwarmOrchestrator,
  getMAKERSwarmOrchestrator,
  resetMAKERSwarmOrchestrator
} from './agents/swarm/maker-orchestrator';
import { getBenchmarkRunner, resetBenchmarkRunner } from './benchmark';
import { DEFAULT_MAKER_CONFIG, calculateFullTaskSuccess, calculateMinimumK } from './maker';
import type { DiscoveryContext } from './agents/swarm/base-agent';

/**
 * Print formatted header
 */
function printHeader(title: string): void {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log(`║ ${title.padEnd(75)} ║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
}

/**
 * Print section header
 */
function printSection(title: string): void {
  console.log(`\n🔹 ${title}`);
  console.log('─'.repeat(60));
}

/**
 * Format percentage
 */
function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Initialize the system
 */
function initialize(): string {
  // Reset all singletons
  resetUserProfileService();
  resetContentCatalog();
  resetVectorStore();
  resetSwarmOrchestrator();
  resetMAKERSwarmOrchestrator();
  resetBenchmarkRunner();

  // Create test user
  const userService = getUserProfileService();
  const user = userService.create('MAKER Tester');

  userService.updatePreferences(user.id, {
    favoriteGenres: ['sci-fi', 'thriller', 'documentary'],
    preferredMoods: ['exciting', 'thought-provoking'],
    subscribedPlatforms: ['netflix', 'amazon-prime'],
    minimumRating: 7.0
  });

  // Index content
  const vectorStore = getVectorStore();
  const catalog = getContentCatalog();
  vectorStore.indexAll(catalog.getAll());

  console.log(`   ✓ Test user created: ${user.id.slice(0, 8)}...`);
  console.log(`   ✓ Content indexed: ${catalog.count()} items`);
  console.log(`   ✓ Vector store ready: ${vectorStore.size()} embeddings`);

  return user.id;
}

/**
 * Run standard orchestration benchmark
 */
async function benchmarkStandard(userId: string, iterations: number): Promise<void> {
  const orchestrator = getSwarmOrchestrator();
  const runner = getBenchmarkRunner();

  console.log(`   Running ${iterations} iterations...`);

  const context: DiscoveryContext = {
    userId,
    sessionId: 'benchmark-session',
    query: 'exciting sci-fi thriller',
    mood: 'exciting'
  };

  let totalTime = 0;
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const result = await orchestrator.orchestrate(context, 5);
    totalTime += Date.now() - start;

    if (result.recommendations.length > 0) {
      successCount++;
    }
  }

  // Record as stats
  runner.record('Standard Orchestration', {
    totalSteps: iterations,
    successfulSteps: successCount,
    failedSteps: iterations - successCount,
    totalVotesCast: iterations, // 1 "vote" per iteration in standard mode
    averageVotesPerStep: 1,
    redFlagsDetected: 0,
    totalExecutionTime: totalTime,
    perStepAccuracy: successCount / iterations,
    estimatedFullTaskSuccess: successCount / iterations
  }, DEFAULT_MAKER_CONFIG, totalTime);

  console.log(`   ✓ Complete: ${pct(successCount / iterations)} success, ${totalTime}ms total`);
}

/**
 * Run MAKER-enhanced orchestration benchmark
 */
async function benchmarkMAKER(
  userId: string,
  iterations: number,
  kValue: number,
  parallel: boolean
): Promise<void> {
  resetMAKERSwarmOrchestrator();

  const orchestrator = new MAKERSwarmOrchestrator({
    votingThreshold: kValue,
    parallelVoting: parallel,
    voterCount: 5
  });

  const runner = getBenchmarkRunner();
  const configName = `MAKER k=${kValue} ${parallel ? 'parallel' : 'sequential'}`;

  console.log(`   Running ${iterations} iterations (${configName})...`);

  const context: DiscoveryContext = {
    userId,
    sessionId: 'maker-benchmark-session',
    query: 'exciting sci-fi thriller',
    mood: 'exciting'
  };

  let totalTime = 0;
  let successCount = 0;
  let totalVotes = 0;
  let redFlags = 0;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const result = await orchestrator.orchestrate(context, 5);
    totalTime += Date.now() - start;

    if (result.recommendations.length > 0 && result.estimatedReliability > 0.5) {
      successCount++;
    }

    totalVotes += result.makerStats.totalVotesCast;
    redFlags += result.redFlags.length;
  }

  // Record stats
  runner.record(configName, {
    totalSteps: iterations,
    successfulSteps: successCount,
    failedSteps: iterations - successCount,
    totalVotesCast: totalVotes,
    averageVotesPerStep: totalVotes / iterations,
    redFlagsDetected: redFlags,
    totalExecutionTime: totalTime,
    perStepAccuracy: successCount / iterations,
    estimatedFullTaskSuccess: calculateFullTaskSuccess(
      successCount / iterations,
      kValue,
      iterations
    )
  }, {
    ...DEFAULT_MAKER_CONFIG,
    votingThreshold: kValue,
    parallelVoting: parallel
  }, totalTime);

  console.log(`   ✓ Complete: ${pct(successCount / iterations)} success, ${totalTime}ms total`);
}

/**
 * Run deep orchestration benchmark
 */
async function benchmarkDeepMAKER(userId: string, iterations: number): Promise<void> {
  resetMAKERSwarmOrchestrator();

  const orchestrator = new MAKERSwarmOrchestrator({
    votingThreshold: 3,
    parallelVoting: true,
    voterCount: 5
  });

  const runner = getBenchmarkRunner();

  console.log(`   Running ${iterations} deep orchestrations...`);

  const context: DiscoveryContext = {
    userId,
    sessionId: 'deep-benchmark-session',
    query: 'mind-bending thriller with great cinematography',
    mood: 'thought-provoking',
    signals: {
      socialContext: 'alone',
      timeOfDay: 'night'
    }
  };

  let totalTime = 0;
  let successCount = 0;
  let totalVotes = 0;
  let redFlags = 0;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const result = await orchestrator.deepOrchestrate(context, 5);
    totalTime += Date.now() - start;

    if (result.recommendations.length > 0 && result.estimatedReliability > 0.5) {
      successCount++;
    }

    totalVotes += result.makerStats.totalVotesCast;
    redFlags += result.redFlags.length;
  }

  // Record stats
  runner.record('Deep MAKER Orchestration', {
    totalSteps: iterations * 3, // 3 decomposed steps per orchestration
    successfulSteps: successCount * 3,
    failedSteps: (iterations - successCount) * 3,
    totalVotesCast: totalVotes,
    averageVotesPerStep: totalVotes / (iterations * 3),
    redFlagsDetected: redFlags,
    totalExecutionTime: totalTime,
    perStepAccuracy: successCount / iterations,
    estimatedFullTaskSuccess: calculateFullTaskSuccess(
      successCount / iterations,
      3,
      iterations * 3
    )
  }, DEFAULT_MAKER_CONFIG, totalTime);

  console.log(`   ✓ Complete: ${pct(successCount / iterations)} success, ${totalTime}ms total`);
}

/**
 * Print theoretical analysis
 */
function printTheoreticalAnalysis(): void {
  printSection('THEORETICAL ANALYSIS (from paper)');

  console.log('\n   Formula: p_full = (1 + ((1-p)/p)^k)^(-s/m)');
  console.log('   Where: p = per-step accuracy, k = voting threshold, s = steps, m = steps/agent\n');

  const scenarios = [
    { name: '10 steps, p=0.7', steps: 10, p: 0.7 },
    { name: '100 steps, p=0.7', steps: 100, p: 0.7 },
    { name: '1000 steps, p=0.7', steps: 1000, p: 0.7 },
    { name: '10 steps, p=0.9', steps: 10, p: 0.9 },
    { name: '100 steps, p=0.9', steps: 100, p: 0.9 }
  ];

  console.log('   Scenario                    k=1      k=3      k=5      k=7');
  console.log('   ' + '─'.repeat(56));

  for (const scenario of scenarios) {
    const results = [1, 3, 5, 7].map(k =>
      pct(calculateFullTaskSuccess(scenario.p, k, scenario.steps)).padStart(7)
    );

    console.log(`   ${scenario.name.padEnd(25)} ${results.join('  ')}`);
  }

  console.log('\n   Minimum k for 99% success at p=0.8:');
  const stepCounts = [10, 50, 100, 500, 1000];
  for (const steps of stepCounts) {
    const kMin = calculateMinimumK(steps, 0.99, 0.8);
    console.log(`   • ${steps} steps: k ≥ ${kMin}`);
  }
}

/**
 * Main demo function
 */
async function runDemo(): Promise<void> {
  printHeader('VIBECAST PRO - MAKER FRAMEWORK BENCHMARK');

  console.log('🧪 Implementing concepts from:');
  console.log('   "Solving a Million-Step LLM Task with Zero Errors"');
  console.log('   (arXiv:2511.09030) by Meyerson et al.\n');

  // Initialize
  printSection('INITIALIZATION');
  const userId = initialize();

  // Run theoretical analysis
  printTheoreticalAnalysis();

  // Benchmarks
  printSection('BENCHMARKING');
  const iterations = 10;

  console.log('\n📊 Standard Orchestration:');
  await benchmarkStandard(userId, iterations);

  console.log('\n📊 MAKER-Enhanced (k=2, parallel):');
  await benchmarkMAKER(userId, iterations, 2, true);

  console.log('\n📊 MAKER-Enhanced (k=3, parallel):');
  await benchmarkMAKER(userId, iterations, 3, true);

  console.log('\n📊 MAKER-Enhanced (k=5, parallel):');
  await benchmarkMAKER(userId, iterations, 5, true);

  console.log('\n📊 MAKER-Enhanced (k=3, sequential):');
  await benchmarkMAKER(userId, iterations, 3, false);

  console.log('\n📊 Deep MAKER Orchestration:');
  await benchmarkDeepMAKER(userId, iterations);

  // Print results
  printSection('BENCHMARK RESULTS');
  const runner = getBenchmarkRunner();
  console.log(runner.generateReport());

  // Analysis
  printSection('ANALYSIS');

  const results = runner.getResults();
  const standard = results.find(r => r.name === 'Standard Orchestration');
  const maker3 = results.find(r => r.name === 'MAKER k=3 parallel');

  if (standard && maker3) {
    console.log('\n   Comparison: Standard vs MAKER (k=3 parallel)\n');

    const speedup = standard.performance.totalTimeMs / maker3.performance.totalTimeMs;
    const accuracyDiff = maker3.stats.perStepAccuracy - standard.stats.perStepAccuracy;

    console.log(`   Accuracy improvement: ${accuracyDiff >= 0 ? '+' : ''}${pct(accuracyDiff)}`);
    console.log(`   Time ratio: ${speedup.toFixed(2)}x ${speedup > 1 ? '(MAKER faster)' : '(MAKER slower)'}`);
    console.log(`   Voting overhead: ${maker3.stats.averageVotesPerStep.toFixed(1)} votes/step`);
    console.log(`   Red flag rate: ${pct(maker3.efficiency.redFlagRate)}`);
    console.log(`   Estimated reliability: ${pct(maker3.theoretical.expectedSuccessRate)}`);
  }

  // Key insights
  printSection('KEY INSIGHTS');

  console.log(`
   ✓ MAKER Framework Integration Complete

   The First-to-Ahead-by-k voting mechanism provides:
   • Error correction through consensus
   • Red-flagging for anomaly detection
   • Theoretical guarantees on full-task success

   Optimal configuration for VibeCast:
   • k = 3 provides good balance of accuracy and speed
   • Parallel voting reduces latency
   • Deep orchestration increases reliability for complex queries

   Paper formula: p_full = (1 + ((1-p)/p)^k)^(-s/m)
   For VibeCast with k=3, p=0.9, s=10 steps:
   Expected reliability: ${pct(calculateFullTaskSuccess(0.9, 3, 10))}
`);

  printHeader('BENCHMARK COMPLETE');
}

// Run the demo
runDemo().catch(console.error);
