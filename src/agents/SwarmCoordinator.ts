import { PubNubService } from '../core/PubNubService';
import { AgentOrchestrator } from './AgentOrchestrator';
import { Message, MessageType, SwarmConfig, AgentTask, AgentResponse } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Swarm Coordinator for managing multi-agent systems
 * Implements ruv-swarm patterns via PubNub
 */
export class SwarmCoordinator {
  private pubnub: PubNubService;
  private swarmId: string;
  private agents: Map<string, AgentOrchestrator> = new Map();
  private config: SwarmConfig;
  private taskQueue: AgentTask[] = [];
  private completedTasks: Map<string, AgentResponse> = new Map();

  constructor(
    pubnub: PubNubService,
    config: SwarmConfig
  ) {
    this.pubnub = pubnub;
    this.swarmId = config.swarmId || `swarm-${uuidv4()}`;
    this.config = {
      ...config,
      swarmId: this.swarmId,
    };
    this.setupSwarmChannels();
  }

  /**
   * Setup channels for swarm coordination
   */
  private setupSwarmChannels(): void {
    const swarmChannel = `swarm:${this.swarmId}`;

    // Subscribe to swarm channel
    this.pubnub.subscribe(swarmChannel);

    // Listen for swarm messages
    this.pubnub.onMessage(swarmChannel, async (message: Message) => {
      switch (message.type) {
        case MessageType.SWARM_INIT:
          await this.handleSwarmInit(message.payload);
          break;
        case MessageType.SWARM_SYNC:
          await this.handleSwarmSync(message.payload);
          break;
        case MessageType.SWARM_COMPLETE:
          await this.handleSwarmComplete(message.payload);
          break;
      }
    });

    // Listen for agent responses
    this.pubnub.onMessage('agents:responses', async (message: Message) => {
      if (message.type === MessageType.AGENT_RESPONSE) {
        const response = message.payload as AgentResponse;
        this.completedTasks.set(response.taskId, response);
        await this.checkSwarmProgress();
      }
    });

    console.log(`Swarm ${this.swarmId} initialized`);
  }

  /**
   * Add agent to swarm
   */
  addAgent(agent: AgentOrchestrator): void {
    const agentId = agent.getAgentId();
    this.agents.set(agentId, agent);
    console.log(`Agent ${agentId} added to swarm ${this.swarmId}`);
  }

  /**
   * Create and add new agent to swarm
   */
  createAgent(agentId?: string): AgentOrchestrator {
    const agent = new AgentOrchestrator(this.pubnub, agentId);
    this.addAgent(agent);
    return agent;
  }

  /**
   * Execute swarm tasks based on strategy
   */
  async executeTasks(tasks: AgentTask[]): Promise<AgentResponse[]> {
    this.taskQueue = [...tasks];

    // Announce swarm initialization
    await this.pubnub.publish(
      `swarm:${this.swarmId}`,
      MessageType.SWARM_INIT,
      {
        swarmId: this.swarmId,
        strategy: this.config.strategy,
        taskCount: tasks.length,
        agents: Array.from(this.agents.keys()),
      }
    );

    switch (this.config.strategy) {
      case 'parallel':
        return await this.executeParallel(tasks);
      case 'sequential':
        return await this.executeSequential(tasks);
      case 'hierarchical':
        return await this.executeHierarchical(tasks);
      default:
        throw new Error(`Unknown strategy: ${this.config.strategy}`);
    }
  }

  /**
   * Execute tasks in parallel across all agents
   */
  private async executeParallel(tasks: AgentTask[]): Promise<AgentResponse[]> {
    console.log(`Executing ${tasks.length} tasks in parallel`);

    const agents = Array.from(this.agents.values());
    const promises: Promise<AgentResponse>[] = [];

    tasks.forEach((task, index) => {
      const agent = agents[index % agents.length];
      const promise = this.executeTaskWithAgent(agent, task);
      promises.push(promise);
    });

    const responses = await Promise.all(promises);
    await this.announceSwarmComplete(responses);
    return responses;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(tasks: AgentTask[]): Promise<AgentResponse[]> {
    console.log(`Executing ${tasks.length} tasks sequentially`);

    const responses: AgentResponse[] = [];
    const agents = Array.from(this.agents.values());

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const agent = agents[i % agents.length];
      const response = await this.executeTaskWithAgent(agent, task);
      responses.push(response);

      // Sync between tasks
      await this.pubnub.publish(
        `swarm:${this.swarmId}`,
        MessageType.SWARM_SYNC,
        {
          completedTasks: responses.length,
          totalTasks: tasks.length,
        }
      );
    }

    await this.announceSwarmComplete(responses);
    return responses;
  }

