/**
 * Collaboration API - Real-time Stigmergic Coordination
 *
 * Provides event-driven API for creators to coordinate through environment.
 * Like watching ants work - each agent senses and responds locally.
 */

import { EventEmitter } from 'events';
import { SwarmCoordinator, Agent, AgentState, SwarmEvent } from './swarm-coordinator';
import { PheromoneType, PheromoneDeposit } from './pheromone';
import { EmergenceDetector, EmergentPattern, EmergenceMetrics } from './emergence';

export interface CollaborationSession {
  id: string;
  name: string;
  coordinator: SwarmCoordinator;
  detector: EmergenceDetector;
  startTime: number;
  participants: Map<string, SessionParticipant>;
}

export interface SessionParticipant {
  agentId: string;
  userId: string;
  joinedAt: number;
  role: 'creator' | 'observer';
  active: boolean;
}

export interface ActivityFeed {
  events: SwarmEvent[];
  patterns: EmergentPattern[];
  metrics: EmergenceMetrics;
}

export interface SensoryInput {
  nearbyAgents: Array<{
    id: string;
    name: string;
    distance: number;
    state: AgentState;
  }>;
  nearbyTrails: Array<{
    type: PheromoneType;
    strength: number;
    direction: { dx: number; dy: number };
  }>;
  convergencePoints: Array<{
    x: number;
    y: number;
    strength: number;
    agentCount: number;
  }>;
  suggestions: string[]; // AI-generated suggestions based on sensing
}

export interface ActionResult {
  success: boolean;
  newState: AgentState;
  depositsCreated: string[];
  message: string;
}

/**
 * Main Collaboration API
 */
