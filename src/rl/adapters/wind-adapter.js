/**
 * Wind Farm Adapter - Placeholder for modular system
 */
class WindAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
    this.farmCapacity = config.farmCapacity || 200; // MW
  }

  async reset() {
    return { windSpeed: 12, powerOutput: 150, yawAngle: 0, pitchAngle: 5 };
  }

  async step(action) {
    return {
      nextState: await this.reset(),
      reward: 100,
      done: false,
      info: {}
    };
  }

  stateToTensor(state) {
    return [0.8, 0.75, 0, 0.1];
  }

  applySafetyChecks(action, state) {
    return action;
  }
}

module.exports = WindAdapter;
