/**
 * Universal Energy System RL Controller
 *
 * Modular reinforcement learning control system for:
 * - Nuclear fission reactors (PWR, BWR, SMR)
 * - Nuclear fusion (Tokamaks, Stellarators)
 * - Solar farms
 * - Wind farms
 * - Grid storage systems
 * - Hybrid energy systems
 *
 * Uses ruvector for state representation, experience replay, and policy optimization
 */

const {
  VectorDB,
  RuvectorLayer,
  MultiHeadAttention,
  gnnWrapper,
  TensorCompress,
  differentiableSearch
} = require('ruvector');
const { RuvLLM } = require('@ruvector/ruvllm');

class UniversalRLController {
  constructor(config = {}) {
    this.systemType = config.systemType || 'nuclear-fission';
    this.systemId = config.systemId || 'SYSTEM-01';

    // Initialize ruvector components
    this.vectorDB = new VectorDB({
      dimensions: 128,
      metric: 'cosine',
      indexType: 'hnsw'
    });

    // RL configuration
    this.rlConfig = {
      algorithm: config.algorithm || 'PPO', // PPO, SAC, TD3, A3C
      gamma: 0.99, // Discount factor
      learningRate: 3e-4,
      clipEpsilon: 0.2, // For PPO
      tau: 0.005, // For soft updates
      updateFrequency: 4,
      batchSize: 256,
      bufferSize: 1000000,
      targetUpdateInterval: 1000,
      explorationNoise: 0.1,
      policyNoise: 0.2,
      noiseClip: 0.5,
      policyFreq: 2
    };

    // Multi-layer policy network with attention
    this.policyNetwork = this.initializePolicyNetwork(config);
    this.valueNetwork = this.initializeValueNetwork(config);

    // Experience replay buffer with ruvector
    this.replayBuffer = {
      states: [],
      actions: [],
      rewards: [],
      nextStates: [],
      dones: [],
      priorities: [],
      maxSize: this.rlConfig.bufferSize
    };

    // Safety constraints
    this.safetyConstraints = this.initializeSafetyConstraints(config);

    // Performance metrics
    this.metrics = {
      episodeRewards: [],
      policyLoss: [],
      valueLoss: [],
      safetyViolations: 0,
      episodeCount: 0,
      stepCount: 0,
      avgReward: 0,
      bestReward: -Infinity,
      successRate: 0
    };

    // System-specific adapters
    this.systemAdapter = this.createSystemAdapter(this.systemType);

    // LLM for high-level reasoning
    this.llm = new RuvLLM({
      model: 'claude-3-sonnet',
      simd: true
    });

    // Training state
    this.isTraining = false;
    this.episode = 0;
    this.totalSteps = 0;
  }

  /**
   * Initialize policy network with attention and GNN
   */
  initializePolicyNetwork(config) {
    const stateDim = config.stateDim || 64;
    const actionDim = config.actionDim || 16;
    const hiddenDim = 256;

    return {
      // Embedding layer with ruvector
      embedding: new RuvectorLayer({
        inputDim: stateDim,
        outputDim: hiddenDim,
        activation: 'relu',
        dropout: 0.1
      }),

      // Multi-head attention for temporal dependencies
      attention: new MultiHeadAttention({
        numHeads: 8,
        embedDim: hiddenDim,
        dropout: 0.1,
        variant: 'flash' // Use FlashAttention for speed
      }),

      // GNN for system topology modeling
      gnn: gnnWrapper({
        inputDim: hiddenDim,
        hiddenDim: hiddenDim,
        outputDim: hiddenDim,
        numLayers: 3,
        aggregation: 'attention'
      }),

      // Output layers
      mean: this.createDenseLayer(hiddenDim, actionDim, 'tanh'),
      logStd: this.createDenseLayer(hiddenDim, actionDim, 'linear'),

      // Compression for efficient storage
      compressor: new TensorCompress({
        compressionLevel: 3,
        method: 'quantization'
      })
    };
  }

