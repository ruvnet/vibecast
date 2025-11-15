/**
 * Regime-Specific Optimization
 * Test optimal configurations for different market regimes
 */

import {
  REALISTIC_DATASETS,
  detectRegime
} from './realistic-market-generator.js';

import {
  createWalkForwardSplits,
  BacktestEngine
} from './backtesting-framework.js';

import {
  AdaptiveConformalMethod
} from './advanced-methods.js';

// Regime-specific configurations to test
const REGIME_CONFIGS = {
  'low_volatility': [
    { gamma: 0.005, targetCoverage: 0.90, note: 'Conservative - tight intervals' },
    { gamma: 0.01, targetCoverage: 0.85, note: 'Aggressive - tighter intervals' },
    { gamma: 0.001, targetCoverage: 0.95, note: 'Ultra-safe - wide intervals' }
  ],
  'medium_volatility': [
    { gamma: 0.01, targetCoverage: 0.90, note: 'Balanced' },
    { gamma: 0.02, targetCoverage: 0.90, note: 'Fast adaptation' },
    { gamma: 0.005, targetCoverage: 0.95, note: 'Conservative' }
  ],
  'high_volatility': [
    { gamma: 0.02, targetCoverage: 0.90, note: 'Fast adaptation' },
    { gamma: 0.05, targetCoverage: 0.90, note: 'Very fast adaptation' },
    { gamma: 0.01, targetCoverage: 0.95, note: 'Safe with wider intervals' }
  ],
  'extreme_volatility': [
    { gamma: 0.05, targetCoverage: 0.95, note: 'Rapid adaptation with safety' },
    { gamma: 0.1, targetCoverage: 0.90, note: 'Maximum adaptation speed' },
    { gamma: 0.02, targetCoverage: 0.98, note: 'Ultra-conservative' }
  ]
};

function segmentByRegime(data) {
  const segments = {
    low_volatility: [],
    medium_volatility: [],
    high_volatility: [],
    extreme_volatility: []
  };

  data.forEach((point, idx) => {
    const regime = detectRegime(data, idx);
    // Ensure it maps to our segment keys
    const regimeKey = regime.includes('volatility') ? regime : regime.replace('_vol', '_volatility');

    if (segments[regimeKey]) {
      segments[regimeKey].push({ ...point, originalIndex: idx });
    }
  });

  return segments;
}

