// Baseline Runner - Direct model calls without agent framework
// This represents standard LLM usage without agent enhancements

import OpenAI from 'openai';
import { sweBenchTasks, evaluateCodeQuality } from './swe-bench-tasks.js';

export class BaselineRunner {
  constructor(modelName, apiKey) {
    this.modelName = modelName;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });
    this.results = [];
  }

  async runTask(task) {
    console.log(`  [Baseline] Running ${task.id}: ${task.title}`);

    const startTime = Date.now();

    try {
      // Create simple prompt
      const prompt = this.createPrompt(task);

      // Single API call - no iteration, no tools, no memory
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      });

      const executionTime = Date.now() - startTime;
      const solution = this.extractCode(response.choices[0].message.content);

      // Evaluate the solution
      const evaluation = evaluateCodeQuality(solution, task.correctSolution);

      const result = {
        taskId: task.id,
        approach: 'baseline',
        model: this.modelName,
        solution,
        evaluation,
        executionTime,
        success: evaluation.overall > 0.6,
        tokensUsed: response.usage.total_tokens,
        attempts: 1 // Baseline only tries once
      };

      this.results.push(result);

      console.log(`    ✓ Completed in ${executionTime}ms | Score: ${(evaluation.overall * 100).toFixed(0)}% | Tokens: ${response.usage.total_tokens}`);

      return result;

    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);

      const result = {
        taskId: task.id,
        approach: 'baseline',
        model: this.modelName,
        solution: null,
        evaluation: { overall: 0, correctness: 0, codeQuality: 0, performance: 0, completeness: 0, security: 0 },
        executionTime: Date.now() - startTime,
        success: false,
        error: error.message,
        attempts: 1
      };

      this.results.push(result);
      return result;
    }
  }

  createPrompt(task) {
    let prompt = `You are an expert software engineer. Solve this coding problem:\n\n`;
    prompt += `Task: ${task.title}\n\n`;
    prompt += `Description: ${task.description}\n\n`;

    if (task.existingCode) {
      prompt += `Existing Code:\n\`\`\`javascript\n${task.existingCode}\n\`\`\`\n\n`;
      prompt += `Fix the bug in this code.\n\n`;
    } else {
      prompt += `Implement this from scratch.\n\n`;
    }

    prompt += `Expected Behavior: ${task.expectedBehavior}\n\n`;

    if (task.testCases && task.testCases.length > 0) {
      prompt += `Test Cases:\n`;
      task.testCases.forEach(tc => {
        if (tc.input) {
          prompt += `- Input: ${tc.input} => Expected: ${tc.expected}\n`;
        } else if (tc.scenario) {
          prompt += `- ${tc.scenario}\n`;
        }
      });
      prompt += '\n';
    }

    prompt += `Provide only the complete, corrected code solution. No explanations, just code.`;

    return prompt;
  }

  extractCode(response) {
    // Extract code from markdown code blocks if present
    const codeBlockMatch = response.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Otherwise return the whole response
    return response.trim();
  }

  async runAll(tasks = sweBenchTasks) {
    console.log(`\n🔵 Running Baseline Benchmark (${this.modelName})`);
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
      approach: 'baseline',
      model: this.modelName,
      totalTasks: this.results.length,
      successfulTasks: successfulTasks.length,
      successRate: (successfulTasks.length / this.results.length * 100).toFixed(1),
      avgScore: (this.results.reduce((sum, r) => sum + r.evaluation.overall, 0) / this.results.length * 100).toFixed(1),
      avgExecutionTime: Math.round(this.results.reduce((sum, r) => sum + r.executionTime, 0) / this.results.length),
      totalTokens: this.results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
      avgTokensPerTask: Math.round(this.results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0) / this.results.length),
      totalAttempts: this.results.length, // Baseline: 1 attempt per task
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
