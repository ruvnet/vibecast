/**
 * Basic Predictions Benchmark
 * Tests fundamental prediction operations and accuracy
 */

import {
  createPredictor,
  AbsoluteScore,
  NormalizedScore,
  detectAvailableImplementations
} from '@neural-trader/predictor';
import {
  generateTradingData,
  generatePredictions,
  Timer,
  calculateStats,
  printResults
} from './utils.js';

async function runBasicBenchmark() {
  console.log('🚀 Starting Basic Predictions Benchmark...\n');

  // Detect available implementations
  const implementations = await detectAvailableImplementations();
  console.log('Available implementations:', implementations.join(', '));

  // Generate synthetic data
  const dataSize = 1000;
  const calibrationSize = 500;
  const testSize = dataSize - calibrationSize;

  console.log(`\nGenerating ${dataSize} data points...`);
  const tradingData = generateTradingData(dataSize);
  const actuals = tradingData.map(d => d.price);
  const predictions = generatePredictions(actuals, 0.02);

  // Split data
  const calibrationPredictions = predictions.slice(0, calibrationSize);
  const calibrationActuals = actuals.slice(0, calibrationSize);
  const testPredictions = predictions.slice(calibrationSize);
  const testActuals = actuals.slice(calibrationSize);

  // Test with different alpha values
  const alphas = [0.05, 0.1, 0.2];
  const results = {};

  for (const alpha of alphas) {
    console.log(`\n📈 Testing with alpha=${alpha} (${(1-alpha)*100}% coverage)...`);

    // Create predictor
    const timer = new Timer();
    timer.begin();
    const { predictor, type } = await createPredictor({ alpha });
    const createTime = timer.stop();

    // Calibration
    timer.begin();
    await predictor.calibrate(calibrationPredictions, calibrationActuals);
    const calibrationTime = timer.stop();

    // Make predictions
    timer.begin();
    const intervals = testPredictions.map(pred => predictor.predict(pred));
    const predictionTime = timer.stop();

    // Calculate coverage and width statistics
    const coverage = intervals.filter((interval, i) =>
      interval.contains(testActuals[i])
    ).length / intervals.length;

    const widths = intervals.map(i => i.width());
    const relativeWidths = intervals.map(i => i.relativeWidth());
    const widthStats = calculateStats(widths);
    const relativeWidthStats = calculateStats(relativeWidths);

    // Store results
    results[`alpha_${alpha}`] = {
      implementation: type,
      createTime,
      calibrationTime,
      predictionTime,
      avgPredictionTime: predictionTime / testSize,
      throughput: testSize / (predictionTime / 1000),
      coverage,
      targetCoverage: 1 - alpha,
      coverageError: Math.abs(coverage - (1 - alpha)),
      widthStats,
      relativeWidthStats,
      stats: predictor.getStats()
    };

    console.log(`  Implementation: ${type}`);
    console.log(`  Coverage: ${(coverage * 100).toFixed(2)}% (target: ${((1-alpha)*100).toFixed(0)}%)`);
    console.log(`  Avg prediction time: ${(predictionTime / testSize).toFixed(4)}ms`);
    console.log(`  Throughput: ${(testSize / (predictionTime / 1000)).toFixed(0)} predictions/sec`);
    console.log(`  Avg interval width: ${widthStats.mean.toFixed(4)}`);
  }

  // Test different score functions
  console.log(`\n🔬 Testing different score functions...`);

  const scoreFunctions = {
    'Absolute': new AbsoluteScore(),
    'Normalized': new NormalizedScore(2.0)
  };

  const scoreResults = {};

  for (const [name, scoreFunc] of Object.entries(scoreFunctions)) {
    const timer = new Timer();
    const { predictor, type } = await createPredictor({
      alpha: 0.1
    }, scoreFunc);

    timer.begin();
    await predictor.calibrate(calibrationPredictions, calibrationActuals);
    const calibrationTime = timer.stop();

    timer.begin();
    const intervals = testPredictions.map(pred => predictor.predict(pred));
    const predictionTime = timer.stop();

    const coverage = intervals.filter((interval, i) =>
      interval.contains(testActuals[i])
    ).length / intervals.length;

    const widths = intervals.map(i => i.width());
    const widthStats = calculateStats(widths);

    scoreResults[name] = {
      implementation: type,
      calibrationTime,
      predictionTime,
      coverage,
      avgWidth: widthStats.mean,
      medianWidth: widthStats.median
    };

    console.log(`  ${name}: coverage=${(coverage*100).toFixed(2)}%, avg width=${widthStats.mean.toFixed(4)}`);
  }

  // Print comprehensive results
  printResults('Basic Predictions Benchmark Results', {
    'Data Size': dataSize,
    'Calibration Size': calibrationSize,
    'Test Size': testSize,
    ...results
  });

  printResults('Score Function Comparison', scoreResults);

  return { results, scoreResults };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicBenchmark()
    .then(() => {
      console.log('\n✅ Basic benchmark completed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Benchmark failed:', err);
      process.exit(1);
    });
}

export { runBasicBenchmark };
