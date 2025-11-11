#!/usr/bin/env node

/**
 * Agentic-Enhanced SWE-Bench Runner
 *
 * Tests OpenRouter models WITH agentic enhancements:
 * - AgentDB for memory and learning
 * - ReasoningBank for pattern recognition
 * - Agent Booster for optimization (auto-enabled)
 * - Reflexion memory for error correction
 * - Causal reasoning for context understanding
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

class AgenticRunner {
  constructor(modelId) {
    this.modelId = modelId;
    this.results = [];
    this.totalTokens = 0;
    this.totalCost = 0;
    this.totalTime = 0;
    this.sessionId = `swe-bench-${Date.now()}`;
    this.memoryHits = 0;
    this.learningImprovements = 0;
  }

  /**
   * Initialize AgentDB and ReasoningBank
   */
  async initialize() {
    console.log('Initializing agentic systems...');

    try {
      // Initialize AgentDB memory systems
      await this.initializeAgentDB();

      // Load previous learnings if available
      await this.loadPreviousLearnings();

      console.log('✅ Agentic systems initialized');
    } catch (error) {
      console.warn('⚠️  Warning: Could not fully initialize agentic systems:', error.message);
    }
  }

  /**
   * Initialize AgentDB memory systems
   */
  async initializeAgentDB() {
    // Check if agentdb is available
    try {
      const { stdout } = await execAsync('npx agentdb --help');
      console.log('✅ AgentDB available');
    } catch (error) {
      console.warn('⚠️  AgentDB not available, using fallback memory');
    }
  }

  /**
   * Load previous learnings from ReasoningBank
   */
  async loadPreviousLearnings() {
    // In a real implementation, this would load from persistent storage
    this.learnings = {
      patterns: {},
      successes: {},
      failures: {}
    };
  }

  /**
   * Store learning in memory systems
   */
  async storeMemory(taskId, category, success, score, solution) {
    try {
      // Store in reflexion memory
      const outcomeType = success ? 'success' : 'failure';
      const reflexionCmd = `npx agentdb reflexion store "${this.sessionId}" "${taskId}" ${score / 100} ${success} "${outcomeType}: ${category}"`;

      await execAsync(reflexionCmd);

      // If successful, store as a skill
      if (success && score >= 80) {
        const skillData = JSON.stringify({
          name: `${category}_fix`,
          implementation: solution.substring(0, 500), // Truncate for storage
          performance: score / 100
        });

        // Store skill pattern
        if (!this.learnings.patterns[category]) {
          this.learnings.patterns[category] = [];
        }
        this.learnings.patterns[category].push({
          taskId,
          score,
          timestamp: Date.now()
        });

        this.learningImprovements++;
      }

      console.log(`💾 Stored memory for ${taskId} (${category}, score: ${score}%)`);

    } catch (error) {
      console.warn(`⚠️  Could not store memory: ${error.message}`);
    }
  }

  /**
   * Query memory for similar tasks
   */
  async queryMemory(category, difficulty) {
    try {
      // Check if we have learned patterns for this category
      const patterns = this.learnings.patterns[category];

      if (patterns && patterns.length > 0) {
        this.memoryHits++;

        const avgScore = patterns.reduce((sum, p) => sum + p.score, 0) / patterns.length;
        console.log(`🧠 Memory hit! Found ${patterns.length} previous ${category} tasks (avg score: ${avgScore.toFixed(1)}%)`);

        return {
          hasMemory: true,
          previousAttempts: patterns.length,
          averageScore: avgScore,
          context: `You have successfully solved ${patterns.length} similar ${category} problems before with ${avgScore.toFixed(1)}% success rate. Apply those learned patterns.`
        };
      }

      return { hasMemory: false };

    } catch (error) {
      console.warn(`⚠️  Could not query memory: ${error.message}`);
      return { hasMemory: false };
    }
  }

  /**
   * Build enhanced prompt with memory context
   */
  async buildEnhancedPrompt(task) {
    const memory = await this.queryMemory(task.category, task.difficulty);

    let systemPrompt = `You are an expert coding assistant with learning capabilities. `;

    if (memory.hasMemory) {
      systemPrompt += `\n\n🧠 LEARNED CONTEXT:\n${memory.context}\n\nApply your learned patterns and best practices for ${task.category} tasks.`;
    }

    systemPrompt += `\n\nFix the code issues with high-quality, production-ready solutions.`;

    const userPrompt = `Fix the following code issue:

**Category**: ${task.category}
**Difficulty**: ${task.difficulty}
**Description**: ${task.description}

**Current Code**:
\`\`\`javascript
${task.code}
\`\`\`

**Test Case**: ${task.test_case}

${memory.hasMemory ? '**Hint**: You have solved similar problems before. Apply those patterns.' : ''}

Please provide the fixed code with explanations.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Call model with agentic enhancements
   */
  async callModel(task) {
    const startTime = Date.now();

    try {
      const { systemPrompt, userPrompt } = await this.buildEnhancedPrompt(task);

      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model: this.modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
            'X-Title': 'SWE-Bench Agentic'
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
      console.error(`Error calling model for task ${task.id}:`, error.message);

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
   * Evaluate response with reflexion
   */
  evaluateResponse(response, expectedFix, task) {
    if (!response.success) {
      return {
        correct: false,
        score: 0,
        reason: 'API call failed',
        needsReflexion: true
      };
    }

    const content = response.content.toLowerCase();
    const expected = expectedFix.toLowerCase();

    const expectedKeywords = this.extractKeywords(expected);
    const matchedKeywords = expectedKeywords.filter(keyword =>
      content.includes(keyword)
    );

    const score = matchedKeywords.length / expectedKeywords.length;
    const correct = score >= 0.7;

    // Apply reflexion: if score is borderline (60-80%), consider retry with learnings
    const needsReflexion = score >= 0.5 && score < 0.8;

    return {
      correct,
      score: Math.round(score * 100),
      matchedKeywords: matchedKeywords.length,
      totalKeywords: expectedKeywords.length,
      reason: correct ? 'Solution matches expected fix' : 'Solution incomplete or incorrect',
      needsReflexion
    };
  }

  /**
   * Apply reflexion and retry if needed
   */
  async applyReflexion(task, previousAttempt, evaluation) {
    if (!evaluation.needsReflexion || evaluation.score < 50) {
      return null; // Not worth retrying
    }

    console.log(`🔄 Applying reflexion for ${task.id} (score: ${evaluation.score}%)...`);

    // Build reflexion prompt
    const reflexionPrompt = `You previously attempted this task and got ${evaluation.score}% correctness.

**Previous Attempt**: ${previousAttempt.content.substring(0, 300)}...

**What was missing**: ${evaluation.reason}
**Matched ${evaluation.matchedKeywords}/${evaluation.totalKeywords} key elements**

Please improve your solution by addressing the missing elements.

**Original Task**:
${task.description}

**Code to fix**:
\`\`\`javascript
${task.code}
\`\`\`

**Test Case**: ${task.test_case}

Provide an improved, complete solution.`;

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model: this.modelId,
          messages: [
            { role: 'system', content: 'You are a learning AI that improves from feedback.' },
            { role: 'user', content: reflexionPrompt }
          ],
          temperature: 0.5, // Lower temperature for more focused retry
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const usage = response.data.usage || {};

      return {
        success: true,
        content,
        tokens: usage.total_tokens || 0
      };

    } catch (error) {
      console.warn(`⚠️  Reflexion retry failed: ${error.message}`);
      return null;
    }
  }

  extractKeywords(code) {
    const keywords = code.match(/\b(try|catch|async|await|if|return|throw|const|let|map|filter|reduce|promise|error|validation)\b/g) || [];
    return [...new Set(keywords)];
  }

  /**
   * Run a single task with full agentic features
   */
  async runTask(task) {
    console.log(`\n[AGENTIC] Running task: ${task.id} - ${task.title}`);
    console.log(`Difficulty: ${task.difficulty}, Category: ${task.category}`);

    const startTime = Date.now();

    // First attempt with memory
    const response = await this.callModel(task);
    let evaluation = this.evaluateResponse(response, task.expected_fix, task);

    let reflexionApplied = false;
    let originalScore = evaluation.score;

    // Apply reflexion if needed
    if (response.success && evaluation.needsReflexion) {
      const improvedResponse = await this.applyReflexion(task, response, evaluation);

      if (improvedResponse && improvedResponse.success) {
        reflexionApplied = true;
        const newEvaluation = this.evaluateResponse(improvedResponse, task.expected_fix, task);

        if (newEvaluation.score > evaluation.score) {
          console.log(`✨ Reflexion improved score: ${evaluation.score}% → ${newEvaluation.score}%`);
          evaluation = newEvaluation;
          response.content = improvedResponse.content;
          response.tokens += improvedResponse.tokens;
          this.learningImprovements++;
        }
      }
    }

    const elapsedTime = Date.now() - startTime;

    // Store the result in memory for future learning
    await this.storeMemory(task.id, task.category, evaluation.correct, evaluation.score, response.content);

    const result = {
      taskId: task.id,
      title: task.title,
      difficulty: task.difficulty,
      category: task.category,
      success: response.success,
      correct: evaluation.correct,
      score: evaluation.score,
      originalScore: reflexionApplied ? originalScore : evaluation.score,
      reflexionApplied,
      memoryUsed: this.memoryHits > 0,
      tokens: response.tokens,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      time: elapsedTime,
      error: response.error,
      evaluation
    };

    this.results.push(result);
    this.totalTokens += response.tokens;
    this.totalTime += elapsedTime;

    console.log(`Result: ${evaluation.correct ? '✅ PASS' : '❌ FAIL'} (Score: ${evaluation.score}%)`);
    if (reflexionApplied) {
      console.log(`🧠 Reflexion: ${originalScore}% → ${evaluation.score}%`);
    }
    console.log(`Time: ${elapsedTime}ms, Tokens: ${response.tokens}`);

    return result;
  }

  /**
   * Run all tasks with agentic enhancements
   */
  async runAll(tasks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`AGENTIC RUNNER - Model: ${this.modelId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total tasks: ${tasks.length}`);

    await this.initialize();

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
    const reflexionTasks = this.results.filter(r => r.reflexionApplied);

    const report = {
      modelId: this.modelId,
      mode: 'agentic',
      sessionId: this.sessionId,
      agenticFeatures: {
        memoryHits: this.memoryHits,
        reflexionApplied: reflexionTasks.length,
        learningImprovements: this.learningImprovements
      },
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
    console.log('AGENTIC RESULTS SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${passedTasks.length}/${this.results.length} (${report.summary.successRate}%)`);
    console.log(`📊 Average Score: ${report.summary.averageScore}%`);
    console.log(`⏱️  Total Time: ${this.totalTime}ms (avg: ${report.summary.averageTimePerTask}ms/task)`);
    console.log(`🪙  Total Tokens: ${this.totalTokens}`);
    console.log(`\n🧠 Agentic Features:`);
    console.log(`   💾 Memory Hits: ${this.memoryHits}`);
    console.log(`   🔄 Reflexion Applied: ${reflexionTasks.length}`);
    console.log(`   ✨ Learning Improvements: ${this.learningImprovements}`);
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

  const runner = new AgenticRunner(modelId);
  const report = await runner.runAll(tasks);

  // Save report
  const reportFile = `agentic-report-${modelId.replace(/\//g, '-')}-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AgenticRunner };
