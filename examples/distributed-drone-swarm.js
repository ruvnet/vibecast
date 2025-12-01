/**
 * Distributed Drone Swarm Example
 *
 * Demonstrates swarm attention for autonomous drone coordination
 * - Target tracking with particle swarm attention
 * - Collision avoidance with stigmergic pheromones
 * - Hierarchical coordination for large swarms
 */

const { SwarmAttention, StigmergicAttention } = require('@ruvector/attention');

class Drone {
  constructor(id, position, velocity) {
    this.id = id;
    this.position = position || [0, 0, 0]; // 3D position [x, y, z]
    this.velocity = velocity || [0, 0, 0];
    this.target = null;
    this.sensors = {
      camera: null,
      lidar: null,
      gps: this.position,
    };
  }

  getStateVector() {
    // Combine position, velocity, and sensor data into attention vector
    return new Float32Array([
      ...this.position,
      ...this.velocity,
      this.target ? ...this.target : 0, 0, 0,
      // Add more features as needed
    ]);
  }

  setWaypoint(position) {
    console.log(`Drone ${this.id}: New waypoint [${position.slice(0, 3).map(x => x.toFixed(2)).join(', ')}]`);
    this.target = position.slice(0, 3);
  }

  setTarget(target) {
    console.log(`Drone ${this.id}: Tracking target ${target.id}`);
    this.target = target.position;
  }

  applyForce(force) {
    // Update velocity based on force
    for (let i = 0; i < 3; i++) {
      this.velocity[i] += force[i] * 0.1;
      // Clamp velocity
      this.velocity[i] = Math.max(-10, Math.min(10, this.velocity[i]));
    }
  }

  update(dt = 0.1) {
    // Update position based on velocity
    for (let i = 0; i < 3; i++) {
      this.position[i] += this.velocity[i] * dt;
    }

    // Apply drag
    for (let i = 0; i < 3; i++) {
      this.velocity[i] *= 0.95;
    }

    this.sensors.gps = [...this.position];
  }
}

class Target {
  constructor(id, position) {
    this.id = id;
    this.position = position || [0, 0, 0];
    this.velocity = [
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ];
  }

  getStateVector() {
    return new Float32Array([...this.position, ...this.velocity]);
  }

  update(dt = 0.1) {
    for (let i = 0; i < 3; i++) {
      this.position[i] += this.velocity[i] * dt;

      // Bounce off boundaries [0, 100]
      if (this.position[i] < 0 || this.position[i] > 100) {
        this.velocity[i] *= -1;
        this.position[i] = Math.max(0, Math.min(100, this.position[i]));
      }
    }
  }
}

class DroneSwarmController {
  constructor(numDrones) {
    this.drones = [];
    this.targets = [];

    // Initialize swarm attention for target tracking
    this.swarmAttention = new SwarmAttention({
      dim: 9, // 3 pos + 3 vel + 3 target
      numAgents: numDrones,
      swarmType: 'particle-swarm',
      topology: 'adaptive',

      // PSO parameters tuned for drone dynamics
      inertia: 0.9,        // High momentum for smooth flight
      cognitiveWeight: 0.5,
      socialWeight: 2.0,   // Strong flocking behavior
      pheromoneWeight: 1.0,

      useHyperbolic: false, // Euclidean space for physical coordinates
      maxVelocity: 10.0,
    });

    // Initialize stigmergic field for collision avoidance
    this.collisionAvoidance = new StigmergicAttention({
      dim: 3, // 3D space
      gridResolution: 50, // 50x50x50 grid for 100x100x100 space

      pheromoneTypes: [
        {
          name: 'obstacle',
          decayRate: 0.2,  // Decay quickly (5 seconds)
          spread: 2.0,     // 2 meter spread
          weight: 1.0,
        },
        {
          name: 'path',
          decayRate: 0.05, // Decay slowly (20 seconds)
          spread: 1.0,
          weight: 0.5,
        },
      ],
    });

    // Initialize drones at random positions
    for (let i = 0; i < numDrones; i++) {
      const position = [
        Math.random() * 100,
        Math.random() * 100,
        Math.random() * 20 + 10, // Altitude 10-30m
      ];
      const velocity = [0, 0, 0];
      this.drones.push(new Drone(i, position, velocity));
    }

    console.log(`Initialized ${numDrones} drones`);
  }

  addTarget(target) {
    this.targets.push(target);
    console.log(`Added target ${target.id} at [${target.position.map(x => x.toFixed(2)).join(', ')}]`);
  }

