#!/usr/bin/env node

/**
 * AgentDB Example 14 - Vector Quantization & Compression Pipeline
 *
 * Demonstrates the full quantization stack in AgentDB:
 *   - Scalar quantization (8-bit and 4-bit)
 *   - Product Quantization (PQ) with k-means codebooks
 *   - QuantizedVectorStore for transparent compressed search
 *   - 5-tier compression simulation (hot -> archive)
 *
 * Everything runs in pure JS/WASM -- no native deps required.
 */

import {
  quantize8bit,
  quantize4bit,
  dequantize8bit,
  dequantize4bit,
  calculateQuantizationError,
  getQuantizationStats,
  ProductQuantizer,
  QuantizedVectorStore,
  createScalar8BitStore,
  createScalar4BitStore,
  createProductQuantizedStore,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock embedder
// ---------------------------------------------------------------------------
class MockEmbedder {
  constructor(dim = 384) { this.dim = dim; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    for (let i = 0; i < this.dim; i++) { hash = ((hash << 5) - hash + i) | 0; arr[i] = (hash & 0xFFFF) / 65536 - 0.5; }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIM = 384;
const embedder = new MockEmbedder(DIM);

function banner(title) {
  const line = '='.repeat(70);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

function subBanner(title) {
  console.log(`\n  --- ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}\n`);
}

function table(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length))
  );
  const sep = widths.map(w => '-'.repeat(w + 2)).join('+');
  const fmt = (vals) => vals.map((v, i) => ` ${String(v).padEnd(widths[i])} `).join('|');
  console.log(`  ${fmt(headers)}`);
  console.log(`  ${sep}`);
  rows.forEach(r => console.log(`  ${fmt(r)}`));
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------------------------------------------------------------------
// Generate document corpus embeddings
// ---------------------------------------------------------------------------
const CORPUS = [
  'machine learning algorithms for classification',
  'deep neural networks and backpropagation',
  'natural language processing with transformers',
  'computer vision object detection models',
  'reinforcement learning policy optimization',
  'generative adversarial networks for images',
  'recurrent neural networks for sequences',
  'graph neural networks for molecular data',
  'federated learning for privacy preservation',
  'transfer learning for domain adaptation',
  'attention mechanisms in deep learning',
  'convolutional neural networks for images',
  'variational autoencoders for generation',
  'self-supervised learning representations',
  'knowledge distillation model compression',
  'neural architecture search automation',
  'meta-learning few-shot classification',
  'multi-task learning shared representations',
  'continual learning catastrophic forgetting',
  'Bayesian deep learning uncertainty estimation',
];

// We will generate 100 vectors: 20 base + 80 variations
async function generateCorpus() {
  const vectors = [];
  const labels = [];

  for (let i = 0; i < CORPUS.length; i++) {
    vectors.push(await embedder.embed(CORPUS[i]));
    labels.push(CORPUS[i]);
  }
  // Generate 80 more variations
  for (let i = 0; i < 80; i++) {
    const base = CORPUS[i % CORPUS.length];
    const variation = `${base} variant ${i} with additional context details`;
    vectors.push(await embedder.embed(variation));
    labels.push(variation.substring(0, 50));
  }
  return { vectors, labels };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
  ____                    _   _          _   _
 / __ \\                  | | (_)        | | (_)
| |  | |_   _  __ _ _ __ | |_ _ ______ _| |_ _  ___  _ __
| |  | | | | |/ _\` | '_ \\| __| |_  / _\` | __| |/ _ \\| '_ \\
| |__| | |_| | (_| | | | | |_| |/ / (_| | |_| | (_) | | | |
 \\___\\_\\\\__,_|\\__,_|_| |_|\\__|_/___\\__,_|\\__|_|\\___/|_| |_|

      AgentDB Vector Quantization & Compression Pipeline
  `);

  const { vectors, labels } = await generateCorpus();
  console.log(`  Generated ${vectors.length} document embeddings (dim=${DIM})\n`);

  // =========================================================================
  // 1. Scalar Quantization
  // =========================================================================
  banner('1. Scalar Quantization -- 8-bit & 4-bit');

  subBanner('8-bit Quantization (4x compression)');
  {
    const sample = vectors[0];
    const q8 = quantize8bit(sample);
    const deq8 = dequantize8bit(q8.data, q8.min, q8.max);
    const err8 = calculateQuantizationError(sample, deq8);
    const stats8 = getQuantizationStats(sample, '8bit');

    console.log(`  Original size  : ${sample.byteLength} bytes (Float32 x ${DIM})`);
    console.log(`  Quantized size : ${q8.data.byteLength} bytes (Uint8 x ${DIM})`);
    console.log(`  Compression    : ${(sample.byteLength / q8.data.byteLength).toFixed(1)}x`);
    console.log(`  Range          : [${q8.min.toFixed(6)}, ${q8.max.toFixed(6)}]`);
    console.log(`  Mean error     : ${err8.meanError.toFixed(8)}`);
    console.log(`  Max error      : ${err8.maxError.toFixed(8)}`);
    console.log(`  MSE            : ${err8.mse.toFixed(10)}`);
    console.log(`  Cosine sim     : ${cosineSim(sample, deq8).toFixed(8)}`);
    console.log(`  Stats ratio    : ${stats8.compressionRatio.toFixed(1)}x`);
  }

  subBanner('4-bit Quantization (8x compression)');
  {
    const sample = vectors[0];
    const q4 = quantize4bit(sample);
    const deq4 = dequantize4bit(q4.data, q4.min, q4.max, q4.dimension);
    const err4 = calculateQuantizationError(sample, deq4);
    const stats4 = getQuantizationStats(sample, '4bit');

    console.log(`  Original size  : ${sample.byteLength} bytes`);
    console.log(`  Quantized size : ${q4.data.byteLength} bytes (4-bit packed)`);
    console.log(`  Compression    : ${(sample.byteLength / q4.data.byteLength).toFixed(1)}x`);
    console.log(`  Range          : [${q4.min.toFixed(6)}, ${q4.max.toFixed(6)}]`);
    console.log(`  Mean error     : ${err4.meanError.toFixed(8)}`);
    console.log(`  Max error      : ${err4.maxError.toFixed(8)}`);
    console.log(`  MSE            : ${err4.mse.toFixed(10)}`);
    console.log(`  Cosine sim     : ${cosineSim(sample, deq4).toFixed(8)}`);
    console.log(`  Stats ratio    : ${stats4.compressionRatio.toFixed(1)}x`);
  }

  // Batch error analysis across all vectors
  subBanner('Batch Error Analysis (100 vectors)');
  {
    let sum8mse = 0, sum4mse = 0, sum8cos = 0, sum4cos = 0;
    let max8err = 0, max4err = 0;

    for (const v of vectors) {
      const q8 = quantize8bit(v);
      const d8 = dequantize8bit(q8.data, q8.min, q8.max);
      const e8 = calculateQuantizationError(v, d8);

      const q4 = quantize4bit(v);
      const d4 = dequantize4bit(q4.data, q4.min, q4.max, q4.dimension);
      const e4 = calculateQuantizationError(v, d4);

      sum8mse += e8.mse;
      sum4mse += e4.mse;
      sum8cos += cosineSim(v, d8);
      sum4cos += cosineSim(v, d4);
      max8err = Math.max(max8err, e8.maxError);
      max4err = Math.max(max4err, e4.maxError);
    }

    const n = vectors.length;
    table([
      ['8-bit', '4x', (sum8mse / n).toExponential(4), max8err.toFixed(6), (sum8cos / n).toFixed(8), `${DIM} B/vec`],
      ['4-bit', '8x', (sum4mse / n).toExponential(4), max4err.toFixed(6), (sum4cos / n).toFixed(8), `${Math.ceil(DIM / 2)} B/vec`],
    ], ['Method', 'Compression', 'Avg MSE', 'Max Error', 'Avg Cosine', 'Storage']);
  }

  // =========================================================================
  // 2. Product Quantization
  // =========================================================================
  banner('2. Product Quantizer -- High Compression with Codebooks');

  const pq = new ProductQuantizer({
    dimension: DIM,
    numSubspaces: 48,        // 384/48 = 8 dims per subspace
    numCentroids: 64,        // fits within 100 training vectors
    maxIterations: 20,
    convergenceThreshold: 1e-4,
    seed: 42,
  });

  console.log('  Training PQ on 100 vectors (48 subspaces, 64 centroids)...');
  const trainStart = performance.now();
  await pq.train(vectors);
  const trainMs = performance.now() - trainStart;
  console.log(`  Training complete in ${trainMs.toFixed(0)} ms`);

  const pqStats = pq.getStats();
  console.log(`\n  Trained          : ${pqStats.trained}`);
  console.log(`  Subspaces        : ${pqStats.numSubspaces}`);
  console.log(`  Subspace dim     : ${pqStats.subspaceDim}`);
  console.log(`  Centroids/sub    : ${pqStats.numCentroids}`);
  console.log(`  Compression ratio: ${pqStats.compressionRatio.toFixed(1)}x`);
  console.log(`  Codebook size    : ${(pqStats.codebookSizeBytes / 1024).toFixed(1)} KB`);

  // Encode/decode analysis
  subBanner('PQ Encode/Decode Quality');
  {
    let totalMse = 0, totalCos = 0;
    for (const v of vectors) {
      const encoded = pq.encode(v);
      const decoded = pq.decode(encoded);
      const err = calculateQuantizationError(v, decoded);
      totalMse += err.mse;
      totalCos += cosineSim(v, decoded);
    }
    console.log(`  Avg MSE       : ${(totalMse / vectors.length).toExponential(4)}`);
    console.log(`  Avg Cosine    : ${(totalCos / vectors.length).toFixed(6)}`);
    console.log(`  Bytes/vector  : ${pqStats.numSubspaces} (${pqStats.numSubspaces} uint8 codes)`);
    console.log(`  vs Float32    : ${DIM * 4} bytes`);
    console.log(`  Savings       : ${((1 - pqStats.numSubspaces / (DIM * 4)) * 100).toFixed(1)}%`);
  }

  // Asymmetric distance computation
  subBanner('Asymmetric Distance Computation');
  {
    const query = vectors[0];
    const encoded1 = pq.encode(vectors[1]);
    const encoded2 = pq.encode(vectors[10]);

    const dist1 = pq.asymmetricDistance(query, encoded1);
    const dist2 = pq.asymmetricDistance(query, encoded2);
    console.log(`  Query   : "${labels[0].substring(0, 50)}"`);
    console.log(`  Target 1: "${labels[1].substring(0, 50)}"`);
    console.log(`  Target 2: "${labels[10].substring(0, 50)}"`);
    console.log(`  Asym dist (query -> T1) : ${dist1.toFixed(6)}`);
    console.log(`  Asym dist (query -> T2) : ${dist2.toFixed(6)}`);
    console.log(`  Exact L2 (query -> T1)  : ${vectors[1].reduce((s, v, i) => s + (v - query[i]) ** 2, 0).toFixed(6)}`);
    console.log(`  Exact L2 (query -> T2)  : ${vectors[10].reduce((s, v, i) => s + (v - query[i]) ** 2, 0).toFixed(6)}`);
  }

  // Pre-computed distance tables
  subBanner('Pre-computed Distance Tables (Batch Search)');
  {
    const query = vectors[0];
    const tablesStart = performance.now();
    const tables = pq.precomputeDistanceTables(query);
    const tablesMs = performance.now() - tablesStart;

    const encodedAll = vectors.map(v => pq.encode(v));

    // Search with tables
    const searchStart = performance.now();
    const results = encodedAll
      .map((enc, i) => ({ idx: i, dist: pq.distanceFromTables(tables, enc) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    const searchMs = performance.now() - searchStart;

    console.log(`  Table precomputation : ${tablesMs.toFixed(3)} ms (${tables.length} tables x ${tables[0].length} centroids)`);
    console.log(`  Table search (100)   : ${searchMs.toFixed(3)} ms`);
    console.log(`\n  Top 5 nearest neighbors:`);
    results.forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.idx}] dist=${r.dist.toFixed(4)} "${labels[r.idx].substring(0, 45)}"`);
    });
  }

  // =========================================================================
  // 3. QuantizedVectorStore
  // =========================================================================
  banner('3. QuantizedVectorStore -- Transparent Compressed Search');

  // Create three store types
  const store8 = createScalar8BitStore(DIM, 'cosine');
  const store4 = createScalar4BitStore(DIM, 'cosine');
  const storePQ = createProductQuantizedStore(DIM, 48, 64, 'cosine');

  // Train PQ store
  console.log('  Training PQ store on corpus...');
  await storePQ.train(vectors);
  console.log('  PQ store ready.\n');

  // Insert vectors into all stores
  for (let i = 0; i < vectors.length; i++) {
    store8.insert(`doc-${i}`, vectors[i], { label: labels[i].substring(0, 40) });
    store4.insert(`doc-${i}`, vectors[i], { label: labels[i].substring(0, 40) });
    storePQ.insert(`doc-${i}`, vectors[i], { label: labels[i].substring(0, 40) });
  }

  // Search comparison
  subBanner('Search Quality Comparison');
  const query = vectors[0]; // Use first vector as query

  // Ground truth: brute-force cosine similarity
  const groundTruth = vectors
    .map((v, i) => ({ id: `doc-${i}`, sim: cosineSim(query, v) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 10);

  const r8  = store8.search(query, 10);
  const r4  = store4.search(query, 10);
  const rPQ = storePQ.search(query, 10);

  console.log('  Ground truth top-10 (brute-force cosine):');
  groundTruth.forEach((g, i) => {
    console.log(`    ${(i + 1 + '.').padEnd(4)} ${g.id.padEnd(8)} sim=${g.sim.toFixed(6)}`);
  });

  console.log('\n  8-bit store results:');
  r8.forEach((r, i) => {
    console.log(`    ${(i + 1 + '.').padEnd(4)} ${r.id.padEnd(8)} sim=${r.similarity.toFixed(6)} dist=${r.distance.toFixed(6)}`);
  });

  console.log('\n  4-bit store results:');
  r4.forEach((r, i) => {
    console.log(`    ${(i + 1 + '.').padEnd(4)} ${r.id.padEnd(8)} sim=${r.similarity.toFixed(6)} dist=${r.distance.toFixed(6)}`);
  });

  console.log('\n  PQ store results:');
  rPQ.forEach((r, i) => {
    console.log(`    ${(i + 1 + '.').padEnd(4)} ${r.id.padEnd(8)} sim=${r.similarity.toFixed(6)} dist=${r.distance.toFixed(6)}`);
  });

  // Recall@10 (how many of the true top-10 each method finds)
  const gtIds = new Set(groundTruth.map(g => g.id));
  const recall8  = r8.filter(r => gtIds.has(r.id)).length;
  const recall4  = r4.filter(r => gtIds.has(r.id)).length;
  const recallPQ = rPQ.filter(r => gtIds.has(r.id)).length;

  console.log('\n  Recall@10:');
  console.log(`    8-bit : ${recall8}/10 = ${(recall8 / 10 * 100).toFixed(0)}%`);
  console.log(`    4-bit : ${recall4}/10 = ${(recall4 / 10 * 100).toFixed(0)}%`);
  console.log(`    PQ    : ${recallPQ}/10 = ${(recallPQ / 10 * 100).toFixed(0)}%`);

  // Store stats
  subBanner('Store Statistics');
  const stats8  = store8.getStats();
  const stats4  = store4.getStats();
  const statsPQ = storePQ.getStats();

  table([
    ['8-bit scalar', stats8.count, stats8.quantizationType, `${stats8.compressionRatio.toFixed(1)}x`, `${(stats8.memoryUsageBytes / 1024).toFixed(1)} KB`, stats8.metric],
    ['4-bit scalar', stats4.count, stats4.quantizationType, `${stats4.compressionRatio.toFixed(1)}x`, `${(stats4.memoryUsageBytes / 1024).toFixed(1)} KB`, stats4.metric],
    ['Product (PQ)', statsPQ.count, statsPQ.quantizationType, `${statsPQ.compressionRatio.toFixed(1)}x`, `${(statsPQ.memoryUsageBytes / 1024).toFixed(1)} KB`, statsPQ.metric],
  ], ['Store Type', 'Count', 'Quant Type', 'Compress', 'Memory', 'Metric']);

  // =========================================================================
  // 4. Comprehensive Comparison Table
  // =========================================================================
  banner('4. Comprehensive Comparison Table');

  // Calculate aggregate errors for each method
  let mse8 = 0, mse4 = 0, msePQ = 0;
  let maxE8 = 0, maxE4 = 0, maxEPQ = 0;
  let cos8 = 0, cos4 = 0, cosPQ = 0;

  for (const v of vectors) {
    // 8-bit
    const q8 = quantize8bit(v);
    const d8 = dequantize8bit(q8.data, q8.min, q8.max);
    const e8 = calculateQuantizationError(v, d8);
    mse8 += e8.mse; maxE8 = Math.max(maxE8, e8.maxError); cos8 += cosineSim(v, d8);

    // 4-bit
    const q4 = quantize4bit(v);
    const d4 = dequantize4bit(q4.data, q4.min, q4.max, q4.dimension);
    const e4 = calculateQuantizationError(v, d4);
    mse4 += e4.mse; maxE4 = Math.max(maxE4, e4.maxError); cos4 += cosineSim(v, d4);

    // PQ
    const enc = pq.encode(v);
    const dec = pq.decode(enc);
    const ePQ = calculateQuantizationError(v, dec);
    msePQ += ePQ.mse; maxEPQ = Math.max(maxEPQ, ePQ.maxError); cosPQ += cosineSim(v, dec);
  }
  const n = vectors.length;
  const fp32mem = n * DIM * 4;

  table([
    ['Float32 (exact)',  '1.0x',  '0',                  '0',              '1.000000', `${(fp32mem / 1024).toFixed(1)} KB`],
    ['Scalar 8-bit',     '4.0x',  (mse8 / n).toExponential(3),  maxE8.toFixed(6),  (cos8 / n).toFixed(6),  `${(n * DIM / 1024).toFixed(1)} KB`],
    ['Scalar 4-bit',     '8.0x',  (mse4 / n).toExponential(3),  maxE4.toFixed(6),  (cos4 / n).toFixed(6),  `${(n * Math.ceil(DIM / 2) / 1024).toFixed(1)} KB`],
    ['Product (PQ-48)',  `${pq.getCompressionRatio().toFixed(1)}x`, (msePQ / n).toExponential(3), maxEPQ.toFixed(6), (cosPQ / n).toFixed(6), `${(n * 48 / 1024).toFixed(1)} KB`],
  ], ['Method', 'Compress', 'Avg MSE', 'Max Error', 'Avg Cosine', 'Memory (100v)']);

  // =========================================================================
  // 5. 5-Tier Compression Simulation
  // =========================================================================
  banner('5. Five-Tier Compression Simulation');

  console.log(`
       +-----------+
       |  HOT      |  Float32 -- full precision, fastest search
       |  (fp32)   |  For actively queried data
       +-----------+
            |
       +-----------+
       |  WARM     |  Simulated fp16 -- 2x compression
       |  (fp16*)  |  Recent data, good quality
       +-----------+
            |
       +-----------+
       |  COOL     |  8-bit scalar -- 4x compression
       |  (int8)   |  Older data, minimal quality loss
       +-----------+
            |
       +-----------+
       |  COLD     |  4-bit scalar -- 8x compression
       |  (int4)   |  Archival search, moderate quality loss
       +-----------+
            |
       +-----------+
       |  ARCHIVE  |  Binary (sign bits) -- 48x compression
       |  (1-bit)  |  Rough similarity only
       +-----------+
  `);

  // Simulate tiers on 20 vectors
  const tierVecs = vectors.slice(0, 20);
  const tierQuery = vectors[0];

  // Tier 1: Hot (fp32 exact)
  const hotResults = tierVecs
    .map((v, i) => ({ i, sim: cosineSim(tierQuery, v) }))
    .sort((a, b) => b.sim - a.sim);

  // Tier 2: Warm (simulate fp16 by rounding to half precision)
  function simulateFp16(v) {
    const buf = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
      // Truncate mantissa to simulate fp16 precision
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, v[i]);
      const bits = view.getUint32(0);
      // Zero out lower 13 bits of mantissa (fp32 has 23, fp16 has 10)
      const truncated = bits & 0xFFFFE000;
      view.setUint32(0, truncated);
      buf[i] = view.getFloat32(0);
    }
    return buf;
  }
  const warmResults = tierVecs
    .map((v, i) => ({ i, sim: cosineSim(tierQuery, simulateFp16(v)) }))
    .sort((a, b) => b.sim - a.sim);

  // Tier 3: Cool (8-bit)
  const coolResults = tierVecs
    .map((v, i) => {
      const q = quantize8bit(v);
      const d = dequantize8bit(q.data, q.min, q.max);
      return { i, sim: cosineSim(tierQuery, d) };
    })
    .sort((a, b) => b.sim - a.sim);

  // Tier 4: Cold (4-bit)
  const coldResults = tierVecs
    .map((v, i) => {
      const q = quantize4bit(v);
      const d = dequantize4bit(q.data, q.min, q.max, q.dimension);
      return { i, sim: cosineSim(tierQuery, d) };
    })
    .sort((a, b) => b.sim - a.sim);

  // Tier 5: Archive (binary -- sign bits only)
  function binaryQuantize(v) {
    const bits = new Uint8Array(Math.ceil(v.length / 8));
    for (let i = 0; i < v.length; i++) {
      if (v[i] >= 0) bits[i >> 3] |= (1 << (i & 7));
    }
    return bits;
  }
  function binaryHamming(a, b, dim) {
    let same = 0;
    for (let i = 0; i < dim; i++) {
      const bitA = (a[i >> 3] >> (i & 7)) & 1;
      const bitB = (b[i >> 3] >> (i & 7)) & 1;
      if (bitA === bitB) same++;
    }
    return same / dim;
  }
  const queryBin = binaryQuantize(tierQuery);
  const archiveResults = tierVecs
    .map((v, i) => {
      const vBin = binaryQuantize(v);
      return { i, sim: binaryHamming(queryBin, vBin, DIM) };
    })
    .sort((a, b) => b.sim - a.sim);

  // Display tier comparison
  subBanner('Tier Search Results (top 5 per tier)');

  const tierRows = [];
  for (let k = 0; k < 5; k++) {
    tierRows.push([
      k + 1,
      `[${hotResults[k].i}] ${hotResults[k].sim.toFixed(4)}`,
      `[${warmResults[k].i}] ${warmResults[k].sim.toFixed(4)}`,
      `[${coolResults[k].i}] ${coolResults[k].sim.toFixed(4)}`,
      `[${coldResults[k].i}] ${coldResults[k].sim.toFixed(4)}`,
      `[${archiveResults[k].i}] ${archiveResults[k].sim.toFixed(4)}`,
    ]);
  }
  table(tierRows, ['#', 'HOT (fp32)', 'WARM (fp16)', 'COOL (8-bit)', 'COLD (4-bit)', 'ARCHIVE (1-bit)']);

  // Rank correlation with ground truth
  subBanner('Rank Correlation with Ground Truth (Spearman)');
  function spearmanCorrelation(truth, approx) {
    const n = truth.length;
    const truthRank = truth.map(t => t.i);
    const approxRank = approx.map(a => a.i);
    const rankMap = new Map(truthRank.map((id, rank) => [id, rank]));
    let d2 = 0;
    for (let r = 0; r < n; r++) {
      const trueRank = rankMap.has(approxRank[r]) ? rankMap.get(approxRank[r]) : n;
      d2 += (r - trueRank) ** 2;
    }
    return 1 - (6 * d2) / (n * (n * n - 1));
  }

  const spWarm    = spearmanCorrelation(hotResults, warmResults);
  const spCool    = spearmanCorrelation(hotResults, coolResults);
  const spCold    = spearmanCorrelation(hotResults, coldResults);
  const spArchive = spearmanCorrelation(hotResults, archiveResults);

  const bytesPerVecFp32 = DIM * 4;
  table([
    ['HOT (fp32)',      '1.0x',   `${bytesPerVecFp32}`,                    '1.000', 'Exact'],
    ['WARM (fp16*)',    '2.0x',   `${DIM * 2}`,                            spWarm.toFixed(3), 'Excellent'],
    ['COOL (8-bit)',    '4.0x',   `${DIM}`,                                spCool.toFixed(3), 'Very Good'],
    ['COLD (4-bit)',    '8.0x',   `${Math.ceil(DIM / 2)}`,                 spCold.toFixed(3), 'Good'],
    ['ARCHIVE (1-bit)', `${(bytesPerVecFp32 / Math.ceil(DIM / 8)).toFixed(0)}x`, `${Math.ceil(DIM / 8)}`, spArchive.toFixed(3), 'Rough'],
  ], ['Tier', 'Compress', 'Bytes/vec', 'Spearman r', 'Quality']);

  // =========================================================================
  // 6. Export/Import and Persistence
  // =========================================================================
  banner('6. Export/Import & Persistence');

  // Export PQ codebooks
  const codebookJson = pq.exportCodebooks();
  console.log(`  PQ codebook export size: ${(codebookJson.length / 1024).toFixed(1)} KB`);

  // Verify round-trip
  const pq2 = new ProductQuantizer({
    dimension: DIM,
    numSubspaces: 48,
    numCentroids: 64,
  });
  pq2.importCodebooks(codebookJson);
  console.log(`  Imported codebooks: trained=${pq2.isTrained()}`);

  // Verify encoding is identical
  const testEnc1 = pq.encode(vectors[5]);
  const testEnc2 = pq2.encode(vectors[5]);
  const codesMatch = testEnc1.codes.every((c, i) => c === testEnc2.codes[i]);
  console.log(`  Encoding match after import: ${codesMatch}`);

  // Export/import store
  const storeExport = store8.export();
  console.log(`  8-bit store export size: ${(storeExport.length / 1024).toFixed(1)} KB`);

  const store8b = createScalar8BitStore(DIM, 'cosine');
  store8b.import(storeExport);
  const importStats = store8b.getStats();
  console.log(`  Imported store count: ${importStats.count}`);
  console.log(`  Round-trip verified: ${importStats.count === stats8.count}`);

  // =========================================================================
  // Summary
  // =========================================================================
  banner('Summary');

  console.log('  Quantization provides a spectrum of memory-quality tradeoffs:');
  console.log('');
  console.log('    fp32   -> Exact.     1536 B/vec.  Baseline for quality.');
  console.log('    fp16   -> 2x save.    768 B/vec.  Near-lossless.');
  console.log('    int8   -> 4x save.    384 B/vec.  ~0.9999 cosine fidelity.');
  console.log('    int4   -> 8x save.    192 B/vec.  ~0.999 cosine fidelity.');
  console.log('    PQ-48  -> 32x save.    48 B/vec.  Good for large-scale ANN.');
  console.log('    binary -> 48x save.    48 bit/vec. Rough candidate filtering.');
  console.log('');
  console.log('  AgentDB supports all tiers transparently. Use hot tiers for');
  console.log('  active data, colder tiers for archival. The QuantizedVectorStore');
  console.log('  handles asymmetric distance so queries stay at full precision.');
  console.log('');
  console.log('  Done. All quantization demonstrations complete.\n');
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
