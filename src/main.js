const nt = require('neural-trader');
const config = require('../config.json');

async function main() {
  console.log('=== Neural Trader Capabilities Demo ===\n');

  // 1. Version Info
  console.log('1. Version Info:');
  const version = nt.getVersionInfo();
  console.log('  ', version);

  // 2. List available strategies
  console.log('\n2. Available Strategies:');
  const strategies = await nt.listStrategies();
  console.log('  ', strategies);

  // 3. List broker types
  console.log('\n3. Broker Types:');
  const brokers = await nt.listBrokerTypes();
  console.log('  ', brokers);

  // 4. List data providers
  console.log('\n4. Data Providers:');
  const providers = await nt.listDataProviders();
  console.log('  ', providers);

  // 5. Fetch market data
  console.log('\n5. Fetching Market Data for AAPL:');
  const data = await nt.fetchMarketData('AAPL', '2024-01-01', '2024-12-31', 'yahoo');
  console.log(`   Fetched ${data.length} data points`);
  if (data.length > 0) {
    console.log('   Sample:', data[0]);
  }

  // 6. Calculate technical indicators
  console.log('\n6. Technical Indicators:');
  if (data.length > 0) {
    const closes = data.map(d => d.close || d.c || 0);
    const sma = nt.calculateSma(closes, 20);
    const rsi = nt.calculateRsi(closes, 14);
    console.log(`   SMA(20): ${sma?.toFixed(2) || 'N/A'}`);
    console.log(`   RSI(14): ${rsi?.toFixed(2) || 'N/A'}`);
  }

  // 7. Run backtest
  console.log('\n7. Running Backtest:');
  const backtestResult = await nt.backtestStrategy({
    strategy: 'momentum',
    symbol: 'AAPL',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    initialCapital: 100000,
    parameters: config.trading.parameters
  });
  console.log('   Backtest Result:', backtestResult);

  // 8. Risk Analysis
  console.log('\n8. Risk Analysis:');
  const sharpe = nt.calculateSharpeRatio([0.02, 0.01, -0.01, 0.03, 0.02], 0.01);
  const sortino = nt.calculateSortinoRatio([0.02, 0.01, -0.01, 0.03, 0.02], 0.01);
  console.log(`   Sharpe Ratio: ${sharpe?.toFixed(4) || 'N/A'}`);
  console.log(`   Sortino Ratio: ${sortino?.toFixed(4) || 'N/A'}`);

  // 9. Kelly Criterion
  console.log('\n9. Kelly Criterion:');
  const kelly = nt.calculateKellyCriterion(0.55, 2.0);
  console.log(`   Kelly Fraction: ${kelly?.toFixed(4) || 'N/A'}`);

  // 10. Neural predictions
  console.log('\n10. Neural Prediction:');
  try {
    const prediction = await nt.neuralForecast({
      data: data.slice(-60).map(d => d.close || d.c || 0),
      horizon: 5
    });
    console.log('    Forecast:', prediction);
  } catch (e) {
    console.log('    Forecast:', e.message);
  }

  console.log('\n=== Demo Complete ===');
}

main().catch(console.error);
