#!/usr/bin/env node
/**
 * Example 8: Adaptive Learning Robot
 *
 * Demonstrates:
 * - Experience-based learning with AgentDB
 * - Strategy selection from past successes
 * - Performance improvement over time
 * - Meta-learning (learning to learn)
 * - Skill consolidation
 * - Confidence-weighted decision making
 *
 * A robot that learns optimal strategies for different tasks
 * by querying and consolidating past experiences.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Point2D {
  x: number;
  y: number;
}

interface Task {
  type: 'navigate' | 'manipulate' | 'search' | 'interact';
  target: Point2D;
  constraints: string[];
  difficulty: number;
}

interface Strategy {
  name: string;
  description: string;
  parameters: Record<string, number>;
  successRate: number;
  avgDuration: number;
  timesUsed: number;
}

interface PerformanceMetrics {
  taskType: string;
  attempt: number;
  duration: number;
  success: boolean;
  strategyUsed: string;
  confidence: number;
}

class AdaptiveLearningRobot {
  private server: ROS3McpServer;
  private robotId: string;
  private position: Point2D = { x: 0, y: 0 };
  private strategies: Map<string, Strategy[]> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private currentAttempt: number = 0;

  constructor(robotId: string) {
    this.robotId = robotId;

    this.server = new ROS3McpServer({
      name: `adaptive-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/adaptive-${robotId}.db`,
    });

    // Initialize with baseline strategies
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Navigation strategies
    this.strategies.set('navigate', [
      {
        name: 'direct_path',
        description: 'Straight line to target',
        parameters: { speed: 1.0, lookAhead: 0.5 },
        successRate: 0.5,
        avgDuration: 10.0,
        timesUsed: 0,
      },
      {
        name: 'safe_path',
        description: 'Conservative with obstacle avoidance',
        parameters: { speed: 0.5, lookAhead: 2.0 },
        successRate: 0.8,
        avgDuration: 15.0,
        timesUsed: 0,
      },
      {
        name: 'dynamic_replan',
        description: 'Continuous replanning',
        parameters: { speed: 0.7, lookAhead: 1.0 },
        successRate: 0.7,
        avgDuration: 12.0,
        timesUsed: 0,
      },
    ]);

    // Manipulation strategies
    this.strategies.set('manipulate', [
      {
        name: 'fast_grasp',
        description: 'Quick grasp attempt',
        parameters: { approachSpeed: 1.0, graspForce: 0.5 },
        successRate: 0.6,
        avgDuration: 8.0,
        timesUsed: 0,
      },
      {
        name: 'precise_grasp',
        description: 'Careful alignment before grasp',
        parameters: { approachSpeed: 0.3, graspForce: 0.8 },
        successRate: 0.9,
        avgDuration: 12.0,
        timesUsed: 0,
      },
    ]);

    // Search strategies
    this.strategies.set('search', [
      {
        name: 'random_walk',
        description: 'Random exploration',
        parameters: { turnRate: 0.5, speed: 0.8 },
        successRate: 0.4,
        avgDuration: 20.0,
        timesUsed: 0,
      },
      {
        name: 'systematic_grid',
        description: 'Grid-based search',
        parameters: { cellSize: 1.0, speed: 0.6 },
        successRate: 0.85,
        avgDuration: 18.0,
        timesUsed: 0,
      },
      {
        name: 'informed_search',
        description: 'Use prior knowledge',
        parameters: { explorationRate: 0.3, speed: 0.7 },
        successRate: 0.75,
        avgDuration: 12.0,
        timesUsed: 0,
      },
    ]);
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🧠 Adaptive Learning Robot ${this.robotId} started!`);
    console.log(`📚 Loading past experiences from memory...\n`);

    // Load and consolidate past skills
    await this.loadPastExperiences();
  }

  private async loadPastExperiences(): Promise<void> {
    try {
      // Query past successful strategies
      for (const [taskType, _] of this.strategies) {
        const memories = await this.server['memory'].queryWithContext(
          `successful ${taskType} strategy`,
          { k: 10, minConfidence: 0.7, domain: taskType }
        );

        if (memories.memories.length > 0) {
          console.log(`   📖 Loaded ${memories.memories.length} ${taskType} experiences`);

          // Update strategy success rates based on past data
          this.updateStrategiesFromMemory(taskType, memories.memories);
        }
      }

      // Consolidate skills
      const consolidated = await this.server.consolidateSkills('adaptive_learning');
      console.log(`   🔗 Consolidated ${consolidated.skillsConsolidated} skills\n`);
    } catch (error) {
      console.log(`   ℹ️  No past experiences found (first run)\n`);
    }
  }

  private updateStrategiesFromMemory(taskType: string, memories: any[]): void {
    const strategies = this.strategies.get(taskType);
    if (!strategies) return;

    // Update success rates based on historical data
    for (const strategy of strategies) {
      const relevantMemories = memories.filter(
        m => m.strategy === strategy.name
      );

      if (relevantMemories.length > 0) {
        const successCount = relevantMemories.filter(m => m.success).length;
        const newSuccessRate = successCount / relevantMemories.length;

        // Weighted average with existing rate
        strategy.successRate = strategy.successRate * 0.3 + newSuccessRate * 0.7;
        strategy.timesUsed += relevantMemories.length;

        console.log(`      ↗️  ${strategy.name}: ${(strategy.successRate * 100).toFixed(1)}% success (${strategy.timesUsed} uses)`);
      }
    }
  }

  /**
   * Select best strategy based on past performance and current context
   */
  private selectStrategy(task: Task): Strategy {
    const strategies = this.strategies.get(task.type);
    if (!strategies || strategies.length === 0) {
      throw new Error(`No strategies available for ${task.type}`);
    }

    // Multi-criteria decision making
    const scores = strategies.map(strategy => {
      const successScore = strategy.successRate * 100;

      // Efficiency score (lower duration is better)
      const maxDuration = Math.max(...strategies.map(s => s.avgDuration));
      const efficiencyScore = (1 - strategy.avgDuration / maxDuration) * 50;

      // Exploration bonus (favor less-tried strategies occasionally)
      const explorationBonus = strategy.timesUsed < 3 ? 10 : 0;

      // Difficulty adjustment
      const difficultyPenalty = task.difficulty > 0.7 && strategy.successRate < 0.8 ? -20 : 0;

      const totalScore = successScore + efficiencyScore + explorationBonus + difficultyPenalty;

      return { strategy, score: totalScore };
    });

    // Sort by score and add randomness for exploration
    scores.sort((a, b) => b.score - a.score);

    // Epsilon-greedy: 20% chance to explore
    if (Math.random() < 0.2 && scores.length > 1) {
      console.log(`   🎲 Exploring alternative strategy...`);
      return scores[1].strategy;
    }

    return scores[0].strategy;
  }

  /**
   * Execute a task with the selected strategy
   */
  private async executeTask(task: Task, strategy: Strategy): Promise<PerformanceMetrics> {
    this.currentAttempt++;

    console.log(`\n📋 Task ${this.currentAttempt}: ${task.type}`);
    console.log(`   Target: (${task.target.x.toFixed(2)}, ${task.target.y.toFixed(2)})`);
    console.log(`   Difficulty: ${(task.difficulty * 100).toFixed(0)}%`);
    console.log(`   Selected Strategy: ${strategy.name}`);
    console.log(`   Expected Success: ${(strategy.successRate * 100).toFixed(1)}%\n`);

    const startTime = Date.now();

    // Simulate task execution
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      // Move towards target with strategy parameters
      const progress = (i + 1) / steps;
      const speed = strategy.parameters.speed || 1.0;

      const dx = (task.target.x - this.position.x) * 0.1 * speed;
      const dy = (task.target.y - this.position.y) * 0.1 * speed;

      this.position.x += dx;
      this.position.y += dy;

      await new Promise(resolve => setTimeout(resolve, strategy.avgDuration * 100 / steps));

      if (i % 3 === 0) {
        console.log(`   ⏳ Progress: ${(progress * 100).toFixed(0)}%`);
      }
    }

    const duration = Date.now() - startTime;

    // Determine success (influenced by strategy success rate and task difficulty)
    const successProbability = strategy.successRate * (1 - task.difficulty * 0.3);
    const success = Math.random() < successProbability;

    // Calculate confidence based on strategy track record
    const confidence = strategy.successRate * (strategy.timesUsed > 5 ? 1.0 : 0.7);

    const metrics: PerformanceMetrics = {
      taskType: task.type,
      attempt: this.currentAttempt,
      duration,
      success,
      strategyUsed: strategy.name,
      confidence,
    };

    console.log(`\n   ${success ? '✅ SUCCESS' : '❌ FAILED'} in ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

    // Update strategy statistics
    strategy.timesUsed++;
    const alpha = 0.3; // Learning rate
    strategy.successRate = strategy.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    strategy.avgDuration = strategy.avgDuration * (1 - alpha) + duration * alpha;

    // Store experience in memory
    await this.server['memory'].storeEpisode({
      sessionId: `task-${this.currentAttempt}`,
      taskName: task.type,
      confidence,
      success,
      outcome: success ? `Completed ${task.type} task` : `Failed ${task.type} task`,
      strategy: strategy.name,
      metadata: {
        ...metrics,
        strategyParameters: strategy.parameters,
        taskDifficulty: task.difficulty,
        position: { ...this.position },
      },
    });

    this.performanceHistory.push(metrics);

    return metrics;
  }

  /**
   * Run learning session with multiple tasks
   */
  async runLearningSession(numTasks: number = 12): Promise<void> {
    console.log(`🎯 Starting adaptive learning session with ${numTasks} tasks...\n`);

    // Generate varied tasks
    const tasks: Task[] = [];
    const taskTypes: Task['type'][] = ['navigate', 'manipulate', 'search', 'navigate'];

    for (let i = 0; i < numTasks; i++) {
      tasks.push({
        type: taskTypes[i % taskTypes.length],
        target: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
        },
        constraints: [],
        difficulty: Math.random() * 0.5 + 0.3, // 0.3-0.8
      });
    }

    // Execute tasks and learn
    for (const task of tasks) {
      const strategy = this.selectStrategy(task);
      await this.executeTask(task, strategy);

      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Print learning summary
    this.printLearningSummary();
  }

  private printLearningSummary(): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Learning Session Summary\n`);

    // Overall performance
    const totalTasks = this.performanceHistory.length;
    const successfulTasks = this.performanceHistory.filter(m => m.success).length;
    const overallSuccessRate = successfulTasks / totalTasks;

    console.log(`Total Tasks: ${totalTasks}`);
    console.log(`Overall Success Rate: ${(overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`Average Confidence: ${(this.performanceHistory.reduce((sum, m) => sum + m.confidence, 0) / totalTasks * 100).toFixed(1)}%\n`);

    // Performance by task type
    console.log(`Performance by Task Type:`);
    for (const [taskType, strategies] of this.strategies) {
      const taskMetrics = this.performanceHistory.filter(m => m.taskType === taskType);
      if (taskMetrics.length === 0) continue;

      const taskSuccesses = taskMetrics.filter(m => m.success).length;
      const taskSuccessRate = taskSuccesses / taskMetrics.length;

      console.log(`\n  ${taskType.toUpperCase()}:`);
      console.log(`    Success Rate: ${(taskSuccessRate * 100).toFixed(1)}% (${taskSuccesses}/${taskMetrics.length})`);

      // Show strategy performance
      for (const strategy of strategies) {
        if (strategy.timesUsed > 0) {
          console.log(`      ${strategy.name}: ${(strategy.successRate * 100).toFixed(1)}% (used ${strategy.timesUsed}x, avg ${(strategy.avgDuration / 1000).toFixed(1)}s)`);
        }
      }
    }

    // Learning curve (first half vs second half)
    const midpoint = Math.floor(totalTasks / 2);
    const firstHalf = this.performanceHistory.slice(0, midpoint);
    const secondHalf = this.performanceHistory.slice(midpoint);

    const firstHalfSuccess = firstHalf.filter(m => m.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(m => m.success).length / secondHalf.length;
    const improvement = ((secondHalfSuccess - firstHalfSuccess) * 100);

    console.log(`\n📈 Learning Curve:`);
    console.log(`  First Half: ${(firstHalfSuccess * 100).toFixed(1)}%`);
    console.log(`  Second Half: ${(secondHalfSuccess * 100).toFixed(1)}%`);
    console.log(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);

    console.log(`\n${'='.repeat(60)}`);
  }

  async consolidateAndExport(): Promise<void> {
    console.log(`\n🔗 Consolidating learned skills...`);

    const result = await this.server.consolidateSkills('adaptive_learning');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Common Patterns: ${result.patternsFound}`);
    console.log(`\n💾 Knowledge exported to AgentDB`);
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'learner-1';
  const numTasks = parseInt(process.argv[3]) || 12;

  const robot = new AdaptiveLearningRobot(robotId);

  await robot.start();

  // Run learning session
  await robot.runLearningSession(numTasks);

  // Consolidate learned knowledge
  await robot.consolidateAndExport();

  console.log(`\n✨ Adaptive learning session complete!\n`);
  process.exit(0);
}

main().catch(console.error);
