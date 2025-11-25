#!/usr/bin/env node

/**
 * Ruvector Performance Benchmarks
 *
 * Comprehensive benchmarking suite for microbiome sequence similarity search
 */

const fs = require('fs');
const path = require('path');
const { VectorDB } = require('ruvector');

console.log('🚀 Ruvector Performance Benchmarks\n');
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

// Benchmark suite
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

  // Benchmark 1: Insertion speed
  console.log('\n📝 Benchmark 1: Insertion Performance');
  console.log('-'.repeat(70));

  const batchSizes = [1, 10, 100, Math.min(1000, Math.floor(data.length / 10))];
  const insertionResults = [];

  for (const batchSize of batchSizes) {
    const numBatches = Math.min(10, Math.floor(data.length / batchSize));
    const totalInserts = numBatches * batchSize;

    const testDb = new VectorDB({
      dimensions: data[0].vector.length,
      metric: 'cosine'
    });

    const insertStart = Date.now();

    for (let i = 0; i < numBatches; i++) {
      const batch = data.slice(i * batchSize, (i + 1) * batchSize).map(item => ({
        id: item.id,
        vector: new Float32Array(item.vector),
        metadata: {
          taxon: item.taxon,
          genus: item.genus,
          family: item.family,
          phylum: item.phylum
        }
      }));

      if (batchSize === 1) {
        await testDb.insert(batch[0]);
      } else {
        await testDb.insertBatch(batch);
      }
    }

    const insertTime = Date.now() - insertStart;
    const perInsert = insertTime / totalInserts;
    const insertsPerSec = 1000 / perInsert;

    insertionResults.push({
      batchSize,
      totalInserts,
      totalTime: insertTime,
      perInsert,
      insertsPerSec
    });

    console.log(`   Batch size ${batchSize.toString().padStart(4)}: ${formatTime(perInsert)}/insert, ${formatNumber(Math.floor(insertsPerSec))} inserts/sec`);
  }

  // Insert all data for query benchmarks
  console.log('\n   Building full index...');
  const fullInsertStart = Date.now();

  const FULL_BATCH_SIZE = 100;
  for (let i = 0; i < data.length; i += FULL_BATCH_SIZE) {
    const batch = data.slice(i, i + FULL_BATCH_SIZE).map(item => ({
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

    if ((i + FULL_BATCH_SIZE) % 1000 === 0) {
      process.stdout.write(`\r   Progress: ${Math.min(i + FULL_BATCH_SIZE, data.length)}/${data.length} (${(Math.min(i + FULL_BATCH_SIZE, data.length) / data.length * 100).toFixed(1)}%)`);
    }
  }

  const fullInsertTime = Date.now() - fullInsertStart;
  console.log(`\r   Progress: ${data.length}/${data.length} (100.0%) ✓`);
  console.log(`   Full index time: ${formatTime(fullInsertTime)}`);
  console.log(`   Average: ${formatTime(fullInsertTime / data.length)}/insert`);

  // Benchmark 2: Query performance
  console.log('\n🔍 Benchmark 2: Query Performance');
  console.log('-'.repeat(70));

  const queryKValues = [1, 5, 10, 20];
  const numQueries = Math.min(100, Math.floor(data.length / 10));
  const queryResults = [];

  for (const k of queryKValues) {
    const queryIndices = Array.from({ length: numQueries }, () =>
      Math.floor(Math.random() * data.length)
    );

    const queryStart = Date.now();

    for (const idx of queryIndices) {
      const queryVector = new Float32Array(data[idx].vector);
      await db.search({
        vector: queryVector,
        k: k
      });
    }

    const queryTime = Date.now() - queryStart;
    const perQuery = queryTime / numQueries;
    const queriesPerSec = 1000 / perQuery;

    queryResults.push({
      k,
      numQueries,
      totalTime: queryTime,
      perQuery,
      queriesPerSec
    });

    console.log(`   k=${k.toString().padStart(2)}: ${formatTime(perQuery)}/query, ${formatNumber(Math.floor(queriesPerSec))} queries/sec`);
  }

  // Benchmark 3: Accuracy (taxonomic agreement)
  console.log('\n🎯 Benchmark 3: Taxonomic Accuracy');
  console.log('-'.repeat(70));

  const accuracyK = [1, 5, 10];
  const numAccuracyTests = Math.min(50, Math.floor(data.length / 20));
  const accuracyResults = [];

  for (const k of accuracyK) {
    let genusCorrect = 0;
    let familyCorrect = 0;
    let phylumCorrect = 0;

    for (let i = 0; i < numAccuracyTests; i++) {
      const idx = Math.floor(Math.random() * data.length);
      const query = data[idx];
      const queryVector = new Float32Array(query.vector);

      const results = await db.search({
        vector: queryVector,
        k: k + 1 // +1 to exclude self
      });

      // Check if nearest neighbors (excluding self) match taxonomy
      const neighbors = results.filter(r => r.id !== query.id).slice(0, k);

      if (neighbors.length > 0) {
        const genusMatches = neighbors.filter(r => r.metadata.genus === query.genus).length;
        const familyMatches = neighbors.filter(r => r.metadata.family === query.family).length;
        const phylumMatches = neighbors.filter(r => r.metadata.phylum === query.phylum).length;

        if (genusMatches / neighbors.length >= 0.5) genusCorrect++;
        if (familyMatches / neighbors.length >= 0.5) familyCorrect++;
        if (phylumMatches / neighbors.length >= 0.5) phylumCorrect++;
      }
    }

    const genusAccuracy = genusCorrect / numAccuracyTests * 100;
    const familyAccuracy = familyCorrect / numAccuracyTests * 100;
    const phylumAccuracy = phylumCorrect / numAccuracyTests * 100;

    accuracyResults.push({
      k,
      genusAccuracy,
      familyAccuracy,
      phylumAccuracy
    });

    console.log(`   k=${k.toString().padStart(2)}: Genus ${genusAccuracy.toFixed(1)}%, Family ${familyAccuracy.toFixed(1)}%, Phylum ${phylumAccuracy.toFixed(1)}%`);
  }

  // Benchmark 4: Memory usage
  console.log('\n💾 Benchmark 4: Memory Usage');
  console.log('-'.repeat(70));

  const memUsage = process.memoryUsage();
  console.log(`   Heap used: ${formatSize(memUsage.heapUsed)}`);
  console.log(`   Heap total: ${formatSize(memUsage.heapTotal)}`);
  console.log(`   RSS: ${formatSize(memUsage.rss)}`);
  console.log(`   Per vector: ${formatSize(memUsage.heapUsed / data.length)}`);

  // Benchmark 5: Cross-taxa similarity
  console.log('\n🧬 Benchmark 5: Cross-Taxa Similarity Patterns');
  console.log('-'.repeat(70));

  const taxa = [...new Set(data.map(d => d.taxon))];
  const similarityMatrix = {};

  for (const taxon1 of taxa.slice(0, 5)) { // Sample 5 taxa
    similarityMatrix[taxon1] = {};

    const taxon1Samples = data.filter(d => d.taxon === taxon1).slice(0, 5);

    for (const taxon2 of taxa.slice(0, 5)) {
      const taxon2Samples = data.filter(d => d.taxon === taxon2).slice(0, 5);

      let totalSimilarity = 0;
      let count = 0;

      for (const sample1 of taxon1Samples) {
        const queryVector = new Float32Array(sample1.vector);
        const results = await db.search({
          vector: queryVector,
          k: 10
        });

        const taxon2Matches = results.filter(r => r.metadata.taxon === taxon2);
        if (taxon2Matches.length > 0) {
          totalSimilarity += taxon2Matches.reduce((sum, r) => sum + (1 - r.distance), 0) / taxon2Matches.length;
          count++;
        }
      }

      similarityMatrix[taxon1][taxon2] = count > 0 ? totalSimilarity / count : 0;
    }
  }

  console.log('\n   Similarity Matrix (top 5 taxa):');
  console.log('   ' + taxa.slice(0, 5).map(t => t.substring(0, 12).padEnd(12)).join(' '));
  for (const taxon1 of taxa.slice(0, 5)) {
    const row = taxa.slice(0, 5).map(taxon2 => {
      const sim = similarityMatrix[taxon1][taxon2];
      return sim.toFixed(2).padStart(12);
    }).join(' ');
    console.log(`   ${row}  ${taxon1.substring(0, 25)}`);
  }

  return {
    datasetSize,
    fileSize,
    loadTime,
    initTime,
    insertionResults,
    fullInsertTime,
    queryResults,
    accuracyResults,
    memUsage: memUsage.heapUsed,
    similarityMatrix
  };
}

// Main execution
async function main() {
  const datasetSizes = [1000, 5000, 10000];
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

  console.log('\n🏆 Best Performance:');

  // Best insertion rate
  const bestInsertion = allResults.reduce((best, r) => {
    const maxRate = Math.max(...r.insertionResults.map(ir => ir.insertsPerSec));
    return maxRate > best.rate ? { size: r.datasetSize, rate: maxRate } : best;
  }, { size: 0, rate: 0 });
  console.log(`   Insertion: ${formatNumber(Math.floor(bestInsertion.rate))} inserts/sec (${formatNumber(bestInsertion.size)} dataset)`);

  // Best query rate
  const bestQuery = allResults.reduce((best, r) => {
    const maxRate = Math.max(...r.queryResults.map(qr => qr.queriesPerSec));
    return maxRate > best.rate ? { size: r.datasetSize, rate: maxRate, time: 1000/maxRate } : best;
  }, { size: 0, rate: 0 });
  console.log(`   Query: ${formatNumber(Math.floor(bestQuery.rate))} queries/sec (${formatTime(bestQuery.time)}/query, ${formatNumber(bestQuery.size)} dataset)`);

  // Best accuracy
  const bestAccuracy = allResults.reduce((best, r) => {
    const maxAccuracy = Math.max(...r.accuracyResults.map(ar => ar.genusAccuracy));
    return maxAccuracy > best.accuracy ? { size: r.datasetSize, accuracy: maxAccuracy } : best;
  }, { size: 0, accuracy: 0 });
  console.log(`   Accuracy: ${bestAccuracy.accuracy.toFixed(1)}% genus-level (${formatNumber(bestAccuracy.size)} dataset)`);

  console.log('\n📊 Scaling Behavior:');
  console.log('   Dataset Size     Query Time     Memory/Vector');
  console.log('   ' + '-'.repeat(60));
  allResults.forEach(r => {
    const avgQueryTime = r.queryResults[0].perQuery; // k=1
    const memPerVector = r.memUsage / r.datasetSize;
    console.log(`   ${formatNumber(r.datasetSize).padStart(12)}     ${formatTime(avgQueryTime).padStart(10)}     ${formatSize(memPerVector).padStart(12)}`);
  });

  // Save results
  const resultsPath = path.join(__dirname, 'results', 'benchmark-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Full results saved to: ${resultsPath}`);

  console.log('\n✅ Benchmarks complete!');
}

main().catch(console.error);
