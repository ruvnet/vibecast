/**
 * Swarm Coordinator - Multi-Agent Stigmergic Coordination
 *
 * Manages multiple agents (creators) coordinating through environment.
 * NO central planning - agents make local decisions based on pheromone sensing.
 */

import { PheromoneManager, PheromoneType, PheromoneDeposit, AgentSensing } from './pheromone';

export interface Agent {
  id: string;
  name: string;
  position: { x: number; y: number; z?: number };
  velocity?: { dx: number; dy: number; dz?: number };
  state: AgentState;
  memory: AgentMemory;
  behavior: AgentBehavior;
  metadata: Record<string, any>;
}

export enum AgentState {
  EXPLORING = 'exploring',     // Random walk, depositing interest trails
  FOLLOWING = 'following',     // Following a pheromone trail
  WORKING = 'working',         // At a resource, depositing success trails
  QUESTIONING = 'questioning', // Stuck, depositing question trails
  HELPING = 'helping',         // Following question trails to help
  CONVERGING = 'converging'    // Multiple agents at same location
}

export interface AgentMemory {
  visitedLocations: { x: number; y: number; z?: number; timestamp: number }[];
  followedTrails: string[]; // Deposit IDs
  successfulPaths: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  lastStateChange: number;
  explorationMap: Map<string, number>; // Grid cell -> visit count
}

export interface AgentBehavior {
  explorationBias: number;     // 0-1, tendency to explore vs exploit
  followingStrength: number;   // How strongly to follow trails
  helpfulness: number;         // Probability of responding to questions
  independenceThreshold: number; // When to break from following
  depositFrequency: number;    // How often to deposit pheromones
}

export interface SwarmEvent {
  type: 'agent_spawn' | 'agent_move' | 'deposit' | 'convergence' | 'resource_found' | 'help_request';
  agentId: string;
  timestamp: number;
  data: any;
}

export interface SwarmMetrics {
  totalAgents: number;
  activeAgents: number;
  explorationCoverage: number;  // % of space explored
  convergenceEvents: number;
  helpfulInteractions: number;
  emergentClusters: number;
  averagePathLength: number;
}

/**
 * Main Swarm Coordinator
 */
export class SwarmCoordinator {
  private agents: Map<string, Agent> = new Map();
  private pheromones: PheromoneManager;
  private events: SwarmEvent[] = [];
  private tickCount = 0;
  private readonly stepSize = 1.0;

  constructor(
    bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  ) {
    this.pheromones = new PheromoneManager(bounds);
  }

  /**
   * Add agent to swarm
   */
  spawnAgent(params: {
    id: string;
    name: string;
    position?: { x: number; y: number; z?: number };
    behavior?: Partial<AgentBehavior>;
    metadata?: Record<string, any>;
  }): Agent {
    const agent: Agent = {
      id: params.id,
      name: params.name,
      position: params.position || this.randomPosition(),
      state: AgentState.EXPLORING,
      memory: {
        visitedLocations: [],
        followedTrails: [],
        successfulPaths: [],
        lastStateChange: Date.now(),
        explorationMap: new Map()
      },
      behavior: {
        explorationBias: 0.5,
        followingStrength: 0.7,
        helpfulness: 0.6,
        independenceThreshold: 0.3,
        depositFrequency: 0.8,
        ...params.behavior
      },
      metadata: params.metadata || {}
    };

    this.agents.set(agent.id, agent);
    this.emitEvent({
      type: 'agent_spawn',
      agentId: agent.id,
      timestamp: Date.now(),
      data: { position: agent.position }
    });

    return agent;
  }

