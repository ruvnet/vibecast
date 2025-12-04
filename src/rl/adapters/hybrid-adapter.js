/**
 * Hybrid System Adapter - Placeholder
 */
class HybridAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
  }

  async reset() {
    return { totalOutput: 500, mix: { nuclear: 0.4, solar: 0.3, wind: 0.3 } };
  }

  async step(action) {
    return { nextState: await this.reset(), reward: 200, done: false, info: {} };
  }

  stateToTensor(state) {
    return [1.0, 0.4, 0.3, 0.3];
  }

  applySafetyChecks(action, state) {
    return action;
  }
}

module.exports = HybridAdapter;
