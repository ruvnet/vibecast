/**
 * VibeCast Pro - MAKER-Enhanced Orchestrator
 *
 * Integrates the MAKER framework's error correction mechanisms
 * with the multi-agent swarm for more reliable recommendations.
 *
 * Key features:
 * - First-to-Ahead-by-k voting for agent consensus
 * - Red-flagging for anomaly detection
 * - Microagent decomposition of recommendation tasks
 */

import {
  MAKERExecutor,
  MAKERConfig,
  DEFAULT_MAKER_CONFIG,
  wrapAsStep,
  MAKERStats,
  calculateFullTaskSuccess
} from '../../maker';
import {
  SwarmOrchestrator,
  OrchestrationResult,
  AggregatedRecommendation
} from './orchestrator';
import { DiscoveryContext } from './base-agent';
import { getBenchmarkRunner } from '../../benchmark';

/**
 * MAKER-enhanced orchestration result
 */
export interface MAKEROrchestrationResult extends OrchestrationResult {
  /** MAKER statistics */
  makerStats: MAKERStats;
  /** Voting confidence for top recommendations */
  votingConfidence: Map<string, number>;
  /** Red flags detected during orchestration */
  redFlags: string[];
  /** Estimated reliability of results */
  estimatedReliability: number;
}

/**
 * MAKER-Enhanced Swarm Orchestrator
 *
 * Wraps the standard orchestrator with MAKER's error correction
 */
export class MAKERSwarmOrchestrator {
  private baseOrchestrator: SwarmOrchestrator;
  private makerExecutor: MAKERExecutor;
  private config: MAKERConfig;

  constructor(config?: Partial<MAKERConfig>) {
    this.baseOrchestrator = new SwarmOrchestrator();
    this.config = { ...DEFAULT_MAKER_CONFIG, ...config };
    this.makerExecutor = new MAKERExecutor(this.config);
  }

  /**
   * Get agent states
   */
  getAgentStates() {
    return this.baseOrchestrator.getAgentStates();
  }

  /**
   * Get MAKER statistics
   */
  getStats(): MAKERStats {
    return this.makerExecutor.getStats();
  }

  /**
   * Orchestrate with MAKER error correction
   *
   * Runs multiple orchestration passes and uses voting to
   * select the most consistent recommendations.
   */
  async orchestrate(
    context: DiscoveryContext,
    limit: number = 10
  ): Promise<MAKEROrchestrationResult> {
    // Create decomposed step for orchestration
    const orchestrationStep = wrapAsStep<DiscoveryContext, OrchestrationResult>(
      'orchestrate-recommendations',
      'Orchestrate Multi-Agent Recommendations',
      async (ctx) => this.baseOrchestrator.orchestrate(ctx, limit),
      {
        validate: (result) => {
          // Validate that we got meaningful results
          return result.recommendations.length > 0 &&
                 result.recommendations.every(r => r.finalScore >= 0);
        },
        serialize: (result) => {
          // Serialize based on top recommendation order
          return result.recommendations
            .slice(0, 3)
            .map(r => r.contentId)
            .join(',');
        }
      }
    );

    // Execute with voting
    const stepResult = await this.makerExecutor.executeStep(
      orchestrationStep,
      context
    );

    const baseResult = stepResult.output;
    const stats = this.makerExecutor.getStats();

    // Calculate voting confidence per recommendation
    const votingConfidence = new Map<string, number>();
    for (const rec of baseResult.recommendations) {
      // Higher agent consensus = higher confidence
      const agentCount = rec.agentScores.size;
      const consensusMultiplier = rec.consensusLevel === 'strong' ? 1.0
        : rec.consensusLevel === 'moderate' ? 0.8
        : 0.6;

      const confidence = (agentCount / 4) * consensusMultiplier * stepResult.votingResult.confidence;
      votingConfidence.set(rec.contentId, confidence);
    }

    // Collect red flags
    const redFlags = stepResult.votingResult.redFlags;

    // Calculate estimated reliability
    const estimatedReliability = calculateFullTaskSuccess(
      stats.perStepAccuracy || 0.8,
      this.config.votingThreshold,
      1 // Single step for basic orchestration
    );

    return {
      ...baseResult,
      makerStats: stats,
      votingConfidence,
      redFlags,
      estimatedReliability
    };
  }

