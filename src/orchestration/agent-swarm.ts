/**
 * Agent Swarm Orchestration System
 * Coordinates multiple agents working together on complex tasks
 */

import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';
import { nanoid } from 'nanoid';
import type { BaseAgent } from '../lib/base-agent.js';
import type { AgentTask, AgentResponse, AgentRole } from '../types/index.js';
import { appConfig } from '../config/index.js';

export interface SwarmConfig {
  maxConcurrentAgents?: number;
  taskTimeout?: number;
  enableLogging?: boolean;
}

export interface SwarmTask {
  id: string;
  name: string;
  agents: AgentRole[];
  coordination: 'sequential' | 'parallel' | 'conditional';
  input: any;
  condition?: (results: Map<string, AgentResponse>) => boolean;
}

export interface SwarmContext {
  taskId: string;
  results: Map<string, AgentResponse>;
  errors: Map<string, Error>;
  startTime: Date;
  metadata: Record<string, any>;
}

export class AgentSwarm extends EventEmitter {
  private agents: Map<AgentRole, BaseAgent> = new Map();
  private queue: PQueue;
  private activeTasks: Map<string, SwarmContext> = new Map();

  constructor(config?: SwarmConfig) {
    super();

    const maxConcurrent = config?.maxConcurrentAgents ?? appConfig.agents.maxConcurrent;
    this.queue = new PQueue({ concurrency: maxConcurrent });

    if (config?.enableLogging ?? appConfig.agents.enableLogging) {
      this.setupLogging();
    }
  }

  private setupLogging(): void {
    this.on('swarm-start', (data) => {
      console.log(`[Swarm] Task started: ${data.taskName} (${data.taskId})`);
    });

    this.on('swarm-complete', (data) => {
      console.log(
        `[Swarm] Task completed: ${data.taskName} in ${data.duration}ms`
      );
    });

    this.on('swarm-error', (data) => {
      console.error(`[Swarm] Task failed: ${data.taskName} - ${data.error.message}`);
    });

    this.on('agent-assigned', (data) => {
      console.log(`[Swarm] Agent ${data.agentRole} assigned to ${data.taskName}`);
    });
  }

  /**
   * Register an agent with the swarm
   */
  registerAgent(role: AgentRole, agent: BaseAgent): void {
    this.agents.set(role, agent);
    this.emit('agent-registered', { role, agentId: agent.getInfo().id });
  }

  /**
   * Execute a swarm task with multiple agents
   */
  async executeSwarmTask(swarmTask: SwarmTask): Promise<SwarmContext> {
    const context: SwarmContext = {
      taskId: swarmTask.id,
      results: new Map(),
      errors: new Map(),
      startTime: new Date(),
      metadata: {},
    };

    this.activeTasks.set(swarmTask.id, context);
    this.emit('swarm-start', { taskId: swarmTask.id, taskName: swarmTask.name });

    const startTime = Date.now();

    try {
      switch (swarmTask.coordination) {
        case 'sequential':
          await this.executeSequential(swarmTask, context);
          break;
        case 'parallel':
          await this.executeParallel(swarmTask, context);
          break;
        case 'conditional':
          await this.executeConditional(swarmTask, context);
          break;
      }

      const duration = Date.now() - startTime;
      this.emit('swarm-complete', {
        taskId: swarmTask.id,
        taskName: swarmTask.name,
        duration,
      });

      return context;
    } catch (error: any) {
      this.emit('swarm-error', {
        taskId: swarmTask.id,
        taskName: swarmTask.name,
        error,
      });
      throw error;
    } finally {
      this.activeTasks.delete(swarmTask.id);
    }
  }

  /**
   * Execute agents sequentially
   */
  private async executeSequential(
    swarmTask: SwarmTask,
    context: SwarmContext
  ): Promise<void> {
    for (const agentRole of swarmTask.agents) {
      const agent = this.agents.get(agentRole);
      if (!agent) {
        throw new Error(`Agent not found: ${agentRole}`);
      }

      this.emit('agent-assigned', {
        agentRole,
        taskName: swarmTask.name,
        taskId: swarmTask.id,
      });

      const task: AgentTask = {
        id: `${swarmTask.id}-${agentRole}`,
        type: swarmTask.name,
        input: this.prepareAgentInput(swarmTask.input, context.results),
        priority: 1,
        status: 'pending',
      };

      try {
        const response = await this.queue.add(() =>
          agent.processTask(task, {
            conversationId: swarmTask.id,
            agentId: agent.getInfo().id,
            timestamp: new Date(),
            metadata: context.metadata,
          })
        ) as AgentResponse;

        context.results.set(agentRole, response);
        this.emit('agent-complete', { agentRole, taskId: swarmTask.id, response });
      } catch (error: any) {
        context.errors.set(agentRole, error);
        this.emit('agent-error', { agentRole, taskId: swarmTask.id, error });
        throw error;
      }
    }
  }

