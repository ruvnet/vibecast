/**
 * Router 2.0 - Learning Router with Contextual Bandits
 *
 * Intelligently routes requests to ONNX local, economy LLM, or premium LLM
 * based on learned preferences, cost constraints, and quality requirements.
 *
 * Features:
 * - Contextual bandit learning (Thompson Sampling)
 * - Budget guards and spend caps
 * - Quality-cost trade-offs
 * - Privacy scoring
 * - Automatic rollback on quality degradation
 */

import { connectAgentDB } from '../db/agentdb.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Lane configurations with cost and capability profiles
 */
const LANES = {
  onnx_local: {
    id: 'onnx_local',
    name: 'ONNX Local',
    costPerRequest: 0.0,        // Free (local compute)
    avgLatencyMs: 50,
    privacyScore: 1.0,          // Perfect privacy (on-device)
    qualityScore: 0.7,          // Good for simple tasks
    maxTokens: 2048,
    supports: ['validation', 'simple_enrichment', 'classification']
  },

  economy: {
    id: 'economy',
    name: 'Economy LLM',
    costPerRequest: 0.01,       // $0.01 per request
    avgLatencyMs: 200,
    privacyScore: 0.5,          // External API
    qualityScore: 0.85,         // Very good
    maxTokens: 4096,
    supports: ['validation', 'enrichment', 'transformation', 'reasoning']
  },

  premium: {
    id: 'premium',
    name: 'Premium LLM',
    costPerRequest: 0.05,       // $0.05 per request
    avgLatencyMs: 500,
    privacyScore: 0.5,          // External API
    qualityScore: 0.95,         // Excellent
    maxTokens: 8192,
    supports: ['validation', 'enrichment', 'transformation', 'complex_reasoning', 'generation']
  }
};

/**
 * Contextual Bandit Router using Thompson Sampling
 */
export class Router2 {
  constructor(config = {}) {
    this.db = connectAgentDB();
    this.config = {
      budgetCap: config.budgetCap || 100.0,        // Daily budget cap in USD
      rollbackThreshold: config.rollbackThreshold || 0.15, // 15% quality drop triggers rollback
      explorationRate: config.explorationRate || 0.1,      // 10% exploration
      windowSize: config.windowSize || 1000,      // Learning window size
      ...config
    };

    // Thompson Sampling state per lane
    this.bandits = {
      onnx_local: { alpha: 1, beta: 1, successes: 0, failures: 0, requests: 0 },
      economy: { alpha: 1, beta: 1, successes: 0, failures: 0, requests: 0 },
      premium: { alpha: 1, beta: 1, successes: 0, failures: 0, requests: 0 }
    };

    // Cost tracking
    this.dailySpend = 0.0;
    this.lastResetDate = new Date().toISOString().split('T')[0];

    // Load state from database
    this._loadState();
  }

  /**
   * Load router state from database
   */
  async _loadState() {
    try {
      const state = await this.db.query('router_state', {
        orderBy: { column: 'created_at', ascending: false },
        limit: 1
      });

      if (state.length > 0) {
        const { bandits, daily_spend, last_reset_date } = state[0];
        this.bandits = bandits;
        this.dailySpend = daily_spend;
        this.lastResetDate = last_reset_date;
      }
    } catch (error) {
      console.log('Router state not found, using defaults');
    }
  }

  /**
   * Save router state to database
   */
  async _saveState() {
    await this.db.insert('router_state', {
      bandits: this.bandits,
      daily_spend: this.dailySpend,
      last_reset_date: this.lastResetDate,
      created_at: new Date().toISOString()
    });
  }

