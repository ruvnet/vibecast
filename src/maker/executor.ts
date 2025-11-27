/**
 * MAKER Framework Executor
 *
 * Main orchestration layer that combines:
 * - Microagent execution
 * - First-to-Ahead-by-k voting
 * - Statistics tracking
 * - Pipeline execution
 */

import type {
  MAKERConfig,
  MAKERStats,
  VotingResult,
  DecomposedStep,
  MicroagentResult
} from './types';
import { DEFAULT_MAKER_CONFIG, calculateFullTaskSuccess } from './types';
import { FirstToAheadVoter, createVoter } from './voting';
import { MicroagentExecutor, createMicroagent, RedFlagDetector } from './microagent';

/**
 * Step execution result with voting metadata
 */
export interface StepExecutionResult<T> {
  /** Step identifier */
  stepId: string;
  /** Step name */
  stepName: string;
  /** Voting result */
  votingResult: VotingResult<T>;
  /** Final output value */
  output: T;
  /** Execution time for this step */
  executionTime: number;
  /** Whether this step succeeded */
  success: boolean;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult<T> {
  /** Final output */
  output: T;
  /** Results for each step */
  stepResults: StepExecutionResult<unknown>[];
  /** Overall statistics */
  stats: MAKERStats;
  /** Whether pipeline succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * MAKER Executor
 *
 * Executes decomposed tasks with voting-based error correction
 */
export class MAKERExecutor {
  private config: MAKERConfig;
  private stats: MAKERStats;

  constructor(config: Partial<MAKERConfig> = {}) {
    this.config = { ...DEFAULT_MAKER_CONFIG, ...config };
    this.stats = this.initStats();
  }

  /**
   * Initialize statistics
   */
  private initStats(): MAKERStats {
    return {
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      totalVotesCast: 0,
      averageVotesPerStep: 0,
      redFlagsDetected: 0,
      totalExecutionTime: 0,
      perStepAccuracy: 0,
      estimatedFullTaskSuccess: 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initStats();
  }

  /**
   * Get current statistics
   */
  getStats(): MAKERStats {
    return { ...this.stats };
  }

  /**
   * Execute a single step with voting
   */
  async executeStep<TInput, TOutput>(
    step: DecomposedStep<TInput, TOutput>,
    input: TInput,
    customDetectors?: RedFlagDetector<TOutput>[]
  ): Promise<StepExecutionResult<TOutput>> {
    const startTime = Date.now();

    // Create microagent
    const microagent = createMicroagent(this.config, step, customDetectors);

    // Create voter
    const voter = createVoter<TOutput>(this.config);

    // Generator function for voting
    const generateCandidate = async (): Promise<MicroagentResult<TOutput>> => {
      return microagent.execute(input);
    };

    // Run voting (parallel or sequential based on config)
    let votingResult: VotingResult<TOutput>;

    if (this.config.parallelVoting) {
      votingResult = await voter.runParallelVoting(
        generateCandidate,
        step.serialize
      );
    } else {
      votingResult = await voter.runVoting(
        generateCandidate,
        step.serialize
      );
    }

    const executionTime = Date.now() - startTime;

    // Update statistics
    this.stats.totalSteps++;
    this.stats.totalVotesCast += votingResult.totalVotes;
    this.stats.redFlagsDetected += votingResult.redFlags.length;
    this.stats.totalExecutionTime += executionTime;

    const success = votingResult.consensusReached;
    if (success) {
      this.stats.successfulSteps++;
    } else {
      this.stats.failedSteps++;
    }

    // Update derived stats
    this.stats.averageVotesPerStep = this.stats.totalVotesCast / this.stats.totalSteps;
    this.stats.perStepAccuracy = this.stats.successfulSteps / this.stats.totalSteps;
    this.stats.estimatedFullTaskSuccess = calculateFullTaskSuccess(
      this.stats.perStepAccuracy,
      this.config.votingThreshold,
      this.stats.totalSteps
    );

    return {
      stepId: step.id,
      stepName: step.name,
      votingResult,
      output: votingResult.winner,
      executionTime,
      success
    };
  }

  /**
   * Execute a pipeline of steps
   *
   * @param steps - Array of decomposed steps
   * @param initialInput - Input for the first step
   * @returns Pipeline execution result
   */
  async executePipeline<TInput, TOutput>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps: readonly DecomposedStep<any, any>[],
    initialInput: TInput
  ): Promise<PipelineResult<TOutput>> {
    this.resetStats();
    const stepResults: StepExecutionResult<unknown>[] = [];
    let currentInput: unknown = initialInput;

    for (const step of steps) {
      try {
        const result = await this.executeStep(
          step as DecomposedStep<unknown, unknown>,
          currentInput
        );

        stepResults.push(result);

        if (!result.success) {
          return {
            output: currentInput as TOutput,
            stepResults,
            stats: this.getStats(),
            success: false,
            error: `Step "${step.name}" failed to reach consensus`
          };
        }

        // Output becomes input for next step
        currentInput = result.output;
      } catch (error) {
        return {
          output: currentInput as TOutput,
          stepResults,
          stats: this.getStats(),
          success: false,
          error: `Step "${step.name}" threw error: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    return {
      output: currentInput as TOutput,
      stepResults,
      stats: this.getStats(),
      success: true
    };
  }

  /**
   * Execute steps in parallel (for independent operations)
   */
  async executeParallel<TInput, TOutput>(
    steps: Array<{ step: DecomposedStep<TInput, TOutput>; input: TInput }>,
  ): Promise<StepExecutionResult<TOutput>[]> {
    const results = await Promise.all(
      steps.map(({ step, input }) => this.executeStep(step, input))
    );

    return results;
  }

  /**
   * Get configuration
   */
  getConfig(): MAKERConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MAKERConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create a MAKER executor with configuration
 */
export function createMAKERExecutor(config?: Partial<MAKERConfig>): MAKERExecutor {
  return new MAKERExecutor(config);
}

// Singleton instance
let executorInstance: MAKERExecutor | null = null;

/**
 * Get singleton MAKER executor
 */
export function getMAKERExecutor(): MAKERExecutor {
  if (!executorInstance) {
    executorInstance = new MAKERExecutor();
  }
  return executorInstance;
}

/**
 * Reset singleton executor
 */
export function resetMAKERExecutor(): void {
  executorInstance = null;
}
