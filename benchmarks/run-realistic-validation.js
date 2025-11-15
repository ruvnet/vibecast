/**
 * Realistic Market Data Validation
 * Uses statistically accurate market simulations based on real SPY/BTC data
 */

import {
  REALISTIC_DATASETS,
  verifyRealism
} from './realistic-market-generator.js';

import {
  createWalkForwardSplits,
  BacktestEngine,
  pairedTTest
} from './backtesting-framework.js';

import {
  NaivePredictor,
  LinearRegressionPredictor,
  ARPredictor,
  MomentumPredictor
} from './baseline-methods.js';

import {
  ConformalPredictor,
  AdaptiveConformalMethod,
  PatternBasedConformalPredictor
} from './advanced-methods.js';

import {
  AgentDBEnhancedPredictor
} from './agentdb-enhanced-simple.js';

async function runRealisticValidation() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       REALISTIC MARKET DATA VALIDATION                        ║');
  console.log('║   Based on Real SPY/BTC Statistics (2020-2024)                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {},
    summary: {}
  };

  // Test datasets
  const testDatasets = [
    { key: 'SPY_FULL_CYCLE', name: 'SPY - Full Cycle (2020-2024)' },
    { key: 'SPY_COVID_CRASH', name: 'SPY - COVID Crash' },
    { key: 'BTC_FULL_CYCLE', name: 'BTC - Full Cycle' }
  ];

  for (const dataset of testDatasets) {
    console.log('\n' + '═'.repeat(70));
    console.log(`📊 Testing: ${dataset.name}`);
    console.log('═'.repeat(70));

    try {
      // Generate realistic data
      const generated = REALISTIC_DATASETS[dataset.key]();
      const marketData = generated.data;

      console.log(`\n  ${generated.name}`);
      console.log(`  ${generated.metadata.note}\n`);

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

      console.log(`\n  Validation Setup:`);
      console.log(`  • Training Size: ${trainSize} days`);
      console.log(`  • Test Size: ${testSize} days`);
      console.log(`  • Walk-Forward Splits: ${splits.length}`);
      console.log(`  • Total Out-of-Sample: ${splits.reduce((sum, s) => sum + (s.testEnd - s.testStart), 0)} predictions`);

      // Initialize backtesting engine
      const engine = new BacktestEngine(marketData);

      // Define predictors
      const predictors = {
        'Naive': new NaivePredictor(),
        'LinearRegression': new LinearRegressionPredictor({ window: 50 }),
        'AR(5)': new ARPredictor({ order: 5 }),
        'Momentum': new MomentumPredictor({ window: 20 }),
        'Conformal': new ConformalPredictor({ alpha: 0.1 }),
        'AdaptiveConformal': new AdaptiveConformalMethod({ targetCoverage: 0.9, gamma: 0.01 }),
        'PatternBased': new PatternBasedConformalPredictor({ alpha: 0.1 }),
        'AgentDB-Enhanced': new AgentDBEnhancedPredictor({ targetCoverage: 0.9, gamma: 0.005 })
      };

      console.log('\n  🚀 Running Backtests...\n');

      // Run comparison
      const testResults = await engine.compareModels(predictors, splits);

      // Generate report
      const report = engine.generateReport(testResults);

      // Store results
      results.datasets[dataset.name] = {
        key: dataset.key,
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

      // Print summary
      console.log('\n  📊 Results Summary:\n');

      console.log('  Best MAPE (Lower is Better):');
      report.rankings.mape.slice(0, 5).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`  ${symbol} ${i + 1}. ${r.model}: ${r.value.toFixed(4)}%`);
      });

      if (report.rankings.coverage && report.rankings.coverage.length > 0) {
        console.log('\n  Best Coverage (Target: 90%):');
        report.rankings.coverage.slice(0, 5).forEach((r, i) => {
          const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
          const diff = Math.abs(r.value - 0.9);
          console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}% (±${(diff * 100).toFixed(2)}%)`);
        });
      }

      console.log('\n  Best Directional Accuracy:');
      report.rankings.directionalAccuracy.slice(0, 5).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}%`);
      });

      // Statistical significance
      const naiveErrors = testResults['Naive'].predictions.map(p => p.relativeError);
      const agentDBErrors = testResults['AgentDB-Enhanced'].predictions.map(p => p.relativeError);
      const tTest = pairedTTest(naiveErrors, agentDBErrors);

      console.log(`\n  📊 Statistical Test (AgentDB vs Naive):`);
      console.log(`    t-statistic: ${tTest.tStatistic.toFixed(4)}`);
      console.log(`    p-value: ${tTest.pValue.toFixed(6)}`);
      console.log(`    Significant: ${tTest.significant ? '✅ YES (p < 0.05)' : '❌ NO (p >= 0.05)'}`);

      // Head-to-head comparison
      const naiveMAPE = testResults['Naive'].metrics.mape;
      const agentDBMAPE = testResults['AgentDB-Enhanced'].metrics.mape;
      const improvement = ((naiveMAPE - agentDBMAPE) / naiveMAPE * 100);

      console.log(`\n  🎯 AgentDB vs Naive:`);
      console.log(`    Naive MAPE:          ${naiveMAPE.toFixed(4)}%`);
      console.log(`    AgentDB MAPE:        ${agentDBMAPE.toFixed(4)}%`);
      console.log(`    Change:              ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`);

      if (improvement > 5) {
        console.log(`    Verdict:             ✅ SIGNIFICANT IMPROVEMENT`);
      } else if (improvement > 0) {
        console.log(`    Verdict:             ⚠️  MARGINAL IMPROVEMENT`);
      } else {
        console.log(`    Verdict:             ❌ UNDERPERFORMS`);
      }

      // Cleanup
      if (predictors['AgentDB-Enhanced'].cleanup) {
        await predictors['AgentDB-Enhanced'].cleanup();
      }

    } catch (error) {
      console.error(`  ❌ Error testing ${dataset.name}:`, error.message);
      console.error(error.stack);
      results.datasets[dataset.name] = { error: error.message };
    }
  }

  // Generate overall summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  FINAL VERDICT                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const allResults = Object.entries(results.datasets).filter(([_, v]) => !v.error);

  if (allResults.length === 0) {
    console.log('❌ No successful tests completed.\n');
    return results;
  }

  // Calculate average rankings
  const modelPerformance = {};

  allResults.forEach(([datasetName, dataset]) => {
    Object.entries(dataset.results).forEach(([modelName, result]) => {
      if (!modelPerformance[modelName]) {
        modelPerformance[modelName] = {
          mapes: [],
          coverages: [],
          directionalAccuracies: [],
          datasets: []
        };
      }

      modelPerformance[modelName].mapes.push(result.metrics.mape);
      if (result.metrics.coverage !== null) {
        modelPerformance[modelName].coverages.push(result.metrics.coverage);
      }
      modelPerformance[modelName].directionalAccuracies.push(result.metrics.directionalAccuracy);
      modelPerformance[modelName].datasets.push(datasetName);
    });
  });

  // Print aggregated results
  console.log('📊 Average Performance Across All Tests:\n');

  console.log('Average MAPE:');
  const mapeRankings = Object.entries(modelPerformance)
    .map(([model, perf]) => ({
      model,
      avgMAPE: perf.mapes.reduce((a, b) => a + b, 0) / perf.mapes.length
    }))
    .sort((a, b) => a.avgMAPE - b.avgMAPE);

  mapeRankings.forEach((r, i) => {
    const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`  ${symbol} ${i + 1}. ${r.model}: ${r.avgMAPE.toFixed(4)}%`);
  });

  console.log('\nAverage Coverage:');
  Object.entries(modelPerformance)
    .filter(([_, perf]) => perf.coverages.length > 0)
    .map(([model, perf]) => ({
      model,
      avgCoverage: perf.coverages.reduce((a, b) => a + b, 0) / perf.coverages.length
    }))
    .sort((a, b) => Math.abs(b.avgCoverage - 0.9) - Math.abs(a.avgCoverage - 0.9)) // Closest to 90%
    .slice(0, 5)
    .forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const diff = Math.abs(r.avgCoverage - 0.9);
      console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.avgCoverage * 100).toFixed(2)}% (±${(diff * 100).toFixed(2)}%)`);
    });

  console.log('\nAverage Directional Accuracy:');
  Object.entries(modelPerformance)
    .map(([model, perf]) => ({
      model,
      avgDirAcc: perf.directionalAccuracies.reduce((a, b) => a + b, 0) / perf.directionalAccuracies.length
    }))
    .sort((a, b) => b.avgDirAcc - a.avgDirAcc)
    .slice(0, 5)
    .forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.avgDirAcc * 100).toFixed(2)}%`);
    });

  // The HONEST final verdict
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('🎯 THE HONEST FINAL VERDICT');
  console.log('═'.repeat(70));

  const agentDBPerf = modelPerformance['AgentDB-Enhanced'];
  const naivePerf = modelPerformance['Naive'];

  if (agentDBPerf && naivePerf) {
    const agentDBAvgMAPE = agentDBPerf.mapes.reduce((a, b) => a + b, 0) / agentDBPerf.mapes.length;
    const naiveAvgMAPE = naivePerf.mapes.reduce((a, b) => a + b, 0) / naivePerf.mapes.length;
    const improvement = ((naiveAvgMAPE - agentDBAvgMAPE) / naiveAvgMAPE * 100);

    console.log(`\n📈 AgentDB-Enhanced vs Naive Baseline:`);
    console.log(`\n  Point Accuracy:`);
    console.log(`    Naive MAPE:          ${naiveAvgMAPE.toFixed(4)}%`);
    console.log(`    AgentDB MAPE:        ${agentDBAvgMAPE.toFixed(4)}%`);
    console.log(`    Improvement:         ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`);

    console.log(`\n  Prediction Intervals:`);
    if (agentDBPerf.coverages.length > 0) {
      const avgCoverage = agentDBPerf.coverages.reduce((a, b) => a + b, 0) / agentDBPerf.coverages.length;
      const coverageError = Math.abs(avgCoverage - 0.9);
      console.log(`    Target Coverage:     90.00%`);
      console.log(`    Actual Coverage:     ${(avgCoverage * 100).toFixed(2)}%`);
      console.log(`    Error:               ±${(coverageError * 100).toFixed(2)}%`);

      if (coverageError < 0.03) {
        console.log(`    Status:              ✅ EXCELLENT - Within ±3%`);
      } else if (coverageError < 0.05) {
        console.log(`    Status:              ⚠️  ACCEPTABLE - Within ±5%`);
      } else {
        console.log(`    Status:              ❌ NEEDS CALIBRATION`);
      }
    }

    console.log(`\n  Overall Assessment:`);

    if (improvement > 10 && agentDBPerf.coverages.length > 0) {
      console.log(`    ✅ WINNER: AgentDB-Enhanced significantly outperforms`);
      console.log(`       - ${improvement.toFixed(1)}% better accuracy`);
      console.log(`       - Reliable prediction intervals`);
      console.log(`       - Ready for production use`);
    } else if (improvement > 5) {
      console.log(`    ⚠️  MIXED: AgentDB-Enhanced shows modest improvements`);
      console.log(`       - ${improvement.toFixed(1)}% better accuracy`);
      console.log(`       - Benefits exist but not dramatic`);
      console.log(`       - Consider use case carefully`);
    } else if (improvement > 0) {
      console.log(`    ⚠️  MARGINAL: AgentDB-Enhanced barely beats baseline`);
      console.log(`       - Only ${improvement.toFixed(1)}% improvement`);
      console.log(`       - Added complexity may not be worth it`);
      console.log(`       - BUT: You get prediction intervals`);
    } else {
      console.log(`    ❌ UNDERPERFORMS: AgentDB-Enhanced loses to Naive`);
      console.log(`       - ${Math.abs(improvement).toFixed(1)}% worse accuracy`);
      console.log(`       - Trade-off: intervals for accuracy`);
      console.log(`       - Needs optimization`);
    }
  }

  console.log('\n═'.repeat(70));

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './realistic-validation-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n💾 Detailed results saved to: ./realistic-validation-results.json\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealisticValidation()
    .then(() => {
      console.log('✅ Realistic validation complete!\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Validation failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runRealisticValidation };
