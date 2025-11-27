import {
  MAKERExecutor,
  createMAKERExecutor,
  getMAKERExecutor,
  resetMAKERExecutor
} from './executor';
import { wrapAsStep, createStep } from './microagent';
import type { MAKERConfig, MicroagentResult } from './types';
import { DEFAULT_MAKER_CONFIG } from './types';

describe('MAKERExecutor', () => {
  beforeEach(() => {
    resetMAKERExecutor();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const executor = new MAKERExecutor();
      const config = executor.getConfig();

      expect(config.votingThreshold).toBe(DEFAULT_MAKER_CONFIG.votingThreshold);
      expect(config.maxCandidates).toBe(DEFAULT_MAKER_CONFIG.maxCandidates);
    });

    it('should accept custom config', () => {
      const executor = new MAKERExecutor({ votingThreshold: 5 });
      const config = executor.getConfig();

      expect(config.votingThreshold).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const executor = new MAKERExecutor();
      const stats = executor.getStats();

      expect(stats.totalSteps).toBe(0);
      expect(stats.successfulSteps).toBe(0);
      expect(stats.totalVotesCast).toBe(0);
    });
  });

  describe('executeStep', () => {
    it('should execute simple step with voting', async () => {
      const executor = new MAKERExecutor();

      const step = wrapAsStep<number, number>(
        'double',
        'Double the input',
        (input) => input * 2,
        { validate: (output) => output > 0 }
      );

      const result = await executor.executeStep(step, 5);

      expect(result.success).toBe(true);
      expect(result.output).toBe(10);
      expect(result.votingResult.consensusReached).toBe(true);
    });

    it('should track statistics', async () => {
      const executor = new MAKERExecutor();

      const step = wrapAsStep<string, string>(
        'echo',
        'Echo input',
        (input) => input
      );

      await executor.executeStep(step, 'test');

      const stats = executor.getStats();
      expect(stats.totalSteps).toBe(1);
      expect(stats.successfulSteps).toBe(1);
      expect(stats.totalVotesCast).toBeGreaterThan(0);
    });

    it('should handle async steps', async () => {
      const executor = new MAKERExecutor();

      const step = wrapAsStep<number, number>(
        'async-double',
        'Async double',
        async (input) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return input * 2;
        }
      );

      const result = await executor.executeStep(step, 7);

      expect(result.output).toBe(14);
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('executePipeline', () => {
    it('should execute sequential steps', async () => {
      const executor = new MAKERExecutor();

      const step1 = wrapAsStep<number, number>(
        'add-one',
        'Add one',
        (n) => n + 1
      );

      const step2 = wrapAsStep<number, number>(
        'double',
        'Double',
        (n) => n * 2
      );

      const result = await executor.executePipeline<number, number>(
        [step1, step2],
        5
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe(12); // (5 + 1) * 2
      expect(result.stepResults.length).toBe(2);
    });

    it('should stop on step failure', async () => {
      const executor = new MAKERExecutor({ maxCandidates: 5 });

      const step1 = wrapAsStep<number, number>(
        'good-step',
        'Good step',
        (n) => n + 1
      );

      let counter = 0;
      const step2 = createStep<number, number>(
        'bad-step',
        'Bad step',
        async (): Promise<MicroagentResult<number>> => {
          counter++;
          return {
            value: counter, // Always different
            executionTime: 10,
            isValid: true,
            validationErrors: [],
            redFlags: []
          };
        },
        () => true,
        (n) => n.toString()
      );

      const result = await executor.executePipeline<number, number>(
        [step1, step2],
        5
      );

      // Pipeline may not reach consensus for step2
      expect(result.stepResults.length).toBe(2);
    });
  });

  describe('executeParallel', () => {
    it('should execute independent steps in parallel', async () => {
      const executor = new MAKERExecutor();

      const stepA = wrapAsStep<number, number>(
        'step-a',
        'Step A',
        (n) => n * 2
      );

      const stepB = wrapAsStep<number, number>(
        'step-b',
        'Step B',
        (n) => n + 10
      );

      const results = await executor.executeParallel([
        { step: stepA, input: 5 },
        { step: stepB, input: 5 }
      ]);

      expect(results.length).toBe(2);
      expect(results[0].output).toBe(10);
      expect(results[1].output).toBe(15);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const executor = new MAKERExecutor();
      executor.updateConfig({ votingThreshold: 7 });

      expect(executor.getConfig().votingThreshold).toBe(7);
    });
  });
});

describe('createMAKERExecutor', () => {
  it('should create executor', () => {
    const executor = createMAKERExecutor();
    expect(executor).toBeInstanceOf(MAKERExecutor);
  });

  it('should accept config', () => {
    const executor = createMAKERExecutor({ voterCount: 10 });
    expect(executor.getConfig().voterCount).toBe(10);
  });
});

describe('getMAKERExecutor', () => {
  beforeEach(() => {
    resetMAKERExecutor();
  });

  it('should return singleton', () => {
    const exec1 = getMAKERExecutor();
    const exec2 = getMAKERExecutor();
    expect(exec1).toBe(exec2);
  });
});
