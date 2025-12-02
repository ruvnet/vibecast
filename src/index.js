/**
 * Spiking Neural Network SDK
 * High-performance SNN with SIMD optimization
 *
 * @module spiking-neural
 */

const path = require('path');

// Try to load native addon
let native = null;
try {
  native = require('../build/Release/snn_simd.node');
} catch (e) {
  // Native addon not available, use JS fallback
}

/**
 * Leaky Integrate-and-Fire (LIF) Neuron Layer
 * Biologically-inspired neuron model with membrane potential dynamics
 */
class LIFLayer {
  /**
   * Create a LIF neuron layer
   * @param {number} n_neurons - Number of neurons in the layer
   * @param {Object} params - Neuron parameters
   * @param {number} [params.tau=20.0] - Membrane time constant (ms)
   * @param {number} [params.v_rest=-70.0] - Resting potential (mV)
   * @param {number} [params.v_reset=-75.0] - Reset potential (mV)
   * @param {number} [params.v_thresh=-50.0] - Spike threshold (mV)
   * @param {number} [params.resistance=10.0] - Membrane resistance (MOhm)
   * @param {number} [params.dt=1.0] - Time step (ms)
   */
  constructor(n_neurons, params = {}) {
    this.n_neurons = n_neurons;
    this.tau = params.tau !== undefined ? params.tau : 20.0;
    this.v_rest = params.v_rest !== undefined ? params.v_rest : -70.0;
    this.v_reset = params.v_reset !== undefined ? params.v_reset : -75.0;
    this.v_thresh = params.v_thresh !== undefined ? params.v_thresh : -50.0;
    this.resistance = params.resistance !== undefined ? params.resistance : 10.0;
    this.dt = params.dt !== undefined ? params.dt : 1.0;

    this.voltages = new Float32Array(n_neurons);
    this.currents = new Float32Array(n_neurons);
    this.spikes = new Float32Array(n_neurons);
    this.voltages.fill(this.v_rest);
  }

  /**
   * Update neuron states for one time step
   * @returns {number} Number of spikes generated
   */
  update() {
    if (native) {
      native.lifUpdate(this.voltages, this.currents, this.dt, this.tau, this.v_rest, this.resistance);
      return native.detectSpikes(this.voltages, this.spikes, this.v_thresh, this.v_reset);
    }
    return this._updateJS();
  }

  _updateJS() {
    let spike_count = 0;
    for (let i = 0; i < this.n_neurons; i++) {
      const dv = (-(this.voltages[i] - this.v_rest) + this.resistance * this.currents[i]) * this.dt / this.tau;
      this.voltages[i] += dv;
      if (this.voltages[i] >= this.v_thresh) {
        this.spikes[i] = 1.0;
        this.voltages[i] = this.v_reset;
        spike_count++;
      } else {
        this.spikes[i] = 0.0;
      }
    }
    return spike_count;
  }

  setCurrents(currents) { this.currents.set(currents); }
  getSpikes() { return this.spikes; }
  reset() {
    this.voltages.fill(this.v_rest);
    this.currents.fill(0);
    this.spikes.fill(0);
  }
}

/**
 * Synaptic Connection Layer with STDP Learning
 * Implements Spike-Timing-Dependent Plasticity
 */
class SynapticLayer {
  /**
   * Create a synaptic connection layer
   * @param {number} n_pre - Number of presynaptic neurons
   * @param {number} n_post - Number of postsynaptic neurons
   * @param {Object} params - Synapse parameters
   * @param {number} [params.tau_plus=20.0] - LTP time constant (ms)
   * @param {number} [params.tau_minus=20.0] - LTD time constant (ms)
   * @param {number} [params.a_plus=0.01] - LTP learning rate
   * @param {number} [params.a_minus=0.01] - LTD learning rate
   * @param {number} [params.w_min=0.0] - Minimum weight
   * @param {number} [params.w_max=1.0] - Maximum weight
   */
  constructor(n_pre, n_post, params = {}) {
    this.n_pre = n_pre;
    this.n_post = n_post;
    this.tau_plus = params.tau_plus || 20.0;
    this.tau_minus = params.tau_minus || 20.0;
    this.a_plus = params.a_plus || 0.01;
    this.a_minus = params.a_minus || 0.01;
    this.w_min = params.w_min || 0.0;
    this.w_max = params.w_max || 1.0;
    this.dt = params.dt || 1.0;

    this.weights = new Float32Array(n_post * n_pre);
    this.pre_trace = new Float32Array(n_pre);
    this.post_trace = new Float32Array(n_post);
    this.trace_decay = Math.exp(-this.dt / this.tau_plus);

    this.initializeWeights(params.init_weight || 0.5, params.init_std || 0.1);
  }

