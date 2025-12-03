#!/usr/bin/env node
/**
 * Benchmark for agentic-flow@2.0.1-alpha - Correct API usage
 */

import { performance } from 'perf_hooks';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AGENTIC-FLOW v2.0.1-alpha BENCHMARK (Fixed APIs)');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = [];

function addResult(name, avg, min, p95) {
  results.push({ name, avg, min, p95 });
  console.log(`   ✅ ${name}`);
  console.log(`      Avg: ${avg.toFixed(3)}ms | Min: ${min.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms`);
}

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
  addResult(name, avg, min, p95);
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
  addResult(name, avg, min, p95);
  return { avg, min, p95 };
}

// Test 1: GNN Wrapper
console.log('🧠 TEST 1: GNN Wrapper');
console.log('─────────────────────────────────────────────────────────────');
try {
  const gnn = await import('agentic-flow/wrappers/gnn');
  console.log('   Exports:', Object.keys(gnn));

  // Test differentiableSearch - this worked before
  const query = new Float32Array(384).map(() => Math.random());
  const candidates1k = Array.from({ length: 1000 }, () =>
    new Float32Array(384).map(() => Math.random())
  );

  benchmark('GNN differentiableSearch (1K)', () => {
    gnn.differentiableSearch(query, candidates1k, 10, 384);
  });

  // Test hierarchicalForward
  console.log('\n   Testing hierarchicalForward...');
  try {
    const input = new Float32Array(768).map(() => Math.random());
    benchmark('GNN hierarchicalForward (768d)', () => {
      gnn.hierarchicalForward(input, 3, 768);
    }, 100);
  } catch (e) {
    console.log('   ❌ hierarchicalForward:', e.message);
  }

  // Test RuvectorLayer
  console.log('\n   Testing RuvectorLayer...');
  try {
    const layer = new gnn.RuvectorLayer(384, 128, 16, 200, 0.1);
    const input = new Float32Array(384).map(() => Math.random());
    benchmark('GNN RuvectorLayer Forward', () => {
      layer.forward(input);
    }, 100);
  } catch (e) {
    console.log('   ❌ RuvectorLayer:', e.message);
  }

} catch (e) {
  console.log('   ❌ GNN Error:', e.message);
}

