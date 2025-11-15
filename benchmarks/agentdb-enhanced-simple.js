/**
 * AgentDB-Enhanced Predictor (Simplified)
 * Uses pattern learning and adaptive conformal prediction
 * Optimized version without complex database operations
 */

import { createAdaptivePredictor } from '@neural-trader/predictor';
import { EmbeddingService } from 'agentdb';

export class AgentDBEnhancedPredictor {
  constructor(config = {}) {
    this.targetCoverage = config.targetCoverage || 0.9;
    this.gamma = config.gamma || 0.005;
    this.patternWindow = config.patternWindow || 20;
    this.name = 'AgentDB-Enhanced (Optimized)';
    this.predictor = null;
    this.embeddingService = null;
    this.patterns = [];
    this.performanceHistory = [];
  }

  async initialize() {
    // Initialize embedding service for semantic pattern matching
    try {
      this.embeddingService = new EmbeddingService({
        model: 'Xenova/all-MiniLM-L6-v2'
      });
      await this.embeddingService.initialize();
    } catch (error) {
      // Fallback: use without embeddings if initialization fails
      console.warn('⚠️ Embedding service unavailable, using pattern matching without embeddings');
      this.embeddingService = null;
    }
  }

  async train(data) {
    if (!this.embeddingService) {
      await this.initialize();
    }

    // Extract and store patterns
    await this.extractPatterns(data);

    // Generate predictions with pattern-based features
    const predictions = [];
    const actuals = [];

    for (let i = this.patternWindow + 10; i < data.length - 1; i++) {
      const recent = data.slice(i - this.patternWindow, i);

      // Get pattern-enhanced prediction
      const prediction = await this.generatePatternPrediction(recent, data, i);

      predictions.push(prediction);
      actuals.push(data[i + 1].price);
    }

    // Create and calibrate adaptive predictor
    const calibSize = Math.min(1500, predictions.length);
    const calibPreds = predictions.slice(-calibSize);
    const calibActuals = actuals.slice(-calibSize);

    const { predictor } = await createAdaptivePredictor({
      targetCoverage: this.targetCoverage,
      gamma: this.gamma
    });

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  async extractPatterns(data) {
    for (let i = this.patternWindow; i < Math.min(data.length - 1, this.patternWindow + 500); i += 5) {
      const pattern = data.slice(i - this.patternWindow, i);
      const prices = pattern.map(d => d.price);

      // Calculate pattern features
      const returns = [];
      for (let j = 1; j < prices.length; j++) {
        returns.push((prices[j] - prices[j-1]) / prices[j-1]);
      }

      const trend = (prices[prices.length - 1] - prices[0]) / prices[0];
      const volatility = Math.sqrt(
        returns.reduce((sum, r) => sum + r * r, 0) / returns.length
      );
      const momentum = returns.slice(-5).reduce((a, b) => a + b, 0) / 5;

      // Pattern description
      const description = `Trend: ${(trend * 100).toFixed(2)}%, Vol: ${(volatility * 100).toFixed(2)}%, Mom: ${(momentum * 100).toFixed(2)}%, Regime: ${data[i].regime}`;

      // Get embedding if available
      let embedding = null;
      if (this.embeddingService) {
        try {
          embedding = await this.embeddingService.embedText(description);
        } catch (e) {
          // Skip if embedding fails
        }
      }

      // Outcome
      const outcome = (data[i + 1].price - prices[prices.length - 1]) / prices[prices.length - 1];

      this.patterns.push({
        description,
        embedding,
        outcome,
        volatility,
        trend,
        momentum,
        regime: data[i].regime,
        timestamp: data[i].timestamp
      });
    }
  }

  async generatePatternPrediction(recent, allData, currentIndex) {
    const prices = recent.map(d => d.price);

    // Calculate current pattern features
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const trend = (prices[prices.length - 1] - prices[0]) / prices[0];
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    const momentum = returns.slice(-5).reduce((a, b) => a + b, 0) / 5;

    const currentRegime = recent[recent.length - 1].regime;

    // Find similar patterns
    let similarPatterns;

    if (this.embeddingService && this.patterns[0]?.embedding) {
      // Use semantic similarity
      const description = `Trend: ${(trend * 100).toFixed(2)}%, Vol: ${(volatility * 100).toFixed(2)}%, Mom: ${(momentum * 100).toFixed(2)}%, Regime: ${currentRegime}`;
      let currentEmbedding;

      try {
        currentEmbedding = await this.embeddingService.embedText(description);
      } catch (e) {
        currentEmbedding = null;
      }

      if (currentEmbedding) {
        similarPatterns = this.patterns
          .filter(p => p.embedding)
          .map(p => ({
            pattern: p,
            similarity: this.cosineSimilarity(currentEmbedding, p.embedding)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 20);
      }
    }

    if (!similarPatterns || similarPatterns.length === 0) {
      // Fallback: use feature-based similarity
      similarPatterns = this.patterns
        .map(p => ({
          pattern: p,
          similarity: this.featureSimilarity({ trend, volatility, momentum, regime: currentRegime }, p)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20);
    }

    // Weighted average of outcomes
    let weightedOutcome = 0;
    let totalWeight = 0;

    for (const sp of similarPatterns) {
      const weight = Math.pow(sp.similarity, 2);
      weightedOutcome += sp.pattern.outcome * weight;
      totalWeight += weight;
    }

    const avgOutcome = totalWeight > 0 ? weightedOutcome / totalWeight : momentum;

    // Combine pattern-based prediction with trend
    const basePrediction = prices[prices.length - 1] * (1 + avgOutcome);

    // Regime-specific adjustment
    const regimePatterns = similarPatterns.filter(
      sp => sp.pattern.regime === currentRegime
    );

    if (regimePatterns.length > 5) {
      const regimeWeightedOutcome = regimePatterns.reduce((sum, rp) => sum + rp.pattern.outcome * Math.pow(rp.similarity, 2), 0);
      const regimeWeight = regimePatterns.reduce((sum, rp) => sum + Math.pow(rp.similarity, 2), 0);
      const regimeOutcome = regimeWeight > 0 ? regimeWeightedOutcome / regimeWeight : avgOutcome;

      return basePrediction * 0.7 + prices[prices.length - 1] * (1 + regimeOutcome) * 0.3;
    }

    return basePrediction;
  }

  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dotProduct / denom : 0;
  }

  featureSimilarity(current, pattern) {
    // Euclidean distance in feature space
    const trendDiff = Math.abs(current.trend - pattern.trend);
    const volDiff = Math.abs(current.volatility - pattern.volatility);
    const momDiff = Math.abs(current.momentum - pattern.momentum);
    const regimeMatch = current.regime === pattern.regime ? 0 : 0.1;

    const distance = Math.sqrt(trendDiff * trendDiff + volDiff * volDiff + momDiff * momDiff + regimeMatch * regimeMatch);

    // Convert distance to similarity
    return 1 / (1 + distance);
  }

  async predict(historical, current) {
    if (!this.predictor) {
      throw new Error('Predictor not trained');
    }

    const recent = historical.slice(-this.patternWindow);
    const prices = recent.map(d => d.price);

    // Calculate features
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const trend = (prices[prices.length - 1] - prices[0]) / prices[0];
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    const momentum = returns.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const currentRegime = recent[recent.length - 1].regime;

    // Find similar patterns
    const similarPatterns = this.patterns
      .map(p => ({
        pattern: p,
        similarity: this.featureSimilarity({ trend, volatility, momentum, regime: currentRegime }, p)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20);

    // Weighted prediction
    let weightedOutcome = 0;
    let totalWeight = 0;

    for (const sp of similarPatterns) {
      const weight = Math.pow(sp.similarity, 2);
      weightedOutcome += sp.pattern.outcome * weight;
      totalWeight += weight;
    }

    const avgOutcome = totalWeight > 0 ? weightedOutcome / totalWeight : momentum;
    const pointPred = prices[prices.length - 1] * (1 + avgOutcome);

    // Get conformal prediction interval
    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }

  async cleanup() {
    // Nothing to cleanup in simplified version
  }
}
