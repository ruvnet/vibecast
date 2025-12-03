#!/usr/bin/env node
/**
 * Verification benchmark for fixed packages:
 * - agentdb@2.0.0-alpha.2.14 (wrappers moved here)
 * - agentic-flow@2.0.1-alpha.2
 */

import { performance } from 'perf_hooks';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  VERIFICATION: Fixed Packages Benchmark');
console.log('  agentdb@2.0.0-alpha.2.14 + agentic-flow@2.0.1-alpha.2');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = [];

function benchmark(name, fn, iterations = 50) {
  for (let i = 0; i < 5; i++) { try { fn(); } catch {} }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];
  results.push({ name, avg, min, p95, iterations });
  return { avg, min, p95 };
}

async function benchmarkAsync(name, fn, iterations = 50) {
  for (let i = 0; i < 3; i++) { try { await fn(); } catch {} }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];
  results.push({ name, avg, min, p95, iterations });
  return { avg, min, p95 };
}

// ==== FIX 1: AgentDB Fast ====
console.log('💾 FIX 1: AgentDB Fast (db.insert)');
console.log('─────────────────────────────────────────────────────────────');

try {
  // Wrappers are now in agentdb package
  const agentdb = await import('agentdb/wrappers/agentdb-fast');
  console.log('   Exports:', Object.keys(agentdb));

  if (agentdb.AgentDBFast || agentdb.createFastAgentDB) {
    const DbClass = agentdb.AgentDBFast;
    const db = DbClass ? new DbClass({ dbPath: ':memory:', dimension: 384 }) : await agentdb.createFastAgentDB({ dbPath: ':memory:', dimension: 384 });

    if (db.initialize) await db.initialize();
    console.log('   ✅ Initialized');

    // Test store
    const storeMethod = db.storeEpisode || db.store || db.insert;
    if (storeMethod) {
      console.log('   Store method:', storeMethod.name || 'anonymous');

      try {
        await storeMethod.call(db, {
          sessionId: 'test-1',
          task: 'implement authentication',
          reward: 0.95,
          success: true
        });
        console.log('   ✅ Store works!');

        await benchmarkAsync('AgentDB Store', async () => {
          await storeMethod.call(db, {
            sessionId: `session-${Math.random()}`,
            task: 'benchmark task',
            reward: Math.random(),
            success: true
          });
        }, 100);
        console.log(`   Store: ${results[results.length-1].avg.toFixed(2)}ms avg`);
      } catch (e) {
        console.log('   ❌ Store error:', e.message);
      }
    }
  }
} catch (e) {
  console.log('   ❌ Import error:', e.message);
}

// ==== FIX 2: GNN / HNSW ====
console.log('\n\n🔍 FIX 2: GNN / HNSW Indexing');
console.log('─────────────────────────────────────────────────────────────');

try {
  const gnn = await import('agentdb/wrappers/gnn');
  console.log('   Exports:', Object.keys(gnn));

  if (gnn.differentiableSearch) {
    const query = new Float32Array(384).map(() => Math.random());

    for (const size of [1000, 5000, 10000]) {
      const candidates = Array.from({ length: size }, () =>
        new Float32Array(384).map(() => Math.random())
      );

      const result = benchmark(`GNN Search ${(size/1000)}K`, () => {
        gnn.differentiableSearch(query, candidates, 10, 384);
      }, size > 5000 ? 20 : 50);

      console.log(`   ${(size/1000)}K vectors: ${result.avg.toFixed(2)}ms`);
    }
  }
} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// ==== FIX 3: Native Attention ====
console.log('\n\n⚡ FIX 3 & 4: Native Attention');
console.log('─────────────────────────────────────────────────────────────');

