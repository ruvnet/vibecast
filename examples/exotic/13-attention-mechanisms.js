#!/usr/bin/env node

/**
 * AgentDB Example 13 - Multi-Head, Cross, and Self Attention Mechanisms
 *
 * Demonstrates the full attention stack in AgentDB:
 *   - MemoryController with enableAttention
 *   - SelfAttentionController: intra-memory attention scoring
 *   - CrossAttentionController: multi-namespace context aggregation
 *   - MultiHeadAttentionController: parallel subspace attention heads
 *
 * All attention runs in pure JS (sql.js WASM backend). No native deps needed.
 */

import {
  MemoryController,
  SelfAttentionController,
  CrossAttentionController,
  MultiHeadAttentionController,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock embedder -- deterministic, no model download required
// ---------------------------------------------------------------------------
class MockEmbedder {
  constructor(dim = 384) { this.dim = dim; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    for (let i = 0; i < this.dim; i++) { hash = ((hash << 5) - hash + i) | 0; arr[i] = (hash & 0xFFFF) / 65536 - 0.5; }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIM = 384;
const embedder = new MockEmbedder(DIM);

function banner(title) {
  const line = '='.repeat(70);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

function subBanner(title) {
  console.log(`\n  --- ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}\n`);
}

function table(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length))
  );
  const sep = widths.map(w => '-'.repeat(w + 2)).join('+');
  const fmt = (vals) => vals.map((v, i) => ` ${String(v).padEnd(widths[i])} `).join('|');
  console.log(`  ${fmt(headers)}`);
  console.log(`  ${sep}`);
  rows.forEach(r => console.log(`  ${fmt(r)}`));
}

// ---------------------------------------------------------------------------
// Research assistant memories
// ---------------------------------------------------------------------------
const TOPICS = ['machine learning', 'NLP', 'computer vision', 'reinforcement learning', 'robotics'];
const SUBTOPICS = [
  'gradient descent', 'transformer architectures', 'object detection',
  'policy optimization', 'inverse kinematics',
  'dropout regularization', 'attention mechanisms', 'image segmentation',
  'reward shaping', 'SLAM navigation',
  'batch normalization', 'tokenization', 'feature pyramids',
  'multi-agent RL', 'robot grasping',
  'learning rate schedules', 'BERT fine-tuning', 'data augmentation',
  'model-based RL', 'motion planning',
];

function buildMemories() {
  return SUBTOPICS.map((sub, i) => ({
    topic: TOPICS[i % TOPICS.length],
    subtopic: sub,
    importance: 0.3 + Math.random() * 0.7,
    timestamp: Date.now() - (20 - i) * 86400000,
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
   ___  _   _             _   _
  / _ \\| | | |           | | (_)
 / /_\\ | |_| |_ ___ _ __ | |_ _  ___  _ __
 |  _  | __| __/ _ \\ '_ \\| __| |/ _ \\| '_ \\
 | | | | |_| ||  __/ | | | |_| | (_) | | | |
 \\_| |_/\\__|\\__\\___|_| |_|\\__|_|\\___/|_| |_|

      AgentDB Attention Mechanisms Demo
  `);

  const memories = buildMemories();
  const embeddingsMap = new Map();

  // Pre-compute embeddings
  for (const mem of memories) {
    const text = `${mem.topic}: ${mem.subtopic}`;
    const emb = await embedder.embed(text);
    embeddingsMap.set(text, emb);
  }

  // =========================================================================
  // 1. MemoryController with attention enabled
  // =========================================================================
  banner('1. MemoryController -- Unified Memory with Attention');

  const mc = new MemoryController(null, {
    enableAttention: true,
    numHeads: 4,
    defaultTopK: 5,
    defaultThreshold: 0.0,
    namespace: 'research',
  });

  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const text = `${mem.topic}: ${mem.subtopic}`;
    const emb = Array.from(embeddingsMap.get(text));
    await mc.store({
      id: `mem-${i}`,
      content: text,
      embedding: emb,
      importance: mem.importance,
      timestamp: mem.timestamp,
      metadata: { topic: mem.topic, subtopic: mem.subtopic },
    });
  }

  console.log(`  Stored ${mc.count} memories across ${TOPICS.length} research topics.`);
  const mcStats = mc.getStats();
  console.log(`  Self-attention memories : ${mcStats.selfAttention.memoryCount}`);
  console.log(`  Cross-attention contexts: ${mcStats.crossAttention.contextCount}`);
  console.log(`  Multi-head memories     : ${mcStats.multiHeadAttention.memoryCount}`);

  // Attention-enhanced search
  subBanner('Attention-Enhanced Search vs Plain Similarity');

  const queryText = 'transformer attention for language models';
  const queryEmb = Array.from(await embedder.embed(queryText));

  const plainResults = await mc.search(queryEmb, { topK: 5, useAttention: false });
  const attentionResults = await mc.retrieveWithAttention(queryEmb, { topK: 5 });

  console.log(`  Query: "${queryText}"\n`);

  const compRows = [];
  for (let i = 0; i < 5; i++) {
    const p = plainResults[i];
    const a = attentionResults[i];
    compRows.push([
      i + 1,
      (p?.content || '-').substring(0, 30),
      p ? p.score.toFixed(4) : '-',
      (a?.content || '-').substring(0, 30),
      a ? a.attentionScore.toFixed(4) : '-',
    ]);
  }
  table(compRows, ['#', 'Plain Result', 'Score', 'Attention Result', 'Attn Score']);

  // =========================================================================
  // 2. SelfAttentionController -- Direct Usage
  // =========================================================================
  banner('2. SelfAttentionController -- Intra-Memory Attention');

  const selfAttn = new SelfAttentionController(null, {
    topK: 10,
    minScore: 0.0,
    temperature: 1.0,
    returnWeights: true,
  });

  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const text = `${mem.topic}: ${mem.subtopic}`;
    selfAttn.addMemory({
      id: `self-${i}`,
      embedding: Array.from(embeddingsMap.get(text)),
      content: text,
      metadata: { topic: mem.topic, importance: mem.importance },
    });
  }

  console.log(`  Memory count : ${selfAttn.memoryCount}`);
  console.log(`  Dimension    : ${selfAttn.embeddingDimension}`);

  const selfResult = await selfAttn.computeAttention(queryEmb, { topK: 8, temperature: 0.5 });
  console.log(`  Execution    : ${selfResult.executionTimeMs.toFixed(2)} ms`);
  console.log(`  Attended dim : ${selfResult.attended.length}\n`);

  subBanner('Top Self-Attention Scores');
  const selfRows = selfResult.scores.slice(0, 8).map((s, i) => [
    i + 1, s.id, s.score.toFixed(6), s.rawScore !== undefined ? s.rawScore.toFixed(6) : 'n/a',
  ]);
  table(selfRows, ['#', 'Memory ID', 'Softmax Score', 'Raw Score']);

  // Show inter-memory attention matrix (top 5 x top 5)
  subBanner('Pairwise Attention Matrix (top 5 memories)');
  const top5Ids = selfResult.scores.slice(0, 5).map(s => s.id);
  const matrixRows = [];
  for (const qId of top5Ids) {
    // Use each memory's embedding as a query against all others
    const idx = parseInt(qId.replace('self-', ''));
    const text = `${memories[idx].topic}: ${memories[idx].subtopic}`;
    const qEmb = Array.from(embeddingsMap.get(text));
    const r = await selfAttn.computeAttention(qEmb, { topK: 5 });
    const scoreMap = Object.fromEntries(r.scores.map(s => [s.id, s.score]));
    matrixRows.push([
      qId,
      ...top5Ids.map(tId => (scoreMap[tId] || 0).toFixed(4)),
    ]);
  }
  table(matrixRows, ['Query \\ Key', ...top5Ids]);

  // =========================================================================
  // 3. CrossAttentionController -- Multi-Namespace Context
  // =========================================================================
  banner('3. CrossAttentionController -- Multi-Context Attention');

  const crossAttn = new CrossAttentionController(null, {
    topK: 5,
    minScore: 0.0,
    temperature: 1.0,
    aggregation: 'weighted',
  });

  // Context 1: Research papers
  const paperTopics = [
    'Attention Is All You Need - transformer architecture',
    'BERT pre-training for language understanding',
    'GPT-4 multimodal large language model',
    'ResNet deep residual learning for image recognition',
    'AlphaGo mastering Go with deep RL and tree search',
    'DALL-E text-to-image generation with diffusion',
    'Proximal Policy Optimization for RL stability',
  ];
  for (let i = 0; i < paperTopics.length; i++) {
    crossAttn.addToContext('research_papers', {
      id: `paper-${i}`,
      embedding: Array.from(await embedder.embed(paperTopics[i])),
      content: paperTopics[i],
      metadata: { type: 'paper', year: 2017 + i },
    });
  }

  // Context 2: Code snippets
  const codeTopics = [
    'implement multi-head attention in PyTorch',
    'fine-tune BERT for sentiment classification',
    'train PPO agent with gymnasium environment',
    'build convolutional neural network for CIFAR-10',
    'deploy transformer model with ONNX runtime',
  ];
  for (let i = 0; i < codeTopics.length; i++) {
    crossAttn.addToContext('code_snippets', {
      id: `code-${i}`,
      embedding: Array.from(await embedder.embed(codeTopics[i])),
      content: codeTopics[i],
      metadata: { type: 'code', language: 'python' },
    });
  }

  // Context 3: Documentation
  const docTopics = [
    'PyTorch nn.MultiheadAttention API reference',
    'Hugging Face Transformers library quickstart guide',
    'OpenAI API embeddings endpoint documentation',
    'TensorFlow model optimization toolkit',
    'MLflow experiment tracking and model registry',
  ];
  for (let i = 0; i < docTopics.length; i++) {
    crossAttn.addToContext('documentation', {
      id: `doc-${i}`,
      embedding: Array.from(await embedder.embed(docTopics[i])),
      content: docTopics[i],
      metadata: { type: 'documentation', source: 'web' },
    });
  }

  const crossStats = crossAttn.getStats();
  console.log(`  Contexts      : ${crossStats.contextCount} (${crossAttn.listContexts().join(', ')})`);
  console.log(`  Total entries : ${crossStats.totalEntries}`);
  console.log(`  Dimension     : ${crossStats.dimension}`);
  console.log(`  Entries/ctx   : ${JSON.stringify(crossStats.contextsInfo)}`);

  // Cross-attention per context
  subBanner('Per-Context Cross-Attention');
  for (const ctx of crossAttn.listContexts()) {
    const result = await crossAttn.computeCrossAttention(queryEmb, ctx, { topK: 3 });
    console.log(`  [${ctx}]  (${result.executionTimeMs.toFixed(2)} ms)`);
    result.scores.slice(0, 3).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.id.padEnd(10)} score=${s.score.toFixed(5)}  raw=${(s.rawScore ?? 0).toFixed(5)}`);
    });
  }

  // Multi-context aggregated attention
  subBanner('Multi-Context Aggregated Attention');
  for (const agg of ['average', 'max', 'weighted']) {
    const result = await crossAttn.computeMultiContextAttention(queryEmb, [], { aggregation: agg, topK: 3 });
    console.log(`  Aggregation: ${agg.padEnd(8)} | time: ${result.executionTimeMs.toFixed(2)} ms`);
    if (result.contextWeights) {
      const cwStr = Object.entries(result.contextWeights)
        .map(([k, v]) => `${k}=${v.toFixed(3)}`)
        .join(', ');
      console.log(`    Context weights: ${cwStr}`);
    }
    result.scores.slice(0, 3).forEach((s, i) => {
      console.log(`    ${i + 1}. [${s.context}] ${s.id.padEnd(10)} score=${s.score.toFixed(5)}`);
    });
  }

  // =========================================================================
  // 4. MultiHeadAttentionController -- Parallel Heads
  // =========================================================================
  banner('4. MultiHeadAttentionController -- Parallel Subspace Attention');

  const NUM_HEADS = 4;
  const multiHead = new MultiHeadAttentionController(null, {
    numHeads: NUM_HEADS,
    topK: 5,
    minScore: 0.0,
    temperature: 1.0,
    aggregation: 'average',
  });

  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const text = `${mem.topic}: ${mem.subtopic}`;
    multiHead.addMemory({
      id: `mh-${i}`,
      embedding: Array.from(embeddingsMap.get(text)),
      content: text,
      metadata: { topic: mem.topic },
    });
  }

  const mhStats = multiHead.getStats();
  console.log(`  Memory count : ${mhStats.memoryCount}`);
  console.log(`  Dimension    : ${mhStats.dimension}`);
  console.log(`  Num heads    : ${mhStats.numHeads}`);
  console.log(`  Head dim     : ${mhStats.headDim}`);

  // Compute multi-head attention
  subBanner('Per-Head Attention Outputs');

  const mhResult = await multiHead.computeMultiHeadAttention(queryEmb, { topK: 5 });
  console.log(`  Execution: ${mhResult.executionTimeMs.toFixed(2)} ms`);
  console.log(`  Heads returned: ${mhResult.heads.length}`);
  console.log(`  Aggregated attended dim: ${mhResult.attended.length}\n`);

  for (const head of mhResult.heads) {
    console.log(`  Head ${head.headIndex} (attended dim: ${head.attended.length}):`);
    head.topScores.slice(0, 3).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.id.padEnd(8)} score=${s.score.toFixed(5)}`);
    });
  }

  // Compare aggregation strategies
  subBanner('Aggregation Strategy Comparison');
  for (const agg of ['average', 'max', 'concat', 'weighted']) {
    const r = await multiHead.computeMultiHeadAttention(queryEmb, { aggregation: agg, topK: 3 });
    const topIds = (r.aggregatedScores || []).slice(0, 3).map(s => `${s.id}(${s.score.toFixed(3)})`).join(', ');
    console.log(`  ${agg.padEnd(10)} | time: ${r.executionTimeMs.toFixed(2)} ms | attended dim: ${r.attended.length} | top: ${topIds || 'n/a'}`);
  }

  // =========================================================================
  // 5. Comprehensive Comparison
  // =========================================================================
  banner('5. Comprehensive Comparison -- All Attention Mechanisms');

  const queries = [
    'deep learning optimization techniques',
    'natural language understanding with transformers',
    'robot manipulation with reinforcement learning',
    'image classification and object detection',
    'multi-agent cooperative strategies',
  ];

  const comparisonRows = [];
  for (const q of queries) {
    const qe = Array.from(await embedder.embed(q));

    // Plain similarity
    const plain = await mc.search(qe, { topK: 1, useAttention: false });
    // Attention-enhanced
    const attnRes = await mc.retrieveWithAttention(qe, { topK: 1 });
    // Self-attention
    const selfRes = await selfAttn.computeAttention(qe, { topK: 1 });
    // Cross-attention (multi-context)
    const crossRes = await crossAttn.computeMultiContextAttention(qe, [], { topK: 1 });
    // Multi-head
    const mhRes = await multiHead.computeMultiHeadAttention(qe, { topK: 1 });

    comparisonRows.push([
      q.substring(0, 30),
      plain[0] ? plain[0].score.toFixed(4) : '-',
      attnRes[0] ? attnRes[0].attentionScore.toFixed(4) : '-',
      selfRes.scores[0] ? selfRes.scores[0].score.toFixed(4) : '-',
      crossRes.scores[0] ? crossRes.scores[0].score.toFixed(4) : '-',
      mhRes.heads[0]?.topScores[0] ? mhRes.heads[0].topScores[0].score.toFixed(4) : '-',
    ]);
  }

  table(comparisonRows, ['Query', 'Plain', 'MemCtrl+Attn', 'SelfAttn', 'CrossAttn', 'MultiHead']);

  // =========================================================================
  // 6. Final Statistics
  // =========================================================================
  banner('6. Final Statistics');

  const finalMC = mc.getStats();
  console.log('  MemoryController:');
  console.log(`    Total memories         : ${finalMC.memoryCount}`);
  console.log(`    Self-attn memories     : ${finalMC.selfAttention.memoryCount}`);
  console.log(`    Cross-attn contexts    : ${finalMC.crossAttention.contextCount}`);
  console.log(`    Cross-attn entries     : ${finalMC.crossAttention.totalEntries}`);
  console.log(`    Multi-head memories    : ${finalMC.multiHeadAttention.memoryCount}`);
  console.log(`    Multi-head num heads   : ${finalMC.multiHeadAttention.numHeads}`);
  console.log(`    Has vector backend     : ${finalMC.selfAttention.hasVectorBackend}`);

  console.log('\n  Standalone Controllers:');
  const sStats = selfAttn.getStats();
  console.log(`    SelfAttention   : ${sStats.memoryCount} memories, dim=${sStats.dimension}`);
  const cStats = crossAttn.getStats();
  console.log(`    CrossAttention  : ${cStats.totalEntries} entries across ${cStats.contextCount} contexts`);
  const mStats = multiHead.getStats();
  console.log(`    MultiHead       : ${mStats.memoryCount} memories, ${mStats.numHeads} heads x ${mStats.headDim} dim`);

  console.log('\n  Done. All attention mechanisms demonstrated successfully.\n');
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
