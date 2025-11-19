/**
 * Chrono-Adaptive Content Engine
 *
 * Export all chrono modules for VibeCast Xenosphere
 *
 * This engine enables content and computing to adapt to:
 * - Astronomical cycles (lunar, solar, planetary)
 * - Human circadian rhythms
 * - Adaptive AI personalities
 * - Follow-the-sun computing optimization
 */

import { AstronomicalEngine } from './astronomical';
import { CircadianCompute } from './circadian';
import { ChronoPersonality } from './adaptive-personality';
import { SolarCompute } from './solar-compute';

export {
  AstronomicalEngine,
  type CelestialState,
  type LunarState,
  type SolarState,
  type MoonPhase,
  type Season,
  type PlanetaryPosition,
  type AstronomicalEvent
} from './astronomical';

export {
  CircadianCompute,
  type CircadianState,
  type CircadianPhase,
  type BiologicalPrimeTime,
  type SleepCycle,
  type Chronotype
} from './circadian';

export {
  ChronoPersonality,
  type PersonalityState,
  type PersonalityTrait,
  type ResponseModulation
} from './adaptive-personality';

export {
  SolarCompute,
  type GeographicRegion,
  type SolarWindow,
  type ComputeTask,
  type TaskSchedule,
  type EnergyMetrics
} from './solar-compute';

/**
 * Unified Chrono Engine
 *
 * Combines all chrono-adaptive systems into a single interface
 */
export class ChronoEngine {
  public astronomical: AstronomicalEngine;
  public circadian: CircadianCompute;
  public personality: ChronoPersonality;
  public solar: SolarCompute;

  constructor(
    latitude: number = 37.7749,
    longitude: number = -122.4194,
    chronotype: 'lark' | 'third-bird' | 'owl' = 'third-bird'
  ) {
    this.astronomical = new AstronomicalEngine(latitude, longitude);
    this.circadian = new CircadianCompute(chronotype);
    this.personality = new ChronoPersonality();
    this.solar = new SolarCompute();
  }

  /**
   * Get complete chrono-adaptive state
   */
  getCurrentState(date: Date = new Date()) {
    const celestial = this.astronomical.getCurrentState(date);
    const circadianState = this.circadian.getCurrentState(date);
    const personalityState = this.personality.getPersonalityState(celestial, circadianState);
    const solarStatus = this.solar.findOptimalRegions(date);

    return {
      celestial,
      circadian: circadianState,
      personality: personalityState,
      solar: solarStatus,
      timestamp: date
    };
  }

  /**
   * Generate comprehensive chrono report
   */
  generateReport(date: Date = new Date()): string {
    const state = this.getCurrentState(date);

    let report = `╔════════════════════════════════════════════════════════╗\n`;
    report += `║     CHRONO-ADAPTIVE ENGINE STATUS REPORT              ║\n`;
    report += `╚════════════════════════════════════════════════════════╝\n\n`;

    report += `${this.astronomical.getCosmicWeather(date)}\n`;
    report += `\n${this.circadian.getCircadianReport(date)}\n`;
    report += `\n${this.personality.getPersonalityReport(state.celestial, state.circadian)}\n`;
    report += `\n${this.solar.getCurrentSolarStatus(date)}\n`;

    return report;
  }

  /**
   * Update location for all systems
   */
  setLocation(latitude: number, longitude: number): void {
    this.astronomical.setLocation(latitude, longitude);
  }
}
