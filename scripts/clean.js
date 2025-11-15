#!/usr/bin/env node

/**
 * Clean Script
 *
 * Removes build artifacts and temporary files
 */

const fs = require('fs');
const path = require('path');

const dirsToClean = [
  'dist',
  'coverage',
  'node_modules/.cache',
  'src/wasm/rust/pkg',
  'src/wasm/rust/target',
];

console.log('Cleaning build artifacts...\n');

for (const dir of dirsToClean) {
  const fullPath = path.join(__dirname, '..', dir);

  if (fs.existsSync(fullPath)) {
    console.log(`Removing: ${dir}`);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

console.log('\n✓ Clean complete!');
