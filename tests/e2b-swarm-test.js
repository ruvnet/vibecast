const E2BSwarm = require('../src/e2b-swarm');
const chalk = require('chalk');
const dotenv = require('dotenv');

dotenv.config();

async function runE2BSwarmTest() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   E2B Swarm Test Suite Runner         ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════╝\n'));

  const startTime = Date.now();

  try {
    // Initialize E2B swarm
    const swarm = new E2BSwarm({
      workers: 3,
      testSuite: 'all'
    });

    await swarm.initialize();

    // Run all tests
    const results = await swarm.runTests();

    // Display results
    console.log(chalk.bold.yellow('\n╔════════════════════════════════════════╗'));
    console.log(chalk.bold.yellow('║          Test Results Summary          ║'));
    console.log(chalk.bold.yellow('╚════════════════════════════════════════╝\n'));

    console.log(chalk.white('Summary:'));
    console.log(chalk.gray('  Total Tests:    ') + chalk.white(results.summary.total));
    console.log(chalk.gray('  Passed:         ') + chalk.green(results.summary.passed));
    console.log(chalk.gray('  Failed:         ') + chalk.red(results.summary.failed));
    console.log(chalk.gray('  Pass Rate:      ') + chalk.cyan(results.summary.passRate + '%'));
    console.log(chalk.gray('  Total Duration: ') + chalk.white(results.summary.totalDuration));
    console.log(chalk.gray('  Avg Duration:   ') + chalk.white(results.summary.avgDuration));

    console.log(chalk.white('\nWorkers:'));
    results.workers.forEach(worker => {
      console.log(chalk.gray(`  Worker ${worker.id + 1}: ${worker.testsRun} tests`));
    });

    if (results.failedTests.length > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      results.failedTests.forEach(test => {
        console.log(chalk.red(`  ✗ ${test.name}`));
        if (test.error) {
          console.log(chalk.gray(`    Error: ${test.error}`));
        }
      });
    }

    console.log(chalk.green('\n✓ Detailed Test Results:'));
    results.tests.forEach(test => {
      const icon = test.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${test.name} (${test.duration}) [Worker ${test.workerId + 1}]`);
    });

    // Shutdown swarm
    await swarm.shutdown();

    const totalTime = Date.now() - startTime;
    console.log(chalk.bold.green(`\n✓ E2B Swarm Test Complete (${totalTime}ms)\n`));

    // Save results to file
    const fs = require('fs');
    const resultsPath = './test-results/e2b-swarm-results.json';
    require('fs').mkdirSync('./test-results', { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(chalk.gray(`Results saved to: ${resultsPath}\n`));

    process.exit(results.summary.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error(chalk.red('\n❌ E2B Swarm Test Failed:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

runE2BSwarmTest();
