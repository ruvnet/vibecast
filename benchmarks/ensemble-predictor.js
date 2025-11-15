/**
 * Ensemble Predictor
 * Phase 2: Combine strengths of multiple predictors
 * Strategy: AdaptiveConformal (best MAPE) + Momentum (good directional) + Pattern learning
 */

import {
  AdaptiveConformalMethod,
  PatternBasedConformalPredictor
} from './advanced-methods.js';

import {
  MomentumPredictor
} from './baseline-methods.js';

export class EnsemblePredictor {
  constructor(options = {}) {
    this.targetCoverage = options.targetCoverage || 0.9;

    // Initialize component predictors
    this.predictors = {
      adaptive: new AdaptiveConformalMethod({
        targetCoverage: this.targetCoverage,
        gamma: options.gamma || 0.01
      }),
      momentum: new MomentumPredictor({ window: 20 }),
      pattern: new PatternBasedConformalPredictor({
        alpha: 1 - this.targetCoverage
      })
    };

    // Initial weights based on expected strengths
    this.weights = {
      adaptive: 0.5,   // Best MAPE in testing
      momentum: 0.3,   // Good directional accuracy
      pattern: 0.2     // Pattern learning
    };

    // Track recent performance for adaptive weighting
    this.recentErrors = {
      adaptive: [],
      momentum: [],
      pattern: []
    };

    this.windowSize = 50; // Window for performance tracking
  }

  async train(data) {
    // Train all component predictors
    await Promise.all(
      Object.values(this.predictors).map(p => p.train(data))
    );
  }

  async predict(historical, current) {
    // Get predictions from all components
    const predictions = await Promise.all(
      Object.entries(this.predictors).map(async ([name, predictor]) => {
        try {
          const pred = await predictor.predict(historical, current);
          return {
            name,
            point: pred.point,
            lower: pred.lower || pred.point,
            upper: pred.upper || pred.point,
            weight: this.weights[name]
          };
        } catch (error) {
          // Fallback to current price if predictor fails
          return {
            name,
            point: current.price,
            lower: current.price,
            upper: current.price,
            weight: 0
          };
        }
      })
    );

    // Normalize weights (in case some predictors failed)
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) {
      return { point: current.price, lower: current.price, upper: current.price };
    }

    // Weighted ensemble for point prediction
    const point = predictions.reduce((sum, p) =>
      sum + (p.point * p.weight / totalWeight), 0
    );

    // Conservative interval: Use widest bounds with confidence weighting
    const intervals = predictions.filter(p => p.lower !== undefined && p.upper !== undefined);

    let lower, upper;

    if (intervals.length === 0) {
      // Fallback: ±2% interval
      lower = point * 0.98;
      upper = point * 1.02;
    } else {
      // Weighted average of intervals
      const weightedLower = intervals.reduce((sum, p) =>
        sum + (p.lower * p.weight / totalWeight), 0
      );
      const weightedUpper = intervals.reduce((sum, p) =>
        sum + (p.upper * p.weight / totalWeight), 0
      );

      // Add buffer for safety (ensure coverage)
      const buffer = (weightedUpper - weightedLower) * 0.1;
      lower = weightedLower - buffer;
      upper = weightedUpper + buffer;
    }

    return {
      point,
      lower,
      upper,
      confidence: totalWeight / Object.keys(this.predictors).length,
      components: predictions
    };
  }

  // Update weights based on recent performance
  updateWeights(prediction, actual) {
    if (!prediction.components) return;

    // Calculate errors for each component
    prediction.components.forEach(comp => {
      const error = Math.abs(comp.point - actual) / actual;

      if (!this.recentErrors[comp.name]) {
        this.recentErrors[comp.name] = [];
      }

      this.recentErrors[comp.name].push(error);

      // Keep only recent window
      if (this.recentErrors[comp.name].length > this.windowSize) {
        this.recentErrors[comp.name].shift();
      }
    });

    // Update weights based on inverse of recent errors
    const avgErrors = {};
    let totalInverseError = 0;

    Object.entries(this.recentErrors).forEach(([name, errors]) => {
      if (errors.length > 0) {
        avgErrors[name] = errors.reduce((a, b) => a + b) / errors.length;
        totalInverseError += 1 / (avgErrors[name] + 0.001); // Add small epsilon
      }
    });

    // Recompute weights (inverse of error, normalized)
    if (totalInverseError > 0) {
      Object.entries(avgErrors).forEach(([name, avgError]) => {
        const inverseError = 1 / (avgError + 0.001);
        this.weights[name] = inverseError / totalInverseError;
      });
    }
  }

  async cleanup() {
    // Cleanup all component predictors
    await Promise.all(
      Object.values(this.predictors).map(p =>
        p.cleanup ? p.cleanup() : Promise.resolve()
      )
    );
  }
}

/**
 * Hybrid Ensemble with Confidence-Based Fallback
 * Uses ensemble when confident, falls back to best simple method otherwise
 */
export class HybridEnsemblePredictor {
  constructor(options = {}) {
    this.ensemble = new EnsemblePredictor(options);
    this.fallback = new AdaptiveConformalMethod({
      targetCoverage: options.targetCoverage || 0.9,
      gamma: options.gamma || 0.01
    });
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
  }

  async train(data) {
    await Promise.all([
      this.ensemble.train(data),
      this.fallback.train(data)
    ]);
  }

  async predict(historical, current) {
    // Get ensemble prediction
    const ensemblePred = await this.ensemble.predict(historical, current);

    // Calculate confidence based on component agreement
    const points = ensemblePred.components.map(c => c.point);
    const mean = points.reduce((a, b) => a + b) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    const cvCoefficient = Math.sqrt(variance) / mean; // Coefficient of variation

    // High agreement (low CV) = high confidence
    const confidence = 1 / (1 + cvCoefficient * 10);

    // Use ensemble if confident, fallback otherwise
    if (confidence >= this.confidenceThreshold) {
      return {
        ...ensemblePred,
        confidence,
        method: 'ensemble'
      };
    } else {
      const fallbackPred = await this.fallback.predict(historical, current);
      return {
        point: fallbackPred.point,
        lower: fallbackPred.lower,
        upper: fallbackPred.upper,
        confidence,
        method: 'fallback'
      };
    }
  }

  updateWeights(prediction, actual) {
    if (prediction.method === 'ensemble') {
      this.ensemble.updateWeights(prediction, actual);
    }
  }

  async cleanup() {
    await Promise.all([
      this.ensemble.cleanup(),
      this.fallback.cleanup ? this.fallback.cleanup() : Promise.resolve()
    ]);
  }
}
