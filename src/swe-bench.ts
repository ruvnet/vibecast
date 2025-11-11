/**
 * SWE-Bench: Comprehensive Software Engineering Benchmarks
 * Tests performance, correctness, scalability, and reliability
 */

import { StateGraph, MessageGraph } from './graph';
import { State } from './state';
import { AgentDB } from './agentdb';
import { Benchmark } from './benchmark';
import chalk from 'chalk';
// @ts-ignore
import Table from 'cli-table3';

interface BenchmarkSuite {
  name: string;
  tests: BenchmarkTest[];
}

interface BenchmarkTest {
  name: string;
  fn: () => Promise<TestResult>;
  category: 'performance' | 'correctness' | 'scalability' | 'reliability';
}

interface TestResult {
  passed: boolean;
  time: number;
  memory?: number;
  score?: number;
  error?: string;
  details?: any;
}

class SWEBench {
  private results: Map<string, TestResult[]> = new Map();
  private startMemory: number = 0;

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024);
  }

  /**
   * Run a single test with timing and memory tracking
   */
  private async runTest(test: BenchmarkTest): Promise<TestResult> {
    const startMem = this.getMemoryUsage();
    const start = performance.now();

    try {
      const result = await test.fn();
      const end = performance.now();
      const endMem = this.getMemoryUsage();

      return {
        ...result,
        time: end - start,
        memory: endMem - startMem
      };
    } catch (error: any) {
      const end = performance.now();
      return {
        passed: false,
        time: end - start,
        error: error.message
      };
    }
  }

  /**
   * Performance Tests
   */
  private getPerformanceTests(): BenchmarkTest[] {
    return [
      {
        name: 'Graph Construction Speed',
        category: 'performance',
        fn: async () => {
          const iterations = 1000;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            const graph = new StateGraph({ name: `graph-${i}` });
            graph.addNode('start', (s) => s);
            graph.addNode('end', (s) => s);
            graph.addEdge('start', 'end');
            graph.setEntry('start');
            graph.setFinish('end');
            graph.compile();
          }

          const end = performance.now();
          const timePerOp = (end - start) / iterations;

          return {
            passed: timePerOp < 0.1, // Should be under 0.1ms per graph
            time: end - start,
            score: 1000 / timePerOp,
            details: { iterations, timePerOp: `${timePerOp.toFixed(4)}ms` }
          };
        }
      },
      {
        name: 'Simple Execution Speed',
        category: 'performance',
        fn: async () => {
          const graph = new StateGraph({ name: 'exec-test' });
          graph.addNode('process', (state: any) => ({ ...state, processed: true }));
          graph.setEntry('process');
          graph.setFinish('process');
          graph.compile();

          const iterations = 1000;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            await graph.invoke({ value: i });
          }

          const end = performance.now();
          const timePerOp = (end - start) / iterations;

          return {
            passed: timePerOp < 1.0, // Should be under 1ms per execution
            time: end - start,
            score: 1000 / timePerOp,
            details: { iterations, timePerOp: `${timePerOp.toFixed(4)}ms` }
          };
        }
      },
      {
        name: 'Complex Workflow (50 nodes)',
        category: 'performance',
        fn: async () => {
          const graph = new StateGraph({ name: 'complex' });

          // Build a chain of 50 nodes
          for (let i = 0; i < 50; i++) {
            graph.addNode(`node${i}`, (state: any) => ({
              ...state,
              count: (state.count || 0) + 1
            }));

            if (i > 0) {
              graph.addEdge(`node${i-1}`, `node${i}`);
            }
          }

          graph.setEntry('node0');
          graph.setFinish('node49');
          graph.compile();

          const iterations = 100;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            await graph.invoke({ count: 0 });
          }

          const end = performance.now();
          const timePerOp = (end - start) / iterations;

          return {
            passed: timePerOp < 50, // Should be under 50ms for 50 nodes
            time: end - start,
            score: 10000 / timePerOp,
            details: { iterations, nodes: 50, timePerOp: `${timePerOp.toFixed(2)}ms` }
          };
        }
      },
      {
        name: 'State Operations Throughput',
        category: 'performance',
        fn: async () => {
          const state = new State();
          const iterations = 100000;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            state.set(`key${i % 1000}`, { value: i });
            state.get(`key${i % 1000}`);
          }

          const end = performance.now();
          const opsPerSecond = (iterations * 2) / ((end - start) / 1000);

          return {
            passed: opsPerSecond > 500000, // Should handle 500k+ ops/sec
            time: end - start,
            score: opsPerSecond,
            details: { operations: iterations * 2, opsPerSecond: Math.round(opsPerSecond) }
          };
        }
      }
    ];
  }

  /**
   * Correctness Tests
   */
  private getCorrectnessTests(): BenchmarkTest[] {
    return [
      {
        name: 'Linear Workflow Correctness',
        category: 'correctness',
        fn: async () => {
          const graph = new StateGraph({ name: 'linear' });

          graph.addNode('step1', (s: any) => ({ ...s, step1: true }));
          graph.addNode('step2', (s: any) => ({ ...s, step2: true }));
          graph.addNode('step3', (s: any) => ({ ...s, step3: true }));

          graph.addEdge('step1', 'step2');
          graph.addEdge('step2', 'step3');
          graph.setEntry('step1');
          graph.setFinish('step3');
          graph.compile();

          const result = await graph.invoke({});

          const passed = result.state.step1 === true &&
                        result.state.step2 === true &&
                        result.state.step3 === true;

          return {
            passed,
            time: result.executionTime,
            details: { finalState: result.state, nodesExecuted: result.nodesExecuted }
          };
        }
      },
      {
        name: 'Conditional Branching',
        category: 'correctness',
        fn: async () => {
          const graph = new StateGraph({ name: 'conditional' });

          graph.addNode('start', (s: any) => ({ ...s, value: 10 }));
          graph.addNode('high', (s: any) => ({ ...s, branch: 'high' }));
          graph.addNode('low', (s: any) => ({ ...s, branch: 'low' }));

          graph.addNode('end', (s: any) => s);

          // Use conditional edges properly
          graph.addConditionalEdge('start', 'high', (state: any) => state.value > 5);
          graph.addConditionalEdge('start', 'low', (state: any) => state.value <= 5);
          graph.addEdge('high', 'end');
          graph.addEdge('low', 'end');

          graph.setEntry('start');
          graph.setFinish('end');
          graph.compile();
          graph.compile();

          const result = await graph.invoke({});

          return {
            passed: result.state.branch === 'high',
            time: result.executionTime,
            details: { branch: result.state.branch, value: result.state.value }
          };
        }
      },
      {
        name: 'State Persistence',
        category: 'correctness',
        fn: async () => {
          const graph = new StateGraph({ name: 'persistence' });

          graph.addNode('add', (s: any) => ({ ...s, count: (s.count || 0) + 1 }));
          graph.addNode('multiply', (s: any) => ({ ...s, count: s.count * 2 }));

          graph.addEdge('add', 'multiply');
          graph.setEntry('add');
          graph.setFinish('multiply');
          graph.compile();

          const result = await graph.invoke({ count: 5 });

          // (5 + 1) * 2 = 12
          return {
            passed: result.state.count === 12,
            time: result.executionTime,
            details: { expected: 12, actual: result.state.count }
          };
        }
      },
      {
        name: 'Error Handling',
        category: 'correctness',
        fn: async () => {
          const graph = new StateGraph({ name: 'error' });

          graph.addNode('safe', (s: any) => ({ ...s, safe: true }));
          graph.addNode('error', (s: any) => {
            throw new Error('Intentional error');
          });

          graph.addEdge('safe', 'error');
          graph.setEntry('safe');
          graph.setFinish('error');
          graph.compile();

          try {
            await graph.invoke({});
            return { passed: false, time: 0, error: 'Should have thrown error' };
          } catch (error: any) {
            return {
              passed: error.message.includes('Intentional error'),
              time: 0,
              details: { errorMessage: error.message }
            };
          }
        }
      }
    ];
  }

  /**
   * Scalability Tests
   */
  private getScalabilityTests(): BenchmarkTest[] {
    return [
      {
        name: 'Large Graph (1000 nodes)',
        category: 'scalability',
        fn: async () => {
          const nodeCount = 1000;
          const graph = new StateGraph({ name: 'large' });

          const start = performance.now();

          // Build large graph
          for (let i = 0; i < nodeCount; i++) {
            graph.addNode(`node${i}`, (s: any) => ({ ...s, visited: (s.visited || 0) + 1 }));
            if (i > 0 && i % 10 === 0) {
              // Create branching structure
              graph.addEdge(`node${i - 10}`, `node${i}`);
            } else if (i > 0) {
              graph.addEdge(`node${i - 1}`, `node${i}`);
            }
          }

          graph.setEntry('node0');
          graph.setFinish(`node${nodeCount - 1}`);
          graph.compile();

          const compileTime = performance.now() - start;

          // Execute once
          const execStart = performance.now();
          const result = await graph.invoke({});
          const execTime = performance.now() - execStart;

          return {
            passed: compileTime < 1000 && execTime < 5000, // Reasonable limits
            time: compileTime + execTime,
            details: {
              nodes: nodeCount,
              compileTime: `${compileTime.toFixed(2)}ms`,
              execTime: `${execTime.toFixed(2)}ms`
            }
          };
        }
      },
      {
        name: 'Concurrent Executions',
        category: 'scalability',
        fn: async () => {
          const graph = new StateGraph({ name: 'concurrent' });

          graph.addNode('process', (s: any) => ({
            ...s,
            result: (s.value || 0) * 2
          }));

          graph.setEntry('process');
          graph.setFinish('process');
          graph.compile();

          const concurrentCount = 100;
          const start = performance.now();

          // Run 100 concurrent executions
          const promises = Array.from({ length: concurrentCount }, (_, i) =>
            graph.invoke({ value: i })
          );

          const results = await Promise.all(promises);
          const end = performance.now();

          // Verify all results are correct
          const allCorrect = results.every((r, i) => r.state.result === i * 2);

          return {
            passed: allCorrect && (end - start) < 5000,
            time: end - start,
            score: concurrentCount / ((end - start) / 1000),
            details: {
              concurrent: concurrentCount,
              timeTotal: `${(end - start).toFixed(2)}ms`,
              avgPerExec: `${((end - start) / concurrentCount).toFixed(2)}ms`
            }
          };
        }
      },
      {
        name: 'Memory Efficiency',
        category: 'scalability',
        fn: async () => {
          const startMem = this.getMemoryUsage();
          const graphs = [];

          // Create 1000 graphs
          for (let i = 0; i < 1000; i++) {
            const graph = new StateGraph({ name: `graph-${i}` });
            graph.addNode('node', (s) => s);
            graph.setEntry('node');
            graph.setFinish('node');
            graph.compile();
            graphs.push(graph);
          }

          const endMem = this.getMemoryUsage();
          const memoryUsed = endMem - startMem;
          const memPerGraph = memoryUsed / 1000;

          return {
            passed: memPerGraph < 0.1, // Less than 100KB per graph
            time: 0,
            memory: memoryUsed,
            details: {
              graphs: 1000,
              totalMemory: `${memoryUsed}MB`,
              memPerGraph: `${(memPerGraph * 1024).toFixed(2)}KB`
            }
          };
        }
      }
    ];
  }

  /**
   * Reliability Tests
   */
  private getReliabilityTests(): BenchmarkTest[] {
    return [
      {
        name: 'Stress Test (10k iterations)',
        category: 'reliability',
        fn: async () => {
          const graph = new StateGraph({ name: 'stress' });

          graph.addNode('work', (s: any) => ({
            ...s,
            count: (s.count || 0) + 1
          }));

          graph.setEntry('work');
          graph.setFinish('work');
          graph.compile();

          const iterations = 10000;
          let failures = 0;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            try {
              await graph.invoke({ count: 0 });
            } catch {
              failures++;
            }
          }

          const end = performance.now();

          return {
            passed: failures === 0,
            time: end - start,
            score: iterations / ((end - start) / 1000),
            details: {
              iterations,
              failures,
              successRate: `${((1 - failures / iterations) * 100).toFixed(2)}%`
            }
          };
        }
      },
      {
        name: 'Edge Case: Empty State',
        category: 'reliability',
        fn: async () => {
          const graph = new StateGraph({ name: 'empty' });

          graph.addNode('process', (s: any) => ({ value: 'created' }));
          graph.setEntry('process');
          graph.setFinish('process');
          graph.compile();

          const result = await graph.invoke({});

          return {
            passed: result.state.value === 'created',
            time: result.executionTime,
            details: { state: result.state }
          };
        }
      },
      {
        name: 'Edge Case: Deep State Objects',
        category: 'reliability',
        fn: async () => {
          const graph = new StateGraph({ name: 'deep' });

          graph.addNode('deep', (s: any) => ({
            ...s,
            level1: {
              level2: {
                level3: {
                  level4: {
                    value: 'deep'
                  }
                }
              }
            }
          }));

          graph.setEntry('deep');
          graph.setFinish('deep');
          graph.compile();

          const result = await graph.invoke({});

          return {
            passed: result.state.level1?.level2?.level3?.level4?.value === 'deep',
            time: result.executionTime,
            details: { deepValue: result.state.level1?.level2?.level3?.level4?.value }
          };
        }
      }
    ];
  }

  /**
   * Run all benchmark suites
   */
  async runAll(): Promise<void> {
    console.log(chalk.bold.green('\n🚀 Starting SWE-Bench Comprehensive Test Suite\n'));

    const suites: BenchmarkSuite[] = [
      { name: 'Performance', tests: this.getPerformanceTests() },
      { name: 'Correctness', tests: this.getCorrectnessTests() },
      { name: 'Scalability', tests: this.getScalabilityTests() },
      { name: 'Reliability', tests: this.getReliabilityTests() }
    ];

    let totalTests = 0;
    let totalPassed = 0;
    let totalTime = 0;

    for (const suite of suites) {
      console.log(chalk.cyan(`\n📋 ${suite.name} Tests\n`));

      const results: TestResult[] = [];

      for (const test of suite.tests) {
        process.stdout.write(`  ${test.name}... `);

        const result = await this.runTest(test);
        results.push(result);
        totalTests++;
        totalTime += result.time;

        if (result.passed) {
          totalPassed++;
          console.log(chalk.green('✓') + chalk.gray(` (${result.time.toFixed(2)}ms)`));
        } else {
          console.log(chalk.red('✗') + chalk.gray(` (${result.time.toFixed(2)}ms)`));
          if (result.error) {
            console.log(chalk.red(`    Error: ${result.error}`));
          }
        }

        if (result.details) {
          for (const [key, value] of Object.entries(result.details)) {
            console.log(chalk.gray(`    ${key}: ${value}`));
          }
        }
      }

      this.results.set(suite.name, results);
    }

    // Summary
    this.displaySummary(totalTests, totalPassed, totalTime);
  }

  /**
   * Display comprehensive summary
   */
  private displaySummary(totalTests: number, totalPassed: number, totalTime: number): void {
    console.log(chalk.bold('\n' + '='.repeat(80)));
    console.log(chalk.bold.cyan('SWE-Bench Results Summary'));
    console.log(chalk.bold('='.repeat(80) + '\n'));

    const table = new Table({
      head: [
        chalk.cyan('Category'),
        chalk.cyan('Tests'),
        chalk.cyan('Passed'),
        chalk.cyan('Failed'),
        chalk.cyan('Success Rate'),
        chalk.cyan('Avg Time')
      ],
      style: { head: [], border: [] }
    });

    for (const [category, results] of this.results) {
      const passed = results.filter(r => r.passed).length;
      const failed = results.length - passed;
      const successRate = (passed / results.length * 100).toFixed(1);
      const avgTime = (results.reduce((sum, r) => sum + r.time, 0) / results.length).toFixed(2);

      const rateColor = passed === results.length ? chalk.green :
                       passed > results.length / 2 ? chalk.yellow : chalk.red;

      table.push([
        category,
        results.length,
        chalk.green(passed),
        failed > 0 ? chalk.red(failed) : failed,
        rateColor(`${successRate}%`),
        `${avgTime}ms`
      ]);
    }

    console.log(table.toString());

    const overallRate = (totalPassed / totalTests * 100).toFixed(1);
    const rateColor = totalPassed === totalTests ? chalk.green :
                     totalPassed > totalTests / 2 ? chalk.yellow : chalk.red;

    console.log(chalk.bold('\n📊 Overall Results:'));
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${chalk.green(totalPassed)}`);
    console.log(`  Failed: ${totalPassed < totalTests ? chalk.red(totalTests - totalPassed) : 0}`);
    console.log(`  Success Rate: ${rateColor(overallRate + '%')}`);
    console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Average Time: ${(totalTime / totalTests).toFixed(2)}ms per test`);

    if (totalPassed === totalTests) {
      console.log(chalk.bold.green('\n✅ All tests passed! System is performing optimally.\n'));
    } else {
      console.log(chalk.bold.yellow(`\n⚠️  ${totalTests - totalPassed} test(s) failed. Review results above.\n`));
    }

    console.log(chalk.bold('='.repeat(80) + '\n'));
  }
}

// CLI execution
if (require.main === module) {
  const bench = new SWEBench();
  bench.runAll().catch(console.error);
}

export { SWEBench };
