/**
 * Lean-Agentic Framework Integration
 * Lightweight agent operations with minimal overhead
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentTask, AgentResponse } from '../../types/index.js';

export interface LeanAgentConfig {
  id: string;
  name: string;
  handler: (input: any) => Promise<any>;
  timeout?: number;
  priority?: number;
}

export interface TaskQueue {
  high: AgentTask[];
  normal: AgentTask[];
  low: AgentTask[];
}

export class LeanAgenticEngine extends EventEmitter {
  private agents: Map<string, LeanAgentConfig> = new Map();
  private taskQueue: TaskQueue = {
    high: [],
    normal: [],
    low: [],
  };
  private processing: boolean = false;

  /**
   * Register a lightweight agent
   */
  registerAgent(config: LeanAgentConfig): void {
    this.agents.set(config.id, config);
    this.emit('agent-registered', { agentId: config.id, name: config.name });
  }

  /**
   * Queue a task for execution
   */
  async queueTask(agentId: string, task: AgentTask): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const priority = task.priority ?? agent.priority ?? 1;
    const queue = priority > 5 ? this.taskQueue.high : priority > 2 ? this.taskQueue.normal : this.taskQueue.low;

    task.status = 'pending';
    queue.push(task);

    this.emit('task-queued', { agentId, taskId: task.id, priority });

    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.emit('queue-processing-start');

    try {
      while (this.hasTasksInQueue()) {
        const task = this.getNextTask();
        if (!task) break;

        await this.executeTask(task);
      }
    } finally {
      this.processing = false;
      this.emit('queue-processing-complete');
    }
  }

  private hasTasksInQueue(): boolean {
    return (
      this.taskQueue.high.length > 0 ||
      this.taskQueue.normal.length > 0 ||
      this.taskQueue.low.length > 0
    );
  }

  private getNextTask(): AgentTask | null {
    if (this.taskQueue.high.length > 0) {
      return this.taskQueue.high.shift()!;
    }
    if (this.taskQueue.normal.length > 0) {
      return this.taskQueue.normal.shift()!;
    }
    if (this.taskQueue.low.length > 0) {
      return this.taskQueue.low.shift()!;
    }
    return null;
  }

  private async executeTask(task: AgentTask): Promise<void> {
    task.status = 'in_progress';
    this.emit('task-start', { taskId: task.id });

    const startTime = Date.now();

    try {
      // Find agent by matching task type to agent name or id
      const agent = Array.from(this.agents.values()).find(
        (a) => a.id === task.type || a.name === task.type
      );

      if (!agent) {
        throw new Error(`No agent found for task type: ${task.type}`);
      }

      const timeout = agent.timeout ?? 30000;
      const result = await this.withTimeout(agent.handler(task.input), timeout);

      task.result = result;
      task.status = 'completed';

      const duration = Date.now() - startTime;
      this.emit('task-complete', { taskId: task.id, duration, result });
    } catch (error: any) {
      task.error = error;
      task.status = 'failed';

      const duration = Date.now() - startTime;
      this.emit('task-error', { taskId: task.id, duration, error });
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Task execution timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Execute a task immediately without queueing
   */
  async executeImmediate(agentId: string, input: any): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.emit('immediate-execution-start', { agentId });

    try {
      const result = await agent.handler(input);
      this.emit('immediate-execution-complete', { agentId, result });
      return result;
    } catch (error: any) {
      this.emit('immediate-execution-error', { agentId, error });
      throw error;
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    high: number;
    normal: number;
    low: number;
    total: number;
    processing: boolean;
  } {
    return {
      high: this.taskQueue.high.length,
      normal: this.taskQueue.normal.length,
      low: this.taskQueue.low.length,
      total:
        this.taskQueue.high.length +
        this.taskQueue.normal.length +
        this.taskQueue.low.length,
      processing: this.processing,
    };
  }

  /**
   * Clear all queued tasks
   */
  clearQueue(): void {
    this.taskQueue = {
      high: [],
      normal: [],
      low: [],
    };
    this.emit('queue-cleared');
  }
}
