/**
 * MAKER Framework Benchmarking Infrastructure
 *
 * Measures and compares:
 * - Per-step accuracy
 * - Full task success probability
 * - Voting efficiency
 * - Red-flag detection rates
 * - Cost estimates
 */

import type { MAKERStats, MAKERConfig } from '../maker/types';
import {
  calculateFullTaskSuccess,
  calculateMinimumK,
  calculateExpectedCost,
  DEFAULT_MAKER_CONFIG
} from '../maker/types';

/**
 * Benchmark result for a single run
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Timestamp */
  timestamp: Date;
  /** Configuration used */
  config: MAKERConfig;
  /** MAKER statistics */
  stats: MAKERStats;
  /** Theoretical metrics */
  theoretical: {
    expectedSuccessRate: number;
    minimumK: number;
    expectedCost: number;
  };
  /** Performance metrics */
  performance: {
    totalTimeMs: number;
    avgStepTimeMs: number;
    votesPerSecond: number;
  };
  /** Efficiency metrics */
  efficiency: {
    votingOverhead: number; // Extra votes beyond minimum
    redFlagRate: number;
    consensusRate: number;
  };
}

/**
 * Comparison between benchmark runs
 */
export interface BenchmarkComparison {
  /** Baseline benchmark */
  baseline: BenchmarkResult;
  /** Comparison benchmark */
  comparison: BenchmarkResult;
  /** Improvements (positive = better) */
  improvements: {
    successRate: number;
    executionTime: number;
    votingEfficiency: number;
  };
}

/**
 * Benchmark runner
 */
