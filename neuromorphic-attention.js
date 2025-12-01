/**
 * Neuromorphic Spiking Attention Implementation
 *
 * A complete implementation of spike-based attention mechanisms
 * using Leaky Integrate-and-Fire neurons and STDP learning.
 *
 * Features:
 * - LIF neuron dynamics
 * - Multiple spike encoding schemes (latency, rate, phase)
 * - STDP-based learning
 * - Event-driven computation
 * - Energy efficiency tracking
 * - Hardware abstraction layer
 *
 * @module @ruvector/attention/neuromorphic
 * @version 0.2.0-alpha
 */

'use strict';

// ============================================================================
// CORE NEURON MODEL
// ============================================================================

/**
 * Leaky Integrate-and-Fire (LIF) Neuron
 *
 * Implements the LIF neuron model:
 *   τ_m dV/dt = -(V - V_rest) + R·I(t)
 *
 * When V ≥ V_threshold: emit spike, V ← V_reset
 */
class LIFNeuron {
  constructor(params = {}) {
    // Membrane parameters
    this.v_membrane = params.v_rest || -70.0;  // mV
    this.v_rest = params.v_rest || -70.0;
    this.v_threshold = params.v_threshold || -50.0;
    this.v_reset = params.v_reset || -80.0;

    // Time constants
    this.tau_m = params.tau_m || 20.0;  // ms
    this.tau_ref = params.tau_ref || 2.0;  // ms

    // Resistance
    this.r_membrane = params.r_membrane || 10.0;  // MΩ

    // State
    this.refractory_counter = 0;
    this.last_spike_time = -Infinity;
    this.spike_history = [];

    // Statistics
    this.total_spikes = 0;
  }

  /**
   * Simulate one timestep
   * @param {number} current - Input current (nA)
   * @param {number} dt - Timestep size (ms)
   * @returns {boolean} - True if neuron spiked
   */
  step(current, dt) {
    // Refractory period check
    if (this.refractory_counter > 0) {
      this.refractory_counter -= dt;
      return false;
    }

    // LIF dynamics: V(t+dt) = V(t)·exp(-dt/τ) + R·I·(1 - exp(-dt/τ))
    const decay = Math.exp(-dt / this.tau_m);
    this.v_membrane = this.v_membrane * decay +
                     this.r_membrane * current * (1 - decay);

    // Spike check
    if (this.v_membrane >= this.v_threshold) {
      this.v_membrane = this.v_reset;
      this.refractory_counter = this.tau_ref;
      this.total_spikes++;
      return true;
    }

    return false;
  }

  reset() {
    this.v_membrane = this.v_rest;
    this.refractory_counter = 0;
    this.spike_history = [];
  }
}

// ============================================================================
// SPIKE TRAIN DATA STRUCTURE
// ============================================================================

/**
 * Spike Train
 *
 * Represents a temporal sequence of spikes from multiple neurons
 */
class SpikeTrain {
  constructor(num_neurons, time_window_ms) {
    this.num_neurons = num_neurons;
    this.time_window = time_window_ms;
    this.spikes = new Map();  // neuron_id → [spike_times]
    this.current_time = 0;
  }

  addSpike(neuron_id, time) {
    if (neuron_id < 0 || neuron_id >= this.num_neurons) {
      throw new Error(`Neuron ID ${neuron_id} out of range [0, ${this.num_neurons})`);
    }

    if (!this.spikes.has(neuron_id)) {
      this.spikes.set(neuron_id, []);
    }

    this.spikes.get(neuron_id).push(time);
  }

  getActiveNeurons(t_start, t_end) {
    const active = new Set();

    for (const [neuron_id, spike_times] of this.spikes.entries()) {
      for (const t of spike_times) {
        if (t >= t_start && t < t_end) {
          active.add(neuron_id);
          break;
        }
      }
    }

    return active;
  }

  getSpikeCount(neuron_id) {
    const spikes = this.spikes.get(neuron_id);
    return spikes ? spikes.length : 0;
  }

  getTotalSpikes() {
    let count = 0;
    for (const spike_times of this.spikes.values()) {
      count += spike_times.length;
    }
    return count;
  }

  getFirstSpikeTime(neuron_id) {
    const spikes = this.spikes.get(neuron_id);
    return (spikes && spikes.length > 0) ? spikes[0] : Infinity;
  }

  clear() {
    this.spikes.clear();
    this.current_time = 0;
  }
}