  /**
   * Execute tasks in hierarchical manner
   */
  private async executeHierarchical(tasks: AgentTask[]): Promise<AgentResponse[]> {
    console.log(`Executing ${tasks.length} tasks hierarchically`);

    // Group tasks by dependencies
    const taskLevels = this.groupTasksByDependencies(tasks);
    const responses: AgentResponse[] = [];
    const agents = Array.from(this.agents.values());

    for (const level of taskLevels) {
      const levelPromises = level.map((task, index) => {
        const agent = agents[index % agents.length];
        return this.executeTaskWithAgent(agent, task);
      });

      const levelResponses = await Promise.all(levelPromises);
      responses.push(...levelResponses);

      // Sync after each level
      await this.pubnub.publish(
        `swarm:${this.swarmId}`,
        MessageType.SWARM_SYNC,
        {
          completedLevel: taskLevels.indexOf(level),
          totalLevels: taskLevels.length,
        }
      );
    }

    await this.announceSwarmComplete(responses);
    return responses;
  }

  /**
   * Execute task with specific agent
   */
  private async executeTaskWithAgent(
    agent: AgentOrchestrator,
    task: AgentTask
  ): Promise<AgentResponse> {
    const taskId = await agent.assignTask(
      task.type,
      task.payload,
      agent.getAgentId(),
      task.priority,
      task.dependencies
    );

    return await agent.waitForResponse(taskId);
  }

  /**
   * Group tasks by dependency levels
   */
  private groupTasksByDependencies(tasks: AgentTask[]): AgentTask[][] {
    const levels: AgentTask[][] = [];
    const processed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.taskId, t]));

    while (processed.size < tasks.length) {
      const level: AgentTask[] = [];

      for (const task of tasks) {
        if (processed.has(task.taskId)) continue;

        // Check if all dependencies are processed
        const allDepsProcessed = !task.dependencies ||
          task.dependencies.every(dep => processed.has(dep));

        if (allDepsProcessed) {
          level.push(task);
          processed.add(task.taskId);
        }
      }

      if (level.length === 0) {
        throw new Error('Circular dependency detected in task dependencies');
      }

      levels.push(level);
    }

    return levels;
  }

  /**
   * Handle swarm initialization
   */
  private async handleSwarmInit(payload: any): Promise<void> {
    console.log('Swarm initialization:', payload);
  }

  /**
   * Handle swarm sync
   */
  private async handleSwarmSync(payload: any): Promise<void> {
    console.log('Swarm sync:', payload);
  }

  /**
   * Handle swarm completion
   */
  private async handleSwarmComplete(payload: any): Promise<void> {
    console.log('Swarm complete:', payload);
  }

  /**
   * Check swarm progress
   */
  private async checkSwarmProgress(): Promise<void> {
    const completed = this.completedTasks.size;
    const total = this.taskQueue.length;

    if (completed > 0 && completed % 10 === 0) {
      await this.pubnub.publish(
        `swarm:${this.swarmId}`,
        MessageType.SWARM_SYNC,
        {
          completed,
          total,
          progress: (completed / total) * 100,
        }
      );
    }
  }

  /**
   * Announce swarm completion
   */
  private async announceSwarmComplete(responses: AgentResponse[]): Promise<void> {
    const successful = responses.filter(r => r.status === 'success').length;
    const failed = responses.filter(r => r.status === 'error').length;

    await this.pubnub.publish(
      `swarm:${this.swarmId}`,
      MessageType.SWARM_COMPLETE,
      {
        swarmId: this.swarmId,
        totalTasks: responses.length,
        successful,
        failed,
        timestamp: Date.now(),
      }
    );

    console.log(`Swarm ${this.swarmId} completed: ${successful} successful, ${failed} failed`);
  }

  /**
   * Get swarm ID
   */
  getSwarmId(): string {
    return this.swarmId;
  }

  /**
   * Get swarm agents
   */
  getAgents(): AgentOrchestrator[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): AgentResponse[] {
    return Array.from(this.completedTasks.values());
  }
}
