/**
 * Vibecast - Universal Energy System Controller
 *
 * Main entry point for the Vibecast system
 */

const core = require('./core');
const rl = require('./rl');
const simulation = require('./simulation');
const agents = require('./agents');
const analysis = require('./analysis');
const utils = require('./utils');

module.exports = {
  // Core
  ...core,

  // Reinforcement Learning
  RL: rl,

  // Simulation
  Simulation: simulation,

  // Agents
  Agents: agents,

  // Analysis
  Analysis: analysis,

  // Utils
  Utils: utils
};
