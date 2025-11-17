#!/usr/bin/env node

/**
 * Neural Trader - Risk Management & State Persistence Example
 *
 * Demonstrates:
 * - Risk calculation functions
 * - Portfolio management
 * - State persistence with Redis (optional)
 * - Predictor for confidence intervals
 */

const Redis = require('ioredis');

console.log('🚀 Neural Trader - Risk Management Example\n');
console.log('=' .repeat(70));

/**
 * Risk Management Class
 */
class RiskManager {
  constructor(config = {}) {
    this.confidenceLevel = config.confidenceLevel || 0.95;
    this.maxDrawdown = config.maxDrawdown || 0.20; // 20%
    this.maxPositionSize = config.maxPositionSize || 0.10; // 10% of portfolio
    this.riskPerTrade = config.riskPerTrade || 0.02; // 2% per trade
  }

  /**
   * Calculate Value at Risk (VaR) using historical method
   */
  calculateVaR(returns, portfolioValue) {
    const sorted = returns.slice().sort((a, b) => a - b);
    const index = Math.floor((1 - this.confidenceLevel) * sorted.length);
    const varPercentage = sorted[index];
    const varAmount = portfolioValue * Math.abs(varPercentage);

    return {
      varPercentage,
      varAmount,
      confidenceLevel: this.confidenceLevel,
      method: 'historical'
    };
  }

  /**
   * Calculate Conditional Value at Risk (CVaR/Expected Shortfall)
   */
  calculateCVaR(returns, portfolioValue) {
    const sorted = returns.slice().sort((a, b) => a - b);
    const index = Math.floor((1 - this.confidenceLevel) * sorted.length);
    const tailReturns = sorted.slice(0, index);
    const cvarPercentage = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
    const cvarAmount = portfolioValue * Math.abs(cvarPercentage);

    return {
      cvarPercentage,
      cvarAmount,
      confidenceLevel: this.confidenceLevel,
      method: 'historical'
    };
  }

  /**
   * Calculate Kelly Criterion for optimal position sizing
   */
  calculateKelly(winRate, avgWin, avgLoss) {
    const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    const fractionalKelly = kellyFraction * 0.5; // Use 50% of full Kelly for safety

    return {
      kellyFraction,
      fractionalKelly,
      winRate,
      avgWin,
      avgLoss
    };
  }

  /**
   * Calculate maximum drawdown
   */
  calculateDrawdown(equityCurve) {
    let maxDrawdown = 0;
    let peak = equityCurve[0];
    let currentDrawdown = 0;

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    }

    return {
      maxDrawdown,
      currentDrawdown,
      peak
    };
  }

  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(accountValue, entryPrice, stopLoss) {
    const riskAmount = accountValue * this.riskPerTrade;
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * entryPrice;
    const positionPercent = positionValue / accountValue;

    // Don't exceed max position size
    if (positionPercent > this.maxPositionSize) {
      const adjustedShares = Math.floor((accountValue * this.maxPositionSize) / entryPrice);
      return {
        shares: adjustedShares,
        positionValue: adjustedShares * entryPrice,
        positionPercent: this.maxPositionSize,
        riskAmount: adjustedShares * riskPerShare,
        limited: true
      };
    }

    return {
      shares,
      positionValue,
      positionPercent,
      riskAmount,
      limited: false
    };
  }
}

/**
 * Portfolio State Manager with Redis (optional)
 */
class PortfolioStateManager {
  constructor(redisConfig = null) {
    this.redis = redisConfig ? new Redis(redisConfig) : null;
    this.portfolioState = {
      positions: [],
      cash: 100000,
      totalValue: 100000,
      trades: [],
      performance: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0
      }
    };
  }

  async saveState() {
    if (this.redis) {
      await this.redis.set('portfolio:state', JSON.stringify(this.portfolioState));
      await this.redis.set('portfolio:timestamp', new Date().toISOString());
      console.log('  ✓ State saved to Redis');
    } else {
      console.log('  ℹ️  Redis not configured, using in-memory state');
    }
  }

  async loadState() {
    if (this.redis) {
      const state = await this.redis.get('portfolio:state');
      if (state) {
        this.portfolioState = JSON.parse(state);
        console.log('  ✓ State loaded from Redis');
      }
    }
    return this.portfolioState;
  }

  addPosition(symbol, shares, entryPrice) {
    this.portfolioState.positions.push({
      symbol,
      shares,
      entryPrice,
      currentPrice: entryPrice,
      value: shares * entryPrice,
      unrealizedPnL: 0,
      timestamp: new Date().toISOString()
    });
  }

  updatePositionPrice(symbol, newPrice) {
    const position = this.portfolioState.positions.find(p => p.symbol === symbol);
    if (position) {
      position.currentPrice = newPrice;
      position.value = position.shares * newPrice;
      position.unrealizedPnL = (newPrice - position.entryPrice) * position.shares;
    }
  }

  calculateTotalValue() {
    const positionsValue = this.portfolioState.positions.reduce((sum, p) => sum + p.value, 0);
    this.portfolioState.totalValue = this.portfolioState.cash + positionsValue;
    return this.portfolioState.totalValue;
  }
}

