/**
 * Strange-Loops Framework Integration
 * Implements recursive agent patterns and self-referential reasoning
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentTask, AgentResponse } from '../../types/index.js';

export interface LoopContext {
  loopId: string;
  depth: number;
  maxDepth: number;
  history: Array<{
    depth: number;
    input: any;
    output: any;
    timestamp: Date;
  }>;
  metadata: Record<string, any>;
}

export interface RecursivePattern {
  id: string;
  name: string;
  baseCase: (input: any, context: LoopContext) => boolean;
  recursiveCase: (input: any, context: LoopContext) => any;
  combineResults: (results: any[], context: LoopContext) => any;
  maxDepth?: number;
}

export interface ReflectionConfig {
  enabled: boolean;
  reflectionPrompt: string;
  reflectionInterval: number; // After how many iterations to reflect
}

export class StrangeLoopsEngine extends EventEmitter {
  private patterns: Map<string, RecursivePattern> = new Map();
  private activeLoops: Map<string, LoopContext> = new Map();
  private readonly DEFAULT_MAX_DEPTH = 10;

  /**
   * Register a recursive pattern
   */
  registerPattern(pattern: RecursivePattern): void {
    this.patterns.set(pattern.id, pattern);
    this.emit('pattern-registered', { patternId: pattern.id, name: pattern.name });
  }

  /**
   * Execute a recursive pattern
   */
  async executeRecursive(
    patternId: string,
    initialInput: any,
    executor: (input: any, depth: number) => Promise<any>,
    maxDepth?: number
  ): Promise<any> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    const context: LoopContext = {
      loopId: patternId + '-' + Date.now(),
      depth: 0,
      maxDepth: maxDepth ?? pattern.maxDepth ?? this.DEFAULT_MAX_DEPTH,
      history: [],
      metadata: {},
    };

    this.activeLoops.set(context.loopId, context);
    this.emit('loop-start', { loopId: context.loopId, pattern: pattern.name });

    try {
      const result = await this.recurse(pattern, initialInput, context, executor);
      this.emit('loop-complete', { loopId: context.loopId, result });
      return result;
    } finally {
      this.activeLoops.delete(context.loopId);
    }
  }

  private async recurse(
    pattern: RecursivePattern,
    input: any,
    context: LoopContext,
    executor: (input: any, depth: number) => Promise<any>
  ): Promise<any> {
    // Check max depth
    if (context.depth >= context.maxDepth) {
      this.emit('loop-max-depth', { loopId: context.loopId, depth: context.depth });
      throw new Error(`Maximum recursion depth reached: ${context.maxDepth}`);
    }

    this.emit('loop-iteration', {
      loopId: context.loopId,
      depth: context.depth,
      input,
    });

    // Base case: stop recursion
    if (pattern.baseCase(input, context)) {
      this.emit('loop-base-case', { loopId: context.loopId, depth: context.depth });
      const output = await executor(input, context.depth);

      context.history.push({
        depth: context.depth,
        input,
        output,
        timestamp: new Date(),
      });

      return output;
    }

    // Recursive case: continue recursion
    const recursiveInput = pattern.recursiveCase(input, context);
    context.depth++;

    const recursiveOutput = await this.recurse(pattern, recursiveInput, context, executor);
    context.depth--;

    // Execute current level
    const currentOutput = await executor(input, context.depth);

    context.history.push({
      depth: context.depth,
      input,
      output: currentOutput,
      timestamp: new Date(),
    });

    // Combine results
    const combinedResult = pattern.combineResults([recursiveOutput, currentOutput], context);

    return combinedResult;
  }

  /**
   * Execute with self-reflection
   */
  async executeWithReflection(
    patternId: string,
    initialInput: any,
    executor: (input: any, depth: number) => Promise<any>,
    reflectionExecutor: (history: any[], prompt: string) => Promise<string>,
    reflectionConfig: ReflectionConfig
  ): Promise<any> {
    if (!reflectionConfig.enabled) {
      return this.executeRecursive(patternId, initialInput, executor);
    }

    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    const context: LoopContext = {
      loopId: patternId + '-reflection-' + Date.now(),
      depth: 0,
      maxDepth: pattern.maxDepth ?? this.DEFAULT_MAX_DEPTH,
      history: [],
      metadata: { reflections: [] },
    };

    this.activeLoops.set(context.loopId, context);

    try {
      let currentInput = initialInput;
      let iterations = 0;

      while (!pattern.baseCase(currentInput, context)) {
        iterations++;

        // Execute iteration
        const output = await executor(currentInput, context.depth);
        context.history.push({
          depth: context.depth,
          input: currentInput,
          output,
          timestamp: new Date(),
        });

        // Perform reflection at intervals
        if (iterations % reflectionConfig.reflectionInterval === 0) {
          this.emit('reflection-start', { loopId: context.loopId, iteration: iterations });

          const reflection = await reflectionExecutor(
            context.history,
            reflectionConfig.reflectionPrompt
          );

          context.metadata.reflections.push({
            iteration: iterations,
            reflection,
            timestamp: new Date(),
          });

          this.emit('reflection-complete', {
            loopId: context.loopId,
            iteration: iterations,
            reflection,
          });
        }

        // Get next input
        currentInput = pattern.recursiveCase(currentInput, context);
        context.depth++;

        if (context.depth >= context.maxDepth) {
          throw new Error(`Maximum recursion depth reached: ${context.maxDepth}`);
        }
      }

      // Final execution
      const finalOutput = await executor(currentInput, context.depth);
      return finalOutput;
    } finally {
      this.activeLoops.delete(context.loopId);
    }
  }

  /**
   * Create a fixed-point iteration pattern
   */
  async fixedPointIteration(
    initialInput: any,
    executor: (input: any) => Promise<any>,
    convergenceTest: (prev: any, current: any) => boolean,
    maxIterations: number = 100
  ): Promise<any> {
    this.emit('fixed-point-start', { maxIterations });

    let previous = initialInput;
    let iterations = 0;

    while (iterations < maxIterations) {
      const current = await executor(previous);

      this.emit('fixed-point-iteration', { iteration: iterations, value: current });

      if (convergenceTest(previous, current)) {
        this.emit('fixed-point-converged', { iteration: iterations, value: current });
        return current;
      }

      previous = current;
      iterations++;
    }

    this.emit('fixed-point-max-iterations', { maxIterations });
    throw new Error(`Fixed-point iteration did not converge within ${maxIterations} iterations`);
  }

  /**
   * Get active loop status
   */
  getLoopStatus(loopId: string): LoopContext | undefined {
    return this.activeLoops.get(loopId);
  }

  /**
   * List all registered patterns
   */
  listPatterns(): Array<{ id: string; name: string }> {
    return Array.from(this.patterns.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }
}

/**
 * Common recursive patterns
 */
export const CommonPatterns = {
  /**
   * Divide and conquer pattern
   */
  divideAndConquer: (
    name: string,
    divider: (input: any) => any[],
    combiner: (results: any[]) => any
  ): RecursivePattern => ({
    id: `divide-conquer-${name}`,
    name: `Divide and Conquer: ${name}`,
    baseCase: (input: any) => Array.isArray(input) && input.length <= 1,
    recursiveCase: (input: any) => divider(input),
    combineResults: (results: any[]) => combiner(results),
    maxDepth: 20,
  }),

  /**
   * Iterative refinement pattern
   */
  iterativeRefinement: (
    name: string,
    refiner: (input: any, iteration: number) => any
  ): RecursivePattern => ({
    id: `refinement-${name}`,
    name: `Iterative Refinement: ${name}`,
    baseCase: (input: any, context: LoopContext) => context.depth >= 5,
    recursiveCase: (input: any, context: LoopContext) => refiner(input, context.depth),
    combineResults: (results: any[]) => results[results.length - 1],
    maxDepth: 10,
  }),
};