  async coordinateTargetTracking() {
    if (this.targets.length === 0) {
      console.log('No targets to track');
      return;
    }

    console.log('\n=== Coordinating Target Tracking ===');

    // Prepare drone states and target states
    const droneStates = this.drones.map(d => d.getStateVector());
    const targetStates = this.targets.map(t => t.getStateVector());

    // Lead drone queries for best target assignments
    const leadDroneState = droneStates[0];

    // Use swarm attention to decide which drones should track which targets
    const attention = await this.swarmAttention.compute(
      leadDroneState,
      targetStates,
      targetStates
    );

    // Assign targets based on attention weights
    console.log('\nTarget assignments:');
    for (let i = 0; i < this.drones.length; i++) {
      // Simple assignment: each drone tracks highest-attention target
      let maxAttention = -1;
      let bestTarget = 0;

      for (let j = 0; j < this.targets.length; j++) {
        if (attention[j] > maxAttention) {
          maxAttention = attention[j];
          bestTarget = j;
        }
      }

      this.drones[i].setTarget(this.targets[bestTarget]);
    }

    // Update swarm (PSO dynamics)
    this.swarmAttention.updateSwarm();

    // Apply swarm positions as drone waypoints
    const swarmPositions = this.swarmAttention.getAgentPositions();
    for (let i = 0; i < this.drones.length; i++) {
      // Extract 3D position from swarm state
      const waypoint = swarmPositions[i].slice(0, 3);
      this.drones[i].setWaypoint(waypoint);
    }
  }

  async avoidCollisions() {
    console.log('\n=== Collision Avoidance ===');

    // Each drone deposits "obstacle" pheromone at its position
    for (const drone of this.drones) {
      const position = new Float32Array(drone.position);
      this.collisionAvoidance.deposit(position, 1.0, 'obstacle');
    }

    // Each drone also deposits "path" pheromone along its trajectory
    for (const drone of this.drones) {
      if (drone.target) {
        const pathPoint = new Float32Array([
          drone.position[0] + drone.velocity[0],
          drone.position[1] + drone.velocity[1],
          drone.position[2] + drone.velocity[2],
        ]);
        this.collisionAvoidance.deposit(pathPoint, 0.5, 'path');
      }
    }

    // Each drone follows negative gradient to avoid obstacles
    console.log('\nApplying repulsion forces:');
    for (const drone of this.drones) {
      const position = new Float32Array(drone.position);
      const gradient = this.collisionAvoidance.gradient(position);

      // Repulsion force (opposite of gradient)
      const avoidanceForce = gradient.map(g => -g * 5.0);

      drone.applyForce(avoidanceForce);

      const forceMagnitude = Math.sqrt(
        avoidanceForce.reduce((sum, f) => sum + f * f, 0)
      );
      console.log(`  Drone ${drone.id}: Force magnitude ${forceMagnitude.toFixed(2)}`);
    }

    // Evaporate pheromones
    this.collisionAvoidance.evaporate();
  }

  updateSimulation(dt = 0.1) {
    // Update targets
    for (const target of this.targets) {
      target.update(dt);
    }

    // Update drones
    for (const drone of this.drones) {
      drone.update(dt);
    }
  }

  printStatus() {
    console.log('\n=== Swarm Status ===');
    console.log(`Drones: ${this.drones.length}`);
    console.log(`Targets: ${this.targets.length}`);

    console.log('\nDrone positions:');
    for (const drone of this.drones.slice(0, 5)) { // Show first 5
      console.log(
        `  Drone ${drone.id}: [${drone.position.map(x => x.toFixed(1)).join(', ')}] ` +
        `vel=[${drone.velocity.map(v => v.toFixed(1)).join(', ')}]`
      );
    }
    if (this.drones.length > 5) {
      console.log(`  ... and ${this.drones.length - 5} more`);
    }

    console.log('\nTarget positions:');
    for (const target of this.targets) {
      console.log(
        `  Target ${target.id}: [${target.position.map(x => x.toFixed(1)).join(', ')}]`
      );
    }
  }

  async simulate(steps = 10) {
    console.log(`\n=== Starting ${steps}-step simulation ===\n`);

    for (let step = 0; step < steps; step++) {
      console.log(`\n--- Step ${step + 1}/${steps} ---`);

      // Coordinate target tracking
      await this.coordinateTargetTracking();

      // Avoid collisions
      await this.avoidCollisions();

      // Update physics
      this.updateSimulation();

      // Print status every few steps
      if (step % 3 === 0) {
        this.printStatus();
      }
    }

    console.log('\n=== Simulation Complete ===');
  }
}

// Run example
async function main() {
  console.log('=== Distributed Drone Swarm Example ===\n');

  // Create swarm with 20 drones
  const swarm = new DroneSwarmController(20);

  // Add moving targets
  swarm.addTarget(new Target(0, [50, 50, 15]));
  swarm.addTarget(new Target(1, [25, 75, 20]));
  swarm.addTarget(new Target(2, [75, 25, 12]));

  // Run simulation
  await swarm.simulate(10);

  console.log('\n=== Example Complete ===');
}

main().catch(err => console.error('Error:', err));
