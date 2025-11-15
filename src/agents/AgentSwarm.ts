import { BaseAgent } from './BaseAgent';
import { FinancialAnalystAgent } from './FinancialAnalystAgent';
import { MarketResearcherAgent } from './MarketResearcherAgent';
import { GrowthStrategistAgent } from './GrowthStrategistAgent';
import { AgentType, AgentResponse, SwarmCoordinationResult } from '../types';
import { franchiseEvents } from '../events/FranchiseEventEmitter';

/**
 * Agent Swarm Coordinator for multi-agent analysis
 */
export class AgentSwarm {
  private agents: Map<AgentType, BaseAgent>;

  constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.agents.set(AgentType.FINANCIAL_ANALYST, new FinancialAnalystAgent());
    this.agents.set(AgentType.MARKET_RESEARCHER, new MarketResearcherAgent());
    this.agents.set(AgentType.GROWTH_STRATEGIST, new GrowthStrategistAgent());
  }

  getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  async runSingleAgent(type: AgentType, data: any): Promise<AgentResponse> {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error('Agent not found: ' + type);
    }
    return await agent.analyze(data);
  }

  async runMultipleAgents(types: AgentType[], data: any): Promise<AgentResponse[]> {
    const promises = types.map(type => {
      const agent = this.agents.get(type);
      if (!agent) {
        throw new Error('Agent not found: ' + type);
      }
      return agent.analyze(data);
    });

    return await Promise.all(promises);
  }

  async coordinateAnalysis(data: any): Promise<SwarmCoordinationResult> {
    const taskId = 'swarm-' + Date.now();
    franchiseEvents.emitAnalysisStarted('comprehensive');

    console.log('[AgentSwarm] Starting coordinated multi-agent analysis...');

    const agentTypes = [
      AgentType.FINANCIAL_ANALYST,
      AgentType.MARKET_RESEARCHER,
      AgentType.GROWTH_STRATEGIST
    ];

    const results = await this.runMultipleAgents(agentTypes, data);

    const aggregatedInsights = this.aggregateInsights(results);
    const recommendations = this.aggregateRecommendations(results);

    const coordinationResult: SwarmCoordinationResult = {
      taskId,
      agents: agentTypes,
      results,
      aggregatedInsights,
      recommendations,
      completedAt: new Date()
    };

    franchiseEvents.emitAnalysisCompleted(coordinationResult);
    console.log('[AgentSwarm] Coordinated analysis completed');

    return coordinationResult;
  }

  private aggregateInsights(results: AgentResponse[]): string[] {
    const allInsights: string[] = [];

    results.forEach(result => {
      if (result.success && result.insights) {
        allInsights.push('=== ' + result.agentType + ' Insights ===');
        allInsights.push(...result.insights);
      }
    });

    return allInsights;
  }

  private aggregateRecommendations(results: AgentResponse[]): string[] {
    const allRecommendations: string[] = [];

    results.forEach(result => {
      if (result.success && result.recommendations) {
        allRecommendations.push(...result.recommendations);
      }
    });

    // Prioritize and deduplicate
    const unique = Array.from(new Set(allRecommendations));
    return unique.slice(0, 10); // Top 10 recommendations
  }

  getAgentCapabilities(): any[] {
    return this.getAllAgents().map(agent => agent.getCapabilities());
  }
}
