/**
 * RL System Adapters
 *
 * Modular adapters for different energy systems
 */

module.exports = {
  NuclearFissionAdapter: require('./nuclear-fission'),
  NuclearFusionAdapter: require('./nuclear-fusion'),
  SolarAdapter: require('./solar'),
  WindAdapter: require('./wind'),
  StorageAdapter: require('./storage'),
  HybridAdapter: require('./hybrid')
};