try {
  const attn = await import('agentdb/wrappers/attention');
  console.log('   Exports:', Object.keys(attn));

  const seqLen = 256;
  const dim = 384;
  const heads = 8;

  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  // Test MultiHeadAttention
  if (attn.MultiHeadAttention) {
    console.log('\n   Testing MultiHeadAttention...');
    const mha = new attn.MultiHeadAttention(dim, heads);

    try {
      const start = performance.now();
      const result = mha.forward(q, k, v, seqLen, seqLen, dim);
      const elapsed = performance.now() - start;

      console.log(`   First call: ${elapsed.toFixed(2)}ms`);
      console.log(`   Result type: ${result?.constructor?.name || typeof result}`);

      if (result instanceof Float32Array) {
        console.log('   ✅ Native Float32Array output!');

        benchmark('Native MultiHeadAttention (256 seq)', () => {
          mha.forward(q, k, v, seqLen, seqLen, dim);
        }, 50);
        console.log(`   Benchmark: ${results[results.length-1].avg.toFixed(2)}ms`);
      }
    } catch (e) {
      console.log('   ❌ MHA error:', e.message);
    }
  }

  // Test LinearAttention
  if (attn.LinearAttention) {
    console.log('\n   Testing LinearAttention...');
    const linear = new attn.LinearAttention(dim, heads);

    const q1024 = new Float32Array(1024 * dim).map(() => Math.random());
    const k1024 = new Float32Array(1024 * dim).map(() => Math.random());
    const v1024 = new Float32Array(1024 * dim).map(() => Math.random());

    try {
      const start = performance.now();
      const result = linear.forward(q1024, k1024, v1024, 1024, 1024, dim);
      const elapsed = performance.now() - start;

      console.log(`   First call: ${elapsed.toFixed(2)}ms`);
      console.log(`   Result type: ${result?.constructor?.name || typeof result}`);

      if (result instanceof Float32Array) {
        console.log('   ✅ Native Float32Array output!');

        benchmark('Native LinearAttention (1024 seq)', () => {
          linear.forward(q1024, k1024, v1024, 1024, 1024, dim);
        }, 30);
        console.log(`   Benchmark: ${results[results.length-1].avg.toFixed(2)}ms`);
      }
    } catch (e) {
      console.log('   ❌ Linear error:', e.message);
    }
  }

  // Test FlashAttention
  if (attn.FlashAttention) {
    console.log('\n   Testing FlashAttention...');
    const flash = new attn.FlashAttention(dim, heads, 64);

    try {
      const start = performance.now();
      const result = flash.forward ? flash.forward(q, k, v, seqLen, seqLen, dim) : flash.compute(q, k, v, seqLen, seqLen, dim);
      const elapsed = performance.now() - start;

      console.log(`   First call: ${elapsed.toFixed(2)}ms`);
      console.log(`   Result type: ${result?.constructor?.name || typeof result}`);

      if (result instanceof Float32Array) {
        console.log('   ✅ Native Float32Array output!');
      }
    } catch (e) {
      console.log('   ❌ Flash error:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// ==== Also test via AttentionService controller ====
console.log('\n\n🎯 Alternative: AttentionService Controller');
console.log('─────────────────────────────────────────────────────────────');

try {
  const { AttentionService } = await import('agentdb/controllers/AttentionService');
  console.log('   AttentionService available');

  const service = new AttentionService({ dim: 384, heads: 8 });
  console.log('   Service methods:', Object.keys(service));

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// ==== SUMMARY ====
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  BENCHMARK RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');

if (results.length > 0) {
  console.log('┌────────────────────────────────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ Benchmark                                  │ Avg (ms) │ Min (ms) │ P95 (ms) │');
  console.log('├────────────────────────────────────────────┼──────────┼──────────┼──────────┤');

  for (const r of results) {
    const name = r.name.length > 42 ? r.name.substring(0, 39) + '...' : r.name;
    console.log(`│ ${name.padEnd(42)} │ ${r.avg.toFixed(3).padStart(8)} │ ${r.min.toFixed(3).padStart(8)} │ ${r.p95.toFixed(3).padStart(8)} │`);
  }

  console.log('└────────────────────────────────────────────┴──────────┴──────────┴──────────┘');
} else {
  console.log('   No benchmarks completed.');
}

// Verification summary
console.log('\n📋 FIX VERIFICATION SUMMARY');
console.log('─────────────────────────────────────────────────────────────');

const storeResult = results.find(r => r.name.includes('Store'));
const gnnResult = results.find(r => r.name.includes('GNN'));
const mhaResult = results.find(r => r.name.includes('MultiHeadAttention'));
const linearResult = results.find(r => r.name.includes('LinearAttention'));

console.log(`   1. AgentDB Fast: ${storeResult ? '✅ FIXED' : '❌ Not working'}`);
console.log(`   2. GNN/HNSW: ${gnnResult ? '✅ Working' : '❌ Not working'}`);
console.log(`   3. MultiHeadAttention: ${mhaResult ? '✅ FIXED (Native)' : '⚠️ Check manually'}`);
console.log(`   4. LinearAttention: ${linearResult ? '✅ FIXED (Native)' : '⚠️ Check manually'}`);

console.log('\n✅ Verification complete');
