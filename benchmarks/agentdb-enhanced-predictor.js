/**
 * AgentDB-Enhanced Predictor
 * Uses AgentDB for pattern learning, memory consolidation, and adaptive improvements
 * This represents the "world's best" optimized prediction system
 */

import { createAdaptivePredictor } from '@neural-trader/predictor';
import { createDatabase, EmbeddingService } from 'agentdb';

export class AgentDBEnhancedPredictor {
  constructor(config = {}) {
    this.targetCoverage = config.targetCoverage || 0.9;
    this.gamma = config.gamma || 0.005;
    this.patternWindow = config.patternWindow || 20;
    this.lookbackPatterns = config.lookbackPatterns || 500;
    this.name = 'AgentDB-Enhanced (Optimized)';
    this.predictor = null;
    this.db = null;
    this.embeddingService = null;
    this.patterns = [];
    this.performanceHistory = [];
  }

  async initialize() {
    // Initialize AgentDB for pattern storage
    this.db = await createDatabase({ filename: ':memory:' });

    // Initialize embedding service for semantic pattern matching
    this.embeddingService = new EmbeddingService({
      model: 'Xenova/all-MiniLM-L6-v2',
      db: this.db
    });

    await this.embeddingService.initialize();

    // Create tables for pattern storage
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS prediction_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT,
        embedding TEXT,
        outcome REAL,
        volatility REAL,
        regime INTEGER,
        accuracy REAL,
        timestamp INTEGER
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS performance_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alpha REAL,
        coverage REAL,
        error REAL,
        timestamp INTEGER
      )
    `);
  }

  async train(data) {
    if (!this.db) {
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
    for (let i = this.patternWindow; i < data.length - 1; i++) {
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

      // Pattern description for embedding
      const description = `
        Trend: ${(trend * 100).toFixed(2)}%,
        Volatility: ${(volatility * 100).toFixed(2)}%,
        Momentum: ${(momentum * 100).toFixed(2)}%,
        Regime: ${data[i].regime}
      `.trim();

      const embedding = await this.embeddingService.embedText(description);

      // Outcome
      const outcome = (data[i + 1].price - prices[prices.length - 1]) / prices[prices.length - 1];

      // Store pattern
      await this.db.run(`
        INSERT INTO prediction_patterns (pattern, embedding, outcome, volatility, regime, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        description,
        JSON.stringify(embedding),
        outcome,
        volatility,
        data[i].regime,
        data[i].timestamp
      ]);

      this.patterns.push({
        description,
        embedding,
        outcome,
        volatility,
        regime: data[i].regime
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

    const currentDescription = `
      Trend: ${(trend * 100).toFixed(2)}%,
      Volatility: ${(volatility * 100).toFixed(2)}%,
      Momentum: ${(momentum * 100).toFixed(2)}%,
      Regime: ${recent[recent.length - 1].regime}
    `.trim();

    // Find similar patterns using semantic search
    const currentEmbedding = await this.embeddingService.embedText(currentDescription);

    // Calculate similarity with stored patterns
    const similarPatterns = this.patterns
      .map(p => ({
        pattern: p,
        similarity: this.cosineSimilarity(currentEmbedding, p.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20); // Top 20 similar patterns

    // Weighted average of outcomes based on similarity
    let weightedOutcome = 0;
    let totalWeight = 0;

    for (const sp of similarPatterns) {
      const weight = Math.pow(sp.similarity, 2); // Square similarity for emphasis
      weightedOutcome += sp.pattern.outcome * weight;
      totalWeight += weight;
    }

    const avgOutcome = totalWeight > 0 ? weightedOutcome / totalWeight : momentum;

    // Combine pattern-based prediction with trend
    const basePrediction = prices[prices.length - 1] * (1 + avgOutcome);

    // Regime-specific adjustment
    const regimePatterns = similarPatterns.filter(
      sp => sp.pattern.regime === recent[recent.length - 1].regime
    );

    if (regimePatterns.length > 0) {
      const regimeOutcome = regimePatterns.reduce((sum, rp) => sum + rp.pattern.outcome, 0) / regimePatterns.length;
      return basePrediction * 0.7 + prices[prices.length - 1] * (1 + regimeOutcome) * 0.3;
    }

    return basePrediction;
  }

  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

    const currentDescription = `
      Trend: ${(trend * 100).toFixed(2)}%,
      Volatility: ${(volatility * 100).toFixed(2)}%,
      Momentum: ${(momentum * 100).toFixed(2)}%,
      Regime: ${recent[recent.length - 1].regime}
    `.trim();

    // Find similar patterns
    const currentEmbedding = await this.embeddingService.embedText(currentDescription);

    const similarPatterns = this.patterns
      .map(p => ({
        pattern: p,
        similarity: this.cosineSimilarity(currentEmbedding, p.embedding)
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

    // Log performance
    this.performanceHistory.push({
      predicted: pointPred,
      interval: { lower: interval.lower, upper: interval.upper },
      alpha: this.predictor.getCurrentAlpha()
    });

    return {
      point: interval.point,
      lower: interval.lower,
      upper: interval.upper
    };
  }

  async updatePerformance(prediction, actual) {
    if (!this.db) return;

    const error = Math.abs(prediction - actual) / actual;
    const inInterval = this.performanceHistory.length > 0;

    await this.db.run(`
      INSERT INTO performance_log (alpha, coverage, error, timestamp)
      VALUES (?, ?, ?, ?)
    `, [
      this.predictor.getCurrentAlpha(),
      inInterval ? 1 : 0,
      error,
      Date.now()
    ]);
  }

  async getOptimizationInsights() {
    if (!this.db) return null;

    const stats = await this.db.all(`
      SELECT
        AVG(coverage) as avg_coverage,
        AVG(error) as avg_error,
        COUNT(*) as total_predictions
      FROM performance_log
    `);

    const regimePerformance = await this.db.all(`
      SELECT
        regime,
        AVG(ABS(outcome)) as avg_outcome,
        COUNT(*) as pattern_count
      FROM prediction_patterns
      GROUP BY regime
    `);

    return {
      overall: stats[0],
      regimePerformance
    };
  }

  async cleanup() {
    if (this.db && typeof this.db.close === 'function') {
      try {
        await this.db.close();
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Ensemble with AgentDB Learning
 */
export class AgentDBEnsemblePredictor {
  constructor(basePredictors, config = {}) {
    this.basePredictors = basePredictors;
    this.targetCoverage = config.targetCoverage || 0.9;
    this.name = 'AgentDB-Ensemble';
    this.weights = null;
    this.db = null;
  }

  async initialize() {
    this.db = await createDatabase({ filename: ':memory:' });

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS predictor_performance (
        predictor_name TEXT,
        error REAL,
        timestamp INTEGER
      )
    `);
  }

  async train(data) {
    if (!this.db) {
      await this.initialize();
    }

    // Train all base predictors
    await Promise.all(this.basePredictors.map(p => p.train(data)));

    // Initialize equal weights
    this.weights = new Array(this.basePredictors.length).fill(1 / this.basePredictors.length);
  }

  async predict(historical, current) {
    // Get predictions from all models
    const predictions = await Promise.all(
      this.basePredictors.map(p => p.predict(historical, current))
    );

    // Weighted ensemble
    const point = predictions.reduce(
      (sum, pred, i) => sum + pred.point * this.weights[i],
      0
    );

    // Conservative interval (widest bounds)
    const lowers = predictions.filter(p => p.lower !== undefined).map(p => p.lower);
    const uppers = predictions.filter(p => p.upper !== undefined).map(p => p.upper);

    return {
      point,
      lower: lowers.length > 0 ? Math.min(...lowers) : undefined,
      upper: uppers.length > 0 ? Math.max(...uppers) : undefined
    };
  }

  async updateWeights(predictions, actual) {
    // Update weights based on errors
    const errors = predictions.map(p => Math.abs(p.point - actual) / actual);

    // Exponentially weighted average
    const alpha = 0.1;
    for (let i = 0; i < this.weights.length; i++) {
      const inverseError = 1 / (1 + errors[i]);
      this.weights[i] = (1 - alpha) * this.weights[i] + alpha * inverseError;
    }

    // Normalize weights
    const sumWeights = this.weights.reduce((a, b) => a + b, 0);
    this.weights = this.weights.map(w => w / sumWeights);
  }

  async cleanup() {
    if (this.db && typeof this.db.close === 'function') {
      try {
        await this.db.close();
      } catch (e) {
        // Ignore
      }
    }
  }
}
