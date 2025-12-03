#!/usr/bin/env node
/**
 * Diagnostic: Explain AgentDB and Attention issues
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  DIAGNOSTIC: AgentDB and Attention Issues');
console.log('═══════════════════════════════════════════════════════════════\n');

// ==== AGENTDB DIAGNOSIS ====
console.log('💾 AGENTDB ISSUES');
console.log('─────────────────────────────────────────────────────────────\n');

try {
  const agentdb = await import('agentic-flow/wrappers/agentdb-fast');
  console.log('1. Module exports:', Object.keys(agentdb));

  // Try AgentDBFast class
  console.log('\n2. AgentDBFast class inspection:');
  const db = new agentdb.AgentDBFast({ dbPath: ':memory:', dimension: 384 });
  console.log('   Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(db)));
  console.log('   Instance properties:', Object.keys(db));

  // Check what this.db is
  console.log('\n3. Internal db property:');
  console.log('   typeof db.db:', typeof db.db);
  console.log('   db.db:', db.db);

  // Try to call storeEpisode and see what happens
  console.log('\n4. Attempting storeEpisode:');
  try {
    await db.storeEpisode({
      sessionId: 'test',
      task: 'test task',
      reward: 0.9,
      success: true
    });
  } catch (e) {
    console.log('   Error:', e.message);
    console.log('   Stack trace (relevant part):');
    const lines = e.stack.split('\n').slice(0, 5);
    lines.forEach(l => console.log('   ', l));
  }

  // Check if initialize was called
  console.log('\n5. Checking initialization:');
  console.log('   db.initialized:', db.initialized);

  // Try initializing first
  console.log('\n6. Trying to initialize first:');
  try {
    await db.initialize();
    console.log('   Initialized successfully');
    console.log('   db.db after init:', typeof db.db);

    // Try store again
    await db.storeEpisode({
      sessionId: 'test',
      task: 'test task',
      reward: 0.9,
      success: true
    });
    console.log('   ✅ storeEpisode worked after initialize!');
  } catch (e) {
    console.log('   Initialize error:', e.message);
  }

} catch (e) {
  console.log('AgentDB import error:', e.message);
}

// ==== ATTENTION DIAGNOSIS ====
console.log('\n\n⚡ ATTENTION ISSUES');
console.log('─────────────────────────────────────────────────────────────\n');

try {
  const attn = await import('agentic-flow/wrappers/attention');
  console.log('1. Module exports:', Object.keys(attn));

  // Check native availability
  console.log('\n2. Native attention available:', attn.isNativeAttentionAvailable?.());

  // Inspect MultiHeadAttention
  console.log('\n3. MultiHeadAttention inspection:');
  const mha = new attn.MultiHeadAttention(384, 8);
  console.log('   Instance type:', mha.constructor.name);
  console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(mha)));

  // The forward method exists but what does it do?
  console.log('\n4. Testing forward method:');
  const seqLen = 64;
  const dim = 384;
  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  const start = performance.now();
  const result = mha.forward(q, k, v, seqLen, seqLen, dim);
  const elapsed = performance.now() - start;

  console.log('   Time:', elapsed.toFixed(4), 'ms');
  console.log('   Result type:', typeof result);
  console.log('   Result:', result);

  // 0.003ms is way too fast for real attention - it's likely a no-op or mock
  if (elapsed < 0.1) {
    console.log('\n   ⚠️ DIAGNOSIS: forward() is too fast to be real computation');
    console.log('   This is likely a JavaScript fallback that returns early or mocks the result');
  }

  // Check if there's native attention available
  console.log('\n5. Checking native attention classes:');
  const rawAttn = await import('@ruvector/attention');
  console.log('   Native module info:', rawAttn.info());

  // Try to use native FlashAttention directly
  console.log('\n6. Testing native FlashAttention:');
  try {
    const flash = new rawAttn.FlashAttention(384, 8, 64);
    console.log('   FlashAttention created');
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(flash)));

    // What method does it have?
    if (flash.compute) {
      console.log('   Has compute method');
      try {
        flash.compute(q, k, v, seqLen, seqLen, dim);
        console.log('   ✅ compute() works!');
      } catch (e) {
        console.log('   compute() error:', e.message);
      }
    }
    if (flash.forward) {
      console.log('   Has forward method');
      try {
        flash.forward(q, k, v, seqLen, seqLen, dim);
        console.log('   ✅ forward() works!');
      } catch (e) {
        console.log('   forward() error:', e.message);
      }
    }
  } catch (e) {
    console.log('   Native FlashAttention error:', e.message);
  }

  // Check scaledDotProductAttention which does work
  console.log('\n7. scaledDotProductAttention analysis:');
  const sdpStart = performance.now();
  const sdpResult = attn.scaledDotProductAttention(q, k, v, seqLen, dim);
  const sdpElapsed = performance.now() - sdpStart;
  console.log('   Time:', sdpElapsed.toFixed(2), 'ms');
  console.log('   Result type:', typeof sdpResult);
  console.log('   Result length:', sdpResult?.length);

  if (sdpElapsed > 0.1) {
    console.log('   ✅ This is doing real computation (takes measurable time)');
  }

} catch (e) {
  console.log('Attention error:', e.message);
  console.log(e.stack);
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`
AGENTDB PROBLEM:
----------------
The AgentDBFast class has a method 'storeEpisode' but internally it tries
to call 'this.db.insert()' which doesn't exist. The 'db' property is either:
1. Not initialized (need to call initialize() first)
2. Using a different database API than expected

FIX NEEDED: Call await db.initialize() before using, OR the internal
database wrapper needs to match the expected API.


ATTENTION PROBLEM:
------------------
The wrapper's MultiHeadAttention.forward() method returns in 0.003ms which
is physically impossible for real attention computation on 64x384 matrices.

This means the JS wrapper is:
1. Using a mock/placeholder implementation
2. The native Rust binding isn't being called

The native @ruvector/attention module EXISTS and has FlashAttention,
but the wrapper isn't properly bridging to it.

scaledDotProductAttention DOES work (takes ~1.5ms for 256 seq) because
it's implemented directly in JavaScript, not relying on native bindings.

WHAT WORKS:
-----------
- GNN differentiableSearch (native Rust)
- RuvectorLayer (native Rust via wrapper)
- scaledDotProductAttention (JavaScript implementation)

WHAT DOESN'T:
-------------
- AgentDB (initialization/API mismatch)
- MultiHeadAttention (mock implementation)
- FlashAttention (native binding not connected)
- LinearAttention (array type error)
`);
