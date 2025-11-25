#!/usr/bin/env node

/**
 * Hypergraph Vector Search Implementation
 *
 * This script creates a searchable vector index from the knowledge graph hypergraph,
 * enabling semantic search and similarity queries across ontology entities.
 *
 * Uses a simple but effective in-memory vector search implementation.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Hypergraph Vector Search System\n');
console.log('='.repeat(70));

// Simple Vector Database Implementation
class SimpleVectorDB {
  constructor(dimension, metric = 'cosine') {
    this.dimension = dimension;
    this.metric = metric;
    this.vectors = [];
  }

  insert(entry) {
    if (entry.vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${entry.vector.length}`);
    }
    this.vectors.push({
      id: entry.id,
      vector: entry.vector,
      metadata: entry.metadata || {}
    });
  }

  insertBatch(entries) {
    entries.forEach(entry => this.insert(entry));
  }

  cosineSimilarity(v1, v2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  euclideanDistance(v1, v2) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      const diff = v1[i] - v2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  dotProduct(v1, v2) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += v1[i] * v2[i];
    }
    return sum;
  }

  search(query) {
    const { vector, k = 10, threshold = 0.0 } = query;

    // Calculate similarities for all vectors
    const results = this.vectors.map(entry => {
      let score;
      if (this.metric === 'cosine') {
        score = this.cosineSimilarity(vector, entry.vector);
      } else if (this.metric === 'euclidean') {
        score = 1 / (1 + this.euclideanDistance(vector, entry.vector));
      } else if (this.metric === 'dot') {
        score = this.dotProduct(vector, entry.vector);
      }

      return {
        id: entry.id,
        score: score,
        metadata: entry.metadata,
        vector: entry.vector
      };
    });

    // Filter by threshold and sort
    return results
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  get(id) {
    return this.vectors.find(v => v.id === id);
  }

  stats() {
    return {
      count: this.vectors.length,
      dimension: this.dimension,
      metric: this.metric,
      memoryUsage: JSON.stringify(this.vectors).length
    };
  }

  save(filepath) {
    const data = {
      dimension: this.dimension,
      metric: this.metric,
      vectors: this.vectors
    };
    fs.writeFileSync(filepath, JSON.stringify(data));
  }

  load(filepath) {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    this.dimension = data.dimension;
    this.metric = data.metric;
    this.vectors = data.vectors;
  }
}

console.log('\n✓ Vector DB implementation ready\n');

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
 * Generate a feature vector for an entity
 * Features (128 dimensions):
 * - Domain encoding (20 dims)
 * - Physicality encoding (10 dims)
 * - Maturity/quality scores (10 dims)
 * - Relationship features (10 dims)
 * - Text feature hashing (78 dims)
 */
