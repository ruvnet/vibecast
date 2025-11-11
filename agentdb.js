// AgentDB - Simple memory and learning system for AI agents
// Stores past attempts, learns from successes/failures, and provides context

import * as fs from 'fs';
import * as path from 'path';

export class AgentDB {
  constructor(dbPath = './agentdb.json') {
    this.dbPath = dbPath;
    this.memory = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load AgentDB, starting fresh:', error.message);
    }

    return {
      tasks: {},        // Task attempts and results
      patterns: {},     // Learned patterns
      strategies: {},   // Successful strategies
      errors: {},       // Common errors and fixes
      metadata: {
        totalAttempts: 0,
        successfulAttempts: 0,
        created: new Date().toISOString()
      }
    };
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      console.error('Could not save AgentDB:', error.message);
    }
  }

  // Store an attempt at solving a task
  storeAttempt(taskId, attempt) {
    if (!this.memory.tasks[taskId]) {
      this.memory.tasks[taskId] = {
        attempts: [],
        bestScore: 0,
        bestSolution: null
      };
    }

    const taskMemory = this.memory.tasks[taskId];
    taskMemory.attempts.push({
      timestamp: new Date().toISOString(),
      ...attempt
    });

    // Update best solution if this is better
    if (attempt.score > taskMemory.bestScore) {
      taskMemory.bestScore = attempt.score;
      taskMemory.bestSolution = attempt.solution;
    }

    this.memory.metadata.totalAttempts++;
    if (attempt.success) {
      this.memory.metadata.successfulAttempts++;
    }

    this.save();
  }

  // Get memory for a specific task
  getTaskMemory(taskId) {
    return this.memory.tasks[taskId] || null;
  }

  // Learn a pattern from successful attempts
  learnPattern(category, pattern) {
    if (!this.memory.patterns[category]) {
      this.memory.patterns[category] = [];
    }

    // Avoid duplicates
    const exists = this.memory.patterns[category].some(p =>
      JSON.stringify(p) === JSON.stringify(pattern)
    );

    if (!exists) {
      this.memory.patterns[category].push({
        ...pattern,
        learnedAt: new Date().toISOString()
      });
      this.save();
    }
  }

  // Get learned patterns for a category
  getPatterns(category) {
    return this.memory.patterns[category] || [];
  }

  // Store a successful strategy
  learnStrategy(taskType, strategy) {
    if (!this.memory.strategies[taskType]) {
      this.memory.strategies[taskType] = [];
    }

    this.memory.strategies[taskType].push({
      ...strategy,
      learnedAt: new Date().toISOString(),
      useCount: 0
    });

    this.save();
  }

  // Get strategies for a task type
  getStrategies(taskType) {
    return this.memory.strategies[taskType] || [];
  }

  // Store an error and its fix
  learnFromError(errorType, error, fix) {
    if (!this.memory.errors[errorType]) {
      this.memory.errors[errorType] = [];
    }

    this.memory.errors[errorType].push({
      error,
      fix,
      learnedAt: new Date().toISOString()
    });

    this.save();
  }

  // Get similar errors and their fixes
  getSimilarErrors(errorType) {
    return this.memory.errors[errorType] || [];
  }

  // Get context for a task (past attempts, patterns, strategies)
  getContext(taskId, category, difficulty) {
    const context = {
      pastAttempts: [],
      relevantPatterns: [],
      successfulStrategies: [],
      similarErrors: []
    };

    // Get past attempts for this task
    const taskMemory = this.getTaskMemory(taskId);
    if (taskMemory) {
      context.pastAttempts = taskMemory.attempts.slice(-3); // Last 3 attempts
      context.bestSolution = taskMemory.bestSolution;
      context.bestScore = taskMemory.bestScore;
    }

    // Get patterns for this category
    context.relevantPatterns = this.getPatterns(category);

    // Get strategies for this category
    context.successfulStrategies = this.getStrategies(category);

    // Get similar errors
    context.similarErrors = this.getSimilarErrors(category);

    return context;
  }

  // Generate insights from memory
  generateInsights() {
    const insights = {
      totalAttempts: this.memory.metadata.totalAttempts,
      successRate: this.memory.metadata.totalAttempts > 0
        ? (this.memory.metadata.successfulAttempts / this.memory.metadata.totalAttempts * 100).toFixed(1)
        : 0,
      tasksAttempted: Object.keys(this.memory.tasks).length,
      patternsLearned: Object.values(this.memory.patterns).reduce((sum, patterns) => sum + patterns.length, 0),
      strategiesLearned: Object.values(this.memory.strategies).reduce((sum, strats) => sum + strats.length, 0),
      errorsEncountered: Object.values(this.memory.errors).reduce((sum, errs) => sum + errs.length, 0)
    };

    // Find best performing categories
    insights.bestCategories = this.findBestCategories();

    // Find most common errors
    insights.commonErrors = this.findCommonErrors();

    return insights;
  }

  findBestCategories() {
    const categoryScores = {};

    Object.entries(this.memory.tasks).forEach(([taskId, taskData]) => {
      const category = taskId.split('-')[0]; // Assumes taskId like "SWE-001"
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 };
      }
      if (taskData.bestScore) {
        categoryScores[category].total += taskData.bestScore;
        categoryScores[category].count++;
      }
    });

    return Object.entries(categoryScores)
      .map(([category, data]) => ({
        category,
        avgScore: data.count > 0 ? (data.total / data.count).toFixed(2) : 0,
        attempts: data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  }

  findCommonErrors() {
    const errorCounts = {};

    Object.entries(this.memory.errors).forEach(([type, errors]) => {
      errorCounts[type] = errors.length;
    });

    return Object.entries(errorCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Clear all memory (for testing)
  clear() {
    this.memory = {
      tasks: {},
      patterns: {},
      strategies: {},
      errors: {},
      metadata: {
        totalAttempts: 0,
        successfulAttempts: 0,
        created: new Date().toISOString()
      }
    };
    this.save();
  }

  // Export memory for analysis
  export() {
    return JSON.parse(JSON.stringify(this.memory));
  }

  // Import memory (merge with existing)
  import(externalMemory) {
    // Merge tasks
    Object.entries(externalMemory.tasks || {}).forEach(([taskId, taskData]) => {
      if (!this.memory.tasks[taskId]) {
        this.memory.tasks[taskId] = taskData;
      } else {
        this.memory.tasks[taskId].attempts.push(...taskData.attempts);
        if (taskData.bestScore > this.memory.tasks[taskId].bestScore) {
          this.memory.tasks[taskId].bestScore = taskData.bestScore;
          this.memory.tasks[taskId].bestSolution = taskData.bestSolution;
        }
      }
    });

    // Merge patterns
    Object.entries(externalMemory.patterns || {}).forEach(([category, patterns]) => {
      if (!this.memory.patterns[category]) {
        this.memory.patterns[category] = [];
      }
      this.memory.patterns[category].push(...patterns);
    });

    // Merge strategies
    Object.entries(externalMemory.strategies || {}).forEach(([type, strategies]) => {
      if (!this.memory.strategies[type]) {
        this.memory.strategies[type] = [];
      }
      this.memory.strategies[type].push(...strategies);
    });

    // Merge errors
    Object.entries(externalMemory.errors || {}).forEach(([type, errors]) => {
      if (!this.memory.errors[type]) {
        this.memory.errors[type] = [];
      }
      this.memory.errors[type].push(...errors);
    });

    // Update metadata
    if (externalMemory.metadata) {
      this.memory.metadata.totalAttempts += externalMemory.metadata.totalAttempts || 0;
      this.memory.metadata.successfulAttempts += externalMemory.metadata.successfulAttempts || 0;
    }

    this.save();
  }
}

// Example usage and helper functions

export function createLearningPrompt(task, context) {
  let prompt = `Task: ${task.title}\n\n`;
  prompt += `Description: ${task.description}\n\n`;

  if (task.existingCode) {
    prompt += `Existing Code:\n\`\`\`javascript\n${task.existingCode}\n\`\`\`\n\n`;
  }

  prompt += `Expected Behavior: ${task.expectedBehavior}\n\n`;

  if (task.hints && task.hints.length > 0) {
    prompt += `Hints:\n${task.hints.map(h => `- ${h}`).join('\n')}\n\n`;
  }

  // Add context from AgentDB
  if (context.pastAttempts && context.pastAttempts.length > 0) {
    prompt += `## Past Attempts:\n`;
    context.pastAttempts.forEach((attempt, idx) => {
      prompt += `\nAttempt ${idx + 1} (Score: ${(attempt.score * 100).toFixed(0)}%):\n`;
      prompt += `\`\`\`javascript\n${attempt.solution.substring(0, 200)}...\n\`\`\`\n`;
      if (attempt.feedback) {
        prompt += `Feedback: ${attempt.feedback}\n`;
      }
    });
    prompt += '\n';
  }

  if (context.bestSolution) {
    prompt += `## Best Previous Solution (Score: ${(context.bestScore * 100).toFixed(0)}%):\n`;
    prompt += `\`\`\`javascript\n${context.bestSolution.substring(0, 300)}...\n\`\`\`\n\n`;
  }

  if (context.relevantPatterns && context.relevantPatterns.length > 0) {
    prompt += `## Learned Patterns for ${task.category}:\n`;
    context.relevantPatterns.slice(0, 3).forEach(pattern => {
      prompt += `- ${pattern.description || JSON.stringify(pattern)}\n`;
    });
    prompt += '\n';
  }

  if (context.successfulStrategies && context.successfulStrategies.length > 0) {
    prompt += `## Successful Strategies:\n`;
    context.successfulStrategies.slice(0, 3).forEach(strategy => {
      prompt += `- ${strategy.description || JSON.stringify(strategy)}\n`;
    });
    prompt += '\n';
  }

  prompt += `\nProvide a complete, corrected solution. Only return the code, no explanations.`;

  return prompt;
}