  /**
   * Execute agents in parallel
   */
  private async executeParallel(
    swarmTask: SwarmTask,
    context: SwarmContext
  ): Promise<void> {
    const tasks = swarmTask.agents.map((agentRole) => {
      const agent = this.agents.get(agentRole);
      if (!agent) {
        throw new Error(`Agent not found: ${agentRole}`);
      }

      this.emit('agent-assigned', {
        agentRole,
        taskName: swarmTask.name,
        taskId: swarmTask.id,
      });

      const task: AgentTask = {
        id: `${swarmTask.id}-${agentRole}`,
        type: swarmTask.name,
        input: swarmTask.input,
        priority: 1,
        status: 'pending',
      };

      return this.queue.add(async () => {
        try {
          const response = await agent.processTask(task, {
            conversationId: swarmTask.id,
            agentId: agent.getInfo().id,
            timestamp: new Date(),
            metadata: context.metadata,
          });

          context.results.set(agentRole, response);
          this.emit('agent-complete', { agentRole, taskId: swarmTask.id, response });
          return response;
        } catch (error: any) {
          context.errors.set(agentRole, error);
          this.emit('agent-error', { agentRole, taskId: swarmTask.id, error });
          throw error;
        }
      });
    });

    await Promise.all(tasks);
  }

  /**
   * Execute agents conditionally based on results
   */
  private async executeConditional(
    swarmTask: SwarmTask,
    context: SwarmContext
  ): Promise<void> {
    for (const agentRole of swarmTask.agents) {
      // Check condition if provided
      if (swarmTask.condition && !swarmTask.condition(context.results)) {
        this.emit('agent-skipped', { agentRole, taskId: swarmTask.id });
        continue;
      }

      const agent = this.agents.get(agentRole);
      if (!agent) {
        throw new Error(`Agent not found: ${agentRole}`);
      }

      this.emit('agent-assigned', {
        agentRole,
        taskName: swarmTask.name,
        taskId: swarmTask.id,
      });

      const task: AgentTask = {
        id: `${swarmTask.id}-${agentRole}`,
        type: swarmTask.name,
        input: this.prepareAgentInput(swarmTask.input, context.results),
        priority: 1,
        status: 'pending',
      };

      try {
        const response = await this.queue.add(() =>
          agent.processTask(task, {
            conversationId: swarmTask.id,
            agentId: agent.getInfo().id,
            timestamp: new Date(),
            metadata: context.metadata,
          })
        ) as AgentResponse;

        context.results.set(agentRole, response);
        this.emit('agent-complete', { agentRole, taskId: swarmTask.id, response });
      } catch (error: any) {
        context.errors.set(agentRole, error);
        this.emit('agent-error', { agentRole, taskId: swarmTask.id, error });
        throw error;
      }
    }
  }

  /**
   * Prepare input for an agent, potentially using results from previous agents
   */
  private prepareAgentInput(
    baseInput: any,
    previousResults: Map<string, AgentResponse>
  ): any {
    if (previousResults.size === 0) {
      return baseInput;
    }

    // Combine base input with relevant previous results
    return {
      ...baseInput,
      previousResults: Array.from(previousResults.entries()).map(([role, response]) => ({
        role,
        content: response.content,
        metadata: response.metadata,
      })),
    };
  }

  /**
   * Message passing between agents
   */
  async sendMessage(
    fromAgent: AgentRole,
    toAgent: AgentRole,
    message: any
  ): Promise<AgentResponse> {
    const agent = this.agents.get(toAgent);
    if (!agent) {
      throw new Error(`Agent not found: ${toAgent}`);
    }

    this.emit('message-sent', { from: fromAgent, to: toAgent, message });

    const task: AgentTask = {
      id: nanoid(),
      type: 'message',
      input: { from: fromAgent, message },
      priority: 1,
      status: 'pending',
    };

    const response = await agent.processTask(task);
    this.emit('message-received', { from: fromAgent, to: toAgent, response });

    return response;
  }

  /**
   * Get status of an active task
   */
  getTaskStatus(taskId: string): SwarmContext | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * List all registered agents
   */
  listAgents(): Array<{ role: AgentRole; info: any }> {
    return Array.from(this.agents.entries()).map(([role, agent]) => ({
      role,
      info: agent.getInfo(),
    }));
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    active: number;
    concurrency: number;
  } {
    return {
      pending: this.queue.pending,
      active: this.queue.size,
      concurrency: this.queue.concurrency,
    };
  }

  /**
   * Shutdown the swarm and cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.queue.onIdle();
    this.queue.clear();
    this.removeAllListeners();
  }
}