  /**
   * Initialize value network
   */
  initializeValueNetwork(config) {
    const stateDim = config.stateDim || 64;
    const actionDim = config.actionDim || 16;
    const hiddenDim = 256;

    return {
      embedding: new RuvectorLayer({
        inputDim: stateDim + actionDim,
        outputDim: hiddenDim,
        activation: 'relu'
      }),

      hidden1: this.createDenseLayer(hiddenDim, hiddenDim, 'relu'),
      hidden2: this.createDenseLayer(hiddenDim, hiddenDim, 'relu'),
      output: this.createDenseLayer(hiddenDim, 1, 'linear')
    };
  }

  /**
   * Create system-specific adapter
   */
  createSystemAdapter(systemType) {
    const adapters = {
      'nuclear-fission': require('./adapters/nuclear-fission-adapter'),
      'nuclear-fusion': require('./adapters/fusion-adapter'),
      'solar': require('./adapters/solar-adapter'),
      'wind': require('./adapters/wind-adapter'),
      'grid-storage': require('./adapters/storage-adapter'),
      'hybrid': require('./adapters/hybrid-adapter')
    };

    const AdapterClass = adapters[systemType];
    if (!AdapterClass) {
      throw new Error(`Unknown system type: ${systemType}`);
    }

    return new AdapterClass({
      systemId: this.systemId,
      vectorDB: this.vectorDB
    });
  }

  /**
   * Initialize safety constraints for system type
   */
  initializeSafetyConstraints(config) {
    const baseConstraints = {
      maxActionMagnitude: 0.3, // Prevent large control changes
      actionRateLimit: 0.1, // Max change per step
      emergencyShutdownThreshold: 0.95,
      warningThreshold: 0.85,
      constraintViolationPenalty: -100,
      safetyMarginBonus: 10
    };

    // System-specific constraints will be added by adapter
    return {
      ...baseConstraints,
      ...config.safetyConstraints
    };
  }

  /**
   * Select action using current policy
   */
  async selectAction(state, deterministic = false) {
    // Embed state using ruvector
    const stateEmbedding = await this.embedState(state);

    // Get action from policy network
    const policyOutput = await this.forwardPolicy(stateEmbedding);

    let action;
    if (deterministic) {
      action = policyOutput.mean;
    } else {
      // Sample from Gaussian distribution
      const std = Math.exp(policyOutput.logStd);
      action = this.sampleGaussian(policyOutput.mean, std);
    }

    // Apply safety constraints
    action = this.applySafetyConstraints(action, state);

    // Log to vector database
    await this.logAction(state, action, stateEmbedding);

    return {
      action,
      logProb: this.computeLogProb(action, policyOutput),
      value: await this.computeValue(stateEmbedding, action)
    };
  }

  /**
   * Embed state using ruvector with attention
   */
  async embedState(state) {
    // Convert state to tensor
    const stateTensor = this.systemAdapter.stateToTensor(state);

    // Pass through embedding layer
    let embedding = await this.policyNetwork.embedding.forward(stateTensor);

    // Apply attention over temporal sequence if available
    if (state.history && state.history.length > 0) {
      const historyEmbeddings = await Promise.all(
        state.history.map(h => this.policyNetwork.embedding.forward(
          this.systemAdapter.stateToTensor(h)
        ))
      );

      const sequence = [embedding, ...historyEmbeddings];
      embedding = await this.policyNetwork.attention.forward({
        query: embedding,
        key: sequence,
        value: sequence
      });
    }

    // Apply GNN if system has graph structure (e.g., grid topology)
    if (state.topology) {
      embedding = await this.policyNetwork.gnn.forward({
        nodes: embedding,
        edges: state.topology.edges,
        adjacency: state.topology.adjacency
      });
    }

    return embedding;
  }

  /**
   * Forward pass through policy network
   */
  async forwardPolicy(embedding) {
    // Mean and log std for Gaussian policy
    const mean = await this.policyNetwork.mean.forward(embedding);
    const logStd = await this.policyNetwork.logStd.forward(embedding);

    return { mean, logStd };
  }

  /**
   * Compute value estimate
   */
  async computeValue(stateEmbedding, action) {
    const input = this.concatenate(stateEmbedding, action);

    let hidden = await this.valueNetwork.embedding.forward(input);
    hidden = await this.valueNetwork.hidden1.forward(hidden);
    hidden = await this.valueNetwork.hidden2.forward(hidden);

    const value = await this.valueNetwork.output.forward(hidden);

    return value;
  }

