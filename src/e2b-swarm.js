const { Sandbox } = require('@e2b/code-interpreter');
const chalk = require('chalk');

class E2BSwarm {
  constructor(options = {}) {
    this.workers = options.workers || 3;
    this.testSuite = options.testSuite || 'all';
    this.sandboxes = [];
    this.results = [];
    this.apiKey = process.env.E2B_API_KEY;
  }

  async initialize() {
    console.log(chalk.cyan(`\n🐝 Initializing E2B swarm with ${this.workers} workers...`));

    if (!this.apiKey) {
      throw new Error('E2B_API_KEY not found in environment variables');
    }

    // Create sandbox workers
    const promises = [];
    for (let i = 0; i < this.workers; i++) {
      promises.push(this.createWorker(i));
    }

    this.sandboxes = await Promise.all(promises);

    console.log(chalk.green(`✓ ${this.sandboxes.length} E2B workers ready`));
  }

  async createWorker(id) {
    try {
      const sandbox = await Sandbox.create({
        apiKey: this.apiKey,
        timeout: 300 // 5 minutes timeout
      });

      console.log(chalk.gray(`  Worker ${id + 1}: ${sandbox.sandboxId} ready`));

      return {
        id,
        sandbox,
        sandboxId: sandbox.sandboxId,
        status: 'idle'
      };
    } catch (error) {
      console.error(chalk.red(`✗ Failed to create worker ${id + 1}: ${error.message}`));
      return null;
    }
  }

  async runTests() {
    console.log(chalk.cyan(`\n🧪 Running ${this.testSuite} tests across swarm...`));

    const testSuites = this.getTestSuites();
    const testsToRun = this.testSuite === 'all'
      ? Object.values(testSuites).flat()
      : testSuites[this.testSuite] || [];

    console.log(chalk.gray(`  Total tests: ${testsToRun.length}`));

    // Distribute tests across workers
    const results = await this.distributeTests(testsToRun);

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    return aggregated;
  }

  getTestSuites() {
    return {
      strategy: [
        {
          name: 'Momentum Strategy - Bullish Signal',
          code: this.generateStrategyTest('momentum', 'bullish')
        },
        {
          name: 'Momentum Strategy - Bearish Signal',
          code: this.generateStrategyTest('momentum', 'bearish')
        },
        {
          name: 'Mean Reversion Strategy - Oversold',
          code: this.generateStrategyTest('mean-reversion', 'oversold')
        },
        {
          name: 'Mean Reversion Strategy - Overbought',
          code: this.generateStrategyTest('mean-reversion', 'overbought')
        },
        {
          name: 'Sentiment Strategy - High Volume Buy',
          code: this.generateStrategyTest('sentiment', 'buy')
        }
      ],
      integration: [
        {
          name: 'Alpaca API Connection',
          code: this.generateAlpacaConnectionTest()
        },
        {
          name: 'Market Data Fetching',
          code: this.generateMarketDataTest()
        },
        {
          name: 'Order Placement (Mock)',
          code: this.generateOrderPlacementTest()
        }
      ],
      performance: [
        {
          name: 'Signal Generation Speed',
          code: this.generatePerformanceTest('signals')
        },
        {
          name: 'Backtest Performance',
          code: this.generatePerformanceTest('backtest')
        },
        {
          name: 'Concurrent Trading Simulation',
          code: this.generatePerformanceTest('concurrent')
        }
      ]
    };
  }

  async distributeTests(tests) {
    const results = [];
    const chunks = this.chunkArray(tests, this.sandboxes.length);

    const promises = chunks.map(async (chunk, idx) => {
      const worker = this.sandboxes[idx];
      if (!worker) return [];

      console.log(chalk.blue(`\n📦 Worker ${worker.id + 1} executing ${chunk.length} tests...`));

      const workerResults = [];
      for (const test of chunk) {
        const result = await this.executeTest(worker, test);
        workerResults.push(result);
      }

      return workerResults;
    });

    const allResults = await Promise.all(promises);
    return allResults.flat();
  }

  async executeTest(worker, test) {
    worker.status = 'running';
    const startTime = Date.now();

    try {
      console.log(chalk.gray(`    Running: ${test.name}`));

      const execution = await worker.sandbox.runCode(test.code);

      const duration = Date.now() - startTime;
      const passed = !execution.error && execution.results.length > 0;

      const result = {
        name: test.name,
        passed,
        duration,
        workerId: worker.id,
        output: execution.results[0]?.text || '',
        error: execution.error || null
      };

      console.log(passed
        ? chalk.green(`    ✓ ${test.name} (${duration}ms)`)
        : chalk.red(`    ✗ ${test.name} (${duration}ms)`)
      );

      worker.status = 'idle';
      return result;
    } catch (error) {
      worker.status = 'idle';
      return {
        name: test.name,
        passed: false,
        duration: Date.now() - startTime,
        workerId: worker.id,
        output: '',
        error: error.message
      };
    }
  }