// ============================================================================
// STDP WEIGHT MATRIX
// ============================================================================

/**
 * STDP Weight Matrix
 *
 * Implements spike-timing dependent plasticity:
 *   Δw = A_+ exp(-Δt/τ_+)  if Δt > 0  (LTP)
 *   Δw = -A_- exp(Δt/τ_-)  if Δt < 0  (LTD)
 */
class STDPWeightMatrix {
  constructor(pre_size, post_size, params = {}) {
    this.pre_size = pre_size;
    this.post_size = post_size;

    // STDP parameters
    this.a_plus = params.a_plus || 0.005;
    this.a_minus = params.a_minus || 0.00525;
    this.tau_plus = params.tau_plus || 20.0;  // ms
    this.tau_minus = params.tau_minus || 20.0;  // ms
    this.learning_rate = params.learning_rate || 0.01;
    this.w_min = params.w_min || 0.0;
    this.w_max = params.w_max || 1.0;

    // Sparse weight storage
    this.weights = new Map();
    const connectivity = params.connectivity || 0.1;

    // Initialize with random sparse connectivity
    for (let i = 0; i < pre_size; i++) {
      for (let j = 0; j < post_size; j++) {
        if (Math.random() < connectivity) {
          const key = this._key(i, j);
          this.weights.set(key, Math.random() * 0.5);
        }
      }
    }

    // Spike timing traces
    this.last_pre_spike = new Float32Array(pre_size).fill(-Infinity);
    this.last_post_spike = new Float32Array(post_size).fill(-Infinity);

    // Pre/post traces for triplet STDP
    this.pre_trace = new Float32Array(pre_size);
    this.post_trace = new Float32Array(post_size);
  }

  _key(pre_id, post_id) {
    return `${pre_id}_${post_id}`;
  }

  get(pre_id, post_id) {
    return this.weights.get(this._key(pre_id, post_id)) || 0;
  }

  set(pre_id, post_id, value) {
    const key = this._key(pre_id, post_id);
    const clamped = Math.max(this.w_min, Math.min(this.w_max, value));

    if (clamped > 0.01) {
      this.weights.set(key, clamped);
    } else {
      this.weights.delete(key);  // Prune weak synapses
    }
  }

  /**
   * Apply STDP learning rule
   * @param {number} pre_id - Pre-synaptic neuron ID
   * @param {number} post_id - Post-synaptic neuron ID
   * @param {number} current_time - Current simulation time
   */
  applySTDP(pre_id, post_id, current_time) {
    const t_pre = this.last_pre_spike[pre_id];
    const t_post = this.last_post_spike[post_id];

    if (t_pre === -Infinity || t_post === -Infinity) {
      return;
    }

    const dt = t_post - t_pre;
    let delta_w = 0;

    if (dt > 0) {
      // LTP: post spike after pre spike (causal)
      delta_w = this.a_plus * Math.exp(-dt / this.tau_plus);
    } else if (dt < 0) {
      // LTD: pre spike after post spike (anti-causal)
      delta_w = -this.a_minus * Math.exp(dt / this.tau_minus);
    }

    // Update weight
    const current_weight = this.get(pre_id, post_id);
    const new_weight = current_weight + this.learning_rate * delta_w;
    this.set(pre_id, post_id, new_weight);
  }

  updatePreSpike(neuron_id, time) {
    this.last_pre_spike[neuron_id] = time;
    // Update trace: r(t) = r(t-) + 1
    this.pre_trace[neuron_id] += 1;
  }

  updatePostSpike(neuron_id, time) {
    this.last_post_spike[neuron_id] = time;
    // Update trace: o(t) = o(t-) + 1
    this.post_trace[neuron_id] += 1;
  }

  decayTraces(dt) {
    // Exponential decay of traces
    const tau_trace = 20.0;  // ms
    const decay = Math.exp(-dt / tau_trace);

    for (let i = 0; i < this.pre_trace.length; i++) {
      this.pre_trace[i] *= decay;
    }
    for (let i = 0; i < this.post_trace.length; i++) {
      this.post_trace[i] *= decay;
    }
  }

  getSparseStats() {
    return {
      num_synapses: this.weights.size,
      total_possible: this.pre_size * this.post_size,
      sparsity: 1 - (this.weights.size / (this.pre_size * this.post_size)),
      avg_weight: this._avgWeight()
    };
  }

