#!/usr/bin/env node

/**
 * Ruvector Simple Performance Benchmark
 *
 * Streamlined benchmarking without multiple database instances
 */

const fs = require('fs');
const path = require('path');
const { VectorDB } = require('ruvector');

console.log('🚀 Ruvector Performance Benchmark\n');
console.log('='.repeat(70));

// Utility functions
function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatNumber(num) {
  return num.toLocaleString('en-US');
}

// Main benchmark
async function runBenchmark(datasetSize) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Dataset: ${formatNumber(datasetSize)} sequences`);
  console.log('='.repeat(70));

  const embeddingsPath = path.join(__dirname, 'data', `embeddings_${datasetSize}.json`);

  if (!fs.existsSync(embeddingsPath)) {
    console.log(`⚠️  Dataset not found: ${embeddingsPath}`);
    return null;
  }

  // Load data
  console.log('\n📥 Loading dataset...');
  const loadStart = Date.now();
  const data = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
  const loadTime = Date.now() - loadStart;
  const fileSize = fs.statSync(embeddingsPath).size;

  console.log(`   File size: ${formatSize(fileSize)}`);
  console.log(`   Load time: ${formatTime(loadTime)}`);
  console.log(`   Vectors: ${formatNumber(data.length)}`);
  console.log(`   Dimensions: ${data[0].vector.length}`);

  // Initialize database
  console.log('\n🔧 Initializing VectorDB...');
  const initStart = Date.now();
  const db = new VectorDB({
    dimensions: data[0].vector.length,
    metric: 'cosine'
  });
  const initTime = Date.now() - initStart;
  console.log(`   Init time: ${formatTime(initTime)}`);

  // Benchmark 1: Batch insertion
  console.log('\n📝 Benchmark 1: Batch Insertion');
  console.log('-'.repeat(70));

  const BATCH_SIZE = 100;
  const insertionTimes = [];

  console.log(`   Inserting ${formatNumber(data.length)} vectors in batches of ${BATCH_SIZE}...`);
  const totalInsertStart = Date.now();

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batchStart = Date.now();

    const batch = data.slice(i, i + BATCH_SIZE).map(item => ({
      id: item.id,
      vector: new Float32Array(item.vector),
      metadata: {
        taxon: item.taxon,
        genus: item.genus,
        family: item.family,
        phylum: item.phylum
      }
    }));

    await db.insertBatch(batch);

    const batchTime = Date.now() - batchStart;
    insertionTimes.push({ size: batch.length, time: batchTime });

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= data.length) {
      const progress = Math.min(i + BATCH_SIZE, data.length);
      process.stdout.write(`\r   Progress: ${formatNumber(progress)}/${formatNumber(data.length)} (${(progress / data.length * 100).toFixed(1)}%)`);
    }
  }

  const totalInsertTime = Date.now() - totalInsertStart;
  console.log(`\r   Progress: ${formatNumber(data.length)}/${formatNumber(data.length)} (100.0%) ✓`);
  console.log(`   Total time: ${formatTime(totalInsertTime)}`);
  console.log(`   Average: ${formatTime(totalInsertTime / data.length)}/vector`);
  console.log(`   Throughput: ${formatNumber(Math.floor(data.length / (totalInsertTime / 1000)))} inserts/sec`);

  // Verify count
  const count = await db.len();
  console.log(`   Verified: ${formatNumber(count)} vectors in database`);

  // Benchmark 2: Query performance
  console.log('\n🔍 Benchmark 2: Query Performance');
  console.log('-'.repeat(70));

  const queryKValues = [1, 5, 10, 20, 50];
  const NUM_QUERIES = 100;

  // Prepare random query vectors
  const queryIndices = Array.from({ length: NUM_QUERIES }, () =>
    Math.floor(Math.random() * data.length)
  );

  for (const k of queryKValues) {
    const queryStart = Date.now();

    for (const idx of queryIndices) {
      const queryVector = new Float32Array(data[idx].vector);
      await db.search({
        vector: queryVector,
        k: k
      });
    }

    const queryTime = Date.now() - queryStart;
    const perQuery = queryTime / NUM_QUERIES;
    const queriesPerSec = 1000 / perQuery;

    console.log(`   k=${k.toString().padStart(2)}: ${formatTime(perQuery)}/query, ${formatNumber(Math.floor(queriesPerSec))} queries/sec`);
  }

  // Benchmark 3: Taxonomic accuracy
  console.log('\n🎯 Benchmark 3: Taxonomic Accuracy');
  console.log('-'.repeat(70));

  const accuracyK = [1, 5, 10];
  const NUM_ACCURACY_TESTS = 50;

  for (const k of accuracyK) {
    let genusCorrect = 0;
    let familyCorrect = 0;
    let phylumCorrect = 0;
    let totalTests = 0;

    for (let i = 0; i < NUM_ACCURACY_TESTS; i++) {
      const idx = Math.floor(Math.random() * data.length);
      const query = data[idx];
      const queryVector = new Float32Array(query.vector);

      const results = await db.search({
        vector: queryVector,
        k: k + 1 // +1 to potentially include self
      });

      // Exclude self if present
      const neighbors = results.filter(r => r.id !== query.id).slice(0, k);

      if (neighbors.length > 0) {
        // Look up metadata for neighbors from original data
        const genusMatches = neighbors.filter(r => {
          const neighbor = data.find(d => d.id === r.id);
          return neighbor && neighbor.genus === query.genus;
        }).length;

        const familyMatches = neighbors.filter(r => {
          const neighbor = data.find(d => d.id === r.id);
          return neighbor && neighbor.family === query.family;
        }).length;

        const phylumMatches = neighbors.filter(r => {
          const neighbor = data.find(d => d.id === r.id);
          return neighbor && neighbor.phylum === query.phylum;
        }).length;

        if (genusMatches / neighbors.length >= 0.5) genusCorrect++;
        if (familyMatches / neighbors.length >= 0.5) familyCorrect++;
        if (phylumMatches / neighbors.length >= 0.5) phylumCorrect++;
        totalTests++;
      }
    }

    const genusAccuracy = genusCorrect / totalTests * 100;
    const familyAccuracy = familyCorrect / totalTests * 100;
    const phylumAccuracy = phylumCorrect / totalTests * 100;

    console.log(`   k=${k.toString().padStart(2)}: Genus ${genusAccuracy.toFixed(1)}%, Family ${familyAccuracy.toFixed(1)}%, Phylum ${phylumAccuracy.toFixed(1)}%`);
  }

  // Benchmark 4: Distance distribution
  console.log('\n📏 Benchmark 4: Distance Distribution');
  console.log('-'.repeat(70));

  const distanceBuckets = {
    '0.0-0.1': 0,
    '0.1-0.2': 0,
    '0.2-0.3': 0,
    '0.3-0.4': 0,
    '0.4-0.5': 0,
    '0.5+': 0
  };

  const NUM_DISTANCE_SAMPLES = 20;
  for (let i = 0; i < NUM_DISTANCE_SAMPLES; i++) {
    const idx = Math.floor(Math.random() * data.length);
    const queryVector = new Float32Array(data[idx].vector);

    const results = await db.search({
      vector: queryVector,
      k: 10
    });

    results.forEach(r => {
      const dist = r.distance !== undefined ? r.distance : (r.score !== undefined ? (1 - r.score) : 0.5);
      if (dist < 0.1) distanceBuckets['0.0-0.1']++;
      else if (dist < 0.2) distanceBuckets['0.1-0.2']++;
      else if (dist < 0.3) distanceBuckets['0.2-0.3']++;
      else if (dist < 0.4) distanceBuckets['0.3-0.4']++;
      else if (dist < 0.5) distanceBuckets['0.4-0.5']++;
      else distanceBuckets['0.5+']++;
    });
  }

  console.log('   Distance Range     Count      Percentage');
  const totalDist = Object.values(distanceBuckets).reduce((a, b) => a + b, 0);
  Object.entries(distanceBuckets).forEach(([range, count]) => {
    const pct = (count / totalDist * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / totalDist * 40));
    console.log(`   ${range.padEnd(15)}    ${count.toString().padStart(4)}      ${pct.padStart(5)}%  ${bar}`);
  });

  // Benchmark 5: Memory usage
  console.log('\n💾 Benchmark 5: Memory Usage');
  console.log('-'.repeat(70));

  const memUsage = process.memoryUsage();
  console.log(`   Heap used: ${formatSize(memUsage.heapUsed)}`);
  console.log(`   Heap total: ${formatSize(memUsage.heapTotal)}`);
  console.log(`   RSS: ${formatSize(memUsage.rss)}`);
  console.log(`   External: ${formatSize(memUsage.external)}`);
  console.log(`   Per vector: ${formatSize(memUsage.heapUsed / data.length)}`);

  // Benchmark 6: Example similarity search
  console.log('\n🔬 Benchmark 6: Example Similarity Search');
  console.log('-'.repeat(70));

  // Find a sample from E. coli
  const ecoliSample = data.find(d => d.taxon === 'Escherichia coli');
  if (ecoliSample) {
    console.log(`\n   Query: ${ecoliSample.taxon} (${ecoliSample.genus})`);
    const queryVector = new Float32Array(ecoliSample.vector);

    const results = await db.search({
      vector: queryVector,
      k: 10
    });

    console.log('\n   Top 10 similar sequences:');
    results.forEach((r, i) => {
      const neighbor = data.find(d => d.id === r.id);
      if (neighbor) {
        const match = r.id === ecoliSample.id ? ' ← SELF' : '';
        const sameGenus = neighbor.genus === ecoliSample.genus ? '✓' : '✗';
        const distance = r.distance !== undefined ? r.distance.toFixed(4) : (r.score !== undefined ? r.score.toFixed(4) : 'N/A');
        console.log(`   ${(i+1).toString().padStart(2)}. [${sameGenus}] ${neighbor.taxon.padEnd(35)} (dist: ${distance})${match}`);
      }
    });
  }

  return {
    datasetSize,
    dimensions: data[0].vector.length,
    fileSize,
    loadTime,
    initTime,
    totalInsertTime,
    insertThroughput: Math.floor(data.length / (totalInsertTime / 1000)),
    memoryUsage: memUsage.heapUsed,
    memoryPerVector: memUsage.heapUsed / data.length
  };
}

// Main execution
async function main() {
  // Run single dataset size from command line or default to 10000
  const size = parseInt(process.argv[2]) || 10000;
  const datasetSizes = [size];
  const allResults = [];

  for (const size of datasetSizes) {
    const result = await runBenchmark(size);
    if (result) {
      allResults.push(result);
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📈 BENCHMARK SUMMARY');
  console.log('='.repeat(70));

  console.log('\n📊 Results by Dataset Size:');
  console.log('   Size        Insert/sec    Memory/Vector    Init Time');
  console.log('   ' + '-'.repeat(60));
  allResults.forEach(r => {
    console.log(`   ${formatNumber(r.datasetSize).padStart(10)}  ${formatNumber(r.insertThroughput).padStart(12)}    ${formatSize(r.memoryPerVector).padStart(12)}    ${formatTime(r.initTime).padStart(10)}`);
  });

  // Save results
  const resultsPath = path.join(__dirname, 'results', 'simple-benchmark-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Full results saved to: ${resultsPath}`);

  console.log('\n✅ Benchmarks complete!');
}

main().catch(console.error);
