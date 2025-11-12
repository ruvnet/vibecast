/**
 * Optimized Orchestrator: Enhanced agentic-graph system with AgentDB intelligence
 *
 * Improvements:
 * - Smart caching of LLM responses via AgentDB
 * - Pattern-based task optimization using historical data
 * - Automatic model selection based on task characteristics
 * - Cost tracking and optimization
 * - Self-improving through ReflexionMemory
 * - Parallel execution where possible
 */

import { StateGraph } from './graph';
import { State } from './state';
import { AgentDB, ReflexionMemory } from './agentdb';
import chalk from 'chalk';
import crypto from 'crypto';

interface TaskMetrics {
  taskType: string;
  model: string;
  tokens: number;
  cost: number;
  time: number;
  quality: number;
  success: boolean;
}

interface CachedResponse {
  content: string;
  tokens: number;
  cost: number;
  timestamp: number;
  quality: number;
}

interface OptimizationStrategy {
  useCache: boolean;
  preferredModel?: string;
  maxRetries: number;
  parallelExecution: boolean;
  learningEnabled: boolean;
}

export class OptimizedOrchestrator {
  private agentDB: AgentDB;
  private reflexion: ReflexionMemory;
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private metrics: TaskMetrics[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.agentDB = new AgentDB();
    this.reflexion = new ReflexionMemory(this.agentDB);

    console.log(chalk.cyan('🚀 Optimized Orchestrator initialized'));
    console.log(chalk.gray('  • AgentDB: Pattern storage & caching'));
    console.log(chalk.gray('  • ReflexionMemory: Continuous learning'));
    console.log(chalk.gray('  • Smart model selection'));
    console.log(chalk.gray('  • Cost optimization\n'));
  }