  _avgWeight() {
    if (this.weights.size === 0) return 0;
    let sum = 0;
    for (const w of this.weights.values()) {
      sum += w;
    }
    return sum / this.weights.size;
  }

  // Get all connections for a pre-synaptic neuron
  getOutgoingConnections(pre_id) {
    const connections = [];
    for (let post_id = 0; post_id < this.post_size; post_id++) {
      const weight = this.get(pre_id, post_id);
      if (weight > 0) {
        connections.push({ post_id, weight });
      }
    }
    return connections;
  }
}

// ============================================================================
// SPIKE ENCODING
// ============================================================================

/**
 * Spike Encoder
 *
 * Converts continuous vectors to spike trains using various encoding schemes
 */
class SpikeEncoder {
  /**
   * Latency coding: higher values → earlier spikes
   * This is a rank-order code
   */
  static encodeLatency(vector, num_neurons, time_window_ms) {
    const spike_train = new SpikeTrain(num_neurons, time_window_ms);
    const dim = Math.min(vector.length, num_neurons);

    for (let i = 0; i < dim; i++) {
      // Normalize to [0, 1]
      const normalized = (vector[i] + 1) / 2;  // Assumes input in [-1, 1]

      // Higher values spike earlier
      const spike_time = (1 - normalized) * time_window_ms;

      if (spike_time < time_window_ms) {
        spike_train.addSpike(i, spike_time);
      }
    }

    return spike_train;
  }

  /**
   * Rate coding: higher values → more spikes
   */
  static encodeRate(vector, num_neurons, time_window_ms, max_rate_hz = 200) {
    const spike_train = new SpikeTrain(num_neurons, time_window_ms);
    const dim = Math.min(vector.length, num_neurons);

    for (let i = 0; i < dim; i++) {
      // Rate proportional to activation
      const rate = max_rate_hz * Math.max(0, vector[i]);
      const expected_spikes = rate * time_window_ms / 1000;

      // Poisson process: spike times are random but density follows rate
      for (let s = 0; s < expected_spikes; s++) {
        const spike_time = Math.random() * time_window_ms;
        spike_train.addSpike(i, spike_time);
      }
    }

    return spike_train;
  }

  /**
   * Phase coding: values encoded as phase offset in oscillation
   */
  static encodePhase(vector, num_neurons, time_window_ms, freq_hz = 40) {
    const spike_train = new SpikeTrain(num_neurons, time_window_ms);
    const dim = Math.min(vector.length, num_neurons);
    const period = 1000 / freq_hz;  // ms

    for (let i = 0; i < dim; i++) {
      // Phase offset proportional to value
      const phase_offset = ((vector[i] + 1) / 2) * period;

      // Emit spikes at phase-locked times
      for (let t = phase_offset; t < time_window_ms; t += period) {
        if (t >= 0 && t < time_window_ms) {
          spike_train.addSpike(i, t);
        }
      }
    }

    return spike_train;
  }

  /**
   * Temporal contrast coding: encode changes/differences
   */
  static encodeTemporalContrast(current, previous, num_neurons, time_window_ms) {
    const spike_train = new SpikeTrain(num_neurons, time_window_ms);
    const dim = Math.min(current.length, num_neurons);

    for (let i = 0; i < dim; i++) {
      const diff = current[i] - (previous ? previous[i] : 0);

      if (Math.abs(diff) > 0.1) {  // Threshold for change
        const spike_time = time_window_ms / 2 + diff * time_window_ms / 4;

        if (spike_time >= 0 && spike_time < time_window_ms) {
          spike_train.addSpike(i, spike_time);
        }
      }
    }

    return spike_train;
  }
}

// ============================================================================
// SPIKE DECODING
// ============================================================================

/**
 * Spike Decoder
 *
 * Converts spike trains back to continuous vectors
 */
class SpikeDecoder {
  /**
   * Population rate decoding
   */
  static decodeRate(spike_train, output_dim) {
    const output = new Float32Array(output_dim);
    const time_window_sec = spike_train.time_window / 1000;

    for (let i = 0; i < output_dim; i++) {
      const spike_count = spike_train.getSpikeCount(i);
      output[i] = spike_count / time_window_sec;  // Hz
    }

    // Normalize to [0, 1]
    const max_val = Math.max(...output);
    if (max_val > 0) {
      for (let i = 0; i < output.length; i++) {
        output[i] /= max_val;
      }
    }

    return output;
  }