  initializeWeights(mean, std) {
    for (let i = 0; i < this.weights.length; i++) {
      const u1 = Math.random(), u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      this.weights[i] = Math.max(this.w_min, Math.min(this.w_max, mean + z * std));
    }
  }

  forward(pre_spikes, post_currents) {
    if (native) {
      native.computeCurrents(post_currents, pre_spikes, this.weights);
    } else {
      this._forwardJS(pre_spikes, post_currents);
    }
  }

  _forwardJS(pre_spikes, post_currents) {
    post_currents.fill(0);
    for (let j = 0; j < this.n_post; j++) {
      let sum = 0;
      for (let i = 0; i < this.n_pre; i++) {
        sum += pre_spikes[i] * this.weights[j * this.n_pre + i];
      }
      post_currents[j] = sum;
    }
  }

  learn(pre_spikes, post_spikes) {
    if (native) {
      native.updateTraces(this.pre_trace, pre_spikes, this.trace_decay);
      native.updateTraces(this.post_trace, post_spikes, this.trace_decay);
      native.stdpUpdate(this.weights, pre_spikes, post_spikes, this.pre_trace, this.post_trace, this.a_plus, this.a_minus, this.w_min, this.w_max);
    } else {
      this._learnJS(pre_spikes, post_spikes);
    }
  }

  _learnJS(pre_spikes, post_spikes) {
    for (let i = 0; i < this.n_pre; i++) {
      this.pre_trace[i] = this.pre_trace[i] * this.trace_decay + pre_spikes[i];
    }
    for (let j = 0; j < this.n_post; j++) {
      this.post_trace[j] = this.post_trace[j] * this.trace_decay + post_spikes[j];
    }
    for (let j = 0; j < this.n_post; j++) {
      for (let i = 0; i < this.n_pre; i++) {
        const idx = j * this.n_pre + i;
        const ltp = pre_spikes[i] * this.post_trace[j] * this.a_plus;
        const ltd = post_spikes[j] * this.pre_trace[i] * this.a_minus;
        this.weights[idx] = Math.max(this.w_min, Math.min(this.w_max, this.weights[idx] + ltp - ltd));
      }
    }
  }

  getWeightStats() {
    let sum = 0, min = Infinity, max = -Infinity;
    for (let i = 0; i < this.weights.length; i++) {
      sum += this.weights[i];
      min = Math.min(min, this.weights[i]);
      max = Math.max(max, this.weights[i]);
    }
    return { mean: sum / this.weights.length, min, max };
  }
}

/**
 * Complete Spiking Neural Network
 */
class SpikingNeuralNetwork {
  constructor(layers, params = {}) {
    this.layers = layers;
    this.dt = params.dt || 1.0;
    this.time = 0;
    this.lateral_inhibition = params.lateral_inhibition || false;
    this.inhibition_strength = params.inhibition_strength || 10.0;
  }

  step(input_spikes = null) {
    // Set input currents to first layer
    if (input_spikes && this.layers.length > 0 && this.layers[0].neuron_layer) {
      this.layers[0].neuron_layer.setCurrents(input_spikes);
    }

    // Phase 1: Update all neurons (compute new voltages and detect spikes)
    let total_spikes = 0;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.neuron_layer) {
        total_spikes += layer.neuron_layer.update();
        if (this.lateral_inhibition && native) {
          native.lateralInhibition(layer.neuron_layer.voltages, layer.neuron_layer.spikes, this.inhibition_strength);
        }
      }
    }

    // Phase 2: Forward spikes through synapses and apply STDP learning
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      if (layer.synaptic_layer) {
        const next_layer = this.layers[i + 1].neuron_layer;
        if (next_layer) {
          // Forward spikes to next layer currents (will be used on next step)
          layer.synaptic_layer.forward(layer.neuron_layer.getSpikes(), next_layer.currents);
          // STDP learning
          layer.synaptic_layer.learn(layer.neuron_layer.getSpikes(), next_layer.getSpikes());
        }
      }
    }

    this.time += this.dt;
    return total_spikes;
  }

  run(duration, input_generator = null) {
    const n_steps = Math.floor(duration / this.dt);
    const results = { spikes: [], times: [], total_spikes: 0 };
    for (let step = 0; step < n_steps; step++) {
      const input = input_generator ? input_generator(this.time) : null;
      const spike_count = this.step(input);
      results.spikes.push(spike_count);
      results.times.push(this.time);
      results.total_spikes += spike_count;
    }
    return results;
  }

  getOutput() {
    if (this.layers.length === 0) return null;
    const last = this.layers[this.layers.length - 1];
    return last.neuron_layer ? last.neuron_layer.getSpikes() : null;
  }

  reset() {
    this.time = 0;
    for (const layer of this.layers) {
      if (layer.neuron_layer) layer.neuron_layer.reset();
    }
  }

  getStats() {
    const stats = { time: this.time, layers: [] };
    for (let i = 0; i < this.layers.length; i++) {
      const layer_stats = { index: i };
      if (this.layers[i].neuron_layer) {
        const neurons = this.layers[i].neuron_layer;
        layer_stats.neurons = {
          count: neurons.n_neurons,
          avg_voltage: neurons.voltages.reduce((a, b) => a + b, 0) / neurons.n_neurons,
          spike_count: neurons.spikes.reduce((a, b) => a + b, 0)
        };
      }
      if (this.layers[i].synaptic_layer) {
        layer_stats.synapses = this.layers[i].synaptic_layer.getWeightStats();
      }
      stats.layers.push(layer_stats);
    }
    return stats;
  }
}

