/**
 * Advanced Prediction Methods using @neural-trader/predictor + AgentDB
 * World-class prediction system with optimizations
 */

import { createPredictor, createAdaptivePredictor, AbsoluteScore, NormalizedScore } from '@neural-trader/predictor';

/**
 * Basic Conformal Predictor
 */
export class ConformalPredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.calibrationSize = config.calibrationSize || 500;
    this.name = `Conformal(α=${this.alpha})`;
    this.predictor = null;
  }

  async train(data) {
    const prices = data.map(d => d.price);

    // Simple feature: use previous price as prediction
    const predictions = prices.slice(0, -1);
    const actuals = prices.slice(1);

    // Take last calibrationSize samples
    const calibPreds = predictions.slice(-this.calibrationSize);
    const calibActuals = actuals.slice(-this.calibrationSize);

    const { predictor } = await createPredictor({
      alpha: this.alpha,
      calibrationSize: this.calibrationSize
    });

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  async predict(historical, current) {
    const prices = historical.map(d => d.price);
    const lastPrice = prices[prices.length - 1];

    // Simple prediction: use last price
    const interval = this.predictor.predict(lastPrice);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}

/**
 * Enhanced Conformal Predictor with Trend Adjustment
 */
export class EnhancedConformalPredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.calibrationSize = config.calibrationSize || 1000;
    this.trendWindow = config.trendWindow || 20;
    this.name = `EnhancedConformal(α=${this.alpha})`;
    this.predictor = null;
  }

  async train(data) {
    const predictions = [];
    const actuals = [];

    // Generate predictions with trend adjustment
    for (let i = this.trendWindow; i < data.length - 1; i++) {
      const recent = data.slice(i - this.trendWindow, i);
      const prices = recent.map(d => d.price);

      // Calculate trend
      const trend = (prices[prices.length - 1] - prices[0]) / prices[0] / this.trendWindow;

      // Trend-adjusted prediction
      const prediction = prices[prices.length - 1] * (1 + trend);
      predictions.push(prediction);
      actuals.push(data[i + 1].price);
    }

    // Calibrate with recent data
    const calibPreds = predictions.slice(-this.calibrationSize);
    const calibActuals = actuals.slice(-this.calibrationSize);

    const { predictor } = await createPredictor({
      alpha: this.alpha,
      calibrationSize: this.calibrationSize
    }, new AbsoluteScore());

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.trendWindow);
    const prices = recent.map(d => d.price);

    // Calculate trend
    const trend = (prices[prices.length - 1] - prices[0]) / prices[0] / this.trendWindow;

    // Trend-adjusted prediction
    const pointPred = prices[prices.length - 1] * (1 + trend);
    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}

/**
 * Adaptive Conformal Predictor with Dynamic Coverage
 */
export class AdaptiveConformalMethod {
  constructor(config = {}) {
    this.targetCoverage = config.targetCoverage || 0.9;
    this.gamma = config.gamma || 0.01;
    this.calibrationSize = config.calibrationSize || 1000;
    this.trendWindow = config.trendWindow || 20;
    this.name = `AdaptiveConformal(γ=${this.gamma})`;
    this.predictor = null;
  }

  async train(data) {
    const predictions = [];
    const actuals = [];

    // Generate predictions with trend and volatility adjustment
    for (let i = this.trendWindow; i < data.length - 1; i++) {
      const recent = data.slice(i - this.trendWindow, i);
      const prices = recent.map(d => d.price);

      // Calculate trend and volatility
      const returns = [];
      for (let j = 1; j < prices.length; j++) {
        returns.push((prices[j] - prices[j-1]) / prices[j-1]);
      }

      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const volatility = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
      );

      // Volatility-adjusted prediction
      const prediction = prices[prices.length - 1] * (1 + meanReturn);
      predictions.push(prediction);
      actuals.push(data[i + 1].price);
    }

    // Calibrate adaptive predictor
    const calibPreds = predictions.slice(-this.calibrationSize);
    const calibActuals = actuals.slice(-this.calibrationSize);

    const { predictor } = await createAdaptivePredictor({
      targetCoverage: this.targetCoverage,
      gamma: this.gamma
    });

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.trendWindow);
    const prices = recent.map(d => d.price);

    // Calculate returns and volatility
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const pointPred = prices[prices.length - 1] * (1 + meanReturn);

    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}

/**
 * Multi-Horizon Conformal Predictor
 */
export class MultiHorizonConformalPredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.horizons = config.horizons || [1, 5, 10];
    this.calibrationSize = config.calibrationSize || 1000;
    this.name = `MultiHorizon(${this.horizons.join(',')})`;
    this.predictors = {};
  }

  async train(data) {
    // Train separate predictor for each horizon
    for (const horizon of this.horizons) {
      const predictions = [];
      const actuals = [];

      for (let i = 50; i < data.length - horizon; i++) {
        const recent = data.slice(i - 20, i);
        const prices = recent.map(d => d.price);

        // Simple momentum-based prediction
        const returns = [];
        for (let j = 1; j < prices.length; j++) {
          returns.push((prices[j] - prices[j-1]) / prices[j-1]);
        }
        const momentum = returns.reduce((a, b) => a + b, 0) / returns.length;

        const prediction = prices[prices.length - 1] * Math.pow(1 + momentum, horizon);
        predictions.push(prediction);
        actuals.push(data[i + horizon].price);
      }

      const calibPreds = predictions.slice(-this.calibrationSize);
      const calibActuals = actuals.slice(-this.calibrationSize);

      const { predictor } = await createPredictor({ alpha: this.alpha });
      await predictor.calibrate(calibPreds, calibActuals);

      this.predictors[horizon] = predictor;
    }
  }

  async predict(historical, current) {
    // Use 1-step ahead prediction as default
    const horizon = 1;
    const recent = historical.slice(-20);
    const prices = recent.map(d => d.price);

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const momentum = returns.reduce((a, b) => a + b, 0) / returns.length;

    const pointPred = prices[prices.length - 1] * (1 + momentum);
    const interval = this.predictors[horizon].predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}

