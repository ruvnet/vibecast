/**
 * Quantum-Inspired Attention Examples
 * Demonstrates concepts from QUANTUM_ATTENTION_DESIGN.md using @ruvector/attention
 */

const attention = require('@ruvector/attention');

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║              QUANTUM-INSPIRED ATTENTION DEMONSTRATIONS                       ║
║          Building Tomorrow's Attention Mechanisms Today                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// 1. Tensor Network Attention (Quantum-Inspired)
// ============================================================================

class TensorNetworkAttention {
    constructor(dim, bondDim = 16) {
        this.dim = dim;
        this.bondDim = bondDim;  // Controls approximation quality
        this.baseAttention = new attention.LinearAttention(dim, bondDim);
    }
    
    // Simulate quantum-like superposition via linear attention
    compute(query, keys, values) {
        // Linear attention approximates quantum kernel via random features
        // K(x,y) ≈ φ(x)ᵀφ(y) where φ is a random feature map
        return this.baseAttention.compute(query, keys, values);
    }
    
    // Quantum-inspired: process multiple queries in "superposition"
    batchSuperposition(queries, keys, values) {
        // All queries processed simultaneously (simulated superposition)
        const results = queries.map(q => this.compute(q, keys, values));
        
        // Interference pattern: combine results
        const combined = new Float32Array(this.dim);
        for (let i = 0; i < this.dim; i++) {
            let realPart = 0;
            let imagPart = 0;
            for (let j = 0; j < results.length; j++) {
                const phase = (2 * Math.PI * j) / results.length;
                realPart += results[j][i] * Math.cos(phase);
                imagPart += results[j][i] * Math.sin(phase);
            }
            combined[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
        }
        return combined;
    }
}

// ============================================================================
// 2. Grover-Inspired Attention Search
// ============================================================================

class GroverAttention {
    constructor(dim) {
        this.dim = dim;
        this.baseAttention = new attention.DotProductAttention(dim);
    }
    
    // Grover's algorithm: O(√n) search for high-attention items
    groverSearch(query, keys, values, targetThreshold = 0.5) {
        const n = keys.length;
        const iterations = Math.floor(Math.PI / 4 * Math.sqrt(n));
        
        // Initialize uniform superposition (amplitudes)
        let amplitudes = new Float32Array(n).fill(1 / Math.sqrt(n));
        
        // Compute oracle scores (attention-based)
        const scores = keys.map(k => this.dotProduct(query, k));
        const maxScore = Math.max(...scores);
        const oracle = scores.map(s => s / maxScore > targetThreshold ? -1 : 1);
        
        // Grover iterations
        for (let iter = 0; iter < iterations; iter++) {
            // Oracle: flip amplitude of marked items
            for (let i = 0; i < n; i++) {
                amplitudes[i] *= oracle[i];
            }
            
            // Diffusion: inversion about mean
            const mean = amplitudes.reduce((a, b) => a + b, 0) / n;
            for (let i = 0; i < n; i++) {
                amplitudes[i] = 2 * mean - amplitudes[i];
            }
        }
        
        // Convert amplitudes to probabilities
        const probs = amplitudes.map(a => a * a);
        const sum = probs.reduce((a, b) => a + b, 0);
        const normalized = probs.map(p => p / sum);
        
        // Weighted output
        const output = new Float32Array(this.dim);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < this.dim; j++) {
                output[j] += normalized[i] * values[i][j];
            }
        }
        
        return { output, amplitudes: normalized, iterations };
    }
    
    dotProduct(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }
}

// ============================================================================
// 3. Entanglement-Inspired Key-Value Binding
// ============================================================================

class EntangledAttention {
    constructor(dim) {
        this.dim = dim;
        this.hyperbolicAttention = new attention.HyperbolicAttention(dim, 1.0);
    }
    
    // Create "entangled" key-value pairs
    entangle(keys, values) {
        // Entanglement = strong correlation in hyperbolic space
        const entangledPairs = [];
        for (let i = 0; i < keys.length; i++) {
            // Project to Poincaré ball
            const kProj = attention.projectToPoincareBall(keys[i], 1.0);
            const vProj = attention.projectToPoincareBall(values[i], 1.0);
            
            // Möbius addition creates entanglement-like binding
            const bound = attention.mobiusAddition(kProj, vProj, 1.0);
            
            entangledPairs.push({
                key: kProj,
                value: vProj,
                entangled: bound,
                correlation: this.computeCorrelation(kProj, vProj)
            });
        }
        return entangledPairs;
    }
    
