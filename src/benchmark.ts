/**
 * Benchmark utilities
 */

import { StateGraph } from './graph';
import { State } from './state';
import { BenchmarkResult } from './types';

export class Benchmark {
  /**
   * Run a benchmark for a given operation
   */
  static async run(
    name: string,
    operation: () => Promise<void> | void,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      await Promise.resolve(operation());
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await Promise.resolve(operation());
      const end = performance.now();
      times.push(end - start);
    }

    return Benchmark.calculateStats(name, times, 'ms');
  }

  /**
   * Benchmark graph compilation
   */
  static async benchmarkCompilation(iterations: number = 100): Promise<BenchmarkResult> {
    return this.run('Graph Compilation', () => {
      const graph = new StateGraph({ name: 'BenchGraph' });
      graph.addNode('node1', (s) => s);
      graph.addNode('node2', (s) => s);
      graph.addEdge('node1', 'node2');
      graph.setEntry('node1');
      graph.setFinish('node2');
      graph.compile();
    }, iterations);
  }

  /**
   * Benchmark node execution
   */
  static async benchmarkNodeExecution(iterations: number = 100): Promise<BenchmarkResult> {
    const graph = new StateGraph({ name: 'ExecGraph' });
    graph.addNode('node1', (state: any) => ({ ...state, count: (state.count || 0) + 1 }));
    graph.setEntry('node1');
    graph.setFinish('node1');
    graph.compile();

    return this.run('Node Execution', async () => {
      await graph.invoke({ count: 0 });
    }, iterations);
  }

  /**
   * Benchmark multi-node execution
   */
  static async benchmarkMultiNode(nodeCount: number, iterations: number = 100): Promise<BenchmarkResult> {
    const graph = new StateGraph({ name: `MultiGraph_${nodeCount}` });

    // Create chain of nodes
    for (let i = 0; i < nodeCount; i++) {
      const nodeName = `node${i}`;
      graph.addNode(nodeName, (state: any) => ({ ...state, count: (state.count || 0) + 1 }));

      if (i > 0) {
        graph.addEdge(`node${i - 1}`, nodeName);
      }
    }

    graph.setEntry('node0');
    graph.setFinish(`node${nodeCount - 1}`);
    graph.compile();

    return this.run(`Multi-Node (${nodeCount} nodes)`, async () => {
      await graph.invoke({ count: 0 });
    }, iterations);
  }

  /**
   * Benchmark state operations
   */
  static async benchmarkStateOperations(iterations: number = 10000): Promise<{
    creation: BenchmarkResult;
    set: BenchmarkResult;
    get: BenchmarkResult;
  }> {
    const creation = await this.run('State Creation', () => {
      new State({ test: 'value' });
    }, iterations);

    const state = new State();
    const set = await this.run('State Set', () => {
      state.set('key', 'value');
    }, iterations);

    const get = await this.run('State Get', () => {
      state.get('key');
    }, iterations);

    return { creation, set, get };
  }

  /**
   * Run comprehensive benchmark suite
   */
  static async runAll(): Promise<{
    compilation: BenchmarkResult;
    singleNode: BenchmarkResult;
    multiNode: Record<number, BenchmarkResult>;
    stateOps: {
      creation: BenchmarkResult;
      set: BenchmarkResult;
      get: BenchmarkResult;
    };
  }> {
    console.log('Running comprehensive benchmark suite...\n');

    console.log('1. Graph Compilation...');
    const compilation = await this.benchmarkCompilation();

    console.log('2. Single Node Execution...');
    const singleNode = await this.benchmarkNodeExecution();

    console.log('3. Multi-Node Execution...');
    const multiNode: Record<number, BenchmarkResult> = {};
    for (const count of [2, 5, 10, 20]) {
      console.log(`   - ${count} nodes...`);
      multiNode[count] = await this.benchmarkMultiNode(count);
    }

    console.log('4. State Operations...');
    const stateOps = await this.benchmarkStateOperations();

    console.log('\n✓ Benchmark suite completed\n');

    return {
      compilation,
      singleNode,
      multiNode,
      stateOps
    };
  }

  /**
   * Calculate statistics from timing data
   */
  private static calculateStats(
    operation: string,
    times: number[],
    unit: 'ms' | 'μs' | 'ns'
  ): BenchmarkResult {
    times.sort((a, b) => a - b);

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const min = times[0];
    const max = times[times.length - 1];

    // Calculate standard deviation
    const squaredDiffs = times.map(time => Math.pow(time - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(variance);

    return {
      operation,
      iterations: times.length,
      mean,
      median,
      min,
      max,
      stdDev,
      unit
    };
  }

  /**
   * Format benchmark results for display
   */
  static formatResults(result: BenchmarkResult): string {
    const { operation, mean, median, min, max, unit } = result;
    return `
${operation}:
  Mean:   ${mean.toFixed(3)} ${unit}
  Median: ${median.toFixed(3)} ${unit}
  Min:    ${min.toFixed(3)} ${unit}
  Max:    ${max.toFixed(3)} ${unit}
    `.trim();
  }

  /**
   * Format all results as a report
   */
  static formatReport(results: any): string {
    let report = '======================================================================\n';
    report += 'Agentic Flow Benchmark Results\n';
    report += '======================================================================\n\n';

    report += '1. Graph Compilation\n';
    report += '----------------------------------------------------------------------\n';
    report += this.formatResults(results.compilation) + '\n\n';

    report += '2. Single Node Execution\n';
    report += '----------------------------------------------------------------------\n';
    report += this.formatResults(results.singleNode) + '\n\n';

    report += '3. Multi-Node Execution\n';
    report += '----------------------------------------------------------------------\n';
    for (const [count, result] of Object.entries(results.multiNode)) {
      report += `  ${count} nodes:\n`;
      report += `    Mean: ${(result as BenchmarkResult).mean.toFixed(3)} ms\n`;
    }
    report += '\n';

    report += '4. State Operations (10000 iterations)\n';
    report += '----------------------------------------------------------------------\n';
    report += `  Creation - Mean: ${results.stateOps.creation.mean.toFixed(3)} μs\n`;
    report += `  Set      - Mean: ${results.stateOps.set.mean.toFixed(3)} μs\n`;
    report += `  Get      - Mean: ${results.stateOps.get.mean.toFixed(3)} μs\n\n`;

    report += '======================================================================\n';

    return report;
  }
}