/**
 * Pattern-Based Conformal Predictor (uses similar historical patterns)
 */
export class PatternBasedConformalPredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.patternLength = config.patternLength || 10;
    this.numNeighbors = config.numNeighbors || 50;
    this.calibrationSize = config.calibrationSize || 500;
    this.name = 'PatternBased';
    this.predictor = null;
    this.patterns = [];
  }

  async train(data) {
    // Extract patterns from training data
    this.patterns = [];

    for (let i = this.patternLength; i < data.length - 1; i++) {
      const pattern = data.slice(i - this.patternLength, i).map(d => d.price);
      const nextPrice = data[i + 1].price;

      // Normalize pattern
      const mean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
      const normalized = pattern.map(p => (p - mean) / mean);

      this.patterns.push({
        pattern: normalized,
        nextReturn: (nextPrice - pattern[pattern.length - 1]) / pattern[pattern.length - 1]
      });
    }

    // Create predictions based on similar patterns
    const predictions = [];
    const actuals = [];

    for (let i = this.patternLength; i < data.length - 1; i++) {
      const currentPattern = data.slice(i - this.patternLength, i).map(d => d.price);
      const mean = currentPattern.reduce((a, b) => a + b, 0) / currentPattern.length;
      const normalized = currentPattern.map(p => (p - mean) / mean);

      // Find similar patterns
      const distances = this.patterns.slice(0, i - this.patternLength).map(p => ({
        distance: this.euclideanDistance(normalized, p.pattern),
        nextReturn: p.nextReturn
      }));

      distances.sort((a, b) => a.distance - b.distance);
      const neighbors = distances.slice(0, this.numNeighbors);

      // Average prediction from similar patterns
      const avgReturn = neighbors.reduce((sum, n) => sum + n.nextReturn, 0) / neighbors.length;
      const prediction = currentPattern[currentPattern.length - 1] * (1 + avgReturn);

      predictions.push(prediction);
      actuals.push(data[i + 1].price);
    }

    // Calibrate
    const calibPreds = predictions.slice(-this.calibrationSize);
    const calibActuals = actuals.slice(-this.calibrationSize);

    const { predictor } = await createPredictor({ alpha: this.alpha });
    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  }

  async predict(historical, current) {
    const currentPattern = historical.slice(-this.patternLength).map(d => d.price);
    const mean = currentPattern.reduce((a, b) => a + b, 0) / currentPattern.length;
    const normalized = currentPattern.map(p => (p - mean) / mean);

    // Find similar patterns
    const distances = this.patterns.map(p => ({
      distance: this.euclideanDistance(normalized, p.pattern),
      nextReturn: p.nextReturn
    }));

    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, this.numNeighbors);

    // Average prediction
    const avgReturn = neighbors.reduce((sum, n) => sum + n.nextReturn, 0) / neighbors.length;
    const pointPred = currentPattern[currentPattern.length - 1] * (1 + avgReturn);

    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}

/**
 * Volatility-Adjusted Conformal Predictor
 */
export class VolatilityAdjustedConformalPredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.calibrationSize = config.calibrationSize || 1000;
    this.volWindow = config.volWindow || 20;
    this.name = 'VolatilityAdjusted';
    this.predictor = null;
  }

  async train(data) {
    const predictions = [];
    const actuals = [];

    for (let i = this.volWindow; i < data.length - 1; i++) {
      const recent = data.slice(i - this.volWindow, i);
      const prices = recent.map(d => d.price);

      // Calculate returns and volatility
      const returns = [];
      for (let j = 1; j < prices.length; j++) {
        returns.push((prices[j] - prices[j-1]) / prices[j-1]);
      }

      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const volatility = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
      );

      // GARCH-inspired prediction
      const prediction = prices[prices.length - 1] * (1 + meanReturn);

      predictions.push(prediction);
      actuals.push(data[i + 1].price);
    }

    const calibPreds = predictions.slice(-this.calibrationSize);
    const calibActuals = actuals.slice(-this.calibrationSize);

    // Use normalized score for volatility adjustment
    const avgVolatility = this.calculateAverageVolatility(data);
    const { predictor } = await createPredictor(
      { alpha: this.alpha },
      new NormalizedScore(avgVolatility)
    );

    await predictor.calibrate(calibPreds, calibActuals);
    this.predictor = predictor;
  }

  calculateAverageVolatility(data) {
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].price - data[i-1].price) / data[i-1].price);
    }
    return Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.volWindow);
    const prices = recent.map(d => d.price);

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const pointPred = prices[prices.length - 1] * (1 + meanReturn);

    const interval = this.predictor.predict(pointPred);

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }
}