/**
 * Create a feedforward SNN with automatic layer connections
 * @param {number[]} layer_sizes - Array of neuron counts per layer
 * @param {Object} params - Network parameters
 * @returns {SpikingNeuralNetwork} Configured SNN
 */
function createFeedforwardSNN(layer_sizes, params = {}) {
  const layers = [];
  for (let i = 0; i < layer_sizes.length; i++) {
    const layer = {
      neuron_layer: new LIFLayer(layer_sizes[i], params),
      synaptic_layer: null
    };
    if (i < layer_sizes.length - 1) {
      layer.synaptic_layer = new SynapticLayer(layer_sizes[i], layer_sizes[i + 1], params);
    }
    layers.push(layer);
  }
  return new SpikingNeuralNetwork(layers, params);
}

/**
 * Rate coding - encode values as Poisson spike trains
 * @param {number[]|Float32Array} values - Input values (0-1)
 * @param {number} dt - Time step (ms)
 * @param {number} [max_rate=100] - Maximum firing rate (Hz)
 * @returns {Float32Array} Spike train
 */
function rateEncoding(values, dt, max_rate = 100) {
  const spikes = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const rate = values[i] * max_rate;
    const p_spike = rate * dt / 1000;
    spikes[i] = Math.random() < p_spike ? 1.0 : 0.0;
  }
  return spikes;
}

/**
 * Temporal coding - encode values as time-to-first-spike
 * @param {number[]|Float32Array} values - Input values (0-1)
 * @param {number} time - Current time (ms)
 * @param {number} [t_start=0] - Start time for encoding window
 * @param {number} [t_window=50] - Encoding window duration (ms)
 * @returns {Float32Array} Spike train
 */
function temporalEncoding(values, time, t_start = 0, t_window = 50) {
  const spikes = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const spike_time = t_start + (1 - values[i]) * t_window;
    spikes[i] = (time >= spike_time && time < spike_time + 1) ? 1.0 : 0.0;
  }
  return spikes;
}

// SIMD-optimized vector operations
class SIMDOps {
  static dotProduct(a, b) {
    const len = a.length;
    let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
    const len4 = len - (len % 4);
    for (let i = 0; i < len4; i += 4) {
      sum0 += a[i] * b[i];
      sum1 += a[i + 1] * b[i + 1];
      sum2 += a[i + 2] * b[i + 2];
      sum3 += a[i + 3] * b[i + 3];
    }
    let sum = sum0 + sum1 + sum2 + sum3;
    for (let i = len4; i < len; i++) sum += a[i] * b[i];
    return sum;
  }

  static distance(a, b) {
    const len = a.length;
    let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
    const len4 = len - (len % 4);
    for (let i = 0; i < len4; i += 4) {
      const d0 = a[i] - b[i], d1 = a[i+1] - b[i+1], d2 = a[i+2] - b[i+2], d3 = a[i+3] - b[i+3];
      sum0 += d0 * d0; sum1 += d1 * d1; sum2 += d2 * d2; sum3 += d3 * d3;
    }
    let sum = sum0 + sum1 + sum2 + sum3;
    for (let i = len4; i < len; i++) { const d = a[i] - b[i]; sum += d * d; }
    return Math.sqrt(sum);
  }

  static cosineSimilarity(a, b) {
    const len = a.length;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}

module.exports = {
  // Core classes
  SpikingNeuralNetwork,
  LIFLayer,
  SynapticLayer,

  // Factory functions
  createFeedforwardSNN,

  // Encoding functions
  rateEncoding,
  temporalEncoding,

  // SIMD operations
  SIMDOps,

  // Status
  native: native !== null,
  version: require('../package.json').version
};