    computeCorrelation(a, b) {
        return 1.0 - attention.poincareDistance(a, b, 1.0);
    }
    
    // Query entangled pairs
    queryEntangled(query, entangledPairs) {
        const qProj = attention.projectToPoincareBall(query, 1.0);
        
        // Measure "entanglement strength" with query
        const strengths = entangledPairs.map(pair => {
            const queryKeyDist = attention.poincareDistance(qProj, pair.key, 1.0);
            return Math.exp(-queryKeyDist) * pair.correlation;
        });
        
        // Collapse to output
        const output = new Float32Array(this.dim);
        const sum = strengths.reduce((a, b) => a + b, 0);
        
        for (let i = 0; i < entangledPairs.length; i++) {
            const weight = strengths[i] / sum;
            for (let j = 0; j < this.dim; j++) {
                output[j] += weight * entangledPairs[i].value[j];
            }
        }
        
        return { output, strengths: strengths.map(s => s / sum) };
    }
}

// ============================================================================
// Run Demonstrations
// ============================================================================

const DIM = 32;
const SEQ_LEN = 64;

// Generate test data
function randomVector(dim) {
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
    return v;
}

const query = randomVector(DIM);
const keys = Array.from({ length: SEQ_LEN }, () => randomVector(DIM));
const values = Array.from({ length: SEQ_LEN }, () => randomVector(DIM));

console.log('1. TENSOR NETWORK ATTENTION (Linear Attention as Quantum Kernel)\n');

const tensorNet = new TensorNetworkAttention(DIM, 16);
const tnStart = performance.now();
for (let i = 0; i < 1000; i++) tensorNet.compute(query, keys, values);
const tnTime = (performance.now() - tnStart) / 1000;

console.log('   Bond dimension: 16 (controls quantum approximation quality)');
console.log('   Complexity: O(n) vs O(n²) for standard attention');
console.log('   Time: ' + tnTime.toFixed(3) + 'ms (' + (1000/tnTime).toFixed(0) + ' ops/sec)\n');

// Superposition demo
const queries = [query, randomVector(DIM), randomVector(DIM)];
const superposed = tensorNet.batchSuperposition(queries, keys, values);
console.log('   Superposition of 3 queries → interference pattern computed\n');

console.log('2. GROVER-INSPIRED ATTENTION SEARCH\n');

const grover = new GroverAttention(DIM);
const groverResult = grover.groverSearch(query, keys, values, 0.7);

console.log('   Searching for high-attention items (threshold > 0.7)');
console.log('   Grover iterations: ' + groverResult.iterations + ' (O(√n) = ' + Math.floor(Math.sqrt(SEQ_LEN)) + ')');

const topIndices = groverResult.amplitudes
    .map((a, i) => ({ i, a }))
    .sort((a, b) => b.a - a.a)
    .slice(0, 5);

console.log('   Top 5 attention weights after Grover amplification:');
topIndices.forEach(({ i, a }) => console.log('     Index ' + i + ': ' + (a * 100).toFixed(1) + '%'));
console.log('');

console.log('3. ENTANGLEMENT-INSPIRED KEY-VALUE BINDING\n');

const entangled = new EntangledAttention(DIM);
const pairs = entangled.entangle(keys.slice(0, 8), values.slice(0, 8));

console.log('   Created 8 entangled key-value pairs in Poincaré ball');
console.log('   Entanglement correlations:');
pairs.forEach((p, i) => console.log('     Pair ' + i + ': correlation = ' + p.correlation.toFixed(3)));

const entangledResult = entangled.queryEntangled(query, pairs);
console.log('\n   Query collapsed entangled state:');
entangledResult.strengths.slice(0, 4).forEach((s, i) => 
    console.log('     Pair ' + i + ' strength: ' + (s * 100).toFixed(1) + '%'));

// Benchmark all quantum-inspired methods
console.log('\n4. BENCHMARK COMPARISON\n');

const ITERS = 500;

// Standard attention
const dotAttn = new attention.DotProductAttention(DIM);
const dotStart = performance.now();
for (let i = 0; i < ITERS; i++) dotAttn.compute(query, keys, values);
const dotTime = (performance.now() - dotStart) / ITERS;

