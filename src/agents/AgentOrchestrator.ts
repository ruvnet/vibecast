import { PubNubService } from '../core/PubNubService';
import { Message, MessageType, AgentTask, AgentResponse } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Agent Orchestrator for managing distributed agents via PubNub
 * Inspired by ruv.io agent patterns
 */
export class AgentOrchestrator {
  private pubnub: PubNubService;
  private agentId: string;
  private tasks: Map<string, AgentTask> = new Map();
  private responses: Map<string, AgentResponse> = new Map();
  private taskHandlers: Map<string, (task: AgentTask) => Promise<any>> = new Map();

  constructor(pubnub: PubNubService, agentId?: string) {
    this.pubnub = pubnub;
    this.agentId = agentId || `agent-${uuidv4()}`;
    this.setupAgentChannels();
  }

  /**
   * Setup channels for agent communication
   */
  private setupAgentChannels(): void {
    // Subscribe to agent-specific channel
    const agentChannel = `agent:${this.agentId}`;
    this.pubnub.subscribe(agentChannel);

    // Subscribe to broadcast channel for all agents
    this.pubnub.subscribe('agents:broadcast');

    // Listen for agent tasks
    this.pubnub.onMessage(agentChannel, async (message: Message) => {
      if (message.type === MessageType.AGENT_TASK) {
        await this.handleTask(message.payload as AgentTask);
      }
    });

    // Listen for broadcast tasks
    this.pubnub.onMessage('agents:broadcast', async (message: Message) => {
      if (message.type === MessageType.AGENT_TASK) {
        const task = message.payload as AgentTask;
        // Only handle if not assigned to specific agent or assigned to this agent
        if (!task.agentId || task.agentId === this.agentId) {
          await this.handleTask(task);
        }
      }
    });

    // Set agent status
    this.pubnub.setState(agentChannel, {
      status: 'ready',
      agentId: this.agentId,
      capabilities: Array.from(this.taskHandlers.keys()),
    });

    console.log(`Agent ${this.agentId} initialized and ready`);
  }

  /**
   * Register a handler for a specific task type
   */
  registerTaskHandler(
    taskType: string,
    handler: (task: AgentTask) => Promise<any>
  ): void {
    this.taskHandlers.set(taskType, handler);
    console.log(`Registered handler for task type: ${taskType}`);

    // Update agent capabilities
    const agentChannel = `agent:${this.agentId}`;
    this.pubnub.setState(agentChannel, {
      status: 'ready',
      agentId: this.agentId,
      capabilities: Array.from(this.taskHandlers.keys()),
    });
  }

  /**
   * Handle incoming task
   */
  private async handleTask(task: AgentTask): Promise<void> {
    console.log(`Agent ${this.agentId} received task: ${task.taskId}`);
    this.tasks.set(task.taskId, task);

    // Update status to processing
    await this.publishAgentStatus('processing', task.taskId);

    try {
      const handler = this.taskHandlers.get(task.type);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${task.type}`);
      }

      // Execute task
      const result = await handler(task);

      // Send success response
      const response: AgentResponse = {
        taskId: task.taskId,
        agentId: this.agentId,
        status: 'success',
        result,
      };

      await this.sendResponse(response);
      this.responses.set(task.taskId, response);

      // Update status to ready
      await this.publishAgentStatus('ready');

      console.log(`Agent ${this.agentId} completed task: ${task.taskId}`);
    } catch (error) {
      console.error(`Agent ${this.agentId} error processing task ${task.taskId}:`, error);

      // Send error response
      const response: AgentResponse = {
        taskId: task.taskId,
        agentId: this.agentId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };

      await this.sendResponse(response);
      this.responses.set(task.taskId, response);

      // Update status to error
      await this.publishAgentStatus('error', task.taskId);
    }
  }

  /**
   * Assign a task to a specific agent or broadcast
   */
  async assignTask(
    taskType: string,
    payload: any,
    targetAgentId?: string,
    priority: number = 0,
    dependencies?: string[]
  ): Promise<string> {
    const task: AgentTask = {
      taskId: uuidv4(),
      agentId: targetAgentId || this.agentId,
      type: taskType,
      payload,
      priority,
      dependencies,
    };

    const channel = targetAgentId
      ? `agent:${targetAgentId}`
      : 'agents:broadcast';

    await this.pubnub.publish(
      channel,
      MessageType.AGENT_TASK,
      task,
      { priority }
    );

    console.log(`Task ${task.taskId} assigned to ${channel}`);
    return task.taskId;
  }

  /**
   * Send task response
   */
  private async sendResponse(response: AgentResponse): Promise<void> {
    await this.pubnub.publish(
      'agents:responses',
      MessageType.AGENT_RESPONSE,
      response
    );
  }

  /**
   * Publish agent status
   */
  private async publishAgentStatus(
    status: string,
    taskId?: string
  ): Promise<void> {
    await this.pubnub.publish(
      'agents:status',
      MessageType.AGENT_STATUS,
      {
        agentId: this.agentId,
        status,
        taskId,
        timestamp: Date.now(),
      }
    );
  }

  /**
   * Wait for task response
   */
  async waitForResponse(
    taskId: string,
    timeoutMs: number = 30000
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for response to task ${taskId}`));
      }, timeoutMs);

      const cleanup = this.pubnub.onMessage('agents:responses', (message: Message) => {
        if (message.type === MessageType.AGENT_RESPONSE) {
          const response = message.payload as AgentResponse;
          if (response.taskId === taskId) {
            clearTimeout(timeout);
            cleanup();
            resolve(response);
          }
        }
      });

      // Check if response already received
      const existingResponse = this.responses.get(taskId);
      if (existingResponse) {
        clearTimeout(timeout);
        cleanup();
        resolve(existingResponse);
      }
    });
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get registered task types
   */
  getCapabilities(): string[] {
    return Array.from(this.taskHandlers.keys());
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task responses
   */
  getResponses(): AgentResponse[] {
    return Array.from(this.responses.values());
  }
}