// Test 2: Attention - Check correct method names
console.log('\n\n⚡ TEST 2: Attention Wrapper');
console.log('─────────────────────────────────────────────────────────────');
try {
  const attn = await import('agentic-flow/wrappers/attention');
  console.log('   Exports:', Object.keys(attn));

  // Check if scaledDotProductAttention function exists
  if (attn.scaledDotProductAttention) {
    console.log('\n   Testing scaledDotProductAttention function...');
    const seqLen = 256;
    const dim = 384;
    const q = new Float32Array(seqLen * dim).map(() => Math.random());
    const k = new Float32Array(seqLen * dim).map(() => Math.random());
    const v = new Float32Array(seqLen * dim).map(() => Math.random());

    try {
      benchmark('scaledDotProductAttention (256 seq)', () => {
        attn.scaledDotProductAttention(q, k, v, seqLen, dim);
      });
    } catch (e) {
      console.log('   ❌ scaledDotProductAttention:', e.message);
    }
  }

  // Check createAttention factory
  if (attn.createAttention) {
    console.log('\n   Testing createAttention factory...');
    try {
      const attention = attn.createAttention('multihead', { dim: 384, heads: 8 });
      console.log('   Created attention:', typeof attention);
      console.log('   Methods:', Object.keys(attention));

      const seqLen = 256;
      const dim = 384;
      const q = new Float32Array(seqLen * dim).map(() => Math.random());
      const k = new Float32Array(seqLen * dim).map(() => Math.random());
      const v = new Float32Array(seqLen * dim).map(() => Math.random());

      // Try different method names
      const methods = ['compute', 'forward', 'call', 'run', 'apply'];
      for (const method of methods) {
        if (typeof attention[method] === 'function') {
          console.log(`   Found method: ${method}`);
          benchmark(`Attention.${method} (256 seq)`, () => {
            attention[method](q, k, v, seqLen, seqLen, dim);
          });
          break;
        }
      }
    } catch (e) {
      console.log('   ❌ createAttention:', e.message);
    }
  }

  // Check MultiHeadAttention class instance methods
  if (attn.MultiHeadAttention) {
    console.log('\n   Inspecting MultiHeadAttention...');
    const mha = new attn.MultiHeadAttention(384, 8);
    console.log('   Instance type:', typeof mha);
    console.log('   Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(mha)));
    console.log('   Instance keys:', Object.keys(mha));

    // Try all possible methods
    const methods = ['compute', 'forward', 'call', 'run', 'apply', 'attention', 'process'];
    for (const method of methods) {
      if (typeof mha[method] === 'function') {
        console.log(`   Found method: ${method}`);
      }
    }
  }

} catch (e) {
  console.log('   ❌ Attention Error:', e.message);
}

// Test 3: AgentDB Fast - Check correct methods
console.log('\n\n💾 TEST 3: AgentDB Fast Wrapper');
console.log('─────────────────────────────────────────────────────────────');
try {
  const agentdb = await import('agentic-flow/wrappers/agentdb-fast');
  console.log('   Exports:', Object.keys(agentdb));

  // Try AgentDBFast class directly
  if (agentdb.AgentDBFast) {
    console.log('\n   Testing AgentDBFast class...');
    const db = new agentdb.AgentDBFast({ dbPath: ':memory:', dimension: 384 });
    console.log('   Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(db)));

    // Try various method names
    const storeMethods = ['store', 'storeEpisode', 'add', 'insert', 'save'];
    for (const method of storeMethods) {
      if (typeof db[method] === 'function') {
        console.log(`   Found store method: ${method}`);

        try {
          await benchmarkAsync(`AgentDB ${method}`, async () => {
            await db[method]({
              sessionId: `session-${Math.random()}`,
              task: 'benchmark task',
              reward: 0.9,
              success: true
            });
          }, 100);
        } catch (e) {
          console.log(`   ❌ ${method} error:`, e.message);
        }
        break;
      }
    }
  }

  // Try createFastAgentDB factory
  if (agentdb.createFastAgentDB) {
    console.log('\n   Testing createFastAgentDB factory...');
    try {
      const db = await agentdb.createFastAgentDB({ dbPath: ':memory:', dimension: 384 });
      console.log('   Factory result type:', typeof db);
      console.log('   Factory result methods:', Object.keys(db));
    } catch (e) {
      console.log('   ❌ createFastAgentDB:', e.message);
    }
  }

  // Try benchmarkAgentDB if available
  if (agentdb.benchmarkAgentDB) {
    console.log('\n   Running built-in benchmark...');
    try {
      const result = await agentdb.benchmarkAgentDB({ iterations: 50 });
      console.log('   Built-in benchmark result:', result);
    } catch (e) {
      console.log('   ❌ benchmarkAgentDB:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ AgentDB Error:', e.message);
}

// Test 4: Direct module test
console.log('\n\n🔬 TEST 4: Direct Module Import');
console.log('─────────────────────────────────────────────────────────────');
try {
  // Try importing the raw attention module
  const rawAttn = await import('@ruvector/attention');
  console.log('   @ruvector/attention info:', rawAttn.info());

  // Check if there's a benchmarkAttention function
  if (rawAttn.benchmarkAttention) {
    console.log('\n   Running native attention benchmark...');
    try {
      // Try various parameter orders
      const result = rawAttn.benchmarkAttention('MultiHead', 256, 384, 8, 50);
      console.log('   Native benchmark result:', result);
    } catch (e) {
      console.log('   ❌ benchmarkAttention:', e.message);
    }
  }

} catch (e) {
  console.log('   ❌ Direct module error:', e.message);
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
} else {
  console.log('   No successful benchmarks recorded.');
}

console.log('\n✅ Benchmark complete');
