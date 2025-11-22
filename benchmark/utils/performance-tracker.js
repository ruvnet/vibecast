/**
 * Performance Tracking Utility
 * Tracks execution time, memory usage, and other metrics
 */

class PerformanceTracker {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.metrics = {
      taskTimings: [],
      memorySnapshots: [],
      errors: [],
      concurrentTasks: 0,
      maxConcurrency: 0
    };
  }

  start() {
    this.startTime = Date.now();
    this.metrics.startMemory = process.memoryUsage();
    console.log(`[${this.name}] Performance tracking started`);
  }

  recordTaskStart(taskId) {
    const timestamp = Date.now();
    this.metrics.taskTimings.push({
      taskId,
      startTime: timestamp,
      endTime: null,
      duration: null
    });
    this.metrics.concurrentTasks++;
    if (this.metrics.concurrentTasks > this.metrics.maxConcurrency) {
      this.metrics.maxConcurrency = this.metrics.concurrentTasks;
    }
  }

  recordTaskEnd(taskId, success = true, error = null) {
    const timestamp = Date.now();
    const taskTiming = this.metrics.taskTimings.find(t => t.taskId === taskId && t.endTime === null);

    if (taskTiming) {
      taskTiming.endTime = timestamp;
      taskTiming.duration = timestamp - taskTiming.startTime;
      taskTiming.success = success;
    }

    if (!success && error) {
      this.metrics.errors.push({
        taskId,
        timestamp,
        error: error.message || error
      });
    }

    this.metrics.concurrentTasks--;
  }

  recordMemorySnapshot(label) {
    const memory = process.memoryUsage();
    this.metrics.memorySnapshots.push({
      label,
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      rss: memory.rss,
      external: memory.external
    });
  }

  end() {
    this.endTime = Date.now();
    this.metrics.endMemory = process.memoryUsage();
    console.log(`[${this.name}] Performance tracking completed`);
  }

  getResults() {
    const totalDuration = this.endTime - this.startTime;
    const completedTasks = this.metrics.taskTimings.filter(t => t.endTime !== null);
    const successfulTasks = completedTasks.filter(t => t.success);

    const avgTaskDuration = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + t.duration, 0) / completedTasks.length
      : 0;

    const memoryUsedMB = this.metrics.endMemory && this.metrics.startMemory
      ? (this.metrics.endMemory.heapUsed - this.metrics.startMemory.heapUsed) / 1024 / 1024
      : 0;

    const peakMemoryMB = this.metrics.memorySnapshots.length > 0
      ? Math.max(...this.metrics.memorySnapshots.map(s => s.heapUsed)) / 1024 / 1024
      : memoryUsedMB;

    return {
      name: this.name,
      totalDuration,
      totalDurationSec: (totalDuration / 1000).toFixed(2),
      totalTasks: this.metrics.taskTimings.length,
      completedTasks: completedTasks.length,
      successfulTasks: successfulTasks.length,
      failedTasks: this.metrics.errors.length,
      errorRate: ((this.metrics.errors.length / completedTasks.length) * 100).toFixed(2) + '%',
      throughput: (completedTasks.length / (totalDuration / 1000)).toFixed(2),
      avgTaskDuration: avgTaskDuration.toFixed(2),
      maxConcurrency: this.metrics.maxConcurrency,
      memoryUsedMB: memoryUsedMB.toFixed(2),
      peakMemoryMB: peakMemoryMB.toFixed(2),
      taskTimings: this.metrics.taskTimings,
      errors: this.metrics.errors,
      memorySnapshots: this.metrics.memorySnapshots
    };
  }

  generateReport() {
    const results = this.getResults();

    console.log('\n' + '='.repeat(60));
    console.log(`Performance Report: ${results.name}`);
    console.log('='.repeat(60));
    console.log(`Total Duration: ${results.totalDurationSec}s`);
    console.log(`Total Tasks: ${results.totalTasks}`);
    console.log(`Completed: ${results.completedTasks}`);
    console.log(`Successful: ${results.successfulTasks}`);
    console.log(`Failed: ${results.failedTasks}`);
    console.log(`Error Rate: ${results.errorRate}`);
    console.log(`Throughput: ${results.throughput} tasks/sec`);
    console.log(`Avg Task Duration: ${results.avgTaskDuration}ms`);
    console.log(`Max Concurrency: ${results.maxConcurrency}`);
    console.log(`Memory Used: ${results.memoryUsedMB}MB`);
    console.log(`Peak Memory: ${results.peakMemoryMB}MB`);
    console.log('='.repeat(60) + '\n');

    return results;
  }
}

module.exports = PerformanceTracker;
