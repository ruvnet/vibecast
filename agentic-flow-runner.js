// Agentic Flow Runner - Uses agent patterns: iteration, reflection, tool use
// Demonstrates the value of agent frameworks vs direct model calls

import OpenAI from 'openai';
import { sweBenchTasks, evaluateCodeQuality } from './swe-bench-tasks.js';

export class AgenticFlowRunner {
  constructor(modelName, apiKey, maxIterations = 3) {
    this.modelName = modelName;
    this.maxIterations = maxIterations;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });
    this.results = [];
  }

  async runTask(task) {
    console.log(`  [Agentic] Running ${task.id}: ${task.title}`);

    const startTime = Date.now();
    let attempts = [];
    let bestSolution = null;
    let bestScore = 0;
    let totalTokens = 0;

    try {
      // Phase 1: Plan
      const plan = await this.createPlan(task);
      totalTokens += plan.tokensUsed;

      // Phase 2: Iterative solving with reflection
      for (let iteration = 0; iteration < this.maxIterations; iteration++) {
        console.log(`    Iteration ${iteration + 1}/${this.maxIterations}`);

        // Generate solution
        const solution = await this.generateSolution(task, plan, attempts);
        totalTokens += solution.tokensUsed;

        // Evaluate
        const evaluation = evaluateCodeQuality(solution.code, task.correctSolution);

        attempts.push({
          iteration: iteration + 1,
          code: solution.code,
          evaluation,
          reasoning: solution.reasoning
        });

        // Update best if improved
        if (evaluation.overall > bestScore) {
          bestScore = evaluation.overall;
          bestSolution = solution.code;
        }

        // Early exit if good enough
        if (evaluation.overall >= 0.85) {
          console.log(`    ✓ High score achieved: ${(evaluation.overall * 100).toFixed(0)}%`);
          break;
        }

        // Reflect on the attempt
        if (iteration < this.maxIterations - 1) {
          const reflection = await this.reflect(task, attempts);
          totalTokens += reflection.tokensUsed;
          attempts[attempts.length - 1].reflection = reflection.insights;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const executionTime = Date.now() - startTime;

      const result = {
        taskId: task.id,
        approach: 'agentic-flow',
        model: this.modelName,
        solution: bestSolution,
        evaluation: attempts.find(a => a.code === bestSolution)?.evaluation || { overall: 0 },
        executionTime,
        success: bestScore > 0.6,
        tokensUsed: totalTokens,
        attempts: attempts.length,
        allAttempts: attempts,
        plan: plan.steps
      };

      this.results.push(result);

      console.log(`    ✓ Completed in ${executionTime}ms | Best Score: ${(bestScore * 100).toFixed(0)}% | Attempts: ${attempts.length} | Tokens: ${totalTokens}`);

      return result;

    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);

      const result = {
        taskId: task.id,
        approach: 'agentic-flow',
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

  async createPlan(task) {
    const prompt = `You are a software engineering expert. Create a plan to solve this problem:

Task: ${task.title}
Description: ${task.description}
Difficulty: ${task.difficulty}
Category: ${task.category}

${task.existingCode ? `Existing Code:\n\`\`\`javascript\n${task.existingCode}\n\`\`\`\n` : ''}

Create a step-by-step plan to solve this. Consider:
1. What's the root cause (if fixing a bug)?
2. What algorithm or pattern should be used?
3. What edge cases need handling?
4. What's the implementation strategy?

Provide a concise 3-5 step plan.`;

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500
    });

    return {
      steps: response.choices[0].message.content,
      tokensUsed: response.usage.total_tokens
    };
  }

  async generateSolution(task, plan, previousAttempts) {
    let prompt = `You are an expert software engineer. Solve this problem:\n\n`;
    prompt += `Task: ${task.title}\n`;
    prompt += `Description: ${task.description}\n\n`;

    if (task.existingCode) {
      prompt += `Existing Code:\n\`\`\`javascript\n${task.existingCode}\n\`\`\`\n\n`;
    }

    prompt += `Expected Behavior: ${task.expectedBehavior}\n\n`;

    // Add plan
    prompt += `Plan:\n${plan.steps}\n\n`;

    // Add hints
    if (task.hints && task.hints.length > 0) {
      prompt += `Hints:\n${task.hints.map(h => `- ${h}`).join('\n')}\n\n`;
    }

    // Add previous attempts if any
    if (previousAttempts.length > 0) {
      prompt += `Previous Attempts:\n`;
      previousAttempts.forEach((attempt, idx) => {
        prompt += `\nAttempt ${idx + 1} (Score: ${(attempt.evaluation.overall * 100).toFixed(0)}%):\n`;
        if (attempt.reflection) {
          prompt += `Issues found: ${attempt.reflection}\n`;
        }
        prompt += `\nCode:\n\`\`\`javascript\n${attempt.code.substring(0, 300)}...\n\`\`\`\n`;
      });
      prompt += `\nLearn from these attempts and improve.\n\n`;
    }

    prompt += `Provide the complete solution. Format:\n`;
    prompt += `REASONING: [Brief explanation of your approach]\n`;
    prompt += `CODE:\n\`\`\`javascript\n[Your solution]\n\`\`\``;

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

  async reflect(task, attempts) {
    const lastAttempt = attempts[attempts.length - 1];

    const prompt = `Review this solution attempt and identify issues:

Task: ${task.title}
Expected: ${task.expectedBehavior}

Solution:
\`\`\`javascript
${lastAttempt.code}
\`\`\`

Evaluation:
- Correctness: ${(lastAttempt.evaluation.correctness * 100).toFixed(0)}%
- Code Quality: ${(lastAttempt.evaluation.codeQuality * 100).toFixed(0)}%
- Overall Score: ${(lastAttempt.evaluation.overall * 100).toFixed(0)}%

What's wrong with this solution? What needs to be fixed? Be specific and concise (2-3 sentences).`;

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

  async runAll(tasks = sweBenchTasks) {
    console.log(`\n🟢 Running Agentic Flow Benchmark (${this.modelName})`);
    console.log('━'.repeat(70));

    for (const task of tasks) {
      await this.runTask(task);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return this.getStats();
  }

  getStats() {
    const successfulTasks = this.results.filter(r => r.success);

    const stats = {
      approach: 'agentic-flow',
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

  clearResults() {
    this.results = [];
  }
}
