/**
 * Neural Trader - Complete Sub-Package Test Suite
 * Tests all 13 installed sub-packages
 */

const packages = {
  'neural-trader': 'neural-trader',
  '@neural-trader/core': '@neural-trader/core',
  '@neural-trader/strategies': '@neural-trader/strategies',
  '@neural-trader/execution': '@neural-trader/execution',
  '@neural-trader/backtesting': '@neural-trader/backtesting',
  '@neural-trader/market-data': '@neural-trader/market-data',
  '@neural-trader/portfolio': '@neural-trader/portfolio',
  '@neural-trader/risk': '@neural-trader/risk',
  '@neural-trader/news-trading': '@neural-trader/news-trading',
  '@neural-trader/neural': '@neural-trader/neural',
  '@neural-trader/sports-betting': '@neural-trader/sports-betting',
  '@neural-trader/prediction-markets': '@neural-trader/prediction-markets',
  '@neural-trader/predictor': '@neural-trader/predictor',
  '@neural-trader/brokers': '@neural-trader/brokers',
};

async function testAllPackages() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Neural Trader - Complete Sub-Package Test Suite        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  for (const [name, path] of Object.entries(packages)) {
    console.log(`\n📦 Testing: ${name}`);
    console.log('─'.repeat(60));

    try {
      const pkg = require(path);
      const exports = Object.keys(pkg);

      console.log(`  ✅ Loaded successfully`);
      console.log(`  📋 Exports: ${exports.length} items`);

      // Show first 10 exports
      const sample = exports.slice(0, 10);
      console.log(`  📝 Sample: ${sample.join(', ')}${exports.length > 10 ? '...' : ''}`);

      // Test specific functions for each package
      await testPackageFunctions(name, pkg);

      passed++;
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      failed++;
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                   PACKAGE TEST SUMMARY                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n  Total Packages: ${passed + failed}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
}

async function testPackageFunctions(name, pkg) {
  switch(name) {
    case 'neural-trader':
      await testMainPackage(pkg);
      break;
    case '@neural-trader/core':
      await testCorePackage(pkg);
      break;
    case '@neural-trader/strategies':
      await testStrategiesPackage(pkg);
      break;
    case '@neural-trader/execution':
      await testExecutionPackage(pkg);
      break;
    case '@neural-trader/backtesting':
      await testBacktestingPackage(pkg);
      break;
    case '@neural-trader/market-data':
      await testMarketDataPackage(pkg);
      break;
    case '@neural-trader/portfolio':
      await testPortfolioPackage(pkg);
      break;
    case '@neural-trader/risk':
      await testRiskPackage(pkg);
      break;
    case '@neural-trader/news-trading':
      await testNewsTradingPackage(pkg);
      break;
    case '@neural-trader/neural':
      await testNeuralPackage(pkg);
      break;
    case '@neural-trader/sports-betting':
      await testSportsBettingPackage(pkg);
      break;
    case '@neural-trader/prediction-markets':
      await testPredictionMarketsPackage(pkg);
      break;
    case '@neural-trader/predictor':
      await testPredictorPackage(pkg);
      break;
    case '@neural-trader/brokers':
      await testBrokersPackage(pkg);
      break;
  }
}

async function testMainPackage(pkg) {
  // Version info
  if (pkg.getVersionInfo) {
    const v = pkg.getVersionInfo();
    console.log(`  🔧 Version: ${JSON.stringify(v)}`);
  }

  // List strategies
  if (pkg.listStrategies) {
    const s = await pkg.listStrategies();
    const parsed = typeof s === 'string' ? JSON.parse(s) : s;
    console.log(`  📈 Strategies: ${parsed.total_count || parsed.strategies?.length || 0}`);
  }
}

async function testCorePackage(pkg) {
  if (pkg.NeuralTrader) {
    console.log('  🧠 NeuralTrader class available');
  }
  if (pkg.indicators) {
    console.log('  📊 Indicators module available');
  }
}

async function testStrategiesPackage(pkg) {
  if (pkg.MomentumStrategy) {
    console.log('  📈 MomentumStrategy class available');
  }
  if (pkg.MeanReversionStrategy) {
    console.log('  📉 MeanReversionStrategy class available');
  }
  if (pkg.strategies || pkg.availableStrategies) {
    console.log('  📋 Strategy list available');
  }
}

async function testExecutionPackage(pkg) {
  if (pkg.OrderExecutor) {
    console.log('  ⚡ OrderExecutor class available');
  }
  if (pkg.SmartRouter) {
    console.log('  🔀 SmartRouter class available');
  }
}

async function testBacktestingPackage(pkg) {
  if (pkg.BacktestEngine) {
    console.log('  🔄 BacktestEngine class available');
  }
  if (pkg.WalkForward) {
    console.log('  📊 WalkForward analysis available');
  }
}

async function testMarketDataPackage(pkg) {
  if (pkg.MarketDataProvider) {
    console.log('  📡 MarketDataProvider class available');
  }
  if (pkg.fetchData || pkg.getData) {
    console.log('  📥 Data fetching functions available');
  }
}

async function testPortfolioPackage(pkg) {
  if (pkg.PortfolioManager) {
    console.log('  💼 PortfolioManager class available');
  }
  if (pkg.PortfolioOptimizer) {
    console.log('  🎯 PortfolioOptimizer class available');
  }
}

async function testRiskPackage(pkg) {
  if (pkg.RiskManager) {
    console.log('  ⚠️ RiskManager class available');
  }
  if (pkg.VaR || pkg.calculateVaR) {
    console.log('  📊 VaR calculations available');
  }
}

async function testNewsTradingPackage(pkg) {
  if (pkg.NewsAnalyzer) {
    console.log('  📰 NewsAnalyzer class available');
  }
  if (pkg.SentimentAnalyzer) {
    console.log('  🎭 SentimentAnalyzer class available');
  }
}

async function testNeuralPackage(pkg) {
  if (pkg.NeuralNetwork) {
    console.log('  🧠 NeuralNetwork class available');
  }
  if (pkg.LSTM || pkg.LSTMModel) {
    console.log('  🔮 LSTM model available');
  }
}

async function testSportsBettingPackage(pkg) {
  if (pkg.ArbitrageScanner) {
    console.log('  🎯 ArbitrageScanner class available');
  }
  if (pkg.KellyCalculator) {
    console.log('  📊 KellyCalculator class available');
  }
}

async function testPredictionMarketsPackage(pkg) {
  if (pkg.MarketMaker) {
    console.log('  🏪 MarketMaker class available');
  }
  if (pkg.PredictionTrader) {
    console.log('  🎲 PredictionTrader class available');
  }
}

async function testPredictorPackage(pkg) {
  if (pkg.ConformalPredictor) {
    console.log('  🎯 ConformalPredictor class available');
  }
  if (pkg.predict) {
    console.log('  🔮 Prediction functions available');
  }
}

async function testBrokersPackage(pkg) {
  if (pkg.AlpacaBroker) {
    console.log('  🦙 AlpacaBroker class available');
  }
  if (pkg.IBKRBroker) {
    console.log('  🏦 IBKRBroker class available');
  }
  if (pkg.BrokerFactory) {
    console.log('  🏭 BrokerFactory class available');
  }
}

testAllPackages().catch(console.error);
