const chalk = require('chalk');

class NeuralEngine {
  constructor(options = {}) {
    this.strategy = options.strategy || 'momentum';
    this.riskTolerance = options.riskTolerance || 0.02;
    this.weights = null;
    this.performance = {
      trades: 0,
      wins: 0,
      losses: 0,
      totalReturn: 0
    };
  }

  async initialize() {
    console.log(chalk.cyan('🧠 Initializing Neural Engine...'));

    // Initialize neural network weights
    this.weights = this.initializeWeights();

    console.log(chalk.green(`✓ Neural Engine ready (Strategy: ${this.strategy})`));
  }

  initializeWeights() {
    // Simple neural network weights for demonstration
    return {
      momentum: {
        shortTerm: 0.4,
        mediumTerm: 0.35,
        longTerm: 0.25
      },
      volatility: {
        threshold: 0.02,
        weight: 0.3
      },
      volume: {
        weight: 0.2
      },
      trend: {
        weight: 0.5
      }
    };
  }

  async generateSignals(marketData) {
    const signals = [];

    for (const data of marketData) {
      const signal = await this.analyzeSymbol(data);

      if (signal && Math.abs(signal.confidence) > 0.5) {
        signals.push(signal);
      }
    }

    return signals;
  }

  async analyzeSymbol(data) {
    const { symbol, price, bars } = data;

    if (!bars || bars.length < 20) {
      return null;
    }

    // Calculate technical indicators
    const indicators = this.calculateIndicators(bars);

    // Apply strategy
    let confidence = 0;
    let action = 'hold';

    switch (this.strategy) {
      case 'momentum':
        ({ confidence, action } = this.momentumStrategy(indicators));
        break;
      case 'mean-reversion':
        ({ confidence, action } = this.meanReversionStrategy(indicators));
        break;
      case 'sentiment':
        ({ confidence, action } = this.sentimentStrategy(indicators));
        break;
      default:
        ({ confidence, action } = this.momentumStrategy(indicators));
    }

    if (action === 'hold') {
      return null;
    }

    // Calculate position size based on risk tolerance
    const quantity = this.calculatePositionSize(price, indicators.volatility);

    return {
      symbol,
      action,
      confidence: Math.abs(confidence),
      price,
      quantity,
      indicators,
      timestamp: Date.now()
    };
  }

  calculateIndicators(bars) {
    const closes = bars.map(b => b.ClosePrice);
    const volumes = bars.map(b => b.Volume);

    // Simple Moving Averages
    const sma5 = this.sma(closes, 5);
    const sma10 = this.sma(closes, 10);
    const sma20 = this.sma(closes, 20);

    // RSI
    const rsi = this.calculateRSI(closes, 14);

    // Volatility (standard deviation)
    const volatility = this.calculateVolatility(closes, 20);

    // Volume trend
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeRatio = recentVolume / avgVolume;

    // Price momentum
    const momentum = (closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10];

    return {
      sma5,
      sma10,
      sma20,
      rsi,
      volatility,
      volumeRatio,
      momentum,
      currentPrice: closes[closes.length - 1]
    };
  }

  momentumStrategy(indicators) {
    let confidence = 0;
    let action = 'hold';

    // Bullish momentum
    if (indicators.sma5 > indicators.sma10 &&
        indicators.sma10 > indicators.sma20 &&
        indicators.momentum > 0.01 &&
        indicators.rsi < 70) {
      confidence = 0.75 + (indicators.momentum * 5);
      action = 'buy';
    }
    // Bearish momentum
    else if (indicators.sma5 < indicators.sma10 &&
             indicators.sma10 < indicators.sma20 &&
             indicators.momentum < -0.01 &&
             indicators.rsi > 30) {
      confidence = 0.75 + (Math.abs(indicators.momentum) * 5);
      action = 'sell';
    }

    return { confidence: Math.min(confidence, 0.95), action };
  }

  meanReversionStrategy(indicators) {
    let confidence = 0;
    let action = 'hold';

    // Oversold - buy signal
    if (indicators.rsi < 30 &&
        indicators.currentPrice < indicators.sma20 * 0.98) {
      confidence = 0.70 + ((30 - indicators.rsi) / 100);
      action = 'buy';
    }
    // Overbought - sell signal
    else if (indicators.rsi > 70 &&
             indicators.currentPrice > indicators.sma20 * 1.02) {
      confidence = 0.70 + ((indicators.rsi - 70) / 100);
      action = 'sell';
    }

    return { confidence: Math.min(confidence, 0.95), action };
  }

