/**
 * Self-Learning Capabilities Review for @ruvector/ruvllm@0.2.0
 *
 * This script analyzes and demonstrates the self-learning features:
 * 1. SONA Adaptive Learning System
 * 2. EWC++ Continual Learning (Catastrophic Forgetting Prevention)
 * 3. Trajectory-Based Learning
 * 4. Federated Learning Aggregation
 * 5. LoRA Adaptation Mechanisms
 * 6. ReasoningBank Pattern Recognition
 */

const {
  // SONA System
  SonaCoordinator,
  TrajectoryBuilder,
  ReasoningBank,
  EwcManager,

  // Federated Learning
  EphemeralAgent,
  FederatedCoordinator,

  // LoRA
  LoraAdapter,
  LoraManager,

  // Training
  TrainingPipeline,
  TrainingFactory,
} = require('@ruvector/ruvllm');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomEmbedding(dim = 64) {
  return Array.from({ length: dim }, () => (Math.random() - 0.5) * 2);
}

function normalizeEmbedding(emb) {
  const norm = Math.sqrt(emb.reduce((s, x) => s + x * x, 0)) || 1;
  return emb.map(x => x / norm);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

function printSection(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

function printSubsection(title) {
  console.log(`\n\x1b[36m▶ ${title}\x1b[0m\n`);
}

// ============================================================================
// REVIEW STARTS HERE
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║     SELF-LEARNING CAPABILITIES REVIEW - @ruvector/ruvllm@0.2.0      ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

// ============================================================================
// 1. SONA ADAPTIVE LEARNING SYSTEM
// ============================================================================
printSection('1. SONA ADAPTIVE LEARNING SYSTEM');

printSubsection('1.1 Architecture Overview');
console.log(`
  SONA (Self-Optimizing Neural Architecture) provides:

  ┌─────────────────────────────────────────────────────────────────┐
  │                    SONA Coordinator                             │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
  │  │ Instant Loop │  │ Background   │  │ ReasoningBank        │  │
  │  │ (real-time)  │  │ Loop (batch) │  │ (pattern storage)    │  │
  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │
  │         ↓                  ↓                    ↓               │
  │  ┌────────────────────────────────────────────────────────┐    │
  │  │              EWC++ Memory Protection                   │    │
  │  │         (prevents catastrophic forgetting)             │    │
  │  └────────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────────┘
`);

printSubsection('1.2 SonaCoordinator Configuration');
const sona = new SonaCoordinator({
  instantLoopEnabled: true,
  backgroundLoopEnabled: true,
  loraLearningRate: 0.001,
  loraRank: 8,
  ewcLambda: 2000,
  maxTrajectorySize: 1000,
  patternThreshold: 0.85,
});

const sonaStats = sona.stats();
console.log('  Default Configuration:');
console.log('  ├─ Instant Loop:     enabled (real-time learning for high-quality signals)');
console.log('  ├─ Background Loop:  enabled (batch processing of trajectories)');
console.log('  ├─ LoRA Learning Rate: 0.001');
console.log('  ├─ LoRA Rank:        8');
console.log('  ├─ EWC Lambda:       2000 (memory protection strength)');
console.log('  ├─ Max Trajectory:   1000 (buffer size)');
console.log('  └─ Pattern Threshold: 0.85 (minimum confidence for pattern extraction)');

printSubsection('1.3 Learning Signal Processing');
console.log('  Signal Types:');
console.log('  ├─ positive:   User explicitly approves response');
console.log('  ├─ negative:   User rejects response');
console.log('  ├─ correction: User provides corrected output');
console.log('  └─ implicit:   Inferred from user behavior');
console.log();
console.log('  Processing Flow:');
console.log('  1. Signal received → check quality threshold');
console.log('  2. High quality (≥0.8) → Instant Loop (immediate LoRA update)');
console.log('  3. All signals → Buffer for Background Loop');

// Demonstrate signal recording
sona.recordSignal({
  requestId: 'req-001',
  quality: 0.92,
  type: 'positive',
  timestamp: new Date(),
});

sona.recordSignal({
  requestId: 'req-002',
  quality: 0.65,
  type: 'implicit',
  timestamp: new Date(),
});

console.log('\n  Recorded 2 learning signals:');
console.log(`  └─ Signals buffered: ${sona.stats().signalsReceived}`);

// ============================================================================
// 2. TRAJECTORY-BASED LEARNING
// ============================================================================
printSection('2. TRAJECTORY-BASED LEARNING');

printSubsection('2.1 TrajectoryBuilder Usage');
console.log('  Trajectories track the complete execution path of a query:');
console.log();

const builder = new TrajectoryBuilder();

// Simulate a query execution
builder.startStep('query', 'What is machine learning?');
builder.endStep('Processing query...', 0.95);

builder.startStep('route', 'Selecting model');
builder.endStep('Selected: B1_2 (1.2B params)', 0.88);

builder.startStep('memory', 'Retrieving context');
builder.endStep('Found 5 relevant documents', 0.92);

builder.startStep('generate', 'Generating response');
builder.endStep('Machine learning is a subset of AI...', 0.94);

builder.startStep('feedback', 'Recording outcome');
builder.endStep('User satisfied', 1.0);

const trajectory = builder.complete('success');

console.log(`  Trajectory ID: ${trajectory.id}`);
console.log(`  Duration: ${trajectory.durationMs}ms`);
console.log(`  Outcome: ${trajectory.outcome}`);
console.log(`  Steps: ${trajectory.steps.length}`);
console.log();
console.log('  Step Breakdown:');
trajectory.steps.forEach((step, i) => {
  const prefix = i === trajectory.steps.length - 1 ? '└─' : '├─';
  console.log(`  ${prefix} [${step.type}] confidence: ${step.confidence.toFixed(2)}, duration: ${step.durationMs}ms`);
});

printSubsection('2.2 Pattern Extraction from Trajectories');
sona.recordTrajectory(trajectory);

console.log('  Pattern extraction rules:');
console.log('  ├─ Only successful/partial trajectories are processed');
console.log('  ├─ Steps with confidence ≥ threshold are converted to patterns');
console.log('  ├─ Similar patterns are deduplicated (cosine similarity check)');
console.log('  └─ Pattern types: query_response, routing, context_retrieval, correction');

const bgResult = sona.runBackgroundLoop();
console.log(`\n  Background loop result:`);
console.log(`  ├─ Patterns learned: ${bgResult.patternsLearned}`);
console.log(`  └─ Trajectories processed: ${bgResult.trajectoriesProcessed}`);

// ============================================================================
// 3. EWC++ CONTINUAL LEARNING
// ============================================================================
printSection('3. EWC++ CONTINUAL LEARNING (Catastrophic Forgetting Prevention)');

printSubsection('3.1 EWC++ Theory');
console.log(`
  Elastic Weight Consolidation (EWC++) prevents catastrophic forgetting by:

  1. Fisher Information Matrix: Estimates importance of each weight
  2. Optimal Weights Storage: Saves weights after successful task learning
  3. Penalty Term: Adds regularization to prevent important weight changes

  Loss = Task_Loss + λ/2 * Σᵢ Fᵢ(θᵢ - θ*ᵢ)²

  Where:
  - λ (lambda) = protection strength (higher = more conservative updates)
  - F = Fisher diagonal (importance of each weight)
  - θ* = optimal weights from previous tasks
`);

printSubsection('3.2 EWC Manager Demonstration');
const ewc = new EwcManager(2000); // lambda = 2000

// Simulate learning multiple tasks
const task1Weights = randomEmbedding(128);
const task2Weights = randomEmbedding(128);
const task3Weights = randomEmbedding(128);

ewc.registerTask('task-coding', task1Weights);
ewc.registerTask('task-math', task2Weights);
ewc.registerTask('task-writing', task3Weights);

console.log('  Registered 3 tasks with EWC protection:');
console.log('  ├─ task-coding');
console.log('  ├─ task-math');
console.log('  └─ task-writing');

const ewcStats = ewc.stats();
console.log(`\n  EWC Statistics:`);
console.log(`  ├─ Tasks learned: ${ewcStats.tasksLearned}`);
console.log(`  ├─ Fisher computed: ${ewcStats.fisherComputed}`);
console.log(`  ├─ Protection strength: ${ewcStats.protectionStrength}`);
console.log(`  └─ Estimated forgetting rate: ${(ewcStats.forgettingRate * 100).toFixed(1)}%`);

// Demonstrate penalty computation
const currentWeights = randomEmbedding(128);
const penalty = ewc.computePenalty(currentWeights);
console.log(`\n  Penalty for divergent weights: ${penalty.toFixed(4)}`);

// Small deviation
const smallDeviation = task1Weights.map((w, i) => w + (Math.random() - 0.5) * 0.01);
const smallPenalty = ewc.computePenalty(smallDeviation);
console.log(`  Penalty for small deviation: ${smallPenalty.toFixed(4)}`);
console.log(`  → Higher penalty = weights drifting from learned tasks`);

// ============================================================================
// 4. REASONING BANK (PATTERN STORAGE & RETRIEVAL)
// ============================================================================
printSection('4. REASONING BANK (Pattern Storage & Retrieval)');

printSubsection('4.1 Pattern Storage');
const bank = new ReasoningBank(0.85); // threshold 0.85

// Store some patterns
const patterns = [
  { type: 'query_response', embedding: normalizeEmbedding(randomEmbedding(64)) },
  { type: 'routing', embedding: normalizeEmbedding(randomEmbedding(64)) },
  { type: 'context_retrieval', embedding: normalizeEmbedding(randomEmbedding(64)) },
  { type: 'correction', embedding: normalizeEmbedding(randomEmbedding(64)) },
];

patterns.forEach(p => bank.store(p.type, p.embedding));

console.log('  Pattern Types:');
console.log('  ├─ query_response:    Successful Q&A patterns');
console.log('  ├─ routing:           Model selection decisions');
console.log('  ├─ context_retrieval: Memory search patterns');
console.log('  └─ correction:        User correction patterns');

const bankStats = bank.stats();
console.log(`\n  Bank Statistics:`);
console.log(`  ├─ Total patterns: ${bankStats.totalPatterns}`);
console.log(`  ├─ Avg success rate: ${(bankStats.avgSuccessRate * 100).toFixed(1)}%`);
console.log(`  └─ By type: ${JSON.stringify(bankStats.byType)}`);

printSubsection('4.2 Pattern Retrieval (Similarity Search)');
const queryEmb = normalizeEmbedding(randomEmbedding(64));
const similar = bank.findSimilar(queryEmb, 3);

console.log(`  Query embedding → Find top 3 similar patterns`);
console.log(`  Found: ${similar.length} patterns above threshold`);
similar.forEach((p, i) => {
  console.log(`  ${i + 1}. [${p.type}] success rate: ${(p.successRate * 100).toFixed(0)}%`);
});

printSubsection('4.3 Pattern Lifecycle Management');
// Simulate usage
const patternId = bank.store('query_response', normalizeEmbedding(randomEmbedding(64)));
bank.recordUsage(patternId, true);  // success
bank.recordUsage(patternId, true);  // success
bank.recordUsage(patternId, false); // failure
bank.recordUsage(patternId, true);  // success

const pattern = bank.get(patternId);
console.log(`  Pattern ${patternId.slice(0, 12)}...`);
console.log(`  ├─ Use count: ${pattern?.useCount}`);
console.log(`  ├─ Success rate: ${((pattern?.successRate || 0) * 100).toFixed(1)}%`);
console.log(`  └─ Last used: ${pattern?.lastUsed}`);

console.log('\n  Pruning (removes low-performing patterns):');
console.log('  └─ Patterns with <30% success rate and ≥5 uses are removed');

// ============================================================================
// 5. FEDERATED LEARNING
// ============================================================================
printSection('5. FEDERATED LEARNING');

printSubsection('5.1 Federated Architecture');
console.log(`
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  Agent A    │     │  Agent B    │     │  Agent C    │
  │ (ephemeral) │     │ (ephemeral) │     │ (ephemeral) │
  │  Edge Node  │     │  Edge Node  │     │  Edge Node  │
  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
         │                   │                   │
         │  exportState()    │  exportState()    │  exportState()
         ▼                   ▼                   ▼
  ┌────────────────────────────────────────────────────────┐
  │              Federated Coordinator                     │
  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
  │  │  Aggregation │  │ Master LoRA  │  │ Reasoning   │  │
  │  │    Engine    │  │   Weights    │  │    Bank     │  │
  │  └──────────────┘  └──────────────┘  └─────────────┘  │
  │           ↓                ↓                ↓         │
  │  ┌────────────────────────────────────────────────┐   │
  │  │         Consolidated Global Knowledge          │   │
  │  └────────────────────────────────────────────────┘   │
  └────────────────────────────────────────────────────────┘
`);

printSubsection('5.2 Ephemeral Agent Lifecycle');
const agent = new EphemeralAgent('agent-demo', { hiddenDim: 128 });

// Simulate agent processing tasks
console.log('  Simulating agent processing 100 tasks...');
for (let i = 0; i < 100; i++) {
  const embedding = randomEmbedding(128);
  const quality = 0.6 + Math.random() * 0.4; // 0.6 - 1.0
  agent.processTask(embedding, quality);
}

const agentStats = agent.stats();
console.log(`\n  Agent Statistics:`);
console.log(`  ├─ Agent ID: ${agent.getAgentId()}`);
console.log(`  ├─ Trajectories: ${agentStats.totalTrajectories}`);
console.log(`  ├─ Avg Quality: ${(agentStats.avgQuality * 100).toFixed(1)}%`);
console.log(`  ├─ Patterns Learned: ${agentStats.patternsLearned}`);
console.log(`  └─ Uptime: ${agent.uptimeSeconds()}s`);

printSubsection('5.3 Coordinator Aggregation');
const coordinator = new FederatedCoordinator('coord-main', {
  hiddenDim: 128,
  qualityThreshold: 0.4,
});

// Create multiple agents and aggregate
console.log('  Simulating 5 ephemeral agents contributing to coordinator...\n');

for (let a = 0; a < 5; a++) {
  const agentN = new EphemeralAgent(`agent-${a + 1}`, { hiddenDim: 128 });

  // Each agent processes different number of tasks
  const taskCount = 50 + Math.floor(Math.random() * 50);
  for (let i = 0; i < taskCount; i++) {
    agentN.processTask(randomEmbedding(128), 0.5 + Math.random() * 0.5);
  }

  const exportData = agentN.exportState();
  const result = coordinator.aggregate(exportData);

  console.log(`  Agent ${a + 1}:`);
  console.log(`    ├─ Contributed: ${exportData.trajectories.length} trajectories`);
  console.log(`    ├─ Accepted: ${result.trajectoriesAccepted}`);
  console.log(`    ├─ Rejected: ${result.trajectoriesRejected} (below quality threshold)`);
  console.log(`    └─ Consolidated: ${result.consolidated ? 'yes' : 'no'}`);
}

const coordStats = coordinator.stats();
console.log(`\n  Coordinator Final State:`);
console.log(`  ├─ Total Agents: ${coordStats.totalAgents}`);
console.log(`  ├─ Total Trajectories: ${coordStats.totalTrajectories}`);
console.log(`  ├─ Patterns Learned: ${coordStats.patternsLearned}`);
console.log(`  ├─ Avg Quality: ${(coordStats.avgQuality * 100).toFixed(1)}%`);
console.log(`  └─ Quality Threshold: ${coordStats.qualityThreshold}`);

printSubsection('5.4 Pattern Distribution via Coordinator');
const newAgent = coordinator.createAgent('new-agent');
console.log('  New agent created with coordinator patterns:');
console.log(`  └─ Agent ID: ${newAgent.getAgentId()}`);

// ============================================================================
// 6. LORA ADAPTATION MECHANISMS
// ============================================================================
printSection('6. LORA ADAPTATION MECHANISMS');

printSubsection('6.1 LoRA Theory');
console.log(`
  Low-Rank Adaptation (LoRA) enables efficient fine-tuning:

  W' = W + ΔW = W + BA

  Where:
  - W = original weight matrix (frozen)
  - B = down-projection (d × r), initialized to zero
  - A = up-projection (r × d), initialized with Gaussian
  - r = rank (4, 8, 16, 32) << d

  Benefits:
  - Parameter efficient: Only r*d*2 parameters instead of d*d
  - Memory efficient: No need to store full weight gradients
  - Composable: Multiple adapters can be combined
`);

printSubsection('6.2 LoRA Adapter Training');
const adapter = new LoraAdapter({ rank: 8, alpha: 16, dropout: 0.1 }, 256, 256);

console.log('  Adapter Configuration:');
console.log(`  ├─ Rank: ${adapter.getConfig().rank}`);
console.log(`  ├─ Alpha: ${adapter.getConfig().alpha}`);
console.log(`  ├─ Input Dim: 256`);
console.log(`  ├─ Output Dim: 256`);
console.log(`  └─ Parameters: ${adapter.numParameters()} (vs ${256 * 256} for full matrix)`);

// Training demonstration
adapter.startTraining(0.001);

console.log('\n  Training for 100 steps...');
let totalLoss = 0;
for (let step = 0; step < 100; step++) {
  const input = randomEmbedding(256);
  const target = randomEmbedding(256);

  // Forward pass
  const output = adapter.forward(input);

  // Compute gradient (simplified MSE)
  const gradOutput = output.map((o, i) => o - target[i]);

  // Backward pass
  const loss = adapter.backward(input, gradOutput, 0.001);
  totalLoss += loss;
}

const trainingState = adapter.endTraining();
console.log(`\n  Training Results:`);
console.log(`  ├─ Steps: ${trainingState?.step}`);
console.log(`  ├─ Final LR: ${trainingState?.learningRate}`);
console.log(`  └─ Avg Loss: ${(totalLoss / 100).toFixed(6)}`);

printSubsection('6.3 LoRA Manager (Multi-Adapter)');
const manager = new LoraManager({ rank: 8 });

// Create adapters for different tasks
manager.create('coding', { rank: 8 }, 256, 256);
manager.create('math', { rank: 16 }, 256, 256);
manager.create('creative', { rank: 4 }, 256, 256);

console.log('  Registered Adapters:');
manager.list().forEach(id => {
  const adpt = manager.get(id);
  console.log(`  ├─ ${id}: rank=${adpt?.getConfig().rank}, params=${adpt?.numParameters()}`);
});

const mgrStats = manager.stats();
console.log(`\n  Manager Statistics:`);
console.log(`  ├─ Total Adapters: ${mgrStats.totalAdapters}`);
console.log(`  ├─ Total Parameters: ${mgrStats.totalParameters}`);
console.log(`  └─ Active Adapter: ${mgrStats.activeAdapter || 'none'}`);

// ============================================================================
// 7. INTEGRATED LEARNING FLOW
// ============================================================================
printSection('7. INTEGRATED SELF-LEARNING FLOW');

console.log(`
  Complete Learning Pipeline:

  ┌──────────────────────────────────────────────────────────────────┐
  │                        USER QUERY                                │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  1. TrajectoryBuilder.startStep('query', input)                  │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  2. ReasoningBank.findSimilar(queryEmbedding)                    │
  │     → Retrieve relevant patterns for context                     │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  3. LoraAdapter.forward(hidden_states)                           │
  │     → Apply task-specific adaptations                            │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  4. Generate Response + Record Trajectory                        │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  5. User Feedback → LearningSignal                               │
  └───────────────────────────┬──────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
  ┌────────────────────────┐  ┌────────────────────────────────────┐
  │  High Quality (≥0.8)   │  │  All Signals                       │
  │  → Instant Loop        │  │  → Background Loop                 │
  │  → Immediate LoRA      │  │  → Batch Pattern Extraction        │
  │     weight update      │  │  → ReasoningBank update            │
  └────────────────────────┘  └────────────────────────────────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  6. EWC++ Regularization                                         │
  │     → Protect important weights from previous tasks              │
  └──────────────────────────────────────────────────────────────────┘
`);

// ============================================================================
// 8. SUMMARY & RECOMMENDATIONS
// ============================================================================
printSection('8. SUMMARY & RECOMMENDATIONS');

console.log(`
  \x1b[32m✓ STRENGTHS\x1b[0m

  1. Multi-Loop Learning Architecture
     - Instant loop for high-quality, real-time updates
     - Background loop for batch pattern extraction
     - Separation allows tuning speed vs. quality trade-off

  2. Catastrophic Forgetting Prevention (EWC++)
     - Fisher diagonal approximation for importance estimation
     - Optimal weight storage per task
     - Configurable protection strength (lambda)

  3. Federated Learning Support
     - Ephemeral agents for edge processing
     - Quality-gated aggregation
     - Master LoRA weight consolidation
     - Pattern sharing across agents

  4. Efficient Pattern Storage (ReasoningBank)
     - Cosine similarity with pre-computed norms
     - Partial sorting for top-k retrieval
     - Automatic pruning of low-performing patterns

  5. Parameter-Efficient Adaptation (LoRA)
     - Configurable rank for capacity/speed trade-off
     - Training with gradient accumulation
     - Multi-adapter management with activation switching

  \x1b[33m⚠ CONSIDERATIONS\x1b[0m

  1. Simplified Embeddings
     - Hash-based embedding in SONA (should use model embeddings in production)

  2. Memory Growth
     - Pattern storage grows with usage; monitor and prune regularly

  3. Quality Threshold Tuning
     - Default 0.4 for federation may be too permissive for some use cases
     - Default 0.85 for pattern extraction may be too restrictive

  4. EWC Lambda Selection
     - Default 2000 is a reasonable starting point
     - May need tuning based on task diversity

  \x1b[36m📊 KEY METRICS TO MONITOR\x1b[0m

  - Pattern success rate (aim for >70%)
  - EWC forgetting rate (should decrease over time)
  - Quality threshold acceptance rate (balance coverage vs. quality)
  - LoRA training loss convergence
`);

console.log('\n' + '═'.repeat(70));
console.log('  REVIEW COMPLETE');
console.log('═'.repeat(70));
console.log('\n  The self-learning capabilities are well-implemented with:');
console.log('  • Clean separation of concerns');
console.log('  • Performance optimizations (typed arrays, partial sorting)');
console.log('  • Configurable thresholds and parameters');
console.log('  • Federated learning support for distributed training');
console.log('  • EWC++ for continual learning without catastrophic forgetting');
console.log();
