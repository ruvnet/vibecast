/**
 * Comprehensive Benchmark Suite
 *
 * Benchmarks AgentDB and agentic-flow integration performance
 */

import { EnhancedAgentDBMemory, Episode } from './enhanced-memory.js';
import { FlowOrchestrator, AgentTask } from './flow-orchestrator.js';

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
  agenticFlow: {
    executeTask: BenchmarkResult;
    executeSwarm: BenchmarkResult;
    coordinateRobots: BenchmarkResult;
    reasonAboutTask: BenchmarkResult;
  };
  overall: {
    totalTime: number;
    timestamp: string;
  };
}

export class IntegrationBenchmark {
  private memory: EnhancedAgentDBMemory;
  private orchestrator: FlowOrchestrator;

  constructor() {
    this.memory = new EnhancedAgentDBMemory('./benchmark-memory.db');
    this.orchestrator = new FlowOrchestrator({
      numAgents: 66,
      strategy: 'adaptive',
      reasoningEnabled: true,
      learningEnabled: true,
    });
  }

  async initialize(): Promise<void> {
    console.log('🏁 Initializing benchmark suite...\n');
    await this.memory.initialize();
    await this.orchestrator.initialize();
    console.log('✅ Benchmark suite ready\n');
  }

  /**
   * Run complete benchmark suite
   */
  async runAll(): Promise<BenchmarkSuite> {
    const suiteStartTime = Date.now();

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│   Integration Benchmark Suite                           │');
    console.log('│   AgentDB + agentic-flow Performance Test               │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // AgentDB Benchmarks
    console.log('📊 AGENTDB BENCHMARKS\n');

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

    // agentic-flow Benchmarks
    console.log('\n🌊 AGENTIC-FLOW BENCHMARKS\n');

    const executeTask = await this.benchmarkExecuteTask(100);
    this.printResult('Execute Task', executeTask);

    const executeSwarm = await this.benchmarkExecuteSwarm(20);
    this.printResult('Execute Swarm', executeSwarm);

    const coordinateRobots = await this.benchmarkCoordinateRobots(50);
    this.printResult('Coordinate Robots', coordinateRobots);

    const reasonAboutTask = await this.benchmarkReasonAboutTask(100);
    this.printResult('Reason About Task', reasonAboutTask);

    const totalTime = Date.now() - suiteStartTime;

    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│   BENCHMARK COMPLETE                                    │');
    console.log(`│   Total Time: ${(totalTime / 1000).toFixed(2)}s                                 │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    return {
      agentdb: {
        storeEpisode,
        retrieveMemories,
        queryWithContext,
        consolidateSkills,
        searchSkills,
      },
      agenticFlow: {
        executeTask,
        executeSwarm,
        coordinateRobots,
        reasonAboutTask,
      },
      overall: {
        totalTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Benchmark: Store Episode
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

      const start = Date.now();
      await this.memory.storeEpisode(episode);
      times.push(Date.now() - start);

      if (i % 100 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Store Episode', times);
  }

  /**
   * Benchmark: Retrieve Memories
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

      const start = Date.now();
      await this.memory.retrieveMemories(query, 5, {
        onlySuccesses: true,
        synthesizeContext: true,
      });
      times.push(Date.now() - start);

      if (i % 50 === 0 && i > 0) {
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
      const start = Date.now();
      await this.memory.queryWithContext('warehouse navigation', {
        k: 10,
        minConfidence: 0.5,
        synthesizeReasoning: true,
      });
      times.push(Date.now() - start);

      if (i % 30 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Query with Context', times);
  }

  /**
   * Benchmark: Consolidate Skills
   */
  private async benchmarkConsolidateSkills(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.memory.consolidateSkills({
        minAttempts: 3,
        minReward: 0.7,
        timeWindowDays: 7,
        enablePruning: true,
      });
      times.push(Date.now() - start);

      if (i % 2 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Consolidate Skills', times);
  }

  /**
   * Benchmark: Search Skills
   */
  private async benchmarkSearchSkills(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.memory.searchSkills('navigation', {
        k: 5,
        minSuccessRate: 0.5,
        sortBy: 'success_rate',
      });
      times.push(Date.now() - start);

      if (i % 20 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Search Skills', times);
  }

  /**
   * Benchmark: Execute Task
   */
  private async benchmarkExecuteTask(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const task: AgentTask = {
        id: `task-${i}`,
        type: 'navigation',
        priority: 'medium',
        params: { target: { x: i, y: i * 2 } },
        timeout: 5000,
      };

      const start = Date.now();
      await this.orchestrator.executeTask(task);
      times.push(Date.now() - start);

      if (i % 10 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Execute Task', times);
  }

  /**
   * Benchmark: Execute Swarm
   */
  private async benchmarkExecuteSwarm(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const tasks: AgentTask[] = Array.from({ length: 5 }, (_, j) => ({
        id: `swarm-${i}-${j}`,
        type: 'patrol',
        priority: 'medium',
        params: { area: j },
      }));

      const start = Date.now();
      await this.orchestrator.executeSwarm(tasks);
      times.push(Date.now() - start);

      if (i % 5 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Execute Swarm', times);
  }

  /**
   * Benchmark: Coordinate Robots
   */
  private async benchmarkCoordinateRobots(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.orchestrator.coordinateRobots(
        ['robot1', 'robot2', 'robot3'],
        {
          type: 'warehouse_inventory',
          objectives: ['scan', 'count', 'report'],
        }
      );
      times.push(Date.now() - start);

      if (i % 10 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Coordinate Robots', times);
  }

  /**
   * Benchmark: Reason About Task
   */
  private async benchmarkReasonAboutTask(iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.orchestrator.reasonAboutTask(
        'Should robot prioritize speed or accuracy?',
        {
          useMemory: true,
          synthesizeStrategy: true,
          explainReasoning: true,
        }
      );
      times.push(Date.now() - start);

      if (i % 10 === 0 && i > 0) {
        process.stderr.write(`  Progress: ${i}/${iterations}\r`);
      }
    }

    return this.calculateStats('Reason About Task', times);
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
    await this.orchestrator.close();
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new IntegrationBenchmark();

  try {
    await benchmark.initialize();
    const results = await benchmark.runAll();
    await benchmark.exportResults(results, './benchmark-results.json');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.close();
  }
}
