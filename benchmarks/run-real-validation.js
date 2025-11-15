/**
 * Real Market Data Validation
 * Proves the system works (or doesn't) on actual market data
 */

import {
  fetchYahooFinanceData,
  fetchMultipleAssets,
  TEST_PERIODS,
  calculateDatasetStats,
  formatForBacktesting
} from './real-data-fetcher.js';

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

async function runRealDataValidation() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          REAL MARKET DATA VALIDATION                          ║');
  console.log('║     No Synthetic Data - Only Real Market Prices               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {},
    summary: {}
  };

  // Test configurations
  const testConfigs = [
    {
      name: 'SPY - Full Cycle',
      symbol: 'SPY',
      period: TEST_PERIODS.FULL_CYCLE
    },
    {
      name: 'SPY - COVID Crash',
      symbol: 'SPY',
      period: TEST_PERIODS.COVID_CRASH
    },
    {
      name: 'BTC - Crypto Winter',
      symbol: 'BTC-USD',
      period: TEST_PERIODS.CRYPTO_WINTER
    }
  ];

  for (const config of testConfigs) {
    console.log('\n' + '═'.repeat(70));
    console.log(`📊 Testing: ${config.name}`);
    console.log('═'.repeat(70));

    try {
      // Fetch real data
      const rawData = await fetchYahooFinanceData(
        config.symbol,
        config.period.start,
        config.period.end,
        '1d'
      );

      if (!rawData || rawData.length < 100) {
        console.log('  ⚠️  Insufficient data, skipping...');
        continue;
      }

      // Calculate dataset statistics
      const stats = calculateDatasetStats(rawData);
      console.log(`\n  Dataset Statistics:`);
      console.log(`  • Data Points: ${stats.dataPoints}`);
      console.log(`  • Price Range: $${stats.minPrice.toFixed(2)} - $${stats.maxPrice.toFixed(2)}`);
      console.log(`  • Total Return: ${stats.priceChange.toFixed(2)}%`);
      console.log(`  • Annualized Volatility: ${stats.volatility.toFixed(2)}%`);
      console.log(`  • Regimes: ${JSON.stringify(stats.regimes)}`);

      // Format for backtesting
      const marketData = formatForBacktesting(rawData);

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

      // Define predictors (smaller set for speed)
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
      results.datasets[config.name] = {
        symbol: config.symbol,
        period: config.period,
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

      // Print summary for this dataset
      console.log('\n  📊 Results Summary:\n');

      console.log('  Best MAPE (Lower is Better):');
      report.rankings.mape.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i + 1}. ${r.model}: ${r.value.toFixed(4)}%`);
      });

      if (report.rankings.coverage && report.rankings.coverage.length > 0) {
        console.log('\n  Best Coverage:');
        report.rankings.coverage.slice(0, 3).forEach((r, i) => {
          console.log(`    ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}%`);
        });
      }

      console.log('\n  Best Directional Accuracy:');
      report.rankings.directionalAccuracy.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}%`);
      });

      // Statistical significance
      const naiveErrors = testResults['Naive'].predictions.map(p => p.relativeError);
      const agentDBErrors = testResults['AgentDB-Enhanced'].predictions.map(p => p.relativeError);
      const tTest = pairedTTest(naiveErrors, agentDBErrors);

      console.log(`\n  Statistical Test (AgentDB vs Naive):`);
      console.log(`    t-statistic: ${tTest.tStatistic.toFixed(4)}`);
      console.log(`    p-value: ${tTest.pValue.toFixed(6)}`);
      console.log(`    Significant: ${tTest.significant ? '✅ YES' : '❌ NO'}`);

      // Cleanup
      if (predictors['AgentDB-Enhanced'].cleanup) {
        await predictors['AgentDB-Enhanced'].cleanup();
      }

    } catch (error) {
      console.error(`  ❌ Error testing ${config.name}:`, error.message);
      results.datasets[config.name] = { error: error.message };
    }

    // Rate limiting between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate overall summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  VALIDATION SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const allResults = Object.entries(results.datasets).filter(([_, v]) => !v.error);

  if (allResults.length === 0) {
    console.log('❌ No successful tests completed.\n');
    return results;
  }

  console.log('📊 Performance Across All Real Datasets:\n');

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
  console.log('Average MAPE Across All Tests:');
  Object.entries(modelPerformance)
    .map(([model, perf]) => ({
      model,
      avgMAPE: perf.mapes.reduce((a, b) => a + b, 0) / perf.mapes.length
    }))
    .sort((a, b) => a.avgMAPE - b.avgMAPE)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.model}: ${r.avgMAPE.toFixed(4)}%`);
    });

  console.log('\nAverage Coverage Across All Tests:');
  Object.entries(modelPerformance)
    .filter(([_, perf]) => perf.coverages.length > 0)
    .map(([model, perf]) => ({
      model,
      avgCoverage: perf.coverages.reduce((a, b) => a + b, 0) / perf.coverages.length
    }))
    .sort((a, b) => b.avgCoverage - a.avgCoverage)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.model}: ${(r.avgCoverage * 100).toFixed(2)}%`);
    });

  console.log('\nAverage Directional Accuracy:');
  Object.entries(modelPerformance)
    .map(([model, perf]) => ({
      model,
      avgDirAcc: perf.directionalAccuracies.reduce((a, b) => a + b, 0) / perf.directionalAccuracies.length
    }))
    .sort((a, b) => b.avgDirAcc - a.avgDirAcc)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.model}: ${(r.avgDirAcc * 100).toFixed(2)}%`);
    });

  // The HONEST verdict
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('🎯 THE HONEST VERDICT');
  console.log('═'.repeat(70));

  const agentDBPerf = modelPerformance['AgentDB-Enhanced'];
  const naivePerf = modelPerformance['Naive'];

  if (agentDBPerf && naivePerf) {
    const agentDBAvgMAPE = agentDBPerf.mapes.reduce((a, b) => a + b, 0) / agentDBPerf.mapes.length;
    const naiveAvgMAPE = naivePerf.mapes.reduce((a, b) => a + b, 0) / naivePerf.mapes.length;

    const improvement = ((naiveAvgMAPE - agentDBAvgMAPE) / naiveAvgMAPE * 100);

    console.log(`\nAgentDB-Enhanced vs Naive on REAL data:`);
    console.log(`  Naive MAPE:          ${naiveAvgMAPE.toFixed(4)}%`);
    console.log(`  AgentDB MAPE:        ${agentDBAvgMAPE.toFixed(4)}%`);
    console.log(`  Improvement:         ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`);

    if (improvement > 10) {
      console.log(`\n  ✅ SIGNIFICANT IMPROVEMENT - System works on real data!`);
    } else if (improvement > 0) {
      console.log(`\n  ⚠️  MARGINAL IMPROVEMENT - Benefits exist but modest`);
    } else {
      console.log(`\n  ❌ NO IMPROVEMENT - System underperforms on real data`);
    }

    if (agentDBPerf.coverages.length > 0) {
      const avgCoverage = agentDBPerf.coverages.reduce((a, b) => a + b, 0) / agentDBPerf.coverages.length;
      console.log(`\n  Prediction Interval Coverage: ${(avgCoverage * 100).toFixed(2)}%`);
      console.log(`  Target: 90%`);
      if (Math.abs(avgCoverage - 0.9) < 0.05) {
        console.log(`  ✅ Coverage guarantee holds on real data!`);
      } else {
        console.log(`  ⚠️  Coverage deviates from target`);
      }
    }
  }

  console.log('\n═'.repeat(70));

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './real-data-validation-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n💾 Detailed results saved to: ./real-data-validation-results.json\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealDataValidation()
    .then(() => {
      console.log('✅ Real data validation complete!\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Validation failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runRealDataValidation };
