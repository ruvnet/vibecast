/**
 * ruvector Agent Orchestrator
 * Self-learning AI agent orchestration system for Toyota simulation
 * Handles multi-agent coordination, learning, and optimization
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import PQueue from 'p-queue';
import {
  Agent,
  Task,
  TaskType,
  TaskOutcome,
  LearningEvent,
  SimulationEvent,
  EventType,
} from '../types';
import { ToyotaAgent } from '../core/Agent';

// ============================================================================
// RUVECTOR CONFIGURATION
// ============================================================================

export interface RuvectorConfig {
  maxConcurrentAgents: number;
  learningEnabled: boolean;
  adaptationRate: number;
  memoryConsolidationInterval: number;
  collaborationRadius: number;
  optimizationGoals: OptimizationGoal[];
}

export interface OptimizationGoal {
  name: string;
  metric: string;
  target: number;
  weight: number;
  currentValue: number;
}

// ============================================================================
// LEARNING SYSTEM
// ============================================================================

export interface LearningModel {
  id: string;
  type: 'reinforcement' | 'supervised' | 'unsupervised' | 'transfer';
  domain: string;
  patterns: LearnedPattern[];
  accuracy: number;
  lastUpdated: Date;
}

export interface LearnedPattern {
  id: string;
  condition: string;
  action: string;
  reward: number;
  frequency: number;
  confidence: number;
}

export interface CollectiveIntelligence {
  sharedKnowledge: Map<string, any>;
  emergentBehaviors: string[];
  swarmOptimizations: string[];
  consensusDecisions: Array<{ topic: string; decision: string; support: number }>;
}

// ============================================================================
// ORCHESTRATOR EVENTS
// ============================================================================

export interface OrchestratorEvents {
  'agent:activated': (agent: ToyotaAgent) => void;
  'agent:deactivated': (agent: ToyotaAgent) => void;
  'task:assigned': (task: Task, agent: ToyotaAgent) => void;
  'task:completed': (task: Task, outcome: TaskOutcome) => void;
  'learning:pattern': (pattern: LearnedPattern) => void;
  'swarm:optimization': (description: string, improvement: number) => void;
  'collective:decision': (topic: string, decision: string) => void;
  'simulation:event': (event: SimulationEvent) => void;
}

// ============================================================================
// RUVECTOR AGENT ORCHESTRATOR
// ============================================================================

export class RuvectorAgentOrchestrator extends EventEmitter<OrchestratorEvents> {
  private agents: Map<string, ToyotaAgent> = new Map();
  private activeAgents: Set<string> = new Set();
  private taskQueue: PQueue;
  private learningModels: Map<string, LearningModel> = new Map();
  private collectiveIntelligence: CollectiveIntelligence;
  private config: RuvectorConfig;
  private simulationEvents: SimulationEvent[] = [];
  private globalRewardSignal: number = 0;
  private optimizationHistory: Array<{ timestamp: Date; metric: string; value: number }> = [];

  constructor(config: Partial<RuvectorConfig> = {}) {
    super();

    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents || 1000,
      learningEnabled: config.learningEnabled ?? true,
      adaptationRate: config.adaptationRate || 0.1,
      memoryConsolidationInterval: config.memoryConsolidationInterval || 60000,
      collaborationRadius: config.collaborationRadius || 10,
      optimizationGoals: config.optimizationGoals || this.defaultOptimizationGoals(),
    };

    this.taskQueue = new PQueue({ concurrency: this.config.maxConcurrentAgents });

    this.collectiveIntelligence = {
      sharedKnowledge: new Map(),
      emergentBehaviors: [],
      swarmOptimizations: [],
      consensusDecisions: [],
    };

    this.initializeLearningModels();
  }

  private defaultOptimizationGoals(): OptimizationGoal[] {
    return [
      { name: 'Production Efficiency', metric: 'oee', target: 95, weight: 0.3, currentValue: 85 },
      { name: 'Quality Score', metric: 'firstTimeQuality', target: 99, weight: 0.25, currentValue: 97.5 },
      { name: 'Supply Chain Reliability', metric: 'deliveryScore', target: 98, weight: 0.2, currentValue: 92 },
      { name: 'Employee Satisfaction', metric: 'morale', target: 90, weight: 0.15, currentValue: 75 },
      { name: 'Innovation Index', metric: 'kaizen', target: 100, weight: 0.1, currentValue: 50 },
    ];
  }

  private initializeLearningModels(): void {
    const domains = [
      'production_optimization',
      'quality_prediction',
      'supply_chain_planning',
      'workforce_allocation',
      'maintenance_scheduling',
      'demand_forecasting',
    ];

    for (const domain of domains) {
      this.learningModels.set(domain, {
        id: uuidv4(),
        type: 'reinforcement',
        domain,
        patterns: [],
        accuracy: 0.5,
        lastUpdated: new Date(),
      });
    }
  }

  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================

  registerAgents(agents: ToyotaAgent[]): void {
    console.log(`Registering ${agents.length.toLocaleString()} agents with ruvector orchestrator...`);

    for (const agent of agents) {
      this.agents.set(agent.id, agent);

      // Subscribe to agent events
      agent.on('task:completed', (task, outcome) => {
        this.onAgentTaskCompleted(agent, task, outcome);
      });

      agent.on('learning:occurred', (event) => {
        this.onAgentLearning(agent, event);
      });

      agent.on('kaizen:proposed', (improvement) => {
        this.onKaizenProposed(agent, improvement);
      });
    }

    console.log(`Registered ${this.agents.size.toLocaleString()} agents`);
  }

  async activateAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.activeAgents.add(agentId);
    agent.state.status = 'active';
    this.emit('agent:activated', agent);
  }

  async deactivateAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.activeAgents.delete(agentId);
    agent.state.status = 'offline';
    this.emit('agent:deactivated', agent);
  }

  async activateAgentsByType(type: string, count: number): Promise<ToyotaAgent[]> {
    const eligibleAgents = Array.from(this.agents.values())
      .filter(a => a.type === type && !this.activeAgents.has(a.id))
      .slice(0, count);

    for (const agent of eligibleAgents) {
      await this.activateAgent(agent.id);
    }

    return eligibleAgents;
  }

  // ============================================================================
  // TASK MANAGEMENT
  // ============================================================================

  async assignTask(task: Task): Promise<TaskOutcome | null> {
    // Find best agent for task
    const agent = this.findOptimalAgent(task);
    if (!agent) {
      console.log(`No suitable agent found for task: ${task.name}`);
      return null;
    }

    task.assignedTo = [agent.id];
    this.emit('task:assigned', task, agent);

    // Queue task execution
    return this.taskQueue.add(async () => {
      const outcome = await agent.executeTask(task);
      this.emit('task:completed', task, outcome);
      return outcome;
    });
  }

  async assignTaskBatch(tasks: Task[]): Promise<Map<string, TaskOutcome>> {
    const results = new Map<string, TaskOutcome>();

    const promises = tasks.map(async (task) => {
      const outcome = await this.assignTask(task);
      if (outcome) {
        results.set(task.id, outcome);
      }
    });

    await Promise.all(promises);
    return results;
  }

  private findOptimalAgent(task: Task): ToyotaAgent | null {
    const candidates = Array.from(this.agents.values())
      .filter(a =>
        a.state.status === 'active' || a.state.status === 'idle'
      )
      .slice(0, 1000); // Limit search for performance

    if (candidates.length === 0) return null;

    // Score each candidate
    const scored = candidates.map(agent => ({
      agent,
      score: this.calculateAgentFitScore(agent, task),
    }));

    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.agent || null;
  }

  private calculateAgentFitScore(agent: ToyotaAgent, task: Task): number {
    let score = 0;

    // Skill match
    const relevantSkills = agent.skills.filter(s =>
      task.type.includes(s.name) || s.category === 'technical'
    );
    score += relevantSkills.length * 10;

    // Skill level
    if (relevantSkills.length > 0) {
      const avgLevel = relevantSkills.reduce((sum, s) => sum + s.level, 0) / relevantSkills.length;
      score += avgLevel * 0.5;
    }

    // Energy and morale
    score += (agent.state.energy / 100) * 20;
    score += (agent.state.morale / 100) * 15;

    // Stress penalty
    score -= (agent.state.stress / 100) * 10;

    // Performance history
    score += agent.performance.productivity * 0.3;
    score += agent.performance.quality * 0.3;

    // Learning rate bonus
    score += agent.learningRate * 10;

    return score;
  }

  // ============================================================================
  // COLLECTIVE LEARNING
  // ============================================================================

  private onAgentTaskCompleted(agent: ToyotaAgent, task: Task, outcome: TaskOutcome): void {
    if (!this.config.learningEnabled) return;

    // Update global reward signal
    this.globalRewardSignal = outcome.success ? 0.1 : -0.05;

    // Extract pattern
    const pattern: LearnedPattern = {
      id: uuidv4(),
      condition: `${agent.type}_${task.type}`,
      action: task.description.slice(0, 50),
      reward: outcome.success ? 1 : 0,
      frequency: 1,
      confidence: outcome.success ? 0.7 : 0.3,
    };

    // Update learning model
    const model = this.learningModels.get('production_optimization');
    if (model) {
      this.updateLearningModel(model, pattern);
    }

    // Share with collective intelligence
    this.shareKnowledge(agent, pattern);
  }

  private onAgentLearning(agent: ToyotaAgent, event: LearningEvent): void {
    // Propagate learning to related agents
    const relatedAgents = this.findRelatedAgents(agent, this.config.collaborationRadius);

    for (const relatedAgent of relatedAgents) {
      // Transfer learning with decay
      const transferRate = this.config.adaptationRate * 0.5;
      relatedAgent.learningRate = Math.min(1, relatedAgent.learningRate + transferRate * 0.1);
    }
  }

  private onKaizenProposed(agent: ToyotaAgent, improvement: string): void {
    // Add to collective intelligence
    this.collectiveIntelligence.swarmOptimizations.push(improvement);

    // Create consensus decision
    this.collectiveIntelligence.consensusDecisions.push({
      topic: improvement,
      decision: 'pending_evaluation',
      support: 1,
    });

    // Record simulation event
    this.recordEvent({
      type: 'kaizen_improvement',
      source: agent.id,
      target: null,
      description: improvement,
      data: { agentName: agent.name, department: agent.department },
      importance: 'medium',
    });
  }

  private updateLearningModel(model: LearningModel, pattern: LearnedPattern): void {
    // Find existing pattern or add new
    const existing = model.patterns.find(p => p.condition === pattern.condition);

    if (existing) {
      // Update existing pattern
      existing.frequency++;
      existing.reward = (existing.reward * (existing.frequency - 1) + pattern.reward) / existing.frequency;
      existing.confidence = Math.min(1, existing.confidence + 0.05 * (pattern.reward > 0 ? 1 : -1));
    } else {
      model.patterns.push(pattern);
    }

    // Update model accuracy
    const successPatterns = model.patterns.filter(p => p.reward > 0.5);
    model.accuracy = successPatterns.length / Math.max(model.patterns.length, 1);
    model.lastUpdated = new Date();

    this.emit('learning:pattern', pattern);
  }

  private shareKnowledge(agent: ToyotaAgent, pattern: LearnedPattern): void {
    const key = `${pattern.condition}_${pattern.action}`;
    const existing = this.collectiveIntelligence.sharedKnowledge.get(key);

    if (existing) {
      existing.frequency++;
      existing.avgReward = (existing.avgReward * (existing.frequency - 1) + pattern.reward) / existing.frequency;
    } else {
      this.collectiveIntelligence.sharedKnowledge.set(key, {
        pattern: key,
        frequency: 1,
        avgReward: pattern.reward,
        contributors: [agent.id],
      });
    }
  }

  private findRelatedAgents(agent: ToyotaAgent, radius: number): ToyotaAgent[] {
    return Array.from(this.agents.values())
      .filter(a =>
        a.id !== agent.id &&
        (a.department === agent.department || a.type === agent.type)
      )
      .slice(0, radius);
  }

  // ============================================================================
  // SWARM OPTIMIZATION
  // ============================================================================

  async runSwarmOptimization(): Promise<void> {
    console.log('Running swarm optimization...');

    // Gather agent experiences
    const experiences = this.gatherCollectiveExperiences();

    // Identify emergent behaviors
    this.identifyEmergentBehaviors(experiences);

    // Optimize global parameters
    await this.optimizeGlobalParameters();

    // Propagate improvements
    await this.propagateImprovements();
  }

  private gatherCollectiveExperiences(): Map<string, number> {
    const experiences = new Map<string, number>();

    for (const agent of this.agents.values()) {
      // Aggregate performance metrics
      experiences.set(
        `productivity_${agent.type}`,
        (experiences.get(`productivity_${agent.type}`) || 0) + agent.performance.productivity
      );

      experiences.set(
        `quality_${agent.department}`,
        (experiences.get(`quality_${agent.department}`) || 0) + agent.performance.quality
      );
    }

    return experiences;
  }

  private identifyEmergentBehaviors(experiences: Map<string, number>): void {
    // Look for patterns in collective behavior
    const behaviors: string[] = [];

    // Check for high-performance clusters
    for (const [key, value] of experiences) {
      const avgValue = value / this.agents.size;
      if (avgValue > 85) {
        behaviors.push(`High ${key.replace('_', ' ')} detected`);
      }
    }

    // Check for collaboration patterns
    const collaborationPatterns = Array.from(this.agents.values())
      .filter(a => a.relationships.length > 5)
      .length;

    if (collaborationPatterns > this.agents.size * 0.1) {
      behaviors.push('Strong collaboration network emerged');
    }

    this.collectiveIntelligence.emergentBehaviors = behaviors;
  }

  private async optimizeGlobalParameters(): Promise<void> {
    for (const goal of this.config.optimizationGoals) {
      const improvement = (goal.target - goal.currentValue) * this.config.adaptationRate;
      goal.currentValue = Math.min(goal.target, goal.currentValue + improvement);

      this.optimizationHistory.push({
        timestamp: new Date(),
        metric: goal.metric,
        value: goal.currentValue,
      });
    }
  }

  private async propagateImprovements(): Promise<void> {
    // Apply learned improvements to agents
    const topPatterns = Array.from(this.learningModels.values())
      .flatMap(m => m.patterns)
      .filter(p => p.confidence > 0.7)
      .sort((a, b) => b.reward - a.reward)
      .slice(0, 10);

    for (const pattern of topPatterns) {
      // Teach to relevant agents
      const [agentType, taskType] = pattern.condition.split('_');
      const relevantAgents = Array.from(this.agents.values())
        .filter(a => a.type === agentType)
        .slice(0, 100);

      for (const agent of relevantAgents) {
        agent.learnAdaptationRule(pattern.condition, pattern.action, pattern.reward > 0.5);
      }
    }

    this.emit('swarm:optimization', 'Pattern propagation complete', topPatterns.length);
  }

  // ============================================================================
  // SIMULATION EVENTS
  // ============================================================================

  private recordEvent(event: Omit<SimulationEvent, 'id' | 'tick' | 'timestamp'>): void {
    const simEvent: SimulationEvent = {
      id: uuidv4(),
      tick: Date.now(),
      timestamp: new Date(),
      ...event,
    };

    this.simulationEvents.push(simEvent);
    this.emit('simulation:event', simEvent);

    // Keep events limited
    if (this.simulationEvents.length > 10000) {
      this.simulationEvents = this.simulationEvents.slice(-5000);
    }
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  getOrchestratorMetrics(): object {
    const activeCount = this.activeAgents.size;
    const totalAgents = this.agents.size;

    return {
      orchestrator: {
        totalAgents: totalAgents.toLocaleString(),
        activeAgents: activeCount.toLocaleString(),
        utilizationRate: ((activeCount / totalAgents) * 100).toFixed(1) + '%',
        queueSize: this.taskQueue.size,
        pendingTasks: this.taskQueue.pending,
      },
      learning: {
        modelsActive: this.learningModels.size,
        totalPatterns: Array.from(this.learningModels.values())
          .reduce((sum, m) => sum + m.patterns.length, 0),
        avgAccuracy: (
          Array.from(this.learningModels.values())
            .reduce((sum, m) => sum + m.accuracy, 0) / this.learningModels.size * 100
        ).toFixed(1) + '%',
        globalReward: this.globalRewardSignal.toFixed(3),
      },
      collectiveIntelligence: {
        sharedKnowledge: this.collectiveIntelligence.sharedKnowledge.size,
        emergentBehaviors: this.collectiveIntelligence.emergentBehaviors.length,
        swarmOptimizations: this.collectiveIntelligence.swarmOptimizations.length,
        consensusDecisions: this.collectiveIntelligence.consensusDecisions.length,
      },
      optimizationGoals: this.config.optimizationGoals.map(g => ({
        name: g.name,
        current: g.currentValue.toFixed(1),
        target: g.target,
        progress: ((g.currentValue / g.target) * 100).toFixed(1) + '%',
      })),
      recentEvents: this.simulationEvents.slice(-10).map(e => ({
        type: e.type,
        description: e.description,
        importance: e.importance,
      })),
    };
  }

  getAgents(): ToyotaAgent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgentCount(): number {
    return this.activeAgents.size;
  }
}