// Hyperbolic (quantum geometry)
const hypAttn = new attention.HyperbolicAttention(DIM, 1.0);
const hypStart = performance.now();
for (let i = 0; i < ITERS; i++) hypAttn.compute(query, keys, values);
const hypTime = (performance.now() - hypStart) / ITERS;

// Linear (tensor network approximation)
const linAttn = new attention.LinearAttention(DIM, 32);
const linStart = performance.now();
for (let i = 0; i < ITERS; i++) linAttn.compute(query, keys, values);
const linTime = (performance.now() - linStart) / ITERS;

// Flash (memory-efficient)
const flashAttn = new attention.FlashAttention(DIM, 16);
const flashStart = performance.now();
for (let i = 0; i < ITERS; i++) flashAttn.compute(query, keys, values);
const flashTime = (performance.now() - flashStart) / ITERS;

console.log('   ┌─────────────────────────────────────────────────────────────┐');
console.log('   │ Mechanism              Time/Op     Ops/sec    Complexity   │');
console.log('   ├─────────────────────────────────────────────────────────────┤');
console.log('   │ DotProduct             ' + dotTime.toFixed(3).padStart(6) + 'ms   ' + (1000/dotTime).toFixed(0).padStart(7) + '    O(n²)        │');
console.log('   │ Flash                  ' + flashTime.toFixed(3).padStart(6) + 'ms   ' + (1000/flashTime).toFixed(0).padStart(7) + '    O(n²) IO-opt │');
console.log('   │ Linear (Tensor Net)    ' + linTime.toFixed(3).padStart(6) + 'ms   ' + (1000/linTime).toFixed(0).padStart(7) + '    O(n)         │');
console.log('   │ Hyperbolic (Quantum)   ' + hypTime.toFixed(3).padStart(6) + 'ms   ' + (1000/hypTime).toFixed(0).padStart(7) + '    O(n²)        │');
console.log('   └─────────────────────────────────────────────────────────────┘\n');

console.log('   Key Insight: Linear attention achieves O(n) by approximating');
console.log('   the attention kernel with random features - similar to how');
console.log('   quantum feature maps work in exponential Hilbert spaces.\n');

console.log('✅ Quantum-Inspired Attention Demonstrations Complete!\n');

// Hyperbolic math demos
console.log('5. HYPERBOLIC GEOMETRY OPERATIONS (Poincaré Ball)\n');

const v1 = new Float32Array([0.3, 0.4, 0.0, 0.0]);
const v2 = new Float32Array([0.2, -0.3, 0.1, 0.0]);

console.log('   Vector 1: [' + Array.from(v1).map(x => x.toFixed(2)).join(', ') + ']');
console.log('   Vector 2: [' + Array.from(v2).map(x => x.toFixed(2)).join(', ') + ']');

const proj1 = attention.projectToPoincareBall(v1, 1.0);
const proj2 = attention.projectToPoincareBall(v2, 1.0);
const dist = attention.poincareDistance(proj1, proj2, 1.0);
const mobius = attention.mobiusAddition(proj1, proj2, 1.0);

console.log('\n   Projected to Poincaré ball (curvature=1.0)');
console.log('   Poincaré distance: ' + dist.toFixed(4));
console.log('   Möbius addition: [' + Array.from(mobius).map(x => x.toFixed(3)).join(', ') + ']');

const origin = new Float32Array(4).fill(0);
const expMapped = attention.expMap(origin, v1, 1.0);
const logMapped = attention.logMap(origin, proj1, 1.0);

console.log('\n   Exponential map (tangent → ball): [' + Array.from(expMapped).map(x => x.toFixed(3)).join(', ') + ']');
console.log('   Logarithmic map (ball → tangent): [' + Array.from(logMapped).map(x => x.toFixed(3)).join(', ') + ']\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('                    FUTURE ATTENTION ROADMAP SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log('  2025-2027: Classical simulation of quantum attention');
console.log('  2027-2030: Hybrid quantum-classical attention on NISQ devices');
console.log('  2030-2035: Fault-tolerant quantum attention (millions of qubits)');
console.log('  2035+:     Room-temperature quantum attention processors\n');

console.log('  The foundations are being built TODAY with @ruvector/attention!\n');
