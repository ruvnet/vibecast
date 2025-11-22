/**
 * Quick Benchmark - Runs a subset of scenarios for faster testing
 */

const fs = require('fs').promises;
const path = require('path');
const BenchmarkRunner = require('./benchmark-runner');

async function main() {
  const configPath = path.join(__dirname, 'config.json');
  const fullConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));

  // Create a quick config with just 2 scenarios
  const quickConfig = {
    ...fullConfig,
    scenarios: [
      fullConfig.scenarios[0], // CRUD API
      fullConfig.scenarios[1]  // Data Processing
    ]
  };

  console.log('🚀 Running Quick Benchmark (2 scenarios)...\n');

  const runner = new BenchmarkRunner(quickConfig);
  await runner.runAllBenchmarks();

  console.log('✅ Quick benchmark completed!\n');
}

main().catch(error => {
  console.error('❌ Quick benchmark failed:', error);
  process.exit(1);
});
