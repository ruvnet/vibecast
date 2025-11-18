# Neural Trader 🧠📈

AI-powered neural trading system with E2B swarm testing and Alpaca API integration.

Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## Features

- 🤖 **Neural Trading Engine**: AI-powered trading strategies (momentum, mean-reversion, sentiment)
- 📊 **Alpaca API Integration**: Real-time market data and paper/live trading
- 🐝 **E2B Swarm Testing**: Distributed testing across multiple sandbox environments
- 📈 **Backtesting**: Test strategies on historical data
- 💹 **Real-time Analysis**: Market analysis and signal generation
- 🎯 **Risk Management**: Position sizing and stop-loss automation

## Quick Start

### Installation

```bash
npm install
```

### Setup Environment

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Required API keys:
- **Alpaca API**: Get from [https://app.alpaca.markets/paper/dashboard/overview](https://app.alpaca.markets/paper/dashboard/overview)
- **E2B API**: Get from [https://e2b.dev](https://e2b.dev)

### Run via NPX

```bash
# Show help
npx . --help

# Start paper trading
npx . trade --mode paper --strategy momentum

# Analyze a symbol
npx . analyze --symbol SPY --period 30

# Run backtest
npx . backtest --symbol SPY --days 90 --strategy momentum

# Check account status
npx . status

# Run E2B swarm tests
npx . test-e2b --workers 3 --tests all
```

## Trading Strategies

### 1. Momentum Strategy
Identifies trending markets and follows the momentum:
- Bullish: SMA5 > SMA10 > SMA20, positive momentum, RSI < 70
- Bearish: SMA5 < SMA10 < SMA20, negative momentum, RSI > 30

### 2. Mean Reversion Strategy
Exploits overbought/oversold conditions:
- Buy: RSI < 30, price below SMA20
- Sell: RSI > 70, price above SMA20

### 3. Sentiment Strategy
Follows volume and momentum signals:
- High volume + positive momentum = Buy
- High volume + negative momentum = Sell

## Testing

### Run All Tests

```bash
npm test
```

### Run E2B Swarm Tests

```bash
npm run test:e2b
```

### Run Alpaca Integration Tests

```bash
npm run test:alpaca
```

## E2B Swarm Testing

The E2B swarm testing feature distributes tests across multiple isolated sandbox environments for parallel execution:

- **Strategy Tests**: Validate trading strategies across different market conditions
- **Integration Tests**: Test Alpaca API connectivity and data fetching
- **Performance Tests**: Benchmark signal generation and backtesting speed

## CLI Commands

### `trade`
Start neural trading with Alpaca API

Options:
- `-m, --mode <mode>`: Trading mode (paper/live) [default: paper]
- `-s, --strategy <strategy>`: Strategy (momentum/mean-reversion/sentiment) [default: momentum]
- `-a, --amount <amount>`: Trading amount in USD [default: 1000]

### `analyze`
Analyze market data and generate trading signals

Options:
- `-s, --symbol <symbol>`: Stock symbol [default: SPY]
- `-p, --period <period>`: Analysis period in days [default: 30]

### `test-e2b`
Run comprehensive tests using E2B swarm

Options:
- `-w, --workers <workers>`: Number of E2B workers [default: 3]
- `-t, --tests <tests>`: Test suite (all/strategy/integration/performance) [default: all]

### `backtest`
Run backtesting on historical data

Options:
- `-s, --symbol <symbol>`: Stock symbol [default: SPY]
- `-d, --days <days>`: Number of days to backtest [default: 90]
- `--strategy <strategy>`: Strategy to test [default: momentum]

### `status`
Check Alpaca account status and current positions

## Architecture

```
neural-trader/
├── src/
│   ├── cli.js              # CLI entry point
│   ├── index.js            # Main NeuralTrader class
│   ├── alpaca-client.js    # Alpaca API integration
│   ├── neural-engine.js    # Neural trading engine
│   └── e2b-swarm.js        # E2B swarm orchestrator
├── tests/
│   ├── run-tests.js        # Main test runner
│   ├── e2b-swarm-test.js   # E2B swarm tests
│   └── alpaca-integration-test.js  # Alpaca API tests
├── test-results/           # Test output directory
└── package.json
```

## Test Results

All test results are saved to `test-results/` directory:
- `e2b-swarm-results.json`: E2B swarm test results
- `alpaca-integration-results.json`: Alpaca integration test results
- `full-test-results.json`: Combined test results

## Safety Features

- Paper trading by default
- Position size limits
- Stop-loss automation (2% default)
- Take-profit targets (5% default)
- Risk management per trade

## Requirements

- Node.js >= 16.0.0
- Alpaca API account (paper or live)
- E2B API key

## License

MIT

## Author

rUv - Vibecast Live Coding Sessions
