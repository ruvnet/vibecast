/**
 * Optimized Benchmark Suite
 *
 * Uses JavaScript APIs directly for accurate performance measurement
 */

import { OptimizedAgentDBMemory } from './optimized-memory.js';
import type { Episode } from './memory.js';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSec: number;
  p50: number;
  p95: number;
  p99: number;
}

interface BenchmarkSuite {
  agentdb: {
    storeEpisode: BenchmarkResult;
    retrieveMemories: BenchmarkResult;
    queryWithContext: BenchmarkResult;
    consolidateSkills: BenchmarkResult;
    searchSkills: BenchmarkResult;
  };
  overall: {
    totalTime: number;
    timestamp: string;
  };
}

export class OptimizedBenchmark {
  private memory: OptimizedAgentDBMemory;

  constructor() {
    this.memory = new OptimizedAgentDBMemory('./optimized-benchmark.db');
  }

  async initialize(): Promise<void> {
    console.log('🏁 Initializing optimized benchmark suite...\n');
    await this.memory.initialize();
    console.log('✅ Benchmark suite ready\n');
  }

  /**
   * Run complete benchmark suite
   */
  async runAll(): Promise<BenchmarkSuite> {
    const suiteStartTime = Date.now();

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│   Optimized Integration Benchmark Suite                 │');
    console.log('│   AgentDB JavaScript API Performance Test               │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // AgentDB Benchmarks with JS API
    console.log('📊 AGENTDB BENCHMARKS (JS API)\n');

    const storeEpisode = await this.benchmarkStoreEpisode(1000);
    this.printResult('Store Episode', storeEpisode);

    const retrieveMemories = await this.benchmarkRetrieveMemories(500);
    this.printResult('Retrieve Memories', retrieveMemories);

    const queryWithContext = await this.benchmarkQueryWithContext(300);
    this.printResult('Query with Context', queryWithContext);

    const consolidateSkills = await this.benchmarkConsolidateSkills(10);
    this.printResult('Consolidate Skills', consolidateSkills);

    const searchSkills = await this.benchmarkSearchSkills(200);
    this.printResult('Search Skills', searchSkills);

    const totalTime = Date.now() - suiteStartTime;

    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│   BENCHMARK COMPLETE                                    │');
    console.log(`│   Total Time: ${(totalTime / 1000).toFixed(2)}s                                 │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Print performance metrics
    const metrics = this.memory.getMetrics();
    console.log('📈 PERFORMANCE METRICS\n');
    console.log(`  Store Operations:    ${metrics.storeCount}`);
    console.log(`  Avg Store Time:      ${metrics.avgStoreTime.toFixed(3)}ms`);
    console.log(`  Retrieve Operations: ${metrics.retrieveCount}`);
    console.log(`  Avg Retrieve Time:   ${metrics.avgRetrieveTime.toFixed(3)}ms\n`);

    return {
      agentdb: {
        storeEpisode,
        retrieveMemories,
        queryWithContext,
        consolidateSkills,
        searchSkills,
      },
      overall: {
        totalTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Benchmark: Store Episode (JS API)
   */
  private async benchmarkStoreEpisode(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const episode: Episode = {
        sessionId: `bench-${i}`,
        taskName: 'navigation',
        confidence: Math.random(),
        success: Math.random() > 0.3,
        outcome: 'Completed navigation task',
        strategy: 'adaptive_planning',
        metadata: { x: i, y: i * 2, latency: Math.random() * 100 },
      };

      const start = performance.now();
      await this.memory.storeEpisode(episode);
      times.push(performance.now() - start);

      if (i % 100 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Store Episode', times);
  }

  /**
   * Benchmark: Retrieve Memories (JS API)
   */
  private async benchmarkRetrieveMemories(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    const queries = [
      'navigation task',
      'object detection',
      'path planning',
      'sensor fusion',
      'motor control',
    ];

    for (let i = 0; i < iterations; i++) {
      const query = queries[i % queries.length];

      const start = performance.now();
      await this.memory.retrieveMemories(query, 5, {
        onlySuccesses: true,
        synthesizeContext: true,
      });
      times.push(performance.now() - start);

      if (i % 50 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Retrieve Memories', times);
  }

  /**
   * Benchmark: Query with Context (JS API)
   */
  private async benchmarkQueryWithContext(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.memory.queryWithContext('warehouse navigation', {
        k: 10,
        minConfidence: 0.5,
        synthesizeReasoning: true,
      });
      times.push(performance.now() - start);

      if (i % 30 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Query with Context', times);
  }

  /**
   * Benchmark: Consolidate Skills (JS API)
   */
  private async benchmarkConsolidateSkills(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.memory.consolidateSkills({
        minAttempts: 3,
        minReward: 0.7,
        timeWindowDays: 7,
        enablePruning: true,
      });
      times.push(performance.now() - start);

      if (i % 2 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Consolidate Skills', times);
  }

  /**
   * Benchmark: Search Skills (JS API)
   */
  private async benchmarkSearchSkills(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.memory.searchSkills('navigation', {
        k: 5,
        minSuccessRate: 0.5,
        sortBy: 'success_rate',
      });
      times.push(performance.now() - start);

      if (i % 20 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Search Skills', times);
  }

  /**
   * Calculate statistics from timing data
   */
  private calculateStats(name: string, times: number[]): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b);
    const total = times.reduce((a, b) => a + b, 0);

    return {
      name,
      iterations: times.length,
      totalTime: total,
      avgTime: total / times.length,
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      opsPerSec: (times.length / total) * 1000,
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Print benchmark result
   */
  private printResult(name: string, result: BenchmarkResult): void {
    console.log(`${name}:`);
    console.log(`  Iterations:  ${result.iterations.toLocaleString()}`);
    console.log(`  Avg Time:    ${result.avgTime.toFixed(3)}ms`);
    console.log(`  Min/Max:     ${result.minTime.toFixed(3)}ms / ${result.maxTime.toFixed(3)}ms`);
    console.log(`  p50/p95/p99: ${result.p50.toFixed(3)}ms / ${result.p95.toFixed(3)}ms / ${result.p99.toFixed(3)}ms`);
    console.log(`  Ops/sec:     ${result.opsPerSec.toFixed(0)}`);
    console.log('');
  }

  /**
   * Export results to JSON
   */
  async exportResults(suite: BenchmarkSuite, filename: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(suite, null, 2));
    console.log(`📁 Results exported to ${filename}`);
  }

  async close(): Promise<void> {
    await this.memory.close();
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new OptimizedBenchmark();

  try {
    await benchmark.initialize();
    const results = await benchmark.runAll();
    await benchmark.exportResults(results, './optimized-benchmark-results.json');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.close();
  }
}
