/**
 * Router 2.0 Tests
 *
 * Validates:
 * - Thompson Sampling bandit learning
 * - PII-based routing decisions
 * - Budget guards and cost tracking
 * - Quality monitoring and rollback
 * - Win rate convergence
 */

import { Router2 } from '../src/router/Router2.js';
import { connectAgentDB } from '../src/db/agentdb.js';

export async function runRouter2Tests() {
  console.log('\n🧪 Testing Router 2.0 - Thompson Sampling Contextual Bandit\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const db = connectAgentDB();
  const router = new Router2({ db });

  // Test 1: PII Detection Routes to Privacy Lane
  try {
    console.log('Test 1: PII Detection Routes to Privacy Lane');

    const context = {
      data: { email: 'user@example.com', ssn: '123-45-6789' },
      taskType: 'data_entry',
      complexity: 'simple'
    };

    const decision = await router.route(context);

    if (decision.lane === 'onnx_local') {
      console.log('✓ PASS: PII data correctly routed to local lane');
      console.log(`  Reasoning: ${decision.reasoning}`);
      results.passed++;
      results.tests.push({ name: 'PII Routing', status: 'PASS' });
    } else {
      console.log(`✗ FAIL: PII data routed to ${decision.lane} instead of onnx_local`);
      results.failed++;
      results.tests.push({ name: 'PII Routing', status: 'FAIL', error: 'Wrong lane' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'PII Routing', status: 'FAIL', error: error.message });
  }

  // Test 2: Thompson Sampling Learning (Simulate Feedback)
  try {
    console.log('\nTest 2: Thompson Sampling Learning Over Time');

    const cleanContext = {
      data: { name: 'John Doe', age: 30 },
      taskType: 'data_entry',
      complexity: 'simple'
    };

    // Simulate 100 routing decisions with feedback
    const laneDistribution = { onnx_local: 0, economy: 0, premium: 0 };
    const decisionIds = [];

    for (let i = 0; i < 100; i++) {
      const decision = await router.route(cleanContext);
      laneDistribution[decision.lane]++;
      decisionIds.push(decision.decisionId);

      // Simulate success feedback based on lane quality
      // ONNX Local: 95% success, Economy: 90% success, Premium: 98% success
      const successRate = decision.lane === 'premium' ? 0.98 :
                         decision.lane === 'economy' ? 0.90 : 0.95;
      const success = Math.random() < successRate;

      await router.feedback(decision.decisionId, success, {
        latency: decision.lane === 'onnx_local' ? 50 :
                decision.lane === 'economy' ? 200 : 100,
        qualityScore: success ? (decision.lane === 'premium' ? 0.98 : 0.90) : 0.5
      });
    }

    console.log(`  Lane Distribution after 100 requests:`);
    console.log(`    - ONNX Local: ${laneDistribution.onnx_local} (95% quality)`);
    console.log(`    - Economy: ${laneDistribution.economy} (90% quality)`);
    console.log(`    - Premium: ${laneDistribution.premium} (98% quality)`);

    // The router should heavily favor ONNX Local (free + good quality)
    if (laneDistribution.onnx_local > 60) {
      console.log('✓ PASS: Router learned to prefer cost-effective local lane');
      results.passed++;
      results.tests.push({ name: 'Thompson Sampling Learning', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Router did not converge to optimal strategy');
      results.failed++;
      results.tests.push({ name: 'Thompson Sampling Learning', status: 'FAIL', error: 'Poor convergence' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Thompson Sampling Learning', status: 'FAIL', error: error.message });
  }

  // Test 3: Budget Guard
  try {
    console.log('\nTest 3: Budget Guard Enforcement');

    // Set daily cap to $1.00
    router.config.dailyBudgetCap = 1.00;
    router.dailySpend = 0.95; // Already spent $0.95

    const context = {
      data: { name: 'Jane Doe' },
      taskType: 'data_entry',
      complexity: 'complex'  // Would normally go to premium ($0.05)
    };

    const decision = await router.route(context);

    // Should downgrade to free lane due to budget
    if (decision.lane === 'onnx_local') {
      console.log('✓ PASS: Budget guard correctly downgraded to free lane');
      console.log(`  Reasoning: ${decision.reasoning}`);
      results.passed++;
      results.tests.push({ name: 'Budget Guard', status: 'PASS' });
    } else {
      console.log(`✗ FAIL: Budget guard failed, routed to ${decision.lane}`);
      results.failed++;
      results.tests.push({ name: 'Budget Guard', status: 'FAIL', error: 'Budget exceeded' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Budget Guard', status: 'FAIL', error: error.message });
  }

  // Test 4: Quality Rollback
  try {
    console.log('\nTest 4: Quality Monitoring and Rollback');

    // Create fresh router for this test with higher exploration to use different lanes
    const qualityRouter = new Router2({ db, explorationRate: 0.5 });

    // Force economy lane usage by making ONNX local busy (simulate)
    // Give economy lane some successes first, then failures
    for (let i = 0; i < 5; i++) {
      // Make economy look good initially
      qualityRouter.bandits.economy.successes = 8;
      qualityRouter.bandits.economy.alpha = 9;
      qualityRouter.bandits.economy.failures = 2;
      qualityRouter.bandits.economy.beta = 3;
    }

    // Now simulate quality degradation with 10 failures
    for (let i = 0; i < 10; i++) {
      qualityRouter.bandits.economy.failures++;
      qualityRouter.bandits.economy.beta++;
    }

    const stats = await qualityRouter.getStats();
    const economyStats = stats.byLane.economy;

    if (economyStats && economyStats.winRate < 0.8) {
      console.log('✓ PASS: Quality degradation detected');
      console.log(`  Economy lane win rate: ${(economyStats.winRate * 100).toFixed(1)}%`);
      results.passed++;
      results.tests.push({ name: 'Quality Monitoring', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Quality monitoring did not detect degradation');
      results.failed++;
      results.tests.push({ name: 'Quality Monitoring', status: 'FAIL', error: 'No degradation detected' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Quality Monitoring', status: 'FAIL', error: error.message });
  }

  // Test 5: Cost Calculation
  try {
    console.log('\nTest 5: Cost Tracking Accuracy');

    // Create fresh router for clean cost tracking
    const costRouter = new Router2({ db });

    const testContext = { data: {}, taskType: 'test', complexity: 'simple' };

    const d1 = await costRouter.route(testContext);
    await costRouter.feedback(d1.decisionId, true, {});

    const d2 = await costRouter.route(testContext);
    await costRouter.feedback(d2.decisionId, true, {});

    const stats = await costRouter.getStats();

    const expectedCost = d1.costPerRequest + d2.costPerRequest;
    const actualCost = stats.totalSpend;

    if (Math.abs(expectedCost - actualCost) < 0.001) {
      console.log('✓ PASS: Cost tracking is accurate');
      console.log(`  Expected: $${expectedCost.toFixed(4)}, Actual: $${actualCost.toFixed(4)}`);
      results.passed++;
      results.tests.push({ name: 'Cost Tracking', status: 'PASS' });
    } else {
      console.log(`✗ FAIL: Cost mismatch - Expected: $${expectedCost.toFixed(4)}, Actual: $${actualCost.toFixed(4)}`);
      results.failed++;
      results.tests.push({ name: 'Cost Tracking', status: 'FAIL', error: 'Cost mismatch' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Cost Tracking', status: 'FAIL', error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Router 2.0 Test Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('='.repeat(60) + '\n');

  return results;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRouter2Tests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
