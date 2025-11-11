// AgentDB Runner - Combines agentic flow with memory and self-learning
// Demonstrates maximum practical benefit of agent frameworks

import OpenAI from 'openai';
import { sweBenchTasks, evaluateCodeQuality } from './swe-bench-tasks.js';
import { AgentDB, createLearningPrompt } from './agentdb.js';

export class AgentDBRunner {
  constructor(modelName, apiKey, maxIterations = 3, dbPath = './agentdb.json') {
    this.modelName = modelName;
    this.maxIterations = maxIterations;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });
    this.agentDB = new AgentDB(dbPath);
    this.results = [];
  }

  async runTask(task) {
    console.log(`  [AgentDB] Running ${task.id}: ${task.title}`);

    const startTime = Date.now();
    let attempts = [];
    let bestSolution = null;
    let bestScore = 0;
    let totalTokens = 0;

    try {
      // Get context from memory
      const context = this.agentDB.getContext(task.id, task.category, task.difficulty);
      console.log(`    Memory: ${context.pastAttempts.length} past attempts, ${context.relevantPatterns.length} patterns`);

      // Phase 1: Plan (with memory)
      const plan = await this.createPlan(task, context);
      totalTokens += plan.tokensUsed;

      // Phase 2: Iterative solving with reflection and learning
      for (let iteration = 0; iteration < this.maxIterations; iteration++) {
        console.log(`    Iteration ${iteration + 1}/${this.maxIterations}`);

        // Generate solution with memory context
        const solution = await this.generateSolution(task, plan, attempts, context);
        totalTokens += solution.tokensUsed;

        // Evaluate
        const evaluation = evaluateCodeQuality(solution.code, task.correctSolution);

        attempts.push({
          iteration: iteration + 1,
          code: solution.code,
          evaluation,
          reasoning: solution.reasoning
        });

        // Store attempt in memory
        this.agentDB.storeAttempt(task.id, {
          solution: solution.code,
          score: evaluation.overall,
          success: evaluation.overall > 0.6,
          reasoning: solution.reasoning,
          category: task.category,
          difficulty: task.difficulty
        });

        // Update best if improved
        if (evaluation.overall > bestScore) {
          bestScore = evaluation.overall;
          bestSolution = solution.code;

          // Learn from successful improvement
          if (evaluation.overall > 0.7) {
            this.learnFromSuccess(task, solution, evaluation);
          }
        }

        // Early exit if excellent score
        if (evaluation.overall >= 0.85) {
          console.log(`    ✓ High score achieved: ${(evaluation.overall * 100).toFixed(0)}%`);

          // Learn successful strategy
          this.agentDB.learnStrategy(task.category, {
            description: `Successful approach for ${task.title}`,
            pattern: solution.reasoning,
            score: evaluation.overall
          });

          break;
        }

        // Reflect on the attempt with memory
        if (iteration < this.maxIterations - 1) {
          const reflection = await this.reflect(task, attempts, context);
          totalTokens += reflection.tokensUsed;
          attempts[attempts.length - 1].reflection = reflection.insights;

          // Learn from errors
          if (evaluation.overall < 0.5) {
            this.agentDB.learnFromError(task.category, {
              code: solution.code,
              score: evaluation.overall
            }, reflection.insights);
          }
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const executionTime = Date.now() - startTime;

      const result = {
        taskId: task.id,
        approach: 'agentdb',
        model: this.modelName,
        solution: bestSolution,
        evaluation: attempts.find(a => a.code === bestSolution)?.evaluation || { overall: 0 },
        executionTime,
        success: bestScore > 0.6,
        tokensUsed: totalTokens,
        attempts: attempts.length,
        allAttempts: attempts,
        plan: plan.steps,
        memoryUsed: {
          pastAttempts: context.pastAttempts.length,
          patterns: context.relevantPatterns.length,
          strategies: context.successfulStrategies.length
        }
      };

      this.results.push(result);

      console.log(`    ✓ Completed in ${executionTime}ms | Best Score: ${(bestScore * 100).toFixed(0)}% | Attempts: ${attempts.length} | Tokens: ${totalTokens}`);

      return result;

    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);

      const result = {
        taskId: task.id,
        approach: 'agentdb',
        model: this.modelName,
        solution: bestSolution,
        evaluation: { overall: bestScore },
        executionTime: Date.now() - startTime,
        success: false,
        error: error.message,
        tokensUsed: totalTokens,
        attempts: attempts.length
      };

      this.results.push(result);
      return result;
    }
  }

  async createPlan(task, context) {
    let prompt = `You are a software engineering expert with access to past learning. Create a plan to solve this problem:\n\n`;
    prompt += `Task: ${task.title}\n`;
    prompt += `Description: ${task.description}\n`;
    prompt += `Difficulty: ${task.difficulty}\n`;
    prompt += `Category: ${task.category}\n\n`;

    if (task.existingCode) {
      prompt += `Existing Code:\n\`\`\`javascript\n${task.existingCode}\n\`\`\`\n\n`;
    }

    // Add memory context
    if (context.successfulStrategies && context.successfulStrategies.length > 0) {
      prompt += `Previously successful strategies for ${task.category}:\n`;
      context.successfulStrategies.slice(0, 2).forEach(strategy => {
        prompt += `- ${strategy.description}\n`;
      });
      prompt += '\n';
    }

    if (context.bestSolution) {
      prompt += `Best previous solution (${(context.bestScore * 100).toFixed(0)}% score):\n`;
      prompt += `\`\`\`javascript\n${context.bestSolution.substring(0, 200)}...\n\`\`\`\n\n`;
      prompt += `Improve on this if possible.\n\n`;
    }

    prompt += `Create a step-by-step plan. Consider past learnings and proven strategies.`;

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 600
    });

    return {
      steps: response.choices[0].message.content,
      tokensUsed: response.usage.total_tokens
    };
  }

  async generateSolution(task, plan, previousAttempts, context) {
    let prompt = createLearningPrompt(task, context);

    // Add current iteration context
    prompt += `\n\nPlan:\n${plan.steps}\n\n`;

    // Add current iteration attempts
    if (previousAttempts.length > 0) {
      prompt += `Current Session Attempts:\n`;
      previousAttempts.slice(-2).forEach((attempt, idx) => {
        prompt += `\nAttempt ${idx + 1} (Score: ${(attempt.evaluation.overall * 100).toFixed(0)}%):\n`;
        if (attempt.reflection) {
          prompt += `Issues: ${attempt.reflection}\n`;
        }
      });
      prompt += '\n';
    }

    prompt += `Provide the complete solution.\n`;
    prompt += `Format:\nREASONING: [Your approach]\nCODE:\n\`\`\`javascript\n[Solution]\n\`\`\``;

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500
    });

    const content = response.choices[0].message.content;

    // Extract reasoning and code
    const reasoningMatch = content.match(/REASONING:\s*(.*?)(?=CODE:|```|$)/s);
    const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);

    return {
      code: codeMatch ? codeMatch[1].trim() : content.trim(),
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
      tokensUsed: response.usage.total_tokens
    };
  }

  async reflect(task, attempts, context) {
    const lastAttempt = attempts[attempts.length - 1];

    let prompt = `Review this solution attempt with access to past learnings:\n\n`;
    prompt += `Task: ${task.title}\n`;
    prompt += `Expected: ${task.expectedBehavior}\n\n`;

    prompt += `Solution:\n\`\`\`javascript\n${lastAttempt.code}\n\`\`\`\n\n`;

    prompt += `Evaluation:\n`;
    prompt += `- Correctness: ${(lastAttempt.evaluation.correctness * 100).toFixed(0)}%\n`;
    prompt += `- Code Quality: ${(lastAttempt.evaluation.codeQuality * 100).toFixed(0)}%\n`;
    prompt += `- Overall: ${(lastAttempt.evaluation.overall * 100).toFixed(0)}%\n\n`;

    // Add similar past errors
    if (context.similarErrors && context.similarErrors.length > 0) {
      prompt += `Similar errors seen before:\n`;
      context.similarErrors.slice(0, 2).forEach(err => {
        prompt += `- Error: ${JSON.stringify(err.error).substring(0, 100)}\n`;
        prompt += `  Fix: ${err.fix}\n`;
      });
      prompt += '\n';
    }

    prompt += `What's wrong? What needs fixing? Be specific (2-3 sentences).`;

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 300
    });

    return {
      insights: response.choices[0].message.content,
      tokensUsed: response.usage.total_tokens
    };
  }

  learnFromSuccess(task, solution, evaluation) {
    // Extract patterns from successful solutions
    const pattern = {
      description: `Successful pattern for ${task.category}: ${task.title}`,
      approach: solution.reasoning,
      score: evaluation.overall,
      codeSnippet: solution.code.substring(0, 150)
    };

    this.agentDB.learnPattern(task.category, pattern);
  }

  async runAll(tasks = sweBenchTasks) {
    console.log(`\n🟣 Running AgentDB Benchmark (${this.modelName})`);
    console.log('━'.repeat(70));

    for (const task of tasks) {
      await this.runTask(task);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate insights from learning
    const insights = this.agentDB.generateInsights();
    console.log(`\n📚 Learning Summary:`);
    console.log(`   Total attempts: ${insights.totalAttempts}`);
    console.log(`   Success rate: ${insights.successRate}%`);
    console.log(`   Patterns learned: ${insights.patternsLearned}`);
    console.log(`   Strategies learned: ${insights.strategiesLearned}`);

    const stats = this.getStats();
    stats.learningInsights = insights;

    return stats;
  }

  getStats() {
    const successfulTasks = this.results.filter(r => r.success);

    const stats = {
      approach: 'agentdb',
      model: this.modelName,
      totalTasks: this.results.length,
      successfulTasks: successfulTasks.length,
      successRate: (successfulTasks.length / this.results.length * 100).toFixed(1),
      avgScore: (this.results.reduce((sum, r) => sum + r.evaluation.overall, 0) / this.results.length * 100).toFixed(1),
      avgExecutionTime: Math.round(this.results.reduce((sum, r) => sum + r.executionTime, 0) / this.results.length),
      totalTokens: this.results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
      avgTokensPerTask: Math.round(this.results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0) / this.results.length),
      totalAttempts: this.results.reduce((sum, r) => sum + (r.attempts || 1), 0),
      avgAttemptsPerTask: (this.results.reduce((sum, r) => sum + (r.attempts || 1), 0) / this.results.length).toFixed(1),
      results: this.results
    };

    // Calculate category breakdown
    stats.byCategory = this.getCategoryBreakdown();
    stats.byDifficulty = this.getDifficultyBreakdown();

    return stats;
  }

  getCategoryBreakdown() {
    const categories = {};

    this.results.forEach(result => {
      const task = sweBenchTasks.find(t => t.id === result.taskId);
      if (task) {
        if (!categories[task.category]) {
          categories[task.category] = { total: 0, successful: 0, avgScore: 0, totalScore: 0 };
        }
        categories[task.category].total++;
        if (result.success) categories[task.category].successful++;
        categories[task.category].totalScore += result.evaluation.overall;
      }
    });

    // Calculate averages
    Object.keys(categories).forEach(cat => {
      categories[cat].avgScore = (categories[cat].totalScore / categories[cat].total * 100).toFixed(1);
      categories[cat].successRate = (categories[cat].successful / categories[cat].total * 100).toFixed(1);
    });

    return categories;
  }

  getDifficultyBreakdown() {
    const difficulties = {};

    this.results.forEach(result => {
      const task = sweBenchTasks.find(t => t.id === result.taskId);
      if (task) {
        if (!difficulties[task.difficulty]) {
          difficulties[task.difficulty] = { total: 0, successful: 0, avgScore: 0, totalScore: 0 };
        }
        difficulties[task.difficulty].total++;
        if (result.success) difficulties[task.difficulty].successful++;
        difficulties[task.difficulty].totalScore += result.evaluation.overall;
      }
    });

    // Calculate averages
    Object.keys(difficulties).forEach(diff => {
      difficulties[diff].avgScore = (difficulties[diff].totalScore / difficulties[diff].total * 100).toFixed(1);
      difficulties[diff].successRate = (difficulties[diff].successful / difficulties[diff].total * 100).toFixed(1);
    });

    return difficulties;
  }

  getDB() {
    return this.agentDB;
  }

  clearResults() {
    this.results = [];
  }
}
