/**
 * Agent Controller for managing multiple agents
 */

import { Agent } from './Agent.js';
import { AgentConfig, Task, AgentMessage } from '../types/index.js';
import { EventEmitter } from 'events';

export class AgentController extends EventEmitter {
  private agents: Map<string, Agent>;
  private taskQueue: Task[];

  constructor() {
    super();
    this.agents = new Map();
    this.taskQueue = [];
  }

  /**
   * Register a new agent
   */
  registerAgent(config: AgentConfig): Agent {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent with id ${config.id} already exists`);
    }

    const agent = new Agent(config);

    // Set up event forwarding
    agent.on('taskCompleted', (data) => this.emit('agentTaskCompleted', { agentId: config.id, ...data }));
    agent.on('taskFailed', (data) => this.emit('agentTaskFailed', { agentId: config.id, ...data }));
    agent.on('messageSent', (data) => this.handleAgentMessage(data.message));

    this.agents.set(config.id, agent);
    this.emit('agentRegistered', { agentId: config.id });

    console.log(`Agent ${config.name} registered with capabilities: ${config.capabilities.join(', ')}`);

    return agent;
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.stop();
    this.agents.delete(agentId);
    this.emit('agentUnregistered', { agentId });

    console.log(`Agent ${agentId} unregistered`);
  }

  /**
   * Start all agents
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.agents.values()).map(agent => agent.start());
    await Promise.all(startPromises);

    console.log(`Started ${this.agents.size} agents`);
  }

  /**
   * Stop all agents
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map(agent => agent.stop());
    await Promise.all(stopPromises);

    console.log(`Stopped ${this.agents.size} agents`);
  }

  /**
   * Assign a task to the most suitable agent
   */
  assignTask(task: Task): boolean {
    // Find agents that can handle this task type
    const capableAgents = Array.from(this.agents.values())
      .filter(agent => agent.canHandle(task.type))
      .filter(agent => agent.getTasks().length < agent.getConfig().maxTasks);

    if (capableAgents.length === 0) {
      console.warn(`No available agent found for task ${task.id} of type ${task.type}`);
      this.taskQueue.push(task);
      return false;
    }

    // Assign to the agent with the least tasks
    const selectedAgent = capableAgents.reduce((prev, curr) =>
      prev.getTasks().length < curr.getTasks().length ? prev : curr
    );

    selectedAgent.addTask(task);
    console.log(`Task ${task.id} assigned to agent ${selectedAgent.getConfig().id}`);

    return true;
  }

  /**
   * Handle inter-agent messages
   */
  private handleAgentMessage(message: AgentMessage): void {
    const recipient = this.agents.get(message.to);
    if (recipient) {
      recipient.receiveMessage(message);
    } else {
      console.warn(`Recipient agent ${message.to} not found`);
    }
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent status summary
   */
  getStatus(): any {
    const agentStatuses = Array.from(this.agents.entries()).map(([id, agent]) => ({
      id,
      name: agent.getConfig().name,
      state: agent.getState(),
      tasks: agent.getTasks().length
    }));

    return {
      totalAgents: this.agents.size,
      queuedTasks: this.taskQueue.length,
      agents: agentStatuses
    };
  }

  /**
   * Process queued tasks
   */
  async processQueue(): Promise<void> {
    const tasksToProcess = [...this.taskQueue];
    this.taskQueue = [];

    for (const task of tasksToProcess) {
      const assigned = this.assignTask(task);
      if (!assigned) {
        // Task couldn't be assigned, keep it in queue
        this.taskQueue.push(task);
      }
    }
  }
}
