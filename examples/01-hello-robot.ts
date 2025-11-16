#!/usr/bin/env node
/**
 * Example 1: Hello World Robot
 *
 * Demonstrates:
 * - Basic pub/sub messaging with ROS3
 * - Simple robot state publishing
 * - Message subscription and logging
 *
 * This is the simplest possible robot implementation using ROS3.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface RobotGreeting {
  robotId: string;
  message: string;
  timestamp: number;
}

class HelloRobot {
  private server: ROS3McpServer;
  private robotId: string;
  private greetingCount: number = 0;

  constructor(robotId: string) {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `hello-robot-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/hello-robot-${robotId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Hello Robot ${this.robotId} started!`);

    // Start publishing greetings
    this.publishGreetings();
  }

  private async publishGreetings(): Promise<void> {
    setInterval(async () => {
      this.greetingCount++;

      const greeting: RobotGreeting = {
        robotId: this.robotId,
        message: `Hello from robot ${this.robotId}! Count: ${this.greetingCount}`,
        timestamp: Date.now(),
      };

      console.log(`📢 Publishing: ${greeting.message}`);

      // Store the greeting in memory
      await this.server['memory'].storeEpisode({
        sessionId: `hello-${this.robotId}-${this.greetingCount}`,
        taskName: 'greeting',
        confidence: 1.0,
        success: true,
        outcome: `Published greeting #${this.greetingCount}`,
        strategy: 'periodic_greeting',
        metadata: greeting,
      });

      // Simulate robot movement
      const x = Math.sin(this.greetingCount * 0.1) * 2;
      const y = Math.cos(this.greetingCount * 0.1) * 2;

      try {
        await this.server.moveRobot({
          x, y, z: 0,
          roll: 0, pitch: 0, yaw: this.greetingCount * 0.1,
          speed: 0.3,
        });
      } catch (error) {
        // Mock robot, expected to work anyway
      }

    }, 2000); // Greet every 2 seconds
  }

  async queryGreetings(): Promise<void> {
    console.log('\n📊 Querying past greetings...');
    const result = await this.server['memory'].queryWithContext(
      'greeting messages',
      { k: 5, minConfidence: 0.5 }
    );

    console.log(`Found ${result.memories.length} past greetings:`);
    result.memories.forEach((mem, idx) => {
      console.log(`  ${idx + 1}. ${mem.outcome} (confidence: ${mem.confidence})`);
    });
  }

  async stop(): Promise<void> {
    await this.queryGreetings();
    console.log(`\n👋 Hello Robot ${this.robotId} shutting down...`);
    process.exit(0);
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'alpha';
  const robot = new HelloRobot(robotId);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await robot.stop();
  });

  await robot.start();

  console.log('\n🎯 Robot is running! Press Ctrl+C to stop.\n');

  // Run for 10 seconds then query and stop
  setTimeout(async () => {
    await robot.stop();
  }, 10000);
}

main().catch(console.error);
