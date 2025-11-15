import { ResearchAgent } from './research-agent';
import { AgentMemory } from '../memory/agent-memory';
import { researchConfig } from '../config/research';
import { v4 as uuidv4 } from 'uuid';

export interface SwarmTask {
  id: string;
  topic: string;
  query: string;
  strategy: 'parallel' | 'sequential' | 'hierarchical';
  maxDepth?: number;
}

export interface SwarmResult {
  taskId: string;
  topic: string;
  query: string;
  aggregatedFindings: string;
  allInsights: string[];
  confidence: number;
  agentResults: any[];
  duration: number;
  timestamp: Date;
}

export class ResearchSwarm {
  private agents: ResearchAgent[];
  private sharedMemory: AgentMemory;
  private maxConcurrent: number;

  constructor(agentCount: number = 3) {
    this.sharedMemory = new AgentMemory();
    this.maxConcurrent = researchConfig.maxConcurrentAgents;
    this.agents = [];

    // Initialize swarm with different agent types
    const agentTypes = ['researcher', 'analyst', 'synthesizer', 'critic', 'explorer'];
    for (let i = 0; i < agentCount; i++) {
      const agentType = agentTypes[i % agentTypes.length];
      this.agents.push(new ResearchAgent(agentType, this.sharedMemory));
    }

    console.log(`🐝 Research Swarm initialized with ${agentCount} agents`);
  }

  public async executeSwarm(task: SwarmTask): Promise<SwarmResult> {
    const startTime = Date.now();
    console.log(`\n🚀 Starting swarm research on: ${task.topic}`);
    console.log(`📋 Strategy: ${task.strategy}`);

    let agentResults: any[] = [];

    switch (task.strategy) {
      case 'parallel':
        agentResults = await this.executeParallel(task);
        break;
      case 'sequential':
        agentResults = await this.executeSequential(task);
        break;
      case 'hierarchical':
        agentResults = await this.executeHierarchical(task);
        break;
    }

    const result = this.aggregateResults(task, agentResults, startTime);
    this.displaySwarmSummary(result);

    return result;
  }

  private async executeParallel(task: SwarmTask): Promise<any[]> {
    console.log('⚡ Executing parallel research with all agents...');

    const promises = this.agents.slice(0, this.maxConcurrent).map(agent =>
      agent.research({
        id: uuidv4(),
        topic: task.topic,
        query: task.query,
        depth: 1,
      })
    );

    return await Promise.all(promises);
  }

  private async executeSequential(task: SwarmTask): Promise<any[]> {
    console.log('🔗 Executing sequential research with context building...');

    const results: any[] = [];
    let context: string[] = [];

    for (const agent of this.agents.slice(0, this.maxConcurrent)) {
      const result = await agent.research({
        id: uuidv4(),
        topic: task.topic,
        query: task.query,
        depth: 1,
        context,
      });

      results.push(result);
      context.push(`${agent.getAgentType()}: ${result.response.substring(0, 200)}...`);
    }

    return results;
  }

  private async executeHierarchical(task: SwarmTask): Promise<any[]> {
    console.log('🌲 Executing hierarchical research with depth exploration...');

    const results: any[] = [];
    const maxDepth = task.maxDepth || researchConfig.maxDepth;

    // First level: Initial research by primary agent
    const primaryResult = await this.agents[0].research({
      id: uuidv4(),
      topic: task.topic,
      query: task.query,
      depth: 1,
    });

    results.push(primaryResult);

    // Second level: Explore sub-tasks with different agents
    if (primaryResult.subTasks && primaryResult.subTasks.length > 0) {
      const subTaskPromises = primaryResult.subTasks
        .slice(0, Math.min(this.maxConcurrent - 1, primaryResult.subTasks.length))
        .map((subTask, idx) => {
          const agent = this.agents[(idx + 1) % this.agents.length];
          return agent.research(subTask);
        });

      const subResults = await Promise.all(subTaskPromises);
      results.push(...subResults);

      // Third level: If depth allows, explore deeper
      if (maxDepth > 2) {
        for (const subResult of subResults.slice(0, 2)) {
          if (subResult.subTasks && subResult.subTasks.length > 0) {
            const deepTask = subResult.subTasks[0];
            const deepResult = await this.agents[2 % this.agents.length].research(deepTask);
            results.push(deepResult);
          }
        }
      }
    }

    return results;
  }

  private aggregateResults(task: SwarmTask, agentResults: any[], startTime: number): SwarmResult {
    // Aggregate all findings
    const allInsights = agentResults.flatMap(r => r.insights);
    const allResponses = agentResults.map(r => r.response).join('\n\n');

    // Calculate average confidence
    const avgConfidence = agentResults.reduce((sum, r) => sum + r.confidence, 0) / agentResults.length;

    // Create synthesized summary
    const aggregatedFindings = this.synthesizeFindings(agentResults);

    return {
      taskId: task.id,
      topic: task.topic,
      query: task.query,
      aggregatedFindings,
      allInsights: [...new Set(allInsights)], // Remove duplicates
      confidence: avgConfidence,
      agentResults,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  private synthesizeFindings(results: any[]): string {
    const synthesis = [
      '# Research Synthesis\n',
      '## Overview',
      `Based on ${results.length} agent analyses, the following comprehensive findings emerged:\n`,
    ];

    results.forEach((result, idx) => {
      synthesis.push(`### Agent ${idx + 1} Findings (Confidence: ${result.confidence.toFixed(2)})`);
      synthesis.push(result.response.substring(0, 300) + '...\n');
    });

    synthesis.push('## Key Insights');
    const uniqueInsights = [...new Set(results.flatMap(r => r.insights))];
    uniqueInsights.slice(0, 10).forEach(insight => {
      synthesis.push(`- ${insight}`);
    });

    synthesis.push('\n## Recommended Follow-up Areas');
    const allSubTasks = results.flatMap(r => r.subTasks || []);
    allSubTasks.slice(0, 5).forEach(task => {
      synthesis.push(`- ${task.query}`);
    });

    return synthesis.join('\n');
  }

  private displaySwarmSummary(result: SwarmResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SWARM RESEARCH COMPLETE');
    console.log('='.repeat(80));
    console.log(`📊 Topic: ${result.topic}`);
    console.log(`🤖 Agents Used: ${result.agentResults.length}`);
    console.log(`⚡ Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`💡 Insights Generated: ${result.allInsights.length}`);
    console.log('='.repeat(80));
  }

  public getMemoryStats() {
    return this.sharedMemory.getMemoryStats();
  }

  public async learnFromFeedback(taskId: string, feedback: string, rating: number): Promise<void> {
    console.log(`📝 Learning from feedback (Rating: ${rating}/5)...`);

    // This would integrate with the reflexion memory system
    // to improve future research based on user feedback
    const memories = this.sharedMemory.searchMemories(taskId, 1);

    if (memories.length > 0) {
      const memory = memories[0];
      console.log(`💭 Updating memory for task: ${memory.topic}`);

      // Adjust confidence based on feedback
      const adjustedConfidence = (memory.confidence + (rating / 5)) / 2;
      memory.confidence = adjustedConfidence;

      this.sharedMemory.addMemory(memory);
    }
  }

  public getRecentResearch(count: number = 5) {
    return this.sharedMemory.getRecentMemories(count);
  }
}
