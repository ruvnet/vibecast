/**
 * Circadian Computing System
 *
 * Tracks human circadian rhythms and biological cycles to optimize
 * computing tasks for peak human performance and wellbeing.
 */

export type Chronotype = 'lark' | 'third-bird' | 'owl'; // morning, neutral, evening

export interface CircadianPhase {
  phase: 'cortisol-peak' | 'focus-peak' | 'coordination-peak' | 'melatonin-rise' | 'deep-sleep' | 'rem-sleep';
  optimalFor: string[];
  avoidActivities: string[];
}

export interface BiologicalPrimeTime {
  start: Date;
  end: Date;
  energyLevel: number; // 0-1
  focusLevel: number; // 0-1
  creativityLevel: number; // 0-1
}

export interface CircadianState {
  timestamp: Date;
  localHour: number;
  phase: CircadianPhase;
  energyLevel: number; // 0-1
  attentionLevel: number; // 0-1
  sleepPressure: number; // 0-1
  primeTime: BiologicalPrimeTime | null;
  recommendations: string[];
}

export interface SleepCycle {
  bedtime: Date;
  wakeTime: Date;
  duration: number; // hours
  quality: number; // 0-1
  cycles: number; // 90-min cycles
}

export class CircadianCompute {
  private chronotype: Chronotype;
  private timezone: string;
  private wakeTime: number; // hour of day
  private sleepTime: number; // hour of day

  constructor(
    chronotype: Chronotype = 'third-bird',
    timezone: string = 'America/Los_Angeles',
    wakeTime: number = 7,
    sleepTime: number = 23
  ) {
    this.chronotype = chronotype;
    this.timezone = timezone;
    this.wakeTime = wakeTime;
    this.sleepTime = sleepTime;
  }

  /**
   * Get current circadian state
   */
  getCurrentState(date: Date = new Date()): CircadianState {
    const localHour = this.getLocalHour(date);
    const phase = this.getCurrentPhase(localHour);
    const energyLevel = this.calculateEnergyLevel(localHour);
    const attentionLevel = this.calculateAttentionLevel(localHour);
    const sleepPressure = this.calculateSleepPressure(localHour);
    const primeTime = this.getBiologicalPrimeTime(date);
    const recommendations = this.generateRecommendations(phase, energyLevel, attentionLevel);

    return {
      timestamp: date,
      localHour,
      phase,
      energyLevel,
      attentionLevel,
      sleepPressure,
      primeTime,
      recommendations
    };
  }

  /**
   * Determine current circadian phase
   */
  private getCurrentPhase(hour: number): CircadianPhase {
    const adjustedHour = this.adjustForChronotype(hour);

    if (adjustedHour >= 6 && adjustedHour < 8) {
      return {
        phase: 'cortisol-peak',
        optimalFor: ['waking up', 'light exercise', 'planning'],
        avoidActivities: ['complex decisions', 'deep work']
      };
    } else if (adjustedHour >= 8 && adjustedHour < 12) {
      return {
        phase: 'focus-peak',
        optimalFor: ['analytical tasks', 'problem solving', 'learning', 'coding'],
        avoidActivities: ['routine tasks', 'napping']
      };
    } else if (adjustedHour >= 14 && adjustedHour < 17) {
      return {
        phase: 'coordination-peak',
        optimalFor: ['collaboration', 'meetings', 'presentations', 'exercise'],
        avoidActivities: ['solo deep work', 'complex learning']
      };
    } else if (adjustedHour >= 20 && adjustedHour < 22) {
      return {
        phase: 'melatonin-rise',
        optimalFor: ['reflection', 'reading', 'creative thinking', 'planning'],
        avoidActivities: ['screens', 'caffeine', 'intense exercise']
      };
    } else if (adjustedHour >= 22 || adjustedHour < 2) {
      return {
        phase: 'deep-sleep',
        optimalFor: ['sleeping', 'physical recovery', 'memory consolidation'],
        avoidActivities: ['all waking activities']
      };
    } else {
      return {
        phase: 'rem-sleep',
        optimalFor: ['dreaming', 'emotional processing', 'creative problem solving'],
        avoidActivities: ['all waking activities']
      };
    }
  }

  /**
   * Calculate energy level based on circadian rhythm
   */
  private calculateEnergyLevel(hour: number): number {
    const adjustedHour = this.adjustForChronotype(hour);

    // Energy follows roughly sinusoidal pattern with peak in morning/afternoon
    // and dip after lunch (post-prandial dip)
    let energy = 0.5 + 0.4 * Math.sin((adjustedHour - 6) * Math.PI / 12);

    // Post-lunch dip around 2-3 PM
    if (adjustedHour >= 14 && adjustedHour < 16) {
      energy -= 0.2;
    }

    // Evening energy varies by chronotype
    if (adjustedHour >= 20) {
      if (this.chronotype === 'owl') {
        energy += 0.2;
      } else if (this.chronotype === 'lark') {
        energy -= 0.3;
      }
    }

    return Math.max(0, Math.min(1, energy));
  }