function generateFeatureVector(entity, allDomains) {
  const vector = new Array(128).fill(0);
  let idx = 0;

  // Domain encoding (one-hot, 20 dims)
  const domainIdx = allDomains.indexOf(entity.domain);
  if (domainIdx >= 0 && domainIdx < 20) {
    vector[domainIdx] = 1.0;
  }
  idx = 20;

  // Physicality encoding (10 dims)
  const physicalityMap = {
    'ConceptualEntity': 0, 'VirtualEntity': 1, 'PhysicalEntity': 2,
    'HybridEntity': 3, 'Technology': 4, 'EconomicMechanism': 5,
    'DigitalEntity': 6, 'VirtualProtocol': 7, 'InformationResource': 8
  };
  const physIdx = physicalityMap[entity.physicality];
  if (physIdx !== undefined && physIdx < 10) {
    vector[idx + physIdx] = 1.0;
  }
  idx += 10;

  // Maturity and quality scores (10 dims)
  vector[idx++] = entity.authorityScore || 0;
  vector[idx++] = entity.qualityScore || 0;

  const maturityMap = {
    'draft': 0.2, 'emerging': 0.4, 'developing': 0.5,
    'established': 0.7, 'mature': 0.9, 'production': 1.0, 'comprehensive': 1.0
  };
  vector[idx++] = maturityMap[entity.maturity] || 0;

  vector[idx++] = entity.relationships ? Math.min(entity.relationships.length / 10, 1.0) : 0;
  vector[idx++] = entity.relationships ?
    Math.min(entity.relationships.filter(r => r.type === 'subclassOf').length / 5, 1.0) : 0;
  vector[idx++] = entity.relationships ?
    Math.min(entity.relationships.filter(r => r.type === 'relatesTo').length / 5, 1.0) : 0;

  // Padding
  idx += 4;

  // Text feature hashing (78 dims)
  const text = `${entity.title} ${entity.domainName || ''} ${entity.role || ''}`.toLowerCase();
  const words = text.split(/\s+/);

  // Create a simple hash-based text representation
  for (const word of words) {
    if (word.length > 0) {
      // Use multiple hash functions for better distribution
      for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const hashIdx = idx + ((charCode + i * 31) % 78);
        vector[hashIdx] = Math.min(1.0, vector[hashIdx] + 0.15);
      }
    }
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
console.log('📊 Encoding entities as vectors (128 dimensions)...');
const domains = hypergraph.metadata.domains;
const vectors = [];

let processed = 0;
const total = hypergraph.nodes.length;
const startTime = Date.now();

for (const entity of hypergraph.nodes) {
  const vector = generateFeatureVector(entity, domains);

  vectors.push({
    id: entity.id,
    vector: vector,
    metadata: {
      title: entity.title,
      domain: entity.domain,
      domainName: entity.domainName,
      owlClass: entity.owlClass,
      physicality: entity.physicality,
      role: entity.role,
      maturity: entity.maturity,
      authorityScore: entity.authorityScore,
      relationshipCount: entity.relationships ? entity.relationships.length : 0
    }
  });

  processed++;
  if (processed % 200 === 0 || processed === total) {
    const elapsed = Date.now() - startTime;
    const rate = Math.floor(processed / (elapsed / 1000));
    process.stdout.write(`\r  Progress: ${processed}/${total} (${Math.floor(processed/total*100)}%) - ${rate} vectors/sec  `);
  }
}

const encodingTime = Date.now() - startTime;
console.log(`\n✓ Generated ${vectors.length} vector embeddings in ${encodingTime}ms\n`);

// Create vector database
console.log('🗄️  Building Vector Database...\n');

const db = new SimpleVectorDB(128, 'cosine');

console.log('📥 Inserting vectors...');
const insertStart = Date.now();
db.insertBatch(vectors);
const insertTime = Date.now() - insertStart;

console.log(`✓ Inserted ${vectors.length} vectors in ${insertTime}ms\n`);

// Save database
console.log('💾 Saving database...');
db.save('./knowledge-graph-vectors.json');
console.log('✓ Database saved to: knowledge-graph-vectors.json\n');

// Get statistics
const stats = db.stats();
console.log('📊 Database Statistics:');
console.log('-'.repeat(70));
console.log(`  Vector Count:     ${stats.count.toLocaleString()}`);
console.log(`  Dimension:        ${stats.dimension}`);
console.log(`  Distance Metric:  ${stats.metric}`);
console.log(`  Memory Usage:     ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB\n`);

// Demonstrate semantic search
console.log('🔍 Semantic Search Demonstrations:\n');
console.log('='.repeat(70));

// Example 1: Find AI governance related concepts
console.log('\n1️⃣  Query: "AI Governance and Ethics"');
console.log('-'.repeat(70));

const aiGovernanceEntity = hypergraph.nodes.find(n =>
  n.title && n.title.toLowerCase().includes('ai governance')
);
if (aiGovernanceEntity) {
  const queryVector = generateFeatureVector(aiGovernanceEntity, domains);
  const results = db.search({ vector: queryVector, k: 6 });

  console.log(`Query entity: "${aiGovernanceEntity.title}"\n`);
  console.log('Top 5 similar entities:\n');
  results.slice(1, 6).forEach((result, i) => {
    const title = result.metadata.title.substring(0, 50).padEnd(50);
    const score = result.score.toFixed(4);
    const domain = (result.metadata.domainName || result.metadata.domain).padEnd(20);
    console.log(`  ${i + 1}. ${title} ${score}`);
    console.log(`     Domain: ${domain} Maturity: ${result.metadata.maturity}`);
  });
}

// Example 2: Find blockchain concepts
console.log('\n\n2️⃣  Query: "Blockchain Technology"');
console.log('-'.repeat(70));

const blockchainEntity = hypergraph.nodes.find(n => n.title === 'Blockchain');
if (blockchainEntity) {
  const queryVector = generateFeatureVector(blockchainEntity, domains);
  const results = db.search({ vector: queryVector, k: 6 });

  console.log(`Query entity: "${blockchainEntity.title}"\n`);
  console.log('Top 5 similar entities:\n');
  results.slice(1, 6).forEach((result, i) => {
    const title = result.metadata.title.substring(0, 50).padEnd(50);
    const score = result.score.toFixed(4);
    console.log(`  ${i + 1}. ${title} ${score}`);
    console.log(`     Domain: ${result.metadata.domain}, ` +
                `Relationships: ${result.metadata.relationshipCount}`);
  });
}

// Example 3: Find metaverse concepts
console.log('\n\n3️⃣  Query: "Virtual Reality and Metaverse"');
console.log('-'.repeat(70));

const avatarEntity = hypergraph.nodes.find(n =>
  n.domain === 'metaverse' && n.title && n.title.toLowerCase().includes('avatar')
);
if (avatarEntity) {
  const queryVector = generateFeatureVector(avatarEntity, domains);
  const results = db.search({ vector: queryVector, k: 6 });

  console.log(`Query entity: "${avatarEntity.title}"\n`);
  console.log('Top 5 similar entities:\n');
  results.slice(1, 6).forEach((result, i) => {
    const title = result.metadata.title.substring(0, 50).padEnd(50);
    const score = result.score.toFixed(4);
    console.log(`  ${i + 1}. ${title} ${score}`);
    console.log(`     Physicality: ${result.metadata.physicality}`);
  });
}

// Cross-domain analysis
console.log('\n\n📈 Cross-Domain Similarity Analysis:');
console.log('='.repeat(70));

const targetDomains = ['ai', 'blockchain', 'metaverse', 'bc', 'rb'];
const domainStats = {};

for (const domain of targetDomains) {
  const domainEntities = hypergraph.nodes.filter(n => n.domain === domain);
  if (domainEntities.length === 0) continue;

  // Pick a representative entity with relationships
  const entity = domainEntities.find(n => n.relationships && n.relationships.length > 0) ||
                 domainEntities[0];

  const queryVector = generateFeatureVector(entity, domains);
  const results = db.search({ vector: queryVector, k: 15 });

  // Count cross-domain matches (excluding the query itself)
  const crossDomain = results.slice(1).filter(r => r.metadata.domain !== domain);
  const crossDomainCount = crossDomain.length;

  domainStats[domain] = {
    entity: entity.title,
    crossDomainMatches: crossDomainCount,
    totalMatches: 14,
    topCrossDomain: crossDomain[0]
  };

  const percentage = Math.floor((crossDomainCount / 14) * 100);
  console.log(`\n${domain.toUpperCase().padEnd(15)} Cross-domain: ${crossDomainCount}/14 (${percentage}%)`);
  console.log(`  Query: "${entity.title.substring(0, 40)}"`);

  if (crossDomain[0]) {
    const topMatch = crossDomain[0];
    console.log(`  → Best cross-domain: ${topMatch.metadata.title.substring(0, 35)} ` +
                `[${topMatch.metadata.domain}] (${topMatch.score.toFixed(4)})`);
  }
}

// Performance benchmark
console.log('\n\n⚡ Performance Benchmark:');
console.log('='.repeat(70));

const benchmarkQueries = 500;
const randomVectors = [];

console.log(`\nGenerating ${benchmarkQueries} random query vectors...`);
for (let i = 0; i < benchmarkQueries; i++) {
  const randomEntity = hypergraph.nodes[Math.floor(Math.random() * hypergraph.nodes.length)];
  randomVectors.push(generateFeatureVector(randomEntity, domains));
}

console.log(`Running ${benchmarkQueries} similarity searches...`);
const benchStart = Date.now();

for (const vector of randomVectors) {
  db.search({ vector, k: 10 });
}

const benchEnd = Date.now();
const totalTime = benchEnd - benchStart;
const avgLatency = totalTime / benchmarkQueries;
const qps = Math.floor(benchmarkQueries / (totalTime / 1000));

console.log(`\n✓ Completed ${benchmarkQueries} queries in ${totalTime}ms`);
console.log(`  Average latency:     ${avgLatency.toFixed(2)}ms`);
console.log(`  Queries per second:  ${qps.toLocaleString()}`);
console.log(`  Throughput:          ${(qps * 10).toLocaleString()} comparisons/sec`);

// Summary
console.log('\n' + '='.repeat(70));
console.log('\n✅ Hypergraph Vector Search System Complete!\n');
console.log('📁 Generated Files:');
console.log('   • knowledge-graph-vectors.json - Vector database (JSON format)');
console.log(`   • Size: ${(fs.statSync('./knowledge-graph-vectors.json').size / 1024 / 1024).toFixed(2)} MB`);
console.log('\n💡 Usage Examples:');
console.log('   const db = new SimpleVectorDB(128);');
console.log('   db.load("./knowledge-graph-vectors.json");');
console.log('   const results = db.search({ vector: yourVector, k: 10 });');
console.log('\n🚀 Use Cases:');
console.log('   ✓ Semantic search across 1,580 ontology entities');
console.log('   ✓ Find similar concepts across 18 domains');
console.log('   ✓ Recommend related entities');
console.log('   ✓ Knowledge graph exploration');
console.log('   ✓ Automated categorization and clustering\n');
