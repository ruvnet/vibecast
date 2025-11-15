/**
 * Core Benchmark Runner
 * Executes core predictor benchmarks (without AgentDB)
 */

import { runBasicBenchmark } from './basic-predictions.js';
import { runStressTest } from './stress-test.js';
import { runImplementationComparison } from './implementation-comparison.js';
import { formatTime } from './utils.js';
import os from 'os';

async function runCoreBenchmarks() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  @neural-trader/predictor Core Benchmark Suite              ║');
  console.log('║  Testing conformal prediction performance and accuracy      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const results = {
    metadata: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length
    },
    benchmarks: {}
  };

  try {
    // Run Basic Predictions Benchmark
    console.log('\n' + '═'.repeat(70));
    console.log('1️⃣  BASIC PREDICTIONS BENCHMARK');
    console.log('═'.repeat(70));
    const basicStart = Date.now();
    results.benchmarks.basic = await runBasicBenchmark();
    results.benchmarks.basic._duration = Date.now() - basicStart;

    // Run Implementation Comparison
    console.log('\n' + '═'.repeat(70));
    console.log('2️⃣  IMPLEMENTATION COMPARISON');
    console.log('═'.repeat(70));
    const implStart = Date.now();
    results.benchmarks.implementation = await runImplementationComparison();
    results.benchmarks.implementation._duration = Date.now() - implStart;

    // Run Stress Test
    console.log('\n' + '═'.repeat(70));
    console.log('3️⃣  STRESS TEST BENCHMARK');
    console.log('═'.repeat(70));
    const stressStart = Date.now();
    results.benchmarks.stress = await runStressTest();
    results.benchmarks.stress._duration = Date.now() - stressStart;

    // Generate summary report
    const totalTime = Date.now() - startTime;

    console.log('\n\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    BENCHMARK SUMMARY                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📋 System Information:');
    console.log(`   Node Version: ${results.metadata.nodeVersion}`);
    console.log(`   Platform: ${results.metadata.platform}`);
    console.log(`   Architecture: ${results.metadata.arch}`);
    console.log(`   CPUs: ${results.metadata.cpus}`);

    console.log('\n⏱️  Execution Times:');
    console.log(`   Total Time: ${formatTime(totalTime)}`);
    console.log(`   Basic Predictions: ${formatTime(results.benchmarks.basic._duration)}`);
    console.log(`   Implementation Comparison: ${formatTime(results.benchmarks.implementation._duration)}`);
    console.log(`   Stress Test: ${formatTime(results.benchmarks.stress._duration)}`);

    console.log('\n🎯 Key Performance Metrics:');

    // Extract key metrics from basic benchmark
    const basicResults = results.benchmarks.basic.results;
    if (basicResults && basicResults.alpha_0_1) {
      const alpha01 = basicResults.alpha_0_1;
      console.log(`\n  Basic Predictions (90% coverage target):`);
      console.log(`   • Implementation: ${alpha01.implementation}`);
      console.log(`   • Achieved Coverage: ${(alpha01.coverage * 100).toFixed(2)}%`);
      console.log(`   • Coverage Error: ${(alpha01.coverageError * 100).toFixed(2)}%`);
      console.log(`   • Prediction Throughput: ${alpha01.throughput.toFixed(0)} predictions/sec`);
      console.log(`   • Avg Prediction Time: ${formatTime(alpha01.avgPredictionTime)}`);
      console.log(`   • Avg Interval Width: ${alpha01.widthStats.mean.toFixed(4)}`);
      console.log(`   • Median Interval Width: ${alpha01.widthStats.median.toFixed(4)}`);
    }

    // Extract implementation comparison
    const implResults = results.benchmarks.implementation;
    if (implResults) {
      console.log(`\n  Implementation Performance:`);
      Object.entries(implResults).forEach(([impl, data]) => {
        if (impl.startsWith('_')) return;
        console.log(`   • ${impl}: ${data.batchThroughput?.toFixed(0)} pred/sec`);
      });
    }

    // Extract key metrics from stress test
    const stressResults = results.benchmarks.stress;
    if (stressResults) {
      console.log(`\n  Stress Test Results:`);

      if (stressResults.calibrationScaling) {
        const sizes = Object.keys(stressResults.calibrationScaling).map(k => k.split('_')[1]);
        const largest = stressResults.calibrationScaling[`size_${sizes[sizes.length - 1]}`];
        console.log(`   • Calibration (${sizes[sizes.length - 1]} samples): ${formatTime(largest.calibrationTime)}`);
      }

      if (stressResults.streamingUpdates) {
        console.log(`   • Streaming Update Throughput: ${stressResults.streamingUpdates.throughput.toFixed(0)} updates/sec`);
        console.log(`   • Avg Update Time: ${formatTime(stressResults.streamingUpdates.updateStats.mean)}`);
      }

      if (stressResults.adaptivePredictor) {
        const adaptive = stressResults.adaptivePredictor;
        console.log(`   • Adaptive Predictor Throughput: ${adaptive.throughput?.toFixed(0) || 'N/A'} pred/sec`);
        console.log(`   • Adaptive Coverage Achieved: ${((adaptive.empiricalCoverage || 0) * 100).toFixed(2)}%`);
        if (adaptive.initialAlpha !== undefined && adaptive.finalAlpha !== undefined) {
          console.log(`   • Alpha Adaptation: ${adaptive.initialAlpha.toFixed(4)} → ${adaptive.finalAlpha.toFixed(4)}`);
        }
      }
    }

    console.log('\n💾 Memory Usage:');
    const memory = process.memoryUsage();
    console.log(`   • Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n📊 Use Case Suitability Analysis:');

    // Determine suitability based on performance
    const throughput = basicResults?.alpha_0_1?.throughput || 0;
    const updateThroughput = stressResults?.streamingUpdates?.throughput || 0;
    const coverage = basicResults?.alpha_0_1?.coverage || 0;
    const coverageError = Math.abs(coverage - 0.9);

    console.log(`\n  High-Frequency Trading:`);
    console.log(`   ${throughput > 1000 ? '✅' : '⚠️'} ${throughput > 1000 ? 'Excellent' : 'Moderate'} (${throughput.toFixed(0)} pred/sec)`);

    console.log(`\n  Real-Time Risk Management:`);
    console.log(`   ${basicResults?.alpha_0_1?.avgPredictionTime < 1 ? '✅' : '⚠️'} ${basicResults?.alpha_0_1?.avgPredictionTime < 1 ? 'Excellent' : 'Good'} (${formatTime(basicResults?.alpha_0_1?.avgPredictionTime || 0)} latency)`);

    console.log(`\n  Streaming Data Processing:`);
    console.log(`   ${updateThroughput > 500 ? '✅' : '⚠️'} ${updateThroughput > 500 ? 'Excellent' : 'Good'} (${updateThroughput.toFixed(0)} updates/sec)`);

    console.log(`\n  Coverage Accuracy:`);
    console.log(`   ${coverageError < 0.02 ? '✅' : coverageError < 0.05 ? '⚠️' : '❌'} ${coverageError < 0.02 ? 'Excellent' : coverageError < 0.05 ? 'Good' : 'Needs improvement'} (${(coverageError * 100).toFixed(2)}% error)`);

    console.log(`\n  Adaptive Learning:`);
    const adaptiveError = Math.abs((stressResults?.adaptivePredictor?.empiricalCoverage || 0) - 0.9);
    console.log(`   ${adaptiveError < 0.02 ? '✅' : '⚠️'} ${adaptiveError < 0.02 ? 'Excellent' : 'Good'} (${(adaptiveError * 100).toFixed(2)}% error from target)`);

    console.log('\n🔍 Recommendations:');
    console.log('\n  Implementation Selection:');
    if (implResults?.native) {
      console.log('   ✓ Use native implementation for maximum performance on servers');
    }
    if (implResults?.wasm) {
      console.log('   ✓ Use WASM for good performance with broad compatibility');
    }
    console.log('   ✓ Pure JS available as universal fallback');

    console.log('\n  Configuration:');
    console.log('   • Enable streaming updates for real-time applications');
    console.log('   • Use adaptive predictor for non-stationary markets');
    console.log('   • Set appropriate alpha based on risk tolerance');
    console.log('   • Monitor empirical coverage to validate prediction quality');

    console.log('\n  Performance Optimization:');
    console.log('   • Batch predictions when possible for better throughput');
    console.log('   • Use appropriate calibration set size (500-2000 samples)');
    console.log('   • Consider recalibration frequency based on data drift');

    // Save results to file
    const fs = await import('fs/promises');
    const resultsPath = './benchmark-results.json';
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ ALL BENCHMARKS COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(70) + '\n');

    return results;

  } catch (error) {
    console.error('\n❌ Benchmark suite failed:', error);
    console.error(error.stack);
    throw error;
  }
}

// Run benchmarks
if (import.meta.url === `file://${process.argv[1]}`) {
  runCoreBenchmarks()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { runCoreBenchmarks };
