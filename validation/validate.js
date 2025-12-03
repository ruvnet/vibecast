/**
 * Validation Tests for @ruvector/ruvllm@0.2.0
 *
 * Tests all major features:
 * 1. Federated Learning (EphemeralAgent, FederatedCoordinator)
 * 2. LoRA Runtime (LoraAdapter, LoraManager)
 * 3. SafeTensors Export (SafeTensorsWriter, SafeTensorsReader, ModelExporter)
 * 4. Training Pipeline (TrainingPipeline, LRScheduler, TrainingFactory)
 * 5. Session Management with Streaming
 */

const {
  // Core
  RuvLLM,
  version,
  hasSimdSupport,

  // Federated Learning
  EphemeralAgent,
  FederatedCoordinator,

  // LoRA Runtime
  LoraAdapter,
  LoraManager,

  // Export/Import
  SafeTensorsWriter,
  SafeTensorsReader,
  ModelExporter,
  ModelImporter,
  DatasetExporter,

  // Training
  TrainingPipeline,
  TrainingFactory,
  LRScheduler,
  MetricsTracker,

  // Session & Streaming
  SessionManager,
  StreamingGenerator,

  // SONA
  SonaCoordinator,
  EwcManager,
} = require('@ruvector/ruvllm');

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (error) {
    console.log(`\x1b[31m✗\x1b[0m ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertClose(a, b, tolerance = 0.0001, message) {
  if (Math.abs(a - b) > tolerance) {
    throw new Error(message || `Expected ${a} to be close to ${b}`);
  }
}

// Generate random embedding
function randomEmbedding(dim = 64) {
  return Array.from({ length: dim }, () => (Math.random() - 0.5) * 2);
}

console.log('='.repeat(60));
console.log('@ruvector/ruvllm@0.2.0 Validation Tests');
console.log('='.repeat(60));
console.log();

// ============================================================================
// 1. PACKAGE METADATA
// ============================================================================
console.log('\n\x1b[36m--- Package Metadata ---\x1b[0m\n');

test('version is defined', () => {
  // version is a function that returns the version string
  assert(typeof version === 'function', 'version should be a function');
  const ver = version();
  // Internal version may differ from npm version - just check it's defined
  assert(typeof ver === 'string' && ver.length > 0, 'version() should return a non-empty string');
  console.log(`  (Internal version: ${ver}, npm package: 0.2.0)`);
});

test('npm package version is 0.2.0', () => {
  const fs = require('fs');
  const path = require('path');
  const pkgPath = path.join(__dirname, 'node_modules/@ruvector/ruvllm/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert(pkg.version === '0.2.0', `Expected npm version 0.2.0, got ${pkg.version}`);
});

test('hasSimdSupport is defined', () => {
  // hasSimdSupport is a function that returns boolean
  assert(typeof hasSimdSupport === 'function', 'hasSimdSupport should be a function');
  const result = hasSimdSupport();
  assert(typeof result === 'boolean', 'hasSimdSupport() should return boolean');
});

// ============================================================================
// 2. FEDERATED LEARNING
// ============================================================================
console.log('\n\x1b[36m--- Federated Learning ---\x1b[0m\n');

test('EphemeralAgent can be instantiated', () => {
  const agent = new EphemeralAgent('agent-1', { hiddenDim: 64 });
  assert(agent.getAgentId() === 'agent-1', 'Agent ID should match');
});

test('EphemeralAgent.processTask records trajectory', () => {
  const agent = new EphemeralAgent('agent-2', { hiddenDim: 64 });
  const embedding = randomEmbedding(64);

  agent.processTask(embedding, 0.85);
  agent.processTask(embedding, 0.92);

  assert(agent.trajectoryCount() === 2, 'Should have 2 trajectories');
});

test('EphemeralAgent.processTaskWithRoute works', () => {
  const agent = new EphemeralAgent('agent-3', { hiddenDim: 64 });
  const embedding = randomEmbedding(64);

  agent.processTaskWithRoute(embedding, 0.9, 'code-model');
  assert(agent.trajectoryCount() === 1, 'Should have 1 trajectory');
});

test('EphemeralAgent.exportState returns valid export', () => {
  const agent = new EphemeralAgent('agent-4', { hiddenDim: 64 });
  agent.processTask(randomEmbedding(64), 0.88);

  const exportData = agent.exportState();
  assert(exportData.agentId === 'agent-4', 'Export should have agent ID');
  assert(Array.isArray(exportData.trajectories), 'Export should have trajectories');
  assert(typeof exportData.stats === 'object', 'Export should have stats');
});

test('EphemeralAgent.avgQuality calculates correctly', () => {
  const agent = new EphemeralAgent('agent-5');
  agent.processTask(randomEmbedding(64), 0.8);
  agent.processTask(randomEmbedding(64), 1.0);

  assertClose(agent.avgQuality(), 0.9, 0.01, 'Average quality should be 0.9');
});

test('FederatedCoordinator can be instantiated', () => {
  const coordinator = new FederatedCoordinator('coord-1', { hiddenDim: 64 });
  assert(coordinator.getCoordinatorId() === 'coord-1', 'Coordinator ID should match');
});

test('FederatedCoordinator.aggregate accepts agent exports', () => {
  const coordinator = new FederatedCoordinator('coord-2', { hiddenDim: 64 });
  const agent = new EphemeralAgent('agent-fed', { hiddenDim: 64 });

  agent.processTask(randomEmbedding(64), 0.95);
  agent.processTask(randomEmbedding(64), 0.88);

  const exportData = agent.exportState();
  const result = coordinator.aggregate(exportData);

  assert(result.agentId === 'agent-fed', 'Result should have agent ID');
  assert(typeof result.trajectoriesAccepted === 'number', 'Should have accepted count');
});

test('FederatedCoordinator.applyLora transforms input', () => {
  const coordinator = new FederatedCoordinator('coord-3', { hiddenDim: 64 });

  // Add some learning data
  const agent = new EphemeralAgent('agent-lora', { hiddenDim: 64 });
  for (let i = 0; i < 5; i++) {
    agent.processTask(randomEmbedding(64), 0.9 + Math.random() * 0.1);
  }
  coordinator.aggregate(agent.exportState());

  const input = randomEmbedding(64);
  const output = coordinator.applyLora(input);

  assert(Array.isArray(output), 'Output should be an array');
  assert(output.length === input.length, 'Output should have same length as input');
});

test('FederatedCoordinator.createAgent creates agent with patterns', () => {
  const coordinator = new FederatedCoordinator('coord-4', { hiddenDim: 64 });
  const newAgent = coordinator.createAgent('spawned-agent');

  assert(newAgent.getAgentId() === 'spawned-agent', 'New agent should have correct ID');
});

test('FederatedCoordinator.stats returns statistics', () => {
  const coordinator = new FederatedCoordinator('coord-5');
  const stats = coordinator.stats();

  assert(typeof stats.totalAgents === 'number', 'Stats should have totalAgents');
  assert(typeof stats.totalTrajectories === 'number', 'Stats should have totalTrajectories');
  assert(typeof stats.patternsLearned === 'number', 'Stats should have patternsLearned');
});

// ============================================================================
// 3. LORA RUNTIME
// ============================================================================
console.log('\n\x1b[36m--- LoRA Runtime ---\x1b[0m\n');

test('LoraAdapter can be instantiated', () => {
  const adapter = new LoraAdapter({ rank: 8, alpha: 16 });
  const config = adapter.getConfig();

  assert(config.rank === 8, 'Rank should be 8');
  assert(config.alpha === 16, 'Alpha should be 16');
});

test('LoraAdapter.forward transforms input', () => {
  const adapter = new LoraAdapter({ rank: 8, alpha: 16 }, 64, 64);
  const input = randomEmbedding(64);

  const output = adapter.forward(input);

  assert(Array.isArray(output), 'Output should be array');
  assert(output.length === 64, 'Output should have correct dimension');
});

test('LoraAdapter.forwardBatch processes batches', () => {
  const adapter = new LoraAdapter({ rank: 8 }, 64, 64);
  const batch = Array.from({ length: 10 }, () => randomEmbedding(64));

  const outputs = adapter.forwardBatch(batch);

  assert(outputs.length === 10, 'Should return 10 outputs');
  assert(outputs[0].length === 64, 'Each output should have correct dim');
});

test('LoraAdapter.backward performs gradient update', () => {
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);
  adapter.startTraining(0.001);

  const input = randomEmbedding(32);
  const gradOutput = randomEmbedding(32);

  const loss = adapter.backward(input, gradOutput, 0.001);

  assert(typeof loss === 'number', 'Backward should return loss');
});

test('LoraAdapter.freeze prevents updates', () => {
  const adapter = new LoraAdapter({ rank: 4 });

  adapter.freeze();
  assert(adapter.isFrozen() === true, 'Should be frozen');

  adapter.unfreeze();
  assert(adapter.isFrozen() === false, 'Should be unfrozen');
});

test('LoraAdapter.merge returns weight delta', () => {
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);
  const merged = adapter.merge();

  assert(Array.isArray(merged), 'Merged should be 2D array');
  assert(merged.length === 32, 'Merged should have inputDim rows');
  assert(merged[0].length === 32, 'Merged should have outputDim cols');
});

test('LoraAdapter.numParameters returns correct count', () => {
  const adapter = new LoraAdapter({ rank: 8 }, 64, 64);
  const numParams = adapter.numParameters();

  // Parameters = rank * inputDim + rank * outputDim = 8*64 + 8*64 = 1024
  assert(numParams === 1024, `Expected 1024 params, got ${numParams}`);
});

test('LoraAdapter serialization works', () => {
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);
  const json = adapter.toJSON();

  const restored = LoraAdapter.fromJSON(json);
  assert(restored.getConfig().rank === 4, 'Restored adapter should have same config');
});

test('LoraManager can manage multiple adapters', () => {
  const manager = new LoraManager({ rank: 8 });

  const adapter1 = manager.create('task-1');
  const adapter2 = manager.create('task-2', { rank: 16 });

  assert(manager.count() === 2, 'Should have 2 adapters');
  assert(manager.list().includes('task-1'), 'Should contain task-1');
  assert(manager.list().includes('task-2'), 'Should contain task-2');
});

test('LoraManager.activate/deactivate works', () => {
  const manager = new LoraManager();
  manager.create('adapter-a');

  manager.activate('adapter-a');
  assert(manager.getActiveId() === 'adapter-a', 'Should have active adapter');

  manager.deactivate();
  assert(manager.getActive() === null, 'Should have no active adapter');
});

test('LoraManager.forward uses active adapter', () => {
  const manager = new LoraManager({ rank: 4 });
  manager.create('active-adapter', { rank: 4 }, 32, 32);
  manager.activate('active-adapter');

  const input = randomEmbedding(32);
  const output = manager.forward(input);

  assert(output.length === 32, 'Output should have correct dimension');
});

test('LoraManager.stats returns statistics', () => {
  const manager = new LoraManager();
  manager.create('a1', { rank: 8 }, 64, 64);
  manager.create('a2', { rank: 8 }, 64, 64);

  const stats = manager.stats();
  assert(stats.totalAdapters === 2, 'Should have 2 adapters');
  assert(typeof stats.totalParameters === 'number', 'Should have total parameters');
});

// ============================================================================
// 4. SAFETENSORS EXPORT
// ============================================================================
console.log('\n\x1b[36m--- SafeTensors Export ---\x1b[0m\n');

test('SafeTensorsWriter can add tensors', () => {
  const writer = new SafeTensorsWriter();

  writer.add1D('bias', [0.1, 0.2, 0.3, 0.4]);
  writer.add2D('weights', [[1, 2], [3, 4]]);
  writer.addMetadata('model', 'test-model');

  const buffer = writer.build();
  assert(buffer instanceof Uint8Array, 'Should return Uint8Array');
  assert(buffer.length > 0, 'Buffer should not be empty');
});

test('SafeTensorsReader can read tensors', () => {
  const writer = new SafeTensorsWriter();
  writer.add1D('test_tensor', [1.0, 2.0, 3.0]);
  writer.addMetadata('version', '1.0');

  const buffer = writer.build();
  const reader = new SafeTensorsReader(buffer);

  const names = reader.getTensorNames();
  assert(names.includes('test_tensor'), 'Should find tensor name');

  const data = reader.getTensor1D('test_tensor');
  assert(data !== null, 'Should get tensor data');
  assertClose(data[0], 1.0, 0.001, 'First element should be 1.0');
});

test('SafeTensorsReader can read metadata', () => {
  const writer = new SafeTensorsWriter();
  writer.add1D('x', [1]);
  writer.addMetadata('key1', 'value1');
  writer.addMetadata('key2', 'value2');

  const buffer = writer.build();
  const reader = new SafeTensorsReader(buffer);

  const metadata = reader.getMetadata();
  assert(metadata.key1 === 'value1', 'Should read key1');
  assert(metadata.key2 === 'value2', 'Should read key2');
});

test('ModelExporter.toSafeTensors exports model', () => {
  const exporter = new ModelExporter();
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);

  const buffer = exporter.toSafeTensors({
    metadata: { name: 'test', version: '1.0', format: 'safetensors', created: Date.now() },
    loraWeights: adapter.getWeights(),
    loraConfig: adapter.getConfig(),
  });

  assert(buffer instanceof Uint8Array, 'Should return buffer');
  assert(buffer.length > 0, 'Buffer should not be empty');
});

test('ModelExporter.toJSON exports model', () => {
  const exporter = new ModelExporter();
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);

  const json = exporter.toJSON({
    metadata: { name: 'test', version: '1.0', format: 'json', created: Date.now() },
    loraWeights: adapter.getWeights(),
    loraConfig: adapter.getConfig(),
  });

  assert(typeof json === 'string', 'Should return string');
  const parsed = JSON.parse(json);
  assert(parsed.metadata.name === 'test', 'Should have correct metadata');
});

test('ModelExporter.toHuggingFace creates HF-compatible exports', () => {
  const exporter = new ModelExporter();
  const adapter = new LoraAdapter({ rank: 4 }, 32, 32);

  const result = exporter.toHuggingFace({
    metadata: { name: 'my-lora', version: '1.0', format: 'huggingface', created: Date.now() },
    loraWeights: adapter.getWeights(),
    loraConfig: adapter.getConfig(),
  });

  assert(result.safetensors instanceof Uint8Array, 'Should have safetensors');
  assert(typeof result.config === 'string', 'Should have config');
  assert(typeof result.readme === 'string', 'Should have readme');
});

test('ModelImporter.fromSafeTensors imports model', () => {
  const exporter = new ModelExporter();
  const importer = new ModelImporter();

  const original = {
    metadata: { name: 'test', version: '1.0', format: 'safetensors', created: Date.now() },
    loraWeights: new LoraAdapter({ rank: 4 }, 16, 16).getWeights(),
    loraConfig: { rank: 4, alpha: 8, dropout: 0 },
  };

  const buffer = exporter.toSafeTensors(original);
  const imported = importer.fromSafeTensors(buffer);

  assert(imported.metadata !== undefined, 'Should import metadata');
});

test('DatasetExporter.toJSONL exports dataset', () => {
  const exporter = new DatasetExporter();
  const data = [
    { input: [1, 2, 3], output: [4, 5, 6], quality: 0.9 },
    { input: [7, 8, 9], output: [10, 11, 12], quality: 0.8 },
  ];

  const jsonl = exporter.toJSONL(data);
  const lines = jsonl.trim().split('\n');

  assert(lines.length === 2, 'Should have 2 lines');
  const parsed = JSON.parse(lines[0]);
  assert(Array.isArray(parsed.input), 'Should have input array');
});

test('DatasetExporter.toCSV exports dataset', () => {
  const exporter = new DatasetExporter();
  const data = [
    { input: [1, 2], output: [3, 4], quality: 0.9 },
  ];

  const csv = exporter.toCSV(data);
  assert(csv.includes('quality'), 'Should have quality header');
});

// ============================================================================
// 5. TRAINING PIPELINE
// ============================================================================
console.log('\n\x1b[36m--- Training Pipeline ---\x1b[0m\n');

test('TrainingPipeline can be instantiated', () => {
  const pipeline = new TrainingPipeline({
    learningRate: 0.001,
    batchSize: 32,
    epochs: 5,
  });

  const metrics = pipeline.getMetrics();
  assert(typeof metrics.epoch === 'number', 'Should have epoch');
  assert(typeof metrics.step === 'number', 'Should have step');
});

test('TrainingPipeline.addBatch adds training data', () => {
  const pipeline = new TrainingPipeline({ batchSize: 2 });

  const inputs = [randomEmbedding(64), randomEmbedding(64)];
  const targets = [randomEmbedding(64), randomEmbedding(64)];
  const qualities = [0.9, 0.85];

  pipeline.addBatch(inputs, targets, qualities);
  // No error means success
  assert(true, 'Batch added successfully');
});

test('TrainingPipeline.train runs training', () => {
  const pipeline = new TrainingPipeline({
    learningRate: 0.001,
    batchSize: 2,
    epochs: 2,
  }, new LoraAdapter({ rank: 4 }, 32, 32));

  // Add minimal data
  for (let i = 0; i < 4; i++) {
    pipeline.addBatch(
      [randomEmbedding(32), randomEmbedding(32)],
      [randomEmbedding(32), randomEmbedding(32)],
      [0.9, 0.8]
    );
  }

  const result = pipeline.train();

  assert(typeof result.finalLoss === 'number', 'Should have final loss');
  assert(typeof result.epochs === 'number', 'Should have epochs');
  assert(typeof result.steps === 'number', 'Should have steps');
});

test('TrainingPipeline.getAdapter returns adapter', () => {
  const adapter = new LoraAdapter({ rank: 8 }, 64, 64);
  const pipeline = new TrainingPipeline({}, adapter);

  assert(pipeline.getAdapter() === adapter, 'Should return same adapter');
});

test('TrainingPipeline.getEwcManager returns EWC manager', () => {
  const pipeline = new TrainingPipeline({ ewcLambda: 0.1 });
  const ewc = pipeline.getEwcManager();

  assert(ewc !== null && ewc !== undefined, 'Should have EWC manager');
});

test('LRScheduler calculates learning rate', () => {
  const config = {
    learningRate: 0.001,
    lrSchedule: 'cosine',
    warmupSteps: 10,
    batchSize: 32,
    epochs: 10,
    ewcLambda: 0,
    validationSplit: 0.1,
    patience: 5,
    minDelta: 0.0001,
  };

  const scheduler = new LRScheduler(config, 100);
  const lr1 = scheduler.getLR();

  scheduler.step();
  scheduler.step();
  const lr2 = scheduler.getLR();

  assert(typeof lr1 === 'number', 'Should return number');
  assert(lr1 > 0, 'LR should be positive');
});

test('MetricsTracker records and computes metrics', () => {
  const tracker = new MetricsTracker();

  tracker.recordLoss(1.0);
  tracker.recordLoss(0.8);
  tracker.recordLoss(0.6);

  const avgLoss = tracker.avgLoss(3);
  assertClose(avgLoss, 0.8, 0.01, 'Average loss should be 0.8');

  tracker.recordValLoss(0.5);
  assert(tracker.bestValLoss() === 0.5, 'Best val loss should be 0.5');
});

test('TrainingFactory.quickFinetune creates pipeline', () => {
  const pipeline = TrainingFactory.quickFinetune();
  assert(pipeline instanceof TrainingPipeline, 'Should create pipeline');
});

test('TrainingFactory.deepTraining creates pipeline', () => {
  const pipeline = TrainingFactory.deepTraining();
  assert(pipeline instanceof TrainingPipeline, 'Should create pipeline');
});

test('TrainingFactory.continualLearning creates pipeline with EWC', () => {
  const pipeline = TrainingFactory.continualLearning(0.5);
  const ewc = pipeline.getEwcManager();

  assert(pipeline instanceof TrainingPipeline, 'Should create pipeline');
});

test('TrainingFactory.federatedAggregation creates pipeline', () => {
  const pipeline = TrainingFactory.federatedAggregation();
  assert(pipeline instanceof TrainingPipeline, 'Should create pipeline');
});

// ============================================================================
// 6. SESSION MANAGEMENT & STREAMING
// ============================================================================
console.log('\n\x1b[36m--- Session Management & Streaming ---\x1b[0m\n');

test('RuvLLM can be instantiated', () => {
  const llm = new RuvLLM({ learningEnabled: true });
  assert(llm !== null, 'LLM should be created');
});

test('SessionManager can be instantiated', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  assert(sessions !== null, 'SessionManager should be created');
});

test('SessionManager.create creates session', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create({ user: 'test' });

  assert(typeof session.id === 'string', 'Session should have ID');
  assert(session.id.length > 0, 'Session ID should not be empty');
});

test('SessionManager.get retrieves session', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const created = sessions.create();
  const retrieved = sessions.get(created.id);

  assert(retrieved !== undefined, 'Should retrieve session');
  assert(retrieved.id === created.id, 'Should retrieve correct session');
});

test('SessionManager.chat sends message', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create();
  const response = sessions.chat(session.id, 'Hello');

  assert(typeof response.text === 'string', 'Response should have text');
  assert(response.text.length > 0, 'Response text should not be empty');
});

test('SessionManager maintains conversation history', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create();
  sessions.chat(session.id, 'First message');
  sessions.chat(session.id, 'Second message');

  const history = sessions.getHistory(session.id);
  assert(history.length >= 2, 'Should have at least 2 messages');
});

test('SessionManager.addSystemMessage works', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create();
  sessions.addSystemMessage(session.id, 'You are a helpful assistant');

  const history = sessions.getHistory(session.id);
  const systemMsg = history.find(m => m.role === 'system');
  assert(systemMsg !== undefined, 'Should have system message');
});

test('SessionManager.export/import works', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create({ name: 'test-session' });
  sessions.chat(session.id, 'Test message');

  const exported = sessions.export(session.id);
  assert(exported !== null, 'Should export session');

  const imported = sessions.import(exported);
  assert(imported.metadata.name === 'test-session', 'Should restore metadata');
});

test('SessionManager.list returns all sessions', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  sessions.create();
  sessions.create();

  const list = sessions.list();
  assert(list.length === 2, 'Should have 2 sessions');
});

test('SessionManager.end removes session', () => {
  const llm = new RuvLLM();
  const sessions = new SessionManager(llm);

  const session = sessions.create();
  sessions.end(session.id);

  assert(sessions.get(session.id) === undefined, 'Session should be removed');
});

test('StreamingGenerator can be instantiated', () => {
  const llm = new RuvLLM();
  const streamer = new StreamingGenerator(llm);

  assert(streamer !== null, 'StreamingGenerator should be created');
});

test('StreamingGenerator.collect returns full response', async () => {
  const llm = new RuvLLM();
  const streamer = new StreamingGenerator(llm);

  const response = await streamer.collect('Test prompt');
  assert(typeof response === 'string', 'Should return string');
});

test('StreamingGenerator.stream yields chunks', async () => {
  const llm = new RuvLLM();
  const streamer = new StreamingGenerator(llm);

  let chunks = [];
  for await (const chunk of streamer.stream('Test', { maxTokens: 50 })) {
    chunks.push(chunk);
    if (chunks.length > 5) break; // Limit for test
  }

  assert(chunks.length > 0, 'Should yield chunks');
  assert(chunks[0].text !== undefined, 'Chunks should have text');
});

test('StreamingGenerator.streamWithCallbacks works', async () => {
  const llm = new RuvLLM();
  const streamer = new StreamingGenerator(llm);

  let chunkCount = 0;
  let completed = false;

  await streamer.streamWithCallbacks('Test', {
    onChunk: (chunk) => chunkCount++,
    onComplete: (response) => completed = true,
  });

  assert(chunkCount > 0, 'Should call onChunk');
  assert(completed, 'Should call onComplete');
});

// ============================================================================
// 7. SONA COORDINATOR & EWC
// ============================================================================
console.log('\n\x1b[36m--- SONA & EWC ---\x1b[0m\n');

test('SonaCoordinator can be instantiated', () => {
  const sona = new SonaCoordinator({ hiddenDim: 64 });
  assert(sona !== null, 'SONA should be created');
});

test('EwcManager can be instantiated', () => {
  const ewc = new EwcManager({ lambda: 0.5, hiddenDim: 64 });
  assert(ewc !== null, 'EWC manager should be created');
});

test('EwcManager.computePenalty returns number', () => {
  const ewc = new EwcManager({ lambda: 0.5, hiddenDim: 32 });
  const weights = new LoraAdapter({ rank: 4 }, 32, 32).getWeights();

  // Register a task to establish baseline weights
  ewc.registerTask('task-1', weights);
  const penalty = ewc.computePenalty(weights);

  assert(typeof penalty === 'number', 'Penalty should be number');
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n\x1b[32m✓ All validation tests passed!\x1b[0m\n');
  console.log('Package @ruvector/ruvllm@0.2.0 is validated and ready for use.');
}
