/**
 * Astronomical Engine - Track Earth's cosmic rhythms
 *
 * Monitors lunar cycles, solar activity, planetary positions,
 * and astronomical events to enable chrono-adaptive computing.
 */

import * as SunCalc from 'suncalc';

export type MoonPhase =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface LunarState {
  phase: MoonPhase;
  illumination: number; // 0-1
  age: number; // days since new moon
  distance: number; // km from Earth
  nextNewMoon: Date;
  nextFullMoon: Date;
  isSupermoon: boolean;
}

export interface SolarState {
  activity: number; // 0-1, simulated or real
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dayLength: number; // hours
  goldenHour: { start: Date; end: Date };
  blueHour: { start: Date; end: Date };
}

export interface PlanetaryPosition {
  mercury: number; // degrees in zodiac
  venus: number;
  mars: number;
  jupiter: number;
  saturn: number;
}

export interface AstronomicalEvent {
  type: 'solstice' | 'equinox' | 'eclipse' | 'meteor-shower' | 'conjunction';
  name: string;
  date: Date;
  intensity: number; // 0-1
}

export interface CelestialState {
  timestamp: Date;
  lunar: LunarState;
  solar: SolarState;
  season: Season;
  planets: PlanetaryPosition;
  upcomingEvents: AstronomicalEvent[];
  cosmicIntensity: number; // 0-1, composite measure
}

export class AstronomicalEngine {
  private latitude: number;
  private longitude: number;

  constructor(latitude: number = 37.7749, longitude: number = -122.4194) {
    this.latitude = latitude;
    this.longitude = longitude;
  }

  /**
   * Get current celestial state
   */
  getCurrentState(date: Date = new Date()): CelestialState {
    const lunar = this.getLunarState(date);
    const solar = this.getSolarState(date);
    const season = this.getSeason(date);
    const planets = this.getPlanetaryPositions(date);
    const upcomingEvents = this.getUpcomingEvents(date);
    const cosmicIntensity = this.calculateCosmicIntensity(lunar, solar, planets);

    return {
      timestamp: date,
      lunar,
      solar,
      season,
      planets,
      upcomingEvents,
      cosmicIntensity
    };
  }

  /**
   * Calculate lunar state using SunCalc
   */
  getLunarState(date: Date): LunarState {
    const moonIllum = SunCalc.getMoonIllumination(date);
    const moonTimes = SunCalc.getMoonTimes(date, this.latitude, this.longitude);

    const phase = this.getMoonPhase(moonIllum.phase);
    const age = moonIllum.phase * 29.53; // lunar month is ~29.53 days

    // Calculate next new and full moons
    const nextNewMoon = this.findNextMoonPhase(date, 'new');
    const nextFullMoon = this.findNextMoonPhase(date, 'full');

    // Supermoon calculation (within 90% of closest approach)
    const averageDistance = 384400; // km
    const currentDistance = 384400 * (1 + 0.055 * Math.sin(moonIllum.phase * 2 * Math.PI));
    const isSupermoon = currentDistance < averageDistance * 0.9 &&
                        (phase === 'full' || phase === 'new');

    return {
      phase,
      illumination: moonIllum.fraction,
      age,
      distance: currentDistance,
      nextNewMoon,
      nextFullMoon,
      isSupermoon
    };
  }

  /**
   * Calculate solar state using SunCalc
   */
  getSolarState(date: Date): SolarState {
    const sunTimes = SunCalc.getTimes(date, this.latitude, this.longitude);
    const sunPosition = SunCalc.getPosition(date, this.latitude, this.longitude);

    const sunrise = sunTimes.sunrise;
    const sunset = sunTimes.sunset;
    const solarNoon = sunTimes.solarNoon;

    const dayLength = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);

    // Simulate solar activity (11-year cycle approximation)
    const solarCycleStart = new Date('2019-12-01').getTime();
    const yearsSinceCycleStart = (date.getTime() - solarCycleStart) / (1000 * 60 * 60 * 24 * 365.25);
    const cyclePosition = (yearsSinceCycleStart % 11) / 11;
    const activity = Math.sin(cyclePosition * Math.PI); // Peak at ~5.5 years

