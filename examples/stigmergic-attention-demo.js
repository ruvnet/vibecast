/**
 * Stigmergic Attention Demo
 *
 * Demonstrates pheromone-based attention for emergent coordination
 */

const { StigmergicAttention } = require('@ruvector/attention');

async function stigmergicAttentionDemo() {
  console.log('=== Stigmergic Attention Demo ===\n');

  // Initialize stigmergic attention field
  const stigmergic = new StigmergicAttention({
    dim: 64,
    gridResolution: 100,

    // Multiple pheromone types with different decay rates
    pheromoneTypes: [
      { name: 'short', decayRate: 0.5, spread: 0.1, weight: 0.3 },    // Seconds
      { name: 'medium', decayRate: 0.1, spread: 0.3, weight: 0.5 },   // Minutes
      { name: 'long', decayRate: 0.01, spread: 0.5, weight: 0.2 },    // Hours
    ],
  });

  console.log('Simulating agents depositing attention pheromones...\n');

  // Simulate multiple agents exploring semantic space
  const agents = [];
  for (let i = 0; i < 20; i++) {
    const position = new Float32Array(64);
    for (let j = 0; j < 64; j++) {
      position[j] = Math.random();
    }
    agents.push({ id: i, position });
  }

  // Agents deposit pheromones as they find interesting content
  for (let step = 0; step < 10; step++) {
    console.log(`Step ${step + 1}:`);

    for (const agent of agents) {
      // Agent evaluates current position
      const interestLevel = Math.random();

      if (interestLevel > 0.7) {
        // High interest - deposit long-lasting pheromone
        stigmergic.deposit(agent.position, 1.0, 'long');
        console.log(`  Agent ${agent.id}: Deposited LONG pheromone (interest: ${interestLevel.toFixed(2)})`);
      } else if (interestLevel > 0.4) {
        // Medium interest
        stigmergic.deposit(agent.position, 0.5, 'medium');
        console.log(`  Agent ${agent.id}: Deposited MEDIUM pheromone (interest: ${interestLevel.toFixed(2)})`);
      } else {
        // Low interest - just short-term marker
        stigmergic.deposit(agent.position, 0.2, 'short');
      }

      // Agent follows pheromone gradient (stigmergy)
      const gradient = stigmergic.gradient(agent.position);

      // Move in direction of gradient + random exploration
      for (let j = 0; j < 64; j++) {
        agent.position[j] += 0.1 * gradient[j] + 0.05 * (Math.random() - 0.5);
        // Keep in bounds [0, 1]
        agent.position[j] = Math.max(0, Math.min(1, agent.position[j]));
      }
    }

    // Evaporate pheromones
    stigmergic.evaporate();

    // Sample pheromone field at a random point
    const samplePoint = new Float32Array(64).map(() => Math.random());
    const level = stigmergic.sample(samplePoint);
    console.log(`  Pheromone level at sample point: ${level.toFixed(4)}\n`);
  }

  // Analyze emergent attention hotspots
  console.log('Analyzing emergent attention hotspots...\n');

  const hotspots = [];
  for (let i = 0; i < 100; i++) {
    const testPoint = new Float32Array(64).map(() => Math.random());
    const level = stigmergic.sample(testPoint);

    if (level > 0.5) {
      hotspots.push({ position: testPoint, level });
    }
  }

  hotspots.sort((a, b) => b.level - a.level);

  console.log(`Found ${hotspots.length} attention hotspots:`);
  for (let i = 0; i < Math.min(5, hotspots.length); i++) {
    console.log(`  Hotspot ${i + 1}: Intensity ${hotspots[i].level.toFixed(4)}`);
  }

  // Demonstrate pheromone-guided search
  console.log('\nDemonstrating pheromone-guided search...');

  const searcher = new Float32Array(64).map(() => Math.random());
  const searchSteps = 20;

  for (let step = 0; step < searchSteps; step++) {
    const gradient = stigmergic.gradient(searcher);
    const magnitude = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));

    // Follow gradient
    for (let j = 0; j < 64; j++) {
      searcher[j] += 0.2 * gradient[j];
      searcher[j] = Math.max(0, Math.min(1, searcher[j]));
    }

    if (step % 5 === 0) {
      const level = stigmergic.sample(searcher);
      console.log(`  Step ${step}: Pheromone level ${level.toFixed(4)}, gradient magnitude ${magnitude.toFixed(4)}`);
    }
  }

  const finalLevel = stigmergic.sample(searcher);
  console.log(`\nFinal position pheromone level: ${finalLevel.toFixed(4)}`);

  if (finalLevel > 0.5) {
    console.log('Successfully navigated to high-attention region!');
  } else {
    console.log('Ended in low-attention region.');
  }
}

// Run demo
stigmergicAttentionDemo()
  .then(() => console.log('\n=== Demo Complete ==='))
  .catch(err => console.error('Error:', err));
