/**
 * Microagent Executor
 *
 * Implements focused single-step execution from the MAKER framework.
 * Each microagent handles exactly one decomposed step with:
 * - Input validation
 * - Output validation
 * - Red-flag detection
 * - Timing metrics
 */

import type { MAKERConfig, MicroagentResult, DecomposedStep } from './types';

/**
 * Red flag detector for identifying confused states
 */
export interface RedFlagDetector<T> {
  /** Detector name */
  name: string;
  /** Check for red flag condition */
  detect: (result: MicroagentResult<T>, rawResponse?: string) => string | null;
}

/**
 * Standard red flag detectors based on paper recommendations
 */
export const standardRedFlagDetectors = {
  /**
   * Response length detector
   * Paper notes: confused states often produce verbose responses
   */
  responseLength: <T>(maxLength: number): RedFlagDetector<T> => ({
    name: 'response-length',
    detect: (result, rawResponse) => {
      if (rawResponse && rawResponse.length > maxLength) {
        return `Response exceeds maximum length (${rawResponse.length} > ${maxLength})`;
      }
      return null;
    }
  }),

  /**
   * Execution time detector
   * Unusually long execution may indicate confusion
   */
  executionTime: <T>(maxTimeMs: number): RedFlagDetector<T> => ({
    name: 'execution-time',
    detect: (result) => {
      if (result.executionTime > maxTimeMs) {
        return `Execution time exceeded (${result.executionTime}ms > ${maxTimeMs}ms)`;
      }
      return null;
    }
  }),

  /**
   * Validation error detector
   * Multiple validation errors suggest fundamental confusion
   */
  validationErrors: <T>(maxErrors: number): RedFlagDetector<T> => ({
    name: 'validation-errors',
    detect: (result) => {
      if (result.validationErrors.length > maxErrors) {
        return `Too many validation errors (${result.validationErrors.length} > ${maxErrors})`;
      }
      return null;
    }
  }),

  /**
   * Empty result detector
   */
  emptyResult: <T>(): RedFlagDetector<T> => ({
    name: 'empty-result',
    detect: (result) => {
      const value = result.value;
      if (value === null || value === undefined) {
        return 'Result is null or undefined';
      }
      if (Array.isArray(value) && value.length === 0) {
        return 'Result array is empty';
      }
      if (typeof value === 'object' && Object.keys(value as object).length === 0) {
        return 'Result object is empty';
      }
      return null;
    }
  })
};

/**
 * Microagent executor for single-step execution
 */
export class MicroagentExecutor<TInput, TOutput> {
  private config: MAKERConfig;
  private step: DecomposedStep<TInput, TOutput>;
  private redFlagDetectors: RedFlagDetector<TOutput>[];

  constructor(
    config: MAKERConfig,
    step: DecomposedStep<TInput, TOutput>,
    customDetectors: RedFlagDetector<TOutput>[] = []
  ) {
    this.config = config;
    this.step = step;

    // Combine standard and custom detectors
    this.redFlagDetectors = [
      standardRedFlagDetectors.responseLength<TOutput>(config.maxResponseLength),
      standardRedFlagDetectors.executionTime<TOutput>(5000), // 5 second timeout
      standardRedFlagDetectors.validationErrors<TOutput>(3),
      standardRedFlagDetectors.emptyResult<TOutput>(),
      ...customDetectors
    ];
  }

  /**
   * Execute the step once
   */
  async execute(input: TInput): Promise<MicroagentResult<TOutput>> {
    const startTime = Date.now();
    const redFlags: string[] = [];
    const validationErrors: string[] = [];

    try {
      // Execute the step
      const result = await this.step.execute(input);

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      // Run validation
      const isValid = this.step.validate(result.value);
      if (!isValid) {
        validationErrors.push('Output failed validation');
      }

      // Run red flag detection if enabled
      if (this.config.enableRedFlagging) {
        for (const detector of this.redFlagDetectors) {
          const flag = detector.detect(result, result.rawResponse);
          if (flag) {
            redFlags.push(`[${detector.name}] ${flag}`);
          }
        }
      }

      return {
        ...result,
        isValid: isValid && result.isValid,
        validationErrors: [...result.validationErrors, ...validationErrors],
        redFlags: [...result.redFlags, ...redFlags]
      };
    } catch (error) {
      // Execution failed
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        value: null as unknown as TOutput,
        executionTime,
        isValid: false,
        validationErrors: [`Execution error: ${errorMessage}`],
        redFlags: ['[execution-error] Step threw an exception']
      };
    }
  }

  /**
   * Execute the step with retry on validation failure
   */
  async executeWithRetry(
    input: TInput,
    maxRetries: number = 3
  ): Promise<MicroagentResult<TOutput>> {
    let lastResult: MicroagentResult<TOutput> | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.execute(input);

      if (result.isValid) {
        return result;
      }

      lastResult = result;
    }

    return lastResult!;
  }

  /**
   * Get step metadata
   */
  getStepInfo(): { id: string; name: string } {
    return {
      id: this.step.id,
      name: this.step.name
    };
  }

  /**
   * Get serializer for voting
   */
  getSerializer(): (output: TOutput) => string {
    return this.step.serialize;
  }
}

/**
 * Create a microagent executor
 */
export function createMicroagent<TInput, TOutput>(
  config: MAKERConfig,
  step: DecomposedStep<TInput, TOutput>,
  customDetectors?: RedFlagDetector<TOutput>[]
): MicroagentExecutor<TInput, TOutput> {
  return new MicroagentExecutor(config, step, customDetectors);
}

/**
 * Factory for creating decomposed steps
 */
export function createStep<TInput, TOutput>(
  id: string,
  name: string,
  execute: (input: TInput) => Promise<MicroagentResult<TOutput>>,
  validate: (output: TOutput) => boolean,
  serialize: (output: TOutput) => string
): DecomposedStep<TInput, TOutput> {
  return { id, name, execute, validate, serialize };
}

/**
 * Wrap a simple function as a decomposed step
 */
export function wrapAsStep<TInput, TOutput>(
  id: string,
  name: string,
  fn: (input: TInput) => Promise<TOutput> | TOutput,
  options: {
    validate?: (output: TOutput) => boolean;
    serialize?: (output: TOutput) => string;
  } = {}
): DecomposedStep<TInput, TOutput> {
  const validate = options.validate ?? (() => true);
  const serialize = options.serialize ?? ((o) => JSON.stringify(o));

  return {
    id,
    name,
    execute: async (input: TInput): Promise<MicroagentResult<TOutput>> => {
      const startTime = Date.now();
      try {
        const value = await fn(input);
        return {
          value,
          executionTime: Date.now() - startTime,
          isValid: validate(value),
          validationErrors: [],
          redFlags: []
        };
      } catch (error) {
        return {
          value: null as unknown as TOutput,
          executionTime: Date.now() - startTime,
          isValid: false,
          validationErrors: [error instanceof Error ? error.message : String(error)],
          redFlags: []
        };
      }
    },
    validate,
    serialize
  };
}
