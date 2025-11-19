/**
 * Chrono-Adaptive Engine Examples
 *
 * Demonstrations of chrono-adaptation features:
 * - Astronomical awareness
 * - Circadian optimization
 * - Adaptive personality
 * - Solar computing
 */

import {
  ChronoEngine,
  AstronomicalEngine,
  CircadianCompute,
  ChronoPersonality,
  SolarCompute,
  type ComputeTask
} from './index';

/**
 * Example 1: Real-time Chrono Status
 */
export function exampleChronoStatus() {
  console.log('🌍 EXAMPLE 1: Real-time Chrono Status\n');

  const engine = new ChronoEngine(37.7749, -122.4194, 'third-bird'); // San Francisco
  const report = engine.generateReport();

  console.log(report);
}

/**
 * Example 2: Moon Phase Personality Shifts
 */
export function exampleMoonPersonality() {
  console.log('🌙 EXAMPLE 2: Moon Phase Personality Shifts\n');

  const astro = new AstronomicalEngine();
  const circadian = new CircadianCompute();
  const personality = new ChronoPersonality();

  // Simulate different moon phases
  const phases = [
    { name: 'New Moon', date: new Date('2025-01-29') },
    { name: 'First Quarter', date: new Date('2025-02-05') },
    { name: 'Full Moon', date: new Date('2025-02-12') },
    { name: 'Last Quarter', date: new Date('2025-02-20') }
  ];

  phases.forEach(({ name, date }) => {
    const celestial = astro.getCurrentState(date);
    const circadianState = circadian.getCurrentState(date);
    const personalityState = personality.getPersonalityState(celestial, circadianState);

    console.log(`\n${name} (${celestial.lunar.phase}):`);
    console.log(`  Energy: ${(personalityState.energy * 100).toFixed(0)}%`);
    console.log(`  Creativity: ${(personalityState.creativity * 100).toFixed(0)}%`);
    console.log(`  Spirituality: ${(personalityState.spirituality * 100).toFixed(0)}%`);
    console.log(`  Dominant: ${personalityState.dominant}`);
    console.log(`  Top Traits: ${personalityState.traits.slice(0, 3).map(t => t.name).join(', ')}`);
  });
}

/**
 * Example 3: Circadian Task Optimization
 */
