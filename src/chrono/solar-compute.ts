/**
 * Follow-The-Sun Computing
 *
 * Route computational tasks to regions with active solar power,
 * minimizing carbon footprint by following Earth's rotation.
 */

import * as SunCalc from 'suncalc';

export interface GeographicRegion {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  solarCapacity: number; // MW
  carbonIntensity: number; // gCO2/kWh
}

export interface SolarWindow {
  region: GeographicRegion;
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  daylightHours: number;
  solarPotential: number; // 0-1, based on sun angle and time
  isOptimal: boolean;
}

export interface ComputeTask {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // hours
  powerRequirement: number; // kWh
  carbonBudget?: number; // max gCO2
}

export interface TaskSchedule {
  task: ComputeTask;
  region: GeographicRegion;
  scheduledStart: Date;
  scheduledEnd: Date;
  estimatedCarbon: number; // gCO2
  energySource: 'solar' | 'mixed' | 'grid';
  carbonSavings: number; // gCO2 saved vs baseline
}

export interface EnergyMetrics {
  totalPowerUsed: number; // kWh
  solarPercentage: number; // 0-100
  carbonEmitted: number; // gCO2
  carbonAvoided: number; // gCO2
  efficiency: number; // 0-1
}

export class SolarCompute {
  private regions: GeographicRegion[];
  private defaultCarbonIntensity: number = 475; // gCO2/kWh (global average)

  constructor() {
    this.regions = this.initializeRegions();
  }

  /**
   * Initialize major solar computing regions
   */
  private initializeRegions(): GeographicRegion[] {
    return [
      {
        name: 'California, USA',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        solarCapacity: 15000,
        carbonIntensity: 240
      },
      {
        name: 'Nevada, USA',
        latitude: 36.1699,
        longitude: -115.1398,
        timezone: 'America/Los_Angeles',
        solarCapacity: 8000,
        carbonIntensity: 380
      },
      {
        name: 'Germany',
        latitude: 52.5200,
        longitude: 13.4050,
        timezone: 'Europe/Berlin',
        solarCapacity: 60000,
        carbonIntensity: 350
      },
      {
        name: 'Spain',
        latitude: 40.4168,
        longitude: -3.7038,
        timezone: 'Europe/Madrid',
        solarCapacity: 25000,
        carbonIntensity: 280
      },
      {
        name: 'Australia',
        latitude: -33.8688,
        longitude: 151.2093,
        timezone: 'Australia/Sydney',
        solarCapacity: 20000,
        carbonIntensity: 650
      },
      {
        name: 'India',
        latitude: 19.0760,
        longitude: 72.8777,
        timezone: 'Asia/Kolkata',
        solarCapacity: 50000,
        carbonIntensity: 720
      },
      {
        name: 'Japan',
        latitude: 35.6762,
        longitude: 139.6503,
        timezone: 'Asia/Tokyo',
        solarCapacity: 70000,
        carbonIntensity: 480
      },
      {
        name: 'Chile',
        latitude: -33.4489,
        longitude: -70.6693,
        timezone: 'America/Santiago',
        solarCapacity: 7000,
        carbonIntensity: 420
      },
      {
        name: 'Morocco',
        latitude: 31.6295,
        longitude: -7.9811,
        timezone: 'Africa/Casablanca',
        solarCapacity: 2000,
        carbonIntensity: 780
      },
      {
        name: 'UAE',
        latitude: 24.4539,
        longitude: 54.3773,
        timezone: 'Asia/Dubai',
        solarCapacity: 5000,
        carbonIntensity: 480
      }
    ];
  }

