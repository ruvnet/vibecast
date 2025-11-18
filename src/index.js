const AlpacaClient = require('./alpaca-client');
const NeuralEngine = require('./neural-engine');
const chalk = require('chalk');

class NeuralTrader {
  constructor(options = {}) {
    this.mode = options.mode || 'paper';
    this.strategy = options.strategy || 'momentum';
    this.amount = options.amount || 1000;
    this.alpaca = null;
    this.neuralEngine = null;
    this.isRunning = false;
    this.positions = new Map();
  }

  async initialize() {
    console.log(chalk.cyan('🧠 Initializing Neural Trading System...'));

    // Initialize Alpaca client
    this.alpaca = new AlpacaClient({
      mode: this.mode,
      apiKey: process.env.ALPACA_API_KEY,
      apiSecret: process.env.ALPACA_API_SECRET
    });

    await this.alpaca.connect();

    // Initialize neural engine
    this.neuralEngine = new NeuralEngine({
      strategy: this.strategy,
      riskTolerance: 0.02 // 2% risk per trade
    });

    await this.neuralEngine.initialize();

    console.log(chalk.green('✓ Neural Trading System ready'));
  }

  async startTrading() {
    if (this.isRunning) {
      throw new Error('Trading session already running');
    }

    this.isRunning = true;
    console.log(chalk.yellow('\n📊 Starting trading loop...'));
    console.log(chalk.gray(`Mode: ${this.mode}`));
    console.log(chalk.gray(`Strategy: ${this.strategy}`));
    console.log(chalk.gray(`Amount: $${this.amount}\n`));

    let iteration = 0;
    const maxIterations = 10; // For testing purposes

    while (this.isRunning && iteration < maxIterations) {
      try {
        iteration++;
        console.log(chalk.blue(`\n=== Iteration ${iteration} ===`));

        // Get market data
        const marketData = await this.alpaca.getMarketData(['SPY', 'QQQ', 'IWM']);

        // Generate trading signals using neural engine
        const signals = await this.neuralEngine.generateSignals(marketData);

        console.log(chalk.cyan(`Generated ${signals.length} trading signals`));

        // Execute trades based on signals
        for (const signal of signals) {
          if (signal.confidence > 0.7) {
            await this.executeTrade(signal);
          }
        }

        // Monitor existing positions
        await this.monitorPositions();

        // Wait before next iteration (5 minutes in production, 5 seconds for testing)
        await this.sleep(5000);

      } catch (error) {
        console.error(chalk.red('Error in trading loop:'), error.message);
        await this.sleep(5000);
      }
    }

    console.log(chalk.yellow('\n✓ Trading session completed'));
    this.isRunning = false;
  }

  async executeTrade(signal) {
    console.log(chalk.magenta(`\n📈 Executing trade: ${signal.action} ${signal.symbol}`));
    console.log(chalk.gray(`  Confidence: ${(signal.confidence * 100).toFixed(2)}%`));
    console.log(chalk.gray(`  Price: $${signal.price}`));

    try {
      const order = await this.alpaca.placeOrder({
        symbol: signal.symbol,
        qty: signal.quantity,
        side: signal.action,
        type: 'market',
        time_in_force: 'day'
      });

      this.positions.set(signal.symbol, {
        order,
        signal,
        entryTime: Date.now()
      });

      console.log(chalk.green(`✓ Order placed: ${order.id}`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to execute trade: ${error.message}`));
    }
  }

  async monitorPositions() {
    if (this.positions.size === 0) return;

    console.log(chalk.cyan(`\n📊 Monitoring ${this.positions.size} positions...`));

    const currentPositions = await this.alpaca.getPositions();

    for (const [symbol, position] of this.positions.entries()) {
      const currentPos = currentPositions.find(p => p.symbol === symbol);

      if (currentPos) {
        const pnl = parseFloat(currentPos.unrealized_pl);
        const pnlPercent = parseFloat(currentPos.unrealized_plpc) * 100;

        console.log(chalk.gray(`  ${symbol}: ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}% ($${pnl.toFixed(2)})`));

        // Check exit conditions
        if (pnlPercent > 5 || pnlPercent < -2) {
          await this.closePosition(symbol, pnlPercent > 5 ? 'profit' : 'stoploss');
        }
      }
    }
  }

  async closePosition(symbol, reason) {
    console.log(chalk.yellow(`\n🔄 Closing position ${symbol} (${reason})`));

    try {
      await this.alpaca.closePosition(symbol);
      this.positions.delete(symbol);
      console.log(chalk.green(`✓ Position closed`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to close position: ${error.message}`));
    }
  }

  async analyze(symbol, period) {
    console.log(chalk.cyan(`\n🔍 Analyzing ${symbol} for ${period} days...`));

    const data = await this.alpaca.getHistoricalData(symbol, period);
    const analysis = await this.neuralEngine.analyze(data);

    return {
      symbol,
      period,
      currentPrice: data[data.length - 1].close,
      trend: analysis.trend,
      strength: analysis.strength,
      signals: analysis.signals,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence
    };
  }

  async backtest(symbol, days) {
    console.log(chalk.cyan(`\n⏮️  Backtesting ${symbol} for ${days} days...`));

    const data = await this.alpaca.getHistoricalData(symbol, days);
    const results = await this.neuralEngine.backtest(data, this.strategy);

    return results;
  }

  async getStatus() {
    const account = await this.alpaca.getAccount();
    const positions = await this.alpaca.getPositions();

    return {
      account: {
        equity: account.equity,
        cash: account.cash,
        buyingPower: account.buying_power,
        portfolioValue: account.portfolio_value
      },
      positions: positions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        marketValue: p.market_value,
        unrealizedPL: p.unrealized_pl,
        unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100
      })),
      activeSignals: this.positions.size
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
  }
}

module.exports = NeuralTrader;
