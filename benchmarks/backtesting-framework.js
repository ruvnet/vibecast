/**
 * Backtesting Framework
 * Comprehensive framework for comparing prediction methods
 */

import { Timer, calculateStats } from './utils.js';

/**
 * Generate realistic trading data with trends, volatility, and regime changes
 */
export function generateRealisticMarketData(n = 5000, config = {}) {
  const {
    basePrice = 100,
    trendStrength = 0.0001,
    volatility = 0.02,
    regimeChanges = 3,
    seasonality = true,
    microstructureNoise = true
  } = config;

  const data = [];
  let price = basePrice;
  let trend = trendStrength;
  let vol = volatility;

  // Regime change points
  const regimePoints = [];
  for (let i = 0; i < regimeChanges; i++) {
    regimePoints.push(Math.floor((i + 1) * n / (regimeChanges + 1)));
  }

  for (let i = 0; i < n; i++) {
    // Check for regime change
    if (regimePoints.includes(i)) {
      trend = (Math.random() - 0.5) * trendStrength * 2;
      vol = volatility * (0.5 + Math.random());
    }

    // Seasonal component (daily pattern)
    let seasonal = 0;
    if (seasonality) {
      seasonal = 0.001 * Math.sin(2 * Math.PI * i / 390); // 390 = trading day minutes
    }

    // Microstructure noise (bid-ask bounce)
    let microNoise = 0;
    if (microstructureNoise) {
      microNoise = (Math.random() > 0.5 ? 1 : -1) * 0.0005 * price;
    }

    // Main price movement: trend + volatility + seasonal + noise
    const randomShock = (Math.random() - 0.5) * 2 * vol * price;
    const trendComponent = trend * price;
    const seasonalComponent = seasonal * price;

    price = Math.max(price + trendComponent + randomShock + seasonalComponent + microNoise, 1);

    data.push({
      timestamp: Date.now() + i * 60000, // 1 minute bars
      price,
      returns: i > 0 ? (price - data[i-1].price) / data[i-1].price : 0,
      volume: Math.floor(Math.random() * 10000) + 1000,
      regime: regimePoints.filter(rp => rp <= i).length
    });
  }

  return data;
}

/**
 * Calculate walk-forward validation splits
 */
export function createWalkForwardSplits(data, config = {}) {
  const {
    initialTrainSize = 1000,
    testSize = 100,
    stepSize = 100
  } = config;

  const splits = [];
  let trainEnd = initialTrainSize;

  while (trainEnd + testSize <= data.length) {
    splits.push({
      trainStart: Math.max(0, trainEnd - initialTrainSize),
      trainEnd,
      testStart: trainEnd,
      testEnd: Math.min(trainEnd + testSize, data.length)
    });
    trainEnd += stepSize;
  }

  return splits;
}

/**
 * Backtesting engine
 */
export class BacktestEngine {
  constructor(data, config = {}) {
    this.data = data;
    this.config = {
      lookback: 100,
      holdingPeriod: 1,
      transactionCost: 0.0001,
      ...config
    };
    this.results = [];
  }

  /**
   * Run backtest for a prediction method
   */
  async runBacktest(predictor, splits) {
    const timer = new Timer();
    const predictions = [];
    const errors = [];
    const coverages = [];
    const intervalWidths = [];
    const trainingTimes = [];
    const predictionTimes = [];

    for (const split of splits) {
      const trainData = this.data.slice(split.trainStart, split.trainEnd);
      const testData = this.data.slice(split.testStart, split.testEnd);

      // Training phase
      timer.begin();
      await predictor.train(trainData);
      trainingTimes.push(timer.stop());

      // Prediction phase
      for (let i = 0; i < testData.length; i++) {
        const historical = this.data.slice(
          Math.max(0, split.testStart + i - this.config.lookback),
          split.testStart + i
        );

        timer.begin();
        const prediction = await predictor.predict(historical, testData[i]);
        predictionTimes.push(timer.stop());

        const actual = testData[i].price;
        const error = Math.abs(prediction.point - actual);
        const relativeError = error / actual;

        predictions.push({
          timestamp: testData[i].timestamp,
          actual,
          predicted: prediction.point,
          lower: prediction.lower,
          upper: prediction.upper,
          error,
          relativeError,
          inInterval: prediction.lower <= actual && actual <= prediction.upper,
          intervalWidth: prediction.upper - prediction.lower,
          regime: testData[i].regime
        });

        errors.push(relativeError);
        if (prediction.lower !== undefined && prediction.upper !== undefined) {
          coverages.push(prediction.lower <= actual && actual <= prediction.upper ? 1 : 0);
          intervalWidths.push((prediction.upper - prediction.lower) / actual);
        }
      }
    }

    return {
      predictions,
      metrics: this.calculateMetrics(predictions),
      performance: {
        avgTrainingTime: calculateStats(trainingTimes).mean,
        avgPredictionTime: calculateStats(predictionTimes).mean,
        totalTime: trainingTimes.reduce((a,b) => a+b, 0) + predictionTimes.reduce((a,b) => a+b, 0)
      }
    };
  }

