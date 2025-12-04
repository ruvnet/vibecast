/**
 * Nuclear Fusion Reactor Adapter
 * Supports Tokamaks (ITER-style) and Stellarators (W7-X style)
 */

class FusionAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
    this.vectorDB = config.vectorDB;
    this.fusionType = config.fusionType || 'tokamak'; // tokamak, stellarator

    // State space for fusion reactor
    this.stateSpace = {
      // Plasma parameters
      plasmaCurrent: { min: 0, max: 15, unit: 'MA' },           // Tokamak specific
      plasmaDensity: { min: 0, max: 10, unit: '10^20 m^-3' },
      plasmaTemperature: { min: 0, max: 20, unit: 'keV' },
      confinementTime: { min: 0, max: 10, unit: 's' },
      betaValue: { min: 0, max: 5, unit: 'percent' },          // Plasma pressure

      // Magnetic field (Tokamak)
      toroidalField: { min: 0, max: 5.3, unit: 'T' },
      poloidalField: { min: 0, max: 2, unit: 'T' },

      // Heating systems
      NBI_power: { min: 0, max: 50, unit: 'MW' },              // Neutral Beam Injection
      ECRH_power: { min: 0, max: 30, unit: 'MW' },             // Electron Cyclotron
      ICRH_power: { min: 0, max: 20, unit: 'MW' },             // Ion Cyclotron

      // Fusion performance
      fusionPower: { min: 0, max: 500, unit: 'MW' },
      Q_value: { min: 0, max: 20, unit: 'dimensionless' },     // Fusion gain

      // Stability
      H_mode: { min: 0, max: 1, unit: 'boolean' },             // High confinement mode
      ELM_frequency: { min: 0, max: 100, unit: 'Hz' },         // Edge Localized Modes
      disruption_risk: { min: 0, max: 1, unit: 'probability' },

      // Divertor
      divertorLoad: { min: 0, max: 10, unit: 'MW/m^2' },

      // Fueling
      deuteriumFlow: { min: 0, max: 100, unit: 'Pa·m^3/s' },
      tritiumFlow: { min: 0, max: 100, unit: 'Pa·m^3/s' }
    };

    // Action space
    this.actionSpace = {
      plasmaCurrent_delta: { min: -0.5, max: 0.5, unit: 'MA/step' },
      toroidalField_delta: { min: -0.1, max: 0.1, unit: 'T/step' },
      NBI_power_delta: { min: -5, max: 5, unit: 'MW/step' },
      ECRH_power_delta: { min: -3, max: 3, unit: 'MW/step' },
      ICRH_power_delta: { min: -2, max: 2, unit: 'MW/step' },
      deuteriumFlow_delta: { min: -10, max: 10, unit: 'Pa·m^3/s/step' },
      tritiumFlow_delta: { min: -10, max: 10, unit: 'Pa·m^3/s/step' }
    };

    this.state = this.initializeState();
    this.physicsModel = this.initializeFusionPhysics();
  }

  /**
   * Initialize fusion reactor state
   */
  initializeState() {
    return {
      plasmaCurrent: 5.0,
      plasmaDensity: 5.0,
      plasmaTemperature: 10.0,
      confinementTime: 2.0,
      betaValue: 2.5,
      toroidalField: 3.5,
      poloidalField: 1.0,
      NBI_power: 20,
      ECRH_power: 10,
      ICRH_power: 5,
      fusionPower: 100,
      Q_value: 5,
      H_mode: 1,
      ELM_frequency: 20,
      disruption_risk: 0.05,
      divertorLoad: 5,
      deuteriumFlow: 50,
      tritiumFlow: 50,
      timestamp: Date.now(),
      history: []
    };
  }

  /**
   * Initialize fusion physics model
   */
  initializeFusionPhysics() {
    return {
      // Scaling laws (ITER-like)
      confinementScaling: {
        H98: 1.0,                          // H-mode confinement factor
        tau_E_base: 1.0                    // Base energy confinement time
      },

      // Fusion reaction rates (D-T)
      fusionCrossSection: {
        peak_temperature: 15,              // keV
        peak_reactivity: 1e-22             // m^3/s
      },

      // Stability limits
      betaLimit: {
        troyon: 3.5,                       // Beta limit coefficient
        critical: 4.0
      },

      // Disruption triggers
      disruptionThresholds: {
        density_limit: 8.0,                // Greenwald limit
        beta_limit: 3.8,
        q_limit: 2.0                       // Safety factor
      },

      // Power balance
      radiationFraction: 0.3,
      alpha_heating_fraction: 0.2,

      // Bootstrap current
      bootstrap_fraction: 0.5
    };
  }

  async reset() {
    this.state = this.initializeState();
    this.state.history = [];
    return this.state;
  }

  async step(action) {
    const prevState = { ...this.state };

    // Apply actions
    this.state.plasmaCurrent += action[0] || 0;
    this.state.toroidalField += action[1] || 0;
    this.state.NBI_power += action[2] || 0;
    this.state.ECRH_power += action[3] || 0;
    this.state.ICRH_power += action[4] || 0;
    this.state.deuteriumFlow += action[5] || 0;
    this.state.tritiumFlow += action[6] || 0;

    // Clip to ranges
    this.state.plasmaCurrent = this.clip(this.state.plasmaCurrent, 0, 15);
    this.state.toroidalField = this.clip(this.state.toroidalField, 0, 5.3);
    this.state.NBI_power = this.clip(this.state.NBI_power, 0, 50);
    this.state.ECRH_power = this.clip(this.state.ECRH_power, 0, 30);
    this.state.ICRH_power = this.clip(this.state.ICRH_power, 0, 20);

    // Update fusion physics
    await this.updateFusionPhysics(0.1);

    const reward = this.calculateReward(prevState, this.state);
    const done = this.checkDone();
    const safetyViolation = this.checkSafetyViolation();

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
        Q_value: this.state.Q_value,
        disruption_risk: this.state.disruption_risk,
        H_mode: this.state.H_mode
      }
    };
  }

  /**
   * Update fusion plasma physics
   */
  async updateFusionPhysics(dt) {
    const pm = this.physicsModel;

    // 1. Calculate confinement time (ITER H98 scaling)
    const B = this.state.toroidalField;
    const I_p = this.state.plasmaCurrent;
    const n_e = this.state.plasmaDensity;
    const P_heat = this.state.NBI_power + this.state.ECRH_power + this.state.ICRH_power;

    // Simplified H-mode confinement scaling
    this.state.confinementTime = 0.145 * Math.pow(I_p, 0.93) *
                                  Math.pow(B, 0.15) *
                                  Math.pow(n_e, 0.41) *
                                  Math.pow(P_heat, -0.69);

    // 2. Update plasma temperature (power balance)
    const heatingPower = P_heat;
    const alphaHeating = this.state.fusionPower * pm.alpha_heating_fraction;
    const radiationLoss = heatingPower * pm.radiationFraction;
    const transportLoss = this.state.plasmaTemperature / this.state.confinementTime * 10;

    const dT = (heatingPower + alphaHeating - radiationLoss - transportLoss) * dt * 0.01;
    this.state.plasmaTemperature += dT;
    this.state.plasmaTemperature = this.clip(this.state.plasmaTemperature, 0, 20);

    // 3. Update plasma density (particle balance)
    const fueling = (this.state.deuteriumFlow + this.state.tritiumFlow) * 0.01;
    const transport_out = this.state.plasmaDensity / this.state.confinementTime * 0.5;

    this.state.plasmaDensity += (fueling - transport_out) * dt;
    this.state.plasmaDensity = this.clip(this.state.plasmaDensity, 0, 10);

    // 4. Calculate fusion power (D-T reaction rate)
    const T = this.state.plasmaTemperature;
    const reactivity = this.calculateFusionReactivity(T);
    const n_D = this.state.plasmaDensity * 0.5;
    const n_T = this.state.plasmaDensity * 0.5;

    this.state.fusionPower = reactivity * n_D * n_T * 17.6 * 100; // 17.6 MeV per reaction
    this.state.fusionPower = this.clip(this.state.fusionPower, 0, 500);

    // 5. Calculate Q value
    this.state.Q_value = this.state.fusionPower / Math.max(P_heat, 1);

    // 6. Calculate beta (plasma pressure / magnetic pressure)
    this.state.betaValue = this.state.plasmaDensity * this.state.plasmaTemperature /
                           (Math.pow(B, 2) * 400);

    // 7. H-mode transition
    const P_threshold = 2.84 * Math.pow(n_e, 0.58) * Math.pow(B, 0.82); // P_LH threshold
    this.state.H_mode = P_heat > P_threshold ? 1 : 0;

    // 8. ELM dynamics (simplified)
    if (this.state.H_mode === 1) {
      this.state.ELM_frequency = 10 + this.state.betaValue * 5;
    } else {
      this.state.ELM_frequency = 0;
    }

    // 9. Disruption risk assessment
    const density_margin = 1 - (this.state.plasmaDensity / pm.disruptionThresholds.density_limit);
    const beta_margin = 1 - (this.state.betaValue / pm.disruptionThresholds.beta_limit);

    this.state.disruption_risk = Math.max(0, 1 - Math.min(density_margin, beta_margin));

    // 10. Divertor heat load
    const power_to_divertor = (P_heat + this.state.fusionPower * 0.2) * 0.7;
    this.state.divertorLoad = power_to_divertor / 50; // Distributed over divertor area

    // 11. Update magnetic fields based on current
    if (this.fusionType === 'tokamak') {
      this.state.poloidalField = this.state.plasmaCurrent * 0.2;
    }
  }

  /**
   * Calculate D-T fusion reactivity
   */
  calculateFusionReactivity(T_keV) {
    // Bosch-Hale parameterization
    if (T_keV < 1) return 0;

    const T = T_keV;
    const A1 = 6.661, A2 = 643.41, A3 = 15.136, A4 = 0.75,A5 = 0.00000175;

    const theta = T / (1 - (T * (A2 + T * (A3 + T * A4))) / (1 + T * (A1 + T * A5)));
    const xi = Math.pow(T / theta, 1/3);

    const reactivity = 1e-24 * Math.exp(-3 * xi) * Math.pow(theta, 2) / T;

    return reactivity * 1e24; // Normalized
  }

  /**
   * Calculate reward for fusion control
   */
  calculateReward(prevState, currentState) {
    let reward = 0;

    // 1. Maximize Q value (fusion gain)
    reward += currentState.Q_value * 10;

    // 2. Maximize fusion power
    reward += currentState.fusionPower * 0.1;

    // 3. H-mode operation bonus
    if (currentState.H_mode === 1) {
      reward += 20;
    }

    // 4. Minimize disruption risk
    reward += -(currentState.disruption_risk * 100);

    // 5. Keep beta within limits
    const beta_penalty = Math.max(0, currentState.betaValue - 3.5) * 50;
    reward -= beta_penalty;

    // 6. Manage divertor load
    const divertor_penalty = Math.max(0, currentState.divertorLoad - 8) * 30;
    reward -= divertor_penalty;

    // 7. Fuel efficiency
    const fuel_usage = currentState.deuteriumFlow + currentState.tritiumFlow;
    reward -= fuel_usage * 0.05;

    // 8. Smooth control
    const control_changes = Math.abs(currentState.plasmaCurrent - prevState.plasmaCurrent) +
                           Math.abs(currentState.NBI_power - prevState.NBI_power);
    reward -= control_changes * 2;

    // 9. Long confinement time
    reward += currentState.confinementTime * 5;

    return reward;
  }

  checkDone() {
    // Disruption
    if (this.state.disruption_risk > 0.9) return true;
    if (this.state.betaValue > 4.0) return true;
    if (this.state.divertorLoad > 10) return true;

    // Loss of plasma
    if (this.state.plasmaDensity < 1.0) return true;
    if (this.state.plasmaTemperature < 3.0) return true;

    return false;
  }

  checkSafetyViolation() {
    return this.state.disruption_risk > 0.7 ||
           this.state.betaValue > 3.8 ||
           this.state.divertorLoad > 9;
  }

  stateToTensor(state) {
    return [
      this.normalize(state.plasmaCurrent, 0, 15),
      this.normalize(state.plasmaDensity, 0, 10),
      this.normalize(state.plasmaTemperature, 0, 20),
      this.normalize(state.confinementTime, 0, 10),
      this.normalize(state.betaValue, 0, 5),
      this.normalize(state.toroidalField, 0, 5.3),
      this.normalize(state.poloidalField, 0, 2),
      this.normalize(state.NBI_power, 0, 50),
      this.normalize(state.ECRH_power, 0, 30),
      this.normalize(state.ICRH_power, 0, 20),
      this.normalize(state.fusionPower, 0, 500),
      this.normalize(state.Q_value, 0, 20),
      state.H_mode,
      this.normalize(state.ELM_frequency, 0, 100),
      state.disruption_risk,
      this.normalize(state.divertorLoad, 0, 10)
    ];
  }

  applySafetyChecks(action, state) {
    // Prevent disruption
    if (state.disruption_risk > 0.6) {
      // Reduce heating, increase fueling
      action[2] = Math.min(action[2], -2); // Reduce NBI
      action[3] = Math.min(action[3], -1); // Reduce ECRH
      action[5] = Math.max(action[5], 5);  // Increase D fueling
    }

    // Protect divertor
    if (state.divertorLoad > 8.5) {
      action[2] = Math.min(action[2], -3);
      action[3] = Math.min(action[3], -2);
    }

    // Beta limit
    if (state.betaValue > 3.6) {
      action[0] = Math.min(action[0], -0.2); // Reduce current
    }

    return action;
  }

  getMetrics() {
    return {
      systemType: 'nuclear-fusion',
      fusionType: this.fusionType,
      currentState: this.state,
      physicsModel: this.physicsModel
    };
  }

  normalize(value, min, max) {
    return (value - min) / (max - min);
  }

  clip(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

module.exports = FusionAdapter;