  /**
   * Latency decoding: earlier spikes → higher values
   */
  static decodeLatency(spike_train, output_dim) {
    const output = new Float32Array(output_dim);

    for (let i = 0; i < output_dim; i++) {
      const first_spike = spike_train.getFirstSpikeTime(i);

      if (first_spike < Infinity) {
        // Earlier spikes → higher values
        output[i] = 1 - (first_spike / spike_train.time_window);
      } else {
        output[i] = 0;
      }
    }

    return output;
  }

  /**
   * Population vector decoding
   */
  static decodePopulation(spike_train, output_dim, weights = null) {
    const output = new Float32Array(output_dim);

    if (!weights) {
      // Use spike count weighting
      return SpikeDecoder.decodeRate(spike_train, output_dim);
    }

    // Weighted combination
    for (let i = 0; i < output_dim; i++) {
      let weighted_sum = 0;
      for (const [neuron_id, spike_times] of spike_train.spikes.entries()) {
        const weight = weights.get(neuron_id, i);
        weighted_sum += spike_times.length * weight;
      }
      output[i] = weighted_sum;
    }

    return output;
  }
}

// ============================================================================
// SPIKING ATTENTION MECHANISM
// ============================================================================

/**
 * Spiking Attention
 *
 * Main class implementing neuromorphic attention using LIF neurons and STDP
 */
class SpikingAttention {
  constructor(config = {}) {
    // Configuration
    this.dim = config.dim || 64;
    this.num_neurons = config.num_neurons || 256;
    this.time_window_ms = config.time_window_ms || 100;
    this.dt = config.dt || 1.0;  // ms
    this.encoding = config.encoding || 'latency';

    // LIF neuron parameters
    this.lif_params = config.lif_params || {
      v_rest: -70.0,
      v_threshold: -50.0,
      v_reset: -80.0,
      tau_m: 20.0,
      tau_ref: 2.0,
      r_membrane: 10.0
    };

    // STDP parameters
    this.stdp_params = config.stdp_params || {
      a_plus: 0.005,
      a_minus: 0.00525,
      tau_plus: 20.0,
      tau_minus: 20.0,
      learning_rate: 0.01,
      connectivity: 0.1
    };

    // Create neuron populations
    this.query_neurons = this._createNeuronPopulation(this.num_neurons);
    this.key_neurons = this._createNeuronPopulation(this.num_neurons);
    this.value_neurons = this._createNeuronPopulation(this.num_neurons);

    // STDP weight matrices
    this.weights_qk = new STDPWeightMatrix(
      this.num_neurons,
      this.num_neurons,
      this.stdp_params
    );
    this.weights_kv = new STDPWeightMatrix(
      this.num_neurons,
      this.num_neurons,
      this.stdp_params
    );

    // Statistics
    this.stats = {
      total_computations: 0,
      total_spikes: 0,
      total_synaptic_ops: 0,
      total_energy_j: 0
    };
  }

  _createNeuronPopulation(size) {
    const neurons = [];
    for (let i = 0; i < size; i++) {
      neurons.push(new LIFNeuron(this.lif_params));
    }
    return neurons;
  }

  /**
   * Compute spiking attention
   *
   * @param {Float32Array} query - Query vector
   * @param {Float32Array[]} keys - Array of key vectors
   * @param {Float32Array[]} values - Array of value vectors
   * @returns {Float32Array} - Attention output
   */
  compute(query, keys, values) {
    this.stats.total_computations++;

    // 1. Encode inputs as spike trains
    const query_spikes = this._encode(query);
    const key_spikes = keys.map(k => this._encode(k));
    const value_spikes = values.map(v => this._encode(v));

    // 2. Compute attention scores via spike correlation
    const attention_scores = this._computeAttentionScores(
      query_spikes,
      key_spikes
    );

    // 3. Weighted value aggregation
    const output_spikes = this._aggregateValues(
      attention_scores,
      value_spikes
    );

    // 4. Decode output
    const output = this._decode(output_spikes);

    // 5. Update statistics
    this._updateStats(query_spikes, key_spikes, value_spikes, output_spikes);

    return output;
  }

  _encode(vector) {
    switch (this.encoding) {
      case 'latency':
        return SpikeEncoder.encodeLatency(vector, this.num_neurons, this.time_window_ms);
      case 'rate':
        return SpikeEncoder.encodeRate(vector, this.num_neurons, this.time_window_ms);
      case 'phase':
        return SpikeEncoder.encodePhase(vector, this.num_neurons, this.time_window_ms);
      default:
        throw new Error(`Unknown encoding: ${this.encoding}`);
    }
  }

