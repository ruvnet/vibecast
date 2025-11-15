/**
 * Implementation Comparison Benchmark
 * Compare pure JS, WASM, and native implementations
 */

import {
  createPredictor,
  detectAvailableImplementations,
  getImplementationInfo
} from '@neural-trader/predictor';
import {
  generateTradingData,
  generatePredictions,
  Timer,
  calculateStats,
  printResults
} from './utils.js';

async function runImplementationComparison() {
  console.log('⚙️  Starting Implementation Comparison Benchmark...\n');

  // Detect available implementations
  const available = await detectAvailableImplementations();
  console.log('Available implementations:', available.join(', '));

  const results = {};

  // Test data
  const dataSize = 5000;
  const calibrationSize = 2500;

  const tradingData = generateTradingData(dataSize);
  const actuals = tradingData.map(d => d.price);
  const predictions = generatePredictions(actuals, 0.02);

  const calibrationPredictions = predictions.slice(0, calibrationSize);
  const calibrationActuals = actuals.slice(0, calibrationSize);
  const testPredictions = predictions.slice(calibrationSize);
  const testActuals = actuals.slice(calibrationSize);

  // Test each available implementation
  for (const implType of available) {
    console.log(`\n🔧 Testing ${implType} implementation...`);

    const info = getImplementationInfo(implType);
    console.log(`  ${info.description}`);
    console.log(`  Expected performance: ${info.performance}`);

    const timer = new Timer();

    // Creation time
    timer.begin();
    const { predictor, type } = await createPredictor({
      alpha: 0.1,
      implementation: implType
    });
    const createTime = timer.stop();

    // Calibration time
    timer.begin();
    await predictor.calibrate(calibrationPredictions, calibrationActuals);
    const calibrationTime = timer.stop();

    // Prediction batch
    timer.begin();
    const intervals = testPredictions.map(pred => predictor.predict(pred));
    const batchTime = timer.stop();

    // Individual predictions (measure variance)
    const individualTimes = [];
    for (let i = 0; i < Math.min(1000, testPredictions.length); i++) {
      timer.begin();
      predictor.predict(testPredictions[i]);
      individualTimes.push(timer.stop());
    }

    const indivStats = calculateStats(individualTimes);

    // Coverage metrics
    const coverage = intervals.filter((interval, i) =>
      interval.contains(testActuals[i])
    ).length / intervals.length;

    const widths = intervals.map(i => i.width());
    const widthStats = calculateStats(widths);

    results[implType] = {
      implementation: type,
      createTime,
      calibrationTime,
      calibrationThroughput: calibrationSize / (calibrationTime / 1000),
      batchSize: testPredictions.length,
      batchTime,
      batchThroughput: testPredictions.length / (batchTime / 1000),
      individualStats: indivStats,
      coverage,
      targetCoverage: 0.9,
      avgWidth: widthStats.mean,
      medianWidth: widthStats.median,
      stats: predictor.getStats()
    };

    console.log(`  ✓ Create time: ${createTime.toFixed(2)}ms`);
    console.log(`  ✓ Calibration: ${calibrationTime.toFixed(2)}ms (${(calibrationSize / (calibrationTime / 1000)).toFixed(0)} samples/sec)`);
    console.log(`  ✓ Batch predictions: ${batchTime.toFixed(2)}ms (${(testPredictions.length / (batchTime / 1000)).toFixed(0)} pred/sec)`);
    console.log(`  ✓ Individual pred: ${indivStats.mean.toFixed(4)}ms avg, ${indivStats.median.toFixed(4)}ms median`);
    console.log(`  ✓ Coverage: ${(coverage * 100).toFixed(2)}%`);
  }

  // Comparison summary
  console.log('\n📊 Implementation Comparison Summary\n');

  if (results.native && results.pure) {
    const nativeSpeed = results.native.batchThroughput;
    const pureSpeed = results.pure.batchThroughput;
    const speedup = nativeSpeed / pureSpeed;

    console.log(`Native vs Pure JS Speedup: ${speedup.toFixed(2)}x`);
  }

  if (results.wasm && results.pure) {
    const wasmSpeed = results.wasm.batchThroughput;
    const pureSpeed = results.pure.batchThroughput;
    const speedup = wasmSpeed / pureSpeed;

    console.log(`WASM vs Pure JS Speedup: ${speedup.toFixed(2)}x`);
  }

  if (results.native && results.wasm) {
    const nativeSpeed = results.native.batchThroughput;
    const wasmSpeed = results.wasm.batchThroughput;
    const speedup = nativeSpeed / wasmSpeed;

    console.log(`Native vs WASM Speedup: ${speedup.toFixed(2)}x`);
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('  • Pure JS: Best for universal compatibility, moderate performance');
  console.log('  • WASM: Good balance of performance and portability');
  console.log('  • Native: Maximum performance for server-side applications');

  printResults('Implementation Comparison Results', results);

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runImplementationComparison()
    .then(() => {
      console.log('\n✅ Implementation comparison completed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Comparison failed:', err);
      process.exit(1);
    });
}

export { runImplementationComparison };
