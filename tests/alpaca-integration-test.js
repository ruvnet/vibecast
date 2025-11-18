const AlpacaClient = require('../src/alpaca-client');
const chalk = require('chalk');
const dotenv = require('dotenv');

dotenv.config();

async function runAlpacaIntegrationTest() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   Alpaca API Integration Tests        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════╝\n'));

  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Connection
  console.log(chalk.yellow('Test 1: Alpaca API Connection'));
  try {
    const client = new AlpacaClient({ mode: 'paper' });
    await client.connect();
    console.log(chalk.green('✓ Connection successful\n'));
    tests.push({ name: 'API Connection', passed: true });
    passed++;

    // Test 2: Get Account Info
    console.log(chalk.yellow('Test 2: Fetch Account Information'));
    const account = await client.getAccount();
    console.log(chalk.gray(`  Account Number: ${account.account_number}`));
    console.log(chalk.gray(`  Equity: $${parseFloat(account.equity).toFixed(2)}`));
    console.log(chalk.gray(`  Cash: $${parseFloat(account.cash).toFixed(2)}`));
    console.log(chalk.gray(`  Buying Power: $${parseFloat(account.buying_power).toFixed(2)}`));
    console.log(chalk.green('✓ Account info retrieved\n'));
    tests.push({ name: 'Get Account Info', passed: true });
    passed++;

    // Test 3: Get Market Data
    console.log(chalk.yellow('Test 3: Fetch Market Data'));
    const symbols = ['SPY', 'QQQ'];
    const marketData = await client.getMarketData(symbols);
    console.log(chalk.gray(`  Symbols fetched: ${marketData.length}`));
    marketData.forEach(data => {
      console.log(chalk.gray(`  ${data.symbol}: $${data.price?.toFixed(2) || 'N/A'} (${data.bars?.length || 0} bars)`));
    });
    console.log(chalk.green('✓ Market data retrieved\n'));
    tests.push({ name: 'Get Market Data', passed: true });
    passed++;

    // Test 4: Get Historical Data
    console.log(chalk.yellow('Test 4: Fetch Historical Data'));
    const historicalData = await client.getHistoricalData('SPY', 30);
    console.log(chalk.gray(`  Data points: ${historicalData.length}`));
    if (historicalData.length > 0) {
      const latest = historicalData[historicalData.length - 1];
      console.log(chalk.gray(`  Latest close: $${latest.close?.toFixed(2)}`));
    }
    console.log(chalk.green('✓ Historical data retrieved\n'));
    tests.push({ name: 'Get Historical Data', passed: true });
    passed++;

    // Test 5: Check Market Clock
    console.log(chalk.yellow('Test 5: Check Market Clock'));
    const clock = await client.getClock();
    console.log(chalk.gray(`  Market Open: ${clock.is_open ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`  Next Open: ${clock.next_open}`));
    console.log(chalk.gray(`  Next Close: ${clock.next_close}`));
    console.log(chalk.green('✓ Market clock retrieved\n'));
    tests.push({ name: 'Get Market Clock', passed: true });
    passed++;

    // Test 6: Get Current Positions
    console.log(chalk.yellow('Test 6: Fetch Current Positions'));
    const positions = await client.getPositions();
    console.log(chalk.gray(`  Open positions: ${positions.length}`));
    if (positions.length > 0) {
      positions.forEach(pos => {
        console.log(chalk.gray(`  ${pos.symbol}: ${pos.qty} shares @ $${pos.avg_entry_price}`));
      });
    } else {
      console.log(chalk.gray(`  No open positions`));
    }
    console.log(chalk.green('✓ Positions retrieved\n'));
    tests.push({ name: 'Get Positions', passed: true });
    passed++;

  } catch (error) {
    console.error(chalk.red('✗ Test failed:'), error.message);
    tests.push({ name: 'Alpaca Integration', passed: false, error: error.message });
    failed++;
  }

  // Summary
  console.log(chalk.bold.yellow('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold.yellow('║          Test Results Summary          ║'));
  console.log(chalk.bold.yellow('╚════════════════════════════════════════╝\n'));

  console.log(chalk.white('Summary:'));
  console.log(chalk.gray('  Total Tests: ') + chalk.white(tests.length));
  console.log(chalk.gray('  Passed:      ') + chalk.green(passed));
  console.log(chalk.gray('  Failed:      ') + chalk.red(failed));
  console.log(chalk.gray('  Pass Rate:   ') + chalk.cyan(`${((passed / tests.length) * 100).toFixed(2)}%`));

  // Save results
  const fs = require('fs');
  const resultsPath = './test-results/alpaca-integration-results.json';
  require('fs').mkdirSync('./test-results', { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    summary: { total: tests.length, passed, failed },
    tests
  }, null, 2));
  console.log(chalk.gray(`\nResults saved to: ${resultsPath}\n`));

  process.exit(failed > 0 ? 1 : 0);
}

runAlpacaIntegrationTest();