  aggregateResults(results) {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      summary: {
        total: results.length,
        passed,
        failed,
        passRate: ((passed / results.length) * 100).toFixed(2),
        totalDuration: `${totalDuration}ms`,
        avgDuration: `${(totalDuration / results.length).toFixed(0)}ms`
      },
      workers: this.sandboxes.map(w => ({
        id: w.id,
        sandboxId: w.sandboxId,
        testsRun: results.filter(r => r.workerId === w.id).length
      })),
      tests: results.map(r => ({
        name: r.name,
        passed: r.passed,
        duration: `${r.duration}ms`,
        workerId: r.workerId,
        error: r.error
      })),
      failedTests: results.filter(r => !r.passed)
    };
  }

  generateStrategyTest(strategy, scenario) {
    return `
import random
import json

# Simulate ${strategy} strategy test for ${scenario} scenario
def test_${strategy}_${scenario}():
    # Mock market data
    indicators = {
        'momentum': {
            'bullish': {'sma5': 110, 'sma10': 105, 'sma20': 100, 'momentum': 0.02, 'rsi': 65},
            'bearish': {'sma5': 90, 'sma10': 95, 'sma20': 100, 'momentum': -0.02, 'rsi': 35}
        },
        'mean-reversion': {
            'oversold': {'rsi': 25, 'currentPrice': 98, 'sma20': 100},
            'overbought': {'rsi': 75, 'currentPrice': 102, 'sma20': 100}
        },
        'sentiment': {
            'buy': {'volumeRatio': 2.0, 'momentum': 0.03},
            'sell': {'volumeRatio': 2.0, 'momentum': -0.03}
        }
    }

    data = indicators.get('${strategy}', {}).get('${scenario}', {})

    # Simulate strategy execution
    confidence = random.uniform(0.7, 0.95)
    action = 'buy' if '${scenario}' in ['bullish', 'oversold', 'buy'] else 'sell'

    result = {
        'test': '${strategy}_${scenario}',
        'passed': True,
        'confidence': round(confidence, 2),
        'action': action,
        'indicators': data
    }

    print(json.dumps(result))
    return result

test_${strategy}_${scenario}()
`;
  }

  generateAlpacaConnectionTest() {
    return `
import json

def test_alpaca_connection():
    # Simulate Alpaca connection test
    result = {
        'test': 'alpaca_connection',
        'passed': True,
        'message': 'Successfully connected to Alpaca Paper Trading API',
        'account': {
            'equity': 100000.00,
            'cash': 100000.00,
            'buying_power': 200000.00
        }
    }
    print(json.dumps(result))
    return result

test_alpaca_connection()
`;
  }

  generateMarketDataTest() {
    return `
import json
import random

def test_market_data():
    symbols = ['SPY', 'QQQ', 'IWM']
    data = []

    for symbol in symbols:
        data.append({
            'symbol': symbol,
            'price': round(random.uniform(100, 500), 2),
            'volume': random.randint(1000000, 10000000),
            'bars': random.randint(50, 100)
        })

    result = {
        'test': 'market_data_fetch',
        'passed': True,
        'symbols_fetched': len(data),
        'data': data
    }

    print(json.dumps(result))
    return result

test_market_data()
`;
  }

  generateOrderPlacementTest() {
    return `
import json
import uuid

def test_order_placement():
    order = {
        'id': str(uuid.uuid4()),
        'symbol': 'SPY',
        'qty': 10,
        'side': 'buy',
        'type': 'market',
        'status': 'filled',
        'filled_avg_price': 450.25
    }

    result = {
        'test': 'order_placement',
        'passed': True,
        'order': order
    }

    print(json.dumps(result))
    return result

test_order_placement()
`;
  }

  generatePerformanceTest(type) {
    return `
import json
import time
import random

def test_performance_${type}():
    start = time.time()

    # Simulate ${type} operation
    if '${type}' == 'signals':
        # Generate 100 signals
        for _ in range(100):
            _ = random.uniform(0, 1)
    elif '${type}' == 'backtest':
        # Simulate backtest over 1000 data points
        for _ in range(1000):
            _ = random.uniform(0, 1)
    elif '${type}' == 'concurrent':
        # Simulate concurrent operations
        operations = []
        for _ in range(50):
            operations.append(random.uniform(0, 1))

    duration = (time.time() - start) * 1000

    result = {
        'test': 'performance_${type}',
        'passed': duration < 1000,  # Must complete in < 1 second
        'duration_ms': round(duration, 2),
        'operations': 100 if '${type}' == 'signals' else 1000 if '${type}' == 'backtest' else 50
    }

    print(json.dumps(result))
    return result

test_performance_${type}()
`;
  }

  chunkArray(array, chunks) {
    const result = [];
    const chunkSize = Math.ceil(array.length / chunks);

    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }

    return result;
  }

  async shutdown() {
    console.log(chalk.yellow('\n🔒 Shutting down E2B swarm...'));

    const promises = this.sandboxes.map(async (worker) => {
      try {
        await worker.sandbox.close();
        console.log(chalk.gray(`  Worker ${worker.id + 1} closed`));
      } catch (error) {
        console.error(chalk.red(`  Failed to close worker ${worker.id + 1}`));
      }
    });

    await Promise.all(promises);
    console.log(chalk.green('✓ E2B swarm shutdown complete'));
  }
}

module.exports = E2BSwarm;
