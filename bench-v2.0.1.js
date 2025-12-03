#!/usr/bin/env node
/**
 * Benchmark for agentic-flow@2.0.1-alpha
 * Testing new wrapper exports
 */

import { performance } from 'perf_hooks';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AGENTIC-FLOW v2.0.1-alpha BENCHMARK');
console.log('  Testing New Wrapper Exports');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = [];

function benchmark(name, fn, iterations = 50) {
  // Warmup
  for (let i = 0; i < 5; i++) {
    try { fn(); } catch {}
  }

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
  console.log(`   ✅ ${name}`);
  console.log(`      Avg: ${avg.toFixed(3)}ms | Min: ${min.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms`);
  return { avg, min, p95 };
}

async function benchmarkAsync(name, fn, iterations = 50) {
  // Warmup
  for (let i = 0; i < 3; i++) {
    try { await fn(); } catch {}
  }

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
  console.log(`   ✅ ${name}`);
  console.log(`      Avg: ${avg.toFixed(3)}ms | Min: ${min.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms`);
  return { avg, min, p95 };
}

// Test 1: GNN Wrapper
console.log('🧠 TEST 1: GNN Wrapper (agentic-flow/wrappers/gnn)');
console.log('─────────────────────────────────────────────────────────────');
try {
  const gnn = await import('agentic-flow/wrappers/gnn');
  console.log('   ✅ Loaded successfully');
  console.log('   Exports:', Object.keys(gnn));

  if (gnn.differentiableSearch) {
    console.log('\n   Testing differentiableSearch...');

    // 1K vectors
    const query = new Float32Array(384).map(() => Math.random());
    const candidates1k = Array.from({ length: 1000 }, () =>
      new Float32Array(384).map(() => Math.random())
    );

    benchmark('GNN Search (1K vectors, 384d)', () => {
      gnn.differentiableSearch(query, candidates1k, 10, 384);
    });

    // 5K vectors
    const candidates5k = Array.from({ length: 5000 }, () =>
      new Float32Array(384).map(() => Math.random())
    );
    benchmark('GNN Search (5K vectors, 384d)', () => {
      gnn.differentiableSearch(query, candidates5k, 10, 384);
    }, 20);

    // 10K vectors
    const candidates10k = Array.from({ length: 10000 }, () =>
      new Float32Array(384).map(() => Math.random())
    );
    benchmark('GNN Search (10K vectors, 384d)', () => {
      gnn.differentiableSearch(query, candidates10k, 10, 384);
    }, 10);
  }

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// Test 2: Attention Wrapper
console.log('\n\n⚡ TEST 2: Attention Wrapper (agentic-flow/wrappers/attention)');
console.log('─────────────────────────────────────────────────────────────');
try {
  const attention = await import('agentic-flow/wrappers/attention');
  console.log('   ✅ Loaded successfully');
  console.log('   Exports:', Object.keys(attention));

  // Test MultiHeadAttention
  if (attention.MultiHeadAttention) {
    console.log('\n   Testing MultiHeadAttention...');

    const seqLen = 256;
    const dim = 384;
    const heads = 8;

    // Create test data
    const q = new Float32Array(seqLen * dim).map(() => Math.random());
    const k = new Float32Array(seqLen * dim).map(() => Math.random());
    const v = new Float32Array(seqLen * dim).map(() => Math.random());

    try {
      const mha = new attention.MultiHeadAttention(dim, heads);
      benchmark('MultiHeadAttention (256 seq, 384d, 8 heads)', () => {
        mha.compute(q, k, v, seqLen, seqLen, dim);
      });
    } catch (e) {
      console.log('   ❌ MultiHeadAttention error:', e.message);
    }
  }

  // Test FlashAttention
  if (attention.FlashAttention) {
    console.log('\n   Testing FlashAttention...');

    const seqLen = 512;
    const dim = 384;
    const heads = 8;

    const q = new Float32Array(seqLen * dim).map(() => Math.random());
    const k = new Float32Array(seqLen * dim).map(() => Math.random());
    const v = new Float32Array(seqLen * dim).map(() => Math.random());

    try {
      const flash = new attention.FlashAttention(dim, heads, 64);
      benchmark('FlashAttention (512 seq, 384d, 8 heads)', () => {
        flash.compute(q, k, v, seqLen, seqLen, dim);
      });
    } catch (e) {
      console.log('   ❌ FlashAttention error:', e.message);
    }
  }

  // Test LinearAttention
  if (attention.LinearAttention) {
    console.log('\n   Testing LinearAttention...');

    const seqLen = 1024;
    const dim = 384;
    const heads = 8;

    const q = new Float32Array(seqLen * dim).map(() => Math.random());
    const k = new Float32Array(seqLen * dim).map(() => Math.random());
    const v = new Float32Array(seqLen * dim).map(() => Math.random());

    try {
      const linear = new attention.LinearAttention(dim, heads);
      benchmark('LinearAttention (1024 seq, 384d)', () => {
        linear.compute(q, k, v, seqLen, seqLen, dim);
      });
    } catch (e) {
      console.log('   ❌ LinearAttention error:', e.message);
    }
  }

  // Test DotProductAttention
  if (attention.DotProductAttention) {
    console.log('\n   Testing DotProductAttention...');

    const seqLen = 256;
    const dim = 384;

    const q = new Float32Array(seqLen * dim).map(() => Math.random());
    const k = new Float32Array(seqLen * dim).map(() => Math.random());
    const v = new Float32Array(seqLen * dim).map(() => Math.random());

    try {
      const dpa = new attention.DotProductAttention(dim);
      benchmark('DotProductAttention (256 seq, 384d)', () => {
        dpa.compute(q, k, v, seqLen, seqLen, dim);
      });
    } catch (e) {
      console.log('   ❌ DotProductAttention error:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// Test 3: AgentDB Fast Wrapper
console.log('\n\n💾 TEST 3: AgentDB Fast (agentic-flow/wrappers/agentdb-fast)');
console.log('─────────────────────────────────────────────────────────────');
try {
  const agentdbFast = await import('agentic-flow/wrappers/agentdb-fast');
  console.log('   ✅ Loaded successfully');
  console.log('   Exports:', Object.keys(agentdbFast));

  if (agentdbFast.createFastAgentDB) {
    console.log('\n   Creating FastAgentDB instance...');

    try {
      const db = await agentdbFast.createFastAgentDB({ dbPath: ':memory:', dimension: 384 });
      console.log('   ✅ Instance created');

      // Test store
      console.log('\n   Testing store operations...');
      await benchmarkAsync('AgentDB Store Episode', async () => {
        await db.store({
          sessionId: `session-${Math.random()}`,
          task: 'implement feature',
          reward: Math.random(),
          success: Math.random() > 0.3,
          critique: 'Test benchmark critique'
        });
      }, 100);

      // Store more for retrieval test
      console.log('   Storing 500 episodes for retrieval test...');
      for (let i = 0; i < 500; i++) {
        await db.store({
          sessionId: `session-${i}`,
          task: `task type ${i % 20}`,
          reward: Math.random(),
          success: Math.random() > 0.3
        });
      }

      // Test retrieve
      console.log('\n   Testing retrieve operations...');
      await benchmarkAsync('AgentDB Retrieve (k=10, 500 eps)', async () => {
        await db.retrieve('implement feature', { k: 10 });
      }, 50);

    } catch (e) {
      console.log('   ❌ FastAgentDB error:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// Test 4: Embedding Wrapper
console.log('\n\n🔤 TEST 4: Embedding Service (agentic-flow/wrappers/embedding)');
console.log('─────────────────────────────────────────────────────────────');
try {
  const embedding = await import('agentic-flow/wrappers/embedding');
  console.log('   ✅ Loaded successfully');
  console.log('   Exports:', Object.keys(embedding));

  if (embedding.createEmbeddingService) {
    console.log('\n   Creating embedding service...');

    try {
      const embedder = await embedding.createEmbeddingService({ dimension: 384 });
      console.log('   ✅ Service created');

      // Test embedding
      console.log('\n   Testing text embedding...');
      await benchmarkAsync('Text Embedding (short)', async () => {
        await embedder.embed('implement user authentication with OAuth2');
      }, 20);

      await benchmarkAsync('Text Embedding (longer)', async () => {
        await embedder.embed('Create a comprehensive user authentication system that supports OAuth2, JWT tokens, password reset functionality, and multi-factor authentication with SMS and email verification');
      }, 20);

    } catch (e) {
      console.log('   ❌ EmbeddingService error:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ Error:', e.message);
}

// Summary
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  BENCHMARK SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

if (results.length > 0) {
  console.log('┌────────────────────────────────────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ Benchmark                                      │ Avg (ms) │ Min (ms) │ P95 (ms) │');
  console.log('├────────────────────────────────────────────────┼──────────┼──────────┼──────────┤');
  for (const r of results) {
    const name = r.name.length > 46 ? r.name.substring(0, 43) + '...' : r.name;
    console.log(`│ ${name.padEnd(46)} │ ${r.avg.toFixed(3).padStart(8)} │ ${r.min.toFixed(3).padStart(8)} │ ${r.p95.toFixed(3).padStart(8)} │`);
  }
  console.log('└────────────────────────────────────────────────┴──────────┴──────────┴──────────┘');

  // Performance analysis
  console.log('\n📈 PERFORMANCE vs CLAIMED BENCHMARKS');
  console.log('─────────────────────────────────────────────────────────────');

  const flashResult = results.find(r => r.name.includes('FlashAttention'));
  const dpaResult = results.find(r => r.name.includes('DotProduct'));
  if (flashResult && dpaResult) {
    const speedup = dpaResult.avg / flashResult.avg;
    console.log(`   FlashAttention vs DotProduct: ${speedup.toFixed(2)}x speedup`);
    console.log(`   Claimed: 4.51x | Actual: ${speedup.toFixed(2)}x`);
  }

  const storeResult = results.find(r => r.name.includes('Store'));
  if (storeResult) {
    const target = 1500; // 1.5s target from gist
    const speedup = target / storeResult.avg;
    console.log(`   Episode Store vs 1.5s target: ${speedup.toFixed(1)}x faster`);
    console.log(`   Claimed: Target 1.5s | Actual: ${storeResult.avg.toFixed(1)}ms`);
  }

  const searchResult = results.find(r => r.name.includes('GNN Search') && r.name.includes('1K'));
  if (searchResult) {
    const sqliteBaseline = 50; // Typical SQLite baseline
    const speedup = sqliteBaseline / searchResult.avg;
    console.log(`   GNN Search vs SQLite baseline: ${speedup.toFixed(1)}x faster`);
  }
}

console.log('\n✅ Benchmark complete');