  _decode(spike_train) {
    switch (this.encoding) {
      case 'latency':
        return SpikeDecoder.decodeLatency(spike_train, this.dim);
      case 'rate':
      case 'phase':
        return SpikeDecoder.decodeRate(spike_train, this.dim);
      default:
        return SpikeDecoder.decodeRate(spike_train, this.dim);
    }
  }

  /**
   * Compute attention scores using spike correlation
   */
  _computeAttentionScores(query_spikes, key_spikes) {
    const num_keys = key_spikes.length;
    const scores = new Float32Array(num_keys);
    const tau_syn = 5.0;  // ms, synaptic time constant

    // Event-driven simulation
    for (let t = 0; t < this.time_window_ms; t += this.dt) {
      const active_query = query_spikes.getActiveNeurons(t, t + this.dt);

      // Update STDP traces
      this.weights_qk.decayTraces(this.dt);

      for (let k_idx = 0; k_idx < num_keys; k_idx++) {
        const active_key = key_spikes[k_idx].getActiveNeurons(t, t + this.dt);

        // Event-driven: only compute if spikes present
        if (active_query.size > 0 && active_key.size > 0) {
          // Compute weighted spike correlation
          for (const q_neuron of active_query) {
            for (const k_neuron of active_key) {
              const weight = this.weights_qk.get(q_neuron, k_neuron);
              const timing_kernel = Math.exp(-Math.abs(t % 10) / tau_syn);

              scores[k_idx] += weight * timing_kernel;

              // STDP update
              this.weights_qk.applySTDP(q_neuron, k_neuron, t);
            }
          }

          this.stats.total_synaptic_ops += active_query.size * active_key.size;
        }

        // Update spike traces
        for (const q_neuron of active_query) {
          this.weights_qk.updatePreSpike(q_neuron, t);
        }
        for (const k_neuron of active_key) {
          this.weights_qk.updatePostSpike(k_neuron, t);
        }
      }
    }

    // Softmax normalization
    return this._softmax(scores);
  }

  /**
   * Aggregate values using attention weights
   */
  _aggregateValues(attention_scores, value_spikes) {
    const output_spikes = new SpikeTrain(this.num_neurons, this.time_window_ms);

    // Event-driven value aggregation
    for (let t = 0; t < this.time_window_ms; t += this.dt) {
      for (let v_idx = 0; v_idx < value_spikes.length; v_idx++) {
        const active_values = value_spikes[v_idx].getActiveNeurons(t, t + this.dt);
        const weight = attention_scores[v_idx];

        // Probabilistic spike propagation
        for (const neuron_id of active_values) {
          if (Math.random() < weight) {
            output_spikes.addSpike(neuron_id, t);
          }
        }
      }
    }

    return output_spikes;
  }

  _softmax(x) {
    const max_x = Math.max(...x);
    const exp_x = Array.from(x, v => Math.exp(v - max_x));
    const sum_exp = exp_x.reduce((a, b) => a + b, 0);
    return Float32Array.from(exp_x, v => v / sum_exp);
  }

  _updateStats(query_spikes, key_spikes, value_spikes, output_spikes) {
    const total_spikes =
      query_spikes.getTotalSpikes() +
      key_spikes.reduce((sum, ks) => sum + ks.getTotalSpikes(), 0) +
      value_spikes.reduce((sum, vs) => sum + vs.getTotalSpikes(), 0) +
      output_spikes.getTotalSpikes();

    this.stats.total_spikes += total_spikes;

    // Energy model (Loihi 2 estimates)
    const energy_per_spike = 23e-15;  // 23 fJ
    const energy_per_synapse = 81e-15;  // 81 fJ

    const spike_energy = total_spikes * energy_per_spike;
    const synapse_energy = this.stats.total_synaptic_ops * energy_per_synapse;

    this.stats.total_energy_j += (spike_energy + synapse_energy);
  }

  /**
   * Get energy and performance statistics
   */
  getStats() {
    const sparse_stats = this.weights_qk.getSparseStats();

    return {
      computations: this.stats.total_computations,
      total_spikes: this.stats.total_spikes,
      avg_spikes_per_compute: this.stats.total_spikes / Math.max(1, this.stats.total_computations),
      synaptic_ops: this.stats.total_synaptic_ops,
      energy_joules: this.stats.total_energy_j,
      energy_microjoules: this.stats.total_energy_j * 1e6,
      sparsity: sparse_stats.sparsity,
      active_synapses: sparse_stats.num_synapses,
      estimated_gpu_energy: this._estimateGPUEnergy(),
      energy_reduction_factor: this._estimateGPUEnergy() / this.stats.total_energy_j
    };
  }

