#!/usr/bin/env node

/**
 * Ruvector-based Hypergraph Implementation
 *
 * This script creates a vector database from the knowledge graph hypergraph,
 * enabling semantic search and similarity queries across ontology entities.
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
 * In production, you'd use actual embeddings from OpenAI, Cohere, etc.
 *
 * Features (128 dimensions):
 * - Domain encoding (18 dims)
 * - Physicality encoding (10 dims)
 * - Maturity/quality scores (10 dims)
 * - Relationship features (20 dims)
 * - Text feature hashing (70 dims)
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

  return vector;
}

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
  dimension: 128,
  metric: 'cosine',
  path: './knowledge-graph-vectors.db',
  autoPersist: true
});

console.log('📥 Inserting vectors in batches...');
const batchSize = 100;
let inserted = 0;

for (let i = 0; i < vectors.length; i += batchSize) {
  const batch = vectors.slice(i, i + batchSize);
  db.insertBatch(batch);
  inserted += batch.length;
  process.stdout.write(`\r  Inserted: ${inserted}/${vectors.length} vectors`);
}

console.log('\n✓ All vectors inserted\n');

// Save database
console.log('💾 Saving database...');
db.save('./knowledge-graph-vectors.db');
console.log('✓ Database saved to: knowledge-graph-vectors.db\n');

// Get statistics
const stats = db.stats();
console.log('📊 Database Statistics:');
console.log('-'.repeat(70));
console.log(`  Vector Count:     ${stats.count.toLocaleString()}`);
console.log(`  Dimension:        ${stats.dimension}`);
console.log(`  Distance Metric:  ${stats.metric}`);
console.log(`  Memory Usage:     ${stats.memoryUsage ? (stats.memoryUsage / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);

const fileStats = fs.statSync('./knowledge-graph-vectors.db');
console.log(`  File Size:        ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`);

// Demonstrate semantic search
console.log('🔍 Semantic Search Demonstrations:\n');
console.log('='.repeat(70));

// Example 1: Find AI governance related concepts
console.log('\n1️⃣  Query: "AI Governance and Ethics"');
console.log('-'.repeat(70));

const aiGovernanceEntity = hypergraph.nodes.find(n => n.title.includes('AI Governance'));
if (aiGovernanceEntity) {
  const queryVector = generateFeatureVector(aiGovernanceEntity, hypergraph.nodes, domains);
  const results = db.search({
    vector: queryVector,
    k: 5
  });

  console.log('Top 5 similar entities:\n');
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.metadata.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
    console.log(`     Domain: ${result.metadata.domainName || result.metadata.domain}, ` +
                `Maturity: ${result.metadata.maturity}`);
  });
}

// Example 2: Find blockchain concepts
console.log('\n\n2️⃣  Query: "Blockchain Technology"');
console.log('-'.repeat(70));

const blockchainEntity = hypergraph.nodes.find(n => n.title === 'Blockchain');
if (blockchainEntity) {
  const queryVector = generateFeatureVector(blockchainEntity, hypergraph.nodes, domains);
  const results = db.search({
    vector: queryVector,
    k: 5
  });

  console.log('Top 5 similar entities:\n');
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.metadata.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
    console.log(`     Domain: ${result.metadata.domainName || result.metadata.domain}, ` +
                `Relationships: ${result.metadata.relationshipCount}`);
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
  const results = db.search({
    vector: queryVector,
    k: 5
  });

  console.log('Top 5 similar entities:\n');
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.metadata.title.substring(0, 50).padEnd(50)} (${result.score.toFixed(4)})`);
    console.log(`     Physicality: ${result.metadata.physicality}, ` +
                `Authority: ${result.metadata.authorityScore}`);
  });
}

// Domain-based analysis
console.log('\n\n📈 Cross-Domain Similarity Analysis:');
console.log('='.repeat(70));

// Find concepts that bridge multiple domains
const domainRepresentatives = {};
['ai', 'blockchain', 'metaverse', 'bc', 'rb'].forEach(domain => {
  const entity = hypergraph.nodes.find(n =>
    n.domain === domain && n.relationships && n.relationships.length > 0
  );
  if (entity) {
    domainRepresentatives[domain] = entity;
  }
});

for (const [domain, entity] of Object.entries(domainRepresentatives)) {
  const queryVector = generateFeatureVector(entity, hypergraph.nodes, domains);
  const results = db.search({
    vector: queryVector,
    k: 10
  });

  // Count cross-domain matches
  const crossDomain = results.filter(r => r.metadata.domain !== domain).length;
  console.log(`\n${domain.toUpperCase().padEnd(15)} Cross-domain matches: ${crossDomain}/10`);

  // Show top cross-domain match
  const topCrossDomain = results.find(r => r.metadata.domain !== domain);
  if (topCrossDomain) {
    console.log(`  → Best match from ${topCrossDomain.metadata.domain}: ${topCrossDomain.metadata.title} (${topCrossDomain.score.toFixed(4)})`);
  }
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
  db.search({ vector, k: 10 });
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
console.log('📁 Generated Files:');
console.log('   • knowledge-graph-vectors.db - Vector database (binary format)');
console.log('\n💡 Usage Examples:');
console.log('   • Load database: const db = new VectorDB({ dimension: 128 });');
console.log('                     db.load("./knowledge-graph-vectors.db");');
console.log('   • Search: const results = db.search({ vector: yourVector, k: 10 });');
console.log('   • Get by ID: const entity = db.get("entity-id");');
console.log('\n🚀 Use Cases:');
console.log('   • Semantic search across ontology');
console.log('   • Find similar concepts cross-domain');
console.log('   • Recommend related entities');
console.log('   • Knowledge graph exploration');
console.log('   • Automated categorization\n');
