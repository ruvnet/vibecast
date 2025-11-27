import {
  BenchmarkRunner,
  getBenchmarkRunner,
  resetBenchmarkRunner,
  findOptimalConfig
} from './benchmark';
import type { MAKERStats } from '../maker/types';
import { DEFAULT_MAKER_CONFIG } from '../maker/types';

describe('BenchmarkRunner', () => {
  describe('record', () => {
    it('should record benchmark result', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 9,
        failedSteps: 1,
        totalVotesCast: 50,
        averageVotesPerStep: 5,
        redFlagsDetected: 2,
        totalExecutionTime: 1000,
        perStepAccuracy: 0.9,
        estimatedFullTaskSuccess: 0.85
      };

      const result = runner.record('test-benchmark', stats);

      expect(result.name).toBe('test-benchmark');
      expect(result.stats).toEqual(stats);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate theoretical metrics', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 9,
        failedSteps: 1,
        totalVotesCast: 50,
        averageVotesPerStep: 5,
        redFlagsDetected: 0,
        totalExecutionTime: 1000,
        perStepAccuracy: 0.9,
        estimatedFullTaskSuccess: 0.85
      };

      const result = runner.record('test', stats);

      expect(result.theoretical.expectedSuccessRate).toBeGreaterThan(0);
      expect(result.theoretical.minimumK).toBeGreaterThanOrEqual(1);
      expect(result.theoretical.expectedCost).toBeGreaterThan(0);
    });

    it('should calculate performance metrics', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 10,
        failedSteps: 0,
        totalVotesCast: 30,
        averageVotesPerStep: 3,
        redFlagsDetected: 0,
        totalExecutionTime: 500,
        perStepAccuracy: 1.0,
        estimatedFullTaskSuccess: 1.0
      };

      const result = runner.record('perf-test', stats, DEFAULT_MAKER_CONFIG, 500);

      expect(result.performance.totalTimeMs).toBe(500);
      expect(result.performance.avgStepTimeMs).toBe(50);
      expect(result.performance.votesPerSecond).toBe(60);
    });

    it('should calculate efficiency metrics', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 8,
        failedSteps: 2,
        totalVotesCast: 50,
        averageVotesPerStep: 5,
        redFlagsDetected: 3,
        totalExecutionTime: 1000,
        perStepAccuracy: 0.8,
        estimatedFullTaskSuccess: 0.75
      };

      const result = runner.record('efficiency-test', stats);

      expect(result.efficiency.votingOverhead).toBe(5 - DEFAULT_MAKER_CONFIG.votingThreshold);
      expect(result.efficiency.redFlagRate).toBe(0.3);
      expect(result.efficiency.consensusRate).toBe(0.8);
    });
  });

  describe('getResults', () => {
    it('should return all recorded results', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 5,
        successfulSteps: 5,
        failedSteps: 0,
        totalVotesCast: 15,
        averageVotesPerStep: 3,
        redFlagsDetected: 0,
        totalExecutionTime: 200,
        perStepAccuracy: 1.0,
        estimatedFullTaskSuccess: 1.0
      };

      runner.record('run-1', stats);
      runner.record('run-2', stats);

      const results = runner.getResults();
      expect(results.length).toBe(2);
    });
  });

  describe('getLatest', () => {
    it('should return latest result', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        totalVotesCast: 3,
        averageVotesPerStep: 3,
        redFlagsDetected: 0,
        totalExecutionTime: 100,
        perStepAccuracy: 1.0,
        estimatedFullTaskSuccess: 1.0
      };

      runner.record('first', stats);
      runner.record('second', stats);

      const latest = runner.getLatest();
      expect(latest?.name).toBe('second');
    });

    it('should return null for empty runner', () => {
      const runner = new BenchmarkRunner();
      expect(runner.getLatest()).toBeNull();
    });
  });

  describe('compare', () => {
    it('should compare two benchmarks', () => {
      const runner = new BenchmarkRunner();

      const baselineStats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 7,
        failedSteps: 3,
        totalVotesCast: 100,
        averageVotesPerStep: 10,
        redFlagsDetected: 5,
        totalExecutionTime: 2000,
        perStepAccuracy: 0.7,
        estimatedFullTaskSuccess: 0.5
      };

      const improvedStats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 9,
        failedSteps: 1,
        totalVotesCast: 50,
        averageVotesPerStep: 5,
        redFlagsDetected: 1,
        totalExecutionTime: 1000,
        perStepAccuracy: 0.9,
        estimatedFullTaskSuccess: 0.85
      };

      runner.record('baseline', baselineStats, DEFAULT_MAKER_CONFIG, 2000);
      runner.record('improved', improvedStats, DEFAULT_MAKER_CONFIG, 1000);

      const comparison = runner.compare('baseline', 'improved');

      expect(comparison).not.toBeNull();
      expect(comparison!.improvements.successRate).toBeCloseTo(0.2, 5); // 0.9 - 0.7
      expect(comparison!.improvements.executionTime).toBe(1000); // 2000 - 1000
    });

    it('should return null for missing benchmark', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        totalVotesCast: 3,
        averageVotesPerStep: 3,
        redFlagsDetected: 0,
        totalExecutionTime: 100,
        perStepAccuracy: 1.0,
        estimatedFullTaskSuccess: 1.0
      };

      runner.record('only-one', stats);

      const comparison = runner.compare('only-one', 'missing');
      expect(comparison).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all results', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        totalVotesCast: 3,
        averageVotesPerStep: 3,
        redFlagsDetected: 0,
        totalExecutionTime: 100,
        perStepAccuracy: 1.0,
        estimatedFullTaskSuccess: 1.0
      };

      runner.record('test', stats);
      expect(runner.getResults().length).toBe(1);

      runner.clear();
      expect(runner.getResults().length).toBe(0);
    });
  });

  describe('generateReport', () => {
    it('should generate report for recorded results', () => {
      const runner = new BenchmarkRunner();

      const stats: MAKERStats = {
        totalSteps: 10,
        successfulSteps: 9,
        failedSteps: 1,
        totalVotesCast: 45,
        averageVotesPerStep: 4.5,
        redFlagsDetected: 2,
        totalExecutionTime: 1000,
        perStepAccuracy: 0.9,
        estimatedFullTaskSuccess: 0.85
      };

      runner.record('test-run', stats);

      const report = runner.generateReport();

      expect(report).toContain('test-run');
      expect(report).toContain('Total Steps: 10');
      expect(report).toContain('Success Rate: 90.0%');
    });

    it('should handle empty results', () => {
      const runner = new BenchmarkRunner();
      const report = runner.generateReport();

      expect(report).toBe('No benchmark results recorded.');
    });
  });
});

