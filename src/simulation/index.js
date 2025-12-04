/**
 * Nuclear Plant Simulation Module
 */

const Orchestrator = require('./orchestrator');
const nuclear = require('./nuclear');
const supplyChain = require('./supply-chain');
const hr = require('./hr');
const business = require('./business');

module.exports = {
  Orchestrator,
  ...nuclear,
  ...supplyChain,
  ...hr,
  ...business
};
