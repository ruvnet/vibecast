/**
 * Simple benchmark runner - runs standard benchmarks
 */

import { Benchmark } from './benchmark';

async function main() {
  console.log('Running standard benchmarks...\n');

  const results = await Benchmark.runAll();
  console.log(Benchmark.formatReport(results));
}

if (require.main === module) {
  main().catch(console.error);
}
