/**
 * Core Interfaces for Xenosphere Integration
 *
 * Defines the contracts between the four exotic subsystems
 */

import { HyperVector } from '../hyperdimensional/hypervector.js';

// ============================================================================
// HYPERDIMENSIONAL - Space (Where/What)
// ============================================================================

export interface HolographicStore {
  store(key: string, data: any): void;
  retrieve(key: string, timestamp?: number): any;
  query(pattern: any, timeRange?: [number, number]): Map<string, any>;
  summarize(key: string, timeRange?: [number, number]): any;
}

// ============================================================================
// STIGMERGY - Coordination (How/Emergence)
// ============================================================================

export interface PheromoneTrail {
  path: string[];
  strength: number;
  timestamp: number;
  creatorId: string;
}

export interface SwarmCoordinator {
  depositPheromone(trail: PheromoneTrail): void;
  getPheromones(location: string): PheromoneTrail[];
  evaporate(decayRate: number): void;
  detectEmergence(): EmergentPattern[];
  converge(threshold: number): string[];
}

export interface EmergentPattern {
  type: 'convergence' | 'divergence' | 'oscillation' | 'spiral';
  locations: string[];
  strength: number;
  participants: string[];
}

// ============================================================================
// CHRONO - Time (When/Rhythm)
// ============================================================================

export interface AstronomicalState {
  moonPhase: number; // 0-1
  solarPosition: number; // 0-360 degrees
  circadianPhase: number; // 0-1
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  astrological: string[];
}

export interface ChronoEngine {
  getCurrentState(): AstronomicalState;
  predictState(offsetMs: number): AstronomicalState;
  getCircadianModifier(phase: number): number;
  adaptPersonality(state: AstronomicalState): PersonalityShift;
}

export interface PersonalityShift {
  energy: number; // -1 to 1
  creativity: number;
  focus: number;
  sociability: number;
}

// ============================================================================
// BIODATA - Life (Who/Feeling)
// ============================================================================

export interface PhysiologicalState {
  heartRate: number;
  hrv: number; // Heart rate variability
  breathingRate: number;
  skinConductance: number;
  brainwaves?: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
}

export interface EmotionalTopology {
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (excited)
  dominance: number; // 0 (submissive) to 1 (dominant)
}

export interface CoherenceState {
  individual: number; // 0-1
  collective: number; // 0-1
  synchronization: number; // 0-1
  resonance: number[]; // Array of resonant frequencies
}

export interface BiodataEngine {
  updatePhysiology(userId: string, state: PhysiologicalState): void;
  getEmotionalTopology(userId: string): EmotionalTopology;
  detectCoherence(userIds: string[]): CoherenceState;
  predictState(userId: string, offsetMs: number): PhysiologicalState;
}

// ============================================================================
// UNIFIED STATE
// ============================================================================

export interface XenosphereState {
  // Hyperdimensional (Space)
  holographicSnapshot: Map<string, any>;
  vectorSpace: {
    dimensions: number;
    density: number;
    entropy: number;
  };

  // Stigmergy (Coordination)
  emergentPatterns: EmergentPattern[];
  pheromoneActivity: number;
  convergencePoints: string[];

  // Chrono (Time)
  astronomicalState: AstronomicalState;
  circadianPhase: number;
  temporalContext: string;

  // Biodata (Life)
  collectiveCoherence: CoherenceState;
  emotionalField: EmotionalTopology;
  physiologicalSync: number;

  // Meta
  timestamp: number;
  systemHealth: number;
}

// ============================================================================
// STREAMING CONTEXT
// ============================================================================

export interface StreamContext {
  streamId: string;
  creatorId: string;
  audienceIds: string[];

  // Enriched by all four systems
  holographicSignature?: HyperVector;
  pheromoneTrail?: PheromoneTrail;
  chronoContext?: AstronomicalState;
  biofeedback?: Map<string, PhysiologicalState>;
}

// ============================================================================
// CONTENT ADAPTATION
// ============================================================================

export interface AdaptiveContent {
  baseContent: any;

  // Adaptations from each system
  hyperdimensionalEncoding: HyperVector;
  stigmergicInfluence: number; // 0-1, how much crowd affects this
  chronoModulation: PersonalityShift;
  biodataResonance: number[]; // Frequencies to enhance

  // Final output
  adaptedContent: any;
}
