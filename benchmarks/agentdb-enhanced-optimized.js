/**
 * Optimized AgentDB-Enhanced Predictor
 * Phase 1: Numerical features + Euclidean distance
 */

import { createAdaptivePredictor } from '@neural-trader/predictor';

export class AgentDBEnhancedOptimized {
  constructor(options = {}) {
    this.targetCoverage = options.targetCoverage || 0.9;
    this.gamma = options.gamma || 0.005;
    this.patternWindow = options.patternWindow || 20; // Increased from 5
    this.numNeighbors = options.numNeighbors || 10;   // Reduced from 20
    this.minSimilarity = options.minSimilarity || 0.7;

    this.predictor = null;
    this.patterns = [];
    this.featureScales = null;
  }

  // Extract numerical feature vector
  extractFeatures(data, index) {
    const prices = data.slice(Math.max(0, index - 50), index + 1).map(d => d.price);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate RSI-like momentum indicator
    const calculateRSI = (returns, period) => {
      const gains = returns.slice(-period).filter(r => r > 0);
      const losses = returns.slice(-period).filter(r => r < 0).map(r => Math.abs(r));

      const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };

    // Calculate standard deviation
    const std = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    // Price-based features
    const features = {
      // Short-term returns
      returns_1d: returns.length >= 1 ? returns[returns.length - 1] : 0,
      returns_3d: returns.length >= 3 ? returns.slice(-3).reduce((a, b) => a + b) / 3 : 0,
      returns_5d: returns.length >= 5 ? returns.slice(-5).reduce((a, b) => a + b) / 5 : 0,

      // Medium-term returns
      returns_10d: returns.length >= 10 ? returns.slice(-10).reduce((a, b) => a + b) / 10 : 0,
      returns_20d: returns.length >= 20 ? returns.slice(-20).reduce((a, b) => a + b) / 20 : 0,

      // Volatility features
      volatility_5d: returns.length >= 5 ? std(returns.slice(-5)) : 0,
      volatility_10d: returns.length >= 10 ? std(returns.slice(-10)) : 0,
      volatility_20d: returns.length >= 20 ? std(returns.slice(-20)) : 0,

      // Momentum features
      momentum_5d: returns.length >= 5 ? returns.slice(-5).reduce((a, b) => a + b) : 0,
      momentum_10d: returns.length >= 10 ? returns.slice(-10).reduce((a, b) => a + b) : 0,

      // Technical indicators
      rsi_14: returns.length >= 14 ? calculateRSI(returns, 14) / 100 : 0.5, // Normalize to 0-1

      // Trend strength
      trend_strength: returns.length >= 10 ? Math.abs(returns.slice(-10).reduce((a, b) => a + b)) / returns.length : 0,

      // Regime
      regime: data[index].regime || 0
    };

    return Object.values(features);
  }

  // Calculate normalized Euclidean distance
  euclideanDistance(v1, v2) {
    if (!this.featureScales) return Infinity;

    const sum = v1.reduce((acc, val, i) => {
      const normalized = (val - v2[i]) / (this.featureScales[i] + 1e-10);
      return acc + normalized * normalized;
    }, 0);

    return Math.sqrt(sum);
  }

  // Calculate similarity score (inverse of distance)
  similarityScore(distance) {
    return 1 / (1 + distance);
  }

  async train(data) {
    // Train base conformal predictor
    const trainSize = Math.floor(data.length * 0.7);
    const trainData = data.slice(0, trainSize);
    const calibData = data.slice(trainSize);

    const calibPreds = [];
    const calibActuals = [];

    for (let i = 50; i < calibData.length; i++) {
      const historical = data.slice(0, trainSize + i);
      const trend = historical.length >= 20 ?
        (historical[historical.length - 1].price - historical[historical.length - 20].price) / historical[historical.length - 20].price : 0;

      const recentReturns = historical.slice(-10).map((d, idx) =>
        idx === 0 ? 0 : (d.price - historical[historical.length - 10 + idx - 1].price) / historical[historical.length - 10 + idx - 1].price
      );
      const volatility = Math.sqrt(recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length);

      const prediction = historical[historical.length - 1].price * (1 + trend * 0.5);

      calibPreds.push(prediction);
      calibActuals.push(calibData[i].price);
    }

    const { predictor } = await createAdaptivePredictor({
      targetCoverage: this.targetCoverage,
      gamma: this.gamma
    });

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;

    // Extract patterns with numerical features
    this.patterns = [];
    const allFeatures = [];

    for (let i = this.patternWindow; i < data.length - 1; i++) {
      const features = this.extractFeatures(data, i);
      const outcome = (data[i + 1].price - data[i].price) / data[i].price;

      this.patterns.push({
        features,
        outcome,
        timestamp: data[i].timestamp,
        regime: data[i].regime || 0
      });

      allFeatures.push(features);
    }

    // Calculate feature scales for normalization
    if (allFeatures.length > 0) {
      const numFeatures = allFeatures[0].length;
      this.featureScales = new Array(numFeatures).fill(0);

      for (let f = 0; f < numFeatures; f++) {
        const values = allFeatures.map(features => features[f]);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        this.featureScales[f] = Math.sqrt(variance);
      }
    }
  }

  async predict(historical, current) {
    if (!this.predictor || this.patterns.length === 0) {
      return { point: current.price, lower: current.price, upper: current.price };
    }

    // Extract current features
    const currentFeatures = this.extractFeatures(
      [...historical, current],
      historical.length
    );

    // Find similar patterns using Euclidean distance
    const scored = this.patterns.map(p => ({
      pattern: p,
      distance: this.euclideanDistance(currentFeatures, p.features),
      similarity: 0
    }));

    // Calculate similarity scores
    scored.forEach(s => {
      s.similarity = this.similarityScore(s.distance);
    });

    // Filter by minimum similarity and sort
    const candidates = scored
      .filter(s => s.similarity >= this.minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);

    // If not enough similar patterns, fall back to simple prediction
    if (candidates.length < 3) {
      const trend = historical.length >= 20 ?
        (historical[historical.length - 1].price - historical[historical.length - 20].price) / historical[historical.length - 20].price : 0;
      const pointPred = current.price * (1 + trend * 0.5);
      const interval = this.predictor.predict(pointPred);
      return { point: interval.point, lower: interval.lower, upper: interval.upper };
    }

    // Use top K neighbors
    const neighbors = candidates.slice(0, this.numNeighbors);

    // Weighted prediction based on similarity
    const totalSimilarity = neighbors.reduce((sum, n) => sum + n.similarity, 0);
    const weightedReturn = neighbors.reduce((sum, n) =>
      sum + (n.pattern.outcome * n.similarity / totalSimilarity), 0
    );

    const pointPred = current.price * (1 + weightedReturn);

    // Get conformal interval
    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper,
      confidence: totalSimilarity / this.numNeighbors, // Average similarity as confidence
      numPatterns: neighbors.length
    };
  }

  async cleanup() {
    // No cleanup needed for in-memory storage
  }
}
