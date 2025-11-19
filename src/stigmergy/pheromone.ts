/**
 * Pheromone Trail System - Core Stigmergic Coordination
 *
 * Inspired by ant colonies: agents leave chemical trails that guide others.
 * Trails evaporate over time, creating natural exploration-exploitation balance.
 */

export enum PheromoneType {
  INTEREST = 'interest',        // "This is interesting"
  SUCCESS = 'success',          // "This worked!"
  DANGER = 'danger',            // "Avoid this"
  RESOURCE = 'resource',        // "Valuable content here"
  QUESTION = 'question',        // "Need help here"
  CONVERGENCE = 'convergence'   // "Multiple trails meet here"
}

export interface PheromoneDeposit {
  id: string;
  type: PheromoneType;
  position: { x: number; y: number; z?: number };
  strength: number;              // 0-1, affects influence radius
  depositor: string;             // Agent ID
  timestamp: number;
  metadata: {
    context?: string;
    tags?: string[];
    data?: Record<string, any>;
  };
  evaporationRate: number;       // How fast it decays
}

export interface PheromoneField {
  deposits: PheromoneDeposit[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
  };
}

export interface TrailSegment {
  start: { x: number; y: number; z?: number };
  end: { x: number; y: number; z?: number };
  strength: number;
  type: PheromoneType;
  age: number;
}

export interface AgentSensing {
  nearbyDeposits: PheromoneDeposit[];
  gradients: Map<PheromoneType, { dx: number; dy: number; dz?: number }>;
  strongestTrail: TrailSegment | null;
  convergencePoints: { x: number; y: number; z?: number; strength: number }[];
}

/**
 * Core Pheromone Management System
 */
export class PheromoneManager {
  private field: PheromoneField;
  private readonly baseEvaporationRate = 0.01; // Per tick
  private readonly influenceRadius = 5.0;
  private tickCount = 0;

  constructor(bounds?: PheromoneField['bounds']) {
    this.field = {
      deposits: [],
      bounds: bounds || { minX: 0, maxX: 100, minY: 0, maxY: 100 }
    };
  }