  /**
   * Find optimal regions for compute at a given time
   */
  findOptimalRegions(date: Date = new Date(), minSolarPotential: number = 0.6): SolarWindow[] {
    const windows = this.regions.map(region => {
      const sunTimes = SunCalc.getTimes(date, region.latitude, region.longitude);
      const sunPosition = SunCalc.getPosition(date, region.latitude, region.longitude);

      const sunrise = sunTimes.sunrise;
      const sunset = sunTimes.sunset;
      const solarNoon = sunTimes.solarNoon;

      const daylightHours = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);

      // Calculate solar potential based on sun altitude and time of day
      const isDaytime = date >= sunrise && date <= sunset;
      const altitude = sunPosition.altitude; // radians
      const altitudeDegrees = altitude * (180 / Math.PI);

      // Solar potential peaks at noon and decreases toward sunrise/sunset
      let solarPotential = 0;
      if (isDaytime && altitudeDegrees > 0) {
        solarPotential = Math.sin(altitude) * 0.8 + 0.2; // 0.2 base + altitude component
      }

      const isOptimal = solarPotential >= minSolarPotential;

      return {
        region,
        sunrise,
        sunset,
        solarNoon,
        daylightHours,
        solarPotential,
        isOptimal
      };
    });

    return windows
      .filter(w => w.isOptimal)
      .sort((a, b) => b.solarPotential - a.solarPotential);
  }

  /**
   * Schedule compute tasks following the sun
   */
  scheduleFollowTheSun(tasks: ComputeTask[], startDate: Date = new Date()): TaskSchedule[] {
    const schedules: TaskSchedule[] = [];
    let currentTime = new Date(startDate);

    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const task of sortedTasks) {
      // Find optimal region at current time
      const optimalRegions = this.findOptimalRegions(currentTime);

      let selectedRegion: GeographicRegion;
      let energySource: 'solar' | 'mixed' | 'grid' = 'solar';

      if (optimalRegions.length > 0) {
        // Choose region with lowest carbon intensity among optimal regions
        selectedRegion = optimalRegions
          .sort((a, b) => a.region.carbonIntensity - b.region.carbonIntensity)[0]
          .region;
        energySource = 'solar';
      } else {
        // No optimal solar regions, use lowest carbon intensity region
        selectedRegion = this.regions
          .sort((a, b) => a.carbonIntensity - b.carbonIntensity)[0];

        // Check if it's at least partially solar
        const windows = this.findOptimalRegions(currentTime, 0.3);
        energySource = windows.length > 0 ? 'mixed' : 'grid';
      }

      const scheduledStart = new Date(currentTime);
      const scheduledEnd = new Date(currentTime.getTime() + task.estimatedDuration * 60 * 60 * 1000);

      // Calculate carbon emissions
      const carbonIntensity = energySource === 'solar'
        ? selectedRegion.carbonIntensity * 0.1 // 90% solar reduction
        : energySource === 'mixed'
        ? selectedRegion.carbonIntensity * 0.5 // 50% solar reduction
        : selectedRegion.carbonIntensity;

      const estimatedCarbon = task.powerRequirement * carbonIntensity;
      const baselineCarbon = task.powerRequirement * this.defaultCarbonIntensity;
      const carbonSavings = baselineCarbon - estimatedCarbon;

      schedules.push({
        task,
        region: selectedRegion,
        scheduledStart,
        scheduledEnd,
        estimatedCarbon,
        energySource,
        carbonSavings
      });

      // Update current time for next task
      currentTime = scheduledEnd;
    }

    return schedules;
  }

  /**
   * Get 24-hour solar availability forecast
   */
  getSolarForecast(startDate: Date = new Date()): Array<{ hour: Date; optimalRegions: number; totalSolarCapacity: number }> {
    const forecast = [];

    for (let i = 0; i < 24; i++) {
      const hour = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const optimal = this.findOptimalRegions(hour);
      const totalCapacity = optimal.reduce((sum, w) => sum + w.region.solarCapacity, 0);

      forecast.push({
        hour,
        optimalRegions: optimal.length,
        totalSolarCapacity: totalCapacity
      });
    }

    return forecast;
  }

  /**
   * Calculate energy metrics for scheduled tasks
   */
  calculateMetrics(schedules: TaskSchedule[]): EnergyMetrics {
    let totalPowerUsed = 0;
    let solarPower = 0;
    let carbonEmitted = 0;
    let carbonAvoided = 0;

    schedules.forEach(schedule => {
      totalPowerUsed += schedule.task.powerRequirement;
      carbonEmitted += schedule.estimatedCarbon;
      carbonAvoided += schedule.carbonSavings;

      if (schedule.energySource === 'solar') {
        solarPower += schedule.task.powerRequirement;
      } else if (schedule.energySource === 'mixed') {
        solarPower += schedule.task.powerRequirement * 0.5;
      }
    });

    const solarPercentage = totalPowerUsed > 0 ? (solarPower / totalPowerUsed) * 100 : 0;
    const efficiency = carbonAvoided / (carbonEmitted + carbonAvoided);

    return {
      totalPowerUsed,
      solarPercentage,
      carbonEmitted,
      carbonAvoided,
      efficiency
    };
  }

  /**
   * Get current solar compute status
   */
  getCurrentSolarStatus(date: Date = new Date()): string {
    const optimal = this.findOptimalRegions(date);
    const totalCapacity = optimal.reduce((sum, w) => sum + w.region.solarCapacity, 0);

    let status = `☀️ Solar Compute Status\n\n`;
    status += `Timestamp: ${date.toISOString()}\n`;
    status += `Optimal Regions: ${optimal.length}/${this.regions.length}\n`;
    status += `Total Solar Capacity: ${totalCapacity.toLocaleString()} MW\n\n`;

    if (optimal.length > 0) {
      status += `🌞 Currently Optimal Regions:\n`;
      optimal.slice(0, 5).forEach(window => {
        status += `  • ${window.region.name}\n`;
        status += `    Solar Potential: ${(window.solarPotential * 100).toFixed(1)}%\n`;
        status += `    Carbon Intensity: ${window.region.carbonIntensity} gCO2/kWh\n`;
        status += `    Daylight: ${window.daylightHours.toFixed(1)} hours\n`;
      });
    } else {
      status += `🌙 No optimal solar regions at this time\n`;
      status += `Consider scheduling tasks for later or using low-carbon grid regions\n`;
    }

    return status;
  }

  /**
   * Recommend optimal time to start compute task
   */
  recommendStartTime(task: ComputeTask, searchWindow: number = 48): { time: Date; region: string; reason: string } {
    let bestTime = new Date();
    let bestRegion = '';
    let bestScore = -1;

    for (let hour = 0; hour < searchWindow; hour++) {
      const time = new Date(Date.now() + hour * 60 * 60 * 1000);
      const optimal = this.findOptimalRegions(time);

      if (optimal.length > 0) {
        const best = optimal[0];
        // Score based on solar potential and carbon intensity
        const score = best.solarPotential * 1000 / best.region.carbonIntensity;

        if (score > bestScore) {
          bestScore = score;
          bestTime = time;
          bestRegion = best.region.name;
        }
      }
    }

    const hoursUntil = (bestTime.getTime() - Date.now()) / (1000 * 60 * 60);

    return {
      time: bestTime,
      region: bestRegion,
      reason: `Optimal solar conditions in ${hoursUntil.toFixed(1)} hours at ${bestRegion}`
    };
  }

  /**
   * Add custom region
   */
  addRegion(region: GeographicRegion): void {
    this.regions.push(region);
  }

  /**
   * Get all regions
   */
  getRegions(): GeographicRegion[] {
    return [...this.regions];
  }

  /**
   * Generate solar compute report
   */
  generateReport(schedules: TaskSchedule[]): string {
    const metrics = this.calculateMetrics(schedules);

    let report = `📊 Solar Compute Report\n\n`;
    report += `Tasks Scheduled: ${schedules.length}\n`;
    report += `Total Energy: ${metrics.totalPowerUsed.toFixed(2)} kWh\n`;
    report += `Solar Coverage: ${metrics.solarPercentage.toFixed(1)}%\n`;
    report += `Carbon Emitted: ${(metrics.carbonEmitted / 1000).toFixed(2)} kg CO2\n`;
    report += `Carbon Avoided: ${(metrics.carbonAvoided / 1000).toFixed(2)} kg CO2\n`;
    report += `Efficiency: ${(metrics.efficiency * 100).toFixed(1)}%\n\n`;

    report += `🌍 Regional Distribution:\n`;
    const regionCounts = new Map<string, number>();
    schedules.forEach(s => {
      const count = regionCounts.get(s.region.name) || 0;
      regionCounts.set(s.region.name, count + 1);
    });

    Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        report += `  • ${region}: ${count} tasks\n`;
      });

    return report;
  }
}
