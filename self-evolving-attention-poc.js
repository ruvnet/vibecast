/**
 * Self-Evolving Attention Architecture - Proof of Concept
 *
 * Demonstrates the core concepts of self-evolving attention:
 * 1. Hybrid evolution (genetic + gradient-based)
 * 2. MoE expert evolution (birth, death, merging)
 * 3. Safety constraints and validation
 * 4. Multi-objective optimization
 * 5. Performance prediction
 */

const attention = require('@ruvector/attention');

// ============================================================================
// 1. ARCHITECTURE REPRESENTATION
// ============================================================================

class AttentionArchitecture {
  constructor(config) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = config.type || 'multi-head';
    this.dim = config.dim || 64;
    this.numHeads = config.numHeads || 4;
    this.dropout = config.dropout || 0.1;
    this.attentionScale = config.attentionScale || 1.0;

    // MoE specific
    if (this.type === 'moe') {
      this.numExperts = config.numExperts || 4;
      this.topK = config.topK || 2;
      this.expertTypes = config.expertTypes || Array(this.numExperts).fill('dot-product');
    }

    // Performance metrics
    this.metrics = {
      accuracy: 0,
      latency: 0,
      memory: 0,
      flops: 0,
    };

    this.age = 0;
    this.evaluationCount = 0;
  }

  clone() {
    const config = {
      type: this.type,
      dim: this.dim,
      numHeads: this.numHeads,
      dropout: this.dropout,
      attentionScale: this.attentionScale,
    };

    if (this.type === 'moe') {
      config.numExperts = this.numExperts;
      config.topK = this.topK;
      config.expertTypes = [...this.expertTypes];
    }

    return new AttentionArchitecture(config);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      dim: this.dim,
      numHeads: this.numHeads,
      dropout: this.dropout,
      attentionScale: this.attentionScale,
      numExperts: this.numExperts,
      topK: this.topK,
      expertTypes: this.expertTypes,
      metrics: this.metrics,
      age: this.age,
    };
  }
}

// ============================================================================
// 2. GENETIC OPERATORS
// ============================================================================

class GeneticOperators {
  static mutate(arch, mutationRate = 0.1) {
    const mutated = arch.clone();

    // Mutate discrete parameters
    if (Math.random() < mutationRate) {
      mutated.numHeads = Math.max(1, Math.min(16,
        mutated.numHeads + (Math.random() < 0.5 ? 1 : -1)
      ));
    }

    // Mutate continuous parameters (Gaussian noise)
    if (Math.random() < mutationRate) {
      mutated.dropout = Math.max(0, Math.min(0.5,
        mutated.dropout + (Math.random() - 0.5) * 0.1
      ));
    }

    if (Math.random() < mutationRate) {
      mutated.attentionScale = Math.max(0.1, Math.min(10.0,
        mutated.attentionScale + (Math.random() - 0.5) * 0.2
      ));
    }

    // Mutate architecture type (rare)
    if (Math.random() < mutationRate * 0.1) {
      const types = ['dot-product', 'multi-head', 'flash', 'linear', 'moe'];
      mutated.type = types[Math.floor(Math.random() * types.length)];
    }

    // MoE-specific mutations
    if (mutated.type === 'moe' && Math.random() < mutationRate) {
      mutated.numExperts = Math.max(2, Math.min(16,
        mutated.numExperts + (Math.random() < 0.5 ? 1 : -1)
      ));
    }

    return mutated;
  }

  static crossover(parent1, parent2) {
    const child1 = parent1.clone();
    const child2 = parent2.clone();

    // Uniform crossover for discrete
    if (Math.random() < 0.5) {
      [child1.numHeads, child2.numHeads] = [child2.numHeads, child1.numHeads];
    }

    if (Math.random() < 0.5) {
      [child1.type, child2.type] = [child2.type, child1.type];
    }

    // Interpolation for continuous
    const alpha = Math.random();
    const newDropout1 = alpha * parent1.dropout + (1 - alpha) * parent2.dropout;
    const newDropout2 = (1 - alpha) * parent1.dropout + alpha * parent2.dropout;

    child1.dropout = newDropout1;
    child2.dropout = newDropout2;

    const newScale1 = alpha * parent1.attentionScale + (1 - alpha) * parent2.attentionScale;
    const newScale2 = (1 - alpha) * parent1.attentionScale + alpha * parent2.attentionScale;

    child1.attentionScale = newScale1;
    child2.attentionScale = newScale2;

    return [child1, child2];
  }

