/**
 * Stress Test Benchmark
 * Tests performance under heavy load with streaming updates
 */

import {
  createPredictor,
  createAdaptivePredictor,
  AbsoluteScore
} from '@neural-trader/predictor';
import {
  generateTradingData,
  generatePredictions,
  Timer,
  calculateStats,
  printResults
} from './utils.js';

async function runStressTest() {
  console.log('💪 Starting Stress Test Benchmark...\n');

  const results = {};

  // Test 1: Large calibration set
  console.log('📊 Test 1: Large Calibration Set Performance...');
  const sizes = [1000, 5000, 10000, 50000];
  const calibrationResults = {};

  for (const size of sizes) {
    console.log(`  Testing with ${size} calibration points...`);

    const data = generateTradingData(size);
    const actuals = data.map(d => d.price);
    const predictions = generatePredictions(actuals, 0.02);

    const timer = new Timer();
    const { predictor } = await createPredictor({ alpha: 0.1 });

    timer.begin();
    await predictor.calibrate(predictions, actuals);
    const calibrationTime = timer.stop();

    // Test prediction speed after calibration
    const testPredictions = generatePredictions(actuals.slice(0, 100), 0.02);
    timer.begin();
    testPredictions.forEach(pred => predictor.predict(pred));
    const predictionTime = timer.stop();

    calibrationResults[`size_${size}`] = {
      calibrationTime,
      avgPredictionTime: predictionTime / 100,
      throughput: 100 / (predictionTime / 1000),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };

    console.log(`    Calibration: ${calibrationTime.toFixed(2)}ms`);
    console.log(`    Prediction throughput: ${(100 / (predictionTime / 1000)).toFixed(0)} pred/sec`);
  }

  results.calibrationScaling = calibrationResults;

  // Test 2: Streaming updates
  console.log('\n📈 Test 2: Streaming Updates Performance...');
  const streamSize = 10000;
  const calibrationSize = 500;

  const streamData = generateTradingData(streamSize);
  const streamActuals = streamData.map(d => d.price);
  const streamPredictions = generatePredictions(streamActuals, 0.02);

  const { predictor: streamPredictor } = await createPredictor({
    alpha: 0.1,
    recalibrationFreq: 100
  });

  // Initial calibration
  await streamPredictor.calibrate(
    streamPredictions.slice(0, calibrationSize),
    streamActuals.slice(0, calibrationSize)
  );

  // Measure streaming updates
  const updateTimes = [];
  const timer = new Timer();

  for (let i = calibrationSize; i < streamSize; i++) {
    timer.begin();
    await streamPredictor.update(streamPredictions[i], streamActuals[i]);
    updateTimes.push(timer.stop());
  }

  const updateStats = calculateStats(updateTimes);

  results.streamingUpdates = {
    totalUpdates: updateTimes.length,
    totalTime: updateTimes.reduce((a, b) => a + b, 0),
    throughput: updateTimes.length / (updateTimes.reduce((a, b) => a + b, 0) / 1000),
    updateStats
  };

  console.log(`  Total updates: ${updateTimes.length}`);
  console.log(`  Avg update time: ${updateStats.mean.toFixed(4)}ms`);
  console.log(`  Update throughput: ${(updateTimes.length / (updateTimes.reduce((a, b) => a + b, 0) / 1000)).toFixed(0)} updates/sec`);

  // Test 3: Adaptive predictor stress test
  console.log('\n🔄 Test 3: Adaptive Predictor Performance...');

  const adaptiveData = generateTradingData(5000);
  const adaptiveActuals = adaptiveData.map(d => d.price);
  const adaptivePredictions = generatePredictions(adaptiveActuals, 0.02);

  const { predictor: adaptivePredictor } = await createAdaptivePredictor({
    targetCoverage: 0.9,
    gamma: 0.005
  });

  // Calibration
  timer.begin();
  await adaptivePredictor.calibrate(
    adaptivePredictions.slice(0, 500),
    adaptiveActuals.slice(0, 500)
  );
  const adaptiveCalibrationTime = timer.stop();

  // Streaming with adaptation
  const adaptiveTimes = [];
  const coverageHistory = [];

  for (let i = 500; i < adaptiveActuals.length; i++) {
    timer.begin();
    const interval = await adaptivePredictor.predictAndAdapt(
      adaptivePredictions[i],
      adaptiveActuals[i]
    );
    adaptiveTimes.push(timer.stop());
    coverageHistory.push(interval.contains(adaptiveActuals[i]) ? 1 : 0);
  }

  const adaptiveStats = calculateStats(adaptiveTimes);
  const adaptiveEmpiricalCoverage = coverageHistory.reduce((a, b) => a + b, 0) / coverageHistory.length;

  results.adaptivePredictor = {
    calibrationTime: adaptiveCalibrationTime,
    totalPredictions: adaptiveTimes.length,
    totalTime: adaptiveTimes.reduce((a, b) => a + b, 0),
    avgPredictionTime: adaptiveStats.mean,
    throughput: adaptiveTimes.length / (adaptiveTimes.reduce((a, b) => a + b, 0) / 1000),
    empiricalCoverage: adaptiveEmpiricalCoverage,
    targetCoverage: 0.9,
    finalAlpha: adaptivePredictor.getCurrentAlpha()
  };

  console.log(`  Calibration time: ${adaptiveCalibrationTime.toFixed(2)}ms`);
  console.log(`  Avg prediction time: ${adaptiveStats.mean.toFixed(4)}ms`);
  console.log(`  Empirical coverage: ${(adaptiveEmpiricalCoverage * 100).toFixed(2)}%`);
  console.log(`  Final alpha: ${adaptivePredictor.getCurrentAlpha().toFixed(4)}`);

  // Test 4: Concurrent predictions
  console.log('\n⚡ Test 4: Concurrent Prediction Batches...');

  const batchSizes = [10, 100, 1000, 5000];
  const concurrentResults = {};

  const { predictor: batchPredictor } = await createPredictor({ alpha: 0.1 });
  await batchPredictor.calibrate(
    streamPredictions.slice(0, 500),
    streamActuals.slice(0, 500)
  );

  for (const batchSize of batchSizes) {
    const batch = generatePredictions(
      streamActuals.slice(0, batchSize),
      0.02
    );

    timer.begin();
    const intervals = batch.map(pred => batchPredictor.predict(pred));
    const batchTime = timer.stop();

    concurrentResults[`batch_${batchSize}`] = {
      batchSize,
      totalTime: batchTime,
      avgTime: batchTime / batchSize,
      throughput: batchSize / (batchTime / 1000)
    };

    console.log(`  Batch size ${batchSize}: ${(batchSize / (batchTime / 1000)).toFixed(0)} predictions/sec`);
  }

  results.concurrentBatches = concurrentResults;

  // Memory profiling
  console.log('\n💾 Memory Usage Analysis...');
  const memoryUsage = process.memoryUsage();
  results.memoryProfile = {
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    external: (memoryUsage.external / 1024 / 1024).toFixed(2) + ' MB',
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
  };

  // Print comprehensive results
  printResults('Stress Test Results', results);

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStressTest()
    .then(() => {
      console.log('\n✅ Stress test completed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Stress test failed:', err);
      process.exit(1);
    });
}

export { runStressTest };