export class CollaborationAPI extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private userToAgent: Map<string, string> = new Map();

  /**
   * Create new collaboration session
   */
  createSession(params: {
    name: string;
    bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  }): CollaborationSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const coordinator = new SwarmCoordinator(params.bounds);
    const detector = new EmergenceDetector(coordinator);

    const session: CollaborationSession = {
      id: sessionId,
      name: params.name,
      coordinator,
      detector,
      startTime: Date.now(),
      participants: new Map()
    };

    this.sessions.set(sessionId, session);

    this.emit('session:created', { sessionId, name: params.name });

    return session;
  }

  /**
   * Join existing session as creator
   */
  joinSession(params: {
    sessionId: string;
    userId: string;
    name: string;
    position?: { x: number; y: number };
    role?: 'creator' | 'observer';
  }): { agentId: string; session: CollaborationSession } {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    // Spawn agent for this user
    const agent = session.coordinator.spawnAgent({
      id: `agent-${params.userId}`,
      name: params.name,
      position: params.position,
      behavior: {
        explorationBias: 0.6,
        followingStrength: 0.7,
        helpfulness: 0.8,
        independenceThreshold: 0.3,
        depositFrequency: 0.7
      },
      metadata: { userId: params.userId }
    });

    // Track participant
    session.participants.set(params.userId, {
      agentId: agent.id,
      userId: params.userId,
      joinedAt: Date.now(),
      role: params.role || 'creator',
      active: true
    });

    this.userToAgent.set(params.userId, agent.id);

    this.emit('session:joined', {
      sessionId: params.sessionId,
      userId: params.userId,
      agentId: agent.id
    });

    return { agentId: agent.id, session };
  }

  /**
   * Leave session
   */
  leaveSession(params: { sessionId: string; userId: string }): void {
    const session = this.sessions.get(params.sessionId);
    if (!session) return;

    const participant = session.participants.get(params.userId);
    if (participant) {
      participant.active = false;
      session.coordinator.removeAgent(participant.agentId);
      this.userToAgent.delete(params.userId);

      this.emit('session:left', {
        sessionId: params.sessionId,
        userId: params.userId
      });
    }
  }

  /**
   * Get what agent senses in environment
   */
  sense(params: {
    sessionId: string;
    userId: string;
  }): SensoryInput {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.get(params.userId);
    if (!participant) throw new Error('Not in session');

    const agent = session.coordinator.getAgent(participant.agentId);
    if (!agent) throw new Error('Agent not found');

    // Get pheromone sensing
    const pheromones = session.coordinator.getPheromoneManager();
    const sensing = pheromones.sense(agent.position);

    // Get nearby agents
    const nearbyAgents = session.coordinator
      .getNearbyAgents(agent.position, 5.0)
      .filter(a => a.id !== agent.id)
      .map(a => ({
        id: a.id,
        name: a.name,
        distance: this.distance(agent.position, a.position),
        state: a.state
      }));

    // Convert gradients to trails
    const nearbyTrails: SensoryInput['nearbyTrails'] = [];
    sensing.gradients.forEach((gradient, type) => {
      const magnitude = Math.sqrt(gradient.dx ** 2 + gradient.dy ** 2);
      if (magnitude > 0.1) {
        nearbyTrails.push({
          type,
          strength: magnitude,
          direction: {
            dx: gradient.dx / magnitude,
            dy: gradient.dy / magnitude
          }
        });
      }
    });

    // Get convergence points with agent counts
    const convergencePoints = sensing.convergencePoints.map(point => {
      const nearbyAtPoint = session.coordinator.getNearbyAgents(point, 2.0);
      return {
        ...point,
        agentCount: nearbyAtPoint.length
      };
    });

    // Generate AI suggestions
    const suggestions = this.generateSuggestions(agent, sensing, nearbyAgents);

    return {
      nearbyAgents,
      nearbyTrails,
      convergencePoints,
      suggestions
    };
  }

  /**
   * Deposit pheromone at current location
   */
  deposit(params: {
    sessionId: string;
    userId: string;
    type: PheromoneType;
    strength?: number;
    context?: string;
    tags?: string[];
  }): ActionResult {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.get(params.userId);
    if (!participant) throw new Error('Not in session');

    const agent = session.coordinator.getAgent(participant.agentId);
    if (!agent) throw new Error('Agent not found');

    const deposit = session.coordinator.getPheromoneManager().deposit({
      type: params.type,
      position: agent.position,
      strength: params.strength || 1.0,
      depositor: agent.id,
      context: params.context,
      tags: params.tags
    });

    this.emit('deposit:created', {
      sessionId: params.sessionId,
      userId: params.userId,
      deposit
    });

    return {
      success: true,
      newState: agent.state,
      depositsCreated: [deposit.id],
      message: `Deposited ${params.type} pheromone`
    };
  }

  /**
   * Move agent to new position
   */
  move(params: {
    sessionId: string;
    userId: string;
    target: { x: number; y: number };
  }): ActionResult {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.get(params.userId);
    if (!participant) throw new Error('Not in session');

    const agent = session.coordinator.getAgent(participant.agentId);
    if (!agent) throw new Error('Agent not found');

    agent.position = params.target;

    this.emit('agent:moved', {
      sessionId: params.sessionId,
      userId: params.userId,
      position: params.target
    });

    return {
      success: true,
      newState: agent.state,
      depositsCreated: [],
      message: `Moved to (${params.target.x}, ${params.target.y})`
    };
  }

  /**
   * Follow a trail
   */
  followTrail(params: {
    sessionId: string;
    userId: string;
    type: PheromoneType;
    steps?: number;
  }): ActionResult {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.get(params.userId);
    if (!participant) throw new Error('Not in session');

    const agent = session.coordinator.getAgent(participant.agentId);
    if (!agent) throw new Error('Agent not found');

    const pheromones = session.coordinator.getPheromoneManager();
    const steps = params.steps || 1;
    const deposits: string[] = [];

    for (let i = 0; i < steps; i++) {
      const nextPos = pheromones.followTrail(agent.position, params.type);
      if (!nextPos) {
        return {
          success: false,
          newState: agent.state,
          depositsCreated: deposits,
          message: `Trail lost after ${i} steps`
        };
      }

      agent.position = nextPos;
      agent.state = AgentState.FOLLOWING;

      // Leave breadcrumb
      const deposit = pheromones.deposit({
        type: PheromoneType.INTEREST,
        position: agent.position,
        strength: 0.5,
        depositor: agent.id,
        context: `Following ${params.type} trail`
      });
      deposits.push(deposit.id);
    }

    return {
      success: true,
      newState: agent.state,
      depositsCreated: deposits,
      message: `Followed ${params.type} trail for ${steps} steps`
    };
  }

  /**
   * Request help at current location
   */
  requestHelp(params: {
    sessionId: string;
    userId: string;
    context: string;
  }): ActionResult {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.get(params.userId);
    if (!participant) throw new Error('Not in session');

    const agent = session.coordinator.getAgent(participant.agentId);
    if (!agent) throw new Error('Agent not found');

    agent.state = AgentState.QUESTIONING;

    const deposit = session.coordinator.getPheromoneManager().deposit({
      type: PheromoneType.QUESTION,
      position: agent.position,
      strength: 1.0,
      depositor: agent.id,
      context: params.context
    });

    this.emit('help:requested', {
      sessionId: params.sessionId,
      userId: params.userId,
      context: params.context,
      position: agent.position
    });

    return {
      success: true,
      newState: agent.state,
      depositsCreated: [deposit.id],
      message: 'Help requested - nearby creators will be notified'
    };
  }

  /**
   * Get activity feed for session
   */
  getActivityFeed(params: {
    sessionId: string;
    limit?: number;
  }): ActivityFeed {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const events = session.coordinator.getEvents(params.limit || 50);
    const patterns = session.detector.getPatterns();
    const metrics = session.detector.analyze();

    return { events, patterns, metrics };
  }

  /**
   * Tick simulation forward
   */
  tick(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.coordinator.tick();
    session.detector.analyze();

    this.emit('session:tick', { sessionId });
  }

  /**
   * Start auto-ticking for session
   */
  startAutoTick(sessionId: string, intervalMs: number = 1000): NodeJS.Timeout {
    return setInterval(() => {
      this.tick(sessionId);
    }, intervalMs);
  }

  /**
   * Get session visualization data
   */
  visualize(sessionId: string): {
    agents: Array<{ id: string; name: string; x: number; y: number; state: AgentState }>;
    deposits: PheromoneDeposit[];
    emergence: any;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const agents = session.coordinator.getAllAgents().map(a => ({
      id: a.id,
      name: a.name,
      x: a.position.x,
      y: a.position.y,
      state: a.state
    }));

    const deposits = session.coordinator.getPheromoneManager().exportField().deposits;
    const emergence = session.detector.visualize();

    return { agents, deposits, emergence };
  }

  // Private helper methods

  private generateSuggestions(
    agent: Agent,
    sensing: any,
    nearbyAgents: any[]
  ): string[] {
    const suggestions: string[] = [];

    // Suggest following strong trails
    if (sensing.strongestTrail && sensing.strongestTrail.strength > 0.5) {
      suggestions.push(`Strong ${sensing.strongestTrail.type} trail nearby - consider following`);
    }

    // Suggest convergence
    if (sensing.convergencePoints.length > 0) {
      suggestions.push(`${sensing.convergencePoints.length} convergence points detected - collaboration happening`);
    }

    // Suggest helping
    const questionTrails = sensing.nearbyDeposits.filter(
      (d: PheromoneDeposit) => d.type === PheromoneType.QUESTION
    );
    if (questionTrails.length > 0) {
      suggestions.push(`Someone needs help nearby`);
    }

    // Suggest exploring
    if (sensing.nearbyDeposits.length === 0) {
      suggestions.push('Unexplored area - leave some interest trails');
    }

    // Suggest collaborating
    if (nearbyAgents.length >= 2) {
      suggestions.push(`${nearbyAgents.length} creators nearby - potential for collaboration`);
    }

    // State-specific suggestions
    switch (agent.state) {
      case AgentState.EXPLORING:
        suggestions.push('Keep exploring and mark interesting areas');
        break;
      case AgentState.WORKING:
        suggestions.push('Deposit success trails to guide others');
        break;
      case AgentState.QUESTIONING:
        suggestions.push('Waiting for help - others will follow question trails');
        break;
    }

    return suggestions;
  }

  private distance(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
}

/**
 * WebSocket-compatible event stream
 */
export class CollaborationStream extends EventEmitter {
  private api: CollaborationAPI;
  private sessionId: string;

  constructor(api: CollaborationAPI, sessionId: string) {
    super();
    this.api = api;
    this.sessionId = sessionId;

    // Forward API events
    this.api.on('deposit:created', (data) => {
      if (data.sessionId === this.sessionId) {
        this.emit('message', { type: 'deposit', data });
      }
    });

    this.api.on('agent:moved', (data) => {
      if (data.sessionId === this.sessionId) {
        this.emit('message', { type: 'move', data });
      }
    });

    this.api.on('help:requested', (data) => {
      if (data.sessionId === this.sessionId) {
        this.emit('message', { type: 'help', data });
      }
    });

    this.api.on('session:tick', (data) => {
      if (data.sessionId === this.sessionId) {
        this.emit('message', { type: 'tick', data: this.getSnapshot() });
      }
    });
  }

  private getSnapshot(): any {
    return this.api.visualize(this.sessionId);
  }
}