  static tournamentSelect(population, fitness, tournamentSize = 3) {
    const tournament = [];

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      tournament.push({ arch: population[idx], fitness: fitness[idx] });
    }

    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0].arch;
  }
}

// ============================================================================
// 3. PERFORMANCE EVALUATOR
// ============================================================================

class PerformanceEvaluator {
  constructor() {
    // Simulate evaluation history for predictor training
    this.evaluationHistory = [];
  }

  async evaluate(arch, testData, fullEval = true) {
    arch.evaluationCount++;

    if (!fullEval && this.canPredict()) {
      // Fast prediction
      return this.predict(arch);
    }

    // Full evaluation
    const metrics = await this.fullEvaluate(arch, testData);

    arch.metrics = metrics;
    this.evaluationHistory.push({ arch: arch.toJSON(), metrics });

    return metrics;
  }

  async fullEvaluate(arch, testData) {
    const { query, keys, values } = testData;

    let attentionInstance;
    let output;

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Create attention instance based on architecture
      switch (arch.type) {
        case 'dot-product':
          attentionInstance = new attention.DotProductAttention(arch.dim, arch.attentionScale);
          break;

        case 'multi-head':
          attentionInstance = new attention.MultiHeadAttention(arch.dim, arch.numHeads);
          break;

        case 'flash':
          const blockSize = Math.max(8, Math.floor(arch.dim / arch.numHeads));
          attentionInstance = new attention.FlashAttention(arch.dim, blockSize);
          break;

        case 'linear':
          const numFeatures = Math.floor(arch.dim / 2);
          attentionInstance = new attention.LinearAttention(arch.dim, numFeatures);
          break;

        case 'moe':
          attentionInstance = new attention.MoEAttention({
            dim: arch.dim,
            numExperts: arch.numExperts || 4,
            topK: arch.topK || 2,
          });
          break;

        default:
          attentionInstance = new attention.MultiHeadAttention(arch.dim, arch.numHeads);
      }

      // Run attention computation multiple times for stability
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        output = attentionInstance.compute(query, keys, values);
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      // Calculate metrics
      const latency = (endTime - startTime) / iterations;
      const memory = (endMemory - startMemory) / (1024 * 1024); // MB

      // Simulate accuracy (in real scenario, would evaluate on labeled data)
      const accuracy = this.simulateAccuracy(arch, output);

      // Estimate FLOPs
      const flops = this.estimateFLOPs(arch);

      return {
        accuracy,
        latency,
        memory: Math.max(0, memory),
        flops,
      };

    } catch (error) {
      console.error(`Error evaluating architecture ${arch.id}:`, error.message);
      return {
        accuracy: 0,
        latency: Infinity,
        memory: Infinity,
        flops: Infinity,
      };
    }
  }

  simulateAccuracy(arch, output) {
    // Simulate accuracy based on architecture properties
    // In real scenario, would compare against ground truth

    let baseAccuracy = 0.7;

    // More heads generally help (up to a point)
    baseAccuracy += Math.min(0.1, arch.numHeads * 0.01);

    // Too much dropout hurts
    baseAccuracy -= arch.dropout * 0.2;

    // Optimal scale is around 1.0
    const scalePenalty = Math.abs(arch.attentionScale - 1.0) * 0.05;
    baseAccuracy -= scalePenalty;

    // Add some noise
    baseAccuracy += (Math.random() - 0.5) * 0.05;

    return Math.max(0, Math.min(1, baseAccuracy));
  }

  estimateFLOPs(arch) {
    // Simplified FLOPs estimation
    const seqLen = 100; // Assumed sequence length

    switch (arch.type) {
      case 'dot-product':
      case 'multi-head':
        // Q·K^T + softmax + A·V
        return 2 * seqLen * seqLen * arch.dim * (arch.numHeads || 1);

      case 'flash':
        // More efficient than standard attention
        return seqLen * seqLen * arch.dim * 0.5;

      case 'linear':
        // Linear complexity
        return 2 * seqLen * arch.dim * arch.dim;

      case 'moe':
        // Only top-k experts computed
        const avgExpertFLOPs = 2 * seqLen * seqLen * arch.dim;
        return avgExpertFLOPs * (arch.topK || 2);

      default:
        return 2 * seqLen * seqLen * arch.dim;
    }
  }

  canPredict() {
    return this.evaluationHistory.length > 50;
  }

  predict(arch) {
    // Simple k-NN predictor (in production, use neural network)
    if (!this.canPredict()) {
      return this.fullEvaluate(arch);
    }

    // Find k nearest architectures
    const k = 5;
    const distances = this.evaluationHistory.map(entry => ({
      distance: this.architectureDistance(arch, entry.arch),
      metrics: entry.metrics,
    }));

    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, k);

    // Average their metrics
    const predicted = {
      accuracy: neighbors.reduce((sum, n) => sum + n.metrics.accuracy, 0) / k,
      latency: neighbors.reduce((sum, n) => sum + n.metrics.latency, 0) / k,
      memory: neighbors.reduce((sum, n) => sum + n.metrics.memory, 0) / k,
      flops: neighbors.reduce((sum, n) => sum + n.metrics.flops, 0) / k,
    };

    return predicted;
  }

  architectureDistance(arch1, arch2) {
    // Compute distance between architectures
    let dist = 0;

    // Type difference
    dist += arch1.type !== arch2.type ? 1 : 0;

    // Normalized parameter differences
    dist += Math.abs(arch1.dim - arch2.dim) / 256;
    dist += Math.abs(arch1.numHeads - arch2.numHeads) / 16;
    dist += Math.abs(arch1.dropout - arch2.dropout);
    dist += Math.abs(arch1.attentionScale - arch2.attentionScale) / 10;

    return dist;
  }
}