  /**
   * Remove agent from swarm
   */
  removeAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Main simulation tick - all agents act
   */
  tick(): void {
    this.tickCount++;

    // Each agent decides and acts independently
    this.agents.forEach(agent => {
      this.agentAct(agent);
    });

    // Environment evolves (pheromones evaporate)
    this.pheromones.tick();

    // Detect emergent phenomena
    this.detectEmergence();
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents in a specific state
   */
  getAgentsByState(state: AgentState): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.state === state);
  }

  /**
   * Get nearby agents
   */
  getNearbyAgents(
    position: { x: number; y: number; z?: number },
    radius: number
  ): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      this.distance(position, agent.position) <= radius
    );
  }

  /**
   * Get swarm metrics
   */
  getMetrics(): SwarmMetrics {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(
      a => a.state !== AgentState.EXPLORING
    ).length;

    // Calculate exploration coverage
    const allVisited = new Set<string>();
    this.agents.forEach(agent => {
      agent.memory.explorationMap.forEach((_, key) => allVisited.add(key));
    });

    const convergenceEvents = this.events.filter(e => e.type === 'convergence').length;
    const helpfulInteractions = this.events.filter(e => e.type === 'help_request').length;

    return {
      totalAgents,
      activeAgents,
      explorationCoverage: allVisited.size,
      convergenceEvents,
      helpfulInteractions,
      emergentClusters: this.detectClusters().length,
      averagePathLength: this.calculateAveragePathLength()
    };
  }

  /**
   * Get recent events
   */
  getEvents(limit: number = 100): SwarmEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get pheromone manager for external access
   */
  getPheromoneManager(): PheromoneManager {
    return this.pheromones;
  }

  /**
   * Export swarm state for visualization
   */
  exportState(): {
    agents: Agent[];
    pheromones: any;
    metrics: SwarmMetrics;
    tickCount: number;
  } {
    return {
      agents: Array.from(this.agents.values()),
      pheromones: this.pheromones.exportField(),
      metrics: this.getMetrics(),
      tickCount: this.tickCount
    };
  }

  // Private methods

  private agentAct(agent: Agent): void {
    // Sense environment
    const sensing = this.pheromones.sense(agent.position);
    const nearbyAgents = this.getNearbyAgents(agent.position, 3.0);

    // Update memory
    this.updateAgentMemory(agent);

    // State machine - decide what to do
    switch (agent.state) {
      case AgentState.EXPLORING:
        this.handleExploring(agent, sensing);
        break;
      case AgentState.FOLLOWING:
        this.handleFollowing(agent, sensing);
        break;
      case AgentState.WORKING:
        this.handleWorking(agent, sensing);
        break;
      case AgentState.QUESTIONING:
        this.handleQuestioning(agent, sensing);
        break;
      case AgentState.HELPING:
        this.handleHelping(agent, sensing);
        break;
      case AgentState.CONVERGING:
        this.handleConverging(agent, sensing, nearbyAgents);
        break;
    }

    // Deposit pheromones based on state
    if (Math.random() < agent.behavior.depositFrequency) {
      this.agentDeposit(agent, sensing);
    }
  }

  private handleExploring(agent: Agent, sensing: AgentSensing): void {
    // Check if we should switch to following
    if (sensing.strongestTrail && sensing.strongestTrail.strength > 0.5) {
      if (Math.random() > agent.behavior.explorationBias) {
        agent.state = AgentState.FOLLOWING;
        agent.memory.lastStateChange = Date.now();
        return;
      }
    }

    // Check for question pheromones if helpful
    const questionDeposits = sensing.nearbyDeposits.filter(d => d.type === PheromoneType.QUESTION);
    if (questionDeposits.length > 0 && Math.random() < agent.behavior.helpfulness) {
      agent.state = AgentState.HELPING;
      agent.memory.lastStateChange = Date.now();
      return;
    }

    // Random walk with bias away from visited areas
    this.randomWalk(agent);
  }

  private handleFollowing(agent: Agent, sensing: AgentSensing): void {
    // Follow strongest trail
    const nextPos = this.pheromones.followTrail(
      agent.position,
      sensing.strongestTrail?.type || PheromoneType.INTEREST,
      this.stepSize
    );

    if (nextPos) {
      agent.position = nextPos;
    } else {
      // Lost trail - back to exploring or start working
      if (Math.random() < 0.5) {
        agent.state = AgentState.WORKING;
      } else {
        agent.state = AgentState.EXPLORING;
      }
      agent.memory.lastStateChange = Date.now();
    }

    // Check for independence - break from following
    if (Math.random() < agent.behavior.independenceThreshold) {
      agent.state = AgentState.EXPLORING;
      agent.memory.lastStateChange = Date.now();
    }
  }

  private handleWorking(agent: Agent, sensing: AgentSensing): void {
    // Simulate work - stay in place, deposit success
    const workDuration = 10; // ticks
    const timeSinceChange = this.tickCount - (agent.memory.lastStateChange / 1000);

    if (timeSinceChange > workDuration) {
      // Finished working
      agent.state = AgentState.EXPLORING;
      agent.memory.lastStateChange = Date.now();
    }

    // Sometimes get stuck
    if (Math.random() < 0.05) {
      agent.state = AgentState.QUESTIONING;
      agent.memory.lastStateChange = Date.now();
    }
  }

  private handleQuestioning(agent: Agent, sensing: AgentSensing): void {
    // Wait for help
    const waitTime = 5; // ticks
    const timeSinceChange = this.tickCount - (agent.memory.lastStateChange / 1000);

    if (timeSinceChange > waitTime) {
      // No help came, try something else
      agent.state = AgentState.EXPLORING;
      agent.memory.lastStateChange = Date.now();
    }

    // Check if help arrived
    const nearbyAgents = this.getNearbyAgents(agent.position, 2.0);
    const helpers = nearbyAgents.filter(a => a.state === AgentState.HELPING);

    if (helpers.length > 0) {
      agent.state = AgentState.CONVERGING;
      agent.memory.lastStateChange = Date.now();
      this.emitEvent({
        type: 'help_request',
        agentId: agent.id,
        timestamp: Date.now(),
        data: { helpers: helpers.map(h => h.id) }
      });
    }
  }

  private handleHelping(agent: Agent, sensing: AgentSensing): void {
    // Find and move toward question pheromones
    const questionGradient = sensing.gradients.get(PheromoneType.QUESTION);

    if (questionGradient) {
      const magnitude = Math.sqrt(
        questionGradient.dx ** 2 + questionGradient.dy ** 2
      );

      if (magnitude > 0.01) {
        agent.position = {
          x: agent.position.x + (questionGradient.dx / magnitude) * this.stepSize,
          y: agent.position.y + (questionGradient.dy / magnitude) * this.stepSize,
          z: agent.position.z
        };
        return;
      }
    }

    // No more questions nearby
    agent.state = AgentState.EXPLORING;
    agent.memory.lastStateChange = Date.now();
  }

  private handleConverging(agent: Agent, sensing: AgentSensing, nearbyAgents: Agent[]): void {
    // Multiple agents at same spot - emergent collaboration
    if (nearbyAgents.length < 2) {
      // Others left, back to work or exploring
      agent.state = Math.random() < 0.5 ? AgentState.WORKING : AgentState.EXPLORING;
      agent.memory.lastStateChange = Date.now();
      return;
    }

    // Deposit convergence pheromone
    this.pheromones.deposit({
      type: PheromoneType.CONVERGENCE,
      position: agent.position,
      strength: 1.0,
      depositor: agent.id,
      context: `Convergence with ${nearbyAgents.length} agents`
    });

    // Eventually disperse
    if (Math.random() < 0.1) {
      agent.state = AgentState.EXPLORING;
      agent.memory.lastStateChange = Date.now();
    }
  }

  private agentDeposit(agent: Agent, sensing: AgentSensing): void {
    let type: PheromoneType;

    switch (agent.state) {
      case AgentState.EXPLORING:
        type = PheromoneType.INTEREST;
        break;
      case AgentState.WORKING:
        type = PheromoneType.SUCCESS;
        break;
      case AgentState.QUESTIONING:
        type = PheromoneType.QUESTION;
        break;
      case AgentState.CONVERGING:
        type = PheromoneType.CONVERGENCE;
        break;
      default:
        return; // Don't deposit while following or helping
    }

    this.pheromones.deposit({
      type,
      position: agent.position,
      strength: 0.8,
      depositor: agent.id,
      context: agent.state,
      tags: [agent.name]
    });

    this.emitEvent({
      type: 'deposit',
      agentId: agent.id,
      timestamp: Date.now(),
      data: { type, position: agent.position }
    });
  }

  private updateAgentMemory(agent: Agent): void {
    // Record visited location
    agent.memory.visitedLocations.push({
      ...agent.position,
      timestamp: Date.now()
    });

    // Limit memory size
    if (agent.memory.visitedLocations.length > 100) {
      agent.memory.visitedLocations.shift();
    }

    // Update exploration map
    const gridKey = `${Math.floor(agent.position.x / 2)},${Math.floor(agent.position.y / 2)}`;
    agent.memory.explorationMap.set(
      gridKey,
      (agent.memory.explorationMap.get(gridKey) || 0) + 1
    );
  }

  private randomWalk(agent: Agent): void {
    // Biased random walk - avoid heavily visited areas
    const candidates = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];

    // Score each direction
    const scored = candidates.map(dir => {
      const newPos = {
        x: agent.position.x + dir.dx * this.stepSize,
        y: agent.position.y + dir.dy * this.stepSize
      };
      const gridKey = `${Math.floor(newPos.x / 2)},${Math.floor(newPos.y / 2)}`;
      const visits = agent.memory.explorationMap.get(gridKey) || 0;
      return { dir, score: 1 / (1 + visits) }; // Prefer less visited
    });

    // Weighted random selection
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    let roll = Math.random() * totalScore;

    for (const { dir, score } of scored) {
      roll -= score;
      if (roll <= 0) {
        agent.position = {
          x: agent.position.x + dir.dx * this.stepSize,
          y: agent.position.y + dir.dy * this.stepSize,
          z: agent.position.z
        };
        break;
      }
    }
  }

  private detectEmergence(): void {
    // Detect convergence events
    const clusters = this.detectClusters();

    clusters.forEach(cluster => {
      if (cluster.agents.length >= 3) {
        this.emitEvent({
          type: 'convergence',
          agentId: cluster.agents[0],
          timestamp: Date.now(),
          data: {
            position: cluster.center,
            agentCount: cluster.agents.length,
            agents: cluster.agents
          }
        });
      }
    });
  }

  private detectClusters(): Array<{
    center: { x: number; y: number };
    agents: string[];
  }> {
    const clusters: Array<{ center: { x: number; y: number }; agents: string[] }> = [];
    const processed = new Set<string>();
    const clusterRadius = 3.0;

    this.agents.forEach(agent => {
      if (processed.has(agent.id)) return;

      const nearby = Array.from(this.agents.values()).filter(a =>
        !processed.has(a.id) &&
        this.distance(agent.position, a.position) <= clusterRadius
      );

      if (nearby.length >= 2) {
        const avgX = nearby.reduce((sum, a) => sum + a.position.x, 0) / nearby.length;
        const avgY = nearby.reduce((sum, a) => sum + a.position.y, 0) / nearby.length;

        clusters.push({
          center: { x: avgX, y: avgY },
          agents: nearby.map(a => a.id)
        });

        nearby.forEach(a => processed.add(a.id));
      }
    });

    return clusters;
  }

  private calculateAveragePathLength(): number {
    let totalLength = 0;
    let pathCount = 0;

    this.agents.forEach(agent => {
      const paths = agent.memory.successfulPaths;
      paths.forEach(path => {
        totalLength += this.distance(path.start, path.end);
        pathCount++;
      });
    });

    return pathCount > 0 ? totalLength / pathCount : 0;
  }

  private distance(
    a: { x: number; y: number; z?: number },
    b: { x: number; y: number; z?: number }
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private randomPosition(): { x: number; y: number } {
    const bounds = this.pheromones.exportField().bounds;
    return {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
    };
  }

  private emitEvent(event: SwarmEvent): void {
    this.events.push(event);
    // Keep last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }
  }
}
