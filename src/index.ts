/**
 * Vibecast PubNub Integration with ruv.io patterns
 * Main entry point
 */

export { PubNubService } from './core/PubNubService';
export { AgentOrchestrator } from './agents/AgentOrchestrator';
export { SwarmCoordinator } from './agents/SwarmCoordinator';
export { FlowNexusIntegration } from './integrations/FlowNexusIntegration';
export { MCPProtocol } from './utils/MCPProtocol';

export * from './core/types';

// Re-export for convenience
import { PubNubService } from './core/PubNubService';
import { AgentOrchestrator } from './agents/AgentOrchestrator';
import { SwarmCoordinator } from './agents/SwarmCoordinator';
import { FlowNexusIntegration } from './integrations/FlowNexusIntegration';
import { MCPProtocol } from './utils/MCPProtocol';

export default {
  PubNubService,
  AgentOrchestrator,
  SwarmCoordinator,
  FlowNexusIntegration,
  MCPProtocol,
};