/**
 * Main demonstration
 */
async function demonstrateRiskManagement() {
  console.log('\n📊 Risk Management Configuration\n');

  const riskManager = new RiskManager({
    confidenceLevel: 0.95,
    maxDrawdown: 0.20,
    maxPositionSize: 0.10,
    riskPerTrade: 0.02
  });

  console.log('  Confidence Level: 95%');
  console.log('  Max Drawdown: 20%');
  console.log('  Max Position Size: 10% of portfolio');
  console.log('  Risk Per Trade: 2%\n');

  // Example 1: VaR Calculation
  console.log('='.repeat(70));
  console.log('\n💰 Example 1: Value at Risk (VaR) Calculation\n');

  const dailyReturns = [
    -0.023, 0.015, -0.008, 0.032, -0.012, 0.018, -0.005,
    0.025, -0.015, 0.010, -0.018, 0.028, -0.010, 0.020,
    -0.025, 0.012, -0.006, 0.022, -0.014, 0.016
  ];
  const portfolioValue = 100000;

  const var95 = riskManager.calculateVaR(dailyReturns, portfolioValue);

  console.log(`  Portfolio Value: $${portfolioValue.toLocaleString()}`);
  console.log(`  Historical Returns: ${dailyReturns.length} days`);
  console.log(`\n  VaR (95% confidence):`);
  console.log(`    Percentage: ${(var95.varPercentage * 100).toFixed(2)}%`);
  console.log(`    Amount: $${var95.varAmount.toFixed(2)}`);
  console.log(`\n  💡 Interpretation: There is a 95% probability that daily losses`);
  console.log(`     will not exceed $${var95.varAmount.toFixed(2)}\n`);

  // Example 2: CVaR Calculation
  console.log('='.repeat(70));
  console.log('\n📉 Example 2: Conditional VaR (Expected Shortfall)\n');

  const cvar95 = riskManager.calculateCVaR(dailyReturns, portfolioValue);

  console.log(`  CVaR (95% confidence):`);
  console.log(`    Percentage: ${(cvar95.cvarPercentage * 100).toFixed(2)}%`);
  console.log(`    Amount: $${cvar95.cvarAmount.toFixed(2)}`);
  console.log(`\n  💡 Interpretation: When losses exceed VaR, the average loss`);
  console.log(`     will be approximately $${cvar95.cvarAmount.toFixed(2)}\n`);

  // Example 3: Kelly Criterion
  console.log('='.repeat(70));
  console.log('\n🎯 Example 3: Kelly Criterion Position Sizing\n');

  const winRate = 0.65; // 65% win rate
  const avgWin = 500;   // $500 average win
  const avgLoss = 300;  // $300 average loss

  const kelly = riskManager.calculateKelly(winRate, avgWin, avgLoss);

  console.log(`  Win Rate: ${(winRate * 100)}%`);
  console.log(`  Average Win: $${avgWin}`);
  console.log(`  Average Loss: $${avgLoss}`);
  console.log(`\n  Full Kelly Fraction: ${(kelly.kellyFraction * 100).toFixed(2)}%`);
  console.log(`  Fractional Kelly (50%): ${(kelly.fractionalKelly * 100).toFixed(2)}%`);
  console.log(`\n  Position Size: $${(portfolioValue * kelly.fractionalKelly).toFixed(2)}`);
  console.log(`\n  💡 Recommendation: Risk ${(kelly.fractionalKelly * 100).toFixed(2)}% of portfolio`);
  console.log(`     per trade for optimal growth\n`);

  // Example 4: Drawdown Analysis
  console.log('='.repeat(70));
  console.log('\n📊 Example 4: Drawdown Analysis\n');

  const equityCurve = [
    100000, 105000, 103000, 108000, 106000, 112000,
    109000, 115000, 111000, 118000, 114000, 120000,
    116000, 122000, 118000, 125000, 121000, 128000
  ];

  const drawdown = riskManager.calculateDrawdown(equityCurve);

  console.log(`  Equity Curve: ${equityCurve.length} periods`);
  console.log(`  Starting Value: $${equityCurve[0].toLocaleString()}`);
  console.log(`  Ending Value: $${equityCurve[equityCurve.length - 1].toLocaleString()}`);
  console.log(`  Peak Value: $${drawdown.peak.toLocaleString()}`);
  console.log(`\n  Max Drawdown: ${(drawdown.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Current Drawdown: ${(drawdown.currentDrawdown * 100).toFixed(2)}%`);

  const totalReturn = ((equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0]) * 100;
  console.log(`\n  Total Return: ${totalReturn.toFixed(2)}%`);
  console.log(`\n  💡 Status: ${drawdown.maxDrawdown < riskManager.maxDrawdown ? '✓ Within limits' : '⚠️ Exceeds limit'}\n`);

  // Example 5: Position Sizing
  console.log('='.repeat(70));
  console.log('\n📐 Example 5: Position Sizing Calculation\n');

  const trades = [
    { symbol: 'AAPL', entry: 182.50, stopLoss: 178.00 },
    { symbol: 'MSFT', entry: 378.25, stopLoss: 370.00 },
    { symbol: 'GOOGL', entry: 141.75, stopLoss: 138.50 }
  ];

  console.log('  Account Value: $100,000');
  console.log('  Risk Per Trade: 2%\n');

  trades.forEach((trade, index) => {
    const position = riskManager.calculatePositionSize(
      portfolioValue,
      trade.entry,
      trade.stopLoss
    );

    console.log(`  ${index + 1}. ${trade.symbol}`);
    console.log(`     Entry: $${trade.entry}`);
    console.log(`     Stop Loss: $${trade.stopLoss}`);
    console.log(`     Risk per Share: $${(trade.entry - trade.stopLoss).toFixed(2)}`);
    console.log(`     Recommended Shares: ${position.shares}`);
    console.log(`     Position Value: $${position.positionValue.toFixed(2)}`);
    console.log(`     Position Size: ${(position.positionPercent * 100).toFixed(2)}%`);
    console.log(`     Risk Amount: $${position.riskAmount.toFixed(2)}`);
    if (position.limited) {
      console.log(`     ⚠️  Position limited to ${(riskManager.maxPositionSize * 100)}% max`);
    }
    console.log('');
  });

  // Example 6: Portfolio State Management
  console.log('='.repeat(70));
  console.log('\n💼 Example 6: Portfolio State Management\n');

  const stateManager = new PortfolioStateManager();

  // Add positions
  stateManager.addPosition('AAPL', 500, 180.00);
  stateManager.addPosition('MSFT', 200, 375.00);
  stateManager.addPosition('GOOGL', 600, 140.00);

  // Update prices
  stateManager.updatePositionPrice('AAPL', 185.00);
  stateManager.updatePositionPrice('MSFT', 380.00);
  stateManager.updatePositionPrice('GOOGL', 142.50);

  const totalValue = stateManager.calculateTotalValue();

  console.log('  Current Portfolio:\n');
  stateManager.portfolioState.positions.forEach(pos => {
    const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    console.log(`    ${pos.symbol}:`);
    console.log(`      Shares: ${pos.shares}`);
    console.log(`      Entry: $${pos.entryPrice}`);
    console.log(`      Current: $${pos.currentPrice}`);
    console.log(`      Value: $${pos.value.toFixed(2)}`);
    console.log(`      Unrealized P&L: $${pos.unrealizedPnL.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    console.log('');
  });

  const totalPnL = stateManager.portfolioState.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  console.log(`  Total Portfolio Value: $${totalValue.toLocaleString()}`);
  console.log(`  Total Unrealized P&L: $${totalPnL.toFixed(2)}`);
  console.log(`  Return: ${((totalValue - 100000) / 100000 * 100).toFixed(2)}%\n`);

  // Save state
  await stateManager.saveState();

  // Example 7: Risk Metrics Summary
  console.log('='.repeat(70));
  console.log('\n📈 Risk Metrics Summary\n');

  const summary = {
    'Portfolio Value': `$${totalValue.toLocaleString()}`,
    'VaR (95%)': `$${var95.varAmount.toFixed(2)}`,
    'CVaR (95%)': `$${cvar95.cvarAmount.toFixed(2)}`,
    'Max Drawdown': `${(drawdown.maxDrawdown * 100).toFixed(2)}%`,
    'Kelly Position Size': `${(kelly.fractionalKelly * 100).toFixed(2)}%`,
    'Max Position Size': `${(riskManager.maxPositionSize * 100)}%`,
    'Risk Per Trade': `${(riskManager.riskPerTrade * 100)}%`
  };

  Object.entries(summary).forEach(([metric, value]) => {
    console.log(`  ${metric}: ${value}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n✨ Risk Management Example Complete!\n');
  console.log('📚 Key Takeaways:');
  console.log('  • Always calculate VaR and CVaR before trading');
  console.log('  • Use Kelly Criterion for optimal position sizing');
  console.log('  • Monitor drawdown to protect capital');
  console.log('  • Never risk more than 2% per trade');
  console.log('  • Maintain proper position sizing limits');
  console.log('  • Use stop losses on every trade\n');
}

// Run the demonstration
demonstrateRiskManagement().catch(console.error);
