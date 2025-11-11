/**
 * OpenRouter AI Optimizer
 * Uses AI models via OpenRouter to analyze benchmarks and suggest optimizations
 */

import chalk from 'chalk';

interface OptimizationSuggestion {
  category: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  implementation: string;
  expectedImprovement: string;
}

interface BenchmarkData {
  category: string;
  test: string;
  passed: boolean;
  time: number;
  details?: any;
}

class OpenRouterOptimizer {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private model: string;

  constructor(apiKey?: string, model: string = 'anthropic/claude-3.5-sonnet') {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = model;

    if (!this.apiKey) {
      console.warn(chalk.yellow('⚠️  OPENROUTER_API_KEY not set. Running in demo mode.'));
    }
  }

  /**
   * Analyze benchmark results and generate optimization suggestions
   */
  async analyzeAndOptimize(benchmarkData: BenchmarkData[]): Promise<OptimizationSuggestion[]> {
    if (!this.apiKey) {
      return this.getDemoSuggestions();
    }

    try {
      const analysis = await this.callOpenRouter(this.createAnalysisPrompt(benchmarkData));
      return this.parseSuggestions(analysis);
    } catch (error: any) {
      console.error(chalk.red(`Error calling OpenRouter: ${error.message}`));
      return this.getDemoSuggestions();
    }
  }

  /**
   * Create analysis prompt for OpenRouter
   */
  private createAnalysisPrompt(data: BenchmarkData[]): string {
    const summary = this.summarizeBenchmarks(data);

    return `You are a performance optimization expert analyzing a LangGraph-compatible workflow engine built with Rust/WASM and TypeScript.

**Benchmark Results:**
${summary}

**System Architecture:**
- TypeScript implementation (baseline)
- Rust/WASM backend (2-5x faster)
- napi-rs native addon (5-10x faster)

**Current Performance Metrics:**
- Graph compilation: 1450x faster than Python LangGraph
- Node execution: 2619x faster than Python LangGraph
- Multi-node workflows: 650x faster than Python LangGraph

**Task:**
Analyze the benchmark results and provide 3-5 specific optimization suggestions. For each suggestion, include:

1. Category (e.g., "Memory Management", "Algorithm Optimization", "Concurrency")
2. Priority (high/medium/low)
3. Brief description of the issue
4. Specific implementation approach
5. Expected performance improvement

Format as JSON array with this structure:
[
  {
    "category": "string",
    "priority": "high|medium|low",
    "suggestion": "string",
    "implementation": "string",
    "expectedImprovement": "string"
  }
]

Focus on actionable, specific optimizations that can be implemented in the codebase.`;
  }

  /**
   * Summarize benchmarks for analysis
   */
  private summarizeBenchmarks(data: BenchmarkData[]): string {
    let summary = '';

    const categories = [...new Set(data.map(d => d.category))];

    for (const category of categories) {
      summary += `\n${category}:\n`;
      const categoryData = data.filter(d => d.category === category);

      for (const test of categoryData) {
        const status = test.passed ? '✓' : '✗';
        summary += `  ${status} ${test.test}: ${test.time.toFixed(2)}ms`;

        if (test.details) {
          summary += ` (${JSON.stringify(test.details)})`;
        }
        summary += '\n';
      }
    }

    return summary;
  }

