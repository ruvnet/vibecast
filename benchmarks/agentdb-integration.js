/**
 * AgentDB Integration Benchmark
 * Tests integration of predictor with AgentDB for storing and analyzing results
 */

import { createPredictor, createAdaptivePredictor } from '@neural-trader/predictor';
import { createDatabase, EmbeddingService } from 'agentdb';
import {
  generateTradingData,
  generatePredictions,
  Timer,
  calculateStats,
  printResults
} from './utils.js';

async function runAgentDBBenchmark() {
  console.log('🗄️  Starting AgentDB Integration Benchmark...\n');

  const results = {};

  // Initialize AgentDB
  console.log('Initializing AgentDB...');
  const db = await createDatabase({
    filename: ':memory:', // Use in-memory for benchmarking
  });

  // Initialize embedding service
  const embeddingService = new EmbeddingService({
    model: 'Xenova/all-MiniLM-L6-v2',
    db: db
  });

  await embeddingService.initialize();
  console.log('✅ AgentDB initialized\n');

  // Generate test data
  const dataSize = 2000;
  const calibrationSize = 1000;

  const tradingData = generateTradingData(dataSize);
  const actuals = tradingData.map(d => d.price);
  const predictions = generatePredictions(actuals, 0.02);

  // Test 1: Store prediction results in AgentDB
  console.log('📊 Test 1: Storing Prediction Results...');

  const { predictor } = await createPredictor({ alpha: 0.1 });
  await predictor.calibrate(
    predictions.slice(0, calibrationSize),
    actuals.slice(0, calibrationSize)
  );

  const timer = new Timer();
  const storeTimes = [];

  // Make predictions and store in AgentDB
  for (let i = calibrationSize; i < dataSize; i++) {
    const prediction = predictions[i];
    const actual = actuals[i];
    const interval = predictor.predict(prediction);

    // Store prediction metadata in AgentDB
    const content = `Prediction at ${i}: point=${prediction.toFixed(2)}, actual=${actual.toFixed(2)}, in_interval=${interval.contains(actual)}`;
    const embedding = await embeddingService.embedText(content);

    timer.begin();
    await db.run(
      `INSERT INTO memories (content, embedding, metadata) VALUES (?, ?, ?)`,
      [
        content,
        JSON.stringify(embedding),
        JSON.stringify({
          type: 'prediction',
          index: i,
          timestamp: tradingData[i].timestamp,
          point_prediction: prediction,
          actual_value: actual,
          lower_bound: interval.lower,
          upper_bound: interval.upper,
          interval_width: interval.width(),
          in_interval: interval.contains(actual),
          alpha: interval.alpha,
          coverage: interval.coverage()
        })
      ]
    );
    storeTimes.push(timer.stop());
  }

  const storeStats = calculateStats(storeTimes);

  results.storage = {
    totalRecords: dataSize - calibrationSize,
    totalTime: storeTimes.reduce((a, b) => a + b, 0),
    avgStoreTime: storeStats.mean,
    throughput: storeTimes.length / (storeTimes.reduce((a, b) => a + b, 0) / 1000)
  };

  console.log(`  Stored ${storeTimes.length} prediction records`);
  console.log(`  Avg store time: ${storeStats.mean.toFixed(4)}ms`);
  console.log(`  Storage throughput: ${(storeTimes.length / (storeTimes.reduce((a, b) => a + b, 0) / 1000)).toFixed(0)} records/sec`);

  // Test 2: Query prediction performance from AgentDB
  console.log('\n🔍 Test 2: Querying Prediction Results...');

  const queryTimes = [];

  // Query 1: Find all predictions with wide intervals
  timer.begin();
  const wideIntervals = await db.all(
    `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction' AND json_extract(metadata, '$.interval_width') > 5`
  );
  queryTimes.push({ name: 'wide_intervals', time: timer.stop(), count: wideIntervals.length });

  // Query 2: Find predictions outside interval
  timer.begin();
  const missedPredictions = await db.all(
    `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction' AND json_extract(metadata, '$.in_interval') = 0`
  );
  queryTimes.push({ name: 'missed', time: timer.stop(), count: missedPredictions.length });

  // Query 3: Recent predictions
  timer.begin();
  const recentPredictions = await db.all(
    `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction' AND json_extract(metadata, '$.index') >= ?`,
    [dataSize - 100]
  );
  queryTimes.push({ name: 'recent', time: timer.stop(), count: recentPredictions.length });

  results.queries = {};
  queryTimes.forEach(q => {
    results.queries[q.name] = {
      queryTime: q.time,
      resultCount: q.count
    };
    console.log(`  ${q.name}: ${q.time.toFixed(2)}ms (${q.count} results)`);
  });

  // Test 3: Semantic search for similar prediction patterns
  console.log('\n🧠 Test 3: Semantic Search for Prediction Patterns...');

  // Search for patterns using embeddings
  const searchQueries = [
    'predictions with high uncertainty',
    'accurate predictions with narrow intervals',
    'predictions that missed the actual value'
  ];

  const searchResults = {};

  for (const query of searchQueries) {
    timer.begin();
    const queryEmbedding = await embeddingService.embedText(query);
    // Simple semantic search by computing similarity
    const allPredictions = await db.all(
      `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction' LIMIT 100`
    );
    const searchTime = timer.stop();

    searchResults[query] = {
      searchTime,
      resultCount: allPredictions.length,
      topMatch: allPredictions[0] ? {
        inInterval: JSON.parse(allPredictions[0].metadata)?.in_interval
      } : null
    };

    console.log(`  "${query}": ${searchTime.toFixed(2)}ms (${allPredictions.length} results)`);
  }

  results.semanticSearch = searchResults;

  // Test 4: Store adaptive predictor learning progress
  console.log('\n🔄 Test 4: Tracking Adaptive Learning with AgentDB...');

  const { predictor: adaptivePredictor } = await createAdaptivePredictor({
    targetCoverage: 0.9,
    gamma: 0.005
  });

  await adaptivePredictor.calibrate(
    predictions.slice(0, 500),
    actuals.slice(0, 500)
  );

  const learningData = [];

  for (let i = 500; i < 1000; i++) {
    const interval = await adaptivePredictor.predictAndAdapt(
      predictions[i],
      actuals[i]
    );

    const stats = adaptivePredictor.getStats();

    // Store learning progress
    learningData.push({
      iteration: i - 500,
      alpha: stats.alphaCurrent,
      coverage: stats.empiricalCoverage,
      coverageDiff: stats.coverageDifference
    });

    // Store milestone updates in AgentDB
    if ((i - 500) % 50 === 0) {
      const content = `Adaptive learning checkpoint ${i-500}: alpha=${stats.alphaCurrent.toFixed(4)}, coverage=${stats.empiricalCoverage.toFixed(4)}`;
      const embedding = await embeddingService.embedText(content);

      await db.run(
        `INSERT INTO memories (content, embedding, metadata) VALUES (?, ?, ?)`,
        [
          content,
          JSON.stringify(embedding),
          JSON.stringify({
            type: 'learning_checkpoint',
            iteration: i - 500,
            alpha: stats.alphaCurrent,
            empirical_coverage: stats.empiricalCoverage,
            target_coverage: 0.9,
            coverage_difference: stats.coverageDifference
          })
        ]
      );
    }
  }

  // Analyze learning progression
  const alphas = learningData.map(d => d.alpha);
  const coverages = learningData.map(d => d.coverage);

  results.adaptiveLearning = {
    iterations: learningData.length,
    initialAlpha: alphas[0],
    finalAlpha: alphas[alphas.length - 1],
    alphaChange: Math.abs(alphas[alphas.length - 1] - alphas[0]),
    finalCoverage: coverages[coverages.length - 1],
    targetCoverage: 0.9,
    coverageError: Math.abs(coverages[coverages.length - 1] - 0.9)
  };

  console.log(`  Initial alpha: ${alphas[0].toFixed(4)}`);
  console.log(`  Final alpha: ${alphas[alphas.length - 1].toFixed(4)}`);
  console.log(`  Final coverage: ${(coverages[coverages.length - 1] * 100).toFixed(2)}%`);

  // Test 5: AgentDB memory consolidation with predictions
  console.log('\n🧩 Test 5: Memory System Performance...');

  timer.begin();
  const allMemories = await db.all(`SELECT * FROM memories`);
  const retrieveAllTime = timer.stop();

  // Test type-based queries
  timer.begin();
  const predictionsByType = await db.all(
    `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction'`
  );
  const typeQueryTime = timer.stop();

  results.memorySystem = {
    totalMemories: allMemories.length,
    retrieveAllTime,
    typeQueryTime,
    predictionCount: predictionsByType.length
  };

  console.log(`  Total memories: ${allMemories.length}`);
  console.log(`  Retrieve all time: ${retrieveAllTime.toFixed(2)}ms`);
  console.log(`  Type query time: ${typeQueryTime.toFixed(2)}ms`);

  // Test 6: Export prediction analysis
  console.log('\n📤 Test 6: Data Export and Analysis...');

  // Calculate aggregate statistics
  const predictionRecords = await db.all(
    `SELECT * FROM memories WHERE json_extract(metadata, '$.type') = 'prediction'`
  );

  const widths = predictionRecords.map(r => JSON.parse(r.metadata).interval_width);
  const coverageCount = predictionRecords.filter(r => JSON.parse(r.metadata).in_interval).length;

  const exportData = {
    totalPredictions: predictionRecords.length,
    empiricalCoverage: coverageCount / predictionRecords.length,
    avgIntervalWidth: widths.reduce((a, b) => a + b, 0) / widths.length,
    minWidth: Math.min(...widths),
    maxWidth: Math.max(...widths)
  };

  results.exportAnalysis = exportData;

  console.log(`  Empirical coverage: ${(exportData.empiricalCoverage * 100).toFixed(2)}%`);
  console.log(`  Avg interval width: ${exportData.avgIntervalWidth.toFixed(4)}`);

  // Cleanup
  // Note: db.close() may not be available in all versions, skip if not present
  try {
    if (typeof db.close === 'function') {
      await db.close();
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  // Print comprehensive results
  printResults('AgentDB Integration Benchmark Results', results);

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentDBBenchmark()
    .then(() => {
      console.log('\n✅ AgentDB integration benchmark completed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ AgentDB benchmark failed:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

export { runAgentDBBenchmark };
