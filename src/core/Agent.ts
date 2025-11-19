/**
 * Core Agent class for agentic-robotics
 */

import { AgentConfig, Task, AgentMessage, RobotState } from '../types/index.js';
import { EventEmitter } from 'events';

export class Agent extends EventEmitter {
  private config: AgentConfig;
  private tasks: Map<string, Task>;
  private state: RobotState;
  private running: boolean;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.tasks = new Map();
    this.running = false;

    // Initialize default state
    this.state = {
      id: config.id,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { roll: 0, pitch: 0, yaw: 0 }
      },
      velocity: { x: 0, y: 0, z: 0 },
      sensors: new Map(),
      status: 'idle'
    };
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Agent is already running');
    }

    this.running = true;
    this.emit('started', { agentId: this.config.id });
    console.log(`Agent ${this.config.name} (${this.config.id}) started`);

    // Start processing loop
    this.processLoop();
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.running = false;
    this.state.status = 'idle';
    this.emit('stopped', { agentId: this.config.id });
    console.log(`Agent ${this.config.name} stopped`);
  }

  /**
   * Add a task to the agent's queue
   */
  addTask(task: Task): void {
    if (this.tasks.size >= this.config.maxTasks) {
      throw new Error('Task queue is full');
    }

    this.tasks.set(task.id, task);
    this.emit('taskAdded', { task });
    console.log(`Task ${task.id} added to agent ${this.config.id}`);
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'executing';
    task.assignedAgent = this.config.id;
    this.state.status = 'executing';
    this.emit('taskStarted', { task });

    try {
      // Simulate task execution
      await this.performTask(task);

      task.status = 'completed';
      this.emit('taskCompleted', { task });
      console.log(`Task ${taskId} completed`);
    } catch (error) {
      task.status = 'failed';
      this.emit('taskFailed', { task, error });
      console.error(`Task ${taskId} failed:`, error);
    } finally {
      this.state.status = 'idle';
    }
  }

  /**
   * Perform the actual task logic
   */
  private async performTask(task: Task): Promise<void> {
    // This is where task-specific logic would be implemented
    // For now, we'll simulate different task types

    switch (task.type) {
      case 'move':
        await this.simulateMovement(task.params);
        break;
      case 'sense':
        await this.simulateSensing(task.params);
        break;
      case 'process':
        await this.simulateProcessing(task.params);
        break;
      default:
        console.log(`Executing custom task: ${task.type}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Process loop for autonomous operation
   */
  private async processLoop(): Promise<void> {
    while (this.running) {
      // Process pending tasks
      for (const [taskId, task] of this.tasks) {
        if (task.status === 'pending' && this.state.status === 'idle') {
          await this.executeTask(taskId);
          this.tasks.delete(taskId);
        }
      }

      // Wait before next cycle
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Simulate robot movement
   */
  private async simulateMovement(params: any): Promise<void> {
    this.state.status = 'moving';
    console.log(`Moving to position:`, params.target);
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (params.target) {
      this.state.pose.position = params.target;
    }
  }

  /**
   * Simulate sensor data collection
   */
  private async simulateSensing(params: any): Promise<void> {
    console.log(`Collecting sensor data:`, params.sensors);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock sensor data
    params.sensors?.forEach((sensorType: string) => {
      this.state.sensors.set(sensorType, {
        timestamp: Date.now(),
        type: sensorType,
        value: Math.random() * 100
      });
    });
  }

  /**
   * Simulate data processing
   */
  private async simulateProcessing(params: any): Promise<void> {
    console.log(`Processing data:`, params);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * Send a message to another agent
   */
  sendMessage(message: AgentMessage): void {
    this.emit('messageSent', { message });
  }

  /**
   * Handle incoming message
   */
  receiveMessage(message: AgentMessage): void {
    this.emit('messageReceived', { message });
    console.log(`Agent ${this.config.id} received message from ${message.from}`);
  }

  /**
   * Get current agent state
   */
  getState(): RobotState {
    return { ...this.state };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get pending tasks
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Check if agent can handle a specific task type
   */
  canHandle(taskType: string): boolean {
    return this.config.capabilities.includes(taskType) ||
           this.config.capabilities.includes('*');
  }
}
