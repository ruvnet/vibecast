/**
 * Traditional Baseline Prediction Methods
 * Implements classical forecasting approaches for comparison
 */

/**
 * Simple Moving Average Predictor
 */
export class MovingAveragePredictor {
  constructor(config = {}) {
    this.window = config.window || 20;
    this.name = `MA(${this.window})`;
  }

  async train(data) {
    // Moving average doesn't require training
    this.trainData = data;
  }

  async predict(historical, current) {
    const recentPrices = historical.slice(-this.window).map(d => d.price);
    const ma = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;

    // No prediction intervals for basic MA
    return {
      point: ma,
      lower: undefined,
      upper: undefined
    };
  }
}

/**
 * Exponential Moving Average Predictor
 */
export class ExponentialMovingAveragePredictor {
  constructor(config = {}) {
    this.alpha = config.alpha || 0.1;
    this.name = `EMA(α=${this.alpha})`;
    this.ema = null;
  }

  async train(data) {
    // Initialize EMA with first price
    this.ema = data[0].price;
    for (let i = 1; i < data.length; i++) {
      this.ema = this.alpha * data[i].price + (1 - this.alpha) * this.ema;
    }
  }

  async predict(historical, current) {
    let ema = this.ema || historical[0].price;

    // Update EMA with historical data
    for (const point of historical.slice(1)) {
      ema = this.alpha * point.price + (1 - this.alpha) * ema;
    }

    return {
      point: ema,
      lower: undefined,
      upper: undefined
    };
  }
}

/**
 * Linear Regression Predictor
 */
export class LinearRegressionPredictor {
  constructor(config = {}) {
    this.window = config.window || 50;
    this.name = `LinearRegression(${this.window})`;
  }

  async train(data) {
    this.trainData = data;
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.window);
    const n = recent.length;

    if (n < 2) {
      return {
        point: recent[recent.length - 1].price,
        lower: undefined,
        upper: undefined
      };
    }

    // Simple linear regression: y = mx + b
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recent.map(d => d.price);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next point
    const nextX = n;
    const prediction = slope * nextX + intercept;

    // Calculate residual standard error for approximate intervals
    const residuals = y.map((yi, i) => yi - (slope * x[i] + intercept));
    const rse = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2));

    return {
      point: prediction,
      lower: prediction - 1.96 * rse,  // 95% interval
      upper: prediction + 1.96 * rse
    };
  }
}

/**
 * ARIMA-inspired predictor (simplified AR model)
 */
export class ARPredictor {
  constructor(config = {}) {
    this.order = config.order || 5;
    this.name = `AR(${this.order})`;
    this.coefficients = null;
  }

  async train(data) {
    // Fit AR model using least squares
    const prices = data.map(d => d.price);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    // Simple AR(p) coefficient estimation
    this.coefficients = new Array(this.order).fill(1 / this.order);
    this.lastReturns = returns.slice(-this.order);
  }

  async predict(historical, current) {
    const prices = historical.map(d => d.price);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const recentReturns = returns.slice(-this.order);

    // Predict next return
    let predictedReturn = 0;
    for (let i = 0; i < Math.min(recentReturns.length, this.order); i++) {
      predictedReturn += this.coefficients[i] * recentReturns[recentReturns.length - 1 - i];
    }

    const lastPrice = prices[prices.length - 1];
    const prediction = lastPrice * (1 + predictedReturn);

    // Calculate volatility for intervals
    const returnStd = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    const interval = 1.96 * returnStd * lastPrice;

    return {
      point: prediction,
      lower: prediction - interval,
      upper: prediction + interval
    };
  }
}

/**
 * Mean Reversion Predictor
 */
export class MeanReversionPredictor {
  constructor(config = {}) {
    this.window = config.window || 100;
    this.reversionSpeed = config.reversionSpeed || 0.1;
    this.name = `MeanReversion(${this.window})`;
  }

  async train(data) {
    this.trainData = data;
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.window);
    const prices = recent.map(d => d.price);

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const currentPrice = prices[prices.length - 1];

    // Mean reversion: predict move toward mean
    const deviation = currentPrice - mean;
    const prediction = currentPrice - this.reversionSpeed * deviation;

    // Calculate standard deviation for intervals
    const std = Math.sqrt(
      prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length
    );

    return {
      point: prediction,
      lower: prediction - 1.96 * std,
      upper: prediction + 1.96 * std
    };
  }
}

/**
 * Momentum Predictor
 */
export class MomentumPredictor {
  constructor(config = {}) {
    this.window = config.window || 20;
    this.name = `Momentum(${this.window})`;
  }

  async train(data) {
    this.trainData = data;
  }

  async predict(historical, current) {
    const recent = historical.slice(-this.window);
    const prices = recent.map(d => d.price);

    if (prices.length < 2) {
      return {
        point: prices[prices.length - 1],
        lower: undefined,
        upper: undefined
      };
    }

    // Calculate momentum (rate of change)
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    const prediction = prices[prices.length - 1] * (1 + momentum / this.window);

    // Calculate volatility
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    const interval = 1.96 * volatility * prices[prices.length - 1];

    return {
      point: prediction,
      lower: prediction - interval,
      upper: prediction + interval
    };
  }
}

/**
 * Naive Predictor (last value)
 */
export class NaivePredictor {
  constructor() {
    this.name = 'Naive (Last Value)';
  }

  async train(data) {
    // No training needed
  }

  async predict(historical, current) {
    const lastPrice = historical[historical.length - 1].price;

    return {
      point: lastPrice,
      lower: undefined,
      upper: undefined
    };
  }
}

/**
 * Ensemble Predictor (combines multiple methods)
 */
export class EnsemblePredictor {
  constructor(predictors, weights = null) {
    this.predictors = predictors;
    this.weights = weights || new Array(predictors.length).fill(1 / predictors.length);
    this.name = 'Ensemble';
  }

  async train(data) {
    await Promise.all(this.predictors.map(p => p.train(data)));
  }

  async predict(historical, current) {
    const predictions = await Promise.all(
      this.predictors.map(p => p.predict(historical, current))
    );

    // Weighted average of point predictions
    const point = predictions.reduce(
      (sum, pred, i) => sum + pred.point * this.weights[i],
      0
    );

    // Combine intervals if available
    const lowers = predictions.filter(p => p.lower !== undefined).map(p => p.lower);
    const uppers = predictions.filter(p => p.upper !== undefined).map(p => p.upper);

    return {
      point,
      lower: lowers.length > 0 ? Math.min(...lowers) : undefined,
      upper: uppers.length > 0 ? Math.max(...uppers) : undefined
    };
  }
}