  /**
   * Generate cache key for similar queries
   */
  private getCacheKey(model: string, prompt: string, systemPrompt: string): string {
    const content = `${model}:${systemPrompt}:${prompt}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if we have a cached response
   */
  private async getCachedResponse(
    cacheKey: string,
    maxAge: number = 3600000 // 1 hour default
  ): Promise<CachedResponse | null> {
    try {
      const patterns = await this.agentDB.searchSimilar(`cache:${cacheKey}`, 1);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        const cached = JSON.parse(pattern.content) as CachedResponse;

        // Check if cache is still valid
        if (Date.now() - cached.timestamp < maxAge) {
          this.cacheHits++;
          console.log(chalk.green('  ✓ Cache hit! Using stored response'));
          return cached;
        }
      }
    } catch (error) {
      // Cache miss or error, continue normally
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Store response in cache
   */
  private async cacheResponse(
    cacheKey: string,
    content: string,
    tokens: number,
    cost: number,
    quality: number
  ): Promise<void> {
    const cached: CachedResponse = {
      content,
      tokens,
      cost,
      timestamp: Date.now(),
      quality
    };

    await this.agentDB.storePattern(
      `cache:${cacheKey}`,
      JSON.stringify(cached),
      {
        type: 'llm_cache',
        tokens,
        cost,
        quality,
        timestamp: Date.now()
      }
    );
  }

  /**
   * Learn from past executions to select best model
   */
  private async selectOptimalModel(taskType: string): Promise<string> {
    try {
      // Search for similar past successful tasks
      const patterns = await this.agentDB.searchSimilar(`task:${taskType}`, 10);

      if (patterns.length === 0) {
        // No history, use default best model
        return 'anthropic/claude-3.7-sonnet';
      }

      // Analyze metrics from past executions
      const modelScores: Record<string, { score: number; count: number }> = {};

      for (const pattern of patterns) {
        const metadata = pattern.metadata as any;
        if (metadata.success && metadata.model) {
          const model = metadata.model;
          const score = (metadata.quality || 0.5) / (metadata.cost || 1);

          if (!modelScores[model]) {
            modelScores[model] = { score: 0, count: 0 };
          }

          modelScores[model].score += score;
          modelScores[model].count += 1;
        }
      }

      // Find model with best score/cost ratio
      let bestModel = 'anthropic/claude-3.7-sonnet';
      let bestScore = 0;

      for (const [model, data] of Object.entries(modelScores)) {
        const avgScore = data.score / data.count;
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestModel = model;
        }
      }

      console.log(chalk.cyan(`  → Selected optimal model: ${bestModel} (score: ${bestScore.toFixed(2)})`));
      return bestModel;

    } catch (error) {
      return 'anthropic/claude-3.7-sonnet';
    }
  }

  /**
   * Call LLM with caching and error handling
   */
  private async callLLMOptimized(
    model: string,
    prompt: string,
    systemPrompt: string = 'You are an expert software engineer.',
    strategy: OptimizationStrategy = { useCache: true, maxRetries: 3, parallelExecution: false, learningEnabled: true }
  ): Promise<{ content: string; tokens: number; cost: number; time: number; cached: boolean }> {
    const start = performance.now();

    // Check cache if enabled
    if (strategy.useCache) {
      const cacheKey = this.getCacheKey(model, prompt, systemPrompt);
      const cached = await this.getCachedResponse(cacheKey);

      if (cached) {
        return {
          content: cached.content,
          tokens: cached.tokens,
          cost: 0, // No cost for cached response!
          time: performance.now() - start,
          cached: true
        };
      }
    }

    // Make actual API call with retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
            'X-Title': 'Agentic Graph Optimized'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 2000
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error (${response.status}): ${error}`);
        }

        const data: any = await response.json();
        const content = data.choices[0].message.content;
        const tokens = data.usage?.total_tokens || 0;
        const cost = this.estimateCost(tokens, model);
        const time = performance.now() - start;

        // Cache successful response
        if (strategy.useCache) {
          const cacheKey = this.getCacheKey(model, prompt, systemPrompt);
          await this.cacheResponse(cacheKey, content, tokens, cost, 0.9);
        }

        return { content, tokens, cost, time, cached: false };

      } catch (error: any) {
        lastError = error;
        console.log(chalk.yellow(`  ⚠️  Attempt ${attempt + 1} failed: ${error.message}`));

        if (attempt < strategy.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(chalk.gray(`  → Retrying in ${delay}ms...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('LLM call failed after all retries');
  }

  /**
   * Estimate cost per model
   */
  private estimateCost(tokens: number, model: string): number {
    const costs: Record<string, number> = {
      'anthropic/claude-3.7-sonnet': 3.0,
      'anthropic/claude-3.5-sonnet': 3.0,
      'moonshot/kimi-k2': 0.30,
      'google/gemini-2.5-pro': 1.25,
      'google/gemini-2.0-flash-thinking': 0.10,
      'openai/gpt-4o': 2.5,
      'deepseek/deepseek-coder-v2.5': 0.14
    };

    const costPer1M = costs[model] || 1.0;
    return (tokens / 1000000) * costPer1M;
  }

  /**
   * Execute workflow with optimizations
   */
  async executeOptimized(
    taskType: string,
    input: any,
    strategy?: Partial<OptimizationStrategy>
  ): Promise<any> {
    const fullStrategy: OptimizationStrategy = {
      useCache: true,
      maxRetries: 3,
      parallelExecution: false,
      learningEnabled: true,
      ...strategy
    };

    console.log(chalk.cyan(`\n🔄 Executing optimized workflow: ${taskType}`));

    const start = performance.now();
    const graph = new StateGraph({ name: taskType });

    // Step 1: Select optimal model based on history
    const optimalModel = strategy?.preferredModel ||
      await this.selectOptimalModel(taskType);

    // Step 2: Build workflow
    graph.addNode('execute', async (state: any) => {
      console.log(chalk.white(`  → Using model: ${optimalModel}`));

      const result = await this.callLLMOptimized(
        optimalModel,
        state.prompt,
        state.systemPrompt || 'You are an expert software engineer.',
        fullStrategy
      );

      return {
        ...state,
        result: result.content,
        tokens: result.tokens,
        cost: result.cost,
        llmTime: result.time,
        cached: result.cached,
        model: optimalModel
      };
    });

    // Step 3: Quality check
    graph.addNode('validate', (state: any) => {
      const quality = this.assessQuality(state.result, taskType);

      console.log(chalk.white(`  → Quality assessment: ${(quality * 100).toFixed(0)}%`));

      return {
        ...state,
        quality,
        valid: quality >= 0.6
      };
    });

    // Step 4: Learn from execution
    if (fullStrategy.learningEnabled) {
      graph.addNode('learn', async (state: any) => {
        // Store pattern
        await this.agentDB.storePattern(
          `task:${taskType}:${Date.now()}`,
          JSON.stringify({
            input: state.prompt,
            output: state.result,
            model: state.model
          }),
          {
            type: 'execution',
            taskType,
            model: state.model,
            tokens: state.tokens,
            cost: state.cost,
            quality: state.quality,
            success: state.valid,
            timestamp: Date.now()
          }
        );

        // Record in reflexion memory
        if (state.valid) {
          const learnState = new State();
          learnState.set('taskType', taskType);
          learnState.set('model', state.model);
          learnState.set('quality', state.quality);

          await this.reflexion.recordSuccess(
            `${taskType}-execution`,
            learnState,
            state.quality
          );

          console.log(chalk.green('  ✓ Pattern stored for future optimization'));
        }

        return state;
      });
    }

    // Build workflow
    graph.addEdge('execute', 'validate');
    if (fullStrategy.learningEnabled) {
      graph.addEdge('validate', 'learn');
      graph.setFinish('learn');
    } else {
      graph.setFinish('validate');
    }

    graph.setEntry('execute');
    graph.compile();

    // Execute
    const result = await graph.invoke(input);
    const totalTime = performance.now() - start;

    // Track metrics
    this.metrics.push({
      taskType,
      model: result.state.model,
      tokens: result.state.tokens,
      cost: result.state.cost,
      time: totalTime,
      quality: result.state.quality,
      success: result.state.valid
    });

    console.log(chalk.green(`✓ Completed in ${totalTime.toFixed(0)}ms`));
    if (result.state.cached) {
      console.log(chalk.green('  💰 Cost saved: $' + result.state.cost.toFixed(4)));
    }

    return result.state;
  }

  /**
   * Assess quality of output (simple heuristic)
   */
  private assessQuality(output: string, taskType: string): number {
    let score = 0.5; // Base score

    // Check length
    if (output.length > 100) score += 0.1;
    if (output.length > 500) score += 0.1;

    // Check for code patterns
    if (taskType.includes('code') || taskType.includes('function')) {
      if (output.includes('function') || output.includes('const')) score += 0.1;
      if (output.includes('return')) score += 0.1;
      if (output.includes('//') || output.includes('/*')) score += 0.1;
    }

    // Check for structure
    if (output.includes('\n\n')) score += 0.05; // Well formatted
    if (output.includes('```')) score += 0.05; // Code blocks

    return Math.min(score, 1.0);
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const totalCost = this.metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTime = this.metrics.reduce((sum, m) => sum + m.time, 0);
    const avgQuality = this.metrics.reduce((sum, m) => sum + m.quality, 0) / (this.metrics.length || 1);
    const successRate = this.metrics.filter(m => m.success).length / (this.metrics.length || 1);

    const cacheTotal = this.cacheHits + this.cacheMisses;
    const cacheHitRate = cacheTotal > 0 ? this.cacheHits / cacheTotal : 0;

    return {
      totalExecutions: this.metrics.length,
      totalCost,
      totalTime,
      avgQuality,
      successRate,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      costSaved: this.cacheHits * 0.001 // Rough estimate
    };
  }

  /**
   * Display statistics
   */
  displayStats() {
    const stats = this.getStats();

    console.log(chalk.bold.cyan('\n📊 Optimization Statistics\n'));
    console.log(chalk.white('Performance:'));
    console.log(`  Total Executions: ${stats.totalExecutions}`);
    console.log(`  Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg Quality: ${(stats.avgQuality * 100).toFixed(1)}%`);
    console.log(`  Total Time: ${stats.totalTime.toFixed(0)}ms`);

    console.log(chalk.white('\nCaching:'));
    console.log(`  Cache Hit Rate: ${chalk.green((stats.cacheHitRate * 100).toFixed(1) + '%')}`);
    console.log(`  Hits: ${chalk.green(stats.cacheHits.toString())} | Misses: ${chalk.yellow(stats.cacheMisses.toString())}`);
    console.log(`  Cost Saved: ${chalk.green('~$' + stats.costSaved.toFixed(4))}`);

    console.log(chalk.white('\nCosts:'));
    console.log(`  Total Spent: $${stats.totalCost.toFixed(4)}`);
    console.log(`  Net Cost (after cache): $${(stats.totalCost - stats.costSaved).toFixed(4)}`);
  }

  /**
   * Parallel execution of multiple tasks
   */
  async executeParallel(
    tasks: Array<{ taskType: string; input: any }>,
    strategy?: Partial<OptimizationStrategy>
  ): Promise<any[]> {
    console.log(chalk.cyan(`\n🚀 Executing ${tasks.length} tasks in parallel...`));

    const start = performance.now();

    const promises = tasks.map(task =>
      this.executeOptimized(task.taskType, task.input, { ...strategy, parallelExecution: true })
    );

    const results = await Promise.all(promises);
    const totalTime = performance.now() - start;

    console.log(chalk.green(`\n✓ All ${tasks.length} tasks completed in ${totalTime.toFixed(0)}ms`));
    console.log(chalk.gray(`  (avg: ${(totalTime / tasks.length).toFixed(0)}ms per task)`));

    return results;
  }
}

// CLI demo
if (require.main === module) {
  async function demo() {
    console.log(chalk.bold.green('\n🧪 Optimized Orchestrator Demo\n'));

    const orchestrator = new OptimizedOrchestrator();

    // Example 1: Code generation with caching
    console.log(chalk.bold('\n1. Code Generation (with caching)'));

    const result1 = await orchestrator.executeOptimized(
      'code-generation',
      {
        prompt: 'Write a TypeScript function to check if a number is prime',
        systemPrompt: 'You are an expert TypeScript developer.'
      }
    );

    console.log(chalk.white('\nGenerated code:'));
    console.log(chalk.gray(result1.result.substring(0, 200) + '...'));

    // Example 2: Same task again (should hit cache)
    console.log(chalk.bold('\n2. Same Task Again (should use cache)'));

    const result2 = await orchestrator.executeOptimized(
      'code-generation',
      {
        prompt: 'Write a TypeScript function to check if a number is prime',
        systemPrompt: 'You are an expert TypeScript developer.'
      }
    );

    // Example 3: Parallel execution
    console.log(chalk.bold('\n3. Parallel Execution'));

    await orchestrator.executeParallel([
      {
        taskType: 'code-generation',
        input: { prompt: 'Write a function to reverse a string' }
      },
      {
        taskType: 'code-generation',
        input: { prompt: 'Write a function to find factorial' }
      },
      {
        taskType: 'code-generation',
        input: { prompt: 'Write a function to sort an array' }
      }
    ]);

    // Display stats
    orchestrator.displayStats();
  }

  demo().catch(console.error);
}

export default OptimizedOrchestrator;
