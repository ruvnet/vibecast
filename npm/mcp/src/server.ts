/**
 * ROS3 MCP Server implementation - Simplified version
 */

import { ROS3Interface } from './interface.js';
import { AgentDBMemory } from './memory.js';

export interface ROS3McpServerConfig {
  name?: string;
  version?: string;
  dbPath?: string;
}

export class ROS3McpServer {
  private ros3: ROS3Interface;
  private memory: AgentDBMemory;
  private name: string;
  private version: string;

  constructor(config: ROS3McpServerConfig = {}) {
    const {
      name = 'ros3-mcp-server',
      version = '1.0.0',
      dbPath = './ros3-agentdb.db',
    } = config;

    this.name = name;
    this.version = version;

    // Initialize ROS3 interface
    this.ros3 = new ROS3Interface();

    // Initialize AgentDB memory
    this.memory = new AgentDBMemory(dbPath);
  }

  async start(): Promise<void> {
    // Initialize AgentDB
    await this.memory.initialize();

    console.error(`${this.name} v${this.version} started`);
    console.error('AgentDB initialized and ready');
    console.error('');
    console.error('Available tools:');
    console.error('  - move_robot: Move robot to target pose');
    console.error('  - get_pose: Get current robot pose');
    console.error('  - get_status: Get robot status');
    console.error('  - read_lidar: Read LIDAR data');
    console.error('  - detect_objects: Detect objects from camera');
    console.error('  - query_memory: Query past experiences');
    console.error('  - consolidate_skills: Learn from experiences');
    console.error('  - get_memory_stats: Get memory statistics');
  }

  async stop(): Promise<void> {
    await this.memory.close();
    console.error(`${this.name} stopped`);
  }

  // Tool implementations
  async moveRobot(params: {
    x: number;
    y: number;
    z: number;
    roll: number;
    pitch: number;
    yaw: number;
    speed?: number;
    frame?: 'base' | 'world';
  }): Promise<string> {
    const { x, y, z, roll, pitch, yaw, speed = 0.5, frame = 'world' } = params;
    const startTime = Date.now();

    try {
      await this.ros3.moveToPose({ x, y, z, roll, pitch, yaw }, speed, frame);
      const latency = Date.now() - startTime;

      await this.memory.storeEpisode({
        sessionId: `motion-${Date.now()}`,
        taskName: 'move_robot',
        confidence: 0.9,
        success: true,
        outcome: `Moved to [${x}, ${y}, ${z}] in ${latency}ms`,
        strategy: `speed_${speed}_frame_${frame}`,
        metadata: { x, y, z, roll, pitch, yaw, speed, frame, latency },
      });

      return `Robot moved to [${x}, ${y}, ${z}] in ${frame} frame. Completed in ${latency}ms.`;
    } catch (error: any) {
      await this.memory.storeEpisode({
        sessionId: `motion-${Date.now()}`,
        taskName: 'move_robot',
        confidence: 0.0,
        success: false,
        outcome: `Failed: ${error.message}`,
        metadata: { x, y, z, roll, pitch, yaw, speed, frame },
      });
      throw error;
    }
  }

  async getPose(): Promise<string> {
    const pose = await this.ros3.getCurrentPose();
    return `Current pose: [${pose.x}, ${pose.y}, ${pose.z}] (roll=${pose.roll}, pitch=${pose.pitch}, yaw=${pose.yaw})`;
  }

  async getStatus(): Promise<string> {
    const status = await this.ros3.getStatus();
    return `Robot status: ${status.status}, Health: ${status.health}`;
  }

  async readLidar(params: { filter?: string; max_points?: number }): Promise<string> {
    const { filter = 'all', max_points = 10000 } = params;
    const startTime = Date.now();

    const cloud = await this.ros3.getLidarData(
      filter as 'all' | 'obstacles' | 'ground',
      max_points
    );

    const latency = Date.now() - startTime;

    await this.memory.storeEpisode({
      sessionId: `lidar-${Date.now()}`,
      taskName: 'read_lidar',
      confidence: 1.0,
      success: true,
      outcome: `Retrieved ${cloud.points.length} points in ${latency}ms`,
      metadata: { filter, max_points, num_points: cloud.points.length, latency },
    });

    return `LIDAR data: ${cloud.points.length} points (filter: ${filter}, latency: ${latency}ms)`;
  }

  async detectObjects(params: { camera: string; confidence_threshold?: number }): Promise<string> {
    const { camera, confidence_threshold = 0.5 } = params;
    const startTime = Date.now();

    const detections = await this.ros3.detectObjects(
      camera as 'front' | 'left' | 'right' | 'rear',
      confidence_threshold
    );

    const latency = Date.now() - startTime;

    await this.memory.storeEpisode({
      sessionId: `vision-${Date.now()}`,
      taskName: 'detect_objects',
      confidence: 0.9,
      success: true,
      outcome: `Detected ${detections.length} objects in ${latency}ms`,
      metadata: { camera, confidence_threshold, num_detections: detections.length, latency },
    });

    return `Detected ${detections.length} objects from ${camera} camera:\n${JSON.stringify(detections, null, 2)}`;
  }

  async queryMemory(params: {
    query: string;
    k?: number;
    only_successes?: boolean;
    min_confidence?: number;
  }): Promise<string> {
    const { query, k = 5, only_successes = false, min_confidence = 0.0 } = params;

    const result = await this.memory.queryWithContext(query, { k, minConfidence: min_confidence });

    const filteredMemories = only_successes
      ? result.memories.filter((m) => m.success)
      : result.memories;

    return `Found ${filteredMemories.length} memories for "${query}":\n${JSON.stringify(filteredMemories, null, 2)}`;
  }

  async consolidateSkills(params?: {
    min_attempts?: number;
    min_reward?: number;
    time_window_days?: number;
  }): Promise<string> {
    const { min_attempts = 3, min_reward = 0.7, time_window_days = 7 } = params || {};

    await this.memory.consolidateSkills({
      minAttempts: min_attempts,
      minReward: min_reward,
      timeWindowDays: time_window_days,
    });

    return `Skills consolidated (min_attempts: ${min_attempts}, min_reward: ${min_reward}, window: ${time_window_days} days)`;
  }

  async getMemoryStats(): Promise<string> {
    const stats = await this.memory.getStats();
    return `AgentDB Statistics:\n${stats.stats}`;
  }

  // Get server info
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      tools: [
        'move_robot',
        'get_pose',
        'get_status',
        'read_lidar',
        'detect_objects',
        'query_memory',
        'consolidate_skills',
        'get_memory_stats',
      ],
    };
  }
}
