#!/usr/bin/env node
/**
 * Example 4: Swarm Intelligence with Emergent Behavior
 *
 * Demonstrates:
 * - Flocking behavior (Boids algorithm)
 * - Collective decision-making
 * - Self-organization and pattern formation
 * - Stigmergy (indirect communication via environment)
 * - Emergent search and foraging
 * - Adaptive swarm behavior
 *
 * A swarm of robots exhibits complex emergent behaviors arising from
 * simple local rules, inspired by natural systems like bird flocks,
 * ant colonies, and bee swarms.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Vector2D {
  x: number;
  y: number;
}

interface SwarmAgent {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  role: 'scout' | 'worker' | 'guard';
  energy: number;
  foundFood: boolean;
  foodQuality: number;
  pheromones: Map<string, number>; // Stigmergy trail
}

interface FoodSource {
  position: Vector2D;
  quantity: number;
  quality: number;
}

interface SwarmBehavior {
  separation: number; // Avoid crowding
  alignment: number;  // Align with neighbors
  cohesion: number;   // Move towards center of neighbors
  exploration: number; // Random exploration factor
}

class SwarmRobot {
  private server: ROS3McpServer;
  private agent: SwarmAgent;
  private neighbors: Map<string, SwarmAgent> = new Map();
  private foodSources: FoodSource[] = [];
  private home: Vector2D = { x: 0, y: 0 };
  private perceptionRadius: number = 3.0;
  private behavior: SwarmBehavior = {
    separation: 1.5,
    alignment: 1.0,
    cohesion: 1.0,
    exploration: 0.3,
  };

  constructor(robotId: string, role: 'scout' | 'worker' | 'guard' = 'worker') {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * 2;

    this.agent = {
      id: robotId,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
      velocity: {
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
      },
      role,
      energy: 100,
      foundFood: false,
      foodQuality: 0,
      pheromones: new Map(),
    };

    this.server = new ROS3McpServer({
      name: `swarm-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/swarm-${robotId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🐝 Swarm Agent ${this.agent.id} started (${this.agent.role})`);
  }

  update(allAgents: Map<string, SwarmAgent>, foodSources: FoodSource[], dt: number): void {
    // Update neighbors within perception radius
    this.updateNeighbors(allAgents);

    // Apply swarm behaviors based on role
    let steeringForce = { x: 0, y: 0 };

    switch (this.agent.role) {
      case 'scout':
        steeringForce = this.scoutBehavior(foodSources);
        break;
      case 'worker':
        steeringForce = this.workerBehavior(foodSources);
        break;
      case 'guard':
        steeringForce = this.guardBehavior();
        break;
    }

    // Apply steering force
    this.agent.velocity.x += steeringForce.x * dt;
    this.agent.velocity.y += steeringForce.y * dt;

    // Limit velocity
    const speed = this.magnitude(this.agent.velocity);
    const maxSpeed = this.agent.role === 'scout' ? 2.0 : 1.0;
    if (speed > maxSpeed) {
      this.agent.velocity.x = (this.agent.velocity.x / speed) * maxSpeed;
      this.agent.velocity.y = (this.agent.velocity.y / speed) * maxSpeed;
    }

    // Update position
    this.agent.position.x += this.agent.velocity.x * dt;
    this.agent.position.y += this.agent.velocity.y * dt;

    // Energy management
    this.agent.energy -= 0.1 * dt;

    // Check for food collection
    this.checkFoodCollection(foodSources);

    // Return to home if low energy or carrying food
    if (this.agent.energy < 30 || this.agent.foundFood) {
      const distToHome = this.distance(this.agent.position, this.home);
      if (distToHome < 0.5) {
        // At home
        if (this.agent.foundFood) {
          // Deposit food
          console.log(`🍯 ${this.agent.id}: Deposited food (quality: ${this.agent.foodQuality.toFixed(2)})`);
          this.agent.foundFood = false;
          this.agent.foodQuality = 0;
        }
        // Recharge
        this.agent.energy = Math.min(100, this.agent.energy + 5);
      }
    }

    // Update pheromone trails (decay over time)
    for (const [key, value] of this.agent.pheromones.entries()) {
      const decayed = value * 0.95; // 5% decay
      if (decayed < 0.01) {
        this.agent.pheromones.delete(key);
      } else {
        this.agent.pheromones.set(key, decayed);
      }
    }
  }

  private scoutBehavior(foodSources: FoodSource[]): Vector2D {
    // Scouts explore to find food
    let force = { x: 0, y: 0 };

    // 1. Separation from neighbors
    const separation = this.calculateSeparation();
    force = this.addVectors(force, this.scaleVector(separation, this.behavior.separation));

    // 2. Exploration (random walk with levy flights)
    if (Math.random() < 0.1) {
      const explorationForce = {
        x: (Math.random() - 0.5) * this.behavior.exploration * 5,
        y: (Math.random() - 0.5) * this.behavior.exploration * 5,
      };
      force = this.addVectors(force, explorationForce);
    }

    // 3. If found food, return home to recruit
    if (this.agent.foundFood) {
      const homeDirection = this.normalize(
        this.subtractVectors(this.home, this.agent.position)
      );
      force = this.addVectors(force, this.scaleVector(homeDirection, 3.0));

      // Leave pheromone trail
      this.dropPheromone('food', this.agent.foodQuality);
    }

    // 4. Avoid boundaries (keep within exploration area)
    const boundaryForce = this.calculateBoundaryAvoidance(15);
    force = this.addVectors(force, boundaryForce);

    return force;
  }

  private workerBehavior(foodSources: FoodSource[]): Vector2D {
    let force = { x: 0, y: 0 };

    // 1. Basic flocking behaviors
    const separation = this.calculateSeparation();
    const alignment = this.calculateAlignment();
    const cohesion = this.calculateCohesion();

    force = this.addVectors(force, this.scaleVector(separation, this.behavior.separation));
    force = this.addVectors(force, this.scaleVector(alignment, this.behavior.alignment));
    force = this.addVectors(force, this.scaleVector(cohesion, this.behavior.cohesion));

    // 2. Follow pheromone trails to food
    if (!this.agent.foundFood && this.agent.energy > 30) {
      const pheromoneForce = this.followPheromoneTrail();
      force = this.addVectors(force, this.scaleVector(pheromoneForce, 2.0));
    }

    // 3. Return home when carrying food or low energy
    if (this.agent.foundFood || this.agent.energy < 30) {
      const homeDirection = this.normalize(
        this.subtractVectors(this.home, this.agent.position)
      );
      force = this.addVectors(force, this.scaleVector(homeDirection, 2.5));

      if (this.agent.foundFood) {
        this.dropPheromone('food', this.agent.foodQuality);
      }
    }

    // 4. Boundary avoidance
    const boundaryForce = this.calculateBoundaryAvoidance(15);
    force = this.addVectors(force, boundaryForce);

    return force;
  }

  private guardBehavior(): Vector2D {
    // Guards patrol around home base
    let force = { x: 0, y: 0 };

    const distToHome = this.distance(this.agent.position, this.home);
    const patrolRadius = 5.0;

    if (distToHome > patrolRadius) {
      // Move back towards patrol area
      const homeDirection = this.normalize(
        this.subtractVectors(this.home, this.agent.position)
      );
      force = this.addVectors(force, this.scaleVector(homeDirection, 1.5));
    } else {
      // Circle around home
      const perpendicular = {
        x: -(this.agent.position.y - this.home.y),
        y: this.agent.position.x - this.home.x,
      };
      const circleForce = this.normalize(perpendicular);
      force = this.addVectors(force, this.scaleVector(circleForce, 1.0));
    }

    // Separation from other guards
    const separation = this.calculateSeparation();
    force = this.addVectors(force, this.scaleVector(separation, 1.0));

    return force;
  }

  private calculateSeparation(): Vector2D {
    const separationForce = { x: 0, y: 0 };
    let count = 0;

    for (const neighbor of this.neighbors.values()) {
      const dist = this.distance(this.agent.position, neighbor.position);
      if (dist < 1.0 && dist > 0) {
        const diff = this.subtractVectors(this.agent.position, neighbor.position);
        const normalized = this.normalize(diff);
        const scaled = this.scaleVector(normalized, 1.0 / dist); // Stronger when closer
        separationForce.x += scaled.x;
        separationForce.y += scaled.y;
        count++;
      }
    }

    if (count > 0) {
      separationForce.x /= count;
      separationForce.y /= count;
    }

    return separationForce;
  }

  private calculateAlignment(): Vector2D {
    const avgVelocity = { x: 0, y: 0 };
    let count = 0;

    for (const neighbor of this.neighbors.values()) {
      if (neighbor.role === this.agent.role) {
        avgVelocity.x += neighbor.velocity.x;
        avgVelocity.y += neighbor.velocity.y;
        count++;
      }
    }

    if (count > 0) {
      avgVelocity.x /= count;
      avgVelocity.y /= count;
      return this.normalize(avgVelocity);
    }

    return { x: 0, y: 0 };
  }

  private calculateCohesion(): Vector2D {
    const centerOfMass = { x: 0, y: 0 };
    let count = 0;

    for (const neighbor of this.neighbors.values()) {
      if (neighbor.role === this.agent.role) {
        centerOfMass.x += neighbor.position.x;
        centerOfMass.y += neighbor.position.y;
        count++;
      }
    }

    if (count > 0) {
      centerOfMass.x /= count;
      centerOfMass.y /= count;
      return this.normalize(this.subtractVectors(centerOfMass, this.agent.position));
    }

    return { x: 0, y: 0 };
  }

  private followPheromoneTrail(): Vector2D {
    let strongestDirection = { x: 0, y: 0 };
    let maxStrength = 0;

    // Check pheromones from neighbors
    for (const neighbor of this.neighbors.values()) {
      const foodPheromone = neighbor.pheromones.get('food') || 0;
      if (foodPheromone > maxStrength) {
        maxStrength = foodPheromone;
        strongestDirection = this.normalize(
          this.subtractVectors(neighbor.position, this.agent.position)
        );
      }
    }

    return strongestDirection;
  }

  private dropPheromone(type: string, strength: number): void {
    this.agent.pheromones.set(type, strength);
  }

  private calculateBoundaryAvoidance(boundarySize: number): Vector2D {
    const force = { x: 0, y: 0 };
    const margin = 2.0;

    if (this.agent.position.x > boundarySize - margin) {
      force.x = -1.0;
    } else if (this.agent.position.x < -boundarySize + margin) {
      force.x = 1.0;
    }

    if (this.agent.position.y > boundarySize - margin) {
      force.y = -1.0;
    } else if (this.agent.position.y < -boundarySize + margin) {
      force.y = 1.0;
    }

    return force;
  }

  private checkFoodCollection(foodSources: FoodSource[]): void {
    if (this.agent.foundFood) return;

    for (const food of foodSources) {
      if (food.quantity <= 0) continue;

      const dist = this.distance(this.agent.position, food.position);
      if (dist < 0.5) {
        this.agent.foundFood = true;
        this.agent.foodQuality = food.quality;
        food.quantity -= 1;
        console.log(`🎯 ${this.agent.id}: Found food! (quality: ${food.quality.toFixed(2)}, remaining: ${food.quantity})`);
        break;
      }
    }
  }

  private updateNeighbors(allAgents: Map<string, SwarmAgent>): void {
    this.neighbors.clear();

    for (const [id, agent] of allAgents.entries()) {
      if (id === this.agent.id) continue;

      const dist = this.distance(this.agent.position, agent.position);
      if (dist < this.perceptionRadius) {
        this.neighbors.set(id, agent);
      }
    }
  }

  private distance(p1: Vector2D, p2: Vector2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private magnitude(v: Vector2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  private normalize(v: Vector2D): Vector2D {
    const mag = this.magnitude(v);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
  }

  private addVectors(v1: Vector2D, v2: Vector2D): Vector2D {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  }

  private subtractVectors(v1: Vector2D, v2: Vector2D): Vector2D {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  }

  private scaleVector(v: Vector2D, scale: number): Vector2D {
    return { x: v.x * scale, y: v.y * scale };
  }

  getAgent(): SwarmAgent {
    return this.agent;
  }

  async storeSwarmMemory(stats: any): Promise<void> {
    await this.server['memory'].storeEpisode({
      sessionId: `swarm-${Date.now()}`,
      taskName: 'swarm_foraging',
      confidence: 0.9,
      success: stats.foodCollected > 0,
      outcome: `Collected ${stats.foodCollected} food items`,
      strategy: `${this.agent.role}_behavior`,
      metadata: { ...stats, role: this.agent.role },
    });
  }
}

// Swarm Manager
class SwarmManager {
  private robots: SwarmRobot[] = [];
  private agents: Map<string, SwarmAgent> = new Map();
  private foodSources: FoodSource[] = [];
  private foodCollected: number = 0;

  async initialize(numScouts: number, numWorkers: number, numGuards: number): Promise<void> {
    console.log(`🐝 Initializing swarm...`);
    console.log(`   Scouts: ${numScouts}, Workers: ${numWorkers}, Guards: ${numGuards}\n`);

    // Create robots
    for (let i = 0; i < numScouts; i++) {
      const robot = new SwarmRobot(`scout-${i}`, 'scout');
      await robot.start();
      this.robots.push(robot);
      this.agents.set(robot.getAgent().id, robot.getAgent());
    }

    for (let i = 0; i < numWorkers; i++) {
      const robot = new SwarmRobot(`worker-${i}`, 'worker');
      await robot.start();
      this.robots.push(robot);
      this.agents.set(robot.getAgent().id, robot.getAgent());
    }

    for (let i = 0; i < numGuards; i++) {
      const robot = new SwarmRobot(`guard-${i}`, 'guard');
      await robot.start();
      this.robots.push(robot);
      this.agents.set(robot.getAgent().id, robot.getAgent());
    }

    // Place food sources
    this.generateFoodSources(5);
  }

  private generateFoodSources(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const radius = 8 + Math.random() * 4;

      this.foodSources.push({
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        },
        quantity: 10 + Math.floor(Math.random() * 20),
        quality: 0.5 + Math.random() * 0.5,
      });
    }

    console.log(`🍯 Generated ${this.foodSources.length} food sources\n`);
  }

  update(dt: number): void {
    // Update all robots
    for (const robot of this.robots) {
      robot.update(this.agents, this.foodSources, dt);
    }

    // Update agents map
    this.agents.clear();
    for (const robot of this.robots) {
      const agent = robot.getAgent();
      this.agents.set(agent.id, agent);
    }
  }

  getStats(): any {
    const stats = {
      totalAgents: this.robots.length,
      scouts: 0,
      workers: 0,
      guards: 0,
      avgEnergy: 0,
      foodCollected: 0,
      foodRemaining: 0,
      agentsWithFood: 0,
    };

    for (const robot of this.robots) {
      const agent = robot.getAgent();
      stats.avgEnergy += agent.energy;

      if (agent.role === 'scout') stats.scouts++;
      if (agent.role === 'worker') stats.workers++;
      if (agent.role === 'guard') stats.guards++;
      if (agent.foundFood) stats.agentsWithFood++;
    }

    stats.avgEnergy /= this.robots.length;

    for (const food of this.foodSources) {
      stats.foodRemaining += food.quantity;
    }

    const initialFood = this.foodSources.reduce((sum, f) => sum + f.quantity, 0);
    stats.foodCollected = Math.max(0, initialFood - stats.foodRemaining);

    return stats;
  }

  async storeMemories(): Promise<void> {
    const stats = this.getStats();
    for (const robot of this.robots) {
      await robot.storeSwarmMemory(stats);
    }
  }
}

// Main execution
async function main() {
  const swarm = new SwarmManager();

  // Initialize swarm with different robot types
  await swarm.initialize(3, 10, 2); // 3 scouts, 10 workers, 2 guards

  console.log('🚀 Swarm simulation running...\n');

  // Simulation loop
  const dt = 0.1; // 100ms timestep
  let ticks = 0;
  const maxTicks = 600; // 60 seconds

  const interval = setInterval(() => {
    swarm.update(dt);
    ticks++;

    // Print stats every 5 seconds
    if (ticks % 50 === 0) {
      const stats = swarm.getStats();
      console.log(`\n📊 Swarm Stats (t=${ticks * dt}s):`);
      console.log(`   Agents: ${stats.totalAgents} (${stats.scouts} scouts, ${stats.workers} workers, ${stats.guards} guards)`);
      console.log(`   Average Energy: ${stats.avgEnergy.toFixed(1)}%`);
      console.log(`   Food Collected: ${stats.foodCollected}`);
      console.log(`   Food Remaining: ${stats.foodRemaining}`);
      console.log(`   Agents Carrying Food: ${stats.agentsWithFood}`);
    }

    if (ticks >= maxTicks) {
      clearInterval(interval);
      finalize();
    }
  }, dt * 1000);

  async function finalize() {
    const finalStats = swarm.getStats();
    console.log(`\n🎉 Swarm simulation complete!\n`);
    console.log(`📈 Final Results:`);
    console.log(`   Total Food Collected: ${finalStats.foodCollected}`);
    console.log(`   Collection Efficiency: ${(finalStats.foodCollected / finalStats.totalAgents).toFixed(2)} per agent`);
    console.log(`   Average Energy: ${finalStats.avgEnergy.toFixed(1)}%`);

    await swarm.storeMemories();
    process.exit(0);
  }
}

main().catch(console.error);
