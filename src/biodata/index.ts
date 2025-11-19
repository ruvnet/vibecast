/**
 * VibeCast Biodata Streaming Protocols
 *
 * Real-time biometric integration where content adapts to collective audience physiology.
 * Maps emotional topology. Creates coherence between minds through shared biological states.
 *
 * Privacy-First Design:
 * - All data is aggregated
 * - No individual identification
 * - Ephemeral (not stored long-term)
 * - Consent-based
 * - Focus on collective patterns
 *
 * @module biodata
 */

// Core biometric sensors
export {
  BiometricData,
  BiometricSensors,
  SensorConfig
} from './sensors';

// Emotional topology mapping
export {
  EmotionalState,
  EmotionalCluster,
  TopologyMap,
  TopologyConfig,
  EmotionalTopology
} from './topology';

// Coherence detection
export {
  CoherenceMetrics,
  SynchronyWindow,
  FlowStateDetection,
  CoherenceEngine
} from './coherence';

// Adaptive content modulation
export {
  ContentModulation,
  AdaptiveConfig,
  ContentState,
  AdaptiveStream
} from './adaptive-stream';

// Import classes for factory function
import { BiometricSensors } from './sensors.js';
import { EmotionalTopology } from './topology.js';
import { CoherenceEngine } from './coherence.js';
import { AdaptiveStream } from './adaptive-stream.js';

/**
 * Create a complete biodata streaming system
 */
export function createBiodataSystem(config: {
  sensorSampleRate?: number;
  topologyDimensions?: number;
  coherenceWindowSize?: number;
  adaptationSpeed?: number;
} = {}) {
  const sensors = new BiometricSensors({
    sampleRate: config.sensorSampleRate || 10,
    smoothingWindow: 1000,
    privacyMode: 'aggregated'
  });

  const topology = new EmotionalTopology({
    dimensions: config.topologyDimensions || 5,
    clusterThreshold: 0.3,
    minClusterSize: 2,
    historyWindow: 10000
  });

  const coherence = new CoherenceEngine({
    windowSize: config.coherenceWindowSize || 50,
    minSyncDuration: 3000,
    flowThreshold: 0.7
  });

  const adaptiveStream = new AdaptiveStream({
    responseThreshold: 0.15,
    adaptationSpeed: config.adaptationSpeed || 0.3,
    maintainFlowState: true,
    allowBranching: true
  });

  return {
    sensors,
    topology,
    coherence,
    adaptiveStream
  };
}
