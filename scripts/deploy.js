#!/usr/bin/env node

/**
 * Deployment Script
 *
 * Handles deployment preparation and checks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Preparing for deployment...\n');

// Check if package.json exists
const packageJsonPath = path.join(__dirname, '../package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: package.json not found');
  process.exit(1);
}

const packageJson = require(packageJsonPath);
console.log(`Package: ${packageJson.name}@${packageJson.version}`);

// Run pre-deployment checks
const checks = [
  {
    name: 'Type Check',
    command: 'npm run type-check',
  },
  {
    name: 'Tests',
    command: 'npm test',
  },
  {
    name: 'Build',
    command: 'npm run build',
  },
];

let allChecksPassed = true;

for (const check of checks) {
  console.log(`\n[${check.name}]`);
  console.log('─'.repeat(50));

  try {
    execSync(check.command, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log(`✓ ${check.name} passed`);
  } catch (error) {
    console.error(`✗ ${check.name} failed`);
    allChecksPassed = false;
    break;
  }
}

console.log('\n' + '='.repeat(50));

if (allChecksPassed) {
  console.log('✓ All checks passed! Ready for deployment.');
  console.log('\nNext steps:');
  console.log('  1. Review CHANGELOG.md');
  console.log('  2. Update version: npm version [patch|minor|major]');
  console.log('  3. Push to repository: git push --follow-tags');
  console.log('  4. Publish: npm publish');
} else {
  console.error('✗ Deployment checks failed. Please fix errors and try again.');
  process.exit(1);
}
