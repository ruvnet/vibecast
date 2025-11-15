/**
 * Hyperparameter Optimization for AdaptiveConformal
 * Systematic exploration of optimal configurations
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
  AdaptiveConformalMethod
} from './advanced-methods.js';

// Hyperparameter grid
const HYPERPARAM_GRID = {
  gamma: [0.001, 0.005, 0.01, 0.02, 0.05],
  targetCoverage: [0.85, 0.90, 0.95]
};

async function testConfiguration(config, marketData, splits, engine) {
  const predictor = new AdaptiveConformalMethod({
    targetCoverage: config.targetCoverage,
    gamma: config.gamma
  });

  const results = await engine.runBacktest(predictor, splits);

  return {
    config,
    metrics: results.metrics,
    performance: results.performance
  };
}

async function runHyperparameterSearch() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       HYPERPARAMETER OPTIMIZATION                              ║');
  console.log('║   Finding Optimal AdaptiveConformal Configuration             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {},
    optimal: {}
  };

  // Test datasets
  const testDatasets = [
    { key: 'SPY_FULL_CYCLE', name: 'SPY - Full Cycle' },
    { key: 'SPY_COVID_CRASH', name: 'SPY - COVID Crash' },
    { key: 'BTC_FULL_CYCLE', name: 'BTC - Full Cycle' }
  ];

  // Generate all configurations
  const configurations = [];
  for (const gamma of HYPERPARAM_GRID.gamma) {
    for (const targetCoverage of HYPERPARAM_GRID.targetCoverage) {
      configurations.push({ gamma, targetCoverage });
    }
  }

  console.log(`Testing ${configurations.length} configurations across ${testDatasets.length} datasets\\n`);

  for (const dataset of testDatasets) {
    console.log('═'.repeat(70));
    console.log(`📊 Dataset: ${dataset.name}`);
    console.log('═'.repeat(70));

    const generated = REALISTIC_DATASETS[dataset.key]();
    const marketData = generated.data;

    const stats = verifyRealism(marketData);
    console.log(`Data: ${stats.dataPoints} points, Vol: ${stats.annualizedVolatility}\\n`);

    const trainSize = Math.min(500, Math.floor(marketData.length * 0.4));
    const testSize = 50;
    const stepSize = Math.min(50, Math.floor(marketData.length / 10));

    const splits = createWalkForwardSplits(marketData, {
      initialTrainSize: trainSize,
      testSize,
      stepSize
    });

    const engine = new BacktestEngine(marketData);

    const datasetResults = [];

    console.log('Testing configurations:');
    let configNum = 1;

    for (const config of configurations) {
      process.stdout.write(`  [${configNum}/${configurations.length}] gamma=${config.gamma}, coverage=${config.targetCoverage}... `);

      try {
        const result = await testConfiguration(config, marketData, splits, engine);
        datasetResults.push(result);

        // Print quick summary
        const mape = result.metrics.mape.toFixed(4);
        const coverage = result.metrics.coverage ? (result.metrics.coverage * 100).toFixed(1) : 'N/A';
        console.log(`MAPE: ${mape}%, Coverage: ${coverage}%`);
      } catch (error) {
        console.log(`ERROR: ${error.message}`);
        datasetResults.push({
          config,
          error: error.message
        });
      }

      configNum++;
    }

    // Find best configuration for this dataset
    const validResults = datasetResults.filter(r => !r.error);

    if (validResults.length === 0) {
      console.log('\\n❌ No valid results for this dataset\\n');
      continue;
    }

    // Rank by MAPE
    const rankedByMAPE = [...validResults].sort((a, b) => a.metrics.mape - b.metrics.mape);

    // Rank by coverage accuracy (closest to target)
    const rankedByCoverage = [...validResults]
      .filter(r => r.metrics.coverage !== null)
      .sort((a, b) => {
        const aError = Math.abs(a.metrics.coverage - a.config.targetCoverage);
        const bError = Math.abs(b.metrics.coverage - b.config.targetCoverage);
        return aError - bError;
      });

    // Rank by combined score (weighted)
    const rankedCombined = [...validResults]
      .filter(r => r.metrics.coverage !== null)
      .map(r => {
        const mapeScore = r.metrics.mape; // Lower is better
        const coverageError = Math.abs(r.metrics.coverage - r.config.targetCoverage);
        const dirAccScore = 1 - r.metrics.directionalAccuracy; // Convert to error (lower is better)

        // Combined score (weighted average of normalized errors)
        const combinedScore = (
          0.5 * mapeScore +                    // 50% weight on MAPE
          0.3 * (coverageError * 100) +        // 30% weight on coverage accuracy
          0.2 * (dirAccScore * 100)            // 20% weight on directional accuracy
        );

        return {
          ...r,
          combinedScore
        };
      })
      .sort((a, b) => a.combinedScore - b.combinedScore);

    console.log('\\n📊 Top 3 Configurations:\\n');

    console.log('  By MAPE:');
    rankedByMAPE.slice(0, 3).forEach((r, i) => {
      const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      console.log(`  ${symbol} gamma=${r.config.gamma}, coverage=${r.config.targetCoverage} → MAPE: ${r.metrics.mape.toFixed(4)}%`);
    });

    if (rankedByCoverage.length > 0) {
      console.log('\\n  By Coverage Accuracy:');
      rankedByCoverage.slice(0, 3).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const error = Math.abs(r.metrics.coverage - r.config.targetCoverage);
        console.log(`  ${symbol} gamma=${r.config.gamma}, coverage=${r.config.targetCoverage} → Coverage: ${(r.metrics.coverage * 100).toFixed(2)}% (±${(error * 100).toFixed(2)}%)`);
      });
    }

    if (rankedCombined.length > 0) {
      console.log('\\n  By Combined Score (MAPE + Coverage + Direction):');
      rankedCombined.slice(0, 3).forEach((r, i) => {
        const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        console.log(`  ${symbol} gamma=${r.config.gamma}, coverage=${r.config.targetCoverage} → Score: ${r.combinedScore.toFixed(4)}`);
      });
    }

    console.log('');

    // Store results
    results.datasets[dataset.name] = {
      key: dataset.key,
      stats,
      configurations: datasetResults,
      rankings: {
        byMAPE: rankedByMAPE.slice(0, 3).map(r => ({
          config: r.config,
          mape: r.metrics.mape
        })),
        byCoverage: rankedByCoverage.slice(0, 3).map(r => ({
          config: r.config,
          coverage: r.metrics.coverage,
          error: Math.abs(r.metrics.coverage - r.config.targetCoverage)
        })),
        byCombined: rankedCombined.slice(0, 3).map(r => ({
          config: r.config,
          score: r.combinedScore,
          mape: r.metrics.mape,
          coverage: r.metrics.coverage
        }))
      },
      best: rankedCombined[0]
    };
  }

  // Find overall optimal configuration
  console.log('\\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       OPTIMAL CONFIGURATION                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  // Aggregate results across datasets
  const configPerformance = {};

  Object.entries(results.datasets).forEach(([datasetName, dataset]) => {
    dataset.configurations.forEach(result => {
      if (result.error) return;

      const key = `gamma=${result.config.gamma},coverage=${result.config.targetCoverage}`;

      if (!configPerformance[key]) {
        configPerformance[key] = {
          config: result.config,
          mapes: [],
          coverages: [],
          directionalAccuracies: [],
          datasets: []
        };
      }

      configPerformance[key].mapes.push(result.metrics.mape);
      if (result.metrics.coverage !== null) {
        configPerformance[key].coverages.push(result.metrics.coverage);
      }
      configPerformance[key].directionalAccuracies.push(result.metrics.directionalAccuracy);
      configPerformance[key].datasets.push(datasetName);
    });
  });

  // Calculate average performance
  const aggregatedPerformance = Object.entries(configPerformance).map(([key, perf]) => {
    const avgMAPE = perf.mapes.reduce((a, b) => a + b, 0) / perf.mapes.length;
    const avgCoverage = perf.coverages.length > 0 ?
      perf.coverages.reduce((a, b) => a + b, 0) / perf.coverages.length : null;
    const avgDirAcc = perf.directionalAccuracies.reduce((a, b) => a + b, 0) / perf.directionalAccuracies.length;

    const avgCoverageError = avgCoverage !== null ?
      Math.abs(avgCoverage - perf.config.targetCoverage) : null;

    // Combined score
    const combinedScore = avgCoverageError !== null ?
      (0.5 * avgMAPE + 0.3 * (avgCoverageError * 100) + 0.2 * ((1 - avgDirAcc) * 100)) : avgMAPE;

    return {
      key,
      config: perf.config,
      avgMAPE,
      avgCoverage,
      avgCoverageError,
      avgDirAcc,
      combinedScore,
      numDatasets: perf.datasets.length
    };
  }).filter(p => p.numDatasets === testDatasets.length); // Only configs tested on all datasets

  // Rank by combined score
  const rankedConfigs = [...aggregatedPerformance].sort((a, b) => a.combinedScore - b.combinedScore);

  console.log('Top 5 Configurations (Across All Datasets):\\n');

  rankedConfigs.slice(0, 5).forEach((config, i) => {
    const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';

    console.log(`${symbol} ${i + 1}. gamma=${config.config.gamma}, targetCoverage=${config.config.targetCoverage}`);
    console.log(`      MAPE: ${config.avgMAPE.toFixed(4)}%`);
    if (config.avgCoverage !== null) {
      console.log(`      Coverage: ${(config.avgCoverage * 100).toFixed(2)}% (±${(config.avgCoverageError * 100).toFixed(2)}%)`);
    }
    console.log(`      Dir. Accuracy: ${(config.avgDirAcc * 100).toFixed(2)}%`);
    console.log(`      Combined Score: ${config.combinedScore.toFixed(4)}`);
    console.log('');
  });

  // Store optimal configuration
  results.optimal = {
    overall: rankedConfigs[0],
    byDataset: Object.entries(results.datasets).reduce((acc, [name, dataset]) => {
      acc[name] = dataset.best;
      return acc;
    }, {})
  };

  console.log('═'.repeat(70));
  console.log('🎯 RECOMMENDED CONFIGURATION');
  console.log('═'.repeat(70));
  console.log('');

  const optimal = rankedConfigs[0];

  console.log('For General Use:');
  console.log(`  gamma = ${optimal.config.gamma}`);
  console.log(`  targetCoverage = ${optimal.config.targetCoverage}`);
  console.log('');
  console.log('Expected Performance:');
  console.log(`  • MAPE: ${optimal.avgMAPE.toFixed(4)}%`);
  if (optimal.avgCoverage !== null) {
    console.log(`  • Coverage: ${(optimal.avgCoverage * 100).toFixed(2)}%`);
  }
  console.log(`  • Directional Accuracy: ${(optimal.avgDirAcc * 100).toFixed(2)}%`);
  console.log('');

  console.log('Usage:');
  console.log('  ```javascript');
  console.log('  import { createAdaptivePredictor } from \'@neural-trader/predictor\';');
  console.log('');
  console.log('  const { predictor } = await createAdaptivePredictor({');
  console.log(`    targetCoverage: ${optimal.config.targetCoverage},`);
  console.log(`    gamma: ${optimal.config.gamma}`);
  console.log('  });');
  console.log('  ```');
  console.log('');

  console.log('═'.repeat(70));
  console.log('');

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './hyperparam-optimization-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Detailed results saved to: ./hyperparam-optimization-results.json\\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHyperparameterSearch()
    .then(() => {
      console.log('✅ Hyperparameter optimization complete!\\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Optimization failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runHyperparameterSearch };