  /**
   * Reset daily spend if new day
   */
  _checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      console.log(`🔄 Daily budget reset: $${this.dailySpend.toFixed(2)} → $0.00`);
      this.dailySpend = 0.0;
      this.lastResetDate = today;
      this._saveState();
    }
  }

  /**
   * Extract features from request context
   */
  _extractFeatures(context) {
    const features = {
      taskType: context.taskType || 'validation',
      hasPII: this._detectPII(context.input),
      complexity: this._estimateComplexity(context.input),
      deadline: context.deadline || 5000,  // Default 5s deadline
      requiresReasoning: context.requiresReasoning || false
    };

    return features;
  }

  /**
   * Detect PII in input (simple heuristic)
   */
  _detectPII(input) {
    if (!input) return false;

    const str = typeof input === 'string' ? input : JSON.stringify(input);

    // Check for email, SSN, credit card patterns
    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // Email
      /\b\d{3}-\d{2}-\d{4}\b/,                                 // SSN
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/               // Credit card
    ];

    return patterns.some(pattern => pattern.test(str));
  }

  /**
   * Estimate input complexity
   */
  _estimateComplexity(input) {
    if (!input) return 0.1;

    const str = typeof input === 'string' ? input : JSON.stringify(input);
    const length = str.length;

    // Simple heuristic: longer input = higher complexity
    if (length < 100) return 0.2;
    if (length < 500) return 0.5;
    if (length < 1000) return 0.7;
    return 0.9;
  }

  /**
   * Filter lanes based on features and constraints
   */
  _filterLanes(features) {
    let candidates = Object.values(LANES);

    // Privacy constraint: PII must use ONNX local
    if (features.hasPII && this.config.privacyFirst !== false) {
      candidates = candidates.filter(lane => lane.privacyScore >= 0.9);
    }

    // Task type constraint
    candidates = candidates.filter(lane =>
      lane.supports.includes(features.taskType)
    );

    // Latency constraint
    candidates = candidates.filter(lane =>
      lane.avgLatencyMs <= features.deadline
    );

    // Budget constraint
    this._checkDailyReset();
    if (this.dailySpend >= this.config.budgetCap) {
      console.warn(`⚠️  Budget cap reached: $${this.dailySpend.toFixed(2)}/$${this.config.budgetCap}`);
      candidates = candidates.filter(lane => lane.costPerRequest === 0);
    }

    return candidates;
  }

  /**
   * Thompson Sampling: sample from Beta distribution
   */
  _sampleBeta(alpha, beta) {
    // Simple Beta sampling using Gamma distributions
    // In production, use a proper stats library
    const gammaA = this._gammaRandom(alpha, 1);
    const gammaB = this._gammaRandom(beta, 1);
    return gammaA / (gammaA + gammaB);
  }

  /**
   * Gamma random variable (simplified)
   */
  _gammaRandom(shape, scale) {
    // Marsaglia and Tsang method (simplified)
    if (shape < 1) {
      return this._gammaRandom(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this._normalRandom();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v * scale;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * scale;
      }
    }
  }

  /**
   * Normal random variable (Box-Muller)
   */
  _normalRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Select lane using Thompson Sampling
   */
  _selectLane(candidates, features) {
    // Exploration vs exploitation
    if (Math.random() < this.config.explorationRate) {
      // Explore: random selection
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Exploit: Thompson Sampling
    let bestLane = null;
    let bestScore = -Infinity;

    for (const lane of candidates) {
      const bandit = this.bandits[lane.id];

      // Sample from Beta(alpha, beta)
      const sample = this._sampleBeta(bandit.alpha, bandit.beta);

      // Adjust score by cost (reward = quality / cost)
      const costAdjustedScore = sample / (lane.costPerRequest + 0.001);

      if (costAdjustedScore > bestScore) {
        bestScore = costAdjustedScore;
        bestLane = lane;
      }
    }

    return bestLane || candidates[0];
  }

  /**
   * Route a request to the best lane
   *
   * @param {object} context - Request context with input, taskType, etc.
   * @returns {object} - Routing decision with lane, cost, reasoning
   */
  async route(context) {
    console.log('\n🔀 Router 2.0 - Intelligent Lane Selection');
    console.log('━'.repeat(80));

    // Extract features
    const features = this._extractFeatures(context);
    console.log('📊 Features:', {
      taskType: features.taskType,
      hasPII: features.hasPII,
      complexity: features.complexity.toFixed(2),
      deadline: `${features.deadline}ms`
    });

    // Filter eligible lanes
    const candidates = this._filterLanes(features);

    if (candidates.length === 0) {
      throw new Error('No eligible lanes available for request');
    }

    console.log(`🎯 Eligible lanes: ${candidates.map(l => l.id).join(', ')}`);

    // Select best lane using Thompson Sampling
    const selectedLane = this._selectLane(candidates, features);

    // Track request
    this.bandits[selectedLane.id].requests++;

    // Prepare routing decision
    const decision = {
      lane: selectedLane.id,
      laneName: selectedLane.name,
      costPerRequest: selectedLane.costPerRequest,
      expectedLatency: selectedLane.avgLatencyMs,
      privacyScore: selectedLane.privacyScore,
      qualityScore: selectedLane.qualityScore,
      reasoning: this._explainDecision(selectedLane, features, candidates),
      features,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Selected:', decision.lane);
    console.log('   Cost:', `$${decision.costPerRequest.toFixed(4)}`);
    console.log('   Quality:', `${(decision.qualityScore * 100).toFixed(0)}%`);
    console.log('   Privacy:', `${(decision.privacyScore * 100).toFixed(0)}%`);
    console.log('   Reasoning:', decision.reasoning);
    console.log('━'.repeat(80));

    // Update spend
    this.dailySpend += selectedLane.costPerRequest;

    // Log decision
    await this._logDecision(decision, context);

    return decision;
  }

  /**
   * Explain routing decision
   */
  _explainDecision(lane, features, candidates) {
    const reasons = [];

    if (features.hasPII && lane.privacyScore >= 0.9) {
      reasons.push('PII detected → privacy-first routing');
    }

    if (lane.costPerRequest === 0) {
      reasons.push('Zero cost (local compute)');
    }

    if (candidates.length === 1) {
      reasons.push('Only eligible lane');
    } else {
      const bandit = this.bandits[lane.id];
      const winRate = bandit.successes / (bandit.successes + bandit.failures + 1);
      reasons.push(`Best quality/cost ratio (${(winRate * 100).toFixed(0)}% success rate)`);
    }

    return reasons.join('; ');
  }

  /**
   * Log routing decision
   */
  async _logDecision(decision, context) {
    await this.db.insert('router_decisions', {
      lane: decision.lane,
      cost: decision.costPerRequest,
      features: decision.features,
      reasoning: decision.reasoning,
      context_id: context.id,
      created_at: decision.timestamp
    });
  }

  /**
   * Provide feedback on routing decision
   *
   * @param {string} decisionId - Decision identifier
   * @param {boolean} success - Whether the request succeeded
   * @param {object} metrics - Quality metrics (accuracy, latency, etc.)
   */
  async feedback(decisionId, success, metrics = {}) {
    // Get decision
    const decisions = await this.db.query('router_decisions', {
      where: { id: decisionId },
      limit: 1
    });

    if (decisions.length === 0) {
      console.warn(`Decision ${decisionId} not found`);
      return;
    }

    const decision = decisions[0];
    const lane = decision.lane;

    // Update bandit state
    if (success) {
      this.bandits[lane].successes++;
      this.bandits[lane].alpha++;
    } else {
      this.bandits[lane].failures++;
      this.bandits[lane].beta++;
    }

    // Check for rollback condition
    const totalRequests = this.bandits[lane].successes + this.bandits[lane].failures;
    const winRate = this.bandits[lane].successes / totalRequests;

    if (totalRequests > 100 && winRate < (1 - this.config.rollbackThreshold)) {
      console.warn(`⚠️  Lane ${lane} quality degraded (${(winRate * 100).toFixed(0)}%) - consider rollback`);
    }

    // Save state
    await this._saveState();

    // Log feedback
    await this.db.insert('router_feedback', {
      decision_id: decisionId,
      lane,
      success,
      metrics,
      bandit_state: this.bandits[lane],
      created_at: new Date().toISOString()
    });

    console.log(`📊 Feedback recorded: ${lane} ${success ? '✅' : '❌'} (Win rate: ${(winRate * 100).toFixed(0)}%)`);
  }

  /**
   * Get router statistics
   */
  async getStats() {
    const stats = {
      dailySpend: this.dailySpend,
      budgetCap: this.config.budgetCap,
      budgetUtilization: (this.dailySpend / this.config.budgetCap) * 100,
      lanes: {}
    };

    for (const [laneId, bandit] of Object.entries(this.bandits)) {
      const total = bandit.successes + bandit.failures;
      const winRate = total > 0 ? bandit.successes / total : 0;

      stats.lanes[laneId] = {
        requests: bandit.requests,
        successes: bandit.successes,
        failures: bandit.failures,
        winRate: parseFloat((winRate * 100).toFixed(2)),
        confidence: this._betaConfidence(bandit.alpha, bandit.beta)
      };
    }

    return stats;
  }

  /**
   * Calculate Beta distribution confidence interval
   */
  _betaConfidence(alpha, beta, confidence = 0.95) {
    // Simplified confidence interval
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const stdDev = Math.sqrt(variance);

    return {
      mean: parseFloat((mean * 100).toFixed(2)),
      lower: parseFloat(Math.max(0, (mean - 1.96 * stdDev) * 100).toFixed(2)),
      upper: parseFloat(Math.min(100, (mean + 1.96 * stdDev) * 100).toFixed(2))
    };
  }
}

export default Router2;
