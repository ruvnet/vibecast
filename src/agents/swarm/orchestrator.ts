/**
 * VibeCast Pro - Agent Orchestrator
 *
 * Coordinates the multi-agent swarm for optimal recommendations.
 * Uses AgenticFlow patterns for agent collaboration.
 *
 * Built for the Agentics Foundation TV5 Hackathon.
 */

import {
  BaseAgent,
  DiscoveryContext,
  AgentResult,
  ContentRecommendation,
  AgentState
} from './base-agent';
import { MoodAnalystAgent } from './mood-analyst';
import { SemanticCuratorAgent } from './semantic-curator';
import { TrendSpotterAgent } from './trend-spotter';
import { PersonalizationAgent } from './personalization-agent';
import { getContentCatalog } from '../../services/content-catalog';

/**
 * Orchestration strategy
 */
export type OrchestrationType = 'parallel' | 'sequential' | 'adaptive';

/**
 * Aggregated recommendation with multi-agent consensus
 */
export interface AggregatedRecommendation {
  contentId: string;
  title: string;
  finalScore: number;
  agentScores: Map<string, number>;
  consensusLevel: 'strong' | 'moderate' | 'weak';
  reasons: string[];
  sources: string[];
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  recommendations: AggregatedRecommendation[];
  agentResults: Map<string, AgentResult<ContentRecommendation[]>>;
  orchestrationStrategy: OrchestrationType;
  totalProcessingTime: number;
  agentContributions: Map<string, number>;
}

/**
 * Agent weight configuration
 */
interface AgentWeights {
  moodAnalyst: number;
  semanticCurator: number;
  trendSpotter: number;
  personalization: number;
}

/**
 * Swarm Orchestrator - Coordinates all agents
 */
export class SwarmOrchestrator {
  private agents: BaseAgent[];
  private moodAgent: MoodAnalystAgent;
  private semanticAgent: SemanticCuratorAgent;
  private trendAgent: TrendSpotterAgent;
  private personalizationAgent: PersonalizationAgent;
  private weights: AgentWeights;

  constructor(weights?: Partial<AgentWeights>) {
    // Initialize agents
    this.moodAgent = new MoodAnalystAgent();
    this.semanticAgent = new SemanticCuratorAgent();
    this.trendAgent = new TrendSpotterAgent();
    this.personalizationAgent = new PersonalizationAgent();

    this.agents = [
      this.moodAgent,
      this.semanticAgent,
      this.trendAgent,
      this.personalizationAgent
    ];

    // Default weights (can be tuned)
    this.weights = {
      moodAnalyst: 0.3,
      semanticCurator: 0.25,
      trendSpotter: 0.15,
      personalization: 0.3,
      ...weights
    };
  }

  /**
   * Get all agent states
   */
  getAgentStates(): AgentState[] {
    return this.agents.map(agent => agent.getState());
  }

  /**
   * Determine optimal orchestration strategy based on context
   */
  private determineStrategy(context: DiscoveryContext): OrchestrationType {
    // Use adaptive by default, but could be customized
    if (context.query && context.query.length > 50) {
      // Complex query - run semantic first for understanding
      return 'sequential';
    }
    // Most cases: run all agents in parallel
    return 'parallel';
  }

  /**
   * Run parallel orchestration
   */
  private async runParallel(context: DiscoveryContext): Promise<Map<string, AgentResult<ContentRecommendation[]>>> {
    const results = new Map<string, AgentResult<ContentRecommendation[]>>();

    // Run all agents concurrently
    const [moodResult, semanticResult, trendResult, personalizationResult] = await Promise.all([
      this.moodAgent.process(context),
      this.semanticAgent.process(context),
      this.trendAgent.process(context),
      this.personalizationAgent.process(context)
    ]);

    results.set('mood-analyst', moodResult);
    results.set('semantic-curator', semanticResult);
    results.set('trend-spotter', trendResult);
    results.set('personalization', personalizationResult);

    return results;
  }

