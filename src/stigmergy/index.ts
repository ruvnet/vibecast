/**
 * Stigmergy System - Complete Export
 *
 * A complete stigmergic coordination system where creators leave "pheromone trails"
 * that guide others through environment-mediated collaboration.
 *
 * Pure swarm intelligence - NO central control.
 *
 * @module stigmergy
 */

// Core pheromone system
export {
  PheromoneManager,
  PheromoneType,
  PheromoneDeposit,
  PheromoneField,
  TrailSegment,
  AgentSensing,
  createTrail
} from './pheromone';

// Swarm coordination
export {
  SwarmCoordinator,
  Agent,
  AgentState,
  AgentBehavior,
  AgentMemory,
  SwarmEvent,
  SwarmMetrics
} from './swarm-coordinator';

// Emergence detection
export {
  EmergenceDetector,
  EmergentPattern,
  EmergentPatternType,
  EmergenceMetrics,
  TemporalAnalysis
} from './emergence';

// Collaboration API
export {
  CollaborationAPI,
  CollaborationStream,
  CollaborationSession,
  SessionParticipant,
  ActivityFeed,
  SensoryInput,
  ActionResult
} from './collaboration-api';

/**
 * Quick start: Create a complete stigmergic system
 */
export function createStigmergicSystem(params?: {
  name?: string;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}) {
  const api = new CollaborationAPI();
  const session = api.createSession({
    name: params?.name || 'Stigmergic Collaboration',
    bounds: params?.bounds
  });

  return {
    api,
    session,
    coordinator: session.coordinator,
    detector: session.detector,
    pheromones: session.coordinator.getPheromoneManager()
  };
}

import { CollaborationAPI } from './collaboration-api';
