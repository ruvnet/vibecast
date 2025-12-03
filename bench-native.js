#!/usr/bin/env node
import { performance } from 'perf_hooks';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  NATIVE MODULE BENCHMARK');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test attention module
console.log('⚡ Testing @ruvector/attention...');
try {
  const attn = await import('@ruvector/attention');
  console.log('✅ Loaded');
  console.log('   Features:', attn.info().features);

  // Using Float32Array (type code 4)
  const seqLen = 256;
  const dim = 384;

  console.log('\n   Testing with Float32Array...');
  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  const dpa = new attn.DotProductAttention(dim);

  try {
    const start = performance.now();
    const result = dpa.compute(q, k, v, seqLen, seqLen, dim);
    const elapsed = performance.now() - start;
    console.log(`   ✅ DotProductAttention: ${elapsed.toFixed(3)}ms`);
    console.log(`   Output length: ${result?.length || 'N/A'}`);

    // Benchmark 50 iterations
    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      dpa.compute(q, k, v, seqLen, seqLen, dim);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   📊 50 runs: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ DotProductAttention error:', e.message);
  }

  // Test MultiHeadAttention
  console.log('\n   Testing MultiHeadAttention...');
  try {
    const mha = new attn.MultiHeadAttention(dim, 8);
    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      mha.compute(q, k, v, seqLen, seqLen, dim);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ MultiHeadAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ MultiHeadAttention error:', e.message);
  }

  // Test FlashAttention
  console.log('\n   Testing FlashAttention...');
  try {
    const flash = new attn.FlashAttention(dim, 8, 64);
    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      flash.compute(q, k, v, seqLen, seqLen, dim);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ FlashAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ FlashAttention error:', e.message);
  }

  // Test LinearAttention with longer sequence
  console.log('\n   Testing LinearAttention (1024 seq)...');
  try {
    const linear = new attn.LinearAttention(dim, 8);
    const q1024 = new Float32Array(1024 * dim).map(() => Math.random());
    const k1024 = new Float32Array(1024 * dim).map(() => Math.random());
    const v1024 = new Float32Array(1024 * dim).map(() => Math.random());

    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      linear.compute(q1024, k1024, v1024, 1024, 1024, dim);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ LinearAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ LinearAttention error:', e.message);
  }

  // Test HyperbolicAttention
  console.log('\n   Testing HyperbolicAttention...');
  try {
    const hyper = new attn.HyperbolicAttention(256, 4, 1.0);
    const qh = new Float32Array(128 * 256).map(() => Math.random() * 0.1);
    const kh = new Float32Array(128 * 256).map(() => Math.random() * 0.1);
    const vh = new Float32Array(128 * 256).map(() => Math.random() * 0.1);

    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      hyper.compute(qh, kh, vh, 128, 128, 256);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ HyperbolicAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ HyperbolicAttention error:', e.message);
  }

  // Test MoE Attention
  console.log('\n   Testing MoE Attention...');
  try {
    const moe = new attn.MoEAttention(256, 4, 8);
    const qm = new Float32Array(128 * 256).map(() => Math.random());
    const km = new Float32Array(128 * 256).map(() => Math.random());
    const vm = new Float32Array(128 * 256).map(() => Math.random());

    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      moe.compute(qm, km, vm, 128, 128, 256);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ MoE Attention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ MoE Attention error:', e.message);
  }

  // Test LocalGlobalAttention
  console.log('\n   Testing LocalGlobalAttention...');
  try {
    const lg = new attn.LocalGlobalAttention(dim, 8, 64, 4);
    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      lg.compute(q, k, v, seqLen, seqLen, dim);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ LocalGlobalAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ LocalGlobalAttention error:', e.message);
  }

  // Test DualSpaceAttention
  console.log('\n   Testing DualSpaceAttention...');
  try {
    const dual = new attn.DualSpaceAttention(256, 4, 1.0);
    const qd = new Float32Array(128 * 256).map(() => Math.random() * 0.1);
    const kd = new Float32Array(128 * 256).map(() => Math.random() * 0.1);
    const vd = new Float32Array(128 * 256).map(() => Math.random() * 0.1);

    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      dual.compute(qd, kd, vd, 128, 128, 256);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ DualSpaceAttention: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ DualSpaceAttention error:', e.message);
  }

  // Test async functions
  console.log('\n   Testing Async Flash Attention...');
  try {
    const times = [];
    for (let i = 0; i < 20; i++) {
      const s = performance.now();
      await attn.computeFlashAttentionAsync(q, k, v, seqLen, dim, 8);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`   ✅ Async FlashAttention: Avg=${avg.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ Async FlashAttention error:', e.message);
  }

  // Built-in benchmark (fix params)
  console.log('\n   Running built-in benchmark...');
  try {
    const result = attn.benchmarkAttention('flash', 256, 384, 8, 50);
    console.log('   Built-in benchmark result:', result);
  } catch (e) {
    console.log('   ❌ Built-in benchmark error:', e.message);
  }

} catch (e) {
  console.log('❌ @ruvector/attention load error:', e.message);
}

// Test GNN module
console.log('\n\n🧠 Testing @ruvector/gnn...');
try {
  const gnn = await import('@ruvector/gnn');
  console.log('✅ Loaded');

  // Test hierarchicalForward with Float32Array
  console.log('\n   Testing hierarchicalForward...');
  try {
    const input = new Float32Array(768).map(() => Math.random());
    const times = [];
    for (let i = 0; i < 100; i++) {
      const s = performance.now();
      gnn.hierarchicalForward(input, 3, 768);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ hierarchicalForward: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ hierarchicalForward error:', e.message);
  }

  // Test differentiableSearch
  console.log('\n   Testing differentiableSearch (1K vectors)...');
  try {
    const query = new Float32Array(384).map(() => Math.random());
    const candidates = [];
    for (let i = 0; i < 1000; i++) {
      candidates.push(new Float32Array(384).map(() => Math.random()));
    }

    const times = [];
    for (let i = 0; i < 20; i++) {
      const s = performance.now();
      gnn.differentiableSearch(query, candidates, 10, 384);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ differentiableSearch: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ differentiableSearch error:', e.message);
  }

  // Test RuvectorLayer with correct params
  console.log('\n   Testing RuvectorLayer...');
  try {
    // RuvectorLayer(inputDim, outputDim, m, efConstruction, dropout=0.0)
    const layer = new gnn.RuvectorLayer(384, 128, 16, 200, 0.0);
    const input = new Float32Array(384).map(() => Math.random());

    const times = [];
    for (let i = 0; i < 100; i++) {
      const s = performance.now();
      layer.forward(input);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ RuvectorLayer: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ RuvectorLayer error:', e.message);
  }

  // Test TensorCompress
  console.log('\n   Testing TensorCompress...');
  try {
    const compressor = new gnn.TensorCompress(6);
    const tensor = new Float32Array(10000).map(() => Math.random());

    const times = [];
    for (let i = 0; i < 50; i++) {
      const s = performance.now();
      compressor.compress(tensor);
      times.push(performance.now() - s);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`   ✅ TensorCompress: Avg=${avg.toFixed(3)}ms Min=${min.toFixed(3)}ms P95=${p95.toFixed(3)}ms`);
  } catch (e) {
    console.log('   ❌ TensorCompress error:', e.message);
  }

} catch (e) {
  console.log('❌ @ruvector/gnn load error:', e.message);
}

console.log('\n✅ Benchmark complete');
