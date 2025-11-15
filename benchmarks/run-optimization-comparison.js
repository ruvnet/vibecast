/**
 * Comparison: Original vs Optimized AgentDB-Enhanced
 * Tests Phase 1 optimizations (numerical features + Euclidean distance)
 */

import {
  REALISTIC_DATASETS,
  verifyRealism
} from './realistic-market-generator.js';

import {
  createWalkForwardSplits,
  BacktestEngine
} from './backtesting-framework.js';

import {
  NaivePredictor
} from './baseline-methods.js';

import {
  AdaptiveConformalMethod
} from './advanced-methods.js';

import {
  AgentDBEnhancedPredictor
} from './agentdb-enhanced-simple.js';

import {
  AgentDBEnhancedOptimized
} from './agentdb-enhanced-optimized.js';

async function runOptimizationComparison() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       OPTIMIZATION COMPARISON                                  ║');
  console.log('║   Original vs Optimized AgentDB-Enhanced                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {}
  };

  // Test dataset
  const testDataset = { key: 'SPY_FULL_CYCLE', name: 'SPY - Full Cycle (2020-2024)' };

  console.log('\\n' + '═'.repeat(70));
  console.log(`📊 Testing: ${testDataset.name}`);
  console.log('═'.repeat(70));

  // Generate realistic data
  const generated = REALISTIC_DATASETS[testDataset.key]();
  const marketData = generated.data;

  console.log(`\\n  ${generated.name}`);
  console.log(`  ${generated.metadata.note}\\n`);

  // Verify realism
  const stats = verifyRealism(marketData);
  console.log(`  Realism Check:`);
  console.log(`  • Data Points: ${stats.dataPoints}`);
  console.log(`  • Total Return: ${stats.totalReturn}`);
  console.log(`  • Annualized Return: ${stats.annualizedReturn}`);
  console.log(`  • Annualized Volatility: ${stats.annualizedVolatility}`);
  console.log(`  • Sharpe Ratio: ${stats.sharpeRatio}`);
  console.log(`  • Max Drawdown: ${stats.maxDrawdown}`);

  // Create validation splits
  const trainSize = Math.min(500, Math.floor(marketData.length * 0.4));
  const testSize = 50;
  const stepSize = Math.min(50, Math.floor(marketData.length / 10));

  const splits = createWalkForwardSplits(marketData, {
    initialTrainSize: trainSize,
    testSize,
    stepSize
  });

  console.log(`\\n  Validation Setup:`);
  console.log(`  • Training Size: ${trainSize} days`);
  console.log(`  • Test Size: ${testSize} days`);
  console.log(`  • Walk-Forward Splits: ${splits.length}`);
  console.log(`  • Total Out-of-Sample: ${splits.reduce((sum, s) => sum + (s.testEnd - s.testStart), 0)} predictions`);

  // Initialize backtesting engine
  const engine = new BacktestEngine(marketData);

  // Define predictors for comparison
  const predictors = {
    'Naive': new NaivePredictor(),
    'AdaptiveConformal': new AdaptiveConformalMethod({ targetCoverage: 0.9, gamma: 0.01 }),
    'AgentDB-Original': new AgentDBEnhancedPredictor({ targetCoverage: 0.9, gamma: 0.005 }),
    'AgentDB-Optimized': new AgentDBEnhancedOptimized({ targetCoverage: 0.9, gamma: 0.005 })
  };

  console.log('\\n  🚀 Running Backtests...\\n');

  // Run comparison
  const testResults = await engine.compareModels(predictors, splits);

  // Generate report
  const report = engine.generateReport(testResults);

  // Store results
  results.datasets[testDataset.name] = {
    key: testDataset.key,
    metadata: generated.metadata,
    stats,
    results: Object.entries(testResults).reduce((acc, [name, result]) => {
      acc[name] = {
        metrics: result.metrics,
        performance: result.performance
      };
      return acc;
    }, {}),
    rankings: report.rankings,
    improvements: report.improvements
  };

  // Print detailed comparison
  console.log('\\n  📊 Results Summary:\\n');

  console.log('  MAPE Comparison (Lower is Better):');
  report.rankings.mape.forEach((r, i) => {
    const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`  ${symbol} ${i + 1}. ${r.model}: ${r.value.toFixed(4)}%`);
  });

  if (report.rankings.coverage && report.rankings.coverage.length > 0) {
    console.log('\\n  Coverage Comparison (Target: 90%):');
    report.rankings.coverage.forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const diff = Math.abs(r.value - 0.9);
      console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}% (±${(diff * 100).toFixed(2)}%)`);
    });
  }

  console.log('\\n  Directional Accuracy Comparison:');
  report.rankings.directionalAccuracy.forEach((r, i) => {
    const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}%`);
  });

  // Head-to-head: Original vs Optimized
  console.log('\\n');
  console.log('═'.repeat(70));
  console.log('🎯 OPTIMIZATION IMPACT');
  console.log('═'.repeat(70));

  const originalMAPE = testResults['AgentDB-Original'].metrics.mape;
  const optimizedMAPE = testResults['AgentDB-Optimized'].metrics.mape;
  const naiveMAPE = testResults['Naive'].metrics.mape;

  const improvement = ((originalMAPE - optimizedMAPE) / originalMAPE * 100);
  const vsNaive = ((naiveMAPE - optimizedMAPE) / naiveMAPE * 100);

  console.log(`\\n📊 Optimization Improvements:\\n`);

  console.log(`  Original AgentDB:    ${originalMAPE.toFixed(4)}%`);
  console.log(`  Optimized AgentDB:   ${optimizedMAPE.toFixed(4)}%`);
  console.log(`  Improvement:         ${improvement > 0 ? '✅' : '❌'} ${improvement.toFixed(2)}%\\n`);

  console.log(`  vs Naive Baseline:   ${vsNaive > 0 ? '✅' : '❌'} ${vsNaive.toFixed(2)}%`);

  if (report.rankings.coverage && report.rankings.coverage.length > 0) {
    const originalCoverage = testResults['AgentDB-Original'].metrics.coverage;
    const optimizedCoverage = testResults['AgentDB-Optimized'].metrics.coverage;

    console.log(`\\n  Coverage Comparison:`);
    console.log(`  Original:            ${(originalCoverage * 100).toFixed(2)}%`);
    console.log(`  Optimized:           ${(optimizedCoverage * 100).toFixed(2)}%`);
    console.log(`  Target:              90.00%`);
  }

  const originalDirAcc = testResults['AgentDB-Original'].metrics.directionalAccuracy;
  const optimizedDirAcc = testResults['AgentDB-Optimized'].metrics.directionalAccuracy;

  console.log(`\\n  Directional Accuracy:`);
  console.log(`  Original:            ${(originalDirAcc * 100).toFixed(2)}%`);
  console.log(`  Optimized:           ${(optimizedDirAcc * 100).toFixed(2)}%`);

  // Final verdict
  console.log('\\n');
  console.log('═'.repeat(70));
  console.log('📋 PHASE 1 VERDICT');
  console.log('═'.repeat(70));
  console.log('');

  if (improvement > 10 && vsNaive > 0) {
    console.log('✅ SUCCESS: Phase 1 optimizations delivered significant improvement!');
    console.log(`   • ${improvement.toFixed(1)}% better than original`);
    console.log(`   • Now ${vsNaive > 0 ? 'beats' : 'loses to'} Naive by ${Math.abs(vsNaive).toFixed(1)}%`);
    console.log(`   • Ready for Phase 2 (Ensemble approach)`);
  } else if (improvement > 5) {
    console.log('⚠️  PARTIAL SUCCESS: Phase 1 shows improvement but not enough');
    console.log(`   • ${improvement.toFixed(1)}% better than original`);
    console.log(`   • Still ${vsNaive > 0 ? 'beats' : 'loses to'} Naive by ${Math.abs(vsNaive).toFixed(1)}%`);
    console.log(`   • Need Phase 2 & 3 optimizations`);
  } else if (improvement > 0) {
    console.log('❌ MARGINAL: Phase 1 shows minimal improvement');
    console.log(`   • Only ${improvement.toFixed(1)}% better`);
    console.log(`   • Alternative approaches needed`);
  } else {
    console.log('❌ FAILURE: Phase 1 optimizations made it worse');
    console.log(`   • ${Math.abs(improvement).toFixed(1)}% degradation`);
    console.log(`   • Need to debug implementation`);
  }

  console.log('\\n═'.repeat(70));
  console.log('');

  // Cleanup
  if (predictors['AgentDB-Original'].cleanup) {
    await predictors['AgentDB-Original'].cleanup();
  }
  if (predictors['AgentDB-Optimized'].cleanup) {
    await predictors['AgentDB-Optimized'].cleanup();
  }

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './optimization-comparison-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Results saved to: ./optimization-comparison-results.json\\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOptimizationComparison()
    .then(() => {
      console.log('✅ Optimization comparison complete!\\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Comparison failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runOptimizationComparison };