export function exampleCircadianTasks() {
  console.log('\n⏰ EXAMPLE 3: Circadian Task Optimization\n');

  const circadian = new CircadianCompute('third-bird', 'America/Los_Angeles', 7, 23);

  const tasks = [
    { name: 'Deep work coding session', type: 'analytical', duration: 3 },
    { name: 'Team brainstorming meeting', type: 'creative', duration: 1 },
    { name: 'Client presentation', type: 'collaborative', duration: 2 },
    { name: 'Email and admin tasks', type: 'routine', duration: 1 },
    { name: 'Learning new framework', type: 'learning', duration: 2 }
  ];

  const schedule = circadian.optimizeTaskSchedule(tasks);

  console.log('Optimized Task Schedule:\n');
  schedule.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name}`);
    console.log(`   Scheduled: ${item.scheduledTime.toLocaleTimeString()}`);
    console.log(`   Reason: ${item.reason}\n`);
  });
}

/**
 * Example 4: Follow-The-Sun Computing
 */
export function exampleSolarCompute() {
  console.log('\n☀️ EXAMPLE 4: Follow-The-Sun Computing\n');

  const solar = new SolarCompute();

  // Create sample compute tasks
  const tasks: ComputeTask[] = [
    {
      id: 'ml-training-1',
      priority: 'high',
      estimatedDuration: 8,
      powerRequirement: 500,
      carbonBudget: 50000
    },
    {
      id: 'data-processing-2',
      priority: 'medium',
      estimatedDuration: 4,
      powerRequirement: 200
    },
    {
      id: 'backup-job-3',
      priority: 'low',
      estimatedDuration: 2,
      powerRequirement: 100
    },
    {
      id: 'analytics-4',
      priority: 'medium',
      estimatedDuration: 3,
      powerRequirement: 150
    }
  ];

  // Schedule following the sun
  const schedules = solar.scheduleFollowTheSun(tasks);

  console.log('Solar-Optimized Compute Schedule:\n');
  schedules.forEach((schedule, i) => {
    console.log(`${i + 1}. ${schedule.task.id} [${schedule.task.priority}]`);
    console.log(`   Region: ${schedule.region.name}`);
    console.log(`   Start: ${schedule.scheduledStart.toLocaleString()}`);
    console.log(`   Energy Source: ${schedule.energySource}`);
    console.log(`   Carbon: ${(schedule.estimatedCarbon / 1000).toFixed(2)} kg CO2`);
    console.log(`   Savings: ${(schedule.carbonSavings / 1000).toFixed(2)} kg CO2\n`);
  });

  // Generate report
  const report = solar.generateReport(schedules);
  console.log(report);
}

/**
 * Example 5: 24-Hour Cosmic Cycle
 */
export function exampleCosmicCycle() {
  console.log('\n🌌 EXAMPLE 5: 24-Hour Cosmic Cycle\n');

  const engine = new ChronoEngine();
  const now = new Date();

  console.log('Personality Evolution Over 24 Hours:\n');

  for (let hour = 0; hour < 24; hour += 4) {
    const testDate = new Date(now);
    testDate.setHours(hour, 0, 0, 0);

    const state = engine.getCurrentState(testDate);

    console.log(`\n${hour}:00 - ${state.personality.dominant}`);
    console.log(`  Energy: ${'█'.repeat(Math.round(state.personality.energy * 10))}`);
    console.log(`  Creativity: ${'█'.repeat(Math.round(state.personality.creativity * 10))}`);
    console.log(`  Focus: ${'█'.repeat(Math.round(state.circadian.attentionLevel * 10))}`);
  }
}

/**
 * Example 6: Adaptive Response Modulation
 */
export function exampleAdaptiveResponse() {
  console.log('\n💬 EXAMPLE 6: Adaptive Response Modulation\n');

  const engine = new ChronoEngine();

  // Simulate different times of day
  const times = [
    { hour: 6, label: 'Dawn' },
    { hour: 10, label: 'Morning' },
    { hour: 14, label: 'Afternoon' },
    { hour: 18, label: 'Dusk' },
    { hour: 22, label: 'Night' }
  ];

  const sampleText = "Let's explore the possibilities of this new approach.";

  console.log('Original text:', sampleText, '\n');

  times.forEach(({ hour, label }) => {
    const testDate = new Date();
    testDate.setHours(hour, 0, 0, 0);

    const state = engine.getCurrentState(testDate);
    const modulated = engine.personality.modulateResponse(sampleText, state.personality);

    console.log(`${label} (${hour}:00):`);
    console.log(`  "${modulated}"`);
    console.log(`  Tone: ${state.personality.tone}\n`);
  });
}

/**
 * Example 7: Seasonal Comparison
 */
export function exampleSeasonalShifts() {
  console.log('\n🍂 EXAMPLE 7: Seasonal Personality Shifts\n');

  const engine = new ChronoEngine();

  const seasons = [
    { month: 2, day: 20, name: 'Spring Equinox' },
    { month: 5, day: 21, name: 'Summer Solstice' },
    { month: 8, day: 22, name: 'Autumn Equinox' },
    { month: 11, day: 21, name: 'Winter Solstice' }
  ];

  seasons.forEach(({ month, day, name }) => {
    const date = new Date(2025, month, day, 12, 0, 0); // Noon
    const state = engine.getCurrentState(date);

    console.log(`\n${name} (${state.celestial.season}):`);
    console.log(`  Energy: ${(state.personality.energy * 100).toFixed(0)}%`);
    console.log(`  Creativity: ${(state.personality.creativity * 100).toFixed(0)}%`);
    console.log(`  Spirituality: ${(state.personality.spirituality * 100).toFixed(0)}%`);
    console.log(`  Top Traits: ${state.personality.traits.slice(0, 3).map((t: any) => t.name).join(', ')}`);
  });
}

/**
 * Example 8: Solar Forecast
 */
export function exampleSolarForecast() {
  console.log('\n🌞 EXAMPLE 8: 24-Hour Solar Computing Forecast\n');

  const solar = new SolarCompute();
  const forecast = solar.getSolarForecast();

  console.log('Hour | Optimal Regions | Solar Capacity');
  console.log('-----|----------------|---------------');

  forecast.forEach(({ hour, optimalRegions, totalSolarCapacity }) => {
    const h = hour.getHours().toString().padStart(2, '0');
    const regions = optimalRegions.toString().padStart(2, ' ');
    const capacity = `${(totalSolarCapacity / 1000).toFixed(1)} GW`;

    console.log(`${h}:00 | ${regions}             | ${capacity}`);
  });
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   CHRONO-ADAPTIVE ENGINE - COMPLETE DEMONSTRATIONS       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  exampleChronoStatus();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleMoonPersonality();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleCircadianTasks();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleSolarCompute();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleCosmicCycle();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleAdaptiveResponse();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleSeasonalShifts();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleSolarForecast();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   All examples completed successfully!                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  const example = args[0];

  switch (example) {
    case '1':
    case 'status':
      exampleChronoStatus();
      break;
    case '2':
    case 'moon':
      exampleMoonPersonality();
      break;
    case '3':
    case 'circadian':
      exampleCircadianTasks();
      break;
    case '4':
    case 'solar':
      exampleSolarCompute();
      break;
    case '5':
    case 'cycle':
      exampleCosmicCycle();
      break;
    case '6':
    case 'adaptive':
      exampleAdaptiveResponse();
      break;
    case '7':
    case 'seasonal':
      exampleSeasonalShifts();
      break;
    case '8':
    case 'forecast':
      exampleSolarForecast();
      break;
    case 'all':
    default:
      runAllExamples();
  }
}
