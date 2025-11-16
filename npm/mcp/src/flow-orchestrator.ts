/**
 * Agentic Flow Orchestration Integration
 *
 * Integrates agentic-flow's 66 agents and 213 MCP tools for
 * multi-robot coordination and complex task execution
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface AgentTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  params: Record<string, any>;
  timeout?: number;
  retries?: number;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  result: any;
  executionTime: number;
  agentsUsed: string[];
  toolsUsed: string[];
  reasoning?: string;
}

export interface SwarmConfig {
  numAgents?: number;
  strategy?: 'parallel' | 'sequential' | 'adaptive' | 'swarm';
  mcpTools?: string[];
  reasoningEnabled?: boolean;
  learningEnabled?: boolean;
}

export interface OrchestrationMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgExecutionTime: number;
  agentUtilization: Record<string, number>;
  toolUsage: Record<string, number>;
}

export class FlowOrchestrator {
  private config: SwarmConfig;
  private metrics: OrchestrationMetrics;
  private initialized: boolean = false;

  constructor(config: SwarmConfig = {}) {
    this.config = {
      numAgents: config.numAgents || 66,
      strategy: config.strategy || 'adaptive',
      mcpTools: config.mcpTools || [],
      reasoningEnabled: config.reasoningEnabled ?? true,
      learningEnabled: config.learningEnabled ?? true,
    };

    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      agentUtilization: {},
      toolUsage: {},
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();

    try {
      // Initialize agentic-flow with configuration
      const cmd = [
        'npx agentic-flow init',
        `--agents ${this.config.numAgents}`,
        `--strategy ${this.config.strategy}`,
        this.config.reasoningEnabled ? '--enable-reasoning' : '',
        this.config.learningEnabled ? '--enable-learning' : '',
      ].filter(Boolean).join(' ');

      await execAsync(cmd);

      const initTime = Date.now() - startTime;
      console.error(`🌊 Agentic Flow initialized (${this.config.numAgents} agents, ${initTime}ms)`);
      this.initialized = true;
    } catch (error: any) {
      console.error('⚠️ Flow initialization warning:', error.message);
      this.initialized = true;
    }
  }

  /**
   * Execute a single task using agentic-flow orchestration
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.metrics.totalTasks++;

    try {
      const cmd = [
        'npx agentic-flow execute',
        `--task-type "${task.type}"`,
        `--priority ${task.priority}`,
        `--params '${JSON.stringify(task.params)}'`,
        task.timeout ? `--timeout ${task.timeout}` : '',
        task.retries ? `--retries ${task.retries}` : '',
        this.config.reasoningEnabled ? '--enable-reasoning' : '',
        '--format json',
      ].filter(Boolean).join(' ');

      const { stdout } = await execAsync(cmd, { timeout: task.timeout || 30000 });

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        const executionTime = Date.now() - startTime;
        this.metrics.successfulTasks++;
        this.updateMetrics(data, executionTime);

        console.error(`✅ Task ${task.id} completed in ${executionTime}ms`);

        return {
          taskId: task.id,
          success: true,
          result: data.result,
          executionTime,
          agentsUsed: data.agents_used || [],
          toolsUsed: data.tools_used || [],
          reasoning: data.reasoning,
        };
      }

      throw new Error('No valid JSON response from agentic-flow');
    } catch (error: any) {
      this.metrics.failedTasks++;
      const executionTime = Date.now() - startTime;

      console.error(`❌ Task ${task.id} failed: ${error.message}`);

      return {
        taskId: task.id,
        success: false,
        result: { error: error.message },
        executionTime,
        agentsUsed: [],
        toolsUsed: [],
      };
    }
  }

  /**
   * Execute multiple tasks in parallel using swarm intelligence
   */
  async executeSwarm(tasks: AgentTask[]): Promise<AgentResult[]> {
    const startTime = Date.now();

    console.error(`🐝 Executing swarm with ${tasks.length} tasks`);

    try {
      // Use agentic-flow's swarm coordination
      const tasksJson = JSON.stringify(tasks);
      const cmd = [
        'npx agentic-flow swarm',
        `--tasks '${tasksJson}'`,
        `--strategy ${this.config.strategy}`,
        `--num-agents ${this.config.numAgents}`,
        this.config.reasoningEnabled ? '--enable-reasoning' : '',
        '--format json',
      ].filter(Boolean).join(' ');

      const { stdout } = await execAsync(cmd, { timeout: 60000 });

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const results = Array.isArray(data) ? data : [data];

        const swarmTime = Date.now() - startTime;
        console.error(`🎯 Swarm completed ${results.length} tasks in ${swarmTime}ms`);

        return results.map((r, i) => ({
          taskId: tasks[i].id,
          success: r.success ?? true,
          result: r.result,
          executionTime: r.execution_time || swarmTime / results.length,
          agentsUsed: r.agents_used || [],
          toolsUsed: r.tools_used || [],
          reasoning: r.reasoning,
        }));
      }

      throw new Error('No valid JSON response from swarm execution');
    } catch (error: any) {
      console.error(`❌ Swarm execution failed: ${error.message}`);

      // Return individual failures
      return tasks.map(task => ({
        taskId: task.id,
        success: false,
        result: { error: error.message },
        executionTime: 0,
        agentsUsed: [],
        toolsUsed: [],
      }));
    }
  }

  /**
   * Coordinate multiple robots using agentic-flow
   */
  async coordinateRobots(
    robots: string[],
    mission: {
      type: string;
      objectives: string[];
      constraints?: Record<string, any>;
    }
  ): Promise<{
    success: boolean;
    assignments: Record<string, string[]>;
    executionPlan: any;
    estimatedTime: number;
  }> {
    const startTime = Date.now();

    try {
      const cmd = [
        'npx agentic-flow coordinate',
        `--robots '${JSON.stringify(robots)}'`,
        `--mission-type "${mission.type}"`,
        `--objectives '${JSON.stringify(mission.objectives)}'`,
        mission.constraints ? `--constraints '${JSON.stringify(mission.constraints)}'` : '',
        '--format json',
      ].filter(Boolean).join(' ');

      const { stdout } = await execAsync(cmd, { timeout: 30000 });

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        const coordTime = Date.now() - startTime;
        console.error(`🤝 Robot coordination completed in ${coordTime}ms`);

        return {
          success: true,
          assignments: data.assignments || {},
          executionPlan: data.execution_plan || {},
          estimatedTime: data.estimated_time || 0,
        };
      }

      throw new Error('No valid JSON response from coordination');
    } catch (error: any) {
      console.error(`❌ Coordination failed: ${error.message}`);

      return {
        success: false,
        assignments: {},
        executionPlan: {},
        estimatedTime: 0,
      };
    }
  }

  /**
   * Use ReasoningBank for complex decision making
   */
  async reasonAboutTask(
    context: string,
    options: {
      useMemory?: boolean;
      synthesizeStrategy?: boolean;
      explainReasoning?: boolean;
    } = {}
  ): Promise<{
    decision: string;
    reasoning: string;
    confidence: number;
    alternatives: string[];
  }> {
    const startTime = Date.now();

    try {
      const cmd = [
        'npx agentic-flow reason',
        `--context "${context}"`,
        options.useMemory ? '--use-memory' : '',
        options.synthesizeStrategy ? '--synthesize-strategy' : '',
        options.explainReasoning ? '--explain-reasoning' : '',
        '--format json',
      ].filter(Boolean).join(' ');

      const { stdout } = await execAsync(cmd, { timeout: 15000 });

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        const reasonTime = Date.now() - startTime;
        console.error(`🧠 Reasoning completed in ${reasonTime}ms`);

        return {
          decision: data.decision || '',
          reasoning: data.reasoning || '',
          confidence: data.confidence || 0,
          alternatives: data.alternatives || [],
        };
      }

      throw new Error('No valid JSON response from reasoning');
    } catch (error: any) {
      console.error(`❌ Reasoning failed: ${error.message}`);

      return {
        decision: '',
        reasoning: error.message,
        confidence: 0,
        alternatives: [],
      };
    }
  }

  /**
   * Get available MCP tools from agentic-flow
   */
  async getAvailableTools(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('npx agentic-flow list-tools --format json');

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('['));

      if (jsonLine) {
        const tools = JSON.parse(jsonLine);
        console.error(`🔧 Found ${tools.length}/213 MCP tools available`);
        return tools;
      }

      return [];
    } catch (error: any) {
      console.error('⚠️ Could not list tools:', error.message);
      return [];
    }
  }

  /**
   * Get metrics and statistics
   */
  getMetrics(): OrchestrationMetrics {
    return {
      ...this.metrics,
      avgExecutionTime: this.metrics.totalTasks > 0
        ? this.metrics.avgExecutionTime / this.metrics.totalTasks
        : 0,
    };
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(data: any, executionTime: number): void {
    // Update execution time
    this.metrics.avgExecutionTime += executionTime;

    // Track agent utilization
    if (data.agents_used) {
      for (const agent of data.agents_used) {
        this.metrics.agentUtilization[agent] = (this.metrics.agentUtilization[agent] || 0) + 1;
      }
    }

    // Track tool usage
    if (data.tools_used) {
      for (const tool of data.tools_used) {
        this.metrics.toolUsage[tool] = (this.metrics.toolUsage[tool] || 0) + 1;
      }
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      agentUtilization: {},
      toolUsage: {},
    };
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}
