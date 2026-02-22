/**
 * Example 05 - BM25 + Vector Fusion Search
 *
 * Demonstrates agentdb's hybrid search capabilities:
 *   - KeywordIndex with BM25 scoring (inverted index)
 *   - HybridSearch combining vector similarity + keyword relevance
 *   - Three fusion strategies: RRF, Linear, Max
 *   - Configurable BM25 parameters (k1, b)
 *   - Term frequency / IDF analysis
 *
 * @module examples/intermediate/05-hybrid-search
 */

import {
  createKeywordIndex,
  createHybridSearch,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock Embedder (deterministic, no external model needed)
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
// Mock VectorBackend -- minimal implementation of the VectorBackend interface
// so we can demonstrate HybridSearch end-to-end.
// ---------------------------------------------------------------------------
class InMemoryVectorBackend {
  constructor(dimension = 384) {
    this._dimension = dimension;
    this._vectors = new Map();     // id -> { embedding, metadata }
  }

  get name() { return 'rvf'; }

  insert(id, embedding, metadata) {
    this._vectors.set(id, { embedding, metadata });
  }

  insertBatch(items) {
    for (const item of items) this.insert(item.id, item.embedding, item.metadata);
  }

  /** Brute-force k-NN cosine search */
  search(query, k, _options) {
    const results = [];
    for (const [id, { embedding, metadata }] of this._vectors) {
      let dot = 0, m1 = 0, m2 = 0;
      for (let i = 0; i < query.length; i++) {
        dot += query[i] * embedding[i];
        m1  += query[i] * query[i];
        m2  += embedding[i] * embedding[i];
      }
      const similarity = dot / (Math.sqrt(m1) * Math.sqrt(m2));
      results.push({ id, distance: 1 - similarity, similarity, metadata });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }

  remove(id) { return this._vectors.delete(id); }

  getStats() {
    return {
      count: this._vectors.size,
      dimension: this._dimension,
      metric: 'cosine',
      backend: 'rvf',
      memoryUsage: 0,
    };
  }

  async save() {}
  async load() {}
  close() {}
}

// ---------------------------------------------------------------------------
// Document corpus
// ---------------------------------------------------------------------------
const documents = [
  { id: 'doc-01', text: 'JWT authentication with refresh token rotation',              tags: ['auth', 'security'] },
  { id: 'doc-02', text: 'OAuth2 PKCE flow for single page applications',               tags: ['auth', 'frontend'] },
  { id: 'doc-03', text: 'SQL injection prevention using parameterized queries',         tags: ['security', 'database'] },
  { id: 'doc-04', text: 'Redis caching strategies for API responses',                   tags: ['caching', 'performance'] },
  { id: 'doc-05', text: 'WebSocket real-time notification system',                      tags: ['realtime', 'communication'] },
  { id: 'doc-06', text: 'GraphQL schema design patterns',                               tags: ['api', 'design'] },
  { id: 'doc-07', text: 'Docker container orchestration with Kubernetes',               tags: ['devops', 'infrastructure'] },
  { id: 'doc-08', text: 'CI/CD pipeline with GitHub Actions',                           tags: ['devops', 'automation'] },
  { id: 'doc-09', text: 'Database sharding for horizontal scalability',                 tags: ['database', 'scalability'] },
  { id: 'doc-10', text: 'Rate limiting with token bucket algorithm',                    tags: ['security', 'performance'] },
  { id: 'doc-11', text: 'Microservice communication with gRPC',                         tags: ['microservices', 'communication'] },
  { id: 'doc-12', text: 'Event sourcing and CQRS architecture',                         tags: ['architecture', 'patterns'] },
  { id: 'doc-13', text: 'Zero-trust security model implementation',                     tags: ['security', 'architecture'] },
  { id: 'doc-14', text: 'Serverless function cold start optimization',                  tags: ['serverless', 'performance'] },
  { id: 'doc-15', text: 'Load balancing with consistent hashing',                       tags: ['infrastructure', 'scalability'] },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(72));
  console.log('  Example 05 - BM25 + Vector Fusion Search (agentdb)');
  console.log('='.repeat(72));

  const embedder = new MockEmbedder(384);

  // -----------------------------------------------------------------------
  // Part 1: Standalone KeywordIndex with BM25
  // -----------------------------------------------------------------------
  console.log('\n--- Part 1: BM25 Keyword Index ---\n');

  const kwIndex = createKeywordIndex({ k1: 1.2, b: 0.75 });

  // Index all documents
  for (const doc of documents) {
    kwIndex.add(doc.id, doc.text, { tags: doc.tags });
  }

  const stats = kwIndex.getStats();
  console.log('Index statistics:');
  console.log(`  Documents : ${stats.documentCount}`);
  console.log(`  Terms     : ${stats.termCount}`);
  console.log(`  Avg length: ${stats.avgDocumentLength.toFixed(2)} tokens`);
  console.log(`  k1=${stats.k1}  b=${stats.b}`);

  // Search queries
  const queries = [
    'authentication token',
    'security injection',
    'scalability database sharding',
    'container orchestration',
    'caching performance optimization',
  ];

  for (const q of queries) {
    const results = kwIndex.search(q, 5);
    console.log(`\n  Query: "${q}"`);
    if (results.length === 0) {
      console.log('    (no results)');
    }
    for (const r of results) {
      const docText = documents.find(d => d.id === r.id)?.text ?? '';
      console.log(`    #${r.id}  score=${r.score.toFixed(4)}  "${docText}"`);
    }
  }

  // -----------------------------------------------------------------------
  // Part 2: Term analysis
  // -----------------------------------------------------------------------
  console.log('\n--- Part 2: Term / IDF Analysis ---\n');

  const sampleTerms = ['authentication', 'security', 'database', 'token', 'optimization', 'grpc'];
  for (const term of sampleTerms) {
    const df = kwIndex.getDocumentFrequency(term);
    console.log(`  "${term}" -> document frequency = ${df} / ${stats.documentCount}`);
  }

  console.log(`\n  Total unique indexed terms: ${kwIndex.getTerms().length}`);
  console.log(`  Sample terms: ${kwIndex.getTerms().slice(0, 12).join(', ')}`);

  // -----------------------------------------------------------------------
  // Part 3: Compare BM25 configurations
  // -----------------------------------------------------------------------
  console.log('\n--- Part 3: Comparing BM25 Configurations ---\n');

  const configs = [
    { k1: 1.2, b: 0.75, label: 'Standard (k1=1.2, b=0.75)' },
    { k1: 2.0, b: 0.75, label: 'High saturation (k1=2.0, b=0.75)' },
    { k1: 1.2, b: 0.0,  label: 'No length norm (k1=1.2, b=0.0)' },
    { k1: 0.5, b: 0.9,  label: 'Aggressive norm (k1=0.5, b=0.9)' },
  ];

  const compareQuery = 'security model implementation';

  for (const cfg of configs) {
    const idx = createKeywordIndex({ k1: cfg.k1, b: cfg.b });
    for (const doc of documents) idx.add(doc.id, doc.text, { tags: doc.tags });
    const res = idx.search(compareQuery, 5);
    console.log(`  Config: ${cfg.label}`);
    for (const r of res) {
      console.log(`    ${r.id}  score=${r.score.toFixed(4)}`);
    }
    console.log();
  }

  // -----------------------------------------------------------------------
  // Part 4: Full Hybrid Search (Vector + Keyword)
  // -----------------------------------------------------------------------
  console.log('--- Part 4: Hybrid Search (Vector + Keyword) ---\n');

  const vectorBackend = new InMemoryVectorBackend(384);

  // Build vector index
  for (const doc of documents) {
    const emb = await embedder.embed(doc.text);
    vectorBackend.insert(doc.id, emb, { tags: doc.tags });
  }

  // Create hybrid search with the vector backend and a fresh keyword index
  const hybridKwIndex = createKeywordIndex({ k1: 1.2, b: 0.75 });
  const hybrid = createHybridSearch(vectorBackend, hybridKwIndex);

  // Add documents to the keyword side as well
  for (const doc of documents) {
    hybrid.addDocument(doc.id, doc.text, { tags: doc.tags });
  }

  const hybridStats = hybrid.getStats();
  console.log('Hybrid index statistics:');
  console.log(`  Vector count    : ${hybridStats.vector.count}`);
  console.log(`  Vector dimension: ${hybridStats.vector.dimension}`);
  console.log(`  Keyword docs    : ${hybridStats.keyword.documentCount}`);
  console.log(`  Keyword terms   : ${hybridStats.keyword.termCount}`);

  // Demonstrate all three fusion methods
  const fusionMethods = ['rrf', 'linear', 'max'];
  const hybridQuery = 'authentication security token';
  const queryVector = await embedder.embed(hybridQuery);

  for (const method of fusionMethods) {
    console.log(`\n  Fusion: ${method.toUpperCase()} | Query: "${hybridQuery}"`);
    const results = await hybrid.search(
      { text: hybridQuery, vector: queryVector },
      { limit: 5, vectorWeight: 0.6, keywordWeight: 0.4, fusionMethod: method },
    );
    for (const r of results) {
      const vs = r.vectorScore !== undefined ? r.vectorScore.toFixed(4) : '  n/a ';
      const ks = r.keywordScore !== undefined ? r.keywordScore.toFixed(4) : '  n/a ';
      console.log(`    ${r.id}  combined=${r.score.toFixed(4)}  vec=${vs}  kw=${ks}  source=${r.source}`);
    }
  }

  // -----------------------------------------------------------------------
  // Part 5: Keyword-only and Vector-only through HybridSearch
  // -----------------------------------------------------------------------
  console.log('\n--- Part 5: Single-Mode Searches via HybridSearch ---\n');

  // Keyword-only
  const kwOnly = await hybrid.search(
    { text: 'container Docker Kubernetes' },
    { limit: 3 },
  );
  console.log('  Keyword-only search for "container Docker Kubernetes":');
  for (const r of kwOnly) {
    console.log(`    ${r.id}  score=${r.score.toFixed(4)}  source=${r.source}`);
  }

  // Vector-only
  const vecQuery = await embedder.embed('real-time messaging websocket');
  const vecOnly = await hybrid.search(
    { vector: vecQuery },
    { limit: 3 },
  );
  console.log('\n  Vector-only search for "real-time messaging websocket":');
  for (const r of vecOnly) {
    console.log(`    ${r.id}  score=${r.score.toFixed(4)}  source=${r.source}`);
  }

  // -----------------------------------------------------------------------
  // Part 6: Stopwords & dynamic index management
  // -----------------------------------------------------------------------
  console.log('\n--- Part 6: Dynamic Index Management ---\n');

  // Add custom stopwords
  const managedIndex = createKeywordIndex({ k1: 1.2, b: 0.75 }, ['custom', 'stop']);
  for (const doc of documents) managedIndex.add(doc.id, doc.text);

  console.log(`  Index size: ${managedIndex.size()}`);
  console.log(`  Has "doc-01": ${managedIndex.has('doc-01')}`);

  // Remove a document
  managedIndex.remove('doc-01');
  console.log(`  After removing doc-01: size=${managedIndex.size()}, has doc-01=${managedIndex.has('doc-01')}`);

  // Add new stopwords dynamically
  managedIndex.addStopwords(['docker', 'kubernetes']);
  const afterStopword = managedIndex.search('Docker container orchestration with Kubernetes', 3);
  console.log(`  After adding "docker","kubernetes" as stopwords, search returns ${afterStopword.length} result(s):`);
  for (const r of afterStopword) {
    console.log(`    ${r.id}  score=${r.score.toFixed(4)}`);
  }

  // Clear
  managedIndex.clear();
  console.log(`  After clear: size=${managedIndex.size()}`);

  console.log('\n' + '='.repeat(72));
  console.log('  Example 05 complete.');
  console.log('='.repeat(72) + '\n');
}

main().then(() => { process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