// ============================================================================
// 4. SAFETY VALIDATOR
// ============================================================================

class SafetyValidator {
  constructor(constraints) {
    this.constraints = constraints || {
      maxFLOPs: 1e8,
      maxMemoryMB: 512,
      maxLatencyMs: 100,
      minAccuracy: 0.6,
      maxPerformanceDrop: 0.1,
    };

    this.baselineMetrics = null;
  }

  setBaseline(metrics) {
    this.baselineMetrics = metrics;
  }

  validate(arch) {
    const violations = [];

    // Check computational constraints
    if (arch.metrics.flops > this.constraints.maxFLOPs) {
      violations.push(`FLOPs exceeded: ${arch.metrics.flops} > ${this.constraints.maxFLOPs}`);
    }

    if (arch.metrics.memory > this.constraints.maxMemoryMB) {
      violations.push(`Memory exceeded: ${arch.metrics.memory} > ${this.constraints.maxMemoryMB}`);
    }

    if (arch.metrics.latency > this.constraints.maxLatencyMs) {
      violations.push(`Latency exceeded: ${arch.metrics.latency} > ${this.constraints.maxLatencyMs}`);
    }

    // Check performance constraints
    if (arch.metrics.accuracy < this.constraints.minAccuracy) {
      violations.push(`Accuracy too low: ${arch.metrics.accuracy} < ${this.constraints.minAccuracy}`);
    }

    // Check for regression
    if (this.baselineMetrics) {
      const drop = this.baselineMetrics.accuracy - arch.metrics.accuracy;
      if (drop > this.constraints.maxPerformanceDrop) {
        violations.push(`Performance regression: ${drop} > ${this.constraints.maxPerformanceDrop}`);
      }
    }

    // Check for NaN/Infinity
    if (!isFinite(arch.metrics.accuracy) || !isFinite(arch.metrics.latency)) {
      violations.push('Invalid metrics (NaN or Infinity)');
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  validatePopulation(population) {
    return population.map(arch => ({
      arch,
      validation: this.validate(arch),
    })).filter(result => result.validation.valid)
      .map(result => result.arch);
  }
}

// ============================================================================
// 5. HYBRID EVOLUTION ENGINE
// ============================================================================

class HybridEvolutionEngine {
  constructor(config) {
    this.populationSize = config.populationSize || 20;
    this.eliteSize = config.eliteSize || 4;
    this.mutationRate = config.mutationRate || 0.1;
    this.crossoverRate = config.crossoverRate || 0.7;

    this.evaluator = new PerformanceEvaluator();
    this.validator = new SafetyValidator(config.constraints);

    this.population = [];
    this.generation = 0;
    this.bestEver = null;

    this.history = [];
  }

  async initialize(baseArchitecture, testData) {
    console.log('Initializing population...');

    // Create initial population with variations
    this.population = [baseArchitecture];

    for (let i = 1; i < this.populationSize; i++) {
      const variant = GeneticOperators.mutate(baseArchitecture, 0.3);
      this.population.push(variant);
    }

    // Evaluate initial population
    await this.evaluatePopulation(testData);

    // Set baseline from best initial architecture
    const fitness = this.calculateFitness();
    const bestIdx = fitness.indexOf(Math.max(...fitness));
    this.validator.setBaseline(this.population[bestIdx].metrics);
    this.bestEver = this.population[bestIdx].clone();

    console.log(`Initial population: Best fitness = ${fitness[bestIdx].toFixed(4)}`);
  }

  async evolveGeneration(testData) {
    this.generation++;
    console.log(`\n=== Generation ${this.generation} ===`);

    // 1. Evaluate fitness
    const fitness = this.calculateFitness();

    // 2. Select elite
    const elite = this.selectElite(fitness);

    // 3. Generate offspring
    const offspring = [];

    while (offspring.length < this.populationSize - this.eliteSize) {
      if (Math.random() < this.crossoverRate) {
        // Crossover
        const parent1 = GeneticOperators.tournamentSelect(this.population, fitness);
        const parent2 = GeneticOperators.tournamentSelect(this.population, fitness);
        const [child1, child2] = GeneticOperators.crossover(parent1, parent2);
        offspring.push(child1);
        if (offspring.length < this.populationSize - this.eliteSize) {
          offspring.push(child2);
        }
      } else {
        // Mutation only
        const parent = GeneticOperators.tournamentSelect(this.population, fitness);
        const child = GeneticOperators.mutate(parent, this.mutationRate);
        offspring.push(child);
      }
    }

    // 4. Gradient refinement (simulate with small parameter adjustments)
    for (const child of offspring) {
      this.gradientRefine(child);
    }

    // 5. Create new population
    this.population = [...elite, ...offspring];

    // 6. Evaluate new population
    await this.evaluatePopulation(testData);

    // 7. Safety validation
    this.population = this.validator.validatePopulation(this.population);

    // Ensure we still have enough individuals
    while (this.population.length < this.populationSize) {
      const clone = this.bestEver.clone();
      const mutated = GeneticOperators.mutate(clone, 0.05);
      this.population.push(mutated);
    }

    // 8. Update best
    const newFitness = this.calculateFitness();
    const bestIdx = newFitness.indexOf(Math.max(...newFitness));
    const currentBest = this.population[bestIdx];

    if (!this.bestEver || this.computeFitness(currentBest) > this.computeFitness(this.bestEver)) {
      this.bestEver = currentBest.clone();
      console.log(`✓ New best architecture found! Fitness: ${newFitness[bestIdx].toFixed(4)}`);
    }

    // 9. Record history
    this.history.push({
      generation: this.generation,
      bestFitness: Math.max(...newFitness),
      avgFitness: newFitness.reduce((a, b) => a + b) / newFitness.length,
      bestArchitecture: currentBest.toJSON(),
    });

    // 10. Report
    console.log(`Best fitness: ${newFitness[bestIdx].toFixed(4)}`);
    console.log(`Avg fitness:  ${(newFitness.reduce((a, b) => a + b) / newFitness.length).toFixed(4)}`);
    console.log(`Best arch:    ${currentBest.type}, heads=${currentBest.numHeads}, dropout=${currentBest.dropout.toFixed(3)}`);
    console.log(`Metrics:      acc=${currentBest.metrics.accuracy.toFixed(3)}, lat=${currentBest.metrics.latency.toFixed(2)}ms`);
  }

  async evaluatePopulation(testData) {
    // Evaluate in parallel with some using prediction
    const promises = this.population.map((arch, i) => {
      // Use prediction for 50% after enough history
      const fullEval = !this.evaluator.canPredict() || Math.random() < 0.5;
      return this.evaluator.evaluate(arch, testData, fullEval);
    });

    await Promise.all(promises);
  }

  calculateFitness() {
    return this.population.map(arch => this.computeFitness(arch));
  }

  computeFitness(arch) {
    // Multi-objective fitness with weights
    const weights = {
      accuracy: 1.0,
      latency: 0.5,
      memory: 0.3,
      flops: 0.2,
    };

    // Normalize and invert for minimization objectives
    const fitness =
      weights.accuracy * arch.metrics.accuracy +
      weights.latency * (1.0 / (1.0 + arch.metrics.latency / 100)) +
      weights.memory * (1.0 / (1.0 + arch.metrics.memory / 100)) +
      weights.flops * (1.0 / (1.0 + arch.metrics.flops / 1e7));

    return fitness;
  }

  selectElite(fitness) {
    const indexed = this.population.map((arch, i) => ({ arch, fitness: fitness[i] }));
    indexed.sort((a, b) => b.fitness - a.fitness);
    return indexed.slice(0, this.eliteSize).map(item => item.arch);
  }

  gradientRefine(arch) {
    // Simulate gradient-based refinement
    // In real implementation, would use backprop to adjust continuous params

    // Small adjustments to continuous parameters
    const learningRate = 0.01;

    // Simulate gradient (random walk toward better values)
    arch.dropout += (Math.random() - 0.5) * learningRate;
    arch.dropout = Math.max(0, Math.min(0.5, arch.dropout));

    arch.attentionScale += (Math.random() - 0.5) * learningRate * 2;
    arch.attentionScale = Math.max(0.1, Math.min(10.0, arch.attentionScale));
  }

  getParetoFront() {
    // Find Pareto-optimal architectures
    const pareto = [];

    for (const arch of this.population) {
      let dominated = false;

      for (const other of this.population) {
        if (arch === other) continue;

        // Check if 'other' dominates 'arch'
        if (this.dominates(other, arch)) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        pareto.push(arch);
      }
    }

    return pareto;
  }

  dominates(arch1, arch2) {
    // arch1 dominates arch2 if it's better or equal in all objectives
    // and strictly better in at least one

    const better =
      arch1.metrics.accuracy >= arch2.metrics.accuracy &&
      arch1.metrics.latency <= arch2.metrics.latency &&
      arch1.metrics.memory <= arch2.metrics.memory &&
      arch1.metrics.flops <= arch2.metrics.flops;

    const strictlyBetter =
      arch1.metrics.accuracy > arch2.metrics.accuracy ||
      arch1.metrics.latency < arch2.metrics.latency ||
      arch1.metrics.memory < arch2.metrics.memory ||
      arch1.metrics.flops < arch2.metrics.flops;

    return better && strictlyBetter;
  }

  getBest() {
    return this.bestEver;
  }

  getHistory() {
    return this.history;
  }
}

// ============================================================================
// 6. MOE EXPERT EVOLUTION
// ============================================================================

class EvolvingMoEExpert {
  constructor(id, type = 'dot-product', usage = 0) {
    this.id = id;
    this.type = type;
    this.usage = usage;
    this.usageHistory = [];
    this.specialization = [];
  }

  updateUsage(newUsage) {
    this.usage = newUsage;
    this.usageHistory.push(newUsage);

    // Keep only recent history
    if (this.usageHistory.length > 100) {
      this.usageHistory.shift();
    }
  }

  getAverageUsage() {
    if (this.usageHistory.length === 0) return 0;
    return this.usageHistory.reduce((a, b) => a + b) / this.usageHistory.length;
  }
}

class MoEEvolutionManager {
  constructor(config) {
    this.minExperts = config.minExperts || 2;
    this.maxExperts = config.maxExperts || 16;
    this.birthThreshold = config.birthThreshold || 0.8;
    this.deathThreshold = config.deathThreshold || 0.05;
    this.mergeThreshold = config.mergeThreshold || 0.9;

    this.experts = [];
    this.nextId = 0;

    // Initialize with minimum experts
    for (let i = 0; i < this.minExperts; i++) {
      this.experts.push(new EvolvingMoEExpert(this.nextId++, 'dot-product'));
    }
  }

  evolveExperts(usageStats) {
    console.log('\n--- Expert Evolution ---');
    console.log(`Current experts: ${this.experts.length}`);

    // Update usage
    this.experts.forEach((expert, i) => {
      expert.updateUsage(usageStats[i] || 0);
    });

    // 1. Birth: Spawn new experts from high-usage ones
    this.spawnExperts();

    // 2. Death: Remove low-usage experts
    this.pruneExperts();

    // 3. Merge: Combine similar experts
    this.mergeExperts();

    console.log(`After evolution: ${this.experts.length} experts`);
  }

  spawnExperts() {
    if (this.experts.length >= this.maxExperts) return;

    const highUsageExperts = this.experts.filter(e =>
      e.getAverageUsage() > this.birthThreshold
    );

    for (const parent of highUsageExperts) {
      if (this.experts.length >= this.maxExperts) break;

      // Create child expert with mutation
      const childType = Math.random() < 0.8 ?
        parent.type :
        ['dot-product', 'flash', 'linear', 'hyperbolic'][Math.floor(Math.random() * 4)];

      const child = new EvolvingMoEExpert(this.nextId++, childType);
      this.experts.push(child);

      console.log(`  ✓ Spawned expert ${child.id} (type: ${childType}) from parent ${parent.id}`);
    }
  }

  pruneExperts() {
    if (this.experts.length <= this.minExperts) return;

    const toRemove = this.experts.filter(e =>
      e.getAverageUsage() < this.deathThreshold
    );

    // Ensure we don't go below minimum
    const canRemove = Math.min(
      toRemove.length,
      this.experts.length - this.minExperts
    );

    for (let i = 0; i < canRemove; i++) {
      const expert = toRemove[i];
      const idx = this.experts.indexOf(expert);
      if (idx !== -1) {
        this.experts.splice(idx, 1);
        console.log(`  ✗ Removed expert ${expert.id} (low usage: ${expert.getAverageUsage().toFixed(3)})`);
      }
    }
  }

  mergeExperts() {
    // Simple merge: combine experts with same type and similar usage
    const expertsByType = {};

    for (const expert of this.experts) {
      if (!expertsByType[expert.type]) {
        expertsByType[expert.type] = [];
      }
      expertsByType[expert.type].push(expert);
    }

    for (const type in expertsByType) {
      const group = expertsByType[type];
      if (group.length < 2) continue;

      // Find pairs with similar usage
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = group[i];
          const e2 = group[j];

          const usageSim = 1 - Math.abs(e1.getAverageUsage() - e2.getAverageUsage());

          if (usageSim > this.mergeThreshold && this.experts.length > this.minExperts) {
            // Merge e2 into e1
            const avgUsage = (e1.getAverageUsage() + e2.getAverageUsage()) / 2;
            e1.usage = avgUsage;
            e1.usageHistory = [...e1.usageHistory, ...e2.usageHistory].slice(-100);

            const idx = this.experts.indexOf(e2);
            if (idx !== -1) {
              this.experts.splice(idx, 1);
              console.log(`  ⊕ Merged expert ${e2.id} into ${e1.id}`);
            }

            break;
          }
        }
      }
    }
  }

