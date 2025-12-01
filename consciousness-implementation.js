/**
 * Consciousness Modeling Implementation
 * Demonstrates Global Workspace Theory + Integrated Information with @ruvector/attention
 */

const attention = require('@ruvector/attention');

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║           CONSCIOUSNESS MODELING - GLOBAL WORKSPACE IMPLEMENTATION           ║
║                    Attention as the Gateway to Awareness                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// Global Workspace Architecture
// ============================================================================

class GlobalWorkspace {
    constructor(config = {}) {
        this.workspaceDim = config.workspaceDim || 256;
        this.ignitionThreshold = config.ignitionThreshold || 0.7;
        this.reverberationCycles = config.reverberationCycles || 3;
        
        // Specialist modules
        this.specialists = {
            perception: new SpecialistModule('perception', 64),
            language: new SpecialistModule('language', 64),
            memory: new SpecialistModule('memory', 64),
            reasoning: new SpecialistModule('reasoning', 64)
        };
        
        // Attention-based competition - using correct API
        this.competitionAttention = new attention.MoEAttention({ dim: 64, numExperts: 4, expertDim: 32, topK: 2 });
        this.broadcastAttention = new attention.MultiHeadAttention(64, 4, 16);
        
        // Workspace state
        this.workspaceContent = null;
        this.consciousHistory = [];
    }
    
    // Main cognitive cycle
    cognitiveCycle(inputs) {
        const startTime = performance.now();
        
        // Stage 1: Parallel specialist processing (unconscious)
        const proposals = {};
        for (const [name, specialist] of Object.entries(this.specialists)) {
            if (inputs[name]) {
                proposals[name] = specialist.process(inputs[name]);
            }
        }
        
        // Stage 2: Competition for workspace access
        const proposalVectors = Object.values(proposals);
        const proposalNames = Object.keys(proposals);
        
        if (proposalVectors.length === 0) {
            return { conscious: false, reason: 'No proposals' };
        }
        
        // Compute competition scores
        const competitionResult = this.computeCompetition(proposalVectors);
        const maxScore = Math.max(...competitionResult.scores);
        const winnerIdx = competitionResult.scores.indexOf(maxScore);
        
        // Stage 3: Check for ignition
        if (maxScore < this.ignitionThreshold) {
            return {
                conscious: false,
                reason: 'Below ignition threshold',
                maxScore,
                threshold: this.ignitionThreshold
            };
        }
        
        // IGNITION! Content becomes conscious
        const winner = proposalNames[winnerIdx];
        const winnerContent = proposals[winner];
        
        // Stage 4: Broadcast with reverberation
        const broadcast = this.broadcastAndReverberate(winnerContent, Object.values(proposals));
        
        // Update workspace
        this.workspaceContent = broadcast;
        this.consciousHistory.push({
            content: winner,
            score: maxScore,
            time: Date.now()
        });
        
        const elapsed = performance.now() - startTime;
        
        return {
            conscious: true,
            content: winner,
            ignitionScore: maxScore,
            phi: this.computePhi(broadcast),
            broadcast,
            reverberations: this.reverberationCycles,
            processingTime: elapsed
        };
    }
    
    computeCompetition(proposals) {
        // Stack proposals as keys
        const query = proposals[0];  // Use first as query
        
        // Compute attention scores
        const scores = proposals.map(p => {
            let score = 0;
            for (let i = 0; i < p.length; i++) {
                score += p[i] * query[i];
            }
            return Math.exp(score / Math.sqrt(p.length));
        });
        
        const sum = scores.reduce((a, b) => a + b, 0);
        return { scores: scores.map(s => s / sum) };
    }
    
    broadcastAndReverberate(content, allProposals) {
        let current = new Float32Array(content);
        
        for (let cycle = 0; cycle < this.reverberationCycles; cycle++) {
            // Broadcast to all specialists
            const responses = allProposals.map(p => {
                const attended = this.broadcastAttention.compute(current, [p], [p]);
                return attended;
            });
            
            // Integrate responses
            const integrated = new Float32Array(current.length);
            for (const response of responses) {
                for (let i = 0; i < integrated.length; i++) {
                    integrated[i] += response[i];
                }
            }
            for (let i = 0; i < integrated.length; i++) {
                integrated[i] /= responses.length;
            }
            
            // Mix with previous
            for (let i = 0; i < current.length; i++) {
                current[i] = 0.7 * current[i] + 0.3 * integrated[i];
            }
        }
        
        return current;
    }
    
