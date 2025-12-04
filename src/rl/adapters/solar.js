/**
 * Solar Farm Adapter
 * Control system for large-scale solar PV installations
 */

class SolarAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
    this.vectorDB = config.vectorDB;
    this.farmCapacity = config.farmCapacity || 100; // MW

    // State space
    this.stateSpace = {
      solarIrradiance: { min: 0, max: 1200, unit: 'W/m^2' },
      panelTemperature: { min: -20, max: 85, unit: 'C' },
      ambientTemperature: { min: -20, max: 50, unit: 'C' },
      windSpeed: { min: 0, max: 30, unit: 'm/s' },
      humidity: { min: 0, max: 100, unit: 'percent' },
      cloudCover: { min: 0, max: 1, unit: 'fraction' },

      powerOutput: { min: 0, max: this.farmCapacity, unit: 'MW' },
      efficiency: { min: 0, max: 25, unit: 'percent' },

      // Tracking system
      azimuthAngle: { min: -180, max: 180, unit: 'degrees' },
      elevationAngle: { min: 0, max: 90, unit: 'degrees' },
      trackingMode: { min: 0, max: 2, unit: 'enum' }, // 0=fixed, 1=single-axis, 2=dual-axis

      // Grid interaction
      gridDemand: { min: 0, max: this.farmCapacity, unit: 'MW' },
      gridPrice: { min: 0, max: 200, unit: '$/MWh' },
      curtailmentSignal: { min: 0, max: 1, unit: 'boolean' },

      // Battery storage (if integrated)
      batterySOC: { min: 0, max: 100, unit: 'percent' },
      batteryPower: { min: -50, max: 50, unit: 'MW' },

      // Soiling and degradation
      soilingLoss: { min: 0, max: 20, unit: 'percent' },
      degradationFactor: { min: 0.8, max: 1.0, unit: 'fraction' }
    };

    this.actionSpace = {
      azimuth_delta: { min: -10, max: 10, unit: 'degrees/step' },
      elevation_delta: { min: -10, max: 10, unit: 'degrees/step' },
      inverter_setpoint: { min: -10, max: 10, unit: 'MW/step' },
      battery_command: { min: -10, max: 10, unit: 'MW/step' },
      cooling_activation: { min: 0, max: 1, unit: 'boolean' }
    };

    this.weatherModel = this.initializeWeatherModel();
    this.state = this.initializeState();
  }

  initializeState() {
    const now = new Date();
    const hour = now.getHours();

    return {
      solarIrradiance: hour >= 6 && hour <= 18 ? 800 : 0,
      panelTemperature: 40,
      ambientTemperature: 25,
      windSpeed: 3,
      humidity: 60,
      cloudCover: 0.2,
      powerOutput: 70,
      efficiency: 18,
      azimuthAngle: this.calculateOptimalAzimuth(),
      elevationAngle: this.calculateOptimalElevation(),
      trackingMode: 2,
      gridDemand: 75,
      gridPrice: 50,
      curtailmentSignal: 0,
      batterySOC: 50,
      batteryPower: 0,
      soilingLoss: 2,
      degradationFactor: 0.98,
      timestamp: Date.now(),
      history: []
    };
  }

  initializeWeatherModel() {
    return {
      timeOfDay: 0,
      weatherPattern: 'clear',
      seasonalFactor: 1.0,
      forecastHorizon: 24 // hours
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
    this.state.azimuthAngle += action[0] || 0;
    this.state.elevationAngle += action[1] || 0;
    const inverterAdjust = action[2] || 0;
    this.state.batteryPower += action[3] || 0;
    const coolingActive = action[4] > 0.5;

    // Update solar physics
    await this.updateSolarPhysics(0.1, coolingActive);

    // Apply inverter setpoint
    this.state.powerOutput += inverterAdjust;
    this.state.powerOutput = this.clip(this.state.powerOutput, 0, this.farmCapacity);

    const reward = this.calculateReward(prevState, this.state, action);
    const done = this.checkDone();
    const safetyViolation = false; // Solar is generally safe

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
        revenue: this.state.powerOutput * this.state.gridPrice / 1000,
        efficiency: this.state.efficiency
      }
    };
  }

  async updateSolarPhysics(dt, coolingActive) {
    // Update time of day
    this.weatherModel.timeOfDay += dt / 3600; // Convert to hours
    if (this.weatherModel.timeOfDay >= 24) {
      this.weatherModel.timeOfDay -= 24;
    }

    // Calculate sun position
    const sunPosition = this.calculateSunPosition(this.weatherModel.timeOfDay);

    // Update irradiance based on sun position and weather
    const clearSkyIrradiance = Math.max(0,
      1000 * Math.sin(sunPosition.elevation * Math.PI / 180) *
      this.weatherModel.seasonalFactor
    );

    this.state.solarIrradiance = clearSkyIrradiance * (1 - this.state.cloudCover * 0.8);

    // Calculate tracking alignment
    const alignment = this.calculateTrackingAlignment(sunPosition);

    // Calculate power output (simplified PV model)
    const baseEfficiency = 0.20; // 20% base efficiency
    const tempCoeff = -0.004; // -0.4% per °C above 25°C
    const tempLoss = tempCoeff * (this.state.panelTemperature - 25);

    this.state.efficiency = (baseEfficiency + tempLoss) *
                            (1 - this.state.soilingLoss / 100) *
                            this.state.degradationFactor *
                            alignment * 100;

    const availablePower = this.state.solarIrradiance *
                          (this.state.efficiency / 100) *
                          (this.farmCapacity / 20); // Area scaling

    this.state.powerOutput = Math.min(availablePower, this.farmCapacity);

    // Update panel temperature
    const heatGain = this.state.solarIrradiance * 0.05; // Simplified
    const heatLoss = (this.state.panelTemperature - this.state.ambientTemperature) *
                     this.state.windSpeed * 0.5;
    const coolingEffect = coolingActive ? 10 : 0;

    this.state.panelTemperature += (heatGain - heatLoss - coolingEffect) * dt;
    this.state.panelTemperature = this.clip(
      this.state.panelTemperature,
      this.state.ambientTemperature - 5,
      85
    );

    // Update soiling (gradual increase, reset by rain)
    this.state.soilingLoss += dt * 0.001; // Very slow accumulation
    if (Math.random() < 0.001) { // Rare rain event
      this.state.soilingLoss *= 0.5;
    }

    // Battery dynamics
    if (this.state.batteryPower !== 0) {
      const batteryEfficiency = 0.95;
      const energyChange = this.state.batteryPower * dt / 3600 * batteryEfficiency;
      this.state.batterySOC += energyChange / (50 * this.farmCapacity / 100) * 100;
      this.state.batterySOC = this.clip(this.state.batterySOC, 0, 100);
    }

    // Grid price dynamics (simplified market model)
    this.state.gridPrice += (Math.random() - 0.5) * 5;
    this.state.gridPrice = this.clip(this.state.gridPrice, 20, 200);
  }

  calculateSunPosition(hourOfDay) {
    // Simplified sun position (assumes latitude ~40°N)
    const dayProgress = hourOfDay / 24;
    const elevation = 90 * Math.sin((dayProgress - 0.25) * 2 * Math.PI) * 0.6;
    const azimuth = (dayProgress - 0.5) * 360;

    return {
      elevation: Math.max(0, elevation),
      azimuth: azimuth
    };
  }

  calculateOptimalAzimuth() {
    const sunPos = this.calculateSunPosition(this.weatherModel.timeOfDay);
    return sunPos.azimuth;
  }

  calculateOptimalElevation() {
    const sunPos = this.calculateSunPosition(this.weatherModel.timeOfDay);
    return sunPos.elevation;
  }

  calculateTrackingAlignment(sunPosition) {
    // Calculate cosine of angle between panel and sun
    const azError = Math.abs(this.state.azimuthAngle - sunPosition.azimuth);
    const elError = Math.abs(this.state.elevationAngle - sunPosition.elevation);

    const alignment = Math.cos(azError * Math.PI / 180) *
                     Math.cos(elError * Math.PI / 180);

    return Math.max(0, alignment);
  }

  calculateReward(prevState, currentState, action = [0, 0, 0, 0, 0]) {
    let reward = 0;

    // 1. Revenue from power generation
    const revenue = currentState.powerOutput * currentState.gridPrice / 100;
    reward += revenue;

    // 2. Efficiency bonus
    reward += currentState.efficiency * 2;

    // 3. Battery optimization (arbitrage)
    const batteryRevenue = Math.abs(currentState.batteryPower) * currentState.gridPrice / 200;
    if (currentState.gridPrice > 100 && currentState.batteryPower > 0) {
      reward += batteryRevenue * 2; // Discharge when prices high
    } else if (currentState.gridPrice < 50 && currentState.batteryPower < 0) {
      reward += batteryRevenue; // Charge when prices low
    }

    // 4. Tracking accuracy
    const sunPos = this.calculateSunPosition(this.weatherModel.timeOfDay);
    const trackingError = Math.abs(currentState.azimuthAngle - sunPos.azimuth) +
                         Math.abs(currentState.elevationAngle - sunPos.elevation);
    reward -= trackingError * 0.1;

    // 5. Maintain optimal temperature
    const tempPenalty = Math.max(0, currentState.panelTemperature - 45) * 0.5;
    reward -= tempPenalty;

    // 6. Avoid unnecessary tracking movements (energy cost)
    const movementCost = (Math.abs(action[0]) + Math.abs(action[1])) * 0.2;
    reward -= movementCost;

    // 7. Grid demand matching
    const demandError = Math.abs(currentState.powerOutput - currentState.gridDemand);
    reward -= demandError * 0.5;

    return reward;
  }

  checkDone() {
    // Generally runs continuously
    return false;
  }

  stateToTensor(state) {
    return [
      this.normalize(state.solarIrradiance, 0, 1200),
      this.normalize(state.panelTemperature, -20, 85),
      this.normalize(state.ambientTemperature, -20, 50),
      this.normalize(state.windSpeed, 0, 30),
      this.normalize(state.humidity, 0, 100),
      state.cloudCover,
      this.normalize(state.powerOutput, 0, this.farmCapacity),
      this.normalize(state.efficiency, 0, 25),
      this.normalize(state.azimuthAngle, -180, 180),
      this.normalize(state.elevationAngle, 0, 90),
      this.normalize(state.gridDemand, 0, this.farmCapacity),
      this.normalize(state.gridPrice, 0, 200),
      this.normalize(state.batterySOC, 0, 100),
      this.normalize(state.batteryPower, -50, 50),
      this.normalize(state.soilingLoss, 0, 20)
    ];
  }

  applySafetyChecks(action, state) {
    // Limit tracking to daylight hours
    const hour = new Date(state.timestamp).getHours();
    if (hour < 5 || hour > 20) {
      action[0] = 0;
      action[1] = 0;
    }

    // Prevent excessive battery cycling
    if (state.batterySOC < 10 && action[3] > 0) {
      action[3] = 0;
    }
    if (state.batterySOC > 90 && action[3] < 0) {
      action[3] = 0;
    }

    return action;
  }

  getMetrics() {
    return {
      systemType: 'solar',
      farmCapacity: this.farmCapacity,
      currentState: this.state,
      weatherModel: this.weatherModel
    };
  }

  normalize(value, min, max) {
    return (value - min) / (max - min);
  }

  clip(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

module.exports = SolarAdapter;