describe('getBenchmarkRunner', () => {
  beforeEach(() => {
    resetBenchmarkRunner();
  });

  it('should return singleton', () => {
    const runner1 = getBenchmarkRunner();
    const runner2 = getBenchmarkRunner();
    expect(runner1).toBe(runner2);
  });
});

describe('findOptimalConfig', () => {
  it('should find config with best accuracy', () => {
    const runner = new BenchmarkRunner();

    const lowAccuracy: MAKERStats = {
      totalSteps: 10,
      successfulSteps: 7,
      failedSteps: 3,
      totalVotesCast: 30,
      averageVotesPerStep: 3,
      redFlagsDetected: 0,
      totalExecutionTime: 500,
      perStepAccuracy: 0.7,
      estimatedFullTaskSuccess: 0.5
    };

    const highAccuracy: MAKERStats = {
      totalSteps: 10,
      successfulSteps: 10,
      failedSteps: 0,
      totalVotesCast: 50,
      averageVotesPerStep: 5,
      redFlagsDetected: 0,
      totalExecutionTime: 1000,
      perStepAccuracy: 1.0,
      estimatedFullTaskSuccess: 1.0
    };

    const results = new Map();
    results.set('low', runner.record('low', lowAccuracy, { ...DEFAULT_MAKER_CONFIG, votingThreshold: 2 }));
    results.set('high', runner.record('high', highAccuracy, { ...DEFAULT_MAKER_CONFIG, votingThreshold: 5 }));

    const best = findOptimalConfig(results, 'accuracy');
    expect(best?.name).toBe('high');
  });

  it('should find config with best speed', () => {
    const runner = new BenchmarkRunner();

    const slow: MAKERStats = {
      totalSteps: 10,
      successfulSteps: 10,
      failedSteps: 0,
      totalVotesCast: 50,
      averageVotesPerStep: 5,
      redFlagsDetected: 0,
      totalExecutionTime: 2000,
      perStepAccuracy: 1.0,
      estimatedFullTaskSuccess: 1.0
    };

    const fast: MAKERStats = {
      totalSteps: 10,
      successfulSteps: 9,
      failedSteps: 1,
      totalVotesCast: 30,
      averageVotesPerStep: 3,
      redFlagsDetected: 0,
      totalExecutionTime: 500,
      perStepAccuracy: 0.9,
      estimatedFullTaskSuccess: 0.85
    };

    const results = new Map();
    results.set('slow', runner.record('slow', slow, DEFAULT_MAKER_CONFIG, 2000));
    results.set('fast', runner.record('fast', fast, DEFAULT_MAKER_CONFIG, 500));

    const best = findOptimalConfig(results, 'speed');
    expect(best?.name).toBe('fast');
  });
});