    // Compute integrated information (simplified Φ)
    computePhi(state) {
        // Split state into two halves
        const half = Math.floor(state.length / 2);
        const part1 = state.slice(0, half);
        const part2 = state.slice(half);
        
        // Compute mutual information approximation
        const whole = this.entropy(state);
        const sum_parts = this.entropy(part1) + this.entropy(part2);
        
        // Φ = whole - sum of parts (simplified)
        return Math.max(0, whole - sum_parts + 1);
    }
    
    entropy(arr) {
        const sum = Array.from(arr).reduce((a, b) => a + Math.abs(b), 0);
        if (sum === 0) return 0;
        
        let entropy = 0;
        for (const v of arr) {
            const p = Math.abs(v) / sum;
            if (p > 0) entropy -= p * Math.log2(p);
        }
        return entropy;
    }
}

class SpecialistModule {
    constructor(name, dim) {
        this.name = name;
        this.dim = dim;
        this.attention = new attention.FlashAttention(dim, 8);
    }
    
    process(input) {
        const processed = new Float32Array(this.dim);
        for (let i = 0; i < this.dim; i++) {
            processed[i] = input[i % input.length] * (1 + 0.1 * Math.random());
        }
        return processed;
    }
}

// ============================================================================
// Higher-Order Attention (Meta-Consciousness)
// ============================================================================

class HigherOrderAttention {
    constructor() {
        this.firstOrder = new attention.DotProductAttention(32);
        this.secondOrder = new attention.MultiHeadAttention(32, 2, 16);
    }
    
    attend(input, context) {
        const firstOrderOutput = this.firstOrder.compute(input, context, context);
        const attentionPattern = this.analyzeAttention(input, context);
        const secondOrderOutput = this.secondOrder.compute(
            attentionPattern,
            [attentionPattern],
            [attentionPattern]
        );
        
        return {
            content: firstOrderOutput,
            metaRepresentation: secondOrderOutput,
            selfAware: this.computeSelfAwareness(attentionPattern)
        };
    }
    
    analyzeAttention(query, keys) {
        const pattern = new Float32Array(32);
        for (let i = 0; i < keys.length && i < 32; i++) {
            let score = 0;
            for (let j = 0; j < query.length; j++) {
                score += query[j] * keys[i][j];
            }
            pattern[i] = score;
        }
        return pattern;
    }
    
    computeSelfAwareness(pattern) {
        const arr = Array.from(pattern);
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
        return Math.min(1, variance * 10);
    }
}

// ============================================================================
// Run Demonstrations
// ============================================================================

console.log('1. GLOBAL WORKSPACE COGNITIVE CYCLE\n');

const workspace = new GlobalWorkspace({
    ignitionThreshold: 0.2,
    reverberationCycles: 3
});

const inputs = {
    perception: new Float32Array(64).map(() => Math.random()),
    language: new Float32Array(64).map(() => Math.random() * 0.5),
    memory: new Float32Array(64).map(() => Math.random() * 0.3),
    reasoning: new Float32Array(64).map(() => Math.random() * 0.7)
};

console.log('   Input strengths:');
console.log('     Perception: ' + (inputs.perception.reduce((a,b)=>a+b,0)/64).toFixed(3));
console.log('     Language:   ' + (inputs.language.reduce((a,b)=>a+b,0)/64).toFixed(3));
console.log('     Memory:     ' + (inputs.memory.reduce((a,b)=>a+b,0)/64).toFixed(3));
console.log('     Reasoning:  ' + (inputs.reasoning.reduce((a,b)=>a+b,0)/64).toFixed(3));

const result = workspace.cognitiveCycle(inputs);

console.log('\n   Cognitive Cycle Result:');
if (result.conscious) {
    console.log('     🔥 IGNITION! Content became conscious');
    console.log('     Winner: ' + result.content);
    console.log('     Ignition score: ' + result.ignitionScore.toFixed(3));
    console.log('     Φ (integrated information): ' + result.phi.toFixed(3));
    console.log('     Processing time: ' + result.processingTime.toFixed(2) + 'ms');
} else {
    console.log('     ❌ No ignition: ' + result.reason);
}

