/**
 * Neuromorphic Spiking Attention - Proof of Concept
 * 
 * Demonstrates spiking neural network inspired attention using @ruvector/attention
 */

const attention = require('@ruvector/attention');

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║          NEUROMORPHIC SPIKING ATTENTION - PROOF OF CONCEPT                   ║
║                   Simulating Brain-Inspired Attention                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

// LIF Neuron Model
class LIFNeuron {
    constructor(config = {}) {
        this.vRest = config.vRest || -70;
        this.vThreshold = config.vThreshold || -55;
        this.vReset = config.vReset || -75;
        this.tauM = config.tauM || 10;
        this.refractoryPeriod = config.refractoryPeriod || 2;
        this.v = this.vRest;
        this.lastSpikeTime = -Infinity;
        this.spikeHistory = [];
    }
    
    step(inputCurrent, dt, currentTime) {
        if (currentTime - this.lastSpikeTime < this.refractoryPeriod) return null;
        const dv = (-(this.v - this.vRest) + inputCurrent) / this.tauM;
        this.v += dv * dt;
        if (this.v > this.vThreshold) {
            this.v = this.vReset;
            this.lastSpikeTime = currentTime;
            this.spikeHistory.push(currentTime);
            return { time: currentTime, neuronId: this.id };
        }
        return null;
    }
}

// STDP Learning Rule
class STDPRule {
    constructor(config = {}) {
        this.tauPlus = config.tauPlus || 20;
        this.tauMinus = config.tauMinus || 20;
        this.aPlus = config.aPlus || 0.1;
        this.aMinus = config.aMinus || 0.12;
    }
    
    computeWeightChange(preSpikeTime, postSpikeTime) {
        const deltaT = postSpikeTime - preSpikeTime;
        if (deltaT > 0) {
            return this.aPlus * Math.exp(-deltaT / this.tauPlus);
        } else {
            return -this.aMinus * Math.exp(deltaT / this.tauMinus);
        }
    }
}

// Spiking Attention Layer
class SpikingAttentionLayer {
    constructor(config) {
        this.numNeurons = config.numNeurons || 64;
        this.dim = config.dim || 64;
        this.dt = config.dt || 1;
        this.duration = config.duration || 100;
        
        this.neurons = Array.from({ length: this.numNeurons }, (_, i) => {
            const neuron = new LIFNeuron();
            neuron.id = i;
            return neuron;
        });
        
        this.weights = new Float32Array(this.numNeurons);
        for (let i = 0; i < this.numNeurons; i++) {
            this.weights[i] = Math.random() * 0.5 + 0.5;
        }
        
        this.stdp = new STDPRule();
        this.baseAttention = new attention.FlashAttention(this.dim, 16);
    }
    
    rateEncode(vector, duration) {
        const spikeTrain = [];
        const maxRate = 100;
        for (let t = 0; t < duration; t += this.dt) {
            for (let i = 0; i < vector.length; i++) {
                const firingProb = Math.abs(vector[i]) * maxRate * (this.dt / 1000);
                if (Math.random() < firingProb) {
                    spikeTrain.push({ time: t, neuronId: i, value: Math.sign(vector[i]) });
                }
            }
        }
        return spikeTrain;
    }
    
    rateDecode(spikeTrain, numNeurons, duration) {
        const counts = new Float32Array(numNeurons);
        for (const spike of spikeTrain) {
            counts[spike.neuronId] += spike.value || 1;
        }
        for (let i = 0; i < numNeurons; i++) {
            counts[i] = counts[i] / (duration / 1000);
        }
        return counts;
    }
    
    forwardSpiking(query, keys, values) {
        const startTime = performance.now();
        const querySpikes = this.rateEncode(Array.from(query), this.duration);
        const outputSpikes = [];
        let time = 0;
        
        while (time < this.duration) {
            const currentSpikes = querySpikes.filter(s => Math.abs(s.time - time) < this.dt);
            for (let i = 0; i < this.numNeurons; i++) {
                let inputCurrent = 0;
                for (const spike of currentSpikes) {
                    inputCurrent += this.weights[i] * spike.value * 10;
                }
                const output = this.neurons[i].step(inputCurrent, this.dt, time);
                if (output) outputSpikes.push(output);
            }
            time += this.dt;
        }
        
        this.applySTDP(querySpikes, outputSpikes);
        const spikeRates = this.rateDecode(outputSpikes, this.numNeurons, this.duration);
        const attentionWeights = softmax(Array.from(spikeRates).slice(0, keys.length));
        
        const output = new Float32Array(this.dim);
        for (let i = 0; i < keys.length; i++) {
            for (let j = 0; j < this.dim; j++) {
                output[j] += attentionWeights[i] * values[i][j];
            }
        }
        
        return { output, attentionWeights, numSpikes: outputSpikes.length, elapsed: performance.now() - startTime };
    }
    
