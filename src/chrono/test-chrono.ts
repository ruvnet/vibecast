#!/usr/bin/env ts-node
/**
 * Quick test of Chrono Engine functionality
 */

import { ChronoEngine } from './index';

async function testChronoEngine() {
  console.log('🧪 Testing Chrono-Adaptive Engine\n');

  try {
    // Initialize engine for San Francisco
    const engine = new ChronoEngine(37.7749, -122.4194, 'third-bird');
    console.log('✅ Chrono Engine initialized successfully\n');

    // Get current state
    const state = engine.getCurrentState();
    console.log('✅ Retrieved current chrono state\n');

    // Test astronomical engine
    console.log('🌙 Lunar Phase:', state.celestial.lunar.phase);
    console.log('🌕 Illumination:', (state.celestial.lunar.illumination * 100).toFixed(1) + '%');
    console.log('☀️ Solar Activity:', (state.celestial.solar.activity * 100).toFixed(1) + '%');
    console.log('🌍 Season:', state.celestial.season);
    console.log('✨ Cosmic Intensity:', (state.celestial.cosmicIntensity * 100).toFixed(1) + '%\n');

    // Test circadian system
    console.log('⏰ Local Hour:', state.circadian.localHour + ':00');
    console.log('⚡ Energy Level:', (state.circadian.energyLevel * 100).toFixed(0) + '%');
    console.log('🎯 Focus Level:', (state.circadian.attentionLevel * 100).toFixed(0) + '%');
    console.log('😴 Sleep Pressure:', (state.circadian.sleepPressure * 100).toFixed(0) + '%\n');

    // Test personality system
    console.log('🎭 Personality:', state.personality.dominant);
    console.log('💫 Energy:', (state.personality.energy * 100).toFixed(0) + '%');
    console.log('🎨 Creativity:', (state.personality.creativity * 100).toFixed(0) + '%');
    console.log('🧘 Spirituality:', (state.personality.spirituality * 100).toFixed(0) + '%\n');

    // Test solar computing
    console.log('☀️ Optimal Solar Regions:', state.solar.length);
    if (state.solar.length > 0) {
      console.log('   Top Region:', state.solar[0].region.name);
      console.log('   Solar Potential:', (state.solar[0].solarPotential * 100).toFixed(1) + '%\n');
    }

    console.log('✅ All systems functional!\n');
    console.log('🎉 Chrono-Adaptive Engine is ready for VibeCast Xenosphere\n');

    return true;
  } catch (error) {
    console.error('❌ Error testing Chrono Engine:', error);
    return false;
  }
}

// Run test if executed directly
if (require.main === module) {
  testChronoEngine().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testChronoEngine };
