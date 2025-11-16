/**
 * Cognitive Navigation Example
 *
 * Demonstrates ROS3 integration with AgentDB reflexion memory
 * and agentic-flow for AI-powered robot navigation.
 */

import { ROS3Interface } from '../packages/ros3-mcp-server/src/interface.js';
import { AgentDBMemory } from '../packages/ros3-mcp-server/src/memory.js';

interface NavigationTask {
  target: { x: number; y: number; z: number };
  obstacles?: string[];
  strategy?: string;
}

class CognitiveNavigationNode {
  private ros3: ROS3Interface;
  private memory: AgentDBMemory;
  private sessionId: string;

  constructor(dbPath: string = './cognitive-nav.db') {
    this.ros3 = new ROS3Interface();
    this.memory = new AgentDBMemory(dbPath);
    this.sessionId = `nav-${Date.now()}`;
  }

  async initialize(): Promise<void> {
    await this.memory.initialize();
    console.log('Cognitive Navigation Node initialized');
  }

  async navigate(task: NavigationTask): Promise<boolean> {
    const startTime = Date.now();

    try {
      // 1. Query memory for similar navigation scenarios
      console.log(`\n🧠 Querying memory for similar navigation tasks...`);
      const result = await this.memory.queryWithContext(
        `navigate to position [${task.target.x}, ${task.target.y}, ${task.target.z}]`,
        { k: 3, minConfidence: 0.7, domain: 'navigation' }
      );

      if (result.memories.length > 0) {
        console.log(`\n📚 Found ${result.memories.length} relevant past experiences:`);
        result.memories.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m.outcome} (confidence: ${m.confidence})`);
        });

        if (result.context) {
          console.log(`\n💡 Context: ${result.context}`);
        }
      }

      // 2. Detect obstacles using perception
      console.log(`\n👁️  Detecting obstacles...`);
      const obstacles = await this.ros3.detectObjects('front', 0.6);

      if (obstacles.length > 0) {
        console.log(`⚠️  Detected ${obstacles.length} obstacles:`);
        obstacles.forEach(obj => {
          console.log(`   - ${obj.class} (confidence: ${obj.confidence.toFixed(2)})`);
        });
      }

      // 3. Get LIDAR data for path planning
      console.log(`\n📡 Reading LIDAR data...`);
      const lidar = await this.ros3.getLidarData('obstacles', 5000);
      console.log(`   Received ${lidar.points.length} point cloud points`);

      // 4. Determine strategy based on past experiences
      let strategy = task.strategy || 'direct_path';

      if (result.memories.length > 0) {
        const successfulMemories = result.memories.filter(m => m.success);
        if (successfulMemories.length > 0) {
          // Use the strategy from the most successful past experience
          strategy = successfulMemories[0].strategy || strategy;
          console.log(`\n🎯 Using strategy from past experience: ${strategy}`);
        }
      }

      // 5. Execute navigation
      console.log(`\n🚀 Executing navigation...`);
      await this.ros3.moveToPose(
        {
          x: task.target.x,
          y: task.target.y,
          z: task.target.z,
          roll: 0,
          pitch: 0,
          yaw: 0,
        },
        0.5,
        'world'
      );

      const latency = Date.now() - startTime;

      // 6. Store successful execution in memory
      console.log(`\n✅ Navigation successful (${latency}ms)`);
      await this.memory.storeEpisode({
        sessionId: this.sessionId,
        taskName: 'cognitive_navigation',
        confidence: 0.95,
        success: true,
        outcome: `Successfully navigated to [${task.target.x}, ${task.target.y}, ${task.target.z}] avoiding ${obstacles.length} obstacles`,
        strategy,
        metadata: {
          target: task.target,
          obstacles: obstacles.length,
          lidar_points: lidar.points.length,
          latency,
        },
      });

      return true;
    } catch (error: any) {
      const latency = Date.now() - startTime;

      // Store failure for learning
      console.error(`\n❌ Navigation failed: ${error.message}`);
      await this.memory.storeEpisode({
        sessionId: this.sessionId,
        taskName: 'cognitive_navigation',
        confidence: 0.0,
        success: false,
        outcome: `Failed to navigate: ${error.message}`,
        metadata: {
          target: task.target,
          latency,
          error: error.message,
        },
      });

      return false;
    }
  }

  async consolidateExperiences(): Promise<void> {
    console.log('\n🔄 Consolidating experiences into skills...');
    await this.memory.consolidateSkills({
      minAttempts: 3,
      minReward: 0.7,
      timeWindowDays: 7,
    });
    console.log('✅ Skills consolidated');
  }

  async getStats(): Promise<void> {
    console.log('\n📊 Memory Statistics:');
    const stats = await this.memory.getStats();
    console.log(stats.stats);
  }

  async shutdown(): Promise<void> {
    await this.memory.close();
    console.log('\n👋 Cognitive Navigation Node shut down');
  }
}

// Example usage
async function main() {
  const node = new CognitiveNavigationNode();
  await node.initialize();

  // Define navigation tasks
  const tasks: NavigationTask[] = [
    { target: { x: 5.0, y: 3.0, z: 0.0 }, strategy: 'direct_path' },
    { target: { x: -2.0, y: 4.0, z: 0.0 }, strategy: 'wall_follow' },
    { target: { x: 10.0, y: -5.0, z: 0.0 }, strategy: 'avoidance_path' },
  ];

  // Execute navigation tasks
  for (const task of tasks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Navigation Task: Move to [${task.target.x}, ${task.target.y}, ${task.target.z}]`);
    console.log('='.repeat(60));

    const success = await node.navigate(task);

    if (success) {
      console.log('✅ Task completed successfully');
    } else {
      console.log('❌ Task failed');
    }

    // Small delay between tasks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Consolidate learned experiences
  await node.consolidateExperiences();

  // Show statistics
  await node.getStats();

  // Shutdown
  await node.shutdown();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CognitiveNavigationNode };