    applySTDP(preSpikes, postSpikes) {
        for (const pre of preSpikes) {
            for (const post of postSpikes) {
                const deltaW = this.stdp.computeWeightChange(pre.time, post.time);
                const idx = post.neuronId;
                if (idx < this.weights.length) {
                    this.weights[idx] = Math.max(0, Math.min(1, this.weights[idx] + deltaW * 0.01));
                }
            }
        }
    }
}

function softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
}

// Benchmark
console.log('1. Initializing Spiking Attention Layer...\n');

const DIM = 64;
const SEQ_LEN = 32;
const ITERATIONS = 100;

const spikingLayer = new SpikingAttentionLayer({ numNeurons: SEQ_LEN, dim: DIM, duration: 50 });

const query = new Float32Array(DIM);
const keys = [];
const values = [];

for (let i = 0; i < DIM; i++) query[i] = Math.random() * 2 - 1;
for (let i = 0; i < SEQ_LEN; i++) {
    const k = new Float32Array(DIM);
    const v = new Float32Array(DIM);
    for (let j = 0; j < DIM; j++) {
        k[j] = Math.random() * 2 - 1;
        v[j] = Math.random() * 2 - 1;
    }
    keys.push(k);
    values.push(v);
}

console.log('2. Running Benchmarks...\n');

// Spiking
const spikingResults = [];
console.log('   Running ' + ITERATIONS + ' iterations of Spiking Attention...');
for (let i = 0; i < ITERATIONS; i++) {
    spikingResults.push(spikingLayer.forwardSpiking(query, keys, values));
}
const avgSpikingTime = spikingResults.reduce((a, r) => a + r.elapsed, 0) / ITERATIONS;
const avgSpikes = spikingResults.reduce((a, r) => a + r.numSpikes, 0) / ITERATIONS;

// Flash
console.log('   Running ' + ITERATIONS + ' iterations of Flash Attention...');
const flashAttention = new attention.FlashAttention(DIM, 16);
const flashStart = performance.now();
for (let i = 0; i < ITERATIONS; i++) flashAttention.compute(query, keys, values);
const flashTime = (performance.now() - flashStart) / ITERATIONS;

// DotProduct
console.log('   Running ' + ITERATIONS + ' iterations of DotProduct Attention...');
const dotAttention = new attention.DotProductAttention(DIM);
const dotStart = performance.now();
for (let i = 0; i < ITERATIONS; i++) dotAttention.compute(query, keys, values);
const dotTime = (performance.now() - dotStart) / ITERATIONS;

console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                           BENCHMARK RESULTS                                   ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
console.log('║  Mechanism                    Time/Op      Ops/sec     Relative               ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
console.log('║  DotProduct Attention         ' + dotTime.toFixed(3).padStart(6) + 'ms    ' + (1000/dotTime).toFixed(0).padStart(7) + '    1.00x (baseline)      ║');
console.log('║  Flash Attention              ' + flashTime.toFixed(3).padStart(6) + 'ms    ' + (1000/flashTime).toFixed(0).padStart(7) + '    ' + (dotTime/flashTime).toFixed(2) + 'x                   ║');
console.log('║  Spiking Attention (sim)      ' + avgSpikingTime.toFixed(3).padStart(6) + 'ms    ' + (1000/avgSpikingTime).toFixed(0).padStart(7) + '    ' + (dotTime/avgSpikingTime).toFixed(4) + 'x (software)     ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

console.log('Spiking Attention Stats:');
console.log('  • Average spikes per forward pass: ' + avgSpikes.toFixed(1));
console.log('  • Simulation duration: 50ms (biological time)');
console.log('  • STDP learning: Active\n');

// STDP Demo
console.log('3. STDP Learning Demonstration...\n');
const learningLayer = new SpikingAttentionLayer({ numNeurons: 8, dim: 8, duration: 100 });
console.log('   Initial weights: ' + Array.from(learningLayer.weights.slice(0, 8)).map(w => w.toFixed(3)).join(' '));

const tq = new Float32Array([1, 1, 0, 0, 0, 0, 0, 0]);
const tk = [new Float32Array([1, 1, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 0, 1, 1, 0, 0, 0, 0])];
for (let e = 0; e < 20; e++) learningLayer.forwardSpiking(tq, tk, tk);

console.log('   After 20 epochs:  ' + Array.from(learningLayer.weights.slice(0, 8)).map(w => w.toFixed(3)).join(' '));
console.log('\n   ↑ Weights adapted via spike-timing correlations (STDP)\n');

// Energy Analysis
const standardOps = DIM * SEQ_LEN * 2 + SEQ_LEN * DIM;
console.log('4. Energy Efficiency (Theoretical)...\n');
console.log('   Standard Attention: ' + standardOps + ' ops → ~' + (standardOps * 1e-12).toExponential(2) + ' J/forward');
console.log('   Spiking (on Loihi): ' + avgSpikes.toFixed(0) + ' spikes → ~' + (avgSpikes * 1e-15).toExponential(2) + ' J/forward');
console.log('   Efficiency gain: ~' + (standardOps / avgSpikes * 1000).toFixed(0) + 'x on neuromorphic hardware\n');

console.log('✅ Neuromorphic Spiking Attention POC Complete!');