async function testRegimeConfiguration(config, regimeData, regimeName) {
  if (regimeData.length < 100) {
    return { error: 'Insufficient data' };
  }

  const trainSize = Math.min(50, Math.floor(regimeData.length * 0.5));
  const testSize = Math.min(20, Math.floor(regimeData.length * 0.3));

  if (regimeData.length < trainSize + testSize) {
    return { error: 'Insufficient data for train/test split' };
  }

  const splits = createWalkForwardSplits(regimeData, {
    initialTrainSize: trainSize,
    testSize,
    stepSize: Math.max(10, Math.floor(testSize / 2))
  });

  if (splits.length === 0) {
    return { error: 'No valid splits' };
  }

  const engine = new BacktestEngine(regimeData);
  const predictor = new AdaptiveConformalMethod({
    targetCoverage: config.targetCoverage,
    gamma: config.gamma
  });

  try {
    const results = await engine.runBacktest(predictor, splits);
    return {
      config,
      metrics: results.metrics,
      numPredictions: results.predictions.length
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function runRegimeOptimization() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       REGIME-SPECIFIC OPTIMIZATION                             ║');
  console.log('║   Finding Optimal Configurations per Market Regime            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const results = {
    timestamp: new Date().toISOString(),
    datasets: {},
    optimalByRegime: {}
  };

  // Test datasets
  const testDatasets = [
    { key: 'SPY_FULL_CYCLE', name: 'SPY - Full Cycle' },
    { key: 'BTC_FULL_CYCLE', name: 'BTC - Full Cycle' }
  ];

  for (const dataset of testDatasets) {
    console.log('═'.repeat(70));
    console.log(`📊 Dataset: ${dataset.name}`);
    console.log('═'.repeat(70));

    const generated = REALISTIC_DATASETS[dataset.key]();
    const marketData = generated.data;

    console.log(`Total data points: ${marketData.length}\\n`);

    // Segment by regime
    const segments = segmentByRegime(marketData);

    console.log('Regime Distribution:');
    Object.entries(segments).forEach(([regime, data]) => {
      const percentage = (data.length / marketData.length * 100).toFixed(1);
      console.log(`  • ${regime}: ${data.length} points (${percentage}%)`);
    });
    console.log('');

    const datasetResults = {};

    for (const [regimeName, regimeData] of Object.entries(segments)) {
      if (regimeData.length < 100) {
        console.log(`⚠️  Skipping ${regimeName} - insufficient data (${regimeData.length} points)\\n`);
        continue;
      }

      console.log(`Testing ${regimeName}:`);

      const configs = REGIME_CONFIGS[regimeName] || REGIME_CONFIGS['medium_volatility'];
      const regimeResults = [];

      for (const config of configs) {
        process.stdout.write(`  [gamma=${config.gamma}, coverage=${config.targetCoverage}] ${config.note}... `);

        const result = await testRegimeConfiguration(config, regimeData, regimeName);

        if (result.error) {
          console.log(`ERROR: ${result.error}`);
        } else {
          regimeResults.push(result);
          const mape = result.metrics.mape.toFixed(4);
          const coverage = result.metrics.coverage ? (result.metrics.coverage * 100).toFixed(1) : 'N/A';
          console.log(`MAPE: ${mape}%, Coverage: ${coverage}%`);
        }
      }

      if (regimeResults.length > 0) {
        // Find best for this regime
        const best = regimeResults.reduce((best, curr) => {
          const bestScore = 0.5 * best.metrics.mape +
            0.3 * Math.abs(best.metrics.coverage - best.config.targetCoverage) * 100 +
            0.2 * (1 - best.metrics.directionalAccuracy) * 100;

          const currScore = 0.5 * curr.metrics.mape +
            0.3 * Math.abs(curr.metrics.coverage - curr.config.targetCoverage) * 100 +
            0.2 * (1 - curr.metrics.directionalAccuracy) * 100;

          return currScore < bestScore ? curr : best;
        });

        console.log(`  🏆 Best: gamma=${best.config.gamma}, coverage=${best.config.targetCoverage}`);
        console.log(`      MAPE: ${best.metrics.mape.toFixed(4)}%, Coverage: ${(best.metrics.coverage * 100).toFixed(2)}%\\n`);

        datasetResults[regimeName] = {
          data: regimeData.length,
          configurations: regimeResults,
          best
        };
      } else {
        console.log('  ❌ No valid results\\n');
      }
    }

    results.datasets[dataset.name] = datasetResults;
  }

  // Aggregate optimal configurations per regime
  console.log('\\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       OPTIMAL REGIME-SPECIFIC CONFIGURATIONS                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const regimeAggregates = {};

  Object.entries(results.datasets).forEach(([datasetName, dataset]) => {
    Object.entries(dataset).forEach(([regimeName, regimeData]) => {
      if (!regimeData.best) return;

      if (!regimeAggregates[regimeName]) {
        regimeAggregates[regimeName] = {
          configs: [],
          mapes: [],
          coverages: []
        };
      }

      regimeAggregates[regimeName].configs.push(regimeData.best.config);
      regimeAggregates[regimeName].mapes.push(regimeData.best.metrics.mape);
      regimeAggregates[regimeName].coverages.push(regimeData.best.metrics.coverage);
    });
  });

  Object.entries(regimeAggregates).forEach(([regimeName, aggregate]) => {
    const avgMAPE = aggregate.mapes.reduce((a, b) => a + b, 0) / aggregate.mapes.length;
    const avgCoverage = aggregate.coverages.reduce((a, b) => a + b, 0) / aggregate.coverages.length;

    // Most common configuration
    const configCounts = {};
    aggregate.configs.forEach(config => {
      const key = `${config.gamma}-${config.targetCoverage}`;
      configCounts[key] = (configCounts[key] || 0) + 1;
    });

    const mostCommon = Object.entries(configCounts)
      .sort(([, a], [, b]) => b - a)[0];
    const [gamma, targetCoverage] = mostCommon[0].split('-').map(Number);

    results.optimalByRegime[regimeName] = {
      gamma,
      targetCoverage,
      avgMAPE,
      avgCoverage,
      frequency: mostCommon[1] / aggregate.configs.length
    };

    console.log(`${regimeName.toUpperCase().replace(/_/g, ' ')}:`);
    console.log(`  gamma = ${gamma}`);
    console.log(`  targetCoverage = ${targetCoverage}`);
    console.log(`  Expected MAPE: ${avgMAPE.toFixed(4)}%`);
    console.log(`  Expected Coverage: ${(avgCoverage * 100).toFixed(2)}%`);
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('📋 USAGE RECOMMENDATIONS');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Implement Regime-Adaptive System:');
  console.log('');
  console.log('```javascript');
  console.log('import { createAdaptivePredictor } from \'@neural-trader/predictor\';');
  console.log('');
  console.log('// Detect current regime');
  console.log('const regime = detectMarketRegime(recentData);');
  console.log('');
  console.log('// Configure based on regime');
  console.log('const regimeConfigs = {');

  Object.entries(results.optimalByRegime).forEach(([regime, config]) => {
    console.log(`  '${regime}': { gamma: ${config.gamma}, targetCoverage: ${config.targetCoverage} },`);
  });

  console.log('};');
  console.log('');
  console.log('const config = regimeConfigs[regime] || regimeConfigs[\'medium_volatility\'];');
  console.log('const { predictor } = await createAdaptivePredictor(config);');
  console.log('```');
  console.log('');

  console.log('═'.repeat(70));
  console.log('');

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    './regime-optimization-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Detailed results saved to: ./regime-optimization-results.json\\n');

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRegimeOptimization()
    .then(() => {
      console.log('✅ Regime optimization complete!\\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Optimization failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runRegimeOptimization };