  sentimentStrategy(indicators) {
    let confidence = 0;
    let action = 'hold';

    // High volume + momentum = strong sentiment
    if (indicators.volumeRatio > 1.5 && indicators.momentum > 0.02) {
      confidence = 0.70 + (indicators.volumeRatio - 1) * 0.1;
      action = 'buy';
    } else if (indicators.volumeRatio > 1.5 && indicators.momentum < -0.02) {
      confidence = 0.70 + (indicators.volumeRatio - 1) * 0.1;
      action = 'sell';
    }

    return { confidence: Math.min(confidence, 0.95), action };
  }

  calculatePositionSize(price, volatility) {
    // Kelly Criterion-inspired position sizing
    const baseQty = Math.floor(1000 / price); // $1000 base position
    const volatilityAdjustment = 1 - (volatility * 10);
    const adjustedQty = Math.max(1, Math.floor(baseQty * volatilityAdjustment));

    return adjustedQty;
  }

  async analyze(data) {
    const closes = data.map(d => d.close);
    const indicators = this.calculateIndicators(
      data.map(d => ({ ClosePrice: d.close, Volume: d.volume }))
    );

    // Determine trend
    let trend = 'neutral';
    if (indicators.sma5 > indicators.sma20 * 1.02) {
      trend = 'bullish';
    } else if (indicators.sma5 < indicators.sma20 * 0.98) {
      trend = 'bearish';
    }

    // Determine strength
    const strength = Math.abs(indicators.momentum) * 100;

    // Generate signals
    const signals = [];
    const strategyResult = this.momentumStrategy(indicators);

    if (strategyResult.action !== 'hold') {
      signals.push({
        type: strategyResult.action,
        confidence: strategyResult.confidence
      });
    }

    // Generate recommendation
    let recommendation = 'HOLD';
    let confidence = 0.5;

    if (strategyResult.confidence > 0.7) {
      recommendation = strategyResult.action === 'buy' ? 'BUY' : 'SELL';
      confidence = strategyResult.confidence;
    }

    return {
      trend,
      strength: strength.toFixed(2),
      signals,
      recommendation,
      confidence: (confidence * 100).toFixed(2),
      indicators: {
        rsi: indicators.rsi.toFixed(2),
        momentum: (indicators.momentum * 100).toFixed(2),
        volatility: (indicators.volatility * 100).toFixed(2)
      }
    };
  }

  async backtest(data, strategy) {
    console.log(chalk.cyan(`\n🔬 Running backtest with ${strategy} strategy...`));

    let capital = 10000;
    let position = null;
    let trades = [];

    for (let i = 20; i < data.length; i++) {
      const historicalBars = data.slice(i - 20, i).map(d => ({
        ClosePrice: d.close,
        Volume: d.volume
      }));

      const indicators = this.calculateIndicators(historicalBars);
      const signal = this[`${strategy}Strategy`](indicators);

      if (signal.action === 'buy' && !position && signal.confidence > 0.7) {
        // Enter position
        const qty = Math.floor(capital / data[i].close);
        position = {
          entry: data[i].close,
          qty,
          entryDate: data[i].timestamp
        };
        trades.push({ type: 'buy', price: data[i].close, date: data[i].timestamp });
      } else if (signal.action === 'sell' && position) {
        // Exit position
        const exitValue = position.qty * data[i].close;
        const entryValue = position.qty * position.entry;
        const profit = exitValue - entryValue;

        capital += profit;
        trades.push({
          type: 'sell',
          price: data[i].close,
          date: data[i].timestamp,
          profit
        });

        position = null;
      }
    }

    // Calculate metrics
    const totalReturn = ((capital - 10000) / 10000) * 100;
    const winningTrades = trades.filter(t => t.profit && t.profit > 0).length;
    const winRate = (winningTrades / (trades.length / 2)) * 100;

    // Calculate Sharpe ratio (simplified)
    const returns = trades.filter(t => t.profit).map(t => t.profit / 10000);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev).toFixed(2) : '0.00';

    return {
      totalReturn: totalReturn.toFixed(2),
      winRate: winRate.toFixed(2),
      totalTrades: trades.length / 2,
      sharpeRatio,
      finalCapital: capital.toFixed(2)
    };
  }

  // Technical indicator helper functions
  sma(data, period) {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateVolatility(closes, period = 20) {
    if (closes.length < period) return 0;

    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;

    return Math.sqrt(variance) / mean;
  }
}

module.exports = NeuralEngine;
