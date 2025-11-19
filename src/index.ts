/**
 * VibeCast Xenosphere
 *
 * A streaming platform that unifies four exotic computational systems:
 *
 * 1. HYPERDIMENSIONAL COMPUTING (Space/What)
 *    - 10,000-dimensional vector encoding
 *    - Holographic storage (parts contain whole)
 *    - Temporal database (time as dimension)
 *
 * 2. STIGMERGY (Coordination/How)
 *    - Pheromone-based coordination
 *    - Emergent swarm intelligence
 *    - Self-organizing convergence
 *
 * 3. CHRONOBIOLOGY (Time/When)
 *    - Astronomical awareness (moon, sun, stars)
 *    - Circadian computing
 *    - Adaptive AI personality
 *
 * 4. BIODATA STREAMING (Life/Who)
 *    - Real-time physiological data
 *    - Emotional topology mapping
 *    - Collective coherence detection
 *
 * These are not four separate systems but four aspects of one reality.
 */

// ============================================================================
// Core Integration
// ============================================================================

export {
  Xenosphere,
  createXenosphere,
  XenosphereHelpers,
  type XenosphereAPI
} from './core/api.js';

export {
  createEnhancedXenosphere
} from './core/xenosphere-enhanced.js';

export {
  Observatory,
  createObservatory,
  type ObservatoryMetrics
} from './core/observatory.js';

export type {
  // Core interfaces
  XenosphereState,
  StreamContext,
  AdaptiveContent,

  // Stigmergy
  SwarmCoordinator,
  PheromoneTrail,
  EmergentPattern,

  // Chrono
  ChronoEngine,
  AstronomicalState,
  PersonalityShift,

  // Biodata
  BiodataEngine,
  PhysiologicalState,
  EmotionalTopology as EmotionalTopologyType,
  CoherenceState
} from './core/interfaces.js';

// ============================================================================
// Subsystems (Full Exports)
// ============================================================================

// Hyperdimensional
export {
  HyperVector,
  TemporalDatabase,
  HolographicStore
} from './hyperdimensional/index.js';

// Chrono
export {
  ChronoEngine as RealChronoEngine,
  AstronomicalEngine,
  CircadianCompute,
  ChronoPersonality,
  SolarCompute
} from './chrono/index.js';

// Biodata
export {
  BiometricSensors,
  EmotionalTopology as EmotionalTopologyEngine,
  CoherenceEngine,
  AdaptiveStream,
  createBiodataSystem
} from './biodata/index.js';

// Stigmergy
export {
  SwarmCoordinator as StigmergicSwarmCoordinator,
  PheromoneManager,
  EmergenceDetector,
  CollaborationAPI,
  createStigmergicSystem
} from './stigmergy/index.js';

// ============================================================================
// Demonstration
// ============================================================================

export { runDemo } from './demo.js';

// ============================================================================
// Quick Start
// ============================================================================

/**
 * Quick start: Create a Xenosphere and start streaming
 *
 * @example
 * ```typescript
 * import { quickStart } from 'vibecast-xenosphere';
 *
 * const { api, stream } = await quickStart('my-stream', 'creator-123');
 *
 * // Content automatically adapts to:
 * // - Moon phase
 * // - Audience coherence
 * // - Emergent patterns
 * // - Hyperdimensional context
 * const adapted = api.adaptContent('my-stream', content);
 * ```
 */
export async function quickStart(streamId: string, creatorId: string, content?: any) {
  const { XenosphereHelpers } = await import('./core/api.js');
  return XenosphereHelpers.quickStream(streamId, creatorId, content || {});
}

/**
 * Monitor Xenosphere in real-time
 *
 * @example
 * ```typescript
 * import { startMonitoring } from 'vibecast-xenosphere';
 *
 * const monitor = startMonitoring(1000); // Update every 1s
 *
 * monitor.subscribe(metrics => {
 *   console.log('Coherence:', metrics.collective.coherence);
 * });
 * ```
 */
export function startMonitoring(intervalMs: number = 1000) {
  const { XenosphereHelpers } = require('./core/api.js');
  return XenosphereHelpers.createMonitor(intervalMs);
}

// ============================================================================
// Version & Info
// ============================================================================

export const VERSION = '1.0.0';

export const INFO = {
  name: 'VibeCast Xenosphere',
  version: VERSION,
  description: 'A streaming platform 50 years ahead, running today',
  systems: {
    hyperdimensional: 'Space (10K dimensions, holographic memory)',
    stigmergy: 'Coordination (pheromone trails, emergence)',
    chrono: 'Time (astronomical awareness, circadian adaptation)',
    biodata: 'Life (physiological streaming, coherence detection)'
  },
  integration: 'Four aspects of one unified reality'
};
