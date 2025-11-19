/**
 * Emergence Detection Engine
 *
 * Detects and analyzes emergent structures and behaviors from simple stigmergic rules.
 * Inspired by termite mounds and ant colony optimization.
 */

import { SwarmCoordinator, Agent, SwarmMetrics, SwarmEvent } from './swarm-coordinator';
import { PheromoneManager, PheromoneType, PheromoneDeposit } from './pheromone';

export interface EmergentPattern {
  id: string;
  type: EmergentPatternType;
  confidence: number;        // 0-1, how confident we are this is real
  lifetime: number;          // How long pattern has persisted
  participants: string[];    // Agent IDs involved
  location?: { x: number; y: number };
  radius?: number;
  description: string;
  metrics: Record<string, number>;
}

export enum EmergentPatternType {
  HUB = 'hub',                    // Convergence point - like termite mound
  HIGHWAY = 'highway',            // Trail between hubs
  CLUSTER = 'cluster',            // Agents working together
  OSCILLATION = 'oscillation',    // Cyclic behavior
  DIVISION_OF_LABOR = 'division', // Specialization emerged
  STIGMERGIC_MEMORY = 'memory',   // Environment carries stable pattern
  PHASE_TRANSITION = 'transition' // System-wide state change
}

export interface EmergenceMetrics {
  complexity: number;           // How complex is emergent structure
  selfOrganization: number;     // Degree of self-organization (0-1)
  robustness: number;          // How stable patterns are
  efficiency: number;          // Resource usage efficiency
  novelty: number;             // How unexpected patterns are
  patterns: EmergentPattern[];
}

export interface TemporalAnalysis {
  timeWindow: number;
  patternEvolution: Array<{
    timestamp: number;
    patterns: EmergentPattern[];
    metrics: EmergenceMetrics;
  }>;
  trends: {
    increasingComplexity: boolean;
    convergingBehavior: boolean;
    cycleDetected: boolean;
  };
}

/**
 * Main Emergence Detection Engine
 */
export class EmergenceDetector {
  private coordinator: SwarmCoordinator;
  private detectedPatterns: Map<string, EmergentPattern> = new Map();
  private history: Array<{ timestamp: number; patterns: EmergentPattern[] }> = [];
  private analysisInterval: number = 10; // Analyze every N ticks
  private ticksSinceAnalysis: number = 0;

  constructor(coordinator: SwarmCoordinator) {
    this.coordinator = coordinator;
  }

  /**
   * Analyze current state and detect emergent patterns
   */
  analyze(): EmergenceMetrics {
    this.ticksSinceAnalysis++;

    if (this.ticksSinceAnalysis >= this.analysisInterval) {
      this.detectPatterns();
      this.ticksSinceAnalysis = 0;
    }

    return this.calculateMetrics();
  }

  /**
   * Get all detected patterns
   */
  getPatterns(): EmergentPattern[] {
    return Array.from(this.detectedPatterns.values());
  }

  /**
   * Get patterns of specific type
   */
  getPatternsByType(type: EmergentPatternType): EmergentPattern[] {
    return Array.from(this.detectedPatterns.values())
      .filter(p => p.type === type);
  }

  /**
   * Get temporal analysis of pattern evolution
   */
  getTemporalAnalysis(windowSize: number = 100): TemporalAnalysis {
    const recentHistory = this.history.slice(-windowSize);

    return {
      timeWindow: windowSize,
      patternEvolution: recentHistory.map(h => ({
        timestamp: h.timestamp,
        patterns: h.patterns,
        metrics: this.calculateMetricsForPatterns(h.patterns)
      })),
      trends: this.analyzeTrends(recentHistory)
    };
  }

  /**
   * Visualize emergent structures
   */
  visualize(): {
    hubs: Array<{ x: number; y: number; strength: number; agents: number }>;
    highways: Array<{ start: { x: number; y: number }; end: { x: number; y: number }; traffic: number }>;
    clusters: Array<{ center: { x: number; y: number }; size: number; density: number }>;
    heatmap: number[][];
  } {
    const hubs = this.getPatternsByType(EmergentPatternType.HUB).map(p => ({
      x: p.location!.x,
      y: p.location!.y,
      strength: p.confidence,
      agents: p.participants.length
    }));

    const highways = this.getPatternsByType(EmergentPatternType.HIGHWAY).map(p => ({
      start: p.metrics.startX !== undefined ? { x: p.metrics.startX, y: p.metrics.startY! } : { x: 0, y: 0 },
      end: p.metrics.endX !== undefined ? { x: p.metrics.endX, y: p.metrics.endY! } : { x: 0, y: 0 },
      traffic: p.metrics.traffic || 0
    }));

    const clusters = this.getPatternsByType(EmergentPatternType.CLUSTER).map(p => ({
      center: p.location!,
      size: p.participants.length,
      density: p.metrics.density || 0
    }));

    const heatmap = this.generateHeatmap();

    return { hubs, highways, clusters, heatmap };
  }