  /**
   * Aggregate results from all agents
   */
  private aggregateResults(
    agentResults: Map<string, AgentResult<ContentRecommendation[]>>
  ): AggregatedRecommendation[] {
    // Collect all content recommendations
    const contentMap = new Map<string, {
      title: string;
      agentScores: Map<string, number>;
      reasons: Set<string>;
      sources: Set<string>;
    }>();

    // Process each agent's results
    for (const [agentId, result] of agentResults) {
      // Get agent weight
      let weight = 0.25;
      if (agentId === 'mood-analyst') weight = this.weights.moodAnalyst;
      else if (agentId === 'semantic-curator') weight = this.weights.semanticCurator;
      else if (agentId === 'trend-spotter') weight = this.weights.trendSpotter;
      else if (agentId === 'personalization') weight = this.weights.personalization;

      // Apply confidence to weight
      const adjustedWeight = weight * result.confidence;

      for (const rec of result.result) {
        if (!contentMap.has(rec.contentId)) {
          contentMap.set(rec.contentId, {
            title: rec.title,
            agentScores: new Map(),
            reasons: new Set(),
            sources: new Set()
          });
        }

        const entry = contentMap.get(rec.contentId)!;
        entry.agentScores.set(agentId, rec.score * adjustedWeight);
        rec.reasons.forEach(r => entry.reasons.add(r));
        entry.sources.add(rec.source);
      }
    }

    // Calculate final scores and consensus
    const aggregated: AggregatedRecommendation[] = [];

    for (const [contentId, data] of contentMap) {
      const scores = Array.from(data.agentScores.values());
      const finalScore = scores.reduce((sum, s) => sum + s, 0);
      const agentCount = scores.length;

      // Determine consensus level
      let consensusLevel: AggregatedRecommendation['consensusLevel'];
      if (agentCount >= 3 && scores.every(s => s > 0.1)) {
        consensusLevel = 'strong';
      } else if (agentCount >= 2) {
        consensusLevel = 'moderate';
      } else {
        consensusLevel = 'weak';
      }

      aggregated.push({
        contentId,
        title: data.title,
        finalScore,
        agentScores: data.agentScores,
        consensusLevel,
        reasons: Array.from(data.reasons).slice(0, 5),
        sources: Array.from(data.sources)
      });
    }

    // Sort by final score
    aggregated.sort((a, b) => b.finalScore - a.finalScore);

    return aggregated;
  }

  /**
   * Calculate agent contributions
   */
  private calculateContributions(
    recommendations: AggregatedRecommendation[]
  ): Map<string, number> {
    const contributions = new Map<string, number>();
    let totalContribution = 0;

    for (const rec of recommendations) {
      for (const [agentId, score] of rec.agentScores) {
        const current = contributions.get(agentId) || 0;
        contributions.set(agentId, current + score);
        totalContribution += score;
      }
    }

    // Normalize to percentages
    if (totalContribution > 0) {
      for (const [agentId, contribution] of contributions) {
        contributions.set(agentId, contribution / totalContribution);
      }
    }

    return contributions;
  }

  /**
   * Orchestrate multi-agent discovery
   */
  async orchestrate(
    context: DiscoveryContext,
    limit: number = 10
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // Determine strategy
    const strategy = this.determineStrategy(context);

    // Run agents
    const agentResults = await this.runParallel(context);

    // Aggregate results
    const allRecommendations = this.aggregateResults(agentResults);

    // Take top results
    const topRecommendations = allRecommendations.slice(0, limit);

    // Calculate contributions
    const contributions = this.calculateContributions(topRecommendations);

    return {
      recommendations: topRecommendations,
      agentResults,
      orchestrationStrategy: strategy,
      totalProcessingTime: Date.now() - startTime,
      agentContributions: contributions
    };
  }

  /**
   * Get a quick recommendation using simplified orchestration
   */
  async quickRecommend(
    context: DiscoveryContext
  ): Promise<AggregatedRecommendation | null> {
    const result = await this.orchestrate(context, 1);
    return result.recommendations[0] || null;
  }

  /**
   * Explain why a recommendation was made
   */
  explainRecommendation(recommendation: AggregatedRecommendation): string {
    const lines: string[] = [
      `📽️ "${recommendation.title}"`,
      ``,
      `Consensus: ${recommendation.consensusLevel.toUpperCase()}`,
      `Final Score: ${(recommendation.finalScore * 100).toFixed(1)}%`,
      ``,
      `Agent Contributions:`
    ];

    for (const [agent, score] of recommendation.agentScores) {
      lines.push(`  • ${agent}: ${(score * 100).toFixed(1)}%`);
    }

    lines.push(``, `Why this pick:`);
    recommendation.reasons.slice(0, 3).forEach(reason => {
      lines.push(`  ✓ ${reason}`);
    });

    return lines.join('\n');
  }
}

// Singleton instance
let orchestratorInstance: SwarmOrchestrator | null = null;

/**
 * Get the swarm orchestrator instance
 */
export function getSwarmOrchestrator(): SwarmOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new SwarmOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * Reset the orchestrator
 */
export function resetSwarmOrchestrator(): void {
  orchestratorInstance = null;
}
