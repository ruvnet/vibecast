#!/usr/bin/env node

/**
 * Ruvector-based Hypergraph Implementation
 *
 * This script creates a vector database from the knowledge graph hypergraph,
 * enabling semantic search and similarity queries across ontology entities.
 *
 * Uses the official ruvector package with native Rust bindings.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Ruvector Hypergraph Generator\n');
console.log('='.repeat(70));

// Try to load ruvector
let VectorDB;
try {
  const ruvector = require('ruvector');
  VectorDB = ruvector.VectorDB;
  console.log('\n✓ Ruvector loaded successfully');
  console.log(`  Implementation: ${ruvector.getImplementationType()}`);
  console.log(`  Version: ${ruvector.getVersion().version}\n`);
} catch (error) {
  console.error('\n✗ Failed to load ruvector:', error.message);
  console.error('  Please run: npm install ruvector\n');
  process.exit(1);
}

// Load the hypergraph
const hypergraphPath = path.join(__dirname, 'knowledge-graph-hypergraph.json');
console.log(`📂 Loading hypergraph from: ${path.basename(hypergraphPath)}`);

let hypergraph;
try {
  const data = fs.readFileSync(hypergraphPath, 'utf8');
  hypergraph = JSON.parse(data);
  console.log(`✓ Loaded hypergraph with ${hypergraph.metadata.totalNodes} nodes\n`);
} catch (error) {
  console.error(`✗ Failed to load hypergraph: ${error.message}`);
  console.error('  Please run: node create-hypergraph.js first\n');
  process.exit(1);
}

console.log('🧮 Generating Vector Embeddings...\n');

/**
 * Generate a simple feature vector for an entity
 * Features (128 dimensions)
 */
function generateFeatureVector(entity, allEntities, domains) {
  const vector = new Array(128).fill(0);
  let idx = 0;

  // Domain encoding (one-hot-ish, 18 dims)
  const domainIdx = domains.indexOf(entity.domain);
  if (domainIdx >= 0 && domainIdx < 18) {
    vector[domainIdx] = 1.0;
  }
  idx = 18;

  // Physicality encoding (10 dims)
  const physicalityMap = {
    'ConceptualEntity': 0,
    'VirtualEntity': 1,
    'PhysicalEntity': 2,
    'HybridEntity': 3,
    'Technology': 4,
    'EconomicMechanism': 5,
    'DigitalEntity': 6,
    'VirtualProtocol': 7,
    'InformationResource': 8
  };
  const physIdx = physicalityMap[entity.physicality];
  if (physIdx !== undefined && physIdx < 10) {
    vector[idx + physIdx] = 1.0;
  }
  idx += 10;

  // Maturity and quality scores (10 dims)
  vector[idx++] = entity.authorityScore || 0;
  vector[idx++] = entity.qualityScore || 0;

  // Maturity level encoding
  const maturityMap = {
    'draft': 0.2,
    'emerging': 0.4,
    'developing': 0.5,
    'established': 0.7,
    'mature': 0.9,
    'production': 1.0,
    'comprehensive': 1.0
  };
  vector[idx++] = maturityMap[entity.maturity] || 0;

  // Relationship features (7 dims)
  vector[idx++] = entity.relationships ? entity.relationships.length : 0;
  vector[idx++] = entity.relationships ? entity.relationships.filter(r => r.type === 'subclassOf').length : 0;
  vector[idx++] = entity.relationships ? entity.relationships.filter(r => r.type === 'relatesTo').length : 0;

  // Fill remaining relationship dims
  idx += 4;

  // Text feature hashing (70 dims) - simple hash of title and domain
  const text = `${entity.title} ${entity.domainName || ''} ${entity.role || ''}`.toLowerCase();
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const hashIdx = idx + (charCode % 70);
    vector[hashIdx] = Math.min(1.0, vector[hashIdx] + 0.1);
  }

  // Normalize vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  // Convert to Float32Array for ruvector
  return new Float32Array(vector);
}

