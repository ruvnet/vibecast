# Neural Trader - Complete Usage Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Commands Reference](#commands-reference)
5. [E2B Swarm Testing](#e2b-swarm-testing)
6. [Alpaca API Integration](#alpaca-api-integration)
7. [Trading Strategies](#trading-strategies)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Clone and install
git clone <repository>
cd vibecast
npm install

# 2. Configure API keys
cp .env.example .env
# Edit .env with your API keys

# 3. Run demo test
node tests/demo-test.js

# 4. Start trading
npx . trade --mode paper
```

---

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Alpaca account (for live/paper trading)
- E2B account (for swarm testing)

### Install Dependencies

```bash
npm install
```

This will install:
- `@alpacahq/alpaca-trade-api` - Alpaca API client
- `@e2b/code-interpreter` - E2B sandbox integration
- `commander` - CLI framework
- `chalk` - Terminal styling
- `ora` - Loading spinners
- `dotenv` - Environment configuration

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Alpaca API Credentials
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_API_SECRET=your_alpaca_secret_key

# E2B API Key
E2B_API_KEY=your_e2b_api_key

# Trading Configuration
TRADING_MODE=paper
DEFAULT_STRATEGY=momentum
RISK_TOLERANCE=0.02
```

### Getting API Keys

#### Alpaca API

1. Visit [Alpaca Markets](https://app.alpaca.markets/)
2. Sign up for a free account
3. Navigate to: **Paper Trading** > **Dashboard** > **Your API Keys**
4. Generate new API key and secret
5. Add to `.env` file

#### E2B API

1. Visit [E2B](https://e2b.dev)
2. Sign up for an account
3. Navigate to your dashboard
4. Generate API key
5. Add to `.env` file

---

## Commands Reference

### Global Options

```bash
npx neural-trader [command] [options]
```

### Available Commands

#### 1. `trade` - Start Trading

Start neural trading with Alpaca API.

```bash
npx neural-trader trade [options]
```

**Options:**
- `-m, --mode <mode>` - Trading mode: `paper` or `live` (default: `paper`)
- `-s, --strategy <strategy>` - Strategy: `momentum`, `mean-reversion`, or `sentiment` (default: `momentum`)
- `-a, --amount <amount>` - Trading amount in USD (default: `1000`)

**Examples:**
```bash
# Paper trading with momentum strategy
npx neural-trader trade --mode paper --strategy momentum

# Live trading with mean-reversion
npx neural-trader trade --mode live --strategy mean-reversion --amount 5000
```

#### 2. `analyze` - Market Analysis

Analyze market data and generate trading signals.

```bash
npx neural-trader analyze [options]
```

**Options:**
- `-s, --symbol <symbol>` - Stock symbol (default: `SPY`)
- `-p, --period <period>` - Analysis period in days (default: `30`)

**Examples:**
```bash
# Analyze SPY for 30 days
npx neural-trader analyze --symbol SPY --period 30

# Analyze AAPL for 90 days
npx neural-trader analyze --symbol AAPL --period 90
```

#### 3. `test-e2b` - E2B Swarm Testing

Run comprehensive tests using E2B swarm.

```bash
npx neural-trader test-e2b [options]
```

**Options:**
- `-w, --workers <workers>` - Number of E2B workers (default: `3`)
- `-t, --tests <tests>` - Test suite: `all`, `strategy`, `integration`, or `performance` (default: `all`)

**Examples:**
```bash
# Run all tests with 3 workers
npx neural-trader test-e2b --workers 3 --tests all

# Run only strategy tests with 5 workers
npx neural-trader test-e2b --workers 5 --tests strategy
```

#### 4. `backtest` - Historical Backtesting

Run backtesting on historical data.

```bash
npx neural-trader backtest [options]
```

**Options:**
- `-s, --symbol <symbol>` - Stock symbol (default: `SPY`)
- `-d, --days <days>` - Number of days to backtest (default: `90`)
- `--strategy <strategy>` - Strategy to test (default: `momentum`)

**Examples:**
```bash
# Backtest SPY with momentum strategy
npx neural-trader backtest --symbol SPY --days 90 --strategy momentum

# Backtest QQQ with mean-reversion
npx neural-trader backtest --symbol QQQ --days 180 --strategy mean-reversion
```

#### 5. `status` - Account Status

Check Alpaca account status and current positions.

```bash
npx neural-trader status
```

**Output:**
- Account equity
- Available cash
- Buying power
- Open positions
- Unrealized P&L

---

## E2B Swarm Testing

### Overview

E2B swarm testing distributes tests across multiple isolated sandbox environments for parallel execution.

### Test Suites

#### Strategy Tests (5 tests)
- Momentum Strategy - Bullish Signal
- Momentum Strategy - Bearish Signal
- Mean Reversion - Oversold
- Mean Reversion - Overbought
- Sentiment Strategy - High Volume

#### Integration Tests (3 tests)
- Alpaca API Connection
- Market Data Fetching
- Order Placement (Mock)

#### Performance Tests (3 tests)
- Signal Generation Speed
- Backtest Performance
- Concurrent Trading Simulation

### Running Swarm Tests

```bash
# Run all tests with 3 workers
npm run test:e2b

# Or use CLI
npx neural-trader test-e2b --workers 3 --tests all
```

### Test Output

Results are saved to:
- `test-results/e2b-swarm-results.json`

Example output:
```json
{
  "summary": {
    "total": 11,
    "passed": 10,
    "failed": 1,
    "passRate": "90.91",
    "totalDuration": "5234ms",
    "avgDuration": "476ms"
  },
  "workers": [
    { "id": 0, "sandboxId": "abc123", "testsRun": 4 },
    { "id": 1, "sandboxId": "def456", "testsRun": 4 },
    { "id": 2, "sandboxId": "ghi789", "testsRun": 3 }
  ]
}
```

---

## Alpaca API Integration

### Paper Trading vs Live Trading

#### Paper Trading (Recommended for Testing)
- Simulated trading with fake money
- Real market data
- No financial risk
- Perfect for testing strategies

```bash
npx neural-trader trade --mode paper
```

#### Live Trading (Real Money)
- Real trades with real money
- Requires funded account
- Use with caution
- Only after thorough backtesting

```bash
npx neural-trader trade --mode live
```

### API Features

#### Account Management
- Get account information
- Check buying power
- Monitor equity
- View cash balance

#### Position Management
- Open new positions
- Close existing positions
- Monitor P&L
- Set stop-loss/take-profit

#### Market Data
- Real-time quotes
- Historical bars
- Volume data
- Market hours

#### Order Types
- Market orders
- Limit orders
- Stop orders
- Day/GTC time-in-force

---

## Trading Strategies

### 1. Momentum Strategy

Follows trending markets.

**Entry Signals:**
- Buy: SMA5 > SMA10 > SMA20, momentum > 1%, RSI < 70
- Sell: SMA5 < SMA10 < SMA20, momentum < -1%, RSI > 30

**Best For:**
- Trending markets
- Strong directional moves
- Bull/bear markets

**Risk:**
- Whipsaw in sideways markets
- Late entries in exhausted trends

### 2. Mean Reversion Strategy

Exploits overbought/oversold conditions.

**Entry Signals:**
- Buy: RSI < 30, price < SMA20 * 0.98
- Sell: RSI > 70, price > SMA20 * 1.02

**Best For:**
- Range-bound markets
- Oversold/overbought extremes
- High volatility

**Risk:**
- "Catching falling knives"
- Continued trends instead of reversals

### 3. Sentiment Strategy

Follows volume and momentum.

**Entry Signals:**
- Buy: Volume ratio > 1.5x, momentum > 2%
- Sell: Volume ratio > 1.5x, momentum < -2%

**Best For:**
- Breakout moves
- High-volume events
- Momentum plays

**Risk:**
- False breakouts
- Volume spikes without follow-through

---

## Examples

### Example 1: Paper Trading Session

```bash
# Start paper trading with momentum strategy
npx neural-trader trade --mode paper --strategy momentum --amount 1000
```

Output:
```
🧠 Initializing Neural Trading System...
✓ Connected to Alpaca (paper mode)
  Account: PA1234567890
  Equity: $100,000.00
✓ Neural Trading System ready

📊 Starting trading loop...
Mode: paper
Strategy: momentum
Amount: $1000

=== Iteration 1 ===
Generated 2 trading signals

📈 Executing trade: buy SPY
  Confidence: 85.50%
  Price: $450.25
✓ Order placed: 123e4567-e89b-12d3-a456-426614174000

📊 Monitoring 1 positions...
  SPY: +0.15% ($0.68)
```

### Example 2: Market Analysis

```bash
# Analyze TSLA for 60 days
npx neural-trader analyze --symbol TSLA --period 60
```

Output:
```json
{
  "symbol": "TSLA",
  "period": 60,
  "currentPrice": 242.84,
  "trend": "bullish",
  "strength": "3.45",
  "signals": [
    {
      "type": "buy",
      "confidence": 0.82
    }
  ],
  "recommendation": "BUY",
  "confidence": "82.00"
}
```

### Example 3: Backtesting

```bash
# Backtest QQQ with momentum strategy
npx neural-trader backtest --symbol QQQ --days 180 --strategy momentum
```

Output:
```
Symbol: QQQ
Period: 180 days
Strategy: momentum
Total Return: 12.34%
Win Rate: 58.33%
Trades: 24
Sharpe Ratio: 1.45
```

### Example 4: E2B Swarm Test

```bash
# Run E2B swarm tests
npx neural-trader test-e2b --workers 5 --tests all
```

Output:
```
🐝 Initializing E2B swarm with 5 workers...
  Worker 1: abc123def ready
  Worker 2: def456ghi ready
  Worker 3: ghi789jkl ready
  Worker 4: jkl012mno ready
  Worker 5: mno345pqr ready
✓ 5 E2B workers ready

🧪 Running all tests across swarm...
  Total tests: 11

📦 Worker 1 executing 3 tests...
    ✓ Momentum Strategy (Bullish) (234ms)
    ✓ Mean Reversion (Oversold) (189ms)
    ✓ Sentiment Strategy (156ms)

... [more workers]

✓ Test Results:
  Total: 11
  Passed: 10
  Failed: 1
  Pass Rate: 90.91%
```

---

## Troubleshooting

### Issue: "Alpaca API credentials not found"

**Solution:**
1. Check `.env` file exists
2. Verify `ALPACA_API_KEY` and `ALPACA_API_SECRET` are set
3. Ensure no extra spaces or quotes

### Issue: "E2B API key not found"

**Solution:**
1. Get API key from https://e2b.dev
2. Add to `.env` file: `E2B_API_KEY=your_key`

### Issue: "Failed to connect to Alpaca"

**Solution:**
1. Check internet connection
2. Verify API keys are valid
3. Try paper trading mode first
4. Check Alpaca status page

### Issue: "Module not found"

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Permission denied" on CLI

**Solution:**
```bash
# Make CLI executable
chmod +x src/cli.js
```

### Issue: Tests failing

**Solution:**
1. Run demo test first: `node tests/demo-test.js`
2. Check API keys are configured
3. Verify dependencies installed
4. Check test results in `test-results/` folder

---

## Best Practices

### 1. Always Start with Paper Trading
- Never start with live trading
- Test strategies thoroughly
- Understand risks

### 2. Set Appropriate Position Sizes
- Don't risk more than 2% per trade
- Account for volatility
- Use proper position sizing

### 3. Monitor Positions Actively
- Check positions regularly
- Use stop-losses
- Take profits at targets

### 4. Backtest Thoroughly
- Test on historical data
- Use walk-forward analysis
- Understand strategy weaknesses

### 5. Use E2B Swarm Testing
- Run comprehensive tests
- Test all strategies
- Validate before deployment

---

## Advanced Usage

### Custom Strategy Development

Edit `src/neural-engine.js` to add custom strategies:

```javascript
customStrategy(indicators) {
  let confidence = 0;
  let action = 'hold';

  // Your custom logic here
  if (/* your conditions */) {
    confidence = 0.80;
    action = 'buy';
  }

  return { confidence, action };
}
```

### Multiple Symbol Trading

Modify `src/index.js` to trade multiple symbols:

```javascript
const symbols = ['SPY', 'QQQ', 'IWM', 'DIA'];
const marketData = await this.alpaca.getMarketData(symbols);
```

### Custom Risk Management

Adjust risk parameters in `src/neural-engine.js`:

```javascript
constructor(options = {}) {
  this.riskTolerance = options.riskTolerance || 0.01; // 1% risk
  this.maxPositionSize = options.maxPositionSize || 10000; // $10k max
  this.stopLossPercent = options.stopLossPercent || 0.02; // 2% stop
  this.takeProfitPercent = options.takeProfitPercent || 0.05; // 5% profit
}
```

---

## Support & Resources

### Documentation
- [Alpaca API Docs](https://alpaca.markets/docs/)
- [E2B Docs](https://e2b.dev/docs)
- [Project README](README.md)
- [Test Report](TEST_REPORT.md)

### Community
- GitHub Issues: Report bugs and request features
- Vibecast Sessions: Weekly live coding with rUv

### Legal Disclaimer

This software is provided for educational purposes only. Trading involves substantial risk of loss. Always:
- Understand the risks
- Never invest more than you can afford to lose
- Consult a financial advisor
- Start with paper trading
- Do your own research

---

**Last Updated:** 2025-11-18
**Version:** 1.0.0
**License:** MIT
