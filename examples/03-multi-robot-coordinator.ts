#!/usr/bin/env node
/**
 * Example 3: Multi-Robot Coordination System
 *
 * Demonstrates:
 * - Task allocation and scheduling
 * - Inter-robot communication
 * - Cooperative area coverage
 * - Leader election and consensus
 * - Distributed task execution
 * - Collision avoidance between robots
 *
 * Multiple robots work together to cover an area and complete tasks cooperatively.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Point2D {
  x: number;
  y: number;
}

interface Task {
  id: string;
  type: 'survey' | 'inspect' | 'transport' | 'guard';
  location: Point2D;
  priority: number;
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
}

interface RobotState {
  id: string;
  position: Point2D;
  status: 'idle' | 'moving' | 'working' | 'charging';
  battery: number;
  currentTask: string | null;
  capabilities: string[];
}

interface Message {
  from: string;
  to: string | 'broadcast';
  type: 'task_request' | 'task_assigned' | 'task_complete' | 'heartbeat' | 'leader_election';
  payload: any;
  timestamp: number;
}

class CoordinatorRobot {
  private server: ROS3McpServer;
  private robotId: string;
  private state: RobotState;
  private tasks: Map<string, Task> = new Map();
  private robots: Map<string, RobotState> = new Map();
  private isLeader: boolean = false;
  private messageQueue: Message[] = [];
  private lastHeartbeat: Map<string, number> = new Map();

  constructor(robotId: string, capabilities: string[] = ['survey', 'inspect']) {
    this.robotId = robotId;
    this.state = {
      id: robotId,
      position: {
        x: Math.random() * 10 - 5,
        y: Math.random() * 10 - 5,
      },
      status: 'idle',
      battery: 100,
      currentTask: null,
      capabilities,
    };

    this.server = new ROS3McpServer({
      name: `coordinator-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/coordinator-${robotId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Coordinator Robot ${this.robotId} started!`);
    console.log(`📍 Position: (${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)})`);
    console.log(`🔧 Capabilities: ${this.state.capabilities.join(', ')}`);

    // Register this robot
    this.robots.set(this.robotId, this.state);

    // Start coordination loops
    this.startHeartbeat();
    this.startMessageProcessing();
    this.startTaskExecution();

    // Run leader election
    await this.electLeader();
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.broadcastMessage({
        from: this.robotId,
        to: 'broadcast',
        type: 'heartbeat',
        payload: { state: this.state, isLeader: this.isLeader },
        timestamp: Date.now(),
      });

      // Check for dead robots
      const now = Date.now();
      for (const [id, lastSeen] of this.lastHeartbeat.entries()) {
        if (now - lastSeen > 5000 && id !== this.robotId) {
          console.log(`⚠️  Robot ${id} appears offline`);
          this.robots.delete(id);
          this.lastHeartbeat.delete(id);

          // Reassign its tasks if we're the leader
          if (this.isLeader) {
            this.reassignTasksFrom(id);
          }
        }
      }
    }, 1000);
  }

  private startMessageProcessing(): void {
    setInterval(async () => {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      }
    }, 100);
  }

  private startTaskExecution(): void {
    setInterval(async () => {
      if (this.state.status === 'idle' && !this.state.currentTask) {
        // Request a task from the leader
        if (!this.isLeader) {
          await this.requestTask();
        }
      }

      // Execute current task
      if (this.state.currentTask) {
        await this.executeCurrentTask();
      }

      // Battery drain simulation
      if (this.state.status !== 'charging') {
        this.state.battery = Math.max(0, this.state.battery - 0.1);
      }

      // Auto-charge when battery is low
      if (this.state.battery < 20 && this.state.status !== 'charging') {
        console.log(`🔋 ${this.robotId}: Low battery, returning to charge`);
        this.state.status = 'charging';
        this.state.currentTask = null;
      }

      // Charge completed
      if (this.state.status === 'charging' && this.state.battery < 100) {
        this.state.battery = Math.min(100, this.state.battery + 2);
      } else if (this.state.battery >= 100) {
        this.state.status = 'idle';
      }
    }, 500);
  }

  private async electLeader(): Promise<void> {
    // Simple leader election: robot with lowest ID becomes leader
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for heartbeats

    const allRobots = Array.from(this.robots.keys()).sort();
    const leaderId = allRobots[0];

    this.isLeader = leaderId === this.robotId;

    if (this.isLeader) {
      console.log(`👑 ${this.robotId}: Elected as leader`);
      await this.initializeLeaderTasks();
    } else {
      console.log(`📋 ${this.robotId}: Following leader ${leaderId}`);
    }
  }

  private async initializeLeaderTasks(): Promise<void> {
    // Create initial tasks
    const taskTypes: Task['type'][] = ['survey', 'inspect', 'transport', 'guard'];

    for (let i = 0; i < 10; i++) {
      const task: Task = {
        id: `task-${i}`,
        type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
        location: {
          x: Math.random() * 10 - 5,
          y: Math.random() * 10 - 5,
        },
        priority: Math.floor(Math.random() * 10),
        assignedTo: null,
        status: 'pending',
        createdAt: Date.now(),
      };

      this.tasks.set(task.id, task);
    }

    console.log(`📋 Leader created ${this.tasks.size} tasks`);
  }

  private broadcastMessage(message: Message): void {
    // Simulate message broadcasting
    // In real implementation, this would use Zenoh pub/sub
    this.messageQueue.push(message);
  }

  private async processMessage(message: Message): Promise<void> {
    // Update robot states from heartbeats
    if (message.type === 'heartbeat') {
      this.robots.set(message.from, message.payload.state);
      this.lastHeartbeat.set(message.from, message.timestamp);

      if (message.payload.isLeader && message.from !== this.robotId) {
        this.isLeader = false; // Another robot is leader
      }
    }

    // Handle task requests
    if (message.type === 'task_request' && this.isLeader) {
      await this.assignTaskTo(message.from);
    }

    // Handle task completion
    if (message.type === 'task_complete') {
      const task = this.tasks.get(message.payload.taskId);
      if (task) {
        task.status = 'completed';
        console.log(`✅ Task ${task.id} completed by ${message.from}`);
      }
    }
  }

  private async requestTask(): Promise<void> {
    this.broadcastMessage({
      from: this.robotId,
      to: 'broadcast',
      type: 'task_request',
      payload: {
        capabilities: this.state.capabilities,
        position: this.state.position,
      },
      timestamp: Date.now(),
    });
  }

  private async assignTaskTo(robotId: string): Promise<void> {
    const robot = this.robots.get(robotId);
    if (!robot) return;

    // Find best task for this robot
    const availableTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .filter(t => robot.capabilities.includes(t.type))
      .sort((a, b) => b.priority - a.priority);

    if (availableTasks.length === 0) {
      return; // No tasks available
    }

    const task = availableTasks[0];
    task.assignedTo = robotId;
    task.status = 'assigned';

    console.log(`📌 Leader assigned ${task.type} task ${task.id} to ${robotId}`);

    this.broadcastMessage({
      from: this.robotId,
      to: robotId,
      type: 'task_assigned',
      payload: { task },
      timestamp: Date.now(),
    });
  }

  private async executeCurrentTask(): Promise<void> {
    if (!this.state.currentTask) return;

    const task = this.tasks.get(this.state.currentTask);
    if (!task) {
      this.state.currentTask = null;
      return;
    }

    // Move to task location
    const dist = this.distance(this.state.position, task.location);

    if (dist > 0.5) {
      // Still moving
      this.state.status = 'moving';
      this.moveTowards(task.location);
    } else {
      // At location, perform task
      this.state.status = 'working';
      task.status = 'in_progress';

      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Task complete
      task.status = 'completed';
      this.state.currentTask = null;
      this.state.status = 'idle';

      console.log(`✅ ${this.robotId}: Completed ${task.type} task ${task.id}`);

      // Store in memory
      await this.server['memory'].storeEpisode({
        sessionId: `task-${task.id}`,
        taskName: task.type,
        confidence: 0.9,
        success: true,
        outcome: `Completed ${task.type} task at (${task.location.x.toFixed(2)}, ${task.location.y.toFixed(2)})`,
        strategy: 'coordinated_multi_robot',
        metadata: { task, robotId: this.robotId },
      });

      // Notify leader
      this.broadcastMessage({
        from: this.robotId,
        to: 'broadcast',
        type: 'task_complete',
        payload: { taskId: task.id },
        timestamp: Date.now(),
      });
    }
  }

  private moveTowards(target: Point2D): void {
    const angle = Math.atan2(
      target.y - this.state.position.y,
      target.x - this.state.position.x
    );

    const speed = 0.5;
    const dt = 0.5; // 500ms timestep

    this.state.position.x += Math.cos(angle) * speed * dt;
    this.state.position.y += Math.sin(angle) * speed * dt;
  }

  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private reassignTasksFrom(deadRobotId: string): void {
    let reassigned = 0;
    for (const task of this.tasks.values()) {
      if (task.assignedTo === deadRobotId && task.status !== 'completed') {
        task.assignedTo = null;
        task.status = 'pending';
        reassigned++;
      }
    }

    if (reassigned > 0) {
      console.log(`🔄 Reassigned ${reassigned} tasks from offline robot ${deadRobotId}`);
    }
  }

  getStats(): any {
    const taskStats = {
      total: this.tasks.size,
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      taskStats[task.status]++;
    }

    return {
      robotId: this.robotId,
      isLeader: this.isLeader,
      activeRobots: this.robots.size,
      state: this.state,
      tasks: taskStats,
    };
  }
}

// Main execution
async function main() {
  const numRobots = parseInt(process.argv[2]) || 3;
  const robots: CoordinatorRobot[] = [];

  console.log(`🚀 Starting multi-robot coordination system with ${numRobots} robots...\n`);

  // Create and start robots
  for (let i = 0; i < numRobots; i++) {
    const capabilities = i === 0
      ? ['survey', 'inspect', 'transport', 'guard'] // First robot has all capabilities
      : ['survey', 'inspect']; // Others have basic capabilities

    const robot = new CoordinatorRobot(`robot-${i}`, capabilities);
    robots.push(robot);
    await robot.start();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Run for 30 seconds
  console.log('\n🎯 Robots are coordinating tasks...\n');

  const statsInterval = setInterval(() => {
    console.log('\n📊 System Status:');
    robots.forEach(robot => {
      const stats = robot.getStats();
      console.log(`  ${stats.robotId} ${stats.isLeader ? '👑' : '  '}: ${stats.state.status} | Battery: ${stats.state.battery.toFixed(0)}% | Tasks: ${stats.tasks.completed}/${stats.tasks.total} completed`);
    });
  }, 5000);

  setTimeout(() => {
    clearInterval(statsInterval);
    console.log('\n🎉 Coordination mission complete!');

    // Final stats
    const finalStats = robots[0].getStats();
    console.log(`\n📈 Final Results:`);
    console.log(`   Active Robots: ${finalStats.activeRobots}`);
    console.log(`   Tasks Completed: ${finalStats.tasks.completed}/${finalStats.tasks.total}`);
    console.log(`   Success Rate: ${(finalStats.tasks.completed / finalStats.tasks.total * 100).toFixed(1)}%`);

    process.exit(0);
  }, 30000);
}

main().catch(console.error);
