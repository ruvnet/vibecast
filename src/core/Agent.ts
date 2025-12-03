/**
 * Toyota Simulation - Core Agent Class
 * Self-learning agent with memory, adaptation, and continuous improvement
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import {
  Agent,
  AgentType,
  AgentState,
  Department,
  Location,
  Skill,
  Relationship,
  Memory,
  MemoryItem,
  Episode,
  KnowledgeGraph,
  Procedure,
  Task,
  TaskOutcome,
  PerformanceMetrics,
  LearningEvent,
  LearningType,
  AdaptationRule,
} from '../types';

export interface AgentEvents {
  'task:started': (task: Task) => void;
  'task:completed': (task: Task, outcome: TaskOutcome) => void;
  'task:failed': (task: Task, reason: string) => void;
  'learning:occurred': (event: LearningEvent) => void;
  'state:changed': (oldState: AgentState, newState: AgentState) => void;
  'collaboration:started': (partnerId: string) => void;
  'kaizen:proposed': (improvement: string) => void;
}

export class ToyotaAgent extends EventEmitter<AgentEvents> implements Agent {
  id: string;
  name: string;
  type: AgentType;
  role: string;
  department: Department;
  location: Location;
  skills: Skill[];
  relationships: Relationship[];
  memory: Memory;
  state: AgentState;
  learningRate: number;
  performance: PerformanceMetrics;
  createdAt: Date;
  lastActiveAt: Date;

  private adaptationRules: AdaptationRule[] = [];
  private decisionHistory: Array<{ context: string; decision: string; outcome: number }> = [];
  private kaizenSuggestions: string[] = [];

  constructor(config: Partial<Agent> & { name: string; type: AgentType; department: Department }) {
    super();

    this.id = config.id || uuidv4();
    this.name = config.name;
    this.type = config.type;
    this.role = config.role || this.deriveRole(config.type);
    this.department = config.department;
    this.location = config.location || this.createDefaultLocation();
    this.skills = config.skills || this.initializeSkills(config.type);
    this.relationships = config.relationships || [];
    this.memory = config.memory || this.initializeMemory();
    this.state = config.state || this.initializeState();
    this.learningRate = config.learningRate || 0.1 + Math.random() * 0.2;
    this.performance = config.performance || this.initializePerformance();
    this.createdAt = config.createdAt || new Date();
    this.lastActiveAt = config.lastActiveAt || new Date();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private deriveRole(type: AgentType): string {
    const roleMap: Record<AgentType, string> = {
      executive: 'Senior Executive',
      manager: 'Department Manager',
      engineer: 'Technical Engineer',
      designer: 'Product Designer',
      production_worker: 'Production Associate',
      quality_inspector: 'Quality Assurance Specialist',
      logistics_coordinator: 'Logistics Coordinator',
      sales_representative: 'Sales Representative',
      customer_service: 'Customer Service Representative',
      research_scientist: 'Research Scientist',
      supplier_liaison: 'Supplier Relations Manager',
      hr_specialist: 'Human Resources Specialist',
      finance_analyst: 'Financial Analyst',
      it_specialist: 'IT Specialist',
      maintenance_technician: 'Maintenance Technician',
    };
    return roleMap[type] || 'Team Member';
  }

  private createDefaultLocation(): Location {
    return {
      id: 'toyota-city-hq',
      name: 'Toyota City Headquarters',
      type: 'headquarters',
      country: 'Japan',
      region: 'Chubu',
      city: 'Toyota City',
      coordinates: { lat: 35.0833, lng: 137.1500 },
      capacity: 50000,
      currentOccupancy: 35000,
      facilities: [],
    };
  }

  private initializeSkills(type: AgentType): Skill[] {
    const baseSkills: Partial<Record<AgentType, string[]>> = {
      executive: ['strategic_planning', 'leadership', 'decision_making', 'vision'],
      manager: ['team_leadership', 'project_management', 'communication', 'problem_solving'],
      engineer: ['technical_design', 'cad_cam', 'testing', 'innovation'],
      designer: ['industrial_design', 'user_experience', 'sketching', 'modeling'],
      production_worker: ['assembly', 'quality_control', 'safety', 'efficiency'],
      quality_inspector: ['inspection', 'measurement', 'documentation', 'standards'],
      logistics_coordinator: ['planning', 'coordination', 'inventory', 'jit'],
      research_scientist: ['research', 'analysis', 'experimentation', 'innovation'],
    };

    const skillNames = baseSkills[type] || ['general', 'teamwork', 'communication'];

    return skillNames.map(name => ({
      id: uuidv4(),
      name,
      category: 'technical',
      level: 50 + Math.random() * 30,
      experience: 1 + Math.random() * 10,
      certifications: [],
      lastUsed: new Date(),
    }));
  }

  private initializeMemory(): Memory {
    return {
      shortTerm: [],
      longTerm: [],
      episodic: [],
      semantic: { nodes: [], edges: [] },
      procedural: [],
    };
  }

  private initializeState(): AgentState {
    return {
      status: 'idle',
      currentTask: null,
      energy: 80 + Math.random() * 20,
      morale: 70 + Math.random() * 20,
      stress: 10 + Math.random() * 20,
      expertise: new Map(),
    };
  }

  private initializePerformance(): PerformanceMetrics {
    return {
      productivity: 70 + Math.random() * 20,
      quality: 75 + Math.random() * 20,
      efficiency: 70 + Math.random() * 20,
      collaboration: 65 + Math.random() * 25,
      innovation: 50 + Math.random() * 30,
      learning: 60 + Math.random() * 30,
      attendance: 90 + Math.random() * 10,
      safetyRecord: 95 + Math.random() * 5,
    };
  }

  // ============================================================================
  // TASK EXECUTION
  // ============================================================================

  async executeTask(task: Task): Promise<TaskOutcome> {
    const oldState = { ...this.state };
    this.state.status = 'busy';
    this.state.currentTask = task;
    this.emit('state:changed', oldState, this.state);
    this.emit('task:started', task);

    // Record start in memory
    this.addToShortTermMemory({
      content: `Started task: ${task.name}`,
      type: 'observation',
      importance: 0.6,
    });

    try {
      // Simulate task execution with skill-based success
      const successProbability = this.calculateSuccessProbability(task);
      const executionTime = this.estimateExecutionTime(task);

      // Apply adaptation rules
      const applicableRules = this.findApplicableRules(task);
      for (const rule of applicableRules) {
        this.applyAdaptationRule(rule);
      }

      // Simulate work (in real simulation, this would be event-driven)
      await this.simulateWork(executionTime);

      // Determine outcome
      const success = Math.random() < successProbability;
      const outcome: TaskOutcome = {
        success,
        results: {
          qualityScore: success ? 70 + Math.random() * 30 : 40 + Math.random() * 30,
          efficiency: this.performance.efficiency,
          timeSpent: executionTime,
        },
        lessonsLearned: [],
        improvements: [],
      };

      // Learn from outcome
      await this.learnFromOutcome(task, outcome);

      // Update state
      this.state.status = 'idle';
      this.state.currentTask = null;
      this.lastActiveAt = new Date();

      // Update performance
      this.updatePerformance(outcome);

      this.emit('task:completed', task, outcome);
      return outcome;
    } catch (error) {
      this.state.status = 'idle';
      this.state.currentTask = null;
      this.emit('task:failed', task, String(error));
      throw error;
    }
  }

  private calculateSuccessProbability(task: Task): number {
    // Base probability based on agent type matching task
    let probability = 0.7;

    // Adjust for relevant skills
    const relevantSkills = this.skills.filter(s =>
      task.type.includes(s.name) || s.category === 'technical'
    );

    if (relevantSkills.length > 0) {
      const avgSkillLevel = relevantSkills.reduce((sum, s) => sum + s.level, 0) / relevantSkills.length;
      probability += (avgSkillLevel - 50) / 200; // +/- 0.25 based on skills
    }

    // Adjust for energy and morale
    probability *= (this.state.energy / 100) * 0.3 + 0.7;
    probability *= (this.state.morale / 100) * 0.2 + 0.8;

    // Adjust for stress (negative impact)
    probability *= 1 - (this.state.stress / 100) * 0.2;

    // Past experience with similar tasks
    const similarExperience = this.memory.episodic.filter(e =>
      e.description.includes(task.type)
    );
    if (similarExperience.length > 0) {
      const avgValence = similarExperience.reduce((sum, e) => sum + e.emotionalValence, 0) / similarExperience.length;
      probability += avgValence * 0.1;
    }

    return Math.max(0.1, Math.min(0.99, probability));
  }

  private estimateExecutionTime(task: Task): number {
    let baseTime = task.estimatedDuration;

    // Adjust for efficiency
    baseTime *= (200 - this.performance.efficiency) / 100;

    // Adjust for experience with similar procedures
    const relevantProcedures = this.memory.procedural.filter(p =>
      p.name.includes(task.type)
    );
    if (relevantProcedures.length > 0) {
      const avgSuccessRate = relevantProcedures.reduce((sum, p) => sum + p.successRate, 0) / relevantProcedures.length;
      baseTime *= 1 - (avgSuccessRate * 0.3);
    }

    return Math.max(0.5, baseTime);
  }

  private async simulateWork(hours: number): Promise<void> {
    // In real simulation, this would be replaced with actual async work
    // For now, just update energy
    this.state.energy = Math.max(0, this.state.energy - hours * 2);

    // Small chance of kaizen insight during work
    if (Math.random() < 0.05) {
      await this.generateKaizenInsight();
    }
  }

  // ============================================================================
  // LEARNING SYSTEM
  // ============================================================================

  private async learnFromOutcome(task: Task, outcome: TaskOutcome): Promise<void> {
    const learningEvent: LearningEvent = {
      id: uuidv4(),
      agentId: this.id,
      type: outcome.success ? 'success_reinforcement' : 'failure_analysis',
      topic: task.type,
      source: 'experience',
      outcome: outcome.success ? 0.1 : -0.05,
      timestamp: new Date(),
      reinforcement: outcome.success ? 1 : 0.5,
    };

    // Update skills based on outcome
    this.updateSkillsFromLearning(task, outcome);

    // Add to episodic memory
    this.addEpisode({
      description: `${task.name}: ${outcome.success ? 'Success' : 'Failure'}`,
      participants: task.assignedTo,
      outcome: JSON.stringify(outcome.results),
      lessonsLearned: outcome.lessonsLearned,
      emotionalValence: outcome.success ? 0.3 : -0.2,
    });

    // Create or update adaptation rules
    if (outcome.success) {
      await this.reinforceSuccessfulPattern(task, outcome);
    } else {
      await this.analyzeFailure(task, outcome);
    }

    // Consolidate memory if needed
    this.consolidateMemory();

    this.emit('learning:occurred', learningEvent);
  }

  private updateSkillsFromLearning(task: Task, outcome: TaskOutcome): void {
    const improvementRate = outcome.success ? this.learningRate : this.learningRate * 0.3;

    this.skills.forEach(skill => {
      if (task.type.includes(skill.name) || skill.category === 'technical') {
        skill.level = Math.min(100, skill.level + improvementRate * 10);
        skill.lastUsed = new Date();
      }
    });
  }

  private async reinforceSuccessfulPattern(task: Task, outcome: TaskOutcome): void {
    // Find or create relevant procedure
    let procedure = this.memory.procedural.find(p => p.name === task.type);

    if (procedure) {
      procedure.successRate = (procedure.successRate * procedure.executionCount + 1) / (procedure.executionCount + 1);
      procedure.executionCount++;
    } else {
      procedure = {
        id: uuidv4(),
        name: task.type,
        steps: [task.description],
        successRate: 1,
        executionCount: 1,
      };
      this.memory.procedural.push(procedure);
    }

    // Record successful decision pattern
    this.decisionHistory.push({
      context: task.type,
      decision: task.description,
      outcome: 1,
    });
  }

  private async analyzeFailure(task: Task, outcome: TaskOutcome): void {
    // Learn from failure
    const failureAnalysis = `Failed ${task.type}: Investigate causes`;

    outcome.lessonsLearned.push(failureAnalysis);

    // Add to knowledge graph
    this.memory.semantic.nodes.push({
      id: uuidv4(),
      concept: `failure_pattern_${task.type}`,
      type: 'fact',
      confidence: 0.7,
      lastUpdated: new Date(),
    });

    // Record failed decision pattern
    this.decisionHistory.push({
      context: task.type,
      decision: task.description,
      outcome: 0,
    });
  }

  async generateKaizenInsight(): Promise<void> {
    // Generate continuous improvement suggestion based on experience
    const recentFailures = this.memory.episodic.filter(e =>
      e.emotionalValence < 0 &&
      Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (recentFailures.length > 0) {
      const insight = `Kaizen: Improve ${recentFailures[0].description.split(':')[0]} process`;
      this.kaizenSuggestions.push(insight);
      this.emit('kaizen:proposed', insight);
    }
  }

  // ============================================================================
  // MEMORY MANAGEMENT
  // ============================================================================

  addToShortTermMemory(item: Omit<MemoryItem, 'id' | 'timestamp' | 'associations' | 'reinforcement'>): void {
    const memoryItem: MemoryItem = {
      id: uuidv4(),
      ...item,
      timestamp: new Date(),
      associations: [],
      reinforcement: 1,
    };

    this.memory.shortTerm.push(memoryItem);

    // Keep short-term memory limited
    if (this.memory.shortTerm.length > 20) {
      this.consolidateShortTermMemory();
    }
  }

  private addEpisode(episode: Omit<Episode, 'id' | 'timestamp'>): void {
    this.memory.episodic.push({
      id: uuidv4(),
      ...episode,
      timestamp: new Date(),
    });

    // Keep episodic memory limited
    if (this.memory.episodic.length > 100) {
      this.memory.episodic = this.memory.episodic
        .sort((a, b) => Math.abs(b.emotionalValence) - Math.abs(a.emotionalValence))
        .slice(0, 100);
    }
  }

  private consolidateShortTermMemory(): void {
    // Move important items to long-term memory
    const importantItems = this.memory.shortTerm.filter(item => item.importance > 0.7);
    this.memory.longTerm.push(...importantItems);

    // Clear short-term memory
    this.memory.shortTerm = this.memory.shortTerm.slice(-5);
  }

  private consolidateMemory(): void {
    // Consolidate short-term to long-term
    this.consolidateShortTermMemory();

    // Decay old long-term memories
    this.memory.longTerm = this.memory.longTerm
      .map(item => ({
        ...item,
        reinforcement: item.reinforcement * 0.99,
      }))
      .filter(item => item.reinforcement > 0.1);

    // Update semantic knowledge confidence
    this.memory.semantic.nodes = this.memory.semantic.nodes.map(node => ({
      ...node,
      confidence: Math.min(1, node.confidence + 0.01),
    }));
  }

  // ============================================================================
  // ADAPTATION RULES
  // ============================================================================

  private findApplicableRules(task: Task): AdaptationRule[] {
    return this.adaptationRules.filter(rule =>
      task.type.includes(rule.condition) && rule.confidence > 0.5
    );
  }

  private applyAdaptationRule(rule: AdaptationRule): void {
    // Boost performance based on rule
    this.performance.efficiency += rule.successRate * 2;
    rule.usageCount++;
  }

  learnAdaptationRule(condition: string, action: string, success: boolean): void {
    let existingRule = this.adaptationRules.find(r =>
      r.condition === condition && r.action === action
    );

    if (existingRule) {
      existingRule.successRate = (existingRule.successRate * existingRule.usageCount + (success ? 1 : 0)) / (existingRule.usageCount + 1);
      existingRule.usageCount++;
      existingRule.confidence = Math.min(1, existingRule.confidence + (success ? 0.1 : -0.05));
    } else {
      this.adaptationRules.push({
        id: uuidv4(),
        condition,
        action,
        confidence: 0.5,
        successRate: success ? 1 : 0,
        usageCount: 1,
      });
    }
  }

  // ============================================================================
  // COLLABORATION
  // ============================================================================

  async collaborateWith(partner: ToyotaAgent, task: Task): Promise<void> {
    this.emit('collaboration:started', partner.id);

    // Update relationship
    const relationship = this.relationships.find(r => r.targetAgentId === partner.id);
    if (relationship) {
      relationship.collaboration++;
      relationship.lastInteraction = new Date();
      relationship.interactionCount++;
    } else {
      this.relationships.push({
        targetAgentId: partner.id,
        type: 'collaborator',
        strength: 50,
        trust: 50,
        collaboration: 1,
        lastInteraction: new Date(),
        interactionCount: 1,
      });
    }

    // Knowledge transfer
    await this.transferKnowledge(partner);
  }

  private async transferKnowledge(partner: ToyotaAgent): Promise<void> {
    // Share procedural knowledge
    for (const procedure of partner.memory.procedural) {
      if (procedure.successRate > 0.8) {
        const existingProcedure = this.memory.procedural.find(p => p.name === procedure.name);
        if (!existingProcedure) {
          this.memory.procedural.push({ ...procedure, id: uuidv4() });
        } else if (procedure.successRate > existingProcedure.successRate) {
          existingProcedure.successRate = (existingProcedure.successRate + procedure.successRate) / 2;
        }
      }
    }
  }

  // ============================================================================
  // PERFORMANCE & STATE
  // ============================================================================

  private updatePerformance(outcome: TaskOutcome): void {
    if (outcome.success) {
      this.performance.productivity = Math.min(100, this.performance.productivity + 0.5);
      this.performance.quality = Math.min(100, this.performance.quality + 0.3);
      this.state.morale = Math.min(100, this.state.morale + 2);
    } else {
      this.performance.productivity = Math.max(0, this.performance.productivity - 0.2);
      this.state.stress = Math.min(100, this.state.stress + 5);
    }
  }

  rest(): void {
    this.state.energy = Math.min(100, this.state.energy + 20);
    this.state.stress = Math.max(0, this.state.stress - 10);
  }

  getStatus(): object {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      role: this.role,
      department: this.department,
      status: this.state.status,
      energy: this.state.energy.toFixed(1),
      morale: this.state.morale.toFixed(1),
      performance: {
        productivity: this.performance.productivity.toFixed(1),
        quality: this.performance.quality.toFixed(1),
        efficiency: this.performance.efficiency.toFixed(1),
      },
      skills: this.skills.length,
      memories: this.memory.longTerm.length + this.memory.episodic.length,
      relationships: this.relationships.length,
      kaizenSuggestions: this.kaizenSuggestions.length,
    };
  }

  toJSON(): Agent {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      role: this.role,
      department: this.department,
      location: this.location,
      skills: this.skills,
      relationships: this.relationships,
      memory: this.memory,
      state: {
        ...this.state,
        expertise: Object.fromEntries(this.state.expertise) as any,
      },
      learningRate: this.learningRate,
      performance: this.performance,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
    };
  }
}
