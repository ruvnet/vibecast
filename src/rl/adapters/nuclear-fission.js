/**
 * Nuclear Fission Reactor Adapter
 * Supports PWR, BWR, SMR, and other fission reactor types
 */

class NuclearFissionAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
    this.vectorDB = config.vectorDB;
    this.reactorType = config.reactorType || 'PWR'; // PWR, BWR, SMR, etc.

    // State space definition
    this.stateSpace = {
      // Core parameters
      coreTemperature: { min: 280, max: 350, unit: 'C' },
      pressure: { min: 140, max: 175, unit: 'bar' },
      powerOutput: { min: 0, max: 1200, unit: 'MW' },
      neutronFlux: { min: 0, max: 2.0, unit: 'normalized' },
      coolantFlow: { min: 50, max: 150, unit: 'percent' },
      coolantTemp: { min: 250, max: 330, unit: 'C' },

      // Control systems
      controlRodPosition: { min: 0, max: 100, unit: 'percent' },
      boronConcentration: { min: 0, max: 2000, unit: 'ppm' },

      // Safety
      safetyMargin: { min: 0, max: 100, unit: 'percent' },
      xenonLevel: { min: 0, max: 1.0, unit: 'normalized' },

      // Fuel
      fuelBurnup: { min: 0, max: 60000, unit: 'MWd/kg' },
      fuelTemperature: { min: 300, max: 1200, unit: 'C' },

      // Grid
      gridDemand: { min: 0, max: 1200, unit: 'MW' },
      gridFrequency: { min: 59.9, max: 60.1, unit: 'Hz' }
    };

    // Action space definition
    this.actionSpace = {
      controlRodDelta: { min: -5, max: 5, unit: 'percent/step' },
      coolantFlowDelta: { min: -10, max: 10, unit: 'percent/step' },
      boronDelta: { min: -50, max: 50, unit: 'ppm/step' }
    };

    // Current state
    this.state = this.initializeState();

    // Physics model
    this.physicsModel = this.initializePhysicsModel();
  }

  /**
   * Initialize reactor to nominal operating conditions
   */
  initializeState() {
    return {
      coreTemperature: 310,
      pressure: 155,
      powerOutput: 1000,
      neutronFlux: 1.0,
      coolantFlow: 100,
      coolantTemp: 290,
      controlRodPosition: 50,
      boronConcentration: 800,
      safetyMargin: 85,
      xenonLevel: 0.3,
      fuelBurnup: 15000,
      fuelTemperature: 800,
      gridDemand: 1000,
      gridFrequency: 60.0,
      timestamp: Date.now(),
      history: []
    };
  }

  /**
   * Initialize simplified reactor physics model
   */
  initializePhysicsModel() {
    return {
      // Neutronics
      reactivityCoefficients: {
        fuel: -2.5e-5,     // Doppler coefficient (K^-1)
        moderator: -3e-4,   // Moderator temperature coefficient
        void: -1e-3,        // Void coefficient (for BWR)
        power: -5e-6        // Power defect
      },

      // Thermal hydraulics
      thermalConstants: {
        heatCapacity: 5.2e6,      // J/(m^3·K)
        heatTransferCoeff: 50000,  // W/(m^2·K)
        flowCoefficient: 0.8
      },

      // Kinetics parameters
      neutronLifetime: 1e-4,      // seconds
      delayedNeutronFraction: 0.0065,
      promptNeutronLifetime: 1e-5,

      // Xenon dynamics
      xenonYield: 0.061,
      xenonDecay: 2.1e-5,         // s^-1
      iodineDecay: 2.9e-5
    };
  }

  /**
   * Reset environment to initial state
   */
  async reset() {
    this.state = this.initializeState();
    this.state.history = [];
    return this.state;
  }

  /**
   * Execute action and return next state, reward, done
   */
  async step(action) {
    const prevState = { ...this.state };

    // Apply actions
    this.state.controlRodPosition += action[0] || 0;
    this.state.coolantFlow += action[1] || 0;
    this.state.boronConcentration += action[2] || 0;

    // Clip to valid ranges
    this.state.controlRodPosition = this.clip(
      this.state.controlRodPosition,
      this.actionSpace.controlRodDelta.min,
      this.actionSpace.controlRodDelta.max
    );

    // Update physics
    await this.updatePhysics(0.1); // 0.1 second timestep

    // Calculate reward
    const reward = this.calculateReward(prevState, this.state);

    // Check termination conditions
    const done = this.checkDone();

    // Safety violation check
    const safetyViolation = this.checkSafetyViolation();

    // Update history
    this.state.history.push(prevState);
    if (this.state.history.length > 10) {
      this.state.history.shift();
    }

    return {
      nextState: this.state,
      reward,
      done,
      info: {
        safetyViolation,
        powerError: Math.abs(this.state.powerOutput - this.state.gridDemand),
        safetyMargin: this.state.safetyMargin
      }
    };
  }

  /**
   * Update reactor physics (simplified point kinetics + thermal hydraulics)
   */
  async updatePhysics(dt) {
    const pm = this.physicsModel;

    // 1. Calculate reactivity
    let reactivity = 0;

    // Control rod reactivity
    reactivity += (this.state.controlRodPosition - 50) * -0.01;

    // Temperature feedback
    reactivity += (this.state.coreTemperature - 310) * pm.reactivityCoefficients.fuel;
    reactivity += (this.state.coolantTemp - 290) * pm.reactivityCoefficients.moderator;

    // Xenon poisoning
    reactivity += -this.state.xenonLevel * 0.03;

    // Boron reactivity worth
    reactivity += (this.state.boronConcentration - 800) * -1e-5;

    // 2. Update neutron flux (point kinetics)
    const dFlux = (reactivity - pm.delayedNeutronFraction) / pm.neutronLifetime *
                  this.state.neutronFlux;
    this.state.neutronFlux += dFlux * dt;
    this.state.neutronFlux = Math.max(0.01, Math.min(2.0, this.state.neutronFlux));

    // 3. Update power
    this.state.powerOutput = this.state.neutronFlux * 1000; // Nominal 1000 MW

    // 4. Update temperatures
    const heatGeneration = this.state.powerOutput * 1e6; // Watts
    const heatRemoval = this.state.coolantFlow * pm.thermalConstants.flowCoefficient * 1e7;

    const dTemp = (heatGeneration - heatRemoval) / pm.thermalConstants.heatCapacity * dt;
    this.state.coreTemperature += dTemp;

    // Fuel temperature lags core temperature
    this.state.fuelTemperature += (this.state.coreTemperature * 2.5 - this.state.fuelTemperature) * 0.01;

    // Coolant temperature
    const coolantTempTarget = this.state.coreTemperature - 20;
    this.state.coolantTemp += (coolantTempTarget - this.state.coolantTemp) * 0.05;

    // 5. Update pressure (steam generator dynamics)
    const pressureTarget = 140 + (this.state.coreTemperature - 280) * 0.5;
    this.state.pressure += (pressureTarget - this.state.pressure) * 0.1;

    // 6. Xenon dynamics
    const fissionRate = this.state.neutronFlux;
    const xenonProduction = pm.xenonYield * fissionRate;
    const xenonDecay = pm.xenonDecay * this.state.xenonLevel;
    const xenonBurnup = this.state.neutronFlux * this.state.xenonLevel * 1e-3;

    this.state.xenonLevel += (xenonProduction - xenonDecay - xenonBurnup) * dt;
    this.state.xenonLevel = Math.max(0, Math.min(1.0, this.state.xenonLevel));

    // 7. Update fuel burnup
    this.state.fuelBurnup += this.state.powerOutput * dt / 3600 * 0.001; // MWd/kg

    // 8. Calculate safety margin
    const tempMargin = (350 - this.state.coreTemperature) / 350 * 100;
    const pressureMargin = (175 - this.state.pressure) / 175 * 100;
    this.state.safetyMargin = Math.min(tempMargin, pressureMargin);

    // 9. Grid frequency (simplified)
    const powerError = this.state.powerOutput - this.state.gridDemand;
    this.state.gridFrequency += powerError * -0.00001;
    this.state.gridFrequency = this.clip(this.state.gridFrequency, 59.9, 60.1);
  }

  /**
   * Calculate reward function
   */
  calculateReward(prevState, currentState) {
    let reward = 0;

    // 1. Power tracking reward (primary objective)
    const powerError = Math.abs(currentState.powerOutput - currentState.gridDemand);
    const powerReward = -powerError * 0.1; // Penalize deviation
    reward += powerReward;

    // 2. Efficiency reward
    const capacityFactor = currentState.powerOutput / 1200;
    reward += capacityFactor * 10;

    // 3. Safety margin reward
    reward += currentState.safetyMargin * 0.5;

    // 4. Grid frequency stability
    const freqError = Math.abs(currentState.gridFrequency - 60.0);
    reward += -freqError * 100;

    // 5. Fuel efficiency (minimize burnup rate)
    const burnupRate = currentState.fuelBurnup - prevState.fuelBurnup;
    reward += -burnupRate * 0.01;

    // 6. Smooth operation (penalize large control changes)
    const controlChange = Math.abs(
      currentState.controlRodPosition - prevState.controlRodPosition
    );
    reward += -controlChange * 0.5;

    // 7. Temperature stability
    const tempChange = Math.abs(currentState.coreTemperature - prevState.coreTemperature);
    reward += -tempChange * 2;

    // 8. Xenon management (avoid xenon oscillations)
    const xenonStability = -Math.abs(currentState.xenonLevel - 0.3) * 5;
    reward += xenonStability;

    return reward;
  }

  /**
   * Check if episode should terminate
   */
  checkDone() {
    // SCRAM conditions
    if (this.state.coreTemperature > 350) return true;
    if (this.state.pressure > 175) return true;
    if (this.state.safetyMargin < 5) return true;
    if (this.state.powerOutput < 50) return true; // Shutdown

    return false;
  }

  /**
   * Check for safety violations
   */
  checkSafetyViolation() {
    return this.state.coreTemperature > 340 ||
           this.state.pressure > 170 ||
           this.state.safetyMargin < 10;
  }

  /**
   * Convert state to tensor format
   */
  stateToTensor(state) {
    return [
      this.normalize(state.coreTemperature, 280, 350),
      this.normalize(state.pressure, 140, 175),
      this.normalize(state.powerOutput, 0, 1200),
      state.neutronFlux,
      this.normalize(state.coolantFlow, 50, 150),
      this.normalize(state.coolantTemp, 250, 330),
      this.normalize(state.controlRodPosition, 0, 100),
      this.normalize(state.boronConcentration, 0, 2000),
      this.normalize(state.safetyMargin, 0, 100),
      state.xenonLevel,
      this.normalize(state.fuelBurnup, 0, 60000),
      this.normalize(state.fuelTemperature, 300, 1200),
      this.normalize(state.gridDemand, 0, 1200),
      this.normalize(state.gridFrequency, 59.9, 60.1)
    ];
  }

  /**
   * Apply system-specific safety checks
   */
  applySafetyChecks(action, state) {
    // Don't allow rod withdrawal if temperature is high
    if (state.coreTemperature > 335 && action[0] < 0) {
      action[0] = Math.max(0, action[0]);
    }

    // Don't reduce coolant flow if temperature is high
    if (state.coreTemperature > 330 && action[1] < 0) {
      action[1] = 0;
    }

    // Emergency SCRAM
    if (state.coreTemperature > 345 || state.pressure > 172) {
      action[0] = 20; // Rapid rod insertion
      action[1] = 20; // Increase cooling
    }

    return action;
  }

  /**
   * Get system-specific metrics
   */
  getMetrics() {
    return {
      systemType: 'nuclear-fission',
      reactorType: this.reactorType,
      currentState: this.state,
      physicsModel: this.physicsModel
    };
  }

  // Helper methods
  normalize(value, min, max) {
    return (value - min) / (max - min);
  }

  denormalize(value, min, max) {
    return value * (max - min) + min;
  }

  clip(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

module.exports = NuclearFissionAdapter;
