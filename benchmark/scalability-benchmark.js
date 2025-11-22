/**
 * Scalability Benchmark - Test Different Swarm Sizes
 * Finds optimal agent count and system limits
 */

const fs = require('fs').promises;
const path = require('path');
const ConcurrentExecutor = require('./swarm/concurrent-executor');
const os = require('os');

class ScalabilityBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        nodeVersion: process.version
      },
      tests: []
    };

    // Test scenario - using a consistent scenario for all tests
    this.testScenario = {
      id: 'scalability-test',
      name: 'Scalability Test Scenario',
      complexity: 'medium',
      tasks: [
        'Initialize core module',
        'Set up configuration',
        'Create data models',
        'Implement business logic',
        'Add validation layer',
        'Create API endpoints',
        'Add error handling',
        'Implement logging',
        'Write unit tests',
        'Add integration tests',
        'Create documentation',
        'Add performance monitoring',
        'Implement caching',
        'Add rate limiting',
        'Create health checks'
      ]
    };
  }

  async runScalabilityTests() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║          SWARM SCALABILITY BENCHMARK                          ║');
    console.log('║          Finding Optimal Agent Configuration                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('System Information:');
    console.log(`  • Platform: ${this.results.system.platform}`);
    console.log(`  • CPUs: ${this.results.system.cpus} cores`);
    console.log(`  • Total Memory: ${this.results.system.totalMemory} MB`);
    console.log(`  • Free Memory: ${this.results.system.freeMemory} MB`);
    console.log(`  • Node.js: ${this.results.system.nodeVersion}\n`);

    console.log(`Test Scenario: ${this.testScenario.name}`);
    console.log(`Tasks: ${this.testScenario.tasks.length}`);
    console.log('');

    // Test configurations: agent counts to test
    const configurations = [
      { agents: 2, maxConcurrent: 4, description: 'Minimal (2 agents)' },
      { agents: 5, maxConcurrent: 6, description: 'Baseline (5 agents)' },
      { agents: 10, maxConcurrent: 12, description: 'Small Swarm (10 agents)' },
      { agents: 15, maxConcurrent: 18, description: 'Medium Swarm (15 agents)' },
      { agents: 20, maxConcurrent: 24, description: 'Large Swarm (20 agents)' },
      { agents: 25, maxConcurrent: 30, description: 'Very Large Swarm (25 agents)' },
      { agents: 30, maxConcurrent: 36, description: 'Massive Swarm (30 agents)' },
      { agents: 40, maxConcurrent: 48, description: 'Extreme Swarm (40 agents)' },
      { agents: 50, maxConcurrent: 60, description: 'Maximum Test (50 agents)' }
    ];

    for (const config of configurations) {
      await this.testConfiguration(config);

      // Wait between tests to let system stabilize
      await this.sleep(3000);
    }

    // Analyze results
    this.analyzeResults();

    // Save results
    await this.saveResults();

    return this.results;
  }

  async testConfiguration(config) {
    console.log('\n' + '━'.repeat(70));
    console.log(`  TESTING: ${config.description}`);
    console.log(`  Agents: ${config.agents} | Max Concurrent: ${config.maxConcurrent}`);
    console.log('━'.repeat(70) + '\n');

    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    try {
      // Create swarm with specified configuration
      const executor = new ConcurrentExecutor(this.testScenario, {
        agentCount: config.agents,
        queenEnabled: true,
        maxConcurrentTasks: config.maxConcurrent,
        reasoningBankEnabled: true
      });

      // Run the test
      const performance = await executor.execute();

      const endMemory = process.memoryUsage();
      const endTime = Date.now();

      // Calculate resource metrics
      const memoryDelta = {
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        heapTotal: (endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024,
        rss: (endMemory.rss - startMemory.rss) / 1024 / 1024
      };

      const result = {
        config: {
          agents: config.agents,
          maxConcurrent: config.maxConcurrent,
          description: config.description
        },
        performance: {
          totalDuration: performance.totalDuration,
          totalDurationSec: performance.totalDurationSec,
          throughput: parseFloat(performance.throughput),
          avgTaskDuration: parseFloat(performance.avgTaskDuration),
          maxConcurrency: performance.maxConcurrency,
          completedTasks: performance.completedTasks,
          successfulTasks: performance.successfulTasks,
          failedTasks: performance.failedTasks
        },
        resources: {
          memoryUsed: memoryDelta.heapUsed.toFixed(2),
          heapTotal: memoryDelta.heapTotal.toFixed(2),
          rss: memoryDelta.rss.toFixed(2),
          peakMemory: performance.peakMemoryMB
        },
        efficiency: {
          agentUtilization: ((performance.maxConcurrency / (config.agents + 1)) * 100).toFixed(2),
          tasksPerAgent: (performance.completedTasks / (config.agents + 1)).toFixed(2),
          speedVsBaseline: null // Will be calculated later
        },
        systemState: {
          freeMemoryBefore: Math.round(os.freemem() / 1024 / 1024),
          freeMemoryAfter: Math.round(os.freemem() / 1024 / 1024),
          loadAverage: os.loadavg()
        }
      };

      this.results.tests.push(result);

      // Print summary
      this.printTestSummary(result);

    } catch (error) {
      console.error(`❌ Test failed for ${config.description}:`, error.message);

      this.results.tests.push({
        config,
        error: error.message,
        failed: true
      });
    }
  }

  printTestSummary(result) {
    console.log('\n📊 Test Results:');
    console.log(`  ⚡ Duration: ${result.performance.totalDurationSec}s`);
    console.log(`  🚀 Throughput: ${result.performance.throughput} tasks/sec`);
    console.log(`  🔄 Max Concurrency: ${result.performance.maxConcurrency}`);
    console.log(`  📈 Agent Utilization: ${result.efficiency.agentUtilization}%`);
    console.log(`  💾 Memory Used: ${result.resources.memoryUsed} MB`);
    console.log(`  📊 Tasks/Agent: ${result.efficiency.tasksPerAgent}`);
  }

  analyzeResults() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('                    SCALABILITY ANALYSIS');
    console.log('═'.repeat(70) + '\n');

    const successfulTests = this.results.tests.filter(t => !t.failed);

    if (successfulTests.length === 0) {
      console.log('❌ No successful tests to analyze');
      return;
    }

    // Find baseline (5 agents)
    const baseline = successfulTests.find(t => t.config.agents === 5);

    // Calculate speed vs baseline
    successfulTests.forEach(test => {
      if (baseline && test.config.agents !== 5) {
        const speedup = ((baseline.performance.totalDuration - test.performance.totalDuration)
          / baseline.performance.totalDuration * 100);
        test.efficiency.speedVsBaseline = speedup.toFixed(2);
      } else {
        test.efficiency.speedVsBaseline = '0.00';
      }
    });

    // Find optimal configuration
    const optimal = this.findOptimalConfiguration(successfulTests);

    // Find efficiency sweet spot
    const sweetSpot = this.findEfficiencySwetSpot(successfulTests);

    // Find scaling limits
    const limits = this.findScalingLimits(successfulTests);

    // Store analysis
    this.results.analysis = {
      optimal,
      sweetSpot,
      limits,
      recommendations: this.generateRecommendations(optimal, sweetSpot, limits)
    };

    // Print analysis
    this.printAnalysis();
  }

  findOptimalConfiguration(tests) {
    // Find configuration with best throughput
    const bestThroughput = tests.reduce((best, test) =>
      test.performance.throughput > best.performance.throughput ? test : best
    );

    // Find fastest configuration
    const fastest = tests.reduce((best, test) =>
      test.performance.totalDuration < best.performance.totalDuration ? test : best
    );

    // Find most efficient (best throughput per agent)
    const mostEfficient = tests.reduce((best, test) => {
      const efficiency = test.performance.throughput / (test.config.agents + 1);
      const bestEfficiency = best.performance.throughput / (best.config.agents + 1);
      return efficiency > bestEfficiency ? test : best;
    });

    return {
      bestThroughput: {
        agents: bestThroughput.config.agents,
        throughput: bestThroughput.performance.throughput,
        duration: bestThroughput.performance.totalDurationSec
      },
      fastest: {
        agents: fastest.config.agents,
        throughput: fastest.performance.throughput,
        duration: fastest.performance.totalDurationSec
      },
      mostEfficient: {
        agents: mostEfficient.config.agents,
        efficiency: (mostEfficient.performance.throughput / (mostEfficient.config.agents + 1)).toFixed(2),
        throughput: mostEfficient.performance.throughput
      }
    };
  }

  findEfficiencySwetSpot(tests) {
    // Calculate efficiency score: throughput / (agents * memory)
    const scored = tests.map(test => ({
      ...test,
      efficiencyScore: test.performance.throughput /
        ((test.config.agents + 1) * parseFloat(test.resources.memoryUsed) || 1)
    }));

    const best = scored.reduce((best, test) =>
      test.efficiencyScore > best.efficiencyScore ? test : best
    );

    return {
      agents: best.config.agents,
      throughput: best.performance.throughput,
      memoryUsed: best.resources.memoryUsed,
      efficiencyScore: best.efficiencyScore.toFixed(4),
      utilization: best.efficiency.agentUtilization
    };
  }

  findScalingLimits(tests) {
    // Find where throughput stops improving significantly
    const sorted = tests.sort((a, b) => a.config.agents - b.config.agents);

    let diminishingReturns = null;
    let bottleneck = null;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const improvement = ((curr.performance.throughput - prev.performance.throughput)
        / prev.performance.throughput * 100);

      // Diminishing returns: less than 10% improvement
      if (!diminishingReturns && improvement < 10) {
        diminishingReturns = {
          agentCount: curr.config.agents,
          improvement: improvement.toFixed(2),
          message: `Adding more agents beyond ${prev.config.agents} shows diminishing returns`
        };
      }

      // Bottleneck: throughput actually decreases
      if (!bottleneck && improvement < 0) {
        bottleneck = {
          agentCount: curr.config.agents,
          degradation: improvement.toFixed(2),
          message: `Performance degrades with ${curr.config.agents}+ agents`
        };
      }
    }

    // Check utilization
    const lowUtilization = sorted.find(t => parseFloat(t.efficiency.agentUtilization) < 50);

    return {
      diminishingReturns,
      bottleneck,
      lowUtilization: lowUtilization ? {
        agents: lowUtilization.config.agents,
        utilization: lowUtilization.efficiency.agentUtilization,
        message: `Agent utilization drops below 50% at ${lowUtilization.config.agents} agents`
      } : null,
      maxTested: Math.max(...tests.map(t => t.config.agents)),
      maxSuccessful: tests[tests.length - 1].config.agents
    };
  }

  generateRecommendations(optimal, sweetSpot, limits) {
    const recommendations = [];

    // Optimal configuration
    recommendations.push({
      type: 'optimal',
      priority: 'high',
      title: 'Optimal Configuration for Maximum Speed',
      config: optimal.fastest,
      reason: `Provides fastest execution time at ${optimal.fastest.duration}s`
    });

    // Efficiency recommendation
    recommendations.push({
      type: 'efficiency',
      priority: 'high',
      title: 'Efficiency Sweet Spot',
      config: sweetSpot,
      reason: `Best balance of speed, resource usage, and agent utilization at ${sweetSpot.utilization}%`
    });

    // Scaling limits
    if (limits.diminishingReturns) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: 'Diminishing Returns Threshold',
        config: limits.diminishingReturns,
        reason: limits.diminishingReturns.message
      });
    }

    if (limits.bottleneck) {
      recommendations.push({
        type: 'critical',
        priority: 'high',
        title: 'Performance Bottleneck Detected',
        config: limits.bottleneck,
        reason: limits.bottleneck.message
      });
    }

    // General recommendations
    if (sweetSpot.agents <= 10) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        title: 'Recommended for Most Use Cases',
        config: { agents: sweetSpot.agents },
        reason: 'Provides excellent performance with reasonable resource usage'
      });
    } else if (sweetSpot.agents <= 25) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        title: 'Recommended for High-Performance Scenarios',
        config: { agents: sweetSpot.agents },
        reason: 'Best for complex projects requiring maximum throughput'
      });
    } else {
      recommendations.push({
        type: 'general',
        priority: 'low',
        title: 'Use with Caution',
        config: { agents: sweetSpot.agents },
        reason: 'High agent counts may not provide proportional benefits'
      });
    }

    return recommendations;
  }

  printAnalysis() {
    const { optimal, sweetSpot, limits, recommendations } = this.results.analysis;

    console.log('🏆 Optimal Configurations:\n');

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Fastest Execution                                           │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Agents: ${optimal.fastest.agents.toString().padEnd(52)}│`);
    console.log(`│ Duration: ${optimal.fastest.duration}s${' '.repeat(48 - optimal.fastest.duration.length)}│`);
    console.log(`│ Throughput: ${optimal.fastest.throughput} tasks/sec${' '.repeat(38 - optimal.fastest.throughput.toString().length)}│`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Efficiency Sweet Spot                                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Agents: ${sweetSpot.agents.toString().padEnd(52)}│`);
    console.log(`│ Efficiency Score: ${sweetSpot.efficiencyScore}${' '.repeat(42 - sweetSpot.efficiencyScore.length)}│`);
    console.log(`│ Utilization: ${sweetSpot.utilization}%${' '.repeat(45 - sweetSpot.utilization.length)}│`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    if (limits.diminishingReturns || limits.bottleneck || limits.lowUtilization) {
      console.log('⚠️  Scaling Limits:\n');

      if (limits.diminishingReturns) {
        console.log(`  • Diminishing Returns: ${limits.diminishingReturns.agentCount} agents`);
        console.log(`    (${limits.diminishingReturns.improvement}% improvement)\n`);
      }

      if (limits.bottleneck) {
        console.log(`  • Bottleneck: ${limits.bottleneck.agentCount} agents`);
        console.log(`    (${limits.bottleneck.degradation}% degradation)\n`);
      }

      if (limits.lowUtilization) {
        console.log(`  • Low Utilization: ${limits.lowUtilization.agents} agents`);
        console.log(`    (${limits.lowUtilization.utilization}% utilization)\n`);
      }
    }

    console.log('\n💡 Recommendations:\n');

    recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${icon} ${rec.title}`);
      console.log(`   ${rec.reason}\n`);
    });

    console.log('═'.repeat(70) + '\n');
  }

  async saveResults() {
    const resultsDir = path.join(__dirname, 'results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scalability-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    await fs.mkdir(resultsDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));

    console.log(`\n💾 Results saved to: ${filepath}`);

    // Save detailed report
    const reportPath = path.join(resultsDir, `scalability-report-${timestamp}.md`);
    await this.saveDetailedReport(reportPath);

    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  }

  async saveDetailedReport(filepath) {
    let report = `# Swarm Scalability Benchmark Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;

    report += `## System Information\n\n`;
    report += `- **Platform:** ${this.results.system.platform}\n`;
    report += `- **CPUs:** ${this.results.system.cpus} cores\n`;
    report += `- **Total Memory:** ${this.results.system.totalMemory} MB\n`;
    report += `- **Node.js:** ${this.results.system.nodeVersion}\n\n`;

    report += `## Test Scenario\n\n`;
    report += `- **Name:** ${this.testScenario.name}\n`;
    report += `- **Tasks:** ${this.testScenario.tasks.length}\n`;
    report += `- **Complexity:** ${this.testScenario.complexity}\n\n`;

    report += `## Results Summary\n\n`;
    report += `| Agents | Duration | Throughput | Max Concurrency | Utilization | Memory |\n`;
    report += `|--------|----------|------------|-----------------|-------------|--------|\n`;

    const successfulTests = this.results.tests.filter(t => !t.failed);
    successfulTests.forEach(test => {
      report += `| ${test.config.agents} | ${test.performance.totalDurationSec}s | `;
      report += `${test.performance.throughput} t/s | ${test.performance.maxConcurrency} | `;
      report += `${test.efficiency.agentUtilization}% | ${test.resources.memoryUsed} MB |\n`;
    });

    report += `\n## Optimal Configurations\n\n`;

    const { optimal, sweetSpot } = this.results.analysis;

    report += `### Fastest Execution\n\n`;
    report += `- **Agents:** ${optimal.fastest.agents}\n`;
    report += `- **Duration:** ${optimal.fastest.duration}s\n`;
    report += `- **Throughput:** ${optimal.fastest.throughput} tasks/sec\n\n`;

    report += `### Efficiency Sweet Spot\n\n`;
    report += `- **Agents:** ${sweetSpot.agents}\n`;
    report += `- **Efficiency Score:** ${sweetSpot.efficiencyScore}\n`;
    report += `- **Utilization:** ${sweetSpot.utilization}%\n`;
    report += `- **Memory:** ${sweetSpot.memoryUsed} MB\n\n`;

    report += `## Recommendations\n\n`;
    this.results.analysis.recommendations.forEach(rec => {
      report += `### ${rec.title}\n\n`;
      report += `**Priority:** ${rec.priority.toUpperCase()}\n\n`;
      report += `${rec.reason}\n\n`;
    });

    await fs.writeFile(filepath, report);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const benchmark = new ScalabilityBenchmark();
  await benchmark.runScalabilityTests();

  console.log('✅ Scalability benchmark completed!\n');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Scalability benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = ScalabilityBenchmark;
