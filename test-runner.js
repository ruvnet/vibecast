#!/usr/bin/env node

/**
 * Test Runner for Nuclear Power Plant Simulation
 * Runs simulation without E2B agents for quick testing
 */

const ReactorControlSystem = require('./src/simulation/ics/reactor-control');
const SupplyChainManagement = require('./src/simulation/supply-chain/logistics');
const HumanResourcesManagement = require('./src/simulation/hr/workforce');
const BusinessOperations = require('./src/simulation/business/operations');
const ReportGenerator = require('./src/utils/report-generator');

class TestRunner {
  constructor() {
    this.plantId = 'NPP-TEST-01';
    this.timestep = 1000;
    this.iterations = 60; // 1 minute test

    this.reactor = new ReactorControlSystem({ reactorId: `${this.plantId}-REACTOR` });
    this.supplyChain = new SupplyChainManagement({ plantId: this.plantId });
    this.hr = new HumanResourcesManagement({ plantId: this.plantId });
    this.business = new BusinessOperations({ plantId: this.plantId });
    this.reportGenerator = new ReportGenerator({ plantId: this.plantId });

    this.simulationData = [];
  }

  async runTest() {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║           NUCLEAR POWER PLANT SIMULATION - TEST MODE                 ║');
    console.log('║                   (Without Federated Agents)                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Testing ${this.iterations} iterations...`);
    console.log('This will run all simulation modules WITHOUT E2B agents\n');

    const startTime = Date.now();

    for (let i = 0; i < this.iterations; i++) {
      try {
        // Run all simulations concurrently
        const [reactorState, supplyChainState, hrState, businessState] = await Promise.all([
          this.reactor.simulate(this.timestep),
          this.supplyChain.simulate(this.timestep),
          this.hr.simulate(this.timestep),
          this.business.simulate(this.timestep, this.reactor.getState())
        ]);

        const stepData = {
          iteration: i,
          timestamp: Date.now(),
          plantId: this.plantId,
          reactor: reactorState,
          supplyChain: supplyChainState,
          hr: hrState,
          business: businessState
        };

        stepData.plantHealth = this.calculatePlantHealth(stepData);
        this.simulationData.push(stepData);

        // Log every 10 iterations
        if (i % 10 === 0) {
          console.log(`[${i}/${this.iterations}] ` +
                     `Health: ${stepData.plantHealth.toFixed(1)}% | ` +
                     `Reactor: ${reactorState.status} | ` +
                     `Power: ${reactorState.powerOutput.toFixed(0)}MW | ` +
                     `Temp: ${reactorState.coreTemperature.toFixed(1)}°C`);
        }

        // Simulate some reactor dynamics
        if (i === 20) {
          console.log('  → Increasing power output...');
          this.reactor.setControlRods(40);
        }

        if (i === 40) {
          console.log('  → Reducing power output...');
          this.reactor.setControlRods(60);
        }

      } catch (error) {
        console.error(`Error at iteration ${i}:`, error.message);
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n${'='.repeat(80)}`);
    console.log('TEST COMPLETE');
    console.log(`${'='.repeat(80)}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Iterations: ${this.iterations}`);
    console.log(`Rate: ${(this.iterations / duration).toFixed(2)} iterations/second`);

    // Generate summary
    this.printSummary();

    // Generate test report
    console.log('\nGenerating test report...');
    await this.generateTestReport();

    console.log('\n✓ Test completed successfully');
    console.log('Check /reports directory for output files\n');
  }

  calculatePlantHealth(data) {
    let health = 100;

    if (data.reactor) {
      const reactorHealth = (data.reactor.safetyMargin / 100) * 30;
      health = reactorHealth;

      if (data.reactor.status !== 'OPERATIONAL') {
        health *= 0.5;
      }
    }

    if (data.supplyChain) {
      const fuelLevel = Math.min(data.supplyChain.inventory.nuclearFuel.quantity / 50, 1);
      const wasteLevel = 1 - (data.supplyChain.inventory.wasteStorage.highLevel /
                              data.supplyChain.inventory.wasteStorage.capacity.highLevel);
      health += (fuelLevel * 10 + wasteLevel * 10);
    }

    if (data.hr) {
      health += (data.hr.metrics.staffingLevel / 100) * 10;
      health += (data.hr.metrics.trainingCompliance / 100) * 10;
      health += (data.hr.metrics.certificationCompliance / 100) * 5;
    }

    if (data.business) {
      health += data.business.performance.capacityFactor * 12.5;
      health += data.business.performance.availabilityFactor * 12.5;
    }

    return Math.max(0, Math.min(100, health));
  }

  printSummary() {
    const finalState = this.simulationData[this.simulationData.length - 1];

    console.log('\nSIMULATION SUMMARY');
    console.log(`${'='.repeat(80)}`);

    console.log('\nReactor Performance:');
    console.log(`  Final Status: ${finalState.reactor.status}`);
    console.log(`  Final Power Output: ${finalState.reactor.powerOutput.toFixed(2)} MW`);
    console.log(`  Final Temperature: ${finalState.reactor.coreTemperature.toFixed(2)}°C`);
    console.log(`  Final Safety Margin: ${finalState.reactor.safetyMargin.toFixed(2)}%`);
    console.log(`  Average Power: ${(this.simulationData.reduce((sum, d) => sum + d.reactor.powerOutput, 0) / this.iterations).toFixed(2)} MW`);

    console.log('\nSupply Chain:');
    console.log(`  Fuel Inventory: ${finalState.supplyChain.inventory.nuclearFuel.quantity.toFixed(2)} tons`);
    console.log(`  Active Orders: ${finalState.supplyChain.activeOrders.length}`);
    console.log(`  Waste Storage (High-Level): ${finalState.supplyChain.inventory.wasteStorage.highLevel.toFixed(2)} m³`);

    console.log('\nHuman Resources:');
    console.log(`  Staffing Level: ${finalState.hr.metrics.staffingLevel.toFixed(1)}%`);
    console.log(`  Training Compliance: ${finalState.hr.metrics.trainingCompliance.toFixed(1)}%`);
    console.log(`  Current Shift: ${finalState.hr.currentShift}`);
    console.log(`  Active Personnel: ${finalState.hr.activePersonnel}/${finalState.hr.totalPersonnel}`);

    console.log('\nBusiness Operations:');
    console.log(`  Revenue: $${(finalState.business.financials.revenue / 1000).toFixed(2)}K`);
    console.log(`  Costs: $${(finalState.business.financials.costs / 1000).toFixed(2)}K`);
    console.log(`  Profit: $${(finalState.business.financials.profit / 1000).toFixed(2)}K`);
    console.log(`  Capacity Factor: ${(finalState.business.performance.capacityFactor * 100).toFixed(2)}%`);
    console.log(`  Cash Reserves: $${(finalState.business.financials.cashReserves / 1000000).toFixed(2)}M`);

    console.log('\nOverall:');
    console.log(`  Final Plant Health: ${finalState.plantHealth.toFixed(2)}%`);
    console.log(`  Average Plant Health: ${(this.simulationData.reduce((sum, d) => sum + d.plantHealth, 0) / this.iterations).toFixed(2)}%`);
  }

  async generateTestReport() {
    const summary = {
      plantId: this.plantId,
      totalIterations: this.iterations,
      finalPlantHealth: this.simulationData[this.simulationData.length - 1].plantHealth,
      reactor: {
        finalStatus: this.simulationData[this.simulationData.length - 1].reactor.status,
        avgPowerOutput: this.simulationData.reduce((sum, d) => sum + d.reactor.powerOutput, 0) / this.iterations,
        scramEvents: this.simulationData.filter(d => d.reactor.status === 'SCRAM').length
      },
      business: {
        totalRevenue: this.simulationData[this.simulationData.length - 1].business.financials.revenue,
        totalCosts: this.simulationData[this.simulationData.length - 1].business.financials.costs,
        netProfit: this.simulationData[this.simulationData.length - 1].business.financials.profit,
        avgCapacityFactor: this.simulationData.reduce((sum, d) => sum + d.business.performance.capacityFactor, 0) / this.iterations
      },
      hr: {
        finalStaffing: this.simulationData[this.simulationData.length - 1].hr.metrics.staffingLevel,
        trainingCompliance: this.simulationData[this.simulationData.length - 1].hr.metrics.trainingCompliance
      },
      supplyChain: {
        finalFuelInventory: this.simulationData[this.simulationData.length - 1].supplyChain.inventory.nuclearFuel.quantity,
        wasteGenerated: this.simulationData[this.simulationData.length - 1].supplyChain.inventory.wasteStorage.highLevel
      }
    };

    await this.reportGenerator.generateSimulationReport({
      simulationData: this.simulationData,
      agentAnalyses: [],
      agentResults: [],
      summary: summary
    });
  }
}

// Run test
if (require.main === module) {
  const runner = new TestRunner();
  runner.runTest().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