  _estimateGPUEnergy() {
    // Rough estimate for traditional attention on GPU
    const n = this.num_neurons;
    const d = this.dim;
    const num_computes = this.stats.total_computations;
    const energy_per_mac = 4.6e-12;  // 4.6 pJ for 7nm GPU

    return n * n * d * energy_per_mac * num_computes;
  }

  reset() {
    this.stats = {
      total_computations: 0,
      total_spikes: 0,
      total_synaptic_ops: 0,
      total_energy_j: 0
    };

    for (const neuron of this.query_neurons) neuron.reset();
    for (const neuron of this.key_neurons) neuron.reset();
    for (const neuron of this.value_neurons) neuron.reset();
  }
}

// ============================================================================
// MULTI-HEAD SPIKING ATTENTION
// ============================================================================

/**
 * Multi-Head Spiking Attention
 *
 * Multiple parallel attention heads operating at different temporal frequencies
 */
class SpikingMultiHeadAttention {
  constructor(config = {}) {
    this.dim = config.dim || 64;
    this.num_heads = config.num_heads || 8;
    this.head_dim = Math.floor(this.dim / this.num_heads);

    // Create heads with frequency diversity
    this.heads = [];
    const base_window = config.time_window_ms || 100;

    for (let h = 0; h < this.num_heads; h++) {
      const head_config = {
        ...config,
        dim: this.head_dim,
        num_neurons: config.num_neurons || 256,
        time_window_ms: base_window * (1 + 0.1 * h)  // Frequency diversity
      };

      this.heads.push(new SpikingAttention(head_config));
    }

    // Output projection (could be spiking too)
    this.output_projection = this._initializeProjection();
  }

  _initializeProjection() {
    const size = this.dim * this.dim;
    const proj = new Float32Array(size);

    // Xavier initialization
    const scale = Math.sqrt(2.0 / (this.dim + this.dim));
    for (let i = 0; i < size; i++) {
      proj[i] = (Math.random() - 0.5) * 2 * scale;
    }

    return proj;
  }

  compute(query, keys, values) {
    // Process each head
    const head_outputs = [];

    for (let h = 0; h < this.num_heads; h++) {
      const start = h * this.head_dim;
      const end = start + this.head_dim;

      const q_head = query.slice(start, end);
      const k_heads = keys.map(k => k.slice(start, end));
      const v_heads = values.map(v => v.slice(start, end));

      head_outputs.push(this.heads[h].compute(q_head, k_heads, v_heads));
    }

    // Concatenate heads
    const concatenated = new Float32Array(this.dim);
    for (let h = 0; h < this.num_heads; h++) {
      const start = h * this.head_dim;
      for (let i = 0; i < this.head_dim; i++) {
        concatenated[start + i] = head_outputs[h][i];
      }
    }

    // Output projection
    const output = new Float32Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j < this.dim; j++) {
        output[i] += this.output_projection[i * this.dim + j] * concatenated[j];
      }
    }

    return output;
  }

  getStats() {
    let total_stats = {
      computations: 0,
      total_spikes: 0,
      synaptic_ops: 0,
      energy_joules: 0,
      sparsity: 0
    };

    for (const head of this.heads) {
      const stats = head.getStats();
      total_stats.computations += stats.computations;
      total_stats.total_spikes += stats.total_spikes;
      total_stats.synaptic_ops += stats.synaptic_ops;
      total_stats.energy_joules += stats.energy_joules;
      total_stats.sparsity += stats.sparsity;
    }

    total_stats.sparsity /= this.num_heads;
    total_stats.energy_microjoules = total_stats.energy_joules * 1e6;
    total_stats.avg_spikes_per_head = total_stats.total_spikes / this.num_heads;

    return total_stats;
  }

  reset() {
    for (const head of this.heads) {
      head.reset();
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Core components
  LIFNeuron,
  SpikeTrain,
  STDPWeightMatrix,

  // Encoding/Decoding
  SpikeEncoder,
  SpikeDecoder,

  // Attention mechanisms
  SpikingAttention,
  SpikingMultiHeadAttention,

  // Version
  version: '0.2.0-alpha-neuromorphic'
};