  /**
   * Calculate comprehensive metrics
   */
  calculateMetrics(predictions) {
    const errors = predictions.map(p => p.relativeError);
    const absoluteErrors = predictions.map(p => p.error);
    const coverages = predictions.filter(p => p.lower !== undefined).map(p => p.inInterval ? 1 : 0);
    const widths = predictions.filter(p => p.intervalWidth !== undefined).map(p => p.intervalWidth);

    const errorStats = calculateStats(errors);
    const widthStats = widths.length > 0 ? calculateStats(widths) : null;

    // Calculate directional accuracy
    let correctDirection = 0;
    for (let i = 1; i < predictions.length; i++) {
      const actualDirection = predictions[i].actual > predictions[i-1].actual ? 1 : -1;
      const predictedDirection = predictions[i].predicted > predictions[i-1].actual ? 1 : -1;
      if (actualDirection === predictedDirection) correctDirection++;
    }
    const directionalAccuracy = correctDirection / (predictions.length - 1);

    // Risk-adjusted metrics
    const returns = [];
    for (let i = 1; i < predictions.length; i++) {
      const actualReturn = (predictions[i].actual - predictions[i-1].actual) / predictions[i-1].actual;
      returns.push(actualReturn);
    }
    const returnStats = calculateStats(returns);
    const sharpeRatio = returnStats.mean / returnStats.stdDev * Math.sqrt(252 * 390); // Annualized

    return {
      // Error metrics
      mape: errorStats.mean * 100, // Mean Absolute Percentage Error
      medianAPE: errorStats.median * 100,
      rmse: Math.sqrt(absoluteErrors.reduce((sum, e) => sum + e*e, 0) / absoluteErrors.length),
      mae: absoluteErrors.reduce((sum, e) => sum + e, 0) / absoluteErrors.length,
      maxError: errorStats.max * 100,

      // Interval metrics
      coverage: coverages.length > 0 ? coverages.reduce((a,b) => a+b, 0) / coverages.length : null,
      avgIntervalWidth: widthStats ? widthStats.mean * 100 : null,
      medianIntervalWidth: widthStats ? widthStats.median * 100 : null,

      // Directional metrics
      directionalAccuracy,

      // Risk metrics
      sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,

      // Regime-specific performance
      regimePerformance: this.calculateRegimeMetrics(predictions)
    };
  }

  /**
   * Calculate metrics by regime
   */
  calculateRegimeMetrics(predictions) {
    const regimes = {};

    predictions.forEach(p => {
      if (!regimes[p.regime]) {
        regimes[p.regime] = [];
      }
      regimes[p.regime].push(p.relativeError);
    });

    const regimeMetrics = {};
    Object.entries(regimes).forEach(([regime, errors]) => {
      const stats = calculateStats(errors);
      regimeMetrics[`regime_${regime}`] = {
        mape: stats.mean * 100,
        medianAPE: stats.median * 100,
        count: errors.length
      };
    });

    return regimeMetrics;
  }

  /**
   * Compare multiple predictors
   */
  async compareModels(predictors, splits) {
    const results = {};

    for (const [name, predictor] of Object.entries(predictors)) {
      console.log(`\n📊 Backtesting ${name}...`);
      const result = await this.runBacktest(predictor, splits);
      results[name] = result;

      console.log(`  ✓ Completed: ${result.predictions.length} predictions`);
      console.log(`  ✓ MAPE: ${result.metrics.mape.toFixed(4)}%`);
      if (result.metrics.coverage !== null) {
        console.log(`  ✓ Coverage: ${(result.metrics.coverage * 100).toFixed(2)}%`);
      }
      console.log(`  ✓ Directional Accuracy: ${(result.metrics.directionalAccuracy * 100).toFixed(2)}%`);
    }

    return results;
  }

  /**
   * Generate comparison report
   */
  generateReport(results) {
    const report = {
      summary: {},
      rankings: {},
      improvements: {}
    };

    // Extract metrics for comparison
    const models = Object.keys(results);
    const metrics = ['mape', 'coverage', 'directionalAccuracy', 'sharpeRatio'];

    // Calculate rankings
    metrics.forEach(metric => {
      const values = models.map(m => ({
        model: m,
        value: results[m].metrics[metric]
      })).filter(v => v.value !== null && isFinite(v.value));

      // Sort (lower is better for mape, higher is better for others)
      if (metric === 'mape') {
        values.sort((a, b) => a.value - b.value);
      } else {
        values.sort((a, b) => b.value - a.value);
      }

      report.rankings[metric] = values;
    });

    // Calculate improvements over baseline
    const baseline = models[0]; // First model is baseline
    models.slice(1).forEach(model => {
      report.improvements[model] = {};

      const mapeImprovement = (
        (results[baseline].metrics.mape - results[model].metrics.mape) /
        results[baseline].metrics.mape * 100
      );
      report.improvements[model].mape = mapeImprovement;

      if (results[model].metrics.coverage !== null && results[baseline].metrics.coverage !== null) {
        const coverageImprovement = (
          results[model].metrics.coverage - results[baseline].metrics.coverage
        ) * 100;
        report.improvements[model].coverage = coverageImprovement;
      }

      const dirAccImprovement = (
        results[model].metrics.directionalAccuracy - results[baseline].metrics.directionalAccuracy
      ) * 100;
      report.improvements[model].directionalAccuracy = dirAccImprovement;
    });

    // Summary statistics
    report.summary = {
      totalPredictions: results[baseline].predictions.length,
      models: models.length,
      bestMAPE: report.rankings.mape[0],
      bestCoverage: report.rankings.coverage ? report.rankings.coverage[0] : null,
      bestDirectional: report.rankings.directionalAccuracy[0]
    };

    return report;
  }
}

/**
 * Statistical significance test (paired t-test)
 */
export function pairedTTest(errors1, errors2) {
  const n = errors1.length;
  const differences = errors1.map((e1, i) => e1 - errors2[i]);
  const meanDiff = differences.reduce((a, b) => a + b, 0) / n;
  const stdDiff = Math.sqrt(
    differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (n - 1)
  );

  const tStatistic = meanDiff / (stdDiff / Math.sqrt(n));
  const degreesOfFreedom = n - 1;

  // Approximate p-value for two-tailed test
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  return {
    tStatistic,
    degreesOfFreedom,
    pValue,
    significant: pValue < 0.05
  };
}

function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