  /**
   * Calculate attention/focus level
   */
  private calculateAttentionLevel(hour: number): number {
    const adjustedHour = this.adjustForChronotype(hour);

    // Peak attention typically 2-4 hours after waking and again in early evening
    let attention = 0.3;

    if (adjustedHour >= 9 && adjustedHour < 12) {
      attention = 0.9; // Morning peak
    } else if (adjustedHour >= 15 && adjustedHour < 18) {
      attention = 0.7; // Afternoon peak
    } else if (adjustedHour >= 12 && adjustedHour < 15) {
      attention = 0.4; // Post-lunch dip
    } else if (adjustedHour >= 21 || adjustedHour < 6) {
      attention = 0.2; // Night/sleep time
    }

    return attention;
  }

  /**
   * Calculate sleep pressure (process S - homeostatic sleep drive)
   */
  private calculateSleepPressure(hour: number): number {
    const hoursSinceWake = (hour - this.wakeTime + 24) % 24;

    // Sleep pressure builds linearly throughout day
    let pressure = hoursSinceWake / 16; // Assuming 16 hours awake

    // Circadian influence (process C) counteracts sleep pressure during day
    const circadianAlert = Math.sin((hour - 12) * Math.PI / 12) * 0.3;
    pressure -= circadianAlert;

    return Math.max(0, Math.min(1, pressure));
  }

  /**
   * Get biological prime time window
   */
  getBiologicalPrimeTime(date: Date): BiologicalPrimeTime | null {
    const hour = this.getLocalHour(date);
    const adjustedHour = this.adjustForChronotype(hour);

    // Prime time is when energy + focus + creativity are all high
    let primeStart = 9;
    let primeEnd = 11;

    if (this.chronotype === 'lark') {
      primeStart = 8;
      primeEnd = 10;
    } else if (this.chronotype === 'owl') {
      primeStart = 10;
      primeEnd = 12;
    }

    if (adjustedHour >= primeStart && adjustedHour < primeEnd) {
      const start = new Date(date);
      start.setHours(primeStart, 0, 0, 0);

      const end = new Date(date);
      end.setHours(primeEnd, 0, 0, 0);

      return {
        start,
        end,
        energyLevel: 0.9,
        focusLevel: 0.95,
        creativityLevel: 0.85
      };
    }

    return null;
  }

  /**
   * Optimize task scheduling based on circadian rhythm
   */
  optimizeTaskSchedule(tasks: Array<{ name: string; type: string; duration: number }>): Array<{ name: string; scheduledTime: Date; reason: string }> {
    const now = new Date();
    const schedule: Array<{ name: string; scheduledTime: Date; reason: string }> = [];
    let currentTime = new Date(now);

    // Sort tasks by optimal timing
    const prioritized = tasks.map(task => {
      let optimalHours: number[] = [];
      let reason = '';

      if (task.type === 'analytical' || task.type === 'coding' || task.type === 'learning') {
        optimalHours = [9, 10, 11]; // Morning peak
        reason = 'Scheduled during focus peak for optimal cognitive performance';
      } else if (task.type === 'creative' || task.type === 'brainstorming') {
        optimalHours = [10, 11, 16, 17, 20, 21]; // Morning and evening
        reason = 'Scheduled when creativity and divergent thinking are enhanced';
      } else if (task.type === 'collaborative' || task.type === 'meetings') {
        optimalHours = [14, 15, 16]; // Afternoon
        reason = 'Scheduled during coordination peak for better social interaction';
      } else if (task.type === 'routine' || task.type === 'admin') {
        optimalHours = [13, 14, 17, 18]; // Non-peak hours
        reason = 'Scheduled during lower-focus periods for routine work';
      } else {
        optimalHours = [10, 11, 15, 16]; // Default
        reason = 'Scheduled during moderate energy and focus periods';
      }

      return { ...task, optimalHours, reason };
    });

    prioritized.forEach(task => {
      // Find next optimal time slot
      const targetHour = task.optimalHours[0];
      const scheduledTime = new Date(currentTime);

      if (scheduledTime.getHours() < targetHour) {
        scheduledTime.setHours(targetHour, 0, 0, 0);
      } else {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        scheduledTime.setHours(targetHour, 0, 0, 0);
      }

      schedule.push({
        name: task.name,
        scheduledTime,
        reason: task.reason
      });

      currentTime = new Date(scheduledTime.getTime() + task.duration * 60 * 60 * 1000);
    });

    return schedule;
  }

