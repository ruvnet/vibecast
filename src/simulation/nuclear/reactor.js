/**
 * Nuclear Reactor Control System Simulation
 * Manages reactor core operations, temperature, pressure, and safety systems
 */

const { VectorDB } = require('ruvector');

class ReactorControlSystem {
  constructor(config = {}) {
    this.reactorId = config.reactorId || 'REACTOR-01';
    this.ruvector = null; // Initialize later if needed

    // Reactor parameters
    this.state = {
      coreTemperature: 300, // Celsius
      pressure: 155, // bar
      powerOutput: 1000, // MW
      controlRodPosition: 50, // percent insertion
      coolantFlow: 100, // percent
      neutronFlux: 1.0, // normalized
      fuelBurnup: 0, // MWd/kg
      timestamp: Date.now(),
      status: 'OPERATIONAL',
      safetyMargin: 100
    };

    // Operating limits
    this.limits = {
      maxTemperature: 350,
      minTemperature: 280,
      maxPressure: 175,
      minPressure: 140,
      maxPowerOutput: 1200,
      maxFuelBurnup: 50000
    };

    // Safety systems
    this.safetySystems = {
      scram: false,
      emergencyCooling: false,
      containmentIntegrity: true,
      radiationMonitoring: true
    };
  }

  /**
   * Simulate one time step of reactor operation
   */
  async simulate(timestep = 1000) {
    const deltaTime = timestep / 1000; // Convert to seconds

    // Update neutron flux based on control rod position
    const targetFlux = (100 - this.state.controlRodPosition) / 100;
    this.state.neutronFlux += (targetFlux - this.state.neutronFlux) * 0.1;

    // Update power output based on neutron flux
    this.state.powerOutput = this.state.neutronFlux * this.limits.maxPowerOutput;

    // Update core temperature based on power output and coolant flow
    const heatGeneration = this.state.powerOutput / 10;
    const heatRemoval = this.state.coolantFlow * 0.1;
    const tempChange = (heatGeneration - heatRemoval) * deltaTime * 0.01;
    this.state.coreTemperature += tempChange;

    // Update pressure based on temperature
    const pressureChange = tempChange * 0.5;
    this.state.pressure += pressureChange;

    // Update fuel burnup
    this.state.fuelBurnup += this.state.powerOutput * deltaTime * 0.0001;

    // Check safety systems
    this.checkSafetySystems();

    // Calculate safety margin
    this.calculateSafetyMargin();

    // Store state in vector database for analysis
    await this.storeState();

    return this.getState();
  }

  /**
   * Check and activate safety systems
   */
  checkSafetySystems() {
    // Emergency SCRAM conditions
    if (this.state.coreTemperature > this.limits.maxTemperature ||
        this.state.pressure > this.limits.maxPressure) {
      this.activateScram();
    }

    // Emergency cooling activation
    if (this.state.coreTemperature > this.limits.maxTemperature * 0.95) {
      this.safetySystems.emergencyCooling = true;
      this.state.coolantFlow = Math.min(150, this.state.coolantFlow * 1.5);
    }

    // Update status
    if (this.safetySystems.scram) {
      this.state.status = 'SCRAM';
    } else if (this.state.coreTemperature > this.limits.maxTemperature * 0.9) {
      this.state.status = 'WARNING';
    } else {
      this.state.status = 'OPERATIONAL';
    }
  }

  /**
   * Activate emergency shutdown
   */
  activateScram() {
    this.safetySystems.scram = true;
    this.state.controlRodPosition = 100; // Full insertion
    this.state.neutronFlux *= 0.1; // Rapid flux reduction
    this.state.status = 'SCRAM';
  }

  /**
   * Calculate safety margin
   */
  calculateSafetyMargin() {
    const tempMargin = (this.limits.maxTemperature - this.state.coreTemperature) /
                       this.limits.maxTemperature * 100;
    const pressureMargin = (this.limits.maxPressure - this.state.pressure) /
                          this.limits.maxPressure * 100;

    this.state.safetyMargin = Math.min(tempMargin, pressureMargin);
  }

  /**
   * Store current state in vector database
   */
  async storeState() {
    const vector = [
      this.state.coreTemperature / 1000,
      this.state.pressure / 200,
      this.state.powerOutput / 1500,
      this.state.neutronFlux,
      this.state.coolantFlow / 100,
      this.state.safetyMargin / 100
    ];

    if (this.ruvector) {
      try {
        await this.ruvector.upsert({
          collection: 'reactor-telemetry',
          id: `${this.reactorId}-${Date.now()}`,
          vector: vector,
          metadata: {
            ...this.state,
            reactorId: this.reactorId
          }
        });
      } catch (error) {
        console.error('Error storing reactor state:', error.message);
      }
    }
  }

  /**
   * Adjust control rods
   */
  setControlRods(position) {
    this.state.controlRodPosition = Math.max(0, Math.min(100, position));
  }

  /**
   * Adjust coolant flow
   */
  setCoolantFlow(flow) {
    this.state.coolantFlow = Math.max(0, Math.min(150, flow));
  }

  /**
   * Get current reactor state
   */
  getState() {
    return {
      ...this.state,
      reactorId: this.reactorId,
      safetySystems: this.safetySystems,
      timestamp: Date.now()
    };
  }

  /**
   * Reset reactor to safe shutdown state
   */
  shutdown() {
    this.state.controlRodPosition = 100;
    this.state.neutronFlux = 0.01;
    this.state.powerOutput = 10; // Decay heat
    this.state.status = 'SHUTDOWN';
  }
}

module.exports = ReactorControlSystem;
