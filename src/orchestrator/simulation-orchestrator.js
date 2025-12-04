/**
 * Main Simulation Orchestrator
 * Coordinates all simulation modules and federated agents
 */

const ReactorControlSystem = require('../simulation/ics/reactor-control');
const SupplyChainManagement = require('../simulation/supply-chain/logistics');
const HumanResourcesManagement = require('../simulation/hr/workforce');
const BusinessOperations = require('../simulation/business/operations');
const FederatedAgent = require('../agents/federated-agent');
const ReportGenerator = require('../utils/report-generator');

class SimulationOrchestrator {
  constructor(config = {}) {
    this.plantId = config.plantId || 'NPP-01';
    this.timestep = config.timestep || 1000; // 1 second default
    this.simulationDuration = config.duration || 60000; // 1 minute default

    // Initialize simulation modules
    this.reactor = new ReactorControlSystem({ reactorId: `${this.plantId}-REACTOR` });
    this.supplyChain = new SupplyChainManagement({ plantId: this.plantId });
    this.hr = new HumanResourcesManagement({ plantId: this.plantId });
    this.business = new BusinessOperations({ plantId: this.plantId });

    // Federated agents
    this.agents = [];
    this.agentCount = config.agentCount || 5;

    // Reporting
    this.reportGenerator = new ReportGenerator({ plantId: this.plantId });

    // Simulation state
    this.isRunning = false;
    this.currentTime = 0;
    this.iterations = 0;
    this.simulationData = [];
  }

  /**
   * Initialize all federated agents
   */
  async initializeAgents() {
    console.log(`Initializing ${this.agentCount} federated agents...`);

    const agentRoles = [
      'reactor-safety',
      'supply-chain',
      'workforce',
      'financial',
      'general'
    ];

    const agentPromises = [];

    for (let i = 0; i < this.agentCount; i++) {
      const agent = new FederatedAgent({
        agentId: `AGENT-${i + 1}`,
        role: agentRoles[i % agentRoles.length],
        apiKey: process.env.E2B_API_KEY
      });

      this.agents.push(agent);
      agentPromises.push(agent.initialize());
    }

    // Initialize all agents concurrently
    const results = await Promise.all(agentPromises);
    const successCount = results.filter(r => r).length;

    console.log(`${successCount}/${this.agentCount} agents initialized successfully`);

    return successCount === this.agentCount;
  }

  /**
   * Run simulation for one timestep
   */
  async runSimulationStep() {
    const stepData = {
      iteration: this.iterations,
      timestamp: Date.now(),
      plantId: this.plantId
    };

    try {
      // Run all simulations concurrently
      const [reactorState, supplyChainState, hrState, businessState] = await Promise.all([
        this.reactor.simulate(this.timestep),
        this.supplyChain.simulate(this.timestep),
        this.hr.simulate(this.timestep),
        this.business.simulate(this.timestep, this.reactor.getState())
      ]);

      stepData.reactor = reactorState;
      stepData.supplyChain = supplyChainState;
      stepData.hr = hrState;
      stepData.business = businessState;

      // Calculate overall plant health
      stepData.plantHealth = this.calculatePlantHealth(stepData);

      this.simulationData.push(stepData);
      this.iterations++;

      return stepData;

    } catch (error) {
      console.error('Simulation step error:', error.message);
      stepData.error = error.message;
      return stepData;
    }
  }

  /**
   * Run federated agent analysis
   */
  async runAgentAnalysis(simulationData) {
    console.log('\nRunning federated agent analysis...');

    const analysisPromises = this.agents.map(agent =>
      agent.analyze(simulationData)
    );

    // Run all agent analyses concurrently
    const analyses = await Promise.all(analysisPromises);

    return analyses.filter(a => a !== null);
  }