  /**
   * Calculate optimal sleep schedule
   */
  calculateOptimalSleep(targetWakeTime: Date): SleepCycle {
    // Average sleep cycle is 90 minutes, aim for 5-6 complete cycles
    const cycleMinutes = 90;
    const targetCycles = 5; // 7.5 hours
    const sleepDuration = (targetCycles * cycleMinutes) / 60;

    const wakeTime = new Date(targetWakeTime);
    const bedtime = new Date(wakeTime.getTime() - sleepDuration * 60 * 60 * 1000);

    // Adjust bedtime back 15 minutes for falling asleep
    bedtime.setMinutes(bedtime.getMinutes() - 15);

    return {
      bedtime,
      wakeTime,
      duration: sleepDuration,
      quality: 0.85, // Estimated quality for complete cycles
      cycles: targetCycles
    };
  }

  /**
   * Detect chronotype from sleep/wake patterns
   */
  static detectChronotype(averageWakeTime: number, averageSleepTime: number): Chronotype {
    const midSleep = (averageSleepTime + averageWakeTime + 24) / 2 % 24;

    if (midSleep < 3 || midSleep >= 23) {
      return 'lark'; // Early chronotype
    } else if (midSleep >= 4 && midSleep < 6) {
      return 'owl'; // Late chronotype
    } else {
      return 'third-bird'; // Intermediate
    }
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(phase: CircadianPhase, energy: number, attention: number): string[] {
    const recommendations: string[] = [];

    recommendations.push(`Current phase: ${phase.phase}`);
    recommendations.push(`Optimal for: ${phase.optimalFor.join(', ')}`);

    if (energy < 0.4) {
      recommendations.push('⚡ Energy is low - consider a short break, walk, or healthy snack');
    }

    if (attention < 0.5) {
      recommendations.push('🎯 Focus is reduced - best time for routine tasks or collaboration');
    } else if (attention > 0.8) {
      recommendations.push('🚀 Peak focus time - ideal for your most challenging work');
    }

    if (phase.phase === 'melatonin-rise') {
      recommendations.push('🌙 Wind-down period - reduce screen brightness and prepare for sleep');
    }

    return recommendations;
  }

  /**
   * Adjust hour based on chronotype
   */
  private adjustForChronotype(hour: number): number {
    if (this.chronotype === 'lark') {
      return (hour - 1 + 24) % 24; // Shift earlier
    } else if (this.chronotype === 'owl') {
      return (hour + 2) % 24; // Shift later
    }
    return hour;
  }

  /**
   * Get local hour from date
   */
  private getLocalHour(date: Date): number {
    return date.getHours();
  }

  /**
   * Update settings
   */
  setChronotype(chronotype: Chronotype): void {
    this.chronotype = chronotype;
  }

  setWakeSleepTimes(wakeTime: number, sleepTime: number): void {
    this.wakeTime = wakeTime;
    this.sleepTime = sleepTime;
  }

  /**
   * Get circadian rhythm report
   */
  getCircadianReport(date: Date = new Date()): string {
    const state = this.getCurrentState(date);

    let report = `⏰ Circadian Status Report\n\n`;
    report += `Time: ${state.localHour}:00 (${this.chronotype} chronotype)\n`;
    report += `Phase: ${state.phase.phase}\n\n`;
    report += `📊 Current Levels:\n`;
    report += `  Energy: ${'█'.repeat(Math.round(state.energyLevel * 10))}${'░'.repeat(10 - Math.round(state.energyLevel * 10))} ${(state.energyLevel * 100).toFixed(0)}%\n`;
    report += `  Focus:  ${'█'.repeat(Math.round(state.attentionLevel * 10))}${'░'.repeat(10 - Math.round(state.attentionLevel * 10))} ${(state.attentionLevel * 100).toFixed(0)}%\n`;
    report += `  Sleep:  ${'█'.repeat(Math.round(state.sleepPressure * 10))}${'░'.repeat(10 - Math.round(state.sleepPressure * 10))} ${(state.sleepPressure * 100).toFixed(0)}%\n\n`;

    if (state.primeTime) {
      report += `⭐ BIOLOGICAL PRIME TIME ACTIVE\n`;
      report += `   ${state.primeTime.start.getHours()}:00 - ${state.primeTime.end.getHours()}:00\n\n`;
    }

    report += `💡 Recommendations:\n`;
    state.recommendations.forEach(rec => {
      report += `  • ${rec}\n`;
    });

    return report;
  }
}
