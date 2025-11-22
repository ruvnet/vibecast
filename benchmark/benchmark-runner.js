/**
 * Main Benchmark Runner
 * Executes both traditional and swarm approaches and compares results
 */

const fs = require('fs').promises;
const path = require('path');
const SequentialExecutor = require('./traditional/sequential-executor');
const ConcurrentExecutor = require('./swarm/concurrent-executor');

class BenchmarkRunner {
  constructor(config) {
    this.config = config;
    this.results = {
      timestamp: new Date().toISOString(),
      scenarios: []
    };
  }

  async runAllBenchmarks() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     CODING METHODOLOGY BENCHMARK COMPARISON                   ║');
    console.log('║     Traditional Sequential vs Swarm Concurrent                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    for (const scenario of this.config.scenarios) {
      console.log(`\n${'━'.repeat(70)}`);
      console.log(`   SCENARIO: ${scenario.name.toUpperCase()}`);
      console.log(`   Complexity: ${scenario.complexity} | Tasks: ${scenario.tasks.length}`);
      console.log(`${'━'.repeat(70)}\n`);

      const scenarioResults = await this.runScenarioBenchmark(scenario);
      this.results.scenarios.push(scenarioResults);

      // Print comparison for this scenario
      this.printScenarioComparison(scenarioResults);
    }

    // Print overall summary
    this.printOverallSummary();

    // Save results
    await this.saveResults();