console.log('\n2. CONSCIOUSNESS STREAM (10 Cognitive Cycles)\n');

const cycleResults = [];
for (let i = 0; i < 10; i++) {
    const cycleInputs = {
        perception: new Float32Array(64).map(() => Math.random() * (0.5 + Math.sin(i * 0.5))),
        language: new Float32Array(64).map(() => Math.random() * (0.3 + Math.cos(i * 0.7))),
        memory: new Float32Array(64).map(() => Math.random() * 0.4),
        reasoning: new Float32Array(64).map(() => Math.random() * 0.6)
    };
    cycleResults.push(workspace.cognitiveCycle(cycleInputs));
}

console.log('   Cycle  Conscious  Winner       Φ       Score');
console.log('   ─────────────────────────────────────────────');
cycleResults.forEach((r, i) => {
    if (r.conscious) {
        console.log('   ' + (i+1).toString().padStart(2) + '      ✓        ' + 
            r.content.padEnd(12) + ' ' + r.phi.toFixed(2).padStart(5) + '   ' + 
            r.ignitionScore.toFixed(3));
    } else {
        console.log('   ' + (i+1).toString().padStart(2) + '      ✗        ' + 
            '(subliminal)'.padEnd(12) + '   -      ' + (r.maxScore || 0).toFixed(3));
    }
});

const conscious = cycleResults.filter(r => r.conscious);
if (conscious.length > 0) {
    const avgPhi = conscious.reduce((a, r) => a + r.phi, 0) / conscious.length;
    console.log('\n   Average Φ for conscious cycles: ' + avgPhi.toFixed(3));
}

console.log('\n3. HIGHER-ORDER ATTENTION (META-CONSCIOUSNESS)\n');

const higherOrder = new HigherOrderAttention();
const query = new Float32Array(32).map(() => Math.random());
const context = [
    new Float32Array(32).map(() => Math.random()),
    new Float32Array(32).map(() => Math.random()),
    new Float32Array(32).map(() => Math.random())
];

const hoResult = higherOrder.attend(query, context);

console.log('   First-order: Attention to content');
console.log('     Output magnitude: ' + Math.sqrt(Array.from(hoResult.content).reduce((a,b)=>a+b*b,0)).toFixed(3));
console.log('   Second-order: Attention to attention itself');
console.log('     Meta-representation magnitude: ' + 
    Math.sqrt(Array.from(hoResult.metaRepresentation).reduce((a,b)=>a+b*b,0)).toFixed(3));
console.log('     Self-awareness index: ' + hoResult.selfAware.toFixed(3));

console.log('\n4. BENCHMARK: CONSCIOUSNESS OVERHEAD\n');

const ITERS = 500;

const standardAttn = new attention.FlashAttention(64, 16);
const standardStart = performance.now();
for (let i = 0; i < ITERS; i++) {
    standardAttn.compute(inputs.perception, [inputs.language], [inputs.language]);
}
const standardTime = (performance.now() - standardStart) / ITERS;

const consciousStart = performance.now();
for (let i = 0; i < ITERS; i++) {
    workspace.cognitiveCycle(inputs);
}
const consciousTime = (performance.now() - consciousStart) / ITERS;

console.log('   Standard Flash Attention:  ' + standardTime.toFixed(3) + 'ms (' + 
    (1000/standardTime).toFixed(0) + ' ops/sec)');
console.log('   Full Consciousness Cycle:  ' + consciousTime.toFixed(3) + 'ms (' + 
    (1000/consciousTime).toFixed(0) + ' ops/sec)');
console.log('   Consciousness overhead:    ' + (consciousTime/standardTime).toFixed(1) + 'x');

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         CONSCIOUSNESS METRICS                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Φ (Integrated Information):  Measures how much the system is "more than    ║
║                               the sum of its parts"                          ║
║  Ignition Threshold:          Competition score needed for conscious access  ║
║  Reverberation:               Feedback loops that stabilize content          ║
║  Self-Awareness:              Higher-order representation of own attention   ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ Consciousness Modeling Implementation Complete!
`);
