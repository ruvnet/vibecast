/**
 * Toyota Motor Company Self-Learning Simulation
 * Main Export Module
 *
 * Usage:
 *   npx ruvector simulate
 *   npx ruvector interactive
 *   npx ruvector dashboard
 */

// Core Types
export * from './types';

// Agent Framework
export { ToyotaAgent } from './core/Agent';

// Toyota Organization
export {
  OrganizationalStructureGenerator,
  NameGenerator,
  TOYOTA_EXECUTIVES,
  TOYOTA_LOCATIONS,
  TOYOTA_VEHICLE_MODELS,
  DEPARTMENT_CONFIGS,
} from './toyota/OrganizationalStructure';

// Supply Chain
export {
  SupplyChainSimulator,
  TOYOTA_KEIRETSU,
  GLOBAL_SUPPLIERS,
} from './toyota/SupplyChain';

// Manufacturing
export {
  ProductionLineSimulator,
  QualityManagementSystem,
} from './toyota/ManufacturingSimulation';

// ruvector Orchestrator
export { RuvectorAgentOrchestrator } from './ruvector/AgentOrchestrator';

// ruvector Integration (Vector Memory + GNN)
export {
  RuvectorSystem,
  RuvectorMemorySystem,
  RuvectorGNNLearner,
  getRuvectorSystem,
} from './ruvector/RuvectorIntegration';

// Simulation Engine
export { ToyotaSimulationEngine } from './simulation/SimulationEngine';

// Quick Start
import { ToyotaSimulationEngine } from './simulation/SimulationEngine';

/**
 * Create and run a Toyota simulation with default settings
 */
export async function runSimulation(config?: {
  employees?: number;
  suppliers?: number;
  durationHours?: number;
}): Promise<void> {
  const engine = new ToyotaSimulationEngine({
    employeeCount: config?.employees || 100000,
    supplierCount: config?.suppliers || 500,
  });

  await engine.initialize();
  await engine.start();

  // Run for specified duration
  const duration = (config?.durationHours || 24) * 3600 * 1000;
  await new Promise(resolve => setTimeout(resolve, duration));

  await engine.stop();

  console.log('\nSimulation Complete!');
  console.log(JSON.stringify(engine.getSimulationStatus(), null, 2));
}

// Default export
export default ToyotaSimulationEngine;
