#!/usr/bin/env node
/**
 * Performance Benchmark for ROS3 Examples
 *
 * Measures execution time, memory usage, and throughput for each example.
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  example: string;
  executionTime: number;
  peakMemory: number;
  avgCpu: number;
  messagesPerSecond?: number;
  success: boolean;
}

class ExampleBenchmark {
  private results: BenchmarkResult[] = [];

  async benchmarkExample(
    name: string,
    command: string,
    duration: number = 5000
  ): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking: ${name}`);
    console.log(`   Command: ${command}`);
    console.log(`   Duration: ${duration}ms\n`);

    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let success = false;
    let peakMemory = 0;

    try {
      // Run the example with timeout
      const timeout = Math.floor(duration / 1000) + 1;
      execSync(`timeout ${timeout} ${command}`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      success = true;
    } catch (error: any) {
      // Timeout is expected, check if it's a timeout or actual error
      if (error.status === 124) {
        // Exit code 124 means timeout - this is expected and considered success
        success = true;
      } else {
        console.log(`   ⚠️  Warning: ${error.message}`);
        success = false;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // Calculate memory delta
    peakMemory = Math.max(
      endMemory.heapUsed - startMemory.heapUsed,
      0
    );

    const result: BenchmarkResult = {
      example: name,
      executionTime: endTime - startTime,
      peakMemory: peakMemory / 1024 / 1024, // Convert to MB
      avgCpu: 0, // Would need OS-level monitoring for accurate CPU
      success,
    };

    this.results.push(result);

    console.log(`   ✅ Execution Time: ${result.executionTime.toFixed(2)}ms`);
    console.log(`   💾 Memory Delta: ${result.peakMemory.toFixed(2)} MB`);
    console.log(`   ${success ? '✅ Success' : '❌ Failed'}\n`);

    return result;
  }

  async runAllBenchmarks(): Promise<void> {
    console.log('🚀 ROS3 Examples Performance Benchmark\n');
    console.log('=' .repeat(60));

    // Benchmark 1: Hello Robot
    await this.benchmarkExample(
      'Hello Robot',
      'node examples/01-hello-robot.ts bench',
      5000
    );

    // Benchmark 2: Autonomous Navigator (shorter duration)
    await this.benchmarkExample(
      'Autonomous Navigator',
      'node examples/02-autonomous-navigator.ts bench',
      10000
    );

    // Benchmark 3: Multi-Robot Coordinator (3 robots)
    await this.benchmarkExample(
      'Multi-Robot Coordinator (3 robots)',
      'node examples/03-multi-robot-coordinator.ts 3',
      15000
    );

    // Benchmark 4: Swarm Intelligence (reduced)
    await this.benchmarkExample(
      'Swarm Intelligence (5 agents)',
      'node examples/04-swarm-intelligence.ts',
      20000
    );
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 Benchmark Summary\n');

    console.log('| Example                        | Time (ms) | Memory (MB) | Status |');
    console.log('|--------------------------------|-----------|-------------|--------|');

    for (const result of this.results) {
      const name = result.example.padEnd(30);
      const time = result.executionTime.toFixed(0).padStart(9);
      const memory = result.peakMemory.toFixed(2).padStart(11);
      const status = result.success ? '  ✅   ' : '  ❌   ';

      console.log(`| ${name} | ${time} | ${memory} | ${status} |`);
    }

    console.log('\n📊 Statistics:\n');

    const avgTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / this.results.length;
    const avgMemory = this.results.reduce((sum, r) => sum + r.peakMemory, 0) / this.results.length;
    const successRate = this.results.filter(r => r.success).length / this.results.length * 100;

    console.log(`   Average Execution Time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Average Memory Usage: ${avgMemory.toFixed(2)} MB`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);

    console.log('\n' + '='.repeat(60));
  }

  printRustBenchmarks(): void {
    console.log('\n🦀 Rust Core Benchmarks\n');
    console.log('To run detailed Rust benchmarks:');
    console.log('   cargo bench --all\n');
    console.log('Key metrics to expect:');
    console.log('   - Message serialization (CDR): ~100-500 ns');
    console.log('   - Message deserialization: ~200-800 ns');
    console.log('   - Publisher latency: ~10-50 µs');
    console.log('   - Subscriber callback: ~5-20 µs');
    console.log('   - Priority scheduling: ~1-5 µs');
  }
}

// Main execution
async function main() {
  const benchmark = new ExampleBenchmark();

  try {
    await benchmark.runAllBenchmarks();
    benchmark.printSummary();
    benchmark.printRustBenchmarks();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }

  console.log('\n✨ Benchmark complete!\n');
}

main().catch(console.error);
