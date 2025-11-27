#!/usr/bin/env node
/**
 * RuVector CVE Scanner - Comprehensive Benchmark Suite
 *
 * Benchmarks:
 * - Pattern matching throughput
 * - Vector embedding performance
 * - GNN layer inference speed
 * - Attack graph construction
 * - Memory usage
 * - Scalability tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const { CVE_PATTERNS } = require('./cve-database');

// Colors
const C = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', x: '\x1b[0m', B: '\x1b[1m', d: '\x1b[2m'
};

// Benchmark configuration
const CONFIG = {
  iterations: 1000,
  warmupIterations: 100,
  vectorDim: 256,
  gnnHeads: 8,
  sampleCodeSize: 10000, // characters
  graphNodes: 100,
  graphEdges: 300
};

// Results storage
const benchmarkResults = {};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

function section(name) {
  console.log(`\n${C.B}${C.c}▶ ${name}${C.x}`);
  console.log(`${C.d}${'─'.repeat(60)}${C.x}`);
}

function generateRandomCode(size) {
  const templates = [
    'function ${name}(${params}) { return ${expr}; }',
    'const ${name} = async (${params}) => { await ${expr}; };',
    'exec("${cmd}")',
    'query("SELECT * FROM ${table} WHERE id = " + ${var})',
    'fetch(${url})',
    'Object.assign({}, ${obj})',
    '${var}["__proto__"] = ${val}',
    'eval(${code})',
    'innerHTML = ${html}',
    'password = "${secret}"'
  ];

  let code = '';
  while (code.length < size) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    code += template
      .replace(/\$\{name\}/g, 'func' + Math.random().toString(36).slice(2, 8))
      .replace(/\$\{params\}/g, 'a, b, c')
      .replace(/\$\{expr\}/g, 'a + b')
      .replace(/\$\{cmd\}/g, 'ls -la')
      .replace(/\$\{table\}/g, 'users')
      .replace(/\$\{var\}/g, 'input')
      .replace(/\$\{url\}/g, 'req.body.url')
      .replace(/\$\{obj\}/g, 'req.body')
      .replace(/\$\{val\}/g, 'payload')
      .replace(/\$\{code\}/g, 'userCode')
      .replace(/\$\{html\}/g, 'content')
      .replace(/\$\{secret\}/g, 'abcd1234efgh5678') + '\n';
  }
  return code;
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function benchmarkPatternMatching() {
  section('Pattern Matching Benchmark');

  const code = generateRandomCode(CONFIG.sampleCodeSize);
  const patterns = [];

  // Collect all patterns
  for (const [vulnType, config] of Object.entries(CVE_PATTERNS)) {
    for (const patternDef of config.patterns) {
      patterns.push({
        type: vulnType,
        regex: new RegExp(patternDef.regex.source, patternDef.regex.flags)
      });
    }
  }

  console.log(`  Code size: ${formatBytes(code.length)}`);
  console.log(`  Patterns: ${patterns.length}`);

  // Warmup
  for (let i = 0; i < CONFIG.warmupIterations; i++) {
    for (const p of patterns) {
      p.regex.test(code);
    }
  }

  // Benchmark
  const startTime = process.hrtime.bigint();
  let totalMatches = 0;

  for (let i = 0; i < CONFIG.iterations; i++) {
    for (const p of patterns) {
      const matches = code.match(p.regex);
      if (matches) totalMatches += matches.length;
    }
  }

  const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
  const opsPerSec = (CONFIG.iterations * patterns.length) / (elapsed / 1000);
  const throughput = (CONFIG.iterations * code.length) / (elapsed / 1000);

  console.log(`\n  ${C.g}Results:${C.x}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Ops/sec: ${formatNumber(opsPerSec)}`);
  console.log(`    Throughput: ${formatNumber(throughput)} chars/sec`);
  console.log(`    Total matches: ${totalMatches}`);

  benchmarkResults.patternMatching = {
    elapsed,
    opsPerSec,
    throughput,
    totalMatches,
    patterns: patterns.length,
    codeSize: code.length
  };
}

function benchmarkVectorEmbedding() {
  section('Vector Embedding Benchmark');

  const dim = CONFIG.vectorDim;
  const texts = [];

  // Generate test texts
  for (let i = 0; i < 100; i++) {
    texts.push('vulnerability_pattern_' + crypto.randomBytes(16).toString('hex'));
  }

  function embed(text) {
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      const byte = hash[i % 32];
      embedding[i] = (byte / 255) * 2 - 1;
    }
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < dim; i++) embedding[i] /= norm;
    return embedding;
  }

  function cosineSim(a, b) {
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += a[i] * b[i];
    return dot;
  }

  console.log(`  Dimensions: ${dim}`);
  console.log(`  Test texts: ${texts.length}`);

  // Warmup
  for (let i = 0; i < CONFIG.warmupIterations; i++) {
    embed(texts[i % texts.length]);
  }

  // Benchmark embedding
  let startTime = process.hrtime.bigint();

  const embeddings = [];
  for (let i = 0; i < CONFIG.iterations; i++) {
    embeddings.push(embed(texts[i % texts.length]));
  }

  let elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const embeddingsPerSec = CONFIG.iterations / (elapsed / 1000);

  console.log(`\n  ${C.g}Embedding Results:${C.x}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Embeddings/sec: ${formatNumber(embeddingsPerSec)}`);

  // Benchmark similarity
  startTime = process.hrtime.bigint();
  let totalSims = 0;

  for (let i = 0; i < Math.min(embeddings.length, 1000); i++) {
    for (let j = i + 1; j < Math.min(embeddings.length, i + 100); j++) {
      cosineSim(embeddings[i], embeddings[j]);
      totalSims++;
    }
  }

  elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const simsPerSec = totalSims / (elapsed / 1000);

  console.log(`\n  ${C.g}Similarity Results:${C.x}`);
  console.log(`    Comparisons: ${totalSims}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Comparisons/sec: ${formatNumber(simsPerSec)}`);

  benchmarkResults.vectorEmbedding = {
    embeddingsPerSec,
    simsPerSec,
    dimensions: dim
  };
}

function benchmarkGNNLayer() {
  section('GNN Layer Benchmark');

  const dim = 64;
  const heads = CONFIG.gnnHeads;
  const headDim = dim / heads;
  const numNodes = 50;

  // Initialize weights
  const randomMatrix = (rows, cols) =>
    Array(rows).fill().map(() =>
      Array(cols).fill().map(() => (Math.random() * 2 - 1) * 0.1)
    );

  const weights = {};
  for (let h = 0; h < heads; h++) {
    weights[h] = {
      Wq: randomMatrix(headDim, headDim),
      Wk: randomMatrix(headDim, headDim),
      Wv: randomMatrix(headDim, headDim)
    };
  }

  // Generate node features
  const features = Array(numNodes).fill().map(() =>
    Array(dim).fill().map(() => Math.random() * 2 - 1)
  );

  // Generate edges
  const edges = [];
  for (let i = 0; i < numNodes; i++) {
    const numNeighbors = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < numNeighbors; j++) {
      const target = Math.floor(Math.random() * numNodes);
      if (target !== i) edges.push({ from: i, to: target });
    }
  }

  function matVec(mat, vec) {
    return mat.map(row => row.reduce((sum, w, i) => sum + w * vec[i], 0));
  }

  function softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  }

  function attention(query, keys, values, head) {
    const q = matVec(weights[head].Wq, query);
    const ks = keys.map(k => matVec(weights[head].Wk, k));
    const vs = values.map(v => matVec(weights[head].Wv, v));

    const scores = ks.map(k => {
      let dot = 0;
      for (let i = 0; i < headDim; i++) dot += q[i] * k[i];
      return dot / Math.sqrt(headDim);
    });

    const attn = softmax(scores);

    const output = Array(headDim).fill(0);
    for (let i = 0; i < vs.length; i++) {
      for (let j = 0; j < headDim; j++) {
        output[j] += attn[i] * vs[i][j];
      }
    }
    return output;
  }

  function propagate(nodeFeatures, edges) {
    const adj = {};
    for (const e of edges) {
      adj[e.to] = adj[e.to] || [];
      adj[e.to].push(e.from);
    }

    return nodeFeatures.map((feat, i) => {
      const neighbors = adj[i] || [];
      if (neighbors.length === 0) return feat;

      const neighborFeats = neighbors.map(n => nodeFeatures[n]);
      const outputs = [];

      for (let h = 0; h < heads; h++) {
        const start = h * headDim;
        const query = feat.slice(start, start + headDim);
        const keys = neighborFeats.map(f => f.slice(start, start + headDim));
        const values = neighborFeats.map(f => f.slice(start, start + headDim));
        outputs.push(...attention(query, keys, values, h));
      }

      return outputs;
    });
  }

  console.log(`  Nodes: ${numNodes}`);
  console.log(`  Edges: ${edges.length}`);
  console.log(`  Heads: ${heads}`);
  console.log(`  Dimensions: ${dim}`);

  // Warmup
  for (let i = 0; i < 10; i++) {
    propagate(features, edges);
  }

  // Benchmark
  const startTime = process.hrtime.bigint();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    propagate(features, edges);
  }

  const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const layersPerSec = iterations / (elapsed / 1000);
  const nodesPerSec = (iterations * numNodes) / (elapsed / 1000);

  console.log(`\n  ${C.g}Results:${C.x}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Layers/sec: ${formatNumber(layersPerSec)}`);
  console.log(`    Nodes/sec: ${formatNumber(nodesPerSec)}`);
  console.log(`    Latency: ${(elapsed / iterations).toFixed(3)}ms per layer`);

  benchmarkResults.gnnLayer = {
    layersPerSec,
    nodesPerSec,
    latency: elapsed / iterations,
    nodes: numNodes,
    edges: edges.length
  };
}

function benchmarkAttackGraph() {
  section('Attack Graph Benchmark');

  const numNodes = CONFIG.graphNodes;
  const numEdges = CONFIG.graphEdges;

  class Graph {
    constructor() {
      this.nodes = new Map();
      this.edges = [];
      this.adj = {};
    }

    addNode(id, data) {
      this.nodes.set(id, { ...data, id });
      this.adj[id] = [];
    }

    addEdge(from, to, weight = 1.0) {
      this.edges.push({ from, to, weight });
      if (this.adj[from]) this.adj[from].push(to);
    }

    pageRank(iterations = 20, damping = 0.85) {
      const n = this.nodes.size;
      const ids = Array.from(this.nodes.keys());
      let ranks = {};
      ids.forEach(id => ranks[id] = 1 / n);

      for (let i = 0; i < iterations; i++) {
        const newRanks = {};
        ids.forEach(id => {
          let sum = 0;
          this.edges.filter(e => e.to === id).forEach(edge => {
            const outDegree = this.edges.filter(e => e.from === edge.from).length || 1;
            sum += ranks[edge.from] / outDegree;
          });
          newRanks[id] = (1 - damping) / n + damping * sum;
        });
        ranks = newRanks;
      }
      return ranks;
    }

    findChains(maxDepth = 5) {
      const chains = [];
      const dfs = (node, path, depth) => {
        if (depth > maxDepth) return;
        path.push(node);
        const neighbors = this.adj[node] || [];
        if (neighbors.length === 0 && path.length > 1) {
          chains.push([...path]);
        }
        for (const next of neighbors) {
          if (!path.includes(next)) dfs(next, path, depth + 1);
        }
        path.pop();
      };
      for (const [id] of this.nodes) dfs(id, [], 0);
      return chains;
    }

    bfs(start) {
      const visited = new Set();
      const queue = [start];
      while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node)) continue;
        visited.add(node);
        for (const n of (this.adj[node] || [])) {
          if (!visited.has(n)) queue.push(n);
        }
      }
      return visited;
    }
  }

  // Build graph
  const graph = new Graph();
  for (let i = 0; i < numNodes; i++) {
    graph.addNode(`node_${i}`, { type: 'vulnerability' });
  }
  for (let i = 0; i < numEdges; i++) {
    const from = `node_${Math.floor(Math.random() * numNodes)}`;
    const to = `node_${Math.floor(Math.random() * numNodes)}`;
    if (from !== to) graph.addEdge(from, to, Math.random());
  }

  console.log(`  Nodes: ${numNodes}`);
  console.log(`  Edges: ${numEdges}`);

  // Benchmark PageRank
  let startTime = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) {
    graph.pageRank(20);
  }
  let elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const pageRankPerSec = 100 / (elapsed / 1000);

  console.log(`\n  ${C.g}PageRank Results:${C.x}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms (100 runs)`);
  console.log(`    Runs/sec: ${formatNumber(pageRankPerSec)}`);

  // Benchmark chain finding
  startTime = process.hrtime.bigint();
  const chains = graph.findChains(5);
  elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;

  console.log(`\n  ${C.g}Chain Discovery Results:${C.x}`);
  console.log(`    Chains found: ${chains.length}`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);

  // Benchmark BFS
  startTime = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    graph.bfs(`node_${i % numNodes}`);
  }
  elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const bfsPerSec = 1000 / (elapsed / 1000);

  console.log(`\n  ${C.g}BFS Traversal Results:${C.x}`);
  console.log(`    Traversals/sec: ${formatNumber(bfsPerSec)}`);

  benchmarkResults.attackGraph = {
    pageRankPerSec,
    chainsFound: chains.length,
    bfsPerSec,
    nodes: numNodes,
    edges: numEdges
  };
}

function benchmarkMemory() {
  section('Memory Usage Benchmark');

  const initialMemory = process.memoryUsage();

  // Generate large dataset
  const embeddings = [];
  for (let i = 0; i < 10000; i++) {
    embeddings.push(new Float32Array(CONFIG.vectorDim).map(() => Math.random()));
  }

  const afterEmbeddings = process.memoryUsage();

  // Generate patterns
  const code = generateRandomCode(100000);
  const afterCode = process.memoryUsage();

  console.log(`  ${C.g}Memory Stats:${C.x}`);
  console.log(`    Initial heap: ${formatBytes(initialMemory.heapUsed)}`);
  console.log(`    After embeddings (10K): ${formatBytes(afterEmbeddings.heapUsed)}`);
  console.log(`    After code gen (100KB): ${formatBytes(afterCode.heapUsed)}`);
  console.log(`    Embedding memory: ${formatBytes(afterEmbeddings.heapUsed - initialMemory.heapUsed)}`);
  console.log(`    RSS: ${formatBytes(afterCode.rss)}`);

  benchmarkResults.memory = {
    initialHeap: initialMemory.heapUsed,
    finalHeap: afterCode.heapUsed,
    embeddingMemory: afterEmbeddings.heapUsed - initialMemory.heapUsed,
    rss: afterCode.rss
  };

  // Cleanup
  embeddings.length = 0;
}

function benchmarkRuVector() {
  section('RuVector Native Performance');

  try {
    // Test ruvector GNN
    const startGnn = process.hrtime.bigint();
    execSync('npx ruvector gnn layer --dim 64 --type attention 2>&1', { encoding: 'utf8', timeout: 10000 });
    const gnnTime = Number(process.hrtime.bigint() - startGnn) / 1e6;

    console.log(`  ${C.g}RuVector GNN Layer:${C.x} ${gnnTime.toFixed(2)}ms`);

    // Test ruvector compression
    const startCompress = process.hrtime.bigint();
    execSync('npx ruvector gnn compress --ratio 0.5 2>&1', { encoding: 'utf8', timeout: 10000 });
    const compressTime = Number(process.hrtime.bigint() - startCompress) / 1e6;

    console.log(`  ${C.g}RuVector Compression:${C.x} ${compressTime.toFixed(2)}ms`);

    benchmarkResults.ruvector = {
      gnnLayer: gnnTime,
      compression: compressTime,
      available: true
    };
  } catch (e) {
    console.log(`  ${C.y}RuVector native features unavailable${C.x}`);
    benchmarkResults.ruvector = { available: false };
  }
}

function benchmarkEndToEnd() {
  section('End-to-End Scan Benchmark');

  // Generate test files
  const testDir = '/tmp/ruvector-benchmark';
  try { fs.mkdirSync(testDir, { recursive: true }); } catch (e) {}

  const fileSizes = [1000, 10000, 50000, 100000];
  const results = [];

  for (const size of fileSizes) {
    const code = generateRandomCode(size);
    const filePath = `${testDir}/test_${size}.js`;
    fs.writeFileSync(filePath, code);

    // Benchmark scanning
    const startTime = process.hrtime.bigint();

    let matches = 0;
    for (const [vulnType, config] of Object.entries(CVE_PATTERNS)) {
      for (const patternDef of config.patterns) {
        const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);
        const found = code.match(regex);
        if (found) matches += found.length;
      }
    }

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    const linesPerSec = (code.split('\n').length * 1000) / elapsed;

    results.push({
      size,
      elapsed,
      matches,
      linesPerSec
    });

    console.log(`  ${formatBytes(size).padEnd(10)} → ${elapsed.toFixed(2)}ms (${formatNumber(linesPerSec)} lines/sec)`);
  }

  // Cleanup
  for (const size of fileSizes) {
    try { fs.unlinkSync(`${testDir}/test_${size}.js`); } catch (e) {}
  }
  try { fs.rmdirSync(testDir); } catch (e) {}

  benchmarkResults.endToEnd = results;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

function runBenchmarks() {
  console.clear();
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.B}${C.m}  RuVector CVE Scanner - Performance Benchmark${C.x}`);
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.d}  ${new Date().toISOString()}${C.x}`);
  console.log(`${C.d}  Iterations: ${CONFIG.iterations} | Warmup: ${CONFIG.warmupIterations}${C.x}\n`);

  const startTime = Date.now();

  // Run all benchmarks
  benchmarkPatternMatching();
  benchmarkVectorEmbedding();
  benchmarkGNNLayer();
  benchmarkAttackGraph();
  benchmarkMemory();
  benchmarkRuVector();
  benchmarkEndToEnd();

  const totalTime = Date.now() - startTime;

  // Summary
  console.log(`\n${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.B}${C.m}  BENCHMARK SUMMARY${C.x}`);
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}\n`);

  console.log(`  ${C.B}Pattern Matching:${C.x}`);
  console.log(`    ${formatNumber(benchmarkResults.patternMatching.opsPerSec)} ops/sec`);
  console.log(`    ${formatNumber(benchmarkResults.patternMatching.throughput)} chars/sec throughput`);

  console.log(`\n  ${C.B}Vector Embeddings:${C.x}`);
  console.log(`    ${formatNumber(benchmarkResults.vectorEmbedding.embeddingsPerSec)} embeddings/sec`);
  console.log(`    ${formatNumber(benchmarkResults.vectorEmbedding.simsPerSec)} similarity ops/sec`);

  console.log(`\n  ${C.B}GNN Layer:${C.x}`);
  console.log(`    ${formatNumber(benchmarkResults.gnnLayer.nodesPerSec)} nodes/sec`);
  console.log(`    ${benchmarkResults.gnnLayer.latency.toFixed(3)}ms latency per layer`);

  console.log(`\n  ${C.B}Attack Graph:${C.x}`);
  console.log(`    ${formatNumber(benchmarkResults.attackGraph.pageRankPerSec)} PageRank/sec`);
  console.log(`    ${formatNumber(benchmarkResults.attackGraph.bfsPerSec)} BFS traversals/sec`);

  console.log(`\n  ${C.B}Memory:${C.x}`);
  console.log(`    Peak heap: ${formatBytes(benchmarkResults.memory.finalHeap)}`);
  console.log(`    RSS: ${formatBytes(benchmarkResults.memory.rss)}`);

  console.log(`\n  ${C.B}Total Benchmark Time: ${(totalTime / 1000).toFixed(2)}s${C.x}`);

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: benchmarkResults,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: require('os').cpus().length
    },
    totalTime
  };

  fs.writeFileSync('./benchmark-results.json', JSON.stringify(report, null, 2));
  console.log(`\n  ${C.g}✓ Results saved to benchmark-results.json${C.x}`);
}

if (require.main === module) {
  runBenchmarks();
}

module.exports = { runBenchmarks, benchmarkResults };
