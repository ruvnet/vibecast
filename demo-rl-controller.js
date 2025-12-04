#!/usr/bin/env node

/**
 * Demo: Universal RL Controller across multiple energy systems
 * Quick demonstration of the modular RL control system
 */

const UniversalRLController = require('./src/rl/universal-rl-controller');

async function demoSystem(systemType, episodes = 5) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`DEMO: ${systemType.toUpperCase()} CONTROL`);
  console.log('═'.repeat(70));

  const controller = new UniversalRLController({
    systemType,
    systemId: `DEMO-${systemType}`,
    algorithm: 'PPO',
    stateDim: 16,
    actionDim: 8
  });

  console.log(`✓ ${systemType} controller initialized\n`);

  // Run a few episodes
  for (let ep = 0; ep < episodes; ep++) {
    const result = await controller.trainEpisode(200); // Short episodes for demo

    console.log(
      `Episode ${ep + 1}: Reward = ${result.episodeReward.toFixed(2)}, ` +
      `Steps = ${result.steps}`
    );
  }

  // Evaluate
  console.log('\nEvaluation (3 deterministic episodes):');
  const evalResult = await controller.evaluate(3);
  console.log(`  Avg Reward: ${evalResult.avgReward.toFixed(2)}`);
  console.log(`  Avg Steps: ${evalResult.avgSteps.toFixed(0)}\n`);

  return controller;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║      UNIVERSAL RL CONTROLLER - MULTI-SYSTEM DEMONSTRATION     ║');
  console.log('║                                                               ║');
  console.log('║  Showcasing modular RL control across:                       ║');
  console.log('║  • Nuclear Fission (PWR reactors)                            ║');
  console.log('║  • Nuclear Fusion (Tokamaks)                                 ║');
  console.log('║  • Solar Farms                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    // Demo 1: Nuclear Fission
    await demoSystem('nuclear-fission', 5);

    // Demo 2: Nuclear Fusion
    await demoSystem('nuclear-fusion', 5);

    // Demo 3: Solar Farm
    await demoSystem('solar', 5);

    console.log('\n' + '═'.repeat(70));
    console.log('DEMONSTRATION COMPLETE');
    console.log('═'.repeat(70));

    console.log('\n✓ Successfully demonstrated RL control across 3 energy systems');
    console.log('✓ Each system uses the same universal controller architecture');
    console.log('✓ Modular adapters handle system-specific physics and constraints\n');

    console.log('Next steps:');
    console.log('  - Run full training: node train-rl-controller.js nuclear-fission PPO 100');
    console.log('  - Benchmark performance: node train-rl-controller.js solar SAC 200');
    console.log('  - Transfer learning: Use trained policies across similar systems\n');

  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { demoSystem };
