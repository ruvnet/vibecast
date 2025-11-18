#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const NeuralTrader = require('./index');
const E2BSwarm = require('./e2b-swarm');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('neural-trader')
  .description('AI-powered neural trading system with E2B swarm testing')
  .version('1.0.0');

program
  .command('trade')
  .description('Start neural trading with Alpaca API')
  .option('-m, --mode <mode>', 'Trading mode: live or paper', 'paper')
  .option('-s, --strategy <strategy>', 'Trading strategy: momentum, mean-reversion, sentiment', 'momentum')
  .option('-a, --amount <amount>', 'Trading amount in USD', '1000')
  .action(async (options) => {
    const spinner = ora('Initializing Neural Trader...').start();
    try {
      const trader = new NeuralTrader({
        mode: options.mode,
        strategy: options.strategy,
        amount: parseFloat(options.amount)
      });

      spinner.text = 'Connecting to Alpaca API...';
      await trader.initialize();

      spinner.succeed('Neural Trader initialized successfully!');
      console.log(chalk.green('\n✓ Trading session started'));

      await trader.startTrading();
    } catch (error) {
      spinner.fail('Failed to start Neural Trader');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze market data and generate trading signals')
  .option('-s, --symbol <symbol>', 'Stock symbol to analyze', 'SPY')
  .option('-p, --period <period>', 'Analysis period in days', '30')
  .action(async (options) => {
    const spinner = ora('Analyzing market data...').start();
    try {
      const trader = new NeuralTrader({ mode: 'paper' });
      await trader.initialize();

      const analysis = await trader.analyze(options.symbol, parseInt(options.period));

      spinner.succeed('Analysis complete!');
      console.log(chalk.cyan('\n📊 Market Analysis Results:'));
      console.log(JSON.stringify(analysis, null, 2));
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('test-e2b')
  .description('Run comprehensive tests using E2B swarm')
  .option('-w, --workers <workers>', 'Number of E2B workers', '3')
  .option('-t, --tests <tests>', 'Test suite: all, strategy, integration, performance', 'all')
  .action(async (options) => {
    const spinner = ora('Initializing E2B swarm...').start();
    try {
      const swarm = new E2BSwarm({
        workers: parseInt(options.workers),
        testSuite: options.tests
      });

      spinner.text = 'Starting E2B swarm workers...';
      await swarm.initialize();

      spinner.text = 'Running tests across swarm...';
      const results = await swarm.runTests();

      spinner.succeed('E2B swarm tests completed!');
      console.log(chalk.green('\n✓ Test Results:'));
      console.log(JSON.stringify(results, null, 2));

      await swarm.shutdown();
    } catch (error) {
      spinner.fail('E2B swarm tests failed');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('backtest')
  .description('Run backtesting on historical data')
  .option('-s, --symbol <symbol>', 'Stock symbol', 'SPY')
  .option('-d, --days <days>', 'Number of days to backtest', '90')
  .option('--strategy <strategy>', 'Strategy to test', 'momentum')
  .action(async (options) => {
    const spinner = ora('Running backtest...').start();
    try {
      const trader = new NeuralTrader({
        mode: 'paper',
        strategy: options.strategy
      });
      await trader.initialize();

      spinner.text = 'Fetching historical data...';
      const results = await trader.backtest(options.symbol, parseInt(options.days));

      spinner.succeed('Backtest complete!');
      console.log(chalk.yellow('\n📈 Backtest Results:'));
      console.log(`Symbol: ${options.symbol}`);
      console.log(`Period: ${options.days} days`);
      console.log(`Strategy: ${options.strategy}`);
      console.log(`Total Return: ${results.totalReturn}%`);
      console.log(`Win Rate: ${results.winRate}%`);
      console.log(`Trades: ${results.totalTrades}`);
      console.log(`Sharpe Ratio: ${results.sharpeRatio}`);
    } catch (error) {
      spinner.fail('Backtest failed');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check Alpaca account status and current positions')
  .action(async () => {
    const spinner = ora('Fetching account status...').start();
    try {
      const trader = new NeuralTrader({ mode: 'paper' });
      await trader.initialize();

      const status = await trader.getStatus();

      spinner.succeed('Account status retrieved!');
      console.log(chalk.blue('\n💼 Account Status:'));
      console.log(JSON.stringify(status, null, 2));
    } catch (error) {
      spinner.fail('Failed to fetch status');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