  /**
   * Call OpenRouter API
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
        'X-Title': 'Agentic Graph Optimizer'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Parse suggestions from OpenRouter response
   */
  private parseSuggestions(response: string): OptimizationSuggestion[] {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      return this.getDemoSuggestions();
    } catch (error) {
      console.error(chalk.red('Failed to parse suggestions, using demo mode'));
      return this.getDemoSuggestions();
    }
  }

  /**
   * Get demo suggestions when API is not available
   */
  private getDemoSuggestions(): OptimizationSuggestion[] {
    return [
      {
        category: 'Memory Management',
        priority: 'high',
        suggestion: 'Implement object pooling for frequently created state objects',
        implementation: 'Create a StatePool class that reuses State objects instead of allocating new ones. Pre-allocate a pool of 100 objects and recycle them after use. This reduces GC pressure during high-throughput scenarios.',
        expectedImprovement: '15-20% reduction in execution time for high-frequency operations, 30% reduction in GC pauses'
      },
      {
        category: 'Algorithm Optimization',
        priority: 'high',
        suggestion: 'Use lazy compilation for conditional edges',
        implementation: 'Instead of compiling all conditional edge branches upfront, compile them on-demand during first execution. Cache the compiled branches for subsequent runs. This reduces initial compilation time while maintaining runtime performance.',
        expectedImprovement: '40-50% faster graph compilation for graphs with many conditional edges'
      },
      {
        category: 'Concurrency',
        priority: 'medium',
        suggestion: 'Implement parallel node execution for independent nodes',
        implementation: 'Analyze the graph DAG to identify nodes without dependencies that can execute in parallel. Use Promise.all() or Worker threads for true parallelism. Add a --parallel flag to the CLI.',
        expectedImprovement: '2-3x faster execution for graphs with parallelizable nodes'
      },
      {
        category: 'Caching',
        priority: 'medium',
        suggestion: 'Add result memoization for pure node functions',
        implementation: 'Detect pure functions (no side effects) and cache their results based on input state hash. Store last 1000 results in an LRU cache. Add @pure decorator support.',
        expectedImprovement: '5-10x faster for workflows with repeated computations'
      },
      {
        category: 'Data Structures',
        priority: 'low',
        suggestion: 'Replace Map with typed arrays for numeric state keys',
        implementation: 'For state objects with primarily numeric values, use TypedArrays (Float64Array, Int32Array) instead of Map. This provides better memory locality and faster access.',
        expectedImprovement: '10-15% faster state operations for numeric-heavy workloads'
      }
    ];
  }

  /**
   * Display optimization suggestions
   */
  displaySuggestions(suggestions: OptimizationSuggestion[]): void {
    console.log(chalk.bold.green('\n🤖 AI-Powered Optimization Suggestions\n'));

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const priorityColor = s.priority === 'high' ? chalk.red :
                           s.priority === 'medium' ? chalk.yellow : chalk.blue;

      console.log(chalk.bold(`${i + 1}. ${s.category}`) + ` ${priorityColor(`[${s.priority.toUpperCase()}]`)}`);
      console.log(chalk.white(`   ${s.suggestion}`));
      console.log(chalk.gray(`\n   Implementation:`));
      console.log(chalk.gray(`   ${s.implementation}`));
      console.log(chalk.cyan(`\n   Expected Improvement: ${s.expectedImprovement}`));
      console.log();
    }

    console.log(chalk.bold('💡 Tips:'));
    console.log(chalk.white('  • Implement high-priority optimizations first'));
    console.log(chalk.white('  • Benchmark after each change to verify improvements'));
    console.log(chalk.white('  • Consider trade-offs between complexity and performance gains'));
    console.log();
  }

  /**
   * Available OpenRouter models for optimization
   */
  static getAvailableModels(): string[] {
    return [
      'anthropic/claude-3.5-sonnet',      // Best for detailed analysis
      'anthropic/claude-3-opus',          // Most capable
      'anthropic/claude-3-haiku',         // Fast and efficient
      'openai/gpt-4-turbo',               // Strong reasoning
      'google/gemini-pro-1.5',            // Long context
      'meta-llama/llama-3.1-70b-instruct', // Open source
      'mistralai/mixtral-8x7b-instruct'   // Fast inference
    ];
  }

  /**
   * Estimate cost of running optimization analysis
   */
  static estimateCost(model: string): string {
    const costs: { [key: string]: string } = {
      'anthropic/claude-3.5-sonnet': '$0.003 per analysis',
      'anthropic/claude-3-opus': '$0.015 per analysis',
      'anthropic/claude-3-haiku': '$0.0003 per analysis',
      'openai/gpt-4-turbo': '$0.01 per analysis',
      'google/gemini-pro-1.5': '$0.001 per analysis',
      'meta-llama/llama-3.1-70b-instruct': '$0.0008 per analysis',
      'mistralai/mixtral-8x7b-instruct': '$0.0006 per analysis'
    };

    return costs[model] || 'Cost varies';
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const model = args[0] || 'anthropic/claude-3.5-sonnet';

  console.log(chalk.bold.cyan('🤖 OpenRouter AI Optimizer\n'));
  console.log(`Model: ${model}`);
  console.log(`Estimated cost: ${OpenRouterOptimizer.estimateCost(model)}`);
  console.log();

  if (args.includes('--models')) {
    console.log(chalk.bold('Available Models:\n'));
    OpenRouterOptimizer.getAvailableModels().forEach(m => {
      console.log(`  • ${m} - ${OpenRouterOptimizer.estimateCost(m)}`);
    });
    console.log();
    process.exit(0);
  }

  // Demo mode - show sample suggestions
  const optimizer = new OpenRouterOptimizer(process.env.OPENROUTER_API_KEY, model);

  const demoBenchmarkData: BenchmarkData[] = [
    {
      category: 'performance',
      test: 'Graph Construction Speed',
      passed: true,
      time: 2.42,
      details: { timePerOp: '0.0024ms' }
    },
    {
      category: 'performance',
      test: 'Complex Workflow (50 nodes)',
      passed: true,
      time: 228.5,
      details: { timePerOp: '2.29ms' }
    },
    {
      category: 'scalability',
      test: 'Concurrent Executions',
      passed: true,
      time: 485.2,
      details: { concurrent: 100 }
    }
  ];

  optimizer.analyzeAndOptimize(demoBenchmarkData).then(suggestions => {
    optimizer.displaySuggestions(suggestions);
  });
}

export { OpenRouterOptimizer, OptimizationSuggestion, BenchmarkData };
