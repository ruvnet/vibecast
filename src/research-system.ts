import { ResearchSwarm, SwarmTask, SwarmResult } from './agents/research-swarm';
import { validateConfig } from './config/openrouter';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface ResearchSystemConfig {
  agentCount?: number;
  saveResults?: boolean;
  resultsPath?: string;
}

interface InternalConfig {
  agentCount: number;
  saveResults: boolean;
  resultsPath: string;
}

export class ResearchSystem {
  private swarm: ResearchSwarm;
  private config: InternalConfig;
  private resultsPath: string;

  constructor(config: ResearchSystemConfig = {}) {
    // Validate configuration
    if (!validateConfig()) {
      throw new Error('Invalid configuration. Please check your environment variables.');
    }

    this.config = {
      agentCount: config.agentCount || 5,
      saveResults: config.saveResults !== false,
      resultsPath: config.resultsPath || './data/results',
    };

    this.resultsPath = this.config.resultsPath;

    // Initialize the research swarm
    this.swarm = new ResearchSwarm(this.config.agentCount);

    // Create results directory
    if (this.config.saveResults && !fs.existsSync(this.resultsPath)) {
      fs.mkdirSync(this.resultsPath, { recursive: true });
    }

    console.log('✅ Research System initialized successfully');
  }

  public async research(
    topic: string,
    query: string,
    strategy: 'parallel' | 'sequential' | 'hierarchical' = 'hierarchical'
  ): Promise<SwarmResult> {
    const task: SwarmTask = {
      id: uuidv4(),
      topic,
      query,
      strategy,
    };

    console.log(`\n🔬 Starting research on: "${topic}"`);
    console.log(`📝 Query: "${query}"`);
    console.log(`🎯 Strategy: ${strategy}\n`);

    const result = await this.swarm.executeSwarm(task);

    // Save results if configured
    if (this.config.saveResults) {
      this.saveResult(result);
    }

    return result;
  }

  public async researchWithFeedbackLoop(
    topic: string,
    query: string,
    minConfidence: number = 0.8
  ): Promise<SwarmResult> {
    console.log(`\n🔄 Starting self-learning research with feedback loop...`);
    console.log(`🎯 Target confidence: ${(minConfidence * 100).toFixed(0)}%\n`);

    let result = await this.research(topic, query, 'hierarchical');
    let iterations = 1;
    const maxIterations = 3;

    while (result.confidence < minConfidence && iterations < maxIterations) {
      console.log(`\n🔁 Confidence ${(result.confidence * 100).toFixed(1)}% below target. Refining research... (Iteration ${iterations + 1})`);

      // Use insights from previous iteration to refine the query
      const refinedQuery = this.refineQuery(query, result);

      result = await this.research(topic, refinedQuery, 'hierarchical');
      iterations++;
    }

    if (result.confidence >= minConfidence) {
      console.log(`\n✅ Target confidence achieved after ${iterations} iteration(s)!`);
    } else {
      console.log(`\n⚠️  Reached max iterations (${maxIterations}). Best confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }

    return result;
  }

  private refineQuery(originalQuery: string, previousResult: SwarmResult): string {
    // Generate a refined query based on gaps and insights from previous research
    const insights = previousResult.allInsights.slice(0, 3).join(', ');
    return `${originalQuery} - Focus on: ${insights}`;
  }

  public async parallelResearch(topics: string[]): Promise<SwarmResult[]> {
    console.log(`\n🌊 Starting parallel research on ${topics.length} topics...`);

    const promises = topics.map(topic =>
      this.research(topic, `Comprehensive research on ${topic}`, 'parallel')
    );

    return await Promise.all(promises);
  }

  public async provideFeedback(taskId: string, feedback: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    await this.swarm.learnFromFeedback(taskId, feedback, rating);
    console.log('✅ Feedback recorded. System will learn from this input.');
  }

  public getSystemStats() {
    const memoryStats = this.swarm.getMemoryStats();
    const recentResearch = this.swarm.getRecentResearch(5);

    return {
      memory: memoryStats,
      recentResearch: recentResearch.map(r => ({
        topic: r.topic,
        confidence: r.confidence,
        timestamp: r.timestamp,
      })),
    };
  }

  private saveResult(result: SwarmResult): void {
    const filename = `research_${result.taskId}_${Date.now()}.json`;
    const filepath = path.join(this.resultsPath, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      console.log(`💾 Results saved to: ${filepath}`);
    } catch (error) {
      console.error('❌ Error saving results:', error);
    }
  }

  public exportResults(format: 'json' | 'markdown' = 'markdown'): void {
    const recentResearch = this.swarm.getRecentResearch(10);

    if (format === 'markdown') {
      const markdown = this.generateMarkdownReport(recentResearch);
      const filepath = path.join(this.resultsPath, `research_report_${Date.now()}.md`);
      fs.writeFileSync(filepath, markdown);
      console.log(`📄 Markdown report exported to: ${filepath}`);
    } else {
      const filepath = path.join(this.resultsPath, `research_export_${Date.now()}.json`);
      fs.writeFileSync(filepath, JSON.stringify(recentResearch, null, 2));
      console.log(`📄 JSON export saved to: ${filepath}`);
    }
  }

  private generateMarkdownReport(memories: any[]): string {
    const lines = [
      '# Research System Report',
      `\nGenerated: ${new Date().toLocaleString()}`,
      `\nTotal Research Sessions: ${memories.length}\n`,
      '---\n',
    ];

    memories.forEach((memory, idx) => {
      lines.push(`## ${idx + 1}. ${memory.topic}`);
      lines.push(`**Date:** ${new Date(memory.timestamp).toLocaleString()}`);
      lines.push(`**Confidence:** ${(memory.confidence * 100).toFixed(1)}%`);
      lines.push(`**Query:** ${memory.query}\n`);
      lines.push('**Response:**');
      lines.push(memory.response.substring(0, 500) + '...\n');
      lines.push('**Key Insights:**');
      memory.insights.forEach((insight: string) => {
        lines.push(`- ${insight}`);
      });
      lines.push('\n---\n');
    });

    return lines.join('\n');
  }

  public displayWelcome(): void {
    console.log('\n' + '═'.repeat(80));
    console.log('🧠  VIBECAST SELF-LEARNING RESEARCH SYSTEM  🧠');
    console.log('═'.repeat(80));
    console.log('Powered by:');
    console.log('  • Agentic-Flow - Multi-agent orchestration');
    console.log('  • AgentDB - Vector-based memory with reflexion');
    console.log('  • Kimi K2 (OpenRouter) - 1T parameter MoE model');
    console.log('═'.repeat(80));
    console.log(`📊 Active Agents: ${this.config.agentCount}`);
    console.log(`💾 Results Path: ${this.resultsPath}`);
    console.log('═'.repeat(80) + '\n');
  }
}
