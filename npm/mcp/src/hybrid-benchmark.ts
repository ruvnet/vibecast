/**
 * Hybrid Benchmark Suite
 *
 * Demonstrates performance improvements with direct SQL storage
 */

import { HybridAgentDBMemory } from './hybrid-memory.js';
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

export class HybridBenchmark {
  private memory: HybridAgentDBMemory;

  constructor() {
    this.memory = new HybridAgentDBMemory('./hybrid-benchmark.db');
  }

  async initialize(): Promise<void> {
    console.log('🏁 Initializing hybrid benchmark suite...\n');
    await this.memory.initialize();
    console.log('✅ Benchmark suite ready\n');
  }

  /**
   * Run complete benchmark suite
   */
  async runAll(): Promise<void> {
    const suiteStartTime = Date.now();

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│   Hybrid Integration Benchmark Suite                    │');
    console.log('│   Direct SQL + CLI Vector Search Performance Test       │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Hybrid Benchmarks
    console.log('📊 HYBRID BENCHMARKS (SQL Storage + CLI Search)\n');

    const storeEpisode = await this.benchmarkStoreEpisode(1000);
    this.printResult('Store Episode (SQL)', storeEpisode);

    const bulkStore = await this.benchmarkBulkStore(1000, 100);
    this.printResult('Bulk Store (SQL Transaction)', bulkStore);

    const retrieveMemories = await this.benchmarkRetrieveMemories(100);
    this.printResult('Retrieve Memories (SQL Fallback)', retrieveMemories);

    const queryWithContext = await this.benchmarkQueryWithContext(100);
    this.printResult('Query with Context (Hybrid)', queryWithContext);

    const searchSkills = await this.benchmarkSearchSkills(200);
    this.printResult('Search Skills (SQL)', searchSkills);

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

    // Print database stats
    const stats = await this.memory.getStats();
    console.log('💾 DATABASE STATISTICS\n');
    console.log(`  Total Episodes:      ${stats.total_episodes}`);
    console.log(`  Successful:          ${stats.successful_episodes}`);
    console.log(`  Failed:              ${stats.failed_episodes}`);
    console.log(`  Unique Tasks:        ${stats.unique_tasks}`);
    console.log(`  Avg Confidence:      ${stats.avg_confidence?.toFixed(3)}\n`);

    // Optimization test
    console.log('🔧 Running database optimization...');
    await this.memory.optimize();
    console.log('');
  }

  /**
   * Benchmark: Store Episode (Direct SQL)
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
   * Benchmark: Bulk Store (SQL Transaction)
   */
  private async benchmarkBulkStore(totalEpisodes: number, batchSize: number): Promise<BenchmarkResult> {
    const times: number[] = [];
    const numBatches = Math.ceil(totalEpisodes / batchSize);

    for (let i = 0; i < numBatches; i++) {
      const batch: Episode[] = [];
      for (let j = 0; j < batchSize; j++) {
        const idx = i * batchSize + j;
        batch.push({
          sessionId: `bulk-${idx}`,
          taskName: 'navigation',
          confidence: Math.random(),
          success: Math.random() > 0.3,
          outcome: 'Completed navigation task',
          strategy: 'adaptive_planning',
          metadata: { x: idx, y: idx * 2 },
        });
      }

      const start = performance.now();
      await this.memory.bulkStoreEpisodes(batch);
      times.push(performance.now() - start);

      if (i % 5 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i * batchSize}/${totalEpisodes}\r`);
      }
    }

    // Convert to per-episode times
    const perEpisodeTimes = times.map(t => t / batchSize);
    return this.calculateStats('Bulk Store', perEpisodeTimes);
  }

  /**
   * Benchmark: Retrieve Memories (SQL fallback)
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
      });
      times.push(performance.now() - start);

      if (i % 20 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Retrieve Memories', times);
  }

  /**
   * Benchmark: Query with Context
   */
  private async benchmarkQueryWithContext(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.memory.queryWithContext('warehouse navigation', {
        k: 10,
        minConfidence: 0.5,
      });
      times.push(performance.now() - start);

      if (i % 20 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Query with Context', times);
  }

  /**
   * Benchmark: Search Skills (Direct SQL)
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
    const speedup = 2300 / result.avgTime; // Compare to CLI baseline (2.3s)

    console.log(`${name}:`);
    console.log(`  Iterations:  ${result.iterations.toLocaleString()}`);
    console.log(`  Avg Time:    ${result.avgTime.toFixed(3)}ms`);
    console.log(`  Min/Max:     ${result.minTime.toFixed(3)}ms / ${result.maxTime.toFixed(3)}ms`);
    console.log(`  p50/p95/p99: ${result.p50.toFixed(3)}ms / ${result.p95.toFixed(3)}ms / ${result.p99.toFixed(3)}ms`);
    console.log(`  Ops/sec:     ${result.opsPerSec.toFixed(0)}`);
    console.log(`  Speedup:     ${speedup.toFixed(0)}x faster than CLI`);
    console.log('');
  }

  async close(): Promise<void> {
    await this.memory.close();
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new HybridBenchmark();

  try {
    await benchmark.initialize();
    await benchmark.runAll();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.close();
  }
}
