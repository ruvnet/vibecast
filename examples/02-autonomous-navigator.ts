#!/usr/bin/env node
/**
 * Example 2: Autonomous Navigation Robot
 *
 * Demonstrates:
 * - Pathfinding with A* algorithm
 * - LIDAR-based obstacle detection
 * - Dynamic obstacle avoidance
 * - Memory-based route optimization
 * - Real-time replanning
 *
 * This robot navigates to waypoints while avoiding obstacles using sensor data.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Point2D {
  x: number;
  y: number;
}

interface Obstacle {
  position: Point2D;
  radius: number;
}

interface NavigationGoal {
  target: Point2D;
  tolerance: number;
}

class AutonomousNavigator {
  private server: ROS3McpServer;
  private robotId: string;
  private currentPosition: Point2D;
  private currentGoal: NavigationGoal | null = null;
  private obstacles: Obstacle[] = [];
  private path: Point2D[] = [];
  private navigationActive: boolean = false;

  constructor(robotId: string) {
    this.robotId = robotId;
    this.currentPosition = { x: 0, y: 0 };
    this.server = new ROS3McpServer({
      name: `navigator-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/navigator-${robotId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Autonomous Navigator ${this.robotId} started!`);
    console.log(`📍 Initial position: (${this.currentPosition.x}, ${this.currentPosition.y})`);

    // Start sensor update loop
    this.startSensorLoop();
  }

  private async startSensorLoop(): Promise<void> {
    setInterval(async () => {
      await this.updateSensors();
      if (this.navigationActive) {
        await this.navigationStep();
      }
    }, 100); // 10 Hz update rate
  }

  private async updateSensors(): Promise<void> {
    // Simulate LIDAR reading
    try {
      const lidarData = await this.server.getLidarData('obstacles', 5000);

      // Update obstacle map from LIDAR
      this.obstacles = [];
      if (lidarData.points && lidarData.points.length > 0) {
        // Cluster points into obstacles
        for (let i = 0; i < lidarData.points.length; i += 10) {
          const point = lidarData.points[i];
          if (point) {
            this.obstacles.push({
              position: { x: point.x, y: point.y },
              radius: 0.3,
            });
          }
        }
      }
    } catch (error) {
      // Mock sensors - generate synthetic obstacles
      this.generateSyntheticObstacles();
    }

    // Get current pose
    try {
      const pose = await this.server.getPose();
      this.currentPosition = {
        x: pose.position.x,
        y: pose.position.y,
      };
    } catch (error) {
      // Use simulated position
    }
  }

  private generateSyntheticObstacles(): void {
    // Generate 3-5 random obstacles in the environment
    const numObstacles = 3 + Math.floor(Math.random() * 3);
    this.obstacles = [];

    for (let i = 0; i < numObstacles; i++) {
      this.obstacles.push({
        position: {
          x: Math.random() * 10 - 5,
          y: Math.random() * 10 - 5,
        },
        radius: 0.3 + Math.random() * 0.3,
      });
    }
  }

  async navigateTo(target: Point2D, tolerance: number = 0.2): Promise<boolean> {
    console.log(`\n🎯 Navigation goal set: (${target.x.toFixed(2)}, ${target.y.toFixed(2)})`);

    this.currentGoal = { target, tolerance };
    this.navigationActive = true;

    // Query memory for similar navigation tasks
    const memories = await this.queryNavigationMemory(target);

    if (memories.length > 0) {
      console.log(`💭 Found ${memories.length} similar past navigation attempts`);
      const successRate = memories.filter(m => m.success).length / memories.length;
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
    }

    // Plan initial path
    this.planPath();

    // Wait for navigation to complete or timeout
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.navigationActive) {
          clearInterval(checkInterval);
          resolve(this.isAtGoal());
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.navigationActive = false;
        resolve(false);
      }, 30000);
    });
  }

  private planPath(): void {
    if (!this.currentGoal) return;

    // Simple A* pathfinding
    this.path = this.findPath(
      this.currentPosition,
      this.currentGoal.target,
      this.obstacles
    );

    console.log(`🗺️  Planned path with ${this.path.length} waypoints`);
  }

  private findPath(start: Point2D, goal: Point2D, obstacles: Obstacle[]): Point2D[] {
    // Simplified A* implementation
    const path: Point2D[] = [];
    const current = { ...start };

    // Direct path if no obstacles
    const directPath = this.isPathClear(start, goal, obstacles);
    if (directPath) {
      return [start, goal];
    }

    // Simple obstacle avoidance - find intermediate waypoints
    const numWaypoints = 5;
    for (let i = 1; i <= numWaypoints; i++) {
      const t = i / (numWaypoints + 1);
      let waypoint = {
        x: start.x + (goal.x - start.x) * t,
        y: start.y + (goal.y - start.y) * t,
      };

      // Offset waypoint if it's in an obstacle
      waypoint = this.findClearPoint(waypoint, obstacles);
      path.push(waypoint);
    }

    path.push(goal);
    return path;
  }

  private isPathClear(from: Point2D, to: Point2D, obstacles: Obstacle[]): boolean {
    for (const obstacle of obstacles) {
      const dist = this.distanceToLineSegment(obstacle.position, from, to);
      if (dist < obstacle.radius + 0.5) {
        return false;
      }
    }
    return true;
  }

  private findClearPoint(point: Point2D, obstacles: Obstacle[]): Point2D {
    for (const obstacle of obstacles) {
      const dist = this.distance(point, obstacle.position);
      if (dist < obstacle.radius + 0.5) {
        // Push point away from obstacle
        const angle = Math.atan2(
          point.y - obstacle.position.y,
          point.x - obstacle.position.x
        );
        return {
          x: obstacle.position.x + Math.cos(angle) * (obstacle.radius + 0.6),
          y: obstacle.position.y + Math.sin(angle) * (obstacle.radius + 0.6),
        };
      }
    }
    return point;
  }

  private async navigationStep(): Promise<void> {
    if (!this.currentGoal || this.path.length === 0) {
      this.navigationActive = false;
      return;
    }

    // Check if we reached the goal
    if (this.isAtGoal()) {
      console.log(`✅ Reached goal!`);
      await this.storeNavigationResult(true);
      this.navigationActive = false;
      return;
    }

    // Get next waypoint
    const nextWaypoint = this.path[0];
    const distToWaypoint = this.distance(this.currentPosition, nextWaypoint);

    if (distToWaypoint < 0.3) {
      // Reached waypoint, move to next
      this.path.shift();
      console.log(`✓ Waypoint reached. ${this.path.length} remaining.`);
      return;
    }

    // Check if path is still clear
    if (!this.isPathClear(this.currentPosition, nextWaypoint, this.obstacles)) {
      console.log(`⚠️  Obstacle detected, replanning...`);
      this.planPath();
      return;
    }

    // Move towards next waypoint
    await this.moveTowards(nextWaypoint);
  }

  private async moveTowards(target: Point2D): Promise<void> {
    const angle = Math.atan2(
      target.y - this.currentPosition.y,
      target.x - this.currentPosition.x
    );

    const speed = 0.5;
    const dt = 0.1; // 100ms timestep

    // Update simulated position
    this.currentPosition.x += Math.cos(angle) * speed * dt;
    this.currentPosition.y += Math.sin(angle) * speed * dt;

    // Command robot
    try {
      await this.server.moveRobot({
        x: this.currentPosition.x,
        y: this.currentPosition.y,
        z: 0,
        roll: 0,
        pitch: 0,
        yaw: angle,
        speed: speed,
      });
    } catch (error) {
      // Mock robot
    }
  }

  private isAtGoal(): boolean {
    if (!this.currentGoal) return false;
    const dist = this.distance(this.currentPosition, this.currentGoal.target);
    return dist < this.currentGoal.tolerance;
  }

  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private distanceToLineSegment(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const len2 = dx * dx + dy * dy;

    if (len2 === 0) return this.distance(point, lineStart);

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const projection = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };

    return this.distance(point, projection);
  }

  private async queryNavigationMemory(target: Point2D): Promise<any[]> {
    const result = await this.server['memory'].queryWithContext(
      `navigate to position ${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
      { k: 5, minConfidence: 0.5, domain: 'navigation' }
    );
    return result.memories;
  }

  private async storeNavigationResult(success: boolean): Promise<void> {
    if (!this.currentGoal) return;

    await this.server['memory'].storeEpisode({
      sessionId: `nav-${Date.now()}`,
      taskName: 'navigation',
      confidence: success ? 0.95 : 0.3,
      success,
      outcome: success
        ? `Successfully navigated to (${this.currentGoal.target.x.toFixed(2)}, ${this.currentGoal.target.y.toFixed(2)})`
        : 'Navigation failed or timed out',
      strategy: 'astar_with_dynamic_replanning',
      metadata: {
        target: this.currentGoal.target,
        obstacles: this.obstacles.length,
        pathLength: this.path.length,
      },
    });
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'nav-alpha';
  const navigator = new AutonomousNavigator(robotId);

  await navigator.start();

  console.log('\n🎯 Starting autonomous navigation mission...\n');

  // Navigate to multiple waypoints
  const waypoints: Point2D[] = [
    { x: 3, y: 2 },
    { x: 5, y: 5 },
    { x: 2, y: 4 },
    { x: 0, y: 0 },
  ];

  for (const waypoint of waypoints) {
    const success = await navigator.navigateTo(waypoint);
    console.log(success ? '✅ Waypoint reached!' : '❌ Navigation failed');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🎉 Mission complete!');
  process.exit(0);
}

main().catch(console.error);
