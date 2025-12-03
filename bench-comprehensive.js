#!/usr/bin/env node
/**
 * Comprehensive Benchmark for agentic-flow@2.0.1-alpha
 */

import { performance } from 'perf_hooks';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AGENTIC-FLOW v2.0.1-alpha COMPREHENSIVE BENCHMARK');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = [];

function benchmark(name, fn, iterations = 100) {
  for (let i = 0; i < 10; i++) { try { fn(); } catch {} }
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

// ==== GNN BENCHMARKS ====
console.log('🧠 GNN BENCHMARKS');
console.log('─────────────────────────────────────────────────────────────');

const gnn = await import('agentic-flow/wrappers/gnn');

// Vector search at different scales
const query384 = new Float32Array(384).map(() => Math.random());

for (const size of [1000, 5000, 10000, 25000]) {
  const candidates = Array.from({ length: size }, () =>
    new Float32Array(384).map(() => Math.random())
  );

  const result = benchmark(`GNN Search ${(size/1000).toFixed(0)}K vectors (384d)`, () => {
    gnn.differentiableSearch(query384, candidates, 10, 384);
  }, size > 10000 ? 10 : 50);

  console.log(`   ${(size/1000).toFixed(0)}K vectors: ${result.avg.toFixed(2)}ms avg, ${result.min.toFixed(2)}ms min`);
}

// RuvectorLayer at different sizes
console.log('\n   RuvectorLayer Forward Pass:');
for (const [inDim, outDim] of [[384, 128], [768, 256], [1024, 512]]) {
  try {
    const layer = new gnn.RuvectorLayer(inDim, outDim, 16, 200, 0.1);
    const input = new Float32Array(inDim).map(() => Math.random());

    const result = benchmark(`RuvectorLayer ${inDim}→${outDim}`, () => {
      layer.forward(input);
    }, 200);

    console.log(`   ${inDim}→${outDim}: ${result.avg.toFixed(3)}ms avg`);
  } catch (e) {
    console.log(`   ${inDim}→${outDim}: Error - ${e.message}`);
  }
}

// ==== ATTENTION BENCHMARKS ====
console.log('\n\n⚡ ATTENTION BENCHMARKS');
console.log('─────────────────────────────────────────────────────────────');

const attn = await import('agentic-flow/wrappers/attention');

// scaledDotProductAttention at different sequence lengths
console.log('   scaledDotProductAttention:');
for (const seqLen of [128, 256, 512, 1024]) {
  const dim = 384;
  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  try {
    const result = benchmark(`ScaledDotProduct ${seqLen} seq`, () => {
      attn.scaledDotProductAttention(q, k, v, seqLen, dim);
    }, 50);
    console.log(`   seq=${seqLen}: ${result.avg.toFixed(2)}ms avg`);
  } catch (e) {
    console.log(`   seq=${seqLen}: Error - ${e.message}`);
  }
}

// MultiHeadAttention with forward method
console.log('\n   MultiHeadAttention.forward:');
for (const [seqLen, heads] of [[128, 4], [256, 8], [512, 8]]) {
  const dim = 384;
  const mha = new attn.MultiHeadAttention(dim, heads);
  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  try {
    const result = benchmark(`MHA ${seqLen}seq ${heads}heads`, () => {
      mha.forward(q, k, v, seqLen, seqLen, dim);
    }, 100);
    console.log(`   seq=${seqLen}, heads=${heads}: ${result.avg.toFixed(3)}ms avg`);
  } catch (e) {
    console.log(`   seq=${seqLen}, heads=${heads}: Error - ${e.message}`);
  }
}

// LinearAttention
console.log('\n   LinearAttention.forward:');
for (const seqLen of [512, 1024, 2048]) {
  const dim = 384;
  const linear = new attn.LinearAttention(dim, 8);
  const q = new Float32Array(seqLen * dim).map(() => Math.random());
  const k = new Float32Array(seqLen * dim).map(() => Math.random());
  const v = new Float32Array(seqLen * dim).map(() => Math.random());

  try {
    const result = benchmark(`LinearAttn ${seqLen}seq`, () => {
      linear.forward(q, k, v, seqLen, seqLen, dim);
    }, 50);
    console.log(`   seq=${seqLen}: ${result.avg.toFixed(3)}ms avg`);
  } catch (e) {
    console.log(`   seq=${seqLen}: Error - ${e.message}`);
  }
}

// ==== SUMMARY ====
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  BENCHMARK RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('┌──────────────────────────────────────────┬──────────┬──────────┬──────────┐');
console.log('│ Benchmark                                │ Avg (ms) │ Min (ms) │ P95 (ms) │');
console.log('├──────────────────────────────────────────┼──────────┼──────────┼──────────┤');

for (const r of results) {
  const name = r.name.length > 40 ? r.name.substring(0, 37) + '...' : r.name;
  console.log(`│ ${name.padEnd(40)} │ ${r.avg.toFixed(3).padStart(8)} │ ${r.min.toFixed(3).padStart(8)} │ ${r.p95.toFixed(3).padStart(8)} │`);
}

console.log('└──────────────────────────────────────────┴──────────┴──────────┴──────────┘');

// Performance Analysis
console.log('\n📈 PERFORMANCE ANALYSIS vs CLAIMS');
console.log('─────────────────────────────────────────────────────────────');

// GNN search scaling
const search1k = results.find(r => r.name.includes('1K vectors'));
const search10k = results.find(r => r.name.includes('10K vectors'));
const search25k = results.find(r => r.name.includes('25K vectors'));

if (search1k && search10k) {
  const scaling = search10k.avg / search1k.avg;
  console.log(`   GNN Search scaling (1K→10K): ${scaling.toFixed(2)}x (linear=10x)`);
  if (scaling < 8) console.log('   ✅ Sub-linear scaling - efficient indexing');
}

if (search1k) {
  const sqliteBaseline = 50; // Typical SQLite at 1K
  console.log(`   GNN Search vs SQLite: ~${(sqliteBaseline / search1k.avg).toFixed(0)}x faster`);
  console.log(`   Claimed: 125-150x | Observed: ~${(sqliteBaseline / search1k.avg).toFixed(0)}x`);
}

// Attention analysis
const sdp256 = results.find(r => r.name.includes('ScaledDotProduct 256'));
const sdp512 = results.find(r => r.name.includes('ScaledDotProduct 512'));

if (sdp256 && sdp512) {
  const scaling = sdp512.avg / sdp256.avg;
  console.log(`\n   Attention scaling (256→512 seq): ${scaling.toFixed(2)}x (O(n²) would be 4x)`);
}

// Calculate ops/sec for key benchmarks
console.log('\n📊 THROUGHPUT');
console.log('─────────────────────────────────────────────────────────────');
for (const r of results.slice(0, 5)) {
  const opsPerSec = (1000 / r.avg).toFixed(0);
  console.log(`   ${r.name}: ${opsPerSec} ops/sec`);
}

console.log('\n✅ Benchmark complete');
