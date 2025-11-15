/**
 * Ensemble Predictor Test
 * Tests Phase 2 ensemble approach vs individual methods
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
  EnsemblePredictor,
  HybridEnsemblePredictor
} from './ensemble-predictor.js';

async function runEnsembleTest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       ENSEMBLE PREDICTOR TEST                                  ║');
  console.log('║   Phase 2: Combining Strengths of Multiple Methods           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {}
  };

  // Test datasets
  const testDatasets = [
    { key: 'SPY_FULL_CYCLE', name: 'SPY - Full Cycle (2020-2024)' },
    { key: 'SPY_COVID_CRASH', name: 'SPY - COVID Crash' },
    { key: 'BTC_FULL_CYCLE', name: 'BTC - Full Cycle' }
  ];

  for (const dataset of testDatasets) {
    console.log('\\n' + '═'.repeat(70));
    console.log(`📊 Testing: ${dataset.name}`);
    console.log('═'.repeat(70));

    try {
      // Generate realistic data
      const generated = REALISTIC_DATASETS[dataset.key]();
      const marketData = generated.data;

      console.log(`\\n  ${generated.name}\\n`);

      // Verify realism
      const stats = verifyRealism(marketData);
      console.log(`  Data: ${stats.dataPoints} points, Return: ${stats.totalReturn}, Vol: ${stats.annualizedVolatility}`);

      // Create validation splits
      const trainSize = Math.min(500, Math.floor(marketData.length * 0.4));
      const testSize = 50;
      const stepSize = Math.min(50, Math.floor(marketData.length / 10));

      const splits = createWalkForwardSplits(marketData, {
        initialTrainSize: trainSize,
        testSize,
        stepSize
      });

      console.log(`  Validation: ${trainSize} train, ${testSize} test, ${splits.length} splits\\n`);

      // Initialize backtesting engine
      const engine = new BacktestEngine(marketData);

      // Define predictors
      const predictors = {
        'Naive': new NaivePredictor(),
        'AdaptiveConformal': new AdaptiveConformalMethod({ targetCoverage: 0.9, gamma: 0.01 }),
        'Ensemble': new EnsemblePredictor({ targetCoverage: 0.9, gamma: 0.01 }),
        'Hybrid-Ensemble': new HybridEnsemblePredictor({ targetCoverage: 0.9, gamma: 0.01 })
      };

      console.log('  🚀 Running Backtests...\\n');

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
        rankings: report.rankings
      };

      // Print summary
      console.log('\\n  📊 Results:\\n');

      console.log('  MAPE (Lower is Better):');
      report.rankings.mape.slice(0, 4).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`  ${symbol} ${i + 1}. ${r.model}: ${r.value.toFixed(4)}%`);
      });

      if (report.rankings.coverage && report.rankings.coverage.length > 0) {
        console.log('\\n  Coverage (Target: 90%):');
        report.rankings.coverage.slice(0, 4).forEach((r, i) => {
          const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
          const diff = Math.abs(r.value - 0.9);
          console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}% (±${(diff * 100).toFixed(2)}%)`);
        });
      }

      console.log('\\n  Directional Accuracy:');
      report.rankings.directionalAccuracy.slice(0, 4).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.value * 100).toFixed(2)}%`);
      });

      // Cleanup
      for (const predictor of Object.values(predictors)) {
        if (predictor.cleanup) {
          await predictor.cleanup();
        }
      }

    } catch (error) {
      console.error(`  ❌ Error testing ${dataset.name}:`, error.message);
      results.datasets[dataset.name] = { error: error.message };
    }
  }

  // Generate overall summary
  console.log('\\n\\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  ENSEMBLE VERDICT                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const allResults = Object.entries(results.datasets).filter(([_, v]) => !v.error);

  if (allResults.length === 0) {
    console.log('❌ No successful tests completed.\\n');
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
          directionalAccuracies: []
        };
      }

      modelPerformance[modelName].mapes.push(result.metrics.mape);
      if (result.metrics.coverage !== null) {
        modelPerformance[modelName].coverages.push(result.metrics.coverage);
      }
      modelPerformance[modelName].directionalAccuracies.push(result.metrics.directionalAccuracy);
    });
  });

  // Print aggregated results
  console.log('📊 Average Performance Across All Tests:\\n');

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

  console.log('\\nAverage Coverage:');
  Object.entries(modelPerformance)
    .filter(([_, perf]) => perf.coverages.length > 0)
    .map(([model, perf]) => ({
      model,
      avgCoverage: perf.coverages.reduce((a, b) => a + b, 0) / perf.coverages.length
    }))
    .sort((a, b) => Math.abs(b.avgCoverage - 0.9) - Math.abs(a.avgCoverage - 0.9))
    .forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const diff = Math.abs(r.avgCoverage - 0.9);
      console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.avgCoverage * 100).toFixed(2)}% (±${(diff * 100).toFixed(2)}%)`);
    });

  console.log('\\nAverage Directional Accuracy:');
  Object.entries(modelPerformance)
    .map(([model, perf]) => ({
      model,
      avgDirAcc: perf.directionalAccuracies.reduce((a, b) => a + b, 0) / perf.directionalAccuracies.length
    }))
    .sort((a, b) => b.avgDirAcc - a.avgDirAcc)
    .forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(`  ${symbol} ${i + 1}. ${r.model}: ${(r.avgDirAcc * 100).toFixed(2)}%`);
    });

  // Final verdict
  console.log('\\n');
  console.log('═'.repeat(70));
  console.log('🎯 PHASE 2 VERDICT');
  console.log('═'.repeat(70));

  const ensemblePerf = modelPerformance['Ensemble'];
  const hybridPerf = modelPerformance['Hybrid-Ensemble'];
  const adaptivePerf = modelPerformance['AdaptiveConformal'];
  const naivePerf = modelPerformance['Naive'];

  if (ensemblePerf && adaptivePerf && naivePerf) {
    const ensembleAvgMAPE = ensemblePerf.mapes.reduce((a, b) => a + b, 0) / ensemblePerf.mapes.length;
    const hybridAvgMAPE = hybridPerf ? hybridPerf.mapes.reduce((a, b) => a + b, 0) / hybridPerf.mapes.length : 999;
    const adaptiveAvgMAPE = adaptivePerf.mapes.reduce((a, b) => a + b, 0) / adaptivePerf.mapes.length;
    const naiveAvgMAPE = naivePerf.mapes.reduce((a, b) => a + b, 0) / naivePerf.mapes.length;

    const bestMAPE = Math.min(ensembleAvgMAPE, hybridAvgMAPE, adaptiveAvgMAPE);
    const vsNaive = ((naiveAvgMAPE - bestMAPE) / naiveAvgMAPE * 100);
    const vsAdaptive = ((adaptiveAvgMAPE - bestMAPE) / adaptiveAvgMAPE * 100);

    console.log(`\\n📈 Ensemble Performance:\\n`);
    console.log(`  Naive:               ${naiveAvgMAPE.toFixed(4)}%`);
    console.log(`  AdaptiveConformal:   ${adaptiveAvgMAPE.toFixed(4)}%`);
    console.log(`  Ensemble:            ${ensembleAvgMAPE.toFixed(4)}%`);
    if (hybridPerf) {
      console.log(`  Hybrid-Ensemble:     ${hybridAvgMAPE.toFixed(4)}%`);
    }

    console.log(`\\n  Best Method:         ${bestMAPE === ensembleAvgMAPE ? 'Ensemble' : bestMAPE === hybridAvgMAPE ? 'Hybrid-Ensemble' : 'AdaptiveConformal'}`);
    console.log(`  vs Naive:            ${vsNaive > 0 ? '✅' : '❌'} ${vsNaive.toFixed(2)}%`);
    console.log(`  vs AdaptiveConformal: ${vsAdaptive > 0 ? '✅' : '❌'} ${vsAdaptive.toFixed(2)}%`);

    console.log(`\\n  Overall Assessment:`);

    if (bestMAPE < adaptiveAvgMAPE && bestMAPE < naiveAvgMAPE) {
      console.log(`    ✅ SUCCESS: Ensemble beats both baselines`);
      console.log(`       - Best method: ${bestMAPE === ensembleAvgMAPE ? 'Ensemble' : 'Hybrid-Ensemble'}`);
      console.log(`       - ${vsNaive.toFixed(1)}% better than Naive`);
      console.log(`       - ${vsAdaptive.toFixed(1)}% better than AdaptiveConformal`);
      console.log(`       - Ready for Phase 3 (Hyperparameter tuning)`);
    } else if (bestMAPE < naiveAvgMAPE) {
      console.log(`    ⚠️  PARTIAL: Ensemble beats Naive but not AdaptiveConformal`);
      console.log(`       - Consider using AdaptiveConformal alone`);
      console.log(`       - Or tune ensemble weights`);
    } else {
      console.log(`    ❌ FAILURE: Ensemble doesn't improve over baselines`);
      console.log(`       - Stick with AdaptiveConformal (simplest winner)`);
      console.log(`       - Consider alternative approaches`);
    }
  }

  console.log('\\n═'.repeat(70));
  console.log('');

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './ensemble-test-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Results saved to: ./ensemble-test-results.json\\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnsembleTest()
    .then(() => {
      console.log('✅ Ensemble test complete!\\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Test failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runEnsembleTest };
