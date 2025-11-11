#!/usr/bin/env node

/**
 * Baseline SWE-Bench Runner
 *
 * Tests OpenRouter models WITHOUT agentic enhancements
 * - Direct API calls to OpenRouter
 * - No memory/learning system
 * - No optimization or caching
 * - Each task is independent (no context retention)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

class BaselineRunner {
  constructor(modelId) {
    this.modelId = modelId;
    this.results = [];
    this.totalTokens = 0;
    this.totalCost = 0;
    this.totalTime = 0;
  }

  /**
   * Call OpenRouter API directly without any enhancements
   */
  async callModel(prompt, taskId) {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model: this.modelId,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful coding assistant. Fix the code issues and provide the corrected code.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
            'X-Title': 'SWE-Bench Baseline'
          }
        }
      );

      const elapsedTime = Date.now() - startTime;
      const usage = response.data.usage || {};
      const content = response.data.choices[0]?.message?.content || '';

      return {
        success: true,
        content,
        tokens: usage.total_tokens || 0,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        time: elapsedTime,
        error: null
      };

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`Error calling model for task ${taskId}:`, error.message);

      return {
        success: false,
        content: '',
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        time: elapsedTime,
        error: error.message
      };
    }
  }

  /**
   * Evaluate if the generated code matches expectations
   */
  evaluateResponse(response, expectedFix) {
    if (!response.success) {
      return {
        correct: false,
        score: 0,
        reason: 'API call failed'
      };
    }

    const content = response.content.toLowerCase();
    const expected = expectedFix.toLowerCase();

    // Check if response contains key elements of the expected fix
    const expectedKeywords = this.extractKeywords(expected);
    const matchedKeywords = expectedKeywords.filter(keyword =>
      content.includes(keyword)
    );

    const score = matchedKeywords.length / expectedKeywords.length;
    const correct = score >= 0.7; // 70% keyword match threshold

    return {
      correct,
      score: Math.round(score * 100),
      matchedKeywords: matchedKeywords.length,
      totalKeywords: expectedKeywords.length,
      reason: correct ? 'Solution matches expected fix' : 'Solution incomplete or incorrect'
    };
  }

  /**
   * Extract important keywords from expected fix
   */
  extractKeywords(code) {
    // Extract meaningful keywords (function names, control structures, etc.)
    const keywords = code.match(/\b(try|catch|async|await|if|return|throw|const|let|map|filter|reduce|promise|error|validation)\b/g) || [];
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Run a single task
   */
  async runTask(task) {
    console.log(`\n[BASELINE] Running task: ${task.id} - ${task.title}`);
    console.log(`Difficulty: ${task.difficulty}, Category: ${task.category}`);

    const prompt = `Fix the following code issue:

**Description**: ${task.description}

**Current Code**:
\`\`\`javascript
${task.code}
\`\`\`

**Test Case**: ${task.test_case}

Please provide the fixed code.`;

    const startTime = Date.now();
    const response = await this.callModel(prompt, task.id);
    const elapsedTime = Date.now() - startTime;

    const evaluation = this.evaluateResponse(response, task.expected_fix);

    const result = {
      taskId: task.id,
      title: task.title,
      difficulty: task.difficulty,
      category: task.category,
      success: response.success,
      correct: evaluation.correct,
      score: evaluation.score,
      tokens: response.tokens,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      time: elapsedTime,
      error: response.error,
      evaluation: evaluation
    };

    this.results.push(result);
    this.totalTokens += response.tokens;
    this.totalTime += elapsedTime;

    console.log(`Result: ${evaluation.correct ? '✅ PASS' : '❌ FAIL'} (Score: ${evaluation.score}%)`);
    console.log(`Time: ${elapsedTime}ms, Tokens: ${response.tokens}`);

    return result;
  }

  /**
   * Run all tasks
   */
  async runAll(tasks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BASELINE RUNNER - Model: ${this.modelId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total tasks: ${tasks.length}`);

    for (const task of tasks) {
      await this.runTask(task);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return this.generateReport();
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const passedTasks = this.results.filter(r => r.correct);
    const failedTasks = this.results.filter(r => !r.correct);

    const report = {
      modelId: this.modelId,
      mode: 'baseline',
      summary: {
        totalTasks: this.results.length,
        passed: passedTasks.length,
        failed: failedTasks.length,
        successRate: (passedTasks.length / this.results.length * 100).toFixed(2),
        averageScore: (this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length).toFixed(2),
        totalTokens: this.totalTokens,
        totalTime: this.totalTime,
        averageTimePerTask: (this.totalTime / this.results.length).toFixed(2)
      },
      byDifficulty: this.groupByDifficulty(),
      byCategory: this.groupByCategory(),
      results: this.results
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log('BASELINE RESULTS SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${passedTasks.length}/${this.results.length} (${report.summary.successRate}%)`);
    console.log(`📊 Average Score: ${report.summary.averageScore}%`);
    console.log(`⏱️  Total Time: ${this.totalTime}ms (avg: ${report.summary.averageTimePerTask}ms/task)`);
    console.log(`🪙  Total Tokens: ${this.totalTokens}`);
    console.log(`${'='.repeat(60)}\n`);

    return report;
  }

  groupByDifficulty() {
    const groups = { easy: [], medium: [], hard: [] };
    this.results.forEach(r => {
      if (groups[r.difficulty]) {
        groups[r.difficulty].push(r);
      }
    });

    return {
      easy: {
        total: groups.easy.length,
        passed: groups.easy.filter(r => r.correct).length,
        successRate: groups.easy.length ? (groups.easy.filter(r => r.correct).length / groups.easy.length * 100).toFixed(2) : 0
      },
      medium: {
        total: groups.medium.length,
        passed: groups.medium.filter(r => r.correct).length,
        successRate: groups.medium.length ? (groups.medium.filter(r => r.correct).length / groups.medium.length * 100).toFixed(2) : 0
      },
      hard: {
        total: groups.hard.length,
        passed: groups.hard.filter(r => r.correct).length,
        successRate: groups.hard.length ? (groups.hard.filter(r => r.correct).length / groups.hard.length * 100).toFixed(2) : 0
      }
    };
  }

  groupByCategory() {
    const categories = {};
    this.results.forEach(r => {
      if (!categories[r.category]) {
        categories[r.category] = [];
      }
      categories[r.category].push(r);
    });

    const result = {};
    Object.keys(categories).forEach(cat => {
      result[cat] = {
        total: categories[cat].length,
        passed: categories[cat].filter(r => r.correct).length,
        successRate: (categories[cat].filter(r => r.correct).length / categories[cat].length * 100).toFixed(2)
      };
    });

    return result;
  }
}

// Main execution
async function main() {
  if (!OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY environment variable not set');
    process.exit(1);
  }

  const modelId = process.argv[2] || 'deepseek/deepseek-chat';
  const tasksFile = path.join(process.cwd(), 'swe-bench-tasks.json');

  console.log('Loading SWE-Bench tasks...');
  const tasksData = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  const tasks = tasksData.tasks;

  const runner = new BaselineRunner(modelId);
  const report = await runner.runAll(tasks);

  // Save report
  const reportFile = `baseline-report-${modelId.replace(/\//g, '-')}-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BaselineRunner };