  /**
   * Apply safety constraints to action
   */
  applySafetyConstraints(action, state) {
    // Clip action magnitude
    const actionMag = this.vectorMagnitude(action);
    if (actionMag > this.safetyConstraints.maxActionMagnitude) {
      action = this.scaleVector(
        action,
        this.safetyConstraints.maxActionMagnitude / actionMag
      );
    }

    // Rate limiting
    if (this.lastAction) {
      const actionChange = this.vectorSubtract(action, this.lastAction);
      const changeMag = this.vectorMagnitude(actionChange);

      if (changeMag > this.safetyConstraints.actionRateLimit) {
        const limitedChange = this.scaleVector(
          actionChange,
          this.safetyConstraints.actionRateLimit / changeMag
        );
        action = this.vectorAdd(this.lastAction, limitedChange);
      }
    }

    // System-specific safety checks
    action = this.systemAdapter.applySafetyChecks(action, state);

    this.lastAction = action;
    return action;
  }

  /**
   * Store experience in replay buffer with ruvector
   */
  async storeExperience(state, action, reward, nextState, done) {
    // Compute priority based on TD error
    const stateEmbedding = await this.embedState(state);
    const nextStateEmbedding = await this.embedState(nextState);

    const value = await this.computeValue(stateEmbedding, action);
    const nextValue = await this.computeValue(nextStateEmbedding, action);

    const tdError = Math.abs(
      reward + this.rlConfig.gamma * nextValue * (1 - done) - value
    );

    // Store in replay buffer
    if (this.replayBuffer.states.length >= this.rlConfig.bufferSize) {
      // Remove oldest experience
      this.replayBuffer.states.shift();
      this.replayBuffer.actions.shift();
      this.replayBuffer.rewards.shift();
      this.replayBuffer.nextStates.shift();
      this.replayBuffer.dones.shift();
      this.replayBuffer.priorities.shift();
    }

    this.replayBuffer.states.push(stateEmbedding);
    this.replayBuffer.actions.push(action);
    this.replayBuffer.rewards.push(reward);
    this.replayBuffer.nextStates.push(nextStateEmbedding);
    this.replayBuffer.dones.push(done);
    this.replayBuffer.priorities.push(tdError);

    // Store in vector database for similarity search
    await this.vectorDB.upsert({
      collection: `experience-${this.systemId}`,
      id: `exp-${Date.now()}-${Math.random()}`,
      vector: await this.compressEmbedding(stateEmbedding),
      metadata: {
        action,
        reward,
        done,
        tdError,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Sample batch from replay buffer with prioritized sampling
   */
  async sampleBatch() {
    const batchSize = this.rlConfig.batchSize;
    const bufferSize = this.replayBuffer.states.length;

    if (bufferSize < batchSize) {
      return null;
    }

    // Prioritized experience replay
    const priorities = this.replayBuffer.priorities;
    const totalPriority = priorities.reduce((sum, p) => sum + Math.pow(p, 0.6), 0);
    const probabilities = priorities.map(p => Math.pow(p, 0.6) / totalPriority);

    const batch = {
      states: [],
      actions: [],
      rewards: [],
      nextStates: [],
      dones: [],
      weights: []
    };

    // Sample with replacement based on priorities
    for (let i = 0; i < batchSize; i++) {
      const idx = this.sampleFromDistribution(probabilities);

      batch.states.push(this.replayBuffer.states[idx]);
      batch.actions.push(this.replayBuffer.actions[idx]);
      batch.rewards.push(this.replayBuffer.rewards[idx]);
      batch.nextStates.push(this.replayBuffer.nextStates[idx]);
      batch.dones.push(this.replayBuffer.dones[idx]);

      // Importance sampling weight
      const weight = Math.pow(bufferSize * probabilities[idx], -0.4);
      batch.weights.push(weight);
    }

    // Normalize weights
    const maxWeight = Math.max(...batch.weights);
    batch.weights = batch.weights.map(w => w / maxWeight);

    return batch;
  }

  /**
   * Update policy using PPO
   */
  async updatePolicyPPO(batch) {
    const clipEpsilon = this.rlConfig.clipEpsilon;
    let totalLoss = 0;

    for (let i = 0; i < batch.states.length; i++) {
      const state = batch.states[i];
      const action = batch.actions[i];
      const reward = batch.rewards[i];
      const nextState = batch.nextStates[i];
      const done = batch.dones[i];
      const weight = batch.weights[i];

      // Compute advantage
      const value = await this.computeValue(state, action);
      const nextValue = await this.computeValue(nextState, action);
      const advantage = reward + this.rlConfig.gamma * nextValue * (1 - done) - value;

      // Compute policy ratio
      const policyOutput = await this.forwardPolicy(state);
      const newLogProb = this.computeLogProb(action, policyOutput);
      const oldLogProb = batch.logProbs ? batch.logProbs[i] : newLogProb;

      const ratio = Math.exp(newLogProb - oldLogProb);

      // Clipped surrogate objective
      const surr1 = ratio * advantage;
      const surr2 = this.clip(ratio, 1 - clipEpsilon, 1 + clipEpsilon) * advantage;
      const policyLoss = -Math.min(surr1, surr2) * weight;

      // Value loss
      const valueLoss = Math.pow(advantage, 2) * weight;

      // Combined loss
      const loss = policyLoss + 0.5 * valueLoss;
      totalLoss += loss;

      // Perform gradient update (simplified - would use actual backprop)
      await this.performGradientStep(loss, state, action);
    }

    const avgLoss = totalLoss / batch.states.length;
    this.metrics.policyLoss.push(avgLoss);

    return avgLoss;
  }

  /**
   * Update policy using SAC (Soft Actor-Critic)
   */
  async updatePolicySAC(batch) {
    // SAC implementation with entropy regularization
    const alpha = 0.2; // Entropy coefficient
    let totalLoss = 0;

    for (let i = 0; i < batch.states.length; i++) {
      const state = batch.states[i];
      const action = batch.actions[i];
      const reward = batch.rewards[i];
      const nextState = batch.nextStates[i];
      const done = batch.dones[i];

      // Q-value targets
      const q1 = await this.computeValue(state, action);
      const nextPolicyOutput = await this.forwardPolicy(nextState);
      const nextAction = this.sampleGaussian(
        nextPolicyOutput.mean,
        Math.exp(nextPolicyOutput.logStd)
      );
      const nextQ = await this.computeValue(nextState, nextAction);

      // Entropy term
      const entropy = -this.computeLogProb(nextAction, nextPolicyOutput);

      // Target
      const target = reward + this.rlConfig.gamma * (1 - done) * (nextQ + alpha * entropy);

      // Q-loss
      const qLoss = Math.pow(q1 - target, 2);

      // Policy loss (maximize Q-value + entropy)
      const policyOutput = await this.forwardPolicy(state);
      const sampledAction = this.sampleGaussian(
        policyOutput.mean,
        Math.exp(policyOutput.logStd)
      );
      const q = await this.computeValue(state, sampledAction);
      const policyEntropy = -this.computeLogProb(sampledAction, policyOutput);
      const policyLoss = -(q + alpha * policyEntropy);

      totalLoss += qLoss + policyLoss;
    }

    return totalLoss / batch.states.length;
  }

  /**
   * Train for one episode
   */
  async trainEpisode(maxSteps = 1000) {
    this.isTraining = true;
    this.episode++;

    let state = await this.systemAdapter.reset();
    let episodeReward = 0;
    let step = 0;
    const trajectory = [];

    while (step < maxSteps) {
      // Select action
      const { action, logProb, value } = await this.selectAction(state, false);

      // Execute action in environment
      const result = await this.systemAdapter.step(action);
      const { nextState, reward, done, info } = result;

      // Check safety violations
      if (info.safetyViolation) {
        this.metrics.safetyViolations++;
        reward += this.safetyConstraints.constraintViolationPenalty;
      }

      // Store experience
      await this.storeExperience(state, action, reward, nextState, done);

      trajectory.push({
        state,
        action,
        reward,
        logProb,
        value,
        done
      });

      episodeReward += reward;
      state = nextState;
      step++;
      this.totalSteps++;

      // Update policy periodically
      if (this.totalSteps % this.rlConfig.updateFrequency === 0) {
        const batch = await this.sampleBatch();
        if (batch) {
          if (this.rlConfig.algorithm === 'PPO') {
            await this.updatePolicyPPO(batch);
          } else if (this.rlConfig.algorithm === 'SAC') {
            await this.updatePolicySAC(batch);
          }
        }
      }

      if (done) {
        break;
      }
    }

    // Update metrics
    this.metrics.episodeRewards.push(episodeReward);
    this.metrics.avgReward = this.metrics.episodeRewards.slice(-100).reduce((a, b) => a + b, 0) /
                            Math.min(100, this.metrics.episodeRewards.length);

    if (episodeReward > this.metrics.bestReward) {
      this.metrics.bestReward = episodeReward;
      await this.saveCheckpoint('best');
    }

    this.metrics.episodeCount++;

    return {
      episodeReward,
      steps: step,
      avgReward: this.metrics.avgReward,
      trajectory
    };
  }

  /**
   * Evaluate policy (no exploration)
   */
  async evaluate(numEpisodes = 10) {
    const originalTraining = this.isTraining;
    this.isTraining = false;

    const results = [];

    for (let ep = 0; ep < numEpisodes; ep++) {
      let state = await this.systemAdapter.reset();
      let episodeReward = 0;
      let step = 0;
      const maxSteps = 1000;

      while (step < maxSteps) {
        const { action } = await this.selectAction(state, true); // Deterministic
        const { nextState, reward, done } = await this.systemAdapter.step(action);

        episodeReward += reward;
        state = nextState;
        step++;

        if (done) {
          break;
        }
      }

      results.push({
        episode: ep,
        reward: episodeReward,
        steps: step
      });
    }

    this.isTraining = originalTraining;

    return {
      avgReward: results.reduce((sum, r) => sum + r.reward, 0) / numEpisodes,
      stdReward: this.computeStd(results.map(r => r.reward)),
      avgSteps: results.reduce((sum, r) => sum + r.steps, 0) / numEpisodes,
      results
    };
  }

  /**
   * Query similar experiences using ruvector
   */
  async querySimilarExperiences(state, k = 10) {
    const stateEmbedding = await this.embedState(state);
    const compressed = await this.compressEmbedding(stateEmbedding);

    const results = await differentiableSearch({
      vectorDB: this.vectorDB,
      collection: `experience-${this.systemId}`,
      queryVector: compressed,
      k: k,
      differentiable: true
    });

    return results;
  }

  /**
   * Transfer learning: load policy from another system
   */
  async transferFrom(sourceSystemId, freezeLayers = ['embedding']) {
    console.log(`Transferring knowledge from ${sourceSystemId}...`);

    // Load source policy
    const sourcePolicy = await this.loadCheckpoint(sourceSystemId, 'best');

    // Copy weights selectively
    for (const layerName in this.policyNetwork) {
      if (!freezeLayers.includes(layerName)) {
        this.policyNetwork[layerName] = sourcePolicy.policyNetwork[layerName];
      }
    }

    // Load relevant experiences
    const sourceExperiences = await this.vectorDB.query({
      collection: `experience-${sourceSystemId}`,
      limit: 10000
    });

    console.log(`Transferred ${sourceExperiences.length} experiences`);

    return {
      transferredLayers: Object.keys(this.policyNetwork).filter(
        l => !freezeLayers.includes(l)
      ),
      transferredExperiences: sourceExperiences.length
    };
  }

  /**
   * Save checkpoint
   */
  async saveCheckpoint(name = 'checkpoint') {
    const checkpoint = {
      systemId: this.systemId,
      systemType: this.systemType,
      episode: this.episode,
      totalSteps: this.totalSteps,
      metrics: this.metrics,
      policyNetwork: this.policyNetwork,
      valueNetwork: this.valueNetwork,
      rlConfig: this.rlConfig,
      timestamp: Date.now()
    };

    // Save to file
    const fs = require('fs').promises;
    const path = require('path');
    const checkpointDir = path.join(process.cwd(), 'checkpoints', this.systemId);
    await fs.mkdir(checkpointDir, { recursive: true });

    const filename = path.join(checkpointDir, `${name}.json`);
    await fs.writeFile(filename, JSON.stringify(checkpoint, null, 2));

    console.log(`Checkpoint saved: ${filename}`);
    return filename;
  }

  /**
   * Load checkpoint
   */
  async loadCheckpoint(systemId, name = 'checkpoint') {
    const fs = require('fs').promises;
    const path = require('path');

    const filename = path.join(
      process.cwd(),
      'checkpoints',
      systemId || this.systemId,
      `${name}.json`
    );

    const data = await fs.readFile(filename, 'utf8');
    const checkpoint = JSON.parse(data);

    // Restore state
    this.episode = checkpoint.episode;
    this.totalSteps = checkpoint.totalSteps;
    this.metrics = checkpoint.metrics;
    this.policyNetwork = checkpoint.policyNetwork;
    this.valueNetwork = checkpoint.valueNetwork;

    console.log(`Checkpoint loaded: ${filename}`);
    return checkpoint;
  }

  /**
   * Get performance summary
   */
  getMetrics() {
    return {
      ...this.metrics,
      systemId: this.systemId,
      systemType: this.systemType,
      episode: this.episode,
      totalSteps: this.totalSteps,
      bufferSize: this.replayBuffer.states.length
    };
  }

  // ============ Helper Methods ============

  createDenseLayer(inputDim, outputDim, activation) {
    return {
      weights: this.initializeWeights(inputDim, outputDim),
      bias: this.initializeBias(outputDim),
      activation,
      forward: async (input) => {
        let output = this.matmul(input, this.weights);
        output = this.add(output, this.bias);
        return this.activate(output, activation);
      }
    };
  }

  initializeWeights(inputDim, outputDim) {
    // Xavier initialization
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));
    return Array(inputDim).fill(0).map(() =>
      Array(outputDim).fill(0).map(() =>
        (Math.random() - 0.5) * 2 * scale
      )
    );
  }

  initializeBias(dim) {
    return Array(dim).fill(0);
  }

  sampleGaussian(mean, std) {
    if (Array.isArray(mean)) {
      return mean.map((m, i) => {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return m + z * std[i];
      });
    } else {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    }
  }

  computeLogProb(action, policyOutput) {
    const { mean, logStd } = policyOutput;
    const std = Math.exp(logStd);

    // Gaussian log probability
    let logProb = 0;
    for (let i = 0; i < action.length; i++) {
      const diff = action[i] - mean[i];
      logProb += -0.5 * Math.pow(diff / std[i], 2) - logStd[i] - 0.5 * Math.log(2 * Math.PI);
    }

    return logProb;
  }

  clip(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  vectorMagnitude(vec) {
    return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  }

  scaleVector(vec, scale) {
    return vec.map(v => v * scale);
  }

  vectorAdd(a, b) {
    return a.map((v, i) => v + b[i]);
  }

  vectorSubtract(a, b) {
    return a.map((v, i) => v - b[i]);
  }

  sampleFromDistribution(probabilities) {
    const r = Math.random();
    let cumSum = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumSum += probabilities[i];
      if (r < cumSum) {
        return i;
      }
    }
    return probabilities.length - 1;
  }

  computeStd(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  async compressEmbedding(embedding) {
    return await this.policyNetwork.compressor.compress(embedding);
  }

  concatenate(a, b) {
    if (Array.isArray(a)) {
      return [...a, ...b];
    }
    return [a, ...b];
  }

  matmul(a, b) {
    // Simplified matrix multiplication
    if (!Array.isArray(a[0])) {
      // Vector-matrix
      return b[0].map((_, j) => a.reduce((sum, val, i) => sum + val * b[i][j], 0));
    }
    // Matrix-matrix
    return a.map(row =>
      b[0].map((_, j) => row.reduce((sum, val, i) => sum + val * b[i][j], 0))
    );
  }

  add(a, b) {
    if (Array.isArray(a)) {
      return a.map((v, i) => v + (b[i] || b));
    }
    return a + b;
  }

  activate(x, activation) {
    if (!Array.isArray(x)) {
      return this.scalarActivation(x, activation);
    }
    return x.map(v => this.scalarActivation(v, activation));
  }

  scalarActivation(x, activation) {
    switch (activation) {
      case 'relu':
        return Math.max(0, x);
      case 'tanh':
        return Math.tanh(x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'linear':
      default:
        return x;
    }
  }

  async logAction(state, action, stateEmbedding) {
    // Log for monitoring
  }

  async performGradientStep(loss, state, action) {
    // Simplified gradient update (would use actual autograd in production)
  }
}

module.exports = UniversalRLController;
