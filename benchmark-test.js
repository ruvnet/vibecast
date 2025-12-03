#!/usr/bin/env node
/**
 * Custom benchmark for agentic-flow@2.0.0-alpha
 * Tests actual available APIs from RuVector GNN and Attention
 */

import { performance } from 'perf_hooks';

function benchmark(name, fn, iterations = 100) {
  for (let i = 0; i < 5; i++) fn(); // Warmup
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];
  return { name, avg, min, max, p95, iterations };
}

async function benchmarkAsync(name, fn, iterations = 100) {
  for (let i = 0; i < 3; i++) await fn(); // Warmup
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];
  return { name, avg, min, max, p95, iterations };
}

function printResult(result) {
  console.log(`\n📊 ${result.name}`);
  console.log(`   Avg: ${result.avg.toFixed(3)}ms | Min: ${result.min.toFixed(3)}ms | P95: ${result.p95.toFixed(3)}ms`);
}

// Generate random array (not typed array)
function randomArray(size) {
  return Array.from({ length: size }, () => Math.random());
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AGENTIC-FLOW v2.0.0-alpha BENCHMARK SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];

  // Test 1: RuVector Attention (using correct API with regular arrays)
  console.log('\n⚡ TEST 1: RuVector Attention Mechanisms');
  console.log('─────────────────────────────────────────────────────────────');
  try {
    const attn = await import('@ruvector/attention');
    console.log('✅ @ruvector/attention loaded');
    console.log('   Info:', attn.info());

    // Test DotProductAttention class with regular arrays
    if (attn.DotProductAttention) {
      console.log('\n   Testing DotProductAttention...');
      const dpa = new attn.DotProductAttention(384);

      const seqLen = 512;
      const dim = 384;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const dpaResult = benchmark('DotProductAttention (512 seq, 384d)', () => {
        dpa.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(dpaResult);
      results.push(dpaResult);
    }

    // Test MultiHeadAttention class
    if (attn.MultiHeadAttention) {
      console.log('\n   Testing MultiHeadAttention...');
      const mha = new attn.MultiHeadAttention(384, 8);

      const seqLen = 256;
      const dim = 384;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const mhaResult = benchmark('MultiHeadAttention (256 seq, 384d, 8 heads)', () => {
        mha.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(mhaResult);
      results.push(mhaResult);
    }

    // Test FlashAttention class
    if (attn.FlashAttention) {
      console.log('\n   Testing FlashAttention...');
      const flash = new attn.FlashAttention(384, 8, 64);

      const seqLen = 512;
      const dim = 384;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const flashResult = benchmark('FlashAttention (512 seq, 384d, 8 heads)', () => {
        flash.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(flashResult);
      results.push(flashResult);

      // Speedup calculation vs typical naive attention
      const typicalBaseline = 50; // ms for standard attention at this size
      console.log(`   📈 Estimated speedup vs naive: ${(typicalBaseline / flashResult.avg).toFixed(2)}x`);
    }

    // Test LinearAttention
    if (attn.LinearAttention) {
      console.log('\n   Testing LinearAttention (O(n) complexity)...');
      const linear = new attn.LinearAttention(384, 8);

      const seqLen = 1024;
      const dim = 384;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const linearResult = benchmark('LinearAttention (1024 seq, 384d)', () => {
        linear.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(linearResult);
      results.push(linearResult);
    }

    // Test HyperbolicAttention
    if (attn.HyperbolicAttention) {
      console.log('\n   Testing HyperbolicAttention...');
      const hyper = new attn.HyperbolicAttention(256, 4, 1.0);

      const seqLen = 128;
      const dim = 256;
      const q = randomArray(seqLen * dim).map(x => x * 0.1);
      const k = randomArray(seqLen * dim).map(x => x * 0.1);
      const v = randomArray(seqLen * dim).map(x => x * 0.1);

      const hyperResult = benchmark('HyperbolicAttention (128 seq, 256d)', () => {
        hyper.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(hyperResult);
      results.push(hyperResult);
    }

    // Test MoEAttention
    if (attn.MoEAttention) {
      console.log('\n   Testing MoE Attention...');
      const moe = new attn.MoEAttention(256, 4, 8);

      const seqLen = 128;
      const dim = 256;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const moeResult = benchmark('MoE Attention (128 seq, 8 experts)', () => {
        moe.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(moeResult);
      results.push(moeResult);
    }

    // Test LocalGlobalAttention
    if (attn.LocalGlobalAttention) {
      console.log('\n   Testing LocalGlobalAttention...');
      const lg = new attn.LocalGlobalAttention(384, 8, 64, 4);

      const seqLen = 512;
      const dim = 384;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const lgResult = benchmark('LocalGlobalAttention (512 seq)', () => {
        lg.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(lgResult);
      results.push(lgResult);
    }

    // Test DualSpaceAttention
    if (attn.DualSpaceAttention) {
      console.log('\n   Testing DualSpaceAttention...');
      const dual = new attn.DualSpaceAttention(256, 4, 1.0);

      const seqLen = 128;
      const dim = 256;
      const q = randomArray(seqLen * dim).map(x => x * 0.1);
      const k = randomArray(seqLen * dim).map(x => x * 0.1);
      const v = randomArray(seqLen * dim).map(x => x * 0.1);

      const dualResult = benchmark('DualSpaceAttention (128 seq)', () => {
        dual.compute(q, k, v, seqLen, seqLen, dim);
      }, 100);
      printResult(dualResult);
      results.push(dualResult);
    }

    // Test async compute functions
    if (attn.computeFlashAttentionAsync) {
      console.log('\n   Testing Async Flash Attention...');
      const seqLen = 512;
      const dim = 384;
      const heads = 8;
      const q = randomArray(seqLen * dim);
      const k = randomArray(seqLen * dim);
      const v = randomArray(seqLen * dim);

      const asyncResult = await benchmarkAsync('Async FlashAttention (512 seq)', async () => {
        await attn.computeFlashAttentionAsync(q, k, v, seqLen, dim, heads);
      }, 50);
      printResult(asyncResult);
      results.push(asyncResult);
    }

    // Run built-in benchmark
    if (attn.benchmarkAttention) {
      console.log('\n   Running built-in benchmark...');
      try {
        const builtIn = attn.benchmarkAttention(256, 384, 8, 100);
        console.log('   Built-in results:', builtIn);
      } catch (e) {
        console.log('   Built-in benchmark error:', e.message);
      }
    }

  } catch (e) {
    console.log('❌ @ruvector/attention error:', e.message);
  }

  // Test 2: RuVector GNN
  console.log('\n\n🧠 TEST 2: RuVector GNN');
  console.log('─────────────────────────────────────────────────────────────');
  try {
    const gnn = await import('@ruvector/gnn');
    console.log('✅ @ruvector/gnn loaded');
    console.log('   Exports:', Object.keys(gnn));

    // Test hierarchicalForward with regular arrays
    if (gnn.hierarchicalForward) {
      console.log('\n   Testing hierarchicalForward...');
      const input = randomArray(768);

      const hierResult = benchmark('Hierarchical Forward (768d)', () => {
        gnn.hierarchicalForward(input, 3, 768);
      }, 500);
      printResult(hierResult);
      results.push(hierResult);
    }

    // Test differentiableSearch
    if (gnn.differentiableSearch) {
      console.log('\n   Testing differentiableSearch...');
      const query = randomArray(384);
      const candidates = [];
      for (let i = 0; i < 1000; i++) {
        candidates.push(randomArray(384));
      }

      const searchResult = benchmark('Differentiable Search (1K vectors)', () => {
        gnn.differentiableSearch(query, candidates, 10, 384);
      }, 50);
      printResult(searchResult);
      results.push(searchResult);
    }

    // Test TensorCompress
    if (gnn.TensorCompress) {
      console.log('\n   Testing TensorCompress...');
      try {
        const level = gnn.getCompressionLevel ? gnn.getCompressionLevel() : 6;
        const compressor = new gnn.TensorCompress(level);
        const tensor = randomArray(10000);

        const compressResult = benchmark('Tensor Compress (10K floats)', () => {
          compressor.compress(tensor);
        }, 100);
        printResult(compressResult);
        results.push(compressResult);
      } catch (e) {
        console.log('   TensorCompress error:', e.message);
      }
    }

    // Test RuvectorLayer
    if (gnn.RuvectorLayer) {
      console.log('\n   Testing RuvectorLayer...');
      try {
        const layer = new gnn.RuvectorLayer(384, 128, 16, 200);
        const input = randomArray(384);

        const layerResult = benchmark('RuvectorLayer Forward (384→128)', () => {
          layer.forward(input);
        }, 500);
        printResult(layerResult);
        results.push(layerResult);
      } catch (e) {
        console.log('   RuvectorLayer error:', e.message);
      }
    }

  } catch (e) {
    console.log('❌ @ruvector/gnn error:', e.message);
  }

  // Test 3: AgentDB via CLI (more reliable)
  console.log('\n\n💾 TEST 3: AgentDB CLI Operations');
  console.log('─────────────────────────────────────────────────────────────');
  try {
    const { execSync } = await import('child_process');

    // Test reflexion store via CLI
    console.log('   Testing reflexion store via CLI...');
    const storeStart = performance.now();
    for (let i = 0; i < 20; i++) {
      execSync(`npx agentdb reflexion store "session-${i}" "benchmark task ${i}" ${Math.random().toFixed(2)} ${Math.random() > 0.3 ? 'true' : 'false'} "Test critique"`, { stdio: 'pipe' });
    }
    const storeTime = (performance.now() - storeStart) / 20;
    console.log(`\n📊 Episode Store (CLI)`);
    console.log(`   Avg: ${storeTime.toFixed(3)}ms per operation`);
    results.push({ name: 'Episode Store (CLI)', avg: storeTime, min: storeTime, p95: storeTime, iterations: 20 });

    // Test reflexion retrieve via CLI
    console.log('\n   Testing reflexion retrieve via CLI...');
    const retrieveStart = performance.now();
    for (let i = 0; i < 10; i++) {
      execSync(`npx agentdb reflexion retrieve "benchmark task" --k 5`, { stdio: 'pipe' });
    }
    const retrieveTime = (performance.now() - retrieveStart) / 10;
    console.log(`\n📊 Episode Retrieve (CLI)`);
    console.log(`   Avg: ${retrieveTime.toFixed(3)}ms per operation`);
    results.push({ name: 'Episode Retrieve (CLI)', avg: retrieveTime, min: retrieveTime, p95: retrieveTime, iterations: 10 });

    // Test db stats
    console.log('\n   Database stats:');
    const stats = execSync('npx agentdb db stats', { encoding: 'utf8' });
    console.log(stats);

  } catch (e) {
    console.log('❌ AgentDB CLI error:', e.message);
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  BENCHMARK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (results.length > 0) {
    console.log('┌─────────────────────────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ Benchmark                                   │ Avg (ms) │ Min (ms) │ P95 (ms) │');
    console.log('├─────────────────────────────────────────────┼──────────┼──────────┼──────────┤');
    for (const r of results) {
      const name = r.name.length > 43 ? r.name.substring(0, 40) + '...' : r.name;
      console.log(`│ ${name.padEnd(43)} │ ${r.avg.toFixed(3).padStart(8)} │ ${r.min.toFixed(3).padStart(8)} │ ${r.p95.toFixed(3).padStart(8)} │`);
    }
    console.log('└─────────────────────────────────────────────┴──────────┴──────────┴──────────┘');

    // Performance analysis
    console.log('\n📈 PERFORMANCE ANALYSIS');
    console.log('─────────────────────────────────────────────────────────────');

    const flashResult = results.find(r => r.name.includes('FlashAttention') && !r.name.includes('Async') && !r.name.includes('Batch'));
    const dpaResult = results.find(r => r.name.includes('DotProductAttention'));
    if (flashResult && dpaResult) {
      console.log(`   FlashAttention vs DotProduct: ${(dpaResult.avg / flashResult.avg).toFixed(2)}x faster`);
    }

    const linearResult = results.find(r => r.name.includes('LinearAttention'));
    const mhaResult = results.find(r => r.name.includes('MultiHeadAttention'));
    if (linearResult && mhaResult) {
      // Linear at 1024 seq vs MHA at 256 seq, adjusted for O(n²)
      const scaledMha = mhaResult.avg * 16; // O(n²) scaling from 256 to 1024
      console.log(`   LinearAttention vs scaled MHA: ${(scaledMha / linearResult.avg).toFixed(2)}x faster at long sequences`);
    }

    const storeResult = results.find(r => r.name.includes('Episode Store'));
    if (storeResult) {
      const targetMs = 1500; // 1.5s target from gist
      console.log(`   Episode Store vs 1.5s target: ${(targetMs / storeResult.avg).toFixed(1)}x faster`);
    }
  }

  console.log('\n✅ Benchmark complete');
}

main().catch(console.error);