async function main() {
  // Generate vectors for all entities
  console.log('📊 Encoding entities as vectors...');
  const domains = hypergraph.metadata.domains;
  const vectors = [];

  let processed = 0;
  const total = hypergraph.nodes.length;

  for (const entity of hypergraph.nodes) {
    const vector = generateFeatureVector(entity, hypergraph.nodes, domains);

    vectors.push({
      id: entity.id,
      vector: vector,
      metadata: {
        title: entity.title,
        domain: entity.domain,
        domainName: entity.domainName,
        owlClass: entity.owlClass,
        physicality: entity.physicality,
        maturity: entity.maturity,
        authorityScore: entity.authorityScore,
        relationshipCount: entity.relationships ? entity.relationships.length : 0
      }
    });

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`\r  Progress: ${processed}/${total} entities (${Math.floor(processed/total*100)}%)`);
    }
  }

  console.log(`\r✓ Generated ${vectors.length} vector embeddings (128 dimensions)\n`);

  // Create vector database
  console.log('🗄️  Building Ruvector Database...\n');

  const db = new VectorDB({
    dimensions: 128  // Note: plural!
  });

  console.log('📥 Inserting vectors in batches...');
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await db.insertBatch(batch);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted: ${inserted}/${vectors.length} vectors`);
  }

  console.log('\n✓ All vectors inserted\n');

  // Get statistics
  const count = await db.len();
  console.log('📊 Database Statistics:');
  console.log('-'.repeat(70));
  console.log(`  Vector Count:     ${count.toLocaleString()}`);
  console.log(`  Dimension:        128`);
  console.log(`  Distance Metric:  cosine (default)\n`);

  // Demonstrate semantic search
  console.log('🔍 Semantic Search Demonstrations:\n');
  console.log('='.repeat(70));

  // Example 1: Find AI governance related concepts
  console.log('\n1️⃣  Query: "AI Governance and Ethics"');
  console.log('-'.repeat(70));

  const aiGovernanceEntity = hypergraph.nodes.find(n => n.title.includes('AI Governance'));
  if (aiGovernanceEntity) {
    const queryVector = generateFeatureVector(aiGovernanceEntity, hypergraph.nodes, domains);
    const results = await db.search({
      vector: queryVector,
      k: 5
    });

    console.log('Top 5 similar entities:\n');
    results.forEach((result, i) => {
      const entity = hypergraph.nodes.find(n => n.id === result.id);
      if (entity) {
        console.log(`  ${i + 1}. ${entity.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
        console.log(`     Domain: ${entity.domainName || entity.domain}, Maturity: ${entity.maturity}`);
      }
    });
  }

  // Example 2: Find blockchain concepts
  console.log('\n\n2️⃣  Query: "Blockchain Technology"');
  console.log('-'.repeat(70));

  const blockchainEntity = hypergraph.nodes.find(n => n.title === 'Blockchain');
  if (blockchainEntity) {
    const queryVector = generateFeatureVector(blockchainEntity, hypergraph.nodes, domains);
    const results = await db.search({
      vector: queryVector,
      k: 5
    });

    console.log('Top 5 similar entities:\n');
    results.forEach((result, i) => {
      const entity = hypergraph.nodes.find(n => n.id === result.id);
      if (entity) {
        console.log(`  ${i + 1}. ${entity.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
        console.log(`     Domain: ${entity.domainName || entity.domain}, ` +
                    `Relationships: ${entity.relationships ? entity.relationships.length : 0}`);
      }
    });
  }

  // Example 3: Find metaverse concepts
  console.log('\n\n3️⃣  Query: "Virtual Reality and Metaverse"');
  console.log('-'.repeat(70));

  const metaverseEntity = hypergraph.nodes.find(n =>
    n.domain === 'metaverse' && n.physicality === 'VirtualEntity'
  );
  if (metaverseEntity) {
    const queryVector = generateFeatureVector(metaverseEntity, hypergraph.nodes, domains);
    const results = await db.search({
      vector: queryVector,
      k: 5
    });

    console.log('Top 5 similar entities:\n');
    results.forEach((result, i) => {
      const entity = hypergraph.nodes.find(n => n.id === result.id);
      if (entity) {
        console.log(`  ${i + 1}. ${entity.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
        console.log(`     Physicality: ${entity.physicality}, Authority: ${entity.authorityScore}`);
      }
    });
  }

  // Performance benchmark
  console.log('\n\n⚡ Performance Benchmark:');
  console.log('='.repeat(70));

  const benchmarkQueries = 100;
  const randomVectors = [];

  for (let i = 0; i < benchmarkQueries; i++) {
    const randomEntity = hypergraph.nodes[Math.floor(Math.random() * hypergraph.nodes.length)];
    randomVectors.push(generateFeatureVector(randomEntity, hypergraph.nodes, domains));
  }

  console.log(`\nRunning ${benchmarkQueries} random queries...`);
  const startTime = Date.now();

  for (const vector of randomVectors) {
    await db.search({ vector, k: 10 });
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgLatency = totalTime / benchmarkQueries;
  const qps = (benchmarkQueries / (totalTime / 1000)).toFixed(0);

  console.log(`✓ Completed ${benchmarkQueries} queries in ${totalTime}ms`);
  console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`  Queries per second: ${qps}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Ruvector Hypergraph Complete!\n');
  console.log('📊 Summary:');
  console.log(`   • ${count.toLocaleString()} entities indexed`);
  console.log('   • 128-dimensional vectors');
  console.log('   • Native Rust implementation');
  console.log(`   • ${avgLatency.toFixed(2)}ms average query latency`);
  console.log(`   • ${qps} queries per second\n`);
  console.log('💡 Features:');
  console.log('   • Semantic search across ontology');
  console.log('   • Cross-domain similarity queries');
  console.log('   • HNSW approximate nearest neighbor');
  console.log('   • SIMD-accelerated vector operations\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