  /**
   * Agent deposits a pheromone at location
   */
  deposit(params: {
    type: PheromoneType;
    position: { x: number; y: number; z?: number };
    strength?: number;
    depositor: string;
    context?: string;
    tags?: string[];
    data?: Record<string, any>;
    evaporationRate?: number;
  }): PheromoneDeposit {
    const deposit: PheromoneDeposit = {
      id: `pheromone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      position: params.position,
      strength: params.strength || 1.0,
      depositor: params.depositor,
      timestamp: Date.now(),
      metadata: {
        context: params.context,
        tags: params.tags,
        data: params.data
      },
      evaporationRate: params.evaporationRate || this.baseEvaporationRate
    };

    this.field.deposits.push(deposit);
    return deposit;
  }

  /**
   * Agent senses pheromones in their vicinity
   */
  sense(position: { x: number; y: number; z?: number }, radius?: number): AgentSensing {
    const senseRadius = radius || this.influenceRadius;
    const nearby = this.field.deposits.filter(d =>
      this.distance(position, d.position) <= senseRadius && d.strength > 0.01
    );

    // Calculate gradients for each pheromone type
    const gradients = this.calculateGradients(position, senseRadius);

    // Find strongest trail
    const strongestTrail = this.findStrongestTrail(position, senseRadius);

    // Detect convergence points
    const convergencePoints = this.detectConvergencePoints(nearby);

    return {
      nearbyDeposits: nearby,
      gradients,
      strongestTrail,
      convergencePoints
    };
  }

  /**
   * Simulate time passing - pheromones evaporate
   */
  tick(): void {
    this.tickCount++;

    // Evaporate all deposits
    this.field.deposits.forEach(deposit => {
      deposit.strength *= (1 - deposit.evaporationRate);
    });

    // Remove negligible deposits
    this.field.deposits = this.field.deposits.filter(d => d.strength > 0.001);

    // Merge nearby deposits of same type for performance
    this.mergeNearbyDeposits();
  }

  /**
   * Get all deposits of a specific type
   */
  getDepositsByType(type: PheromoneType): PheromoneDeposit[] {
    return this.field.deposits.filter(d => d.type === type);
  }

  /**
   * Get deposits by depositor
   */
  getDepositsByAgent(agentId: string): PheromoneDeposit[] {
    return this.field.deposits.filter(d => d.depositor === agentId);
  }

  /**
   * Clear all pheromones (reset environment)
   */
  clear(): void {
    this.field.deposits = [];
    this.tickCount = 0;
  }

  /**
   * Get statistics about the pheromone field
   */
  getStats(): {
    totalDeposits: number;
    byType: Record<PheromoneType, number>;
    avgStrength: number;
    tickCount: number;
  } {
    const byType = {} as Record<PheromoneType, number>;
    Object.values(PheromoneType).forEach(type => {
      byType[type] = this.field.deposits.filter(d => d.type === type).length;
    });

    const totalStrength = this.field.deposits.reduce((sum, d) => sum + d.strength, 0);

    return {
      totalDeposits: this.field.deposits.length,
      byType,
      avgStrength: this.field.deposits.length > 0 ? totalStrength / this.field.deposits.length : 0,
      tickCount: this.tickCount
    };
  }

  /**
   * Advanced: Follow trail using gradient ascent
   */
  followTrail(
    currentPos: { x: number; y: number; z?: number },
    type: PheromoneType,
    stepSize: number = 1.0
  ): { x: number; y: number; z?: number } | null {
    const sensing = this.sense(currentPos);
    const gradient = sensing.gradients.get(type);

    if (!gradient) return null;

    const magnitude = Math.sqrt(gradient.dx ** 2 + gradient.dy ** 2 + (gradient.dz || 0) ** 2);
    if (magnitude < 0.001) return null;

    // Normalize and apply step size
    return {
      x: currentPos.x + (gradient.dx / magnitude) * stepSize,
      y: currentPos.y + (gradient.dy / magnitude) * stepSize,
      z: currentPos.z !== undefined && gradient.dz !== undefined
        ? currentPos.z + (gradient.dz / magnitude) * stepSize
        : currentPos.z
    };
  }

  /**
   * Detect if trails are converging at a point
   */
  isConvergencePoint(
    position: { x: number; y: number; z?: number },
    threshold: number = 3
  ): boolean {
    const nearby = this.field.deposits.filter(d =>
      this.distance(position, d.position) <= this.influenceRadius
    );

    // Check if multiple different agents' trails meet here
    const uniqueAgents = new Set(nearby.map(d => d.depositor));
    return uniqueAgents.size >= threshold;
  }

  // Private helper methods

  private distance(
    a: { x: number; y: number; z?: number },
    b: { x: number; y: number; z?: number }
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateGradients(
    position: { x: number; y: number; z?: number },
    radius: number
  ): Map<PheromoneType, { dx: number; dy: number; dz?: number }> {
    const gradients = new Map<PheromoneType, { dx: number; dy: number; dz?: number }>();

    Object.values(PheromoneType).forEach(type => {
      const deposits = this.getDepositsByType(type);
      let dx = 0, dy = 0, dz = 0;
      let count = 0;

      deposits.forEach(deposit => {
        const dist = this.distance(position, deposit.position);
        if (dist <= radius && dist > 0) {
          const influence = deposit.strength / (dist * dist); // Inverse square law
          const direction = {
            dx: (deposit.position.x - position.x) / dist,
            dy: (deposit.position.y - position.y) / dist,
            dz: ((deposit.position.z || 0) - (position.z || 0)) / dist
          };
          dx += direction.dx * influence;
          dy += direction.dy * influence;
          dz += direction.dz * influence;
          count++;
        }
      });

      if (count > 0) {
        gradients.set(type, { dx, dy, dz: position.z !== undefined ? dz : undefined });
      }
    });

    return gradients;
  }

  private findStrongestTrail(
    position: { x: number; y: number; z?: number },
    radius: number
  ): TrailSegment | null {
    const deposits = this.field.deposits.filter(d =>
      this.distance(position, d.position) <= radius
    );

    if (deposits.length === 0) return null;

    // Find deposit with highest strength
    const strongest = deposits.reduce((max, d) =>
      d.strength > max.strength ? d : max
    , deposits[0]);

    // Create trail segment pointing toward strongest deposit
    return {
      start: position,
      end: strongest.position,
      strength: strongest.strength,
      type: strongest.type,
      age: Date.now() - strongest.timestamp
    };
  }

  private detectConvergencePoints(
    deposits: PheromoneDeposit[]
  ): { x: number; y: number; z?: number; strength: number }[] {
    const points: { x: number; y: number; z?: number; strength: number }[] = [];
    const threshold = 2.0;

    // Grid-based clustering
    const gridSize = 2.0;
    const grid = new Map<string, PheromoneDeposit[]>();

    deposits.forEach(deposit => {
      const key = `${Math.floor(deposit.position.x / gridSize)},${Math.floor(deposit.position.y / gridSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(deposit);
    });

    // Find grid cells with high concentration
    grid.forEach((cellDeposits, key) => {
      if (cellDeposits.length >= 3) {
        const uniqueAgents = new Set(cellDeposits.map(d => d.depositor));
        if (uniqueAgents.size >= 2) {
          const avgX = cellDeposits.reduce((sum, d) => sum + d.position.x, 0) / cellDeposits.length;
          const avgY = cellDeposits.reduce((sum, d) => sum + d.position.y, 0) / cellDeposits.length;
          const totalStrength = cellDeposits.reduce((sum, d) => sum + d.strength, 0);

          points.push({
            x: avgX,
            y: avgY,
            strength: totalStrength
          });
        }
      }
    });

    return points.sort((a, b) => b.strength - a.strength);
  }

  private mergeNearbyDeposits(): void {
    const mergeRadius = 0.5;
    const merged: PheromoneDeposit[] = [];
    const processed = new Set<string>();

    this.field.deposits.forEach(deposit => {
      if (processed.has(deposit.id)) return;

      const nearby = this.field.deposits.filter(d =>
        !processed.has(d.id) &&
        d.type === deposit.type &&
        d.depositor === deposit.depositor &&
        this.distance(deposit.position, d.position) <= mergeRadius
      );

      if (nearby.length > 1) {
        // Merge into one stronger deposit
        const totalStrength = nearby.reduce((sum, d) => sum + d.strength, 0);
        const avgX = nearby.reduce((sum, d) => sum + d.position.x * d.strength, 0) / totalStrength;
        const avgY = nearby.reduce((sum, d) => sum + d.position.y * d.strength, 0) / totalStrength;

        merged.push({
          ...deposit,
          position: { x: avgX, y: avgY },
          strength: totalStrength
        });

        nearby.forEach(d => processed.add(d.id));
      } else {
        merged.push(deposit);
        processed.add(deposit.id);
      }
    });

    this.field.deposits = merged;
  }

  /**
   * Export current field state for visualization
   */
  exportField(): PheromoneField {
    return JSON.parse(JSON.stringify(this.field));
  }

  /**
   * Import field state (for persistence)
   */
  importField(field: PheromoneField): void {
    this.field = field;
  }
}

/**
 * Helper: Create a trail between two points
 */
export function createTrail(
  manager: PheromoneManager,
  start: { x: number; y: number; z?: number },
  end: { x: number; y: number; z?: number },
  type: PheromoneType,
  depositor: string,
  density: number = 1.0
): void {
  const steps = Math.ceil(distance(start, end) / density);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const position = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z !== undefined && end.z !== undefined
        ? start.z + (end.z - start.z) * t
        : undefined
    };

    manager.deposit({
      type,
      position,
      strength: 0.8,
      depositor
    });
  }
}

function distance(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