    return {
      activity,
      sunrise,
      sunset,
      solarNoon,
      dayLength,
      goldenHour: {
        start: sunTimes.goldenHour,
        end: sunTimes.goldenHourEnd
      },
      blueHour: {
        start: sunTimes.dusk,
        end: sunTimes.nauticalDusk
      }
    };
  }

  /**
   * Determine current season
   */
  getSeason(date: Date): Season {
    const month = date.getMonth();
    const day = date.getDate();

    // Northern hemisphere
    if (month === 11 || month === 0 || month === 1) return 'winter';
    if (month === 2 || month === 3 || month === 4) return 'spring';
    if (month === 5 || month === 6 || month === 7) return 'summer';
    return 'autumn';
  }

  /**
   * Simulate planetary positions (simplified)
   * In production, use actual ephemeris data or astronomy libraries
   */
  getPlanetaryPositions(date: Date): PlanetaryPosition {
    const daysSinceEpoch = (date.getTime() - new Date('2000-01-01').getTime()) / (1000 * 60 * 60 * 24);

    return {
      mercury: (daysSinceEpoch * 4.09) % 360, // ~88 day orbit
      venus: (daysSinceEpoch * 1.62) % 360,   // ~225 day orbit
      mars: (daysSinceEpoch * 0.53) % 360,    // ~687 day orbit
      jupiter: (daysSinceEpoch * 0.083) % 360, // ~12 year orbit
      saturn: (daysSinceEpoch * 0.034) % 360   // ~29 year orbit
    };
  }

  /**
   * Get upcoming astronomical events
   */
  getUpcomingEvents(date: Date): AstronomicalEvent[] {
    const events: AstronomicalEvent[] = [];
    const year = date.getFullYear();

    // Solstices and Equinoxes (approximate dates)
    const springEquinox = new Date(year, 2, 20);
    const summerSolstice = new Date(year, 5, 21);
    const autumnEquinox = new Date(year, 8, 22);
    const winterSolstice = new Date(year, 11, 21);

    if (springEquinox > date) {
      events.push({ type: 'equinox', name: 'Spring Equinox', date: springEquinox, intensity: 0.8 });
    }
    if (summerSolstice > date) {
      events.push({ type: 'solstice', name: 'Summer Solstice', date: summerSolstice, intensity: 1.0 });
    }
    if (autumnEquinox > date) {
      events.push({ type: 'equinox', name: 'Autumn Equinox', date: autumnEquinox, intensity: 0.8 });
    }
    if (winterSolstice > date) {
      events.push({ type: 'solstice', name: 'Winter Solstice', date: winterSolstice, intensity: 1.0 });
    }

    // Add meteor showers
    const perseids = new Date(year, 7, 12);
    const geminids = new Date(year, 11, 14);

    if (perseids > date && perseids.getTime() - date.getTime() < 30 * 24 * 60 * 60 * 1000) {
      events.push({ type: 'meteor-shower', name: 'Perseids', date: perseids, intensity: 0.7 });
    }
    if (geminids > date && geminids.getTime() - date.getTime() < 30 * 24 * 60 * 60 * 1000) {
      events.push({ type: 'meteor-shower', name: 'Geminids', date: geminids, intensity: 0.7 });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }

  /**
   * Calculate overall cosmic intensity
   */
  private calculateCosmicIntensity(lunar: LunarState, solar: SolarState, planets: PlanetaryPosition): number {
    let intensity = 0;

    // Lunar contribution (full/new moons are intense)
    const lunarIntensity = Math.abs(lunar.illumination - 0.5) * 2; // 0 at half moon, 1 at full/new
    intensity += lunarIntensity * 0.4;

    // Solar activity contribution
    intensity += solar.activity * 0.3;

    // Planetary alignment (simplified - check if planets are within 30 degrees)
    const positions = Object.values(planets);
    let alignments = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const diff = Math.abs(positions[i] - positions[j]);
        if (diff < 30 || diff > 330) alignments++;
      }
    }
    intensity += (alignments / 10) * 0.3; // Max 10 possible pairs

    return Math.min(intensity, 1);
  }

  /**
   * Convert moon phase number to name
   */
  private getMoonPhase(phase: number): MoonPhase {
    if (phase < 0.0625) return 'new';
    if (phase < 0.1875) return 'waxing-crescent';
    if (phase < 0.3125) return 'first-quarter';
    if (phase < 0.4375) return 'waxing-gibbous';
    if (phase < 0.5625) return 'full';
    if (phase < 0.6875) return 'waning-gibbous';
    if (phase < 0.8125) return 'last-quarter';
    if (phase < 0.9375) return 'waning-crescent';
    return 'new';
  }

  /**
   * Find next occurrence of a specific moon phase
   */
  private findNextMoonPhase(startDate: Date, targetPhase: 'new' | 'full'): Date {
    const targetValue = targetPhase === 'new' ? 0 : 0.5;
    let date = new Date(startDate);

    for (let i = 0; i < 30; i++) {
      date.setDate(date.getDate() + 1);
      const illum = SunCalc.getMoonIllumination(date);

      if (targetPhase === 'new') {
        if (illum.phase < 0.03 || illum.phase > 0.97) return date;
      } else {
        if (Math.abs(illum.phase - 0.5) < 0.03) return date;
      }
    }

    return new Date(startDate.getTime() + 29.53 * 24 * 60 * 60 * 1000); // Default to one lunar month
  }

  /**
   * Get cosmic weather report
   */
  getCosmicWeather(date: Date = new Date()): string {
    const state = this.getCurrentState(date);
    const { lunar, solar, cosmicIntensity } = state;

    let report = `🌙 Moon: ${lunar.phase} (${(lunar.illumination * 100).toFixed(1)}% illuminated)\n`;
    report += `☀️ Solar Activity: ${(solar.activity * 100).toFixed(1)}%\n`;
    report += `✨ Cosmic Intensity: ${(cosmicIntensity * 100).toFixed(1)}%\n`;
    report += `🌍 Season: ${state.season}\n`;

    if (lunar.isSupermoon) {
      report += `🌕 SUPERMOON detected!\n`;
    }

    if (state.upcomingEvents.length > 0) {
      report += `\n📅 Upcoming Events:\n`;
      state.upcomingEvents.forEach(event => {
        const daysAway = Math.ceil((event.date.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        report += `  • ${event.name} in ${daysAway} days\n`;
      });
    }

    return report;
  }

  /**
   * Update location for solar/lunar calculations
   */
  setLocation(latitude: number, longitude: number): void {
    this.latitude = latitude;
    this.longitude = longitude;
  }
}
