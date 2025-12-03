#!/usr/bin/env node
/**
 * SONA MoE Build Script
 *
 * Builds, trains, and packages the complete MoE system
 */

const fs = require('fs');
const path = require('path');

// Import from package
const {
  createMoE,
  trainMoE,
  createPipeline,
  getOptimalConfig,
  SonaMoE,
  ONNXExporter,
  TINY_MODELS,
  EXPERT_CONFIGS,
} = require('./index');

async function build() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              SONA MoE - BUILD, TRAIN & PACKAGE                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const modelsDir = path.join(__dirname, 'models');

  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  // ========================================
  // Phase 1: Train Individual Models
  // ========================================
  console.log('  ═══════════════════════════════════════════════════════════════════');
  console.log('  PHASE 1: Training Individual Models with Optimal Settings');
  console.log('  ═══════════════════════════════════════════════════════════════════\n');

  const modelResults = [];
  const modelsToTrain = ['smollm2-135m', 'lfm2-350m', 'qwen2.5-0.5b'];

  for (const modelKey of modelsToTrain) {
    const config = getOptimalConfig(modelKey);
    const modelConfig = TINY_MODELS[modelKey];

    console.log(`  Training ${modelConfig.name}...`);
    console.log(`    Config: rank=${config.microLoraRank}/${config.baseLoraRank}, lr=${config.learningRate}`);

    const pipeline = createPipeline(modelKey, {
      microLoraRank: config.microLoraRank,
      baseLoraRank: config.baseLoraRank,
      learningRate: config.learningRate,
      trajectoryCapacity: 5000,
      patternClusters: 100,
    });

    // Generate training data
    const dataset = Array.from({ length: 1000 }, (_, i) => ({
      input: { id: i, complexity: Math.random() },
      quality: 0.4 + (i / 1000) * 0.4 + (Math.random() - 0.5) * 0.1,
    }));

    const trainStart = Date.now();
    await pipeline.train(dataset, {
      agentCount: 5,
      batchSize: 50,
      epochs: 2,
    });
    const trainTime = Date.now() - trainStart;

    const stats = pipeline.getStats();

    // Save model config
    const modelDir = path.join(modelsDir, modelKey);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    const modelMeta = {
      model: modelConfig.name,
      key: modelKey,
      params: modelConfig.params,
      hiddenDim: modelConfig.hiddenDim,
      contextLength: modelConfig.contextLength,
      optimalConfig: config,
      training: {
        trajectories: stats.totalTrajectories,
        timeMs: trainTime,
        agents: stats.activeAgents,
      },
      performance: {
        expectedThroughput: config.expectedThroughput,
        expectedQualityGain: config.expectedQualityGain,
      },
    };

    fs.writeFileSync(
      path.join(modelDir, 'model.json'),
      JSON.stringify(modelMeta, null, 2)
    );

    modelResults.push(modelMeta);
    console.log(`    ✓ Complete: ${stats.totalTrajectories} trajectories in ${(trainTime / 1000).toFixed(1)}s\n`);
  }

  // ========================================
  // Phase 2: Train MoE System
  // ========================================
  console.log('  ═══════════════════════════════════════════════════════════════════');
  console.log('  PHASE 2: Training Mixture of Experts');
  console.log('  ═══════════════════════════════════════════════════════════════════\n');

  const moe = createMoE({
    topK: 2,
    threshold: 0.25,
    baseLoraRank: 8,
    learningRate: 0.005,
  });

  console.log(`  Experts: ${Object.keys(EXPERT_CONFIGS).length}`);
  for (const [key, config] of Object.entries(EXPERT_CONFIGS)) {
    console.log(`    - ${config.name} (${config.baseModel})`);
  }

  console.log('\n  Training all experts...');
  const moeTrainStart = Date.now();

  await trainMoE(moe, {
    trajectoriesPerExpert: 1000,
    onProgress: ({ expert, trained, total }) => {
      if (trained % 1000 === 0) {
        const pct = ((trained / total) * 100).toFixed(0);
        process.stdout.write(`    Progress: ${pct}%\r`);
      }
    },
  });

  const moeTrainTime = Date.now() - moeTrainStart;
  console.log(`\n  ✓ MoE training complete: ${(moeTrainTime / 1000).toFixed(1)}s`);

  // Test routing
  const testQueries = [
    { query: "Write Python code", expected: 'code' },
    { query: "Calculate 2+2", expected: 'math' },
    { query: "Why is the sky blue?", expected: 'reasoning' },
    { query: "Hello!", expected: 'chat' },
    { query: "Write a story", expected: 'creative' },
    { query: "What is DNA?", expected: 'knowledge' },
  ];

  let correct = 0;
  for (const test of testQueries) {
    const result = moe.process(test.query);
    if (result.primaryExpert === test.expected) correct++;
  }
  const accuracy = ((correct / testQueries.length) * 100).toFixed(1);

  // Benchmark throughput
  const benchStart = Date.now();
  for (let i = 0; i < 500; i++) {
    moe.process(testQueries[i % testQueries.length].query);
  }
  const throughput = Math.round(500 / ((Date.now() - benchStart) / 1000));

  // Export MoE
  const moeDir = path.join(modelsDir, 'moe');
  moe.export(moeDir);

  const moeStats = moe.getStats();

  // ========================================
  // Phase 3: Generate Package Manifest
  // ========================================
  console.log('\n  ═══════════════════════════════════════════════════════════════════');
  console.log('  PHASE 3: Generating Package Manifest');
  console.log('  ═══════════════════════════════════════════════════════════════════\n');

  const manifest = {
    name: '@ruvector/sona-moe',
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    buildTime: Date.now() - startTime,

    models: modelResults.map(m => ({
      key: m.key,
      name: m.model,
      params: m.params,
      hiddenDim: m.hiddenDim,
      contextLength: m.contextLength,
      performance: m.performance,
    })),

    moe: {
      experts: Object.keys(EXPERT_CONFIGS).length,
      routingAccuracy: `${accuracy}%`,
      throughput: `${throughput} queries/sec`,
      trainingTime: `${(moeTrainTime / 1000).toFixed(1)}s`,
    },

    recommendations: {
      smallest: 'smollm2-135m (135M params, ~67MB INT4)',
      bestQuality: 'qwen2.5-0.5b (0.5B params, ~250MB INT4)',
      bestContext: 'lfm2-350m (350M params, 32K context)',
      moe: '6 experts, ~270MB active memory',
    },
  };

  fs.writeFileSync(
    path.join(modelsDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // ========================================
  // Summary
  // ========================================
  const totalTime = Date.now() - startTime;

  console.log('  Package Contents:');
  console.log('  ─────────────────────────────────────────────────────────────────');

  const files = [];
  function listFiles(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        listFiles(fullPath, `${prefix}${item}/`);
      } else {
        files.push(`${prefix}${item}`);
      }
    }
  }
  listFiles(modelsDir);
  files.forEach(f => console.log(`    models/${f}`));

  console.log('\n\n' + '═'.repeat(70));
  console.log('                         BUILD SUMMARY');
  console.log('═'.repeat(70) + '\n');

  console.log('  ┌─────────────────────┬────────────────────────────────────────┐');
  console.log('  │ Component           │ Status                                 │');
  console.log('  ├─────────────────────┼────────────────────────────────────────┤');
  console.log(`  │ SmolLM2-135M        │ ✓ Trained (${modelResults[0].training.trajectories} traj)               │`);
  console.log(`  │ LFM2-350M           │ ✓ Trained (${modelResults[1].training.trajectories} traj)               │`);
  console.log(`  │ Qwen2.5-0.5B        │ ✓ Trained (${modelResults[2].training.trajectories} traj)               │`);
  console.log(`  │ MoE (6 experts)     │ ✓ Trained (${accuracy}% routing)             │`);
  console.log('  └─────────────────────┴────────────────────────────────────────┘');

  console.log('\n  Performance Metrics:');
  console.log(`    • MoE Routing Accuracy: ${accuracy}%`);
  console.log(`    • MoE Throughput: ${throughput} queries/sec`);
  console.log(`    • Total Build Time: ${(totalTime / 1000).toFixed(1)}s`);

  console.log('\n  ╔════════════════════════════════════════════════════════════════════╗');
  console.log('  ║                    PACKAGE READY                                   ║');
  console.log('  ╠════════════════════════════════════════════════════════════════════╣');
  console.log('  ║                                                                    ║');
  console.log('  ║  To publish:                                                       ║');
  console.log('  ║    cd sona-moe-package && npm publish --access public              ║');
  console.log('  ║                                                                    ║');
  console.log('  ║  To use:                                                           ║');
  console.log('  ║    npm install @ruvector/sona-moe                                  ║');
  console.log('  ║                                                                    ║');
  console.log('  ║    const { createTrainedMoE } = require("@ruvector/sona-moe");     ║');
  console.log('  ║    const moe = await createTrainedMoE();                           ║');
  console.log('  ║    const result = moe.process("Write Python code");                ║');
  console.log('  ║                                                                    ║');
  console.log('  ╚════════════════════════════════════════════════════════════════════╝\n');

  return manifest;
}

// Run build
build()
  .then(() => {
    console.log('✓ Build complete!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