  /**
   * Calculate overall plant health score
   */
  calculatePlantHealth(data) {
    let healthScore = 100;

    // Reactor health (30% weight)
    if (data.reactor) {
      const reactorHealth = (data.reactor.safetyMargin / 100) * 30;
      healthScore = reactorHealth;

      if (data.reactor.status !== 'OPERATIONAL') {
        healthScore *= 0.5;
      }
    }

    // Supply chain health (20% weight)
    if (data.supplyChain) {
      const fuelLevel = Math.min(data.supplyChain.inventory.nuclearFuel.quantity / 50, 1);
      const wasteLevel = 1 - (data.supplyChain.inventory.wasteStorage.highLevel /
                              data.supplyChain.inventory.wasteStorage.capacity.highLevel);
      healthScore += (fuelLevel * 10 + wasteLevel * 10);
    }

    // HR health (25% weight)
    if (data.hr) {
      healthScore += (data.hr.metrics.staffingLevel / 100) * 10;
      healthScore += (data.hr.metrics.trainingCompliance / 100) * 10;
      healthScore += (data.hr.metrics.certificationCompliance / 100) * 5;
    }

    // Business health (25% weight)
    if (data.business) {
      healthScore += data.business.performance.capacityFactor * 12.5;
      healthScore += data.business.performance.availabilityFactor * 12.5;
    }

    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * Run complete simulation
   */
  async runSimulation() {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`NUCLEAR POWER PLANT SIMULATION - ${this.plantId}`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`Configuration:`);
    console.log(`  - Duration: ${this.simulationDuration / 1000} seconds`);
    console.log(`  - Timestep: ${this.timestep / 1000} seconds`);
    console.log(`  - Federated Agents: ${this.agentCount}`);
    console.log(`\nInitializing simulation...`);

    // Initialize federated agents
    const agentsReady = await this.initializeAgents();
    if (!agentsReady) {
      console.error('Failed to initialize all agents');
      return false;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const maxIterations = Math.ceil(this.simulationDuration / this.timestep);

    console.log(`\nStarting simulation (${maxIterations} iterations)...\n`);

    // Run simulation loop
    while (this.isRunning && this.iterations < maxIterations) {
      const stepData = await this.runSimulationStep();

      // Log progress every 10 iterations
      if (this.iterations % 10 === 0) {
        console.log(`[Iteration ${this.iterations}/${maxIterations}] ` +
                   `Plant Health: ${stepData.plantHealth.toFixed(2)}% | ` +
                   `Reactor: ${stepData.reactor.status} | ` +
                   `Power: ${stepData.reactor.powerOutput.toFixed(0)}MW`);
      }

      // Run agent analysis every 20 iterations
      if (this.iterations % 20 === 0 && this.iterations > 0) {
        const latestData = this.simulationData[this.simulationData.length - 1];
        await this.runAgentAnalysis(latestData);
      }

      this.currentTime += this.timestep;
    }

    const endTime = Date.now();
    const actualDuration = (endTime - startTime) / 1000;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`SIMULATION COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`  - Total iterations: ${this.iterations}`);
    console.log(`  - Actual duration: ${actualDuration.toFixed(2)} seconds`);
    console.log(`  - Simulated time: ${this.simulationDuration / 1000} seconds`);

    // Final agent analysis
    console.log(`\nRunning final federated agent analysis...`);
    const finalData = this.simulationData[this.simulationData.length - 1];
    const finalAnalyses = await this.runAgentAnalysis(finalData);

    // Generate reports
    console.log(`\nGenerating simulation reports...`);
    await this.generateReports(finalAnalyses);

    // Cleanup
    await this.cleanup();

    return true;
  }

  /**
   * Generate simulation reports
   */
  async generateReports(agentAnalyses) {
    try {
      // Generate comprehensive report
      await this.reportGenerator.generateSimulationReport({
        simulationData: this.simulationData,
        agentAnalyses: agentAnalyses,
        agentResults: this.agents.map(a => a.getResults()),
        summary: this.generateSummary()
      });

      console.log('Reports generated successfully in /reports directory');
    } catch (error) {
      console.error('Error generating reports:', error.message);
    }
  }

  /**
   * Generate simulation summary
   */
  generateSummary() {
    const finalState = this.simulationData[this.simulationData.length - 1];

    return {
      plantId: this.plantId,
      totalIterations: this.iterations,
      finalPlantHealth: finalState.plantHealth,
      reactor: {
        finalStatus: finalState.reactor.status,
        avgPowerOutput: this.simulationData.reduce((sum, d) =>
          sum + d.reactor.powerOutput, 0) / this.iterations,
        scramEvents: this.simulationData.filter(d =>
          d.reactor.status === 'SCRAM').length
      },
      business: {
        totalRevenue: finalState.business.financials.revenue,
        totalCosts: finalState.business.financials.costs,
        netProfit: finalState.business.financials.profit,
        avgCapacityFactor: this.simulationData.reduce((sum, d) =>
          sum + d.business.performance.capacityFactor, 0) / this.iterations
      },
      hr: {
        finalStaffing: finalState.hr.metrics.staffingLevel,
        trainingCompliance: finalState.hr.metrics.trainingCompliance
      },
      supplyChain: {
        finalFuelInventory: finalState.supplyChain.inventory.nuclearFuel.quantity,
        wasteGenerated: finalState.supplyChain.inventory.wasteStorage.highLevel
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('\nCleaning up resources...');

    const cleanupPromises = this.agents.map(agent => agent.cleanup());
    await Promise.all(cleanupPromises);

    console.log('Cleanup complete');
  }

  /**
   * Stop simulation
   */
  stop() {
    this.isRunning = false;
  }
}

module.exports = SimulationOrchestrator;
