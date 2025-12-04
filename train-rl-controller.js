#!/usr/bin/env node

/**
 * Universal RL Controller Training Pipeline
 * Train, test, benchmark, and optimize across multiple energy systems
 */

const UniversalRLController = require('./src/rl/universal-rl-controller');
const fs = require('fs').promises;
const path = require('path');

class RLTrainingPipeline {
  constructor(config = {}) {
    this.config = {
      systemType: config.systemType || 'nuclear-fission',
      systemId: config.systemId || `SYSTEM-${Date.now()}`,
      trainingEpisodes: config.trainingEpisodes || 1000,
      evaluationInterval: config.evaluationInterval || 50,
      checkpointInterval: config.checkpointInterval || 100,
      algorithm: config.algorithm || 'PPO',
      ...config
    };

    this.controller = null;
    this.trainingMetrics = {
      episodes: [],
      rewards: [],
      losses: [],
      safetyViolations: [],
      evaluations: []
    };
  }

  /**
   * Initialize the RL controller
   */
  async initialize() {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   UNIVERSAL RL ENERGY CONTROLLER - TRAINING PIPELINE          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`System Type: ${this.config.systemType}`);
    console.log(`Algorithm: ${this.config.algorithm}`);
    console.log(`Training Episodes: ${this.config.trainingEpisodes}`);
    console.log(`System ID: ${this.config.systemId}\n`);

    this.controller = new UniversalRLController({
      systemType: this.config.systemType,
      systemId: this.config.systemId,
      algorithm: this.config.algorithm,
      stateDim: 64,
      actionDim: 16
    });