    return this.results;
  }

  async runScenarioBenchmark(scenario) {
    const scenarioResult = {
      scenario: scenario.name,
      id: scenario.id,
      complexity: scenario.complexity,
      taskCount: scenario.tasks.length,
      traditional: null,
      swarm: null,
      comparison: null
    };

    // Run Traditional Sequential
    console.log('\n📍 Phase 1: Traditional Sequential Approach\n');
    const traditionalExecutor = new SequentialExecutor(scenario);
    const traditionalResult = await traditionalExecutor.execute();
    scenarioResult.traditional = traditionalResult;

    // Wait a bit between runs
    await this.sleep(2000);

    // Run Swarm Concurrent
    console.log('\n\n📍 Phase 2: Swarm Concurrent Approach\n');
    const swarmExecutor = new ConcurrentExecutor(scenario, {
      agentCount: 4,
      queenEnabled: true,
      maxConcurrentTasks: 6,
      reasoningBankEnabled: true
    });
    const swarmResult = await swarmExecutor.execute();
    scenarioResult.swarm = swarmResult;

    // Calculate comparison metrics
    scenarioResult.comparison = this.compareResults(traditionalResult, swarmResult);

    return scenarioResult;
  }

  compareResults(traditional, swarm) {
    const speedImprovement = ((traditional.totalDuration - swarm.totalDuration) / traditional.totalDuration * 100).toFixed(2);
    const throughputImprovement = ((swarm.throughput - traditional.throughput) / traditional.throughput * 100).toFixed(2);

    return {
      speedImprovement: `${speedImprovement}%`,
      speedImprovementValue: parseFloat(speedImprovement),
      throughputImprovement: `${throughputImprovement}%`,
      throughputImprovementValue: parseFloat(throughputImprovement),
      timeSaved: `${((traditional.totalDuration - swarm.totalDuration) / 1000).toFixed(2)}s`,
      timeSavedMs: traditional.totalDuration - swarm.totalDuration,
      memoryDifference: `${(swarm.peakMemoryMB - traditional.peakMemoryMB).toFixed(2)}MB`,
      memoryDifferenceValue: parseFloat(swarm.peakMemoryMB) - parseFloat(traditional.peakMemoryMB),
      concurrencyAdvantage: swarm.maxConcurrency,
      winner: traditional.totalDuration < swarm.totalDuration ? 'traditional' : 'swarm'
    };
  }

  printScenarioComparison(scenarioResult) {
    const { traditional, swarm, comparison } = scenarioResult;

    console.log('\n' + '═'.repeat(70));
    console.log(`  SCENARIO COMPARISON: ${scenarioResult.scenario}`);
    console.log('═'.repeat(70));

    console.log('\n📊 Performance Metrics:\n');

    console.log('┌─────────────────────────┬──────────────────┬──────────────────┐');
    console.log('│ Metric                  │ Traditional      │ Swarm            │');
    console.log('├─────────────────────────┼──────────────────┼──────────────────┤');
    console.log(`│ Total Time              │ ${this.pad(traditional.totalDurationSec + 's', 16)} │ ${this.pad(swarm.totalDurationSec + 's', 16)} │`);
    console.log(`│ Throughput              │ ${this.pad(traditional.throughput + ' t/s', 16)} │ ${this.pad(swarm.throughput + ' t/s', 16)} │`);
    console.log(`│ Avg Task Duration       │ ${this.pad(traditional.avgTaskDuration + 'ms', 16)} │ ${this.pad(swarm.avgTaskDuration + 'ms', 16)} │`);
    console.log(`│ Max Concurrency         │ ${this.pad(traditional.maxConcurrency.toString(), 16)} │ ${this.pad(swarm.maxConcurrency.toString(), 16)} │`);
    console.log(`│ Memory Used             │ ${this.pad(traditional.memoryUsedMB + 'MB', 16)} │ ${this.pad(swarm.memoryUsedMB + 'MB', 16)} │`);
    console.log(`│ Peak Memory             │ ${this.pad(traditional.peakMemoryMB + 'MB', 16)} │ ${this.pad(swarm.peakMemoryMB + 'MB', 16)} │`);
    console.log(`│ Error Rate              │ ${this.pad(traditional.errorRate, 16)} │ ${this.pad(swarm.errorRate, 16)} │`);
    console.log('└─────────────────────────┴──────────────────┴──────────────────┘');

    console.log('\n🏆 Winner: ' + (comparison.winner === 'swarm' ? '🚀 SWARM' : '🔨 TRADITIONAL'));

    console.log('\n📈 Improvements:');
    console.log(`  • Speed: ${comparison.speedImprovementValue > 0 ? '+' : ''}${comparison.speedImprovement}`);
    console.log(`  • Throughput: ${comparison.throughputImprovementValue > 0 ? '+' : ''}${comparison.throughputImprovement}`);
    console.log(`  • Time Saved: ${comparison.timeSaved}`);
    console.log(`  • Memory Overhead: ${comparison.memoryDifference}`);
    console.log(`  • Concurrency: ${comparison.concurrencyAdvantage}x parallel tasks`);

    console.log('\n' + '═'.repeat(70) + '\n');
  }

  printOverallSummary() {
    console.log('\n\n' + '╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    OVERALL SUMMARY                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const totalScenarios = this.results.scenarios.length;
    const swarmWins = this.results.scenarios.filter(s => s.comparison.winner === 'swarm').length;
    const traditionalWins = totalScenarios - swarmWins;

    const avgSpeedImprovement = this.results.scenarios.reduce((sum, s) =>
      sum + s.comparison.speedImprovementValue, 0) / totalScenarios;

    const totalTimeSaved = this.results.scenarios.reduce((sum, s) =>
      sum + s.comparison.timeSavedMs, 0);

    console.log(`📊 Scenarios Tested: ${totalScenarios}`);
    console.log(`🚀 Swarm Wins: ${swarmWins} (${(swarmWins / totalScenarios * 100).toFixed(1)}%)`);
    console.log(`🔨 Traditional Wins: ${traditionalWins} (${(traditionalWins / totalScenarios * 100).toFixed(1)}%)`);
    console.log(`\n⚡ Average Speed Improvement: ${avgSpeedImprovement > 0 ? '+' : ''}${avgSpeedImprovement.toFixed(2)}%`);
    console.log(`⏱️  Total Time Saved: ${(totalTimeSaved / 1000).toFixed(2)}s`);

    console.log('\n🔍 Key Findings:');

    if (avgSpeedImprovement > 20) {
      console.log('  ✓ Swarm approach shows SIGNIFICANT performance advantage');
      console.log('  ✓ Recommended for complex, multi-task projects');
    } else if (avgSpeedImprovement > 0) {
      console.log('  ✓ Swarm approach shows moderate performance improvement');
      console.log('  ✓ Best for projects with parallelizable tasks');
    } else {
      console.log('  ✓ Traditional approach remains competitive');
      console.log('  ✓ May be preferred for simple, sequential workflows');
    }

    const avgMemoryOverhead = this.results.scenarios.reduce((sum, s) =>
      sum + s.comparison.memoryDifferenceValue, 0) / totalScenarios;

    console.log(`\n💾 Memory Analysis:`);
    console.log(`  • Avg Memory Overhead: ${avgMemoryOverhead.toFixed(2)}MB`);

    if (avgMemoryOverhead < 5) {
      console.log(`  ✓ Minimal memory overhead - acceptable tradeoff`);
    } else if (avgMemoryOverhead < 10) {
      console.log(`  ⚠ Moderate memory overhead - monitor on constrained systems`);
    } else {
      console.log(`  ⚠ Higher memory overhead - consider available resources`);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
  }

  async saveResults() {
    const resultsDir = path.join(__dirname, 'results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    await fs.mkdir(resultsDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));

    console.log(`\n💾 Results saved to: ${filepath}\n`);

    // Also save a summary report
    const summaryPath = path.join(resultsDir, `summary-${timestamp}.md`);
    await this.saveSummaryReport(summaryPath);

    console.log(`📄 Summary report saved to: ${summaryPath}\n`);
  }

  async saveSummaryReport(filepath) {
    let report = `# Coding Methodology Benchmark Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    report += `## Executive Summary\n\n`;

    const totalScenarios = this.results.scenarios.length;
    const swarmWins = this.results.scenarios.filter(s => s.comparison.winner === 'swarm').length;
    const avgSpeedImprovement = this.results.scenarios.reduce((sum, s) =>
      sum + s.comparison.speedImprovementValue, 0) / totalScenarios;

    report += `- **Total Scenarios:** ${totalScenarios}\n`;
    report += `- **Swarm Wins:** ${swarmWins} (${(swarmWins / totalScenarios * 100).toFixed(1)}%)\n`;
    report += `- **Average Speed Improvement:** ${avgSpeedImprovement.toFixed(2)}%\n\n`;

    report += `## Detailed Results\n\n`;

    for (const scenario of this.results.scenarios) {
      report += `### ${scenario.scenario}\n\n`;
      report += `**Complexity:** ${scenario.complexity} | **Tasks:** ${scenario.taskCount}\n\n`;

      report += `| Metric | Traditional | Swarm | Improvement |\n`;
      report += `|--------|-------------|-------|-------------|\n`;
      report += `| Time | ${scenario.traditional.totalDurationSec}s | ${scenario.swarm.totalDurationSec}s | ${scenario.comparison.speedImprovement} |\n`;
      report += `| Throughput | ${scenario.traditional.throughput} t/s | ${scenario.swarm.throughput} t/s | ${scenario.comparison.throughputImprovement} |\n`;
      report += `| Peak Memory | ${scenario.traditional.peakMemoryMB}MB | ${scenario.swarm.peakMemoryMB}MB | ${scenario.comparison.memoryDifference} |\n`;
      report += `| Max Concurrency | ${scenario.traditional.maxConcurrency} | ${scenario.swarm.maxConcurrency} | ${scenario.swarm.maxConcurrency}x |\n\n`;

      report += `**Winner:** ${scenario.comparison.winner === 'swarm' ? '🚀 Swarm' : '🔨 Traditional'}\n\n`;
    }

    await fs.writeFile(filepath, report);
  }

  pad(str, length) {
    return str.toString().padEnd(length, ' ');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const runner = new BenchmarkRunner(config);
  await runner.runAllBenchmarks();

  console.log('✅ Benchmark completed successfully!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = BenchmarkRunner;
