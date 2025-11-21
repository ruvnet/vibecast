/**
 * Ruvector Integration Example
 * Demonstrates practical usage in a real application
 */

const native = require('ruvector-core-linux-x64-gnu');

// Simulate a simple document search system
class DocumentSearchSystem {
  constructor(dimensions = 384) {
    this.db = native.VectorDb.withDimensions(dimensions);
    this.dimensions = dimensions;
  }

  /**
   * Add documents to the search index
   */
  async indexDocuments(documents) {
    console.log(`Indexing ${documents.length} documents...`);

    const batch = documents.map(doc => ({
      id: doc.id,
      vector: this.generateEmbedding(doc.content)
    }));

    const ids = await this.db.insertBatch(batch);
    console.log(`✓ Indexed ${ids.length} documents`);

    return ids;
  }

  /**
   * Search for similar documents
   */
  async search(query, limit = 10) {
    const queryVector = this.generateEmbedding(query);

    const results = await this.db.search({
      vector: queryVector,
      k: limit
    });

    return results;
  }

  /**
   * Get document by ID
   */
  async getDocument(id) {
    return await this.db.get(id);
  }

  /**
   * Delete document from index
   */
  async deleteDocument(id) {
    return await this.db.delete(id);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const count = await this.db.len();
    const isEmpty = await this.db.isEmpty();

    return {
      totalDocuments: count,
      isEmpty: isEmpty,
      dimensions: this.dimensions
    };
  }

  /**
   * Generate embedding (placeholder - in production use real model)
   */
  generateEmbedding(text) {
    // In production, replace with:
    // - OpenAI embeddings API
    // - @xenova/transformers
    // - sentence-transformers via Python
    const vector = new Float32Array(this.dimensions);
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Math.random() - 0.5;
    }
    return vector;
  }
}

// Demo usage
async function demo() {
  console.log('='.repeat(60));
  console.log('Ruvector Integration Example');
  console.log('='.repeat(60) + '\n');

  const searchSystem = new DocumentSearchSystem(128);

  // Sample documents
  const documents = [
    { id: 'doc1', content: 'Introduction to machine learning' },
    { id: 'doc2', content: 'Deep learning with neural networks' },
    { id: 'doc3', content: 'Natural language processing basics' },
    { id: 'doc4', content: 'Computer vision and image recognition' },
    { id: 'doc5', content: 'Reinforcement learning algorithms' },
    { id: 'doc6', content: 'Python programming for data science' },
    { id: 'doc7', content: 'Statistical analysis and modeling' },
    { id: 'doc8', content: 'Web development with JavaScript' },
    { id: 'doc9', content: 'Database design and optimization' },
    { id: 'doc10', content: 'Cloud computing and AWS services' }
  ];

  // Index documents
  console.log('1. Indexing documents...');
  const indexStart = Date.now();
  await searchSystem.indexDocuments(documents);
  console.log(`   Time: ${Date.now() - indexStart}ms\n`);

  // Search
  console.log('2. Searching for "machine learning"...');
  const searchStart = Date.now();
  const results = await searchSystem.search('machine learning', 5);
  console.log(`   Time: ${Date.now() - searchStart}ms`);
  console.log('   Top results:');
  results.forEach((result, i) => {
    const doc = documents.find(d => d.id === result.id);
    console.log(`   ${i + 1}. ${result.id}: "${doc?.content}" (score: ${result.score.toFixed(4)})`);
  });
  console.log();

  // Get document
  console.log('3. Retrieving document by ID...');
  const doc = await searchSystem.getDocument('doc2');
  console.log(`   Found: ${doc ? doc.id : 'not found'}`);
  console.log();

  // Stats
  console.log('4. System statistics...');
  const stats = await searchSystem.getStats();
  console.log(`   Total documents: ${stats.totalDocuments}`);
  console.log(`   Dimensions: ${stats.dimensions}`);
  console.log(`   Is empty: ${stats.isEmpty}`);
  console.log();

  // Delete
  console.log('5. Deleting a document...');
  const deleted = await searchSystem.deleteDocument('doc10');
  console.log(`   Deleted: ${deleted}`);
  const newStats = await searchSystem.getStats();
  console.log(`   New count: ${newStats.totalDocuments}`);

  console.log('\n' + '='.repeat(60));
  console.log('✓ Demo completed successfully');
  console.log('='.repeat(60));
}

// Run demo
if (require.main === module) {
  demo().catch(console.error);
}

module.exports = DocumentSearchSystem;
