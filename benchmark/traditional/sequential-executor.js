/**
 * Traditional Sequential Code Development Approach
 * Executes tasks one at a time in sequential order
 */

const PerformanceTracker = require('../utils/performance-tracker');

class SequentialExecutor {
  constructor(scenario) {
    this.scenario = scenario;
    this.tracker = new PerformanceTracker(`Traditional Sequential: ${scenario.name}`);
    this.results = [];
  }

  async execute() {
    console.log(`\n🔨 Starting Traditional Sequential Execution: ${this.scenario.name}`);
    console.log(`Tasks: ${this.scenario.tasks.length}`);
    console.log('Approach: One task at a time, fully complete before moving to next\n');

    this.tracker.start();

    for (const task of this.scenario.tasks) {
      await this.executeTask(task);
      this.tracker.recordMemorySnapshot(task);
    }

    this.tracker.end();
    return this.tracker.generateReport();
  }

  async executeTask(taskName) {
    const taskId = `${this.scenario.id}_${taskName.replace(/\s+/g, '_')}`;

    console.log(`⏳ Executing: ${taskName}`);
    this.tracker.recordTaskStart(taskId);

    try {
      // Simulate task execution
      const result = await this.simulateTaskWork(taskName);

      this.tracker.recordTaskEnd(taskId, true);
      this.results.push({
        taskId,
        taskName,
        success: true,
        result
      });

      console.log(`✅ Completed: ${taskName}`);
    } catch (error) {
      this.tracker.recordTaskEnd(taskId, false, error);
      this.results.push({
        taskId,
        taskName,
        success: false,
        error: error.message
      });

      console.log(`❌ Failed: ${taskName} - ${error.message}`);
    }
  }

  async simulateTaskWork(taskName) {
    // Simulate different types of work based on task complexity
    const baseTime = 200; // Base time in ms
    const complexityMultiplier = this.getComplexityMultiplier(taskName);
    const workTime = baseTime * complexityMultiplier;

    // Simulate CPU work
    await this.simulateCPUWork(workTime);

    // Simulate I/O operations
    await this.simulateIOWork(workTime / 2);

    return {
      taskName,
      linesOfCode: Math.floor(Math.random() * 100) + 50,
      complexity: complexityMultiplier,
      workTime
    };
  }

  getComplexityMultiplier(taskName) {
    const lowerTask = taskName.toLowerCase();

    if (lowerTask.includes('test') || lowerTask.includes('validation')) {
      return 2.5; // Testing takes longer
    } else if (lowerTask.includes('implement') || lowerTask.includes('create')) {
      return 2.0; // Implementation tasks
    } else if (lowerTask.includes('add') || lowerTask.includes('write')) {
      return 1.5; // Simpler additions
    } else if (lowerTask.includes('error') || lowerTask.includes('handle')) {
      return 1.8; // Error handling
    } else {
      return 1.0; // Default
    }
  }

  async simulateCPUWork(duration) {
    const start = Date.now();
    const data = [];

    // Create computational load
    while (Date.now() - start < duration) {
      // Simulate code generation/processing
      for (let i = 0; i < 1000; i++) {
        data.push(Math.random() * Math.random());
      }

      // Some processing
      if (data.length > 10000) {
        data.splice(0, 5000);
      }
    }
  }

  async simulateIOWork(duration) {
    // Simulate file I/O or network operations
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  getResults() {
    return {
      approach: 'traditional-sequential',
      scenario: this.scenario.name,
      results: this.results,
      performance: this.tracker.getResults()
    };
  }
}

module.exports = SequentialExecutor;
