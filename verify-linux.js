/**
 * Linux x64 Verification Test for @ruvector packages v0.1.15
 * Tests core functionality of tiny-dancer and router packages
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║     @ruvector Linux x64 Package Verification Test           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Environment:');
console.log(`  Platform: ${process.platform}-${process.arch}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  Date: ${new Date().toISOString()}\n`);

const results = { passed: [], failed: [] };

function pass(name, detail) {
  results.passed.push(name);
  console.log(`  ✅ ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name, error) {
  results.failed.push({ name, error });
  console.log(`  ❌ ${name}: ${error}`);
}

async function main() {
  // === TINY DANCER TESTS ===
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  @ruvector/tiny-dancer@0.1.15');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const tinyDancer = require('@ruvector/tiny-dancer');
    pass('Module import');

    if (typeof tinyDancer.Router === 'function') pass('Router class');
    else fail('Router class', 'Not a function');

    const ver = tinyDancer.version();
    if (ver === '0.1.15') pass('version()', ver);
    else fail('version()', `Expected 0.1.15, got ${ver}`);

    const hello = tinyDancer.hello();
    if (hello.includes('Tiny Dancer')) pass('hello()');
    else fail('hello()', 'Unexpected response');

  } catch (e) {
    fail('tiny-dancer import', e.message);
  }

  // === ROUTER TESTS ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  @ruvector/router@0.1.15');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const router = require('@ruvector/router');
    pass('Module import');

    if (typeof router.VectorDb === 'function') pass('VectorDb class');
    else fail('VectorDb class', 'Not a function');

    if (router.DistanceMetric.Cosine === 1) pass('DistanceMetric enum');
    else fail('DistanceMetric enum', 'Cosine not 1');

    const storageFile = path.join(os.tmpdir(), `verify-${Date.now()}.db`);
    const db = new router.VectorDb({
      dimensions: 64,
      maxElements: 50,
      storagePath: storageFile
    });
    pass('VectorDb create');

    const vec = new Float32Array(64);
    for (let i = 0; i < 64; i++) vec[i] = Math.sin(i * 0.1);

    const id = await db.insertAsync('test-vec', vec);
    if (id === 'test-vec') pass('insertAsync()');
    else fail('insertAsync()', `Got ${id}`);

    const count = db.count();
    if (count === 1) pass('count()', count);
    else fail('count()', `Expected 1, got ${count}`);

    const searchResults = await db.searchAsync(vec, 5);
    if (searchResults.length > 0 && searchResults[0].id === 'test-vec') {
      pass('searchAsync()', `${searchResults.length} result(s)`);
    } else {
      fail('searchAsync()', 'No valid results');
    }

    const ids = db.getAllIds();
    if (ids.includes('test-vec')) pass('getAllIds()');
    else fail('getAllIds()', 'Missing test-vec');

    // Cleanup storage file
    try { fs.unlinkSync(storageFile); } catch (e) {}

  } catch (e) {
    fail('router test', e.message);
  }

  // === SUMMARY ===
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('                          SUMMARY                             ');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Passed: ${results.passed.length}`);
  console.log(`  Failed: ${results.failed.length}\n`);

  if (results.failed.length > 0) {
    console.log('Failed tests:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    console.log('\n❌ VERIFICATION FAILED\n');
    process.exit(1);
  } else {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  ✅ ALL TESTS PASSED - LINUX x64 VERIFICATION SUCCESSFUL');
    console.log('══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