export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * Record a benchmark result from MAKER stats
   */
  record(
    name: string,
    stats: MAKERStats,
    config: MAKERConfig = DEFAULT_MAKER_CONFIG,
    totalTimeMs: number = stats.totalExecutionTime
  ): BenchmarkResult {
    const result: BenchmarkResult = {
      name,
      timestamp: new Date(),
      config,
      stats,
      theoretical: {
        expectedSuccessRate: calculateFullTaskSuccess(
          stats.perStepAccuracy || 0.7,
          config.votingThreshold,
          stats.totalSteps
        ),
        minimumK: calculateMinimumK(
          stats.totalSteps,
          0.99,
          stats.perStepAccuracy || 0.7
        ),
        expectedCost: calculateExpectedCost(
          0.001, // $0.001 per response (example)
          stats.totalSteps,
          0.95, // 95% validity rate
          stats.perStepAccuracy || 0.7
        )
      },
      performance: {
        totalTimeMs,
        avgStepTimeMs: stats.totalSteps > 0 ? totalTimeMs / stats.totalSteps : 0,
        votesPerSecond: totalTimeMs > 0 ? (stats.totalVotesCast / totalTimeMs) * 1000 : 0
      },
      efficiency: {
        votingOverhead: stats.averageVotesPerStep - config.votingThreshold,
        redFlagRate: stats.totalSteps > 0 ? stats.redFlagsDetected / stats.totalSteps : 0,
        consensusRate: stats.totalSteps > 0 ? stats.successfulSteps / stats.totalSteps : 0
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Get all results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get latest result
   */
  getLatest(): BenchmarkResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  /**
   * Compare two benchmarks
   */
  compare(baselineName: string, comparisonName: string): BenchmarkComparison | null {
    const baseline = this.results.find(r => r.name === baselineName);
    const comparison = this.results.find(r => r.name === comparisonName);

    if (!baseline || !comparison) {
      return null;
    }

    return {
      baseline,
      comparison,
      improvements: {
        successRate: comparison.stats.perStepAccuracy - baseline.stats.perStepAccuracy,
        executionTime: baseline.performance.totalTimeMs - comparison.performance.totalTimeMs,
        votingEfficiency: baseline.efficiency.votingOverhead - comparison.efficiency.votingOverhead
      }
    };
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Generate summary report
   */
  generateReport(): string {
    if (this.results.length === 0) {
      return 'No benchmark results recorded.';
    }

    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '                    MAKER BENCHMARK REPORT                      ',
      '═══════════════════════════════════════════════════════════════',
      ''
    ];

    for (const result of this.results) {
      lines.push(`📊 ${result.name}`);
      lines.push(`   Time: ${result.timestamp.toISOString()}`);
      lines.push('');
      lines.push('   Statistics:');
      lines.push(`   • Total Steps: ${result.stats.totalSteps}`);
      lines.push(`   • Success Rate: ${(result.stats.perStepAccuracy * 100).toFixed(1)}%`);
      lines.push(`   • Votes Cast: ${result.stats.totalVotesCast}`);
      lines.push(`   • Avg Votes/Step: ${result.stats.averageVotesPerStep.toFixed(2)}`);
      lines.push(`   • Red Flags: ${result.stats.redFlagsDetected}`);
      lines.push('');
      lines.push('   Theoretical:');
      lines.push(`   • Expected Full Success: ${(result.theoretical.expectedSuccessRate * 100).toFixed(1)}%`);
      lines.push(`   • Minimum k for 99%: ${result.theoretical.minimumK}`);
      lines.push(`   • Expected Cost: $${result.theoretical.expectedCost.toFixed(4)}`);
      lines.push('');
      lines.push('   Performance:');
      lines.push(`   • Total Time: ${result.performance.totalTimeMs}ms`);
      lines.push(`   • Avg Step Time: ${result.performance.avgStepTimeMs.toFixed(2)}ms`);
      lines.push(`   • Votes/Second: ${result.performance.votesPerSecond.toFixed(2)}`);
      lines.push('');
      lines.push('   Efficiency:');
      lines.push(`   • Voting Overhead: ${result.efficiency.votingOverhead.toFixed(2)} extra votes`);
      lines.push(`   • Red Flag Rate: ${(result.efficiency.redFlagRate * 100).toFixed(1)}%`);
      lines.push(`   • Consensus Rate: ${(result.efficiency.consensusRate * 100).toFixed(1)}%`);
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Singleton benchmark runner
 */
let runnerInstance: BenchmarkRunner | null = null;

export function getBenchmarkRunner(): BenchmarkRunner {
  if (!runnerInstance) {
    runnerInstance = new BenchmarkRunner();
  }
  return runnerInstance;
}

export function resetBenchmarkRunner(): void {
  runnerInstance = null;
}

/**
 * Run a parameter sweep to find optimal configuration
 */
export async function runParameterSweep(
  runBenchmark: (config: MAKERConfig) => Promise<MAKERStats>,
  options: {
    kValues?: number[];
    voterCounts?: number[];
    parallelModes?: boolean[];
  } = {}
): Promise<Map<string, BenchmarkResult>> {
  const runner = new BenchmarkRunner();
  const results = new Map<string, BenchmarkResult>();

  const kValues = options.kValues ?? [2, 3, 5, 7];
  const voterCounts = options.voterCounts ?? [3, 5, 7];
  const parallelModes = options.parallelModes ?? [true, false];

  for (const k of kValues) {
    for (const voters of voterCounts) {
      for (const parallel of parallelModes) {
        const config: MAKERConfig = {
          ...DEFAULT_MAKER_CONFIG,
          votingThreshold: k,
          voterCount: voters,
          parallelVoting: parallel
        };

        const configName = `k=${k}_v=${voters}_${parallel ? 'parallel' : 'sequential'}`;
        const startTime = Date.now();

        const stats = await runBenchmark(config);

        const totalTime = Date.now() - startTime;
        const result = runner.record(configName, stats, config, totalTime);

        results.set(configName, result);
      }
    }
  }

  return results;
}

/**
 * Find optimal configuration from sweep results
 */
export function findOptimalConfig(
  results: Map<string, BenchmarkResult>,
  optimizeFor: 'accuracy' | 'speed' | 'efficiency' = 'accuracy'
): BenchmarkResult | null {
  let best: BenchmarkResult | null = null;
  let bestScore = -Infinity;

  for (const result of results.values()) {
    let score: number;

    switch (optimizeFor) {
      case 'accuracy':
        score = result.stats.perStepAccuracy;
        break;
      case 'speed':
        score = -result.performance.totalTimeMs;
        break;
      case 'efficiency':
        score = result.efficiency.consensusRate - result.efficiency.votingOverhead / 10;
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  return best;
}
