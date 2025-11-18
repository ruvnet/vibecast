const { spawn } = require('child_process');
const chalk = require('chalk');
const path = require('path');

async function runTestSuite(name, scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(chalk.bold.cyan(`\n${'='.repeat(50)}`));
    console.log(chalk.bold.cyan(`Running: ${name}`));
    console.log(chalk.bold.cyan('='.repeat(50)));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n✓ ${name} completed successfully`));
        resolve({ name, passed: true });
      } else {
        console.log(chalk.red(`\n✗ ${name} failed with exit code ${code}`));
        resolve({ name, passed: false, code });
      }
    });

    child.on('error', (error) => {
      console.error(chalk.red(`\n✗ ${name} error: ${error.message}`));
      reject({ name, passed: false, error: error.message });
    });
  });
}

async function runAllTests() {
  console.log(chalk.bold.magenta('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║   Neural Trader - Full Test Suite             ║'));
  console.log(chalk.bold.magenta('╚════════════════════════════════════════════════╝\n'));

  const startTime = Date.now();
  const results = [];

  // Test Suite 1: Alpaca Integration
  try {
    const result = await runTestSuite(
      'Alpaca API Integration Tests',
      path.join(__dirname, 'alpaca-integration-test.js')
    );
    results.push(result);
  } catch (error) {
    results.push({ name: 'Alpaca API Integration Tests', passed: false, error: error.message });
  }

  // Test Suite 2: E2B Swarm Tests
  try {
    const result = await runTestSuite(
      'E2B Swarm Tests',
      path.join(__dirname, 'e2b-swarm-test.js')
    );
    results.push(result);
  } catch (error) {
    results.push({ name: 'E2B Swarm Tests', passed: false, error: error.message });
  }

  // Final Summary
  const totalTime = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(chalk.bold.yellow('\n\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.bold.yellow('║        Final Test Results Summary              ║'));
  console.log(chalk.bold.yellow('╚════════════════════════════════════════════════╝\n'));

  console.log(chalk.white('Test Suites:'));
  results.forEach(result => {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${result.name}`);
  });

  console.log(chalk.white('\nSummary:'));
  console.log(chalk.gray('  Total Suites: ') + chalk.white(results.length));
  console.log(chalk.gray('  Passed:       ') + chalk.green(passed));
  console.log(chalk.gray('  Failed:       ') + chalk.red(failed));
  console.log(chalk.gray('  Duration:     ') + chalk.white(`${(totalTime / 1000).toFixed(2)}s`));

  // Save final results
  const fs = require('fs');
  const resultsPath = './test-results/full-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify({
    summary: {
      total: results.length,
      passed,
      failed,
      duration: totalTime
    },
    suites: results,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log(chalk.gray(`\nResults saved to: ${resultsPath}\n`));

  if (failed > 0) {
    console.log(chalk.red('❌ Some tests failed\n'));
    process.exit(1);
  } else {
    console.log(chalk.green('✅ All tests passed!\n'));
    process.exit(0);
  }
}

runAllTests().catch(error => {
  console.error(chalk.red('\n❌ Test runner error:'), error);
  process.exit(1);
});
