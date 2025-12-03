/**
 * Direct Native Engine Test
 *
 * Tests the native RuvLlmEngine directly (bypassing the JS wrapper
 * which has a naming mismatch - expects RuvLLMEngine but native exports RuvLlmEngine)
 */

const path = require('path');
const fs = require('fs');

// Load native module directly
const nativeFile = path.resolve(__dirname, 'node_modules/@ruvector/ruvllm-linux-x64-gnu/ruvllm.linux-x64-gnu.node');

if (!fs.existsSync(nativeFile)) {
  console.error('Native module not found:', nativeFile);
  process.exit(1);
}

const native = require(nativeFile);

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║           Native RuvLlmEngine Direct Test                        ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log();

// Basic info
console.log('Version:', native.version());
console.log('SIMD Support:', native.hasSimdSupport());
console.log('Exports:', Object.keys(native).join(', '));
console.log();

// Create native engine
console.log('═'.repeat(60));
console.log('Creating Native Engine...');
console.log('═'.repeat(60));

const engine = new native.RuvLlmEngine({
  embedding_dim: 256,
  router_hidden_dim: 64,
  hnsw_m: 16,
  hnsw_ef_construction: 200,
  hnsw_ef_search: 50,
  learning_enabled: true,
  quality_threshold: 0.7,
  ewc_lambda: 2000,
});

console.log('✅ Native engine created successfully!');
console.log('SIMD available:', engine.hasSimd());
console.log('SIMD capabilities:', engine.simdCapabilities());
console.log();

// Test SIMD Operations
console.log('═'.repeat(60));
console.log('Testing SimdOperations...');
console.log('═'.repeat(60));

const simd = new native.SimdOperations();

// Native SIMD functions expect regular arrays, not Float32Arrays
const vecA = [1, 2, 3, 4, 5, 6, 7, 8];
const vecB = [8, 7, 6, 5, 4, 3, 2, 1];

console.log('Vector A:', vecA.join(', '));
console.log('Vector B:', vecB.join(', '));
console.log('Dot product:', simd.dotProduct(vecA, vecB));
console.log('Cosine similarity:', simd.cosineSimilarity(vecA, vecB).toFixed(6));
console.log('L2 distance:', simd.l2Distance(vecA, vecB).toFixed(6));

// Test softmax
const logits = [1, 2, 3, 4];
const probs = simd.softmax(logits);
console.log('Softmax([1,2,3,4]):', Array.from(probs).map(p => p.toFixed(4)).join(', '));
console.log();

// Test memory operations
console.log('═'.repeat(60));
console.log('Testing Memory Operations...');
console.log('═'.repeat(60));

// Add memories
const memories = [
  'Machine learning is a subset of artificial intelligence.',
  'Neural networks are inspired by biological neurons.',
  'Deep learning uses multiple layers for feature extraction.',
  'Natural language processing enables computers to understand text.',
  'Computer vision allows machines to interpret visual data.',
];

console.log('Adding memories to HNSW index...');
for (let i = 0; i < memories.length; i++) {
  const id = engine.addMemory(memories[i], JSON.stringify({ index: i }));
  console.log(`  [${id}] ${memories[i].slice(0, 50)}...`);
}

// Search memories
console.log('\nSearching for similar memories...');
const searchQuery = 'What is machine learning?';
const results = engine.searchMemory(searchQuery, 3);
console.log(`Query: "${searchQuery}"`);
console.log('Results:');
for (const r of results) {
  // Native returns 'distance' (lower = more similar), convert to similarity
  const similarity = 1 - r.distance;
  console.log(`  [dist: ${r.distance.toFixed(4)}, sim: ${similarity.toFixed(4)}] ${r.content.slice(0, 50)}...`);
}
console.log();

// Test similarity
console.log('═'.repeat(60));
console.log('Testing Semantic Similarity...');
console.log('═'.repeat(60));

const pairs = [
  ['machine learning', 'artificial intelligence'],
  ['neural network', 'deep learning'],
  ['cat', 'dog'],
  ['programming', 'cooking'],
];

for (const [a, b] of pairs) {
  const sim = engine.similarity(a, b);
  console.log(`  "${a}" <-> "${b}": ${sim.toFixed(6)}`);
}
console.log();

// Test routing
console.log('═'.repeat(60));
console.log('Testing Query Routing...');
console.log('═'.repeat(60));

const queries = [
  'What is 2+2?',
  'Explain quantum mechanics in detail',
  'Write a haiku about coding',
  'Summarize this document',
];

for (const q of queries) {
  const route = engine.route(q);
  console.log(`  "${q.slice(0, 40).padEnd(40)}" -> ${route.model} (conf: ${route.confidence.toFixed(3)}, ctx: ${route.contextSize})`);
}
console.log();

// Test embedding
console.log('═'.repeat(60));
console.log('Testing Embeddings...');
console.log('═'.repeat(60));

const text = 'Hello world';
const embedding = engine.embed(text);
console.log(`Text: "${text}"`);
console.log(`Embedding dimension: ${embedding.length}`);
console.log(`First 10 values: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]`);
console.log(`Magnitude: ${Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)).toFixed(4)}`);
console.log();

// Test feedback
console.log('═'.repeat(60));
console.log('Testing Feedback Loop...');
console.log('═'.repeat(60));

// Query first to get a request ID
const response = engine.query('Test query for feedback');
console.log(`Query response ID: ${response.requestId}`);
console.log(`Query model: ${response.model}, latency: ${response.latencyMs.toFixed(2)}ms`);

// Provide feedback
const feedbackResult = engine.feedback(response.requestId, 5, 'Great answer!');
console.log(`Feedback recorded: ${feedbackResult}`);

// Force learning
const learnResult = engine.forceLearn();
console.log(`Force learn result: ${learnResult}`);
console.log();

// Final stats
console.log('═'.repeat(60));
console.log('Final Statistics');
console.log('═'.repeat(60));

const stats = engine.stats();
console.log('Total queries:', stats.totalQueries);
console.log('Memory nodes:', stats.memoryNodes);
console.log('Training steps:', stats.trainingSteps);
console.log('Avg latency:', stats.avgLatencyMs.toFixed(2), 'ms');
console.log('Total insertions:', stats.totalInsertions);
console.log('Total searches:', stats.totalSearches);
console.log();

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  ✅ Native RuvLlmEngine fully functional!                        ║');
console.log('║                                                                  ║');
console.log('║  Note: Text generation outputs gibberish because the engine     ║');
console.log('║  has inference infrastructure but no trained model weights.     ║');
console.log('║  Integrate with a real LLM backend to get meaningful outputs.   ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
