/**
 * Validation Test for ruvector@0.1.5
 * Testing the fixes applied to the packaging issues
 */

console.log('='.repeat(70));
console.log('RUVECTOR v0.1.5 VALIDATION TEST');
console.log('='.repeat(70) + '\n');

// Test 1: Check main package fix
console.log('TEST 1: Main Package Loading (ruvector → ruvector-core)');
console.log('-'.repeat(70));

try {
  const mainPackageCode = require('fs').readFileSync('./node_modules/ruvector/dist/index.js', 'utf8');

  // Check if the fix was applied
  const hasOldScoped = mainPackageCode.includes("require('@ruvector/core')");
  const hasNewUnscoped = mainPackageCode.includes("require('ruvector-core')");

  console.log('✓ File: node_modules/ruvector/dist/index.js');
  console.log(`  Old scoped (@ruvector/core): ${hasOldScoped ? '❌ FOUND' : '✅ NOT FOUND'}`);
  console.log(`  New unscoped (ruvector-core): ${hasNewUnscoped ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`  Status: ${!hasOldScoped && hasNewUnscoped ? '✅ FIXED' : '❌ NOT FIXED'}`);
} catch (e) {
  console.log('❌ Error reading file:', e.message);
}

console.log();

// Test 2: Check ruvector-core package
console.log('TEST 2: Core Package Loading (ruvector-core → platform packages)');
console.log('-'.repeat(70));

try {
  const corePackageCode = require('fs').readFileSync('./node_modules/ruvector-core/index.js', 'utf8');

  const hasOldScoped = corePackageCode.includes('@ruvector/core-');
  const hasNewUnscoped = corePackageCode.includes('ruvector-core-');

  console.log('✓ File: node_modules/ruvector-core/index.js');
  console.log(`  Old scoped (@ruvector/core-*): ${hasOldScoped ? '❌ FOUND' : '✅ NOT FOUND'}`);
  console.log(`  New unscoped (ruvector-core-*): ${hasNewUnscoped ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`  Status: ${!hasOldScoped && hasNewUnscoped ? '✅ FIXED' : '❌ NOT FIXED'}`);

  if (hasOldScoped) {
    console.log('\n  ⚠️  ISSUE: ruvector-core still references @ruvector/core-* packages');
    console.log('  This prevents the main package from loading correctly.');
  }
} catch (e) {
  console.log('❌ Error reading file:', e.message);
}

console.log();

// Test 3: Try direct platform package loading
console.log('TEST 3: Direct Platform Package Loading');
console.log('-'.repeat(70));

try {
  const native = require('ruvector-core-linux-x64-gnu');
  console.log('✅ Platform package loads directly: ruvector-core-linux-x64-gnu');
  console.log(`✓ Version: ${native.version()}`);
  console.log(`✓ Exports: ${Object.keys(native).join(', ')}`);

  // Try to create a database
  const db = native.VectorDb.withDimensions(128);
  console.log('✅ VectorDb instantiation works');
} catch (e) {
  console.log('❌ Platform package error:', e.message);
}

console.log();

// Test 4: Try main package loading
console.log('TEST 4: Main Package Loading (ruvector)');
console.log('-'.repeat(70));

try {
  const { VectorDb, getVersion, getImplementationType } = require('ruvector');
  console.log('✅ Main package loaded successfully!');
  console.log(`✓ Version: ${JSON.stringify(getVersion())}`);
  console.log(`✓ Implementation: ${getImplementationType()}`);

  // Try to create a database
  const db = new VectorDb({ dimensions: 128 });
  console.log('✅ VectorDb instantiation works through main package');
} catch (e) {
  console.log('❌ Main package error:', e.message);
  console.log('\n  Root Cause Analysis:');

  if (e.message.includes('@ruvector/core')) {
    console.log('  → ruvector-core package was not updated');
    console.log('  → Still references @ruvector/core-* scoped packages');
    console.log('  → Needs ruvector-core@0.1.2+ with unscoped references');
  }
}

console.log();

// Test 5: Version check
console.log('TEST 5: Package Versions');
console.log('-'.repeat(70));

const fs = require('fs');
try {
  const ruvectorPkg = JSON.parse(fs.readFileSync('./node_modules/ruvector/package.json', 'utf8'));
  const corePkg = JSON.parse(fs.readFileSync('./node_modules/ruvector-core/package.json', 'utf8'));
  const platformPkg = JSON.parse(fs.readFileSync('./node_modules/ruvector-core-linux-x64-gnu/package.json', 'utf8'));

  console.log(`ruvector: ${ruvectorPkg.version}`);
  console.log(`ruvector-core: ${corePkg.version}`);
  console.log(`ruvector-core-linux-x64-gnu: ${platformPkg.version}`);
} catch (e) {
  console.log('❌ Error reading package versions:', e.message);
}

console.log();
console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log();
console.log('Expected Fixes in v0.1.5:');
console.log('  1. ✅ ruvector package: @ruvector/core → ruvector-core');
console.log('  2. ❓ ruvector-core package: @ruvector/core-* → ruvector-core-*');
console.log('  3. ❓ CLI commands working');
console.log();
console.log('Recommendation:');
console.log('  If ruvector-core is still at v0.1.1 with @ruvector/* references,');
console.log('  it needs to be updated and republished as v0.1.2+');
console.log();
console.log('='.repeat(70));
