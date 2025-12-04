#!/usr/bin/env node

/**
 * Nuclear Power Plant Management Simulation
 * High-fidelity simulation with federated agents
 */

const SimulationOrchestrator = require('./src/orchestrator/simulation-orchestrator');

// Configuration
const config = {
  plantId: 'NPP-VIBECAST-01',
  timestep: 1000, // 1 second
  duration: 120000, // 2 minutes (120 seconds)
  agentCount: 5
};

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║   NEXT GENERATION NUCLEAR POWER PLANT MANAGEMENT SIMULATION           ║');
  console.log('║                                                                       ║');
  console.log('║   Powered by:                                                         ║');
  console.log('║   • ruvector - Vector database for telemetry                          ║');
  console.log('║   • agentic-flow - Agent orchestration                                ║');
  console.log('║   • @ruvector/ruvllm - SIMD-optimized LLM inference                   ║');
  console.log('║   • E2B - Federated agent sandboxes                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  // Verify E2B API key
  if (!process.env.E2B_API_KEY) {
    console.error('ERROR: E2B_API_KEY environment variable not set');
    console.error('Please set E2B_API_KEY before running the simulation');
    process.exit(1);
  }

  try {
    // Create orchestrator
    const orchestrator = new SimulationOrchestrator(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutdown signal received...');
      orchestrator.stop();
      await orchestrator.cleanup();
      process.exit(0);
    });

    // Run simulation
    const success = await orchestrator.runSimulation();

    if (success) {
      console.log('\n✓ Simulation completed successfully');
      console.log('\nReports generated in ./reports directory:');
      console.log('  - /reports/federated/ - Comprehensive simulation reports');
      console.log('  - /reports/ics/ - Reactor control system data');
      console.log('  - /reports/supply-chain/ - Supply chain metrics');
      console.log('  - /reports/hr/ - Human resources data');
      console.log('  - /reports/business/ - Business operations reports');
      process.exit(0);
    } else {
      console.error('\n✗ Simulation failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run simulation
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { SimulationOrchestrator };