  getExpertConfig() {
    return {
      numExperts: this.experts.length,
      expertTypes: this.experts.map(e => e.type),
      expertUsage: this.experts.map(e => e.getAverageUsage()),
    };
  }
}

// ============================================================================
// 7. DEMONSTRATION
// ============================================================================

async function demonstrateSelfEvolvingAttention() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     SELF-EVOLVING ATTENTION ARCHITECTURE - DEMONSTRATION      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Generate test data
  const DIM = 64;
  const NUM_KEYS = 10;

  const createVec = (dim) => {
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      v[i] = Math.random() * 2 - 1;
    }
    return v;
  };

  const normalize = (v) => {
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] ** 2;
    norm = Math.sqrt(norm);
    const result = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) result[i] = v[i] / norm;
    return result;
  };

  const testData = {
    query: normalize(createVec(DIM)),
    keys: Array.from({ length: NUM_KEYS }, () => normalize(createVec(DIM))),
    values: Array.from({ length: NUM_KEYS }, () => normalize(createVec(DIM))),
  };

  // -------------------------------------------------------------------------
  // Part 1: Hybrid Evolution
  // -------------------------------------------------------------------------

  console.log('PART 1: Hybrid Evolution (Genetic + Gradient)');
  console.log('═'.repeat(65) + '\n');

  const baseArchitecture = new AttentionArchitecture({
    type: 'multi-head',
    dim: DIM,
    numHeads: 4,
    dropout: 0.1,
    attentionScale: 1.0,
  });

  const evolutionEngine = new HybridEvolutionEngine({
    populationSize: 15,
    eliteSize: 3,
    mutationRate: 0.15,
    crossoverRate: 0.7,
    constraints: {
      maxFLOPs: 1e8,
      maxMemoryMB: 512,
      maxLatencyMs: 50,
      minAccuracy: 0.6,
      maxPerformanceDrop: 0.15,
    },
  });

  await evolutionEngine.initialize(baseArchitecture, testData);

  // Evolve for several generations
  for (let gen = 0; gen < 5; gen++) {
    await evolutionEngine.evolveGeneration(testData);
  }

  const bestArchitecture = evolutionEngine.getBest();
  console.log('\n✓ Best evolved architecture:');
  console.log(JSON.stringify(bestArchitecture.toJSON(), null, 2));

  // -------------------------------------------------------------------------
  // Part 2: Pareto Front
  // -------------------------------------------------------------------------

  console.log('\n\nPART 2: Multi-Objective Optimization (Pareto Front)');
  console.log('═'.repeat(65) + '\n');

  const paretoFront = evolutionEngine.getParetoFront();
  console.log(`Found ${paretoFront.length} Pareto-optimal architectures:\n`);

  paretoFront.forEach((arch, i) => {
    console.log(`${i + 1}. Type: ${arch.type.padEnd(12)} | ` +
      `Acc: ${arch.metrics.accuracy.toFixed(3)} | ` +
      `Lat: ${arch.metrics.latency.toFixed(2)}ms | ` +
      `Mem: ${arch.metrics.memory.toFixed(1)}MB`);
  });

  // -------------------------------------------------------------------------
  // Part 3: MoE Expert Evolution
  // -------------------------------------------------------------------------

  console.log('\n\nPART 3: MoE Expert Evolution (Birth, Death, Merge)');
  console.log('═'.repeat(65) + '\n');

  const moeManager = new MoEEvolutionManager({
    minExperts: 2,
    maxExperts: 8,
    birthThreshold: 0.7,
    deathThreshold: 0.1,
    mergeThreshold: 0.85,
  });

  // Simulate expert evolution over time
  for (let epoch = 0; epoch < 5; epoch++) {
    console.log(`\nEpoch ${epoch + 1}:`);

    // Simulate varying expert usage
    const usageStats = moeManager.experts.map(() => Math.random());

    moeManager.evolveExperts(usageStats);

    const config = moeManager.getExpertConfig();
    console.log(`Expert configuration:`, config);
  }

  // -------------------------------------------------------------------------
  // Part 4: Evolution History Visualization
  // -------------------------------------------------------------------------

  console.log('\n\nPART 4: Evolution History');
  console.log('═'.repeat(65) + '\n');

  const history = evolutionEngine.getHistory();

  console.log('Gen | Best Fitness | Avg Fitness | Best Type    | Heads | Dropout');
  console.log('----+-------------+-------------+--------------+-------+--------');

  history.forEach(entry => {
    console.log(
      `${entry.generation.toString().padStart(3)} | ` +
      `${entry.bestFitness.toFixed(4).padStart(11)} | ` +
      `${entry.avgFitness.toFixed(4).padStart(11)} | ` +
      `${entry.bestArchitecture.type.padEnd(12)} | ` +
      `${entry.bestArchitecture.numHeads.toString().padStart(5)} | ` +
      `${entry.bestArchitecture.dropout.toFixed(3)}`
    );
  });

  // -------------------------------------------------------------------------
  // Part 5: Performance Improvement
  // -------------------------------------------------------------------------

  console.log('\n\nPART 5: Performance Improvement Summary');
  console.log('═'.repeat(65) + '\n');

  const initialFitness = history[0].bestFitness;
  const finalFitness = history[history.length - 1].bestFitness;
  const improvement = ((finalFitness - initialFitness) / initialFitness) * 100;

  console.log(`Initial best fitness:  ${initialFitness.toFixed(4)}`);
  console.log(`Final best fitness:    ${finalFitness.toFixed(4)}`);
  console.log(`Improvement:           ${improvement.toFixed(2)}%`);
  console.log(`Total evaluations:     ${evolutionEngine.evaluator.evaluationHistory.length}`);
  console.log(`Generations evolved:   ${history.length}`);

  // Compare initial vs final architecture
  const initialArch = history[0].bestArchitecture;
  const finalArch = history[history.length - 1].bestArchitecture;

  console.log('\nArchitecture Evolution:');
  console.log('  Initial: ' + JSON.stringify({
    type: initialArch.type,
    numHeads: initialArch.numHeads,
    dropout: initialArch.dropout.toFixed(3),
    scale: initialArch.attentionScale.toFixed(3),
  }));
  console.log('  Final:   ' + JSON.stringify({
    type: finalArch.type,
    numHeads: finalArch.numHeads,
    dropout: finalArch.dropout.toFixed(3),
    scale: finalArch.attentionScale.toFixed(3),
  }));

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                     DEMONSTRATION COMPLETE                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('Key Achievements:');
  console.log(`  ✓ Successfully evolved attention architectures`);
  console.log(`  ✓ Found ${paretoFront.length} Pareto-optimal solutions`);
  console.log(`  ✓ Demonstrated MoE expert lifecycle management`);
  console.log(`  ✓ Achieved ${improvement.toFixed(1)}% performance improvement`);
  console.log(`  ✓ Validated safety constraints throughout evolution`);
  console.log('\nNext Steps:');
  console.log('  • Implement DARTS for continuous architecture search');
  console.log('  • Add meta-learning for faster adaptation');
  console.log('  • Deploy in production with A/B testing');
  console.log('  • Scale to distributed evolution across workers');
}

// Run demonstration
if (require.main === module) {
  demonstrateSelfEvolvingAttention()
    .then(() => console.log('\n✓ Demonstration completed successfully'))
    .catch(err => console.error('\n✗ Error:', err));
}

module.exports = {
  AttentionArchitecture,
  GeneticOperators,
  PerformanceEvaluator,
  SafetyValidator,
  HybridEvolutionEngine,
  MoEEvolutionManager,
};