    console.log('✓ Controller initialized\n');
  }

  /**
   * Run full training pipeline
   */
  async train() {
    console.log('═'.repeat(70));
    console.log('TRAINING PHASE');
    console.log('═'.repeat(70));

    const startTime = Date.now();

    for (let episode = 1; episode <= this.config.trainingEpisodes; episode++) {
      // Train one episode
      const result = await this.controller.trainEpisode();

      this.trainingMetrics.episodes.push(episode);
      this.trainingMetrics.rewards.push(result.episodeReward);

      // Log progress
      if (episode % 10 === 0) {
        console.log(
          `Episode ${episode}/${this.config.trainingEpisodes} | ` +
          `Reward: ${result.episodeReward.toFixed(2)} | ` +
          `Avg(100): ${result.avgReward.toFixed(2)} | ` +
          `Steps: ${result.steps}`
        );
      }

      // Periodic evaluation
      if (episode % this.config.evaluationInterval === 0) {
        console.log(`\n--- Evaluation at Episode ${episode} ---`);
        const evalResult = await this.controller.evaluate(10);

        this.trainingMetrics.evaluations.push({
          episode,
          avgReward: evalResult.avgReward,
          stdReward: evalResult.stdReward
        });

        console.log(`Eval Reward: ${evalResult.avgReward.toFixed(2)} ± ${evalResult.stdReward.toFixed(2)}`);
        console.log(`Eval Steps: ${evalResult.avgSteps.toFixed(0)}\n`);
      }

      // Save checkpoints
      if (episode % this.config.checkpointInterval === 0) {
        await this.controller.saveCheckpoint(`episode-${episode}`);
        await this.saveTrainingMetrics();
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000 / 60;

    console.log(`\n✓ Training complete in ${duration.toFixed(2)} minutes\n`);

    return this.trainingMetrics;
  }

  /**
   * Test the trained controller
   */
  async test(numEpisodes = 50) {
    console.log('\n═'.repeat(70));
    console.log('TESTING PHASE');
    console.log('═'.repeat(70));

    const testResults = await this.controller.evaluate(numEpisodes);

    console.log(`\nTest Results (${numEpisodes} episodes):`);
    console.log(`  Average Reward: ${testResults.avgReward.toFixed(2)}`);
    console.log(`  Std Deviation: ${testResults.stdReward.toFixed(2)}`);
    console.log(`  Average Steps: ${testResults.avgSteps.toFixed(0)}`);

    // Safety analysis
    const metrics = this.controller.getMetrics();
    console.log(`  Safety Violations: ${metrics.safetyViolations}`);
    console.log(`  Success Rate: ${metrics.successRate.toFixed(2)}%\n`);

    return testResults;
  }

  /**
   * Benchmark against baseline controllers
   */
  async benchmark() {
    console.log('\n═'.repeat(70));
    console.log('BENCHMARKING PHASE');
    console.log('═'.repeat(70));
    console.log('\nComparing RL Controller vs Traditional Control\n');

    const numTrials = 20;

    // 1. RL Controller performance
    console.log('1. Testing RL Controller...');
    const rlResults = await this.controller.evaluate(numTrials);

    // 2. Baseline: PID Controller (simplified)
    console.log('2. Testing PID Baseline...');
    const pidResults = await this.benchmarkPID(numTrials);

    // 3. Baseline: Rule-based Controller
    console.log('3. Testing Rule-Based Baseline...');
    const ruleResults = await this.benchmarkRuleBased(numTrials);

    // 4. Baseline: Random Actions
    console.log('4. Testing Random Baseline...');
    const randomResults = await this.benchmarkRandom(numTrials);

    // Compare results
    console.log('\n' + '═'.repeat(70));
    console.log('BENCHMARK RESULTS');
    console.log('═'.repeat(70));

    const comparison = {
      'RL Controller': {
        avgReward: rlResults.avgReward,
        stdReward: rlResults.stdReward,
        improvement: 0 // Baseline
      },
      'PID Controller': {
        avgReward: pidResults.avgReward,
        stdReward: pidResults.stdReward,
        improvement: ((rlResults.avgReward - pidResults.avgReward) / Math.abs(pidResults.avgReward) * 100)
      },
      'Rule-Based': {
        avgReward: ruleResults.avgReward,
        stdReward: ruleResults.stdReward,
        improvement: ((rlResults.avgReward - ruleResults.avgReward) / Math.abs(ruleResults.avgReward) * 100)
      },
      'Random': {
        avgReward: randomResults.avgReward,
        stdReward: randomResults.avgReward,
        improvement: ((rlResults.avgReward - randomResults.avgReward) / Math.abs(randomResults.avgReward) * 100)
      }
    };

    console.log('\n| Controller         | Avg Reward  | Std Dev     | Improvement |');
    console.log('|-------------------|-------------|-------------|-------------|');

    for (const [name, results] of Object.entries(comparison)) {
      console.log(
        `| ${name.padEnd(17)} | ` +
        `${results.avgReward.toFixed(2).padStart(11)} | ` +
        `${results.stdReward.toFixed(2).padStart(11)} | ` +
        `${results.improvement >= 0 ? '+' : ''}${results.improvement.toFixed(1)}%`.padStart(11) +
        ` |`
      );
    }

    console.log('');

    // Save benchmark results
    await this.saveBenchmarkResults(comparison);

    return comparison;
  }

  /**
   * Benchmark PID controller
   */
  async benchmarkPID(numTrials) {
    const results = [];

    for (let i = 0; i < numTrials; i++) {
      let state = await this.controller.systemAdapter.reset();
      let episodeReward = 0;
      let step = 0;
      const maxSteps = 1000;

      // PID gains (tuned manually)
      const Kp = 0.5, Ki = 0.1, Kd = 0.2;
      let integral = 0, lastError = 0;

      while (step < maxSteps) {
        // Simple PID control (proportional to first state variable)
        const error = state.gridDemand - state.powerOutput;
        integral += error;
        const derivative = error - lastError;

        const pidOutput = Kp * error + Ki * integral + Kd * derivative;
        const action = [pidOutput * 0.1, 0, 0]; // Simplified action

        const { nextState, reward, done } = await this.controller.systemAdapter.step(action);

        episodeReward += reward;
        state = nextState;
        lastError = error;
        step++;

        if (done) break;
      }

      results.push({ reward: episodeReward, steps: step });
    }

    return {
      avgReward: results.reduce((sum, r) => sum + r.reward, 0) / numTrials,
      stdReward: this.computeStd(results.map(r => r.reward)),
      avgSteps: results.reduce((sum, r) => sum + r.steps, 0) / numTrials
    };
  }

  /**
   * Benchmark rule-based controller
   */
  async benchmarkRuleBased(numTrials) {
    const results = [];

    for (let i = 0; i < numTrials; i++) {
      let state = await this.controller.systemAdapter.reset();
      let episodeReward = 0;
      let step = 0;
      const maxSteps = 1000;

      while (step < maxSteps) {
        // Simple rule-based control
        let action = [0, 0, 0];

        // Rule 1: Increase power if demand is high
        if (state.gridDemand > state.powerOutput + 50) {
          action[0] = -2; // Withdraw rods or increase power
        } else if (state.gridDemand < state.powerOutput - 50) {
          action[0] = 2; // Insert rods or decrease power
        }

        // Rule 2: Safety checks
        if (state.coreTemperature > 335) {
          action[0] = 5; // Emergency rod insertion
          action[1] = 10; // Increase cooling
        }

        const { nextState, reward, done } = await this.controller.systemAdapter.step(action);

        episodeReward += reward;
        state = nextState;
        step++;

        if (done) break;
      }

      results.push({ reward: episodeReward, steps: step });
    }

    return {
      avgReward: results.reduce((sum, r) => sum + r.reward, 0) / numTrials,
      stdReward: this.computeStd(results.map(r => r.reward)),
      avgSteps: results.reduce((sum, r) => sum + r.steps, 0) / numTrials
    };
  }

  /**
   * Benchmark random controller
   */
  async benchmarkRandom(numTrials) {
    const results = [];

    for (let i = 0; i < numTrials; i++) {
      let state = await this.controller.systemAdapter.reset();
      let episodeReward = 0;
      let step = 0;
      const maxSteps = 1000;

      while (step < maxSteps) {
        const action = [
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ];

        const { nextState, reward, done } = await this.controller.systemAdapter.step(action);

        episodeReward += reward;
        state = nextState;
        step++;

        if (done) break;
      }

      results.push({ reward: episodeReward, steps: step });
    }

    return {
      avgReward: results.reduce((sum, r) => sum + r.reward, 0) / numTrials,
      stdReward: this.computeStd(results.map(r => r.reward)),
      avgSteps: results.reduce((sum, r) => sum + r.steps, 0) / numTrials
    };
  }

  /**
   * Run complete pipeline
   */
  async run() {
    await this.initialize();
    await this.train();
    await this.test();
    await this.benchmark();

    console.log('\n' + '═'.repeat(70));
    console.log('PIPELINE COMPLETE');
    console.log('═'.repeat(70));

    console.log(`\nAll results saved to:`);
    console.log(`  - checkpoints/${this.config.systemId}/`);
    console.log(`  - reports/rl-training/\n`);

    // Generate final summary
    await this.generateSummary();
  }

  /**
   * Generate training summary report
   */
  async generateSummary() {
    const metrics = this.controller.getMetrics();

    const summary = {
      config: this.config,
      training: {
        totalEpisodes: metrics.episodeCount,
        totalSteps: metrics.totalSteps,
        bestReward: metrics.bestReward,
        avgReward: metrics.avgReward,
        finalReward: this.trainingMetrics.rewards[this.trainingMetrics.rewards.length - 1]
      },
      performance: metrics,
      timestamp: new Date().toISOString()
    };

    const reportDir = path.join(process.cwd(), 'reports', 'rl-training');
    await fs.mkdir(reportDir, { recursive: true });

    const summaryPath = path.join(reportDir, `summary-${this.config.systemId}.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`✓ Summary saved: ${summaryPath}`);
  }

  async saveTrainingMetrics() {
    const metricsPath = path.join(
      process.cwd(),
      'checkpoints',
      this.config.systemId,
      'training-metrics.json'
    );

    await fs.writeFile(metricsPath, JSON.stringify(this.trainingMetrics, null, 2));
  }

  async saveBenchmarkResults(comparison) {
    const reportDir = path.join(process.cwd(), 'reports', 'rl-training');
    await fs.mkdir(reportDir, { recursive: true });

    const benchmarkPath = path.join(reportDir, `benchmark-${this.config.systemId}.json`);
    await fs.writeFile(benchmarkPath, JSON.stringify(comparison, null, 2));

    console.log(`✓ Benchmark results saved: ${benchmarkPath}`);
  }

  computeStd(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const systemType = args[0] || 'nuclear-fission';
  const algorithm = args[1] || 'PPO';
  const episodes = parseInt(args[2]) || 100;

  const pipeline = new RLTrainingPipeline({
    systemType,
    algorithm,
    trainingEpisodes: episodes,
    evaluationInterval: Math.floor(episodes / 10),
    checkpointInterval: Math.floor(episodes / 5)
  });

  try {
    await pipeline.run();
    process.exit(0);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         UNIVERSAL RL CONTROLLER TRAINING SYSTEM               ║');
  console.log('║                                                               ║');
  console.log('║  Usage: node train-rl-controller.js [system] [algo] [eps]    ║');
  console.log('║                                                               ║');
  console.log('║  Systems: nuclear-fission, nuclear-fusion, solar, wind        ║');
  console.log('║  Algorithms: PPO, SAC, TD3                                    ║');
  console.log('║  Episodes: Number of training episodes (default: 100)        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  main();
}

module.exports = RLTrainingPipeline;