  /**
   * Run deep orchestration with multiple decomposed steps
   *
   * This breaks down the recommendation process into:
   * 1. Context analysis
   * 2. Mood extraction
   * 3. Content matching
   * 4. Personalization
   * 5. Final ranking
   *
   * Each step uses voting for error correction.
   */
  async deepOrchestrate(
    context: DiscoveryContext,
    limit: number = 10
  ): Promise<MAKEROrchestrationResult> {
    this.makerExecutor.resetStats();
    const allRedFlags: string[] = [];

    // Step 1: Analyze and enhance context
    const contextStep = wrapAsStep<DiscoveryContext, DiscoveryContext>(
      'analyze-context',
      'Analyze Discovery Context',
      async (ctx) => {
        // Enrich context with derived signals
        const enriched: DiscoveryContext = {
          ...ctx,
          signals: {
            ...ctx.signals
          }
        };
        return enriched;
      },
      {
        validate: (result) => !!result.userId,
        serialize: (result) => `${result.userId}-${result.mood || 'none'}-${result.query || 'none'}`
      }
    );

    const contextResult = await this.makerExecutor.executeStep(contextStep, context);
    allRedFlags.push(...contextResult.votingResult.redFlags);

    // Step 2: Run parallel agent analysis
    const parallelAnalysisStep = wrapAsStep<DiscoveryContext, OrchestrationResult>(
      'parallel-analysis',
      'Run Parallel Agent Analysis',
      async (ctx) => this.baseOrchestrator.orchestrate(ctx, limit * 2),
      {
        validate: (result) => result.recommendations.length > 0,
        serialize: (result) => result.recommendations.slice(0, 5).map(r => r.contentId).join(',')
      }
    );

    const analysisResult = await this.makerExecutor.executeStep(
      parallelAnalysisStep,
      contextResult.output
    );
    allRedFlags.push(...analysisResult.votingResult.redFlags);

    // Step 3: Refine and rank
    const rankingStep = wrapAsStep<AggregatedRecommendation[], AggregatedRecommendation[]>(
      'refine-ranking',
      'Refine and Rank Recommendations',
      async (recommendations) => {
        // Apply additional scoring based on consensus
        return recommendations.map(rec => ({
          ...rec,
          finalScore: rec.finalScore * (rec.consensusLevel === 'strong' ? 1.1 : 1.0)
        })).sort((a, b) => b.finalScore - a.finalScore);
      },
      {
        validate: (result) => result.length > 0,
        serialize: (result) => result.slice(0, 3).map(r => `${r.contentId}:${r.finalScore.toFixed(2)}`).join(',')
      }
    );

    const rankingResult = await this.makerExecutor.executeStep(
      rankingStep,
      analysisResult.output.recommendations
    );
    allRedFlags.push(...rankingResult.votingResult.redFlags);

    const finalRecommendations = rankingResult.output.slice(0, limit);
    const stats = this.makerExecutor.getStats();

    // Calculate voting confidence
    const votingConfidence = new Map<string, number>();
    const overallConfidence = (
      contextResult.votingResult.confidence +
      analysisResult.votingResult.confidence +
      rankingResult.votingResult.confidence
    ) / 3;

    for (const rec of finalRecommendations) {
      const confidence = overallConfidence * (rec.consensusLevel === 'strong' ? 1.0 : 0.85);
      votingConfidence.set(rec.contentId, confidence);
    }

    // Calculate estimated reliability across all steps
    const estimatedReliability = calculateFullTaskSuccess(
      stats.perStepAccuracy || 0.8,
      this.config.votingThreshold,
      stats.totalSteps
    );

    return {
      recommendations: finalRecommendations,
      agentResults: analysisResult.output.agentResults,
      orchestrationStrategy: 'adaptive',
      totalProcessingTime: contextResult.executionTime +
                          analysisResult.executionTime +
                          rankingResult.executionTime,
      agentContributions: analysisResult.output.agentContributions,
      makerStats: stats,
      votingConfidence,
      redFlags: allRedFlags,
      estimatedReliability
    };
  }

  /**
   * Run benchmark on the orchestrator
   */
  async runBenchmark(
    context: DiscoveryContext,
    iterations: number = 10
  ): Promise<void> {
    const runner = getBenchmarkRunner();
    this.makerExecutor.resetStats();

    // Run multiple orchestrations
    for (let i = 0; i < iterations; i++) {
      await this.orchestrate(context, 5);
    }

    const stats = this.makerExecutor.getStats();
    runner.record(`MAKER-Orchestrator-${Date.now()}`, stats, this.config);
  }

  /**
   * Explain recommendation with MAKER confidence
   */
  explainRecommendation(
    recommendation: AggregatedRecommendation,
    votingConfidence: Map<string, number>
  ): string {
    const baseExplanation = this.baseOrchestrator.explainRecommendation(recommendation);
    const confidence = votingConfidence.get(recommendation.contentId) || 0;

    return `${baseExplanation}

MAKER Confidence: ${(confidence * 100).toFixed(1)}%
Reliability: ${confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low'}`;
  }

  /**
   * Get configuration
   */
  getConfig(): MAKERConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MAKERConfig>): void {
    this.config = { ...this.config, ...updates };
    this.makerExecutor = new MAKERExecutor(this.config);
  }
}

// Singleton instance
let makerOrchestratorInstance: MAKERSwarmOrchestrator | null = null;

/**
 * Get MAKER orchestrator instance
 */
export function getMAKERSwarmOrchestrator(): MAKERSwarmOrchestrator {
  if (!makerOrchestratorInstance) {
    makerOrchestratorInstance = new MAKERSwarmOrchestrator();
  }
  return makerOrchestratorInstance;
}

/**
 * Reset MAKER orchestrator
 */
export function resetMAKERSwarmOrchestrator(): void {
  makerOrchestratorInstance = null;
}