  // Private detection methods

  private detectPatterns(): void {
    // Update existing patterns lifetime
    this.detectedPatterns.forEach(pattern => {
      pattern.lifetime++;
    });

    // Detect new patterns
    this.detectHubs();
    this.detectHighways();
    this.detectClusters();
    this.detectOscillations();
    this.detectDivisionOfLabor();
    this.detectStigmergicMemory();
    this.detectPhaseTransitions();

    // Remove patterns that have faded
    this.prunePatterns();

    // Record history
    this.history.push({
      timestamp: Date.now(),
      patterns: Array.from(this.detectedPatterns.values())
    });

    // Limit history size
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }

  private detectHubs(): void {
    const pheromones = this.coordinator.getPheromoneManager();
    const deposits = pheromones.exportField().deposits;

    // Find high-density pheromone areas
    const gridSize = 5;
    const grid = new Map<string, PheromoneDeposit[]>();

    deposits.forEach(deposit => {
      const key = `${Math.floor(deposit.position.x / gridSize)},${Math.floor(deposit.position.y / gridSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(deposit);
    });

    // Identify hubs
    grid.forEach((cellDeposits, key) => {
      if (cellDeposits.length >= 5) {
        const uniqueAgents = new Set(cellDeposits.map(d => d.depositor));
        const totalStrength = cellDeposits.reduce((sum, d) => sum + d.strength, 0);

        if (uniqueAgents.size >= 2 && totalStrength >= 3.0) {
          const avgX = cellDeposits.reduce((sum, d) => sum + d.position.x, 0) / cellDeposits.length;
          const avgY = cellDeposits.reduce((sum, d) => sum + d.position.y, 0) / cellDeposits.length;

          const patternId = `hub-${Math.floor(avgX)}-${Math.floor(avgY)}`;
          const existing = this.detectedPatterns.get(patternId);

          this.detectedPatterns.set(patternId, {
            id: patternId,
            type: EmergentPatternType.HUB,
            confidence: Math.min(totalStrength / 10, 1.0),
            lifetime: existing ? existing.lifetime + 1 : 1,
            participants: Array.from(uniqueAgents),
            location: { x: avgX, y: avgY },
            radius: Math.sqrt(cellDeposits.length) * gridSize,
            description: `Convergence hub with ${uniqueAgents.size} agents`,
            metrics: {
              strength: totalStrength,
              agentCount: uniqueAgents.size,
              density: cellDeposits.length / (gridSize * gridSize)
            }
          });
        }
      }
    });
  }

  private detectHighways(): void {
    const hubs = this.getPatternsByType(EmergentPatternType.HUB);
    const pheromones = this.coordinator.getPheromoneManager();

    // Look for trails connecting hubs
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        const hubA = hubs[i];
        const hubB = hubs[j];

        if (!hubA.location || !hubB.location) continue;

        // Sample points between hubs
        const samples = 10;
        let trailStrength = 0;

        for (let s = 0; s <= samples; s++) {
          const t = s / samples;
          const x = hubA.location.x + (hubB.location.x - hubA.location.x) * t;
          const y = hubA.location.y + (hubB.location.y - hubA.location.y) * t;

          const sensing = pheromones.sense({ x, y }, 2.0);
          trailStrength += sensing.nearbyDeposits.reduce((sum, d) => sum + d.strength, 0);
        }

        if (trailStrength > 5.0) {
          const patternId = `highway-${hubA.id}-${hubB.id}`;
          const existing = this.detectedPatterns.get(patternId);

          this.detectedPatterns.set(patternId, {
            id: patternId,
            type: EmergentPatternType.HIGHWAY,
            confidence: Math.min(trailStrength / 20, 1.0),
            lifetime: existing ? existing.lifetime + 1 : 1,
            participants: [...new Set([...hubA.participants, ...hubB.participants])],
            description: `Highway connecting ${hubA.id} and ${hubB.id}`,
            metrics: {
              startX: hubA.location.x,
              startY: hubA.location.y,
              endX: hubB.location.x,
              endY: hubB.location.y,
              traffic: trailStrength,
              length: this.distance(hubA.location, hubB.location)
            }
          });
        }
      }
    }
  }

  private detectClusters(): void {
    const agents = this.coordinator.getAllAgents();
    const processed = new Set<string>();
    const clusterRadius = 4.0;

    agents.forEach(agent => {
      if (processed.has(agent.id)) return;

      const nearby = agents.filter(a =>
        !processed.has(a.id) &&
        this.distance(agent.position, a.position) <= clusterRadius
      );

      if (nearby.length >= 3) {
        const avgX = nearby.reduce((sum, a) => sum + a.position.x, 0) / nearby.length;
        const avgY = nearby.reduce((sum, a) => sum + a.position.y, 0) / nearby.length;

        const patternId = `cluster-${Math.floor(avgX)}-${Math.floor(avgY)}`;
        const existing = this.detectedPatterns.get(patternId);

        // Calculate density
        const area = Math.PI * clusterRadius * clusterRadius;
        const density = nearby.length / area;

        this.detectedPatterns.set(patternId, {
          id: patternId,
          type: EmergentPatternType.CLUSTER,
          confidence: Math.min(nearby.length / 10, 1.0),
          lifetime: existing ? existing.lifetime + 1 : 1,
          participants: nearby.map(a => a.id),
          location: { x: avgX, y: avgY },
          radius: clusterRadius,
          description: `Agent cluster with ${nearby.length} members`,
          metrics: {
            size: nearby.length,
            density,
            cohesion: this.calculateCohesion(nearby)
          }
        });

        nearby.forEach(a => processed.add(a.id));
      }
    });
  }

  private detectOscillations(): void {
    // Look for cyclic patterns in agent positions
    if (this.history.length < 20) return;

    const agents = this.coordinator.getAllAgents();
    const recentHistory = this.history.slice(-20);

    agents.forEach(agent => {
      // Track position variance over time
      const positions = recentHistory
        .map(h => {
          // Find agent's position in historical snapshot
          return { x: agent.position.x, y: agent.position.y }; // Simplified
        });

      // Detect periodic movement
      const variance = this.calculateVariance(positions.map(p => p.x));
      if (variance > 10 && variance < 50) {
        const patternId = `oscillation-${agent.id}`;
        const existing = this.detectedPatterns.get(patternId);

        this.detectedPatterns.set(patternId, {
          id: patternId,
          type: EmergentPatternType.OSCILLATION,
          confidence: 0.6,
          lifetime: existing ? existing.lifetime + 1 : 1,
          participants: [agent.id],
          description: `Cyclic behavior detected for ${agent.name}`,
          metrics: {
            variance,
            period: 20 // Simplified
          }
        });
      }
    });
  }

  private detectDivisionOfLabor(): void {
    const agents = this.coordinator.getAllAgents();

    // Group agents by their predominant state
    const stateGroups = new Map<string, Agent[]>();
    agents.forEach(agent => {
      const state = agent.state;
      if (!stateGroups.has(state)) stateGroups.set(state, []);
      stateGroups.get(state)!.push(agent);
    });

    // If agents are clearly specialized
    const specializedGroups = Array.from(stateGroups.entries())
      .filter(([_, agents]) => agents.length >= 2);

    if (specializedGroups.length >= 2) {
      const patternId = 'division-of-labor';
      const existing = this.detectedPatterns.get(patternId);

      this.detectedPatterns.set(patternId, {
        id: patternId,
        type: EmergentPatternType.DIVISION_OF_LABOR,
        confidence: Math.min(specializedGroups.length / 5, 1.0),
        lifetime: existing ? existing.lifetime + 1 : 1,
        participants: agents.map(a => a.id),
        description: `Division of labor across ${specializedGroups.length} roles`,
        metrics: {
          roleCount: specializedGroups.length,
          specialization: this.calculateSpecialization(stateGroups)
        }
      });
    }
  }

  private detectStigmergicMemory(): void {
    const pheromones = this.coordinator.getPheromoneManager();
    const stats = pheromones.getStats();

    // Look for stable pheromone patterns
    if (stats.avgStrength > 0.3 && stats.totalDeposits > 20) {
      const patternId = 'stigmergic-memory';
      const existing = this.detectedPatterns.get(patternId);

      this.detectedPatterns.set(patternId, {
        id: patternId,
        type: EmergentPatternType.STIGMERGIC_MEMORY,
        confidence: stats.avgStrength,
        lifetime: existing ? existing.lifetime + 1 : 1,
        participants: [],
        description: 'Environment carries stable memory patterns',
        metrics: {
          deposits: stats.totalDeposits,
          avgStrength: stats.avgStrength,
          persistence: existing ? existing.lifetime : 1
        }
      });
    }
  }

  private detectPhaseTransitions(): void {
    if (this.history.length < 2) return;

    const current = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];

    const currentMetrics = this.calculateMetricsForPatterns(current.patterns);
    const previousMetrics = this.calculateMetricsForPatterns(previous.patterns);

    // Detect sudden changes in complexity or organization
    const complexityChange = Math.abs(currentMetrics.complexity - previousMetrics.complexity);
    const organizationChange = Math.abs(currentMetrics.selfOrganization - previousMetrics.selfOrganization);

    if (complexityChange > 0.3 || organizationChange > 0.3) {
      const patternId = `transition-${Date.now()}`;

      this.detectedPatterns.set(patternId, {
        id: patternId,
        type: EmergentPatternType.PHASE_TRANSITION,
        confidence: Math.max(complexityChange, organizationChange),
        lifetime: 1,
        participants: this.coordinator.getAllAgents().map(a => a.id),
        description: 'System-wide phase transition detected',
        metrics: {
          complexityChange,
          organizationChange,
          direction: complexityChange > 0 ? 1 : -1
        }
      });
    }
  }

  private prunePatterns(): void {
    // Remove patterns that haven't been reinforced
    const toRemove: string[] = [];

    this.detectedPatterns.forEach((pattern, id) => {
      // Patterns fade if not reinforced
      if (pattern.lifetime > 20 && pattern.confidence < 0.3) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.detectedPatterns.delete(id));
  }

  private calculateMetrics(): EmergenceMetrics {
    const patterns = Array.from(this.detectedPatterns.values());
    return this.calculateMetricsForPatterns(patterns);
  }

  private calculateMetricsForPatterns(patterns: EmergentPattern[]): EmergenceMetrics {
    // Complexity: number and diversity of patterns
    const patternTypes = new Set(patterns.map(p => p.type));
    const complexity = Math.min((patterns.length * patternTypes.size) / 20, 1.0);

    // Self-organization: how many patterns are stable
    const stablePatterns = patterns.filter(p => p.lifetime > 5);
    const selfOrganization = patterns.length > 0 ? stablePatterns.length / patterns.length : 0;

    // Robustness: average pattern confidence
    const robustness = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;

    // Efficiency: average participant count (more = better coordination)
    const efficiency = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.participants.length, 0) / patterns.length / 10
      : 0;

    // Novelty: how many new patterns
    const novelPatterns = patterns.filter(p => p.lifetime === 1);
    const novelty = patterns.length > 0 ? novelPatterns.length / patterns.length : 0;

    return {
      complexity,
      selfOrganization,
      robustness,
      efficiency: Math.min(efficiency, 1.0),
      novelty,
      patterns
    };
  }

  private analyzeTrends(history: Array<{ timestamp: number; patterns: EmergentPattern[] }>): {
    increasingComplexity: boolean;
    convergingBehavior: boolean;
    cycleDetected: boolean;
  } {
    if (history.length < 5) {
      return { increasingComplexity: false, convergingBehavior: false, cycleDetected: false };
    }

    const complexities = history.map(h => h.patterns.length);
    const trend = this.calculateTrend(complexities);

    const hubs = history.map(h => h.patterns.filter(p => p.type === EmergentPatternType.HUB).length);
    const convergingBehavior = hubs[hubs.length - 1] > hubs[0];

    const cycleDetected = history.some(h =>
      h.patterns.some(p => p.type === EmergentPatternType.OSCILLATION)
    );

    return {
      increasingComplexity: trend > 0,
      convergingBehavior,
      cycleDetected
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private generateHeatmap(): number[][] {
    const pheromones = this.coordinator.getPheromoneManager();
    const bounds = pheromones.exportField().bounds;
    const resolution = 20;

    const heatmap: number[][] = Array(resolution).fill(0).map(() => Array(resolution).fill(0));

    const deposits = pheromones.exportField().deposits;
    deposits.forEach(deposit => {
      const x = Math.floor((deposit.position.x - bounds.minX) / (bounds.maxX - bounds.minX) * resolution);
      const y = Math.floor((deposit.position.y - bounds.minY) / (bounds.maxY - bounds.minY) * resolution);

      if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
        heatmap[y][x] += deposit.strength;
      }
    });

    return heatmap;
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private calculateCohesion(agents: Agent[]): number {
    if (agents.length < 2) return 0;

    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        totalDistance += this.distance(agents[i].position, agents[j].position);
        count++;
      }
    }

    const avgDistance = totalDistance / count;
    return 1 / (1 + avgDistance); // Higher cohesion = lower distance
  }

  private calculateSpecialization(stateGroups: Map<string, Agent[]>): number {
    const total = Array.from(stateGroups.values()).reduce((sum, agents) => sum + agents.length, 0);
    if (total === 0) return 0;

    let specialization = 0;
    stateGroups.forEach(agents => {
      const proportion = agents.length / total;
      specialization -= proportion * Math.log2(proportion + 0.0001);
    });

    return specialization / Math.log2(stateGroups.size + 1);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return variance;
  }
}
