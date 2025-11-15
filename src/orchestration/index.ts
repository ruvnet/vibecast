/**
 * Main Orchestration Module
 * Exports orchestration components and provides factory functions
 */

import { AgentSwarm } from './agent-swarm.js';
import { AgenticFlowEngine } from '../lib/frameworks/agentic-flow.js';
import { LeanAgenticEngine } from '../lib/frameworks/lean-agentic.js';
import { StrangeLoopsEngine } from '../lib/frameworks/strange-loops.js';
import { FranchiseAnalysisAgent } from '../agents/franchise-analysis-agent.js';
import { GrowthPlanningAgent } from '../agents/growth-planning-agent.js';
import { TerritoryAgent } from '../agents/territory-agent.js';
import { ComplianceAgent } from '../agents/compliance-agent.js';
import { ReportingAgent } from '../agents/reporting-agent.js';

export * from './agent-swarm.js';

/**
 * Create and initialize a complete agent swarm with all specialized agents
 */
export function createFranchiseSwarm(): AgentSwarm {
  const swarm = new AgentSwarm({
    maxConcurrentAgents: 5,
    enableLogging: true,
  });

  // Register all specialized agents
  swarm.registerAgent('franchise-analysis', new FranchiseAnalysisAgent());
  swarm.registerAgent('growth-planning', new GrowthPlanningAgent());
  swarm.registerAgent('territory-management', new TerritoryAgent());
  swarm.registerAgent('compliance', new ComplianceAgent());
  swarm.registerAgent('reporting', new ReportingAgent());

  return swarm;
}

/**
 * Create framework engines
 */
export function createFrameworkEngines(): {
  agenticFlow: AgenticFlowEngine;
  leanAgentic: LeanAgenticEngine;
  strangeLoops: StrangeLoopsEngine;
} {
  return {
    agenticFlow: new AgenticFlowEngine(),
    leanAgentic: new LeanAgenticEngine(),
    strangeLoops: new StrangeLoopsEngine(),
  };
}

/**
 * Initialize complete multi-agent system
 */
export function initializeAgentSystem(): {
  swarm: AgentSwarm;
  frameworks: ReturnType<typeof createFrameworkEngines>;
  agents: {
    franchiseAnalysis: FranchiseAnalysisAgent;
    growthPlanning: GrowthPlanningAgent;
    territory: TerritoryAgent;
    compliance: ComplianceAgent;
    reporting: ReportingAgent;
  };
} {
  const swarm = createFranchiseSwarm();
  const frameworks = createFrameworkEngines();

  const agents = {
    franchiseAnalysis: new FranchiseAnalysisAgent(),
    growthPlanning: new GrowthPlanningAgent(),
    territory: new TerritoryAgent(),
    compliance: new ComplianceAgent(),
    reporting: new ReportingAgent(),
  };

  return { swarm, frameworks, agents };
}
