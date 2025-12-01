/**
 * Basic Swarm Attention Example
 *
 * Demonstrates simple particle swarm attention for semantic search
 */

const { SwarmAttention } = require('@ruvector/attention');

async function basicSwarmExample() {
  console.log('=== Basic Swarm Attention Example ===\n');

  // Initialize swarm attention with 50 agents
  const swarm = new SwarmAttention({
    dim: 128,
    numAgents: 50,
    swarmType: 'particle-swarm',
    topology: 'adaptive',

    // PSO parameters
    inertia: 0.7,
    cognitiveWeight: 1.5,
    socialWeight: 1.5,
    pheromoneWeight: 0.5,

    // Use hyperbolic space for hierarchical data
    useHyperbolic: true,
    curvature: -1.0,
  });

  // Sample data: Document embeddings
  const documents = [
    { id: 1, text: 'Machine learning fundamentals', embedding: new Float32Array(128) },
    { id: 2, text: 'Neural networks and deep learning', embedding: new Float32Array(128) },
    { id: 3, text: 'Natural language processing', embedding: new Float32Array(128) },
    { id: 4, text: 'Computer vision applications', embedding: new Float32Array(128) },
    { id: 5, text: 'Reinforcement learning basics', embedding: new Float32Array(128) },
  ];

  // Initialize with random embeddings (in practice, use real embeddings)
  for (const doc of documents) {
    for (let i = 0; i < 128; i++) {
      doc.embedding[i] = Math.random() - 0.5;
    }
  }

  // Query: "deep learning"
  const query = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    query[i] = Math.random() - 0.5;
  }

  // Prepare keys and values
  const keys = documents.map(d => d.embedding);
  const values = documents.map(d => d.embedding);

  console.log('Computing swarm attention...');
  const startTime = performance.now();

  // Compute attention using swarm
  const output = await swarm.compute(query, keys, values);

  const endTime = performance.now();
  console.log(`Computation time: ${(endTime - startTime).toFixed(2)}ms\n`);

  // Get attention weights to see which documents the swarm focused on
  const weights = await swarm.getAttentionWeights(query, keys);
  console.log('Attention distribution:');
  documents.forEach((doc, i) => {
    console.log(`  ${doc.text}: ${(weights[i] * 100).toFixed(1)}%`);
  });

  // Update swarm for next iteration (PSO dynamics)
  console.log('\nUpdating swarm positions...');
  swarm.updateSwarm();

  // Get swarm metrics
  const metrics = swarm.getMetrics();
  console.log('\nSwarm Metrics:');
  console.log(`  Agents: ${metrics.numAgents}`);
  console.log(`  Global best score: ${metrics.globalBestScore.toFixed(4)}`);
  console.log(`  Average velocity: ${metrics.avgVelocity.toFixed(4)}`);
  console.log(`  Convergence: ${(metrics.convergence * 100).toFixed(1)}%`);

  return output;
}

// Run example
basicSwarmExample()
  .then(() => console.log('\n=== Example Complete ==='))
  .catch(err => console.error('Error:', err));
