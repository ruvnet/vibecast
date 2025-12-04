/**
 * Grid Storage Adapter - Placeholder
 */
class StorageAdapter {
  constructor(config = {}) {
    this.systemId = config.systemId;
  }

  async reset() {
    return { soc: 50, power: 0, voltage: 400 };
  }

  async step(action) {
    return { nextState: await this.reset(), reward: 50, done: false, info: {} };
  }

  stateToTensor(state) {
    return [0.5, 0, 1.0];
  }

  applySafetyChecks(action, state) {
    return action;
  }
}

module.exports = StorageAdapter;
