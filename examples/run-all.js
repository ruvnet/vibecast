#!/usr/bin/env node
/**
 * AgentDB v3 Examples Runner
 * Runs all 20 examples and collects results
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const DIRS = ['practical', 'intermediate', 'advanced', 'exotic', 'benchmarks'];
const BASE = new URL('.', import.meta.url).pathname;

const results = [];
let passed = 0;
let failed = 0;
let skipped = 0;

console.log('='.repeat(70));
console.log('  AgentDB v3 (3.0.0-alpha.3) - Example Suite Runner');
console.log('='.repeat(70));
console.log();

for (const dir of DIRS) {
  const dirPath = join(BASE, dir);
  if (!existsSync(dirPath)) { continue; }

  const files = readdirSync(dirPath)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (files.length === 0) continue;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${dir.toUpperCase()} EXAMPLES`);
  console.log(`${'─'.repeat(60)}`);

  for (const file of files) {
    const filePath = join(dirPath, file);
    const name = basename(file, '.js');
    const startTime = Date.now();

    process.stdout.write(`  [RUN] ${name} ... `);

    try {
      const output = execSync(`node "${filePath}"`, {
        cwd: BASE,
        timeout: 60000,
        encoding: 'utf8',
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const elapsed = Date.now() - startTime;
      console.log(`PASS (${elapsed}ms)`);
      results.push({ name, dir, status: 'PASS', elapsed, output: output.slice(-500) });
      passed++;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const stderr = err.stderr?.toString().slice(-300) || err.message?.slice(-300) || 'Unknown error';

      if (stderr.includes('Cannot find module') || stderr.includes('not available')) {
        console.log(`SKIP (missing optional dep, ${elapsed}ms)`);
        results.push({ name, dir, status: 'SKIP', elapsed, error: stderr });
        skipped++;
      } else {
        console.log(`FAIL (${elapsed}ms)`);
        console.log(`         ${stderr.split('\n')[0]}`);
        results.push({ name, dir, status: 'FAIL', elapsed, error: stderr });
        failed++;
      }
    }
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log('  RESULTS SUMMARY');
console.log(`${'='.repeat(70)}`);
console.log(`  Total:   ${results.length}`);
console.log(`  Passed:  ${passed}`);
console.log(`  Failed:  ${failed}`);
console.log(`  Skipped: ${skipped}`);
console.log(`${'='.repeat(70)}\n`);

if (failed > 0) {
  console.log('  FAILURES:');
  for (const r of results.filter(r => r.status === 'FAIL')) {
    console.log(`    - ${r.name}: ${r.error?.split('\n')[0]}`);
  }
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
