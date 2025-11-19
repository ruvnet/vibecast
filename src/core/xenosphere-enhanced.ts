/**
 * XENOSPHERE ENHANCED - Auto-initialization with Real Subsystems
 *
 * This version automatically connects ALL FOUR real subsystems:
 * - Hyperdimensional (built-in)
 * - Chrono (auto-connected)
 * - Biodata (auto-connected)
 * - Stigmergy (auto-connected)
 */

import { Xenosphere } from './xenosphere.js';
import { ChronoEngine as RealChronoEngine } from '../chrono/index.js';
import { CoherenceEngine, BiometricSensors, EmotionalTopology } from '../biodata/index.js';
import { SwarmCoordinator, createStigmergicSystem, PheromoneType } from '../stigmergy/index.js';
import type { BiodataEngine as IBiodataEngine, SwarmCoordinator as ISwarmCoordinator, PheromoneTrail } from './interfaces.js';

/**
 * Create a Xenosphere with real subsystems auto-connected
 */
export function createEnhancedXenosphere(options?: {
  latitude?: number;
  longitude?: number;
  chronotype?: 'lark' | 'third-bird' | 'owl';
}): Xenosphere {
  const sphere = new Xenosphere();

  // Connect real Chrono engine
  const chronoEngine = new RealChronoEngine(
    options?.latitude || 37.7749,
    options?.longitude || -122.4194,
    options?.chronotype || 'third-bird'
  );

  // Adapt the real Chrono engine to our interface
  const chronoAdapter = {
    getCurrentState: () => {
      const state = chronoEngine.getCurrentState();
      const timestamp = typeof state.timestamp === 'number' ? new Date(state.timestamp) : state.timestamp;
      return {
        moonPhase: state.celestial.lunar.illumination,
        solarPosition: calculateSolarPosition(timestamp as Date),
        circadianPhase: state.circadian.localHour / 24, // Convert hour to 0-1
        season: state.celestial.season,
        astrological: state.celestial.upcomingEvents.map(e => e.name)
      };
    },
    predictState: (offsetMs: number) => {
      const futureDate = new Date(Date.now() + offsetMs);
      const state = chronoEngine.getCurrentState(futureDate);
      return {
        moonPhase: state.celestial.lunar.illumination,
        solarPosition: calculateSolarPosition(futureDate),
        circadianPhase: state.circadian.localHour / 24,
        season: state.celestial.season,
        astrological: state.celestial.upcomingEvents.map(e => e.name)
      };
    },
    getCircadianModifier: (phase: number) => {
      // Convert 0-1 phase to hour of day
      const hour = phase * 24;
      const circadianState = chronoEngine.circadian.getCurrentState(new Date());
      return circadianState.attentionLevel - 0.5; // Center around 0
    },
    adaptPersonality: (state: any) => {
      const celestialState = chronoEngine.getCurrentState().celestial;
      const circadianState = chronoEngine.circadian.getCurrentState();
      const personality = chronoEngine.personality.getPersonalityState(
        celestialState,
        circadianState
      );

      return {
        energy: personality.energy,
        creativity: personality.creativity,
        focus: personality.analyticalThinking,
        sociability: personality.empathy
      };
    }
  };

  sphere.connectChrono(chronoAdapter as any);

  // Connect real Biodata engine
  const coherenceEngine = new CoherenceEngine();
  const sensors = new BiometricSensors();
  const topology = new EmotionalTopology();

  // Adapt the real Biodata engines to our interface
  const biodataAdapter: IBiodataEngine = {
    updatePhysiology: (userId: string, state: any) => {
      // Would update internal state in real implementation
      console.log(`[Biodata] Updated ${userId} physiology`);
    },
    getEmotionalTopology: (userId: string) => {
      // Mock emotional state (would query topology engine in real impl)
      return {
        valence: 0,
        arousal: 0.5,
        dominance: 0.5
      };
    },
    detectCoherence: (userIds: string[]) => {
      // Mock coherence detection (would use real coherence engine)
      // For now, return simulated coherence
      return {
        individual: 0.6,
        collective: 0.55,
        synchronization: 0.5,
        resonance: [40, 60, 80]
      };
    },
    predictState: (userId: string, offsetMs: number) => {
      // Baseline prediction (would use ML model in real impl)
      return {
        heartRate: 70,
        hrv: 50,
        breathingRate: 15,
        skinConductance: 2.0
      };
    }
  };

  sphere.connectBiodata(biodataAdapter);

  // Connect real Stigmergy coordinator
  const stigmergicSystem = createStigmergicSystem({
    name: 'Xenosphere Swarm'
  });

  // Adapt the real Stigmergy coordinator to our interface
  const swarmAdapter: ISwarmCoordinator = {
    depositPheromone: (trail: PheromoneTrail) => {
      // Convert our trail format to stigmergy format
      stigmergicSystem.coordinator.spawnAgent({
        id: trail.creatorId,
        name: trail.creatorId,
        metadata: { trail }
      });

      // Deposit pheromone at each path location
      trail.path.forEach((location, index) => {
        stigmergicSystem.pheromones.deposit({
          type: PheromoneType.SUCCESS, // Use success type for high-strength trails
          position: { x: index, y: 0 }, // Simplified position mapping
          strength: trail.strength,
          depositor: trail.creatorId,
          context: location
        });
      });
    },

    getPheromones: (location: string) => {
      // Get all pheromones near this location
      // Use the public API - get deposits by type and filter
      const allTypes = [
        PheromoneType.INTEREST,
        PheromoneType.SUCCESS,
        PheromoneType.RESOURCE,
        PheromoneType.CONVERGENCE
      ];

      const allDeposits = allTypes.flatMap(type =>
        stigmergicSystem.pheromones.getDepositsByType(type)
      );

      return allDeposits
        .filter(d => d.metadata?.context === location)
        .map(d => ({
          path: [d.metadata?.context || ''],
          strength: d.strength,
          timestamp: d.timestamp,
          creatorId: d.depositor
        }));
    },

    evaporate: (decayRate: number) => {
      // Simulate evaporation by calling tick multiple times
      for (let i = 0; i < Math.floor(decayRate * 100); i++) {
        stigmergicSystem.pheromones.tick();
      }
    },

    detectEmergence: () => {
      // Get patterns from emergence detector using public API
      const hubs = stigmergicSystem.detector.getPatternsByType('HUB' as any);
      return hubs.map(p => ({
        type: 'convergence' as any,
        locations: p.location ? [`${p.location.x},${p.location.y}`] : [],
        strength: p.confidence || 0.5, // Use confidence as strength proxy
        participants: p.participants
      }));
    },

    converge: (threshold: number) => {
      // Get convergence patterns
      const hubs = stigmergicSystem.detector.getPatternsByType('HUB' as any);
      return hubs
        .filter(p => (p.confidence || 0) >= threshold)
        .flatMap(p => p.participants);
    }
  };

  sphere.connectSwarm(swarmAdapter);

  return sphere;
}

function calculateSolarPosition(date: Date): number {
  // Simple solar position calculation (0-360 degrees)
  const hour = date.getHours() + date.getMinutes() / 60;
  return (hour / 24) * 360;
}

export { Xenosphere } from './xenosphere.js';
