/**
 * Federated SONA Trainer
 *
 * Train and share specialized LoRA adapters across ephemeral agents.
 * Supports ONNX quantized models for maximum efficiency.
 */

const { SonaEngine } = require('@ruvector/sona');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// Tiny SOTA Model Configurations
// ============================================

const TINY_MODELS = {
  // Liquid Foundation Model 2 - Extremely efficient
  'lfm2-350m': {
    name: 'LFM2-350M',
    hiddenDim: 1024,
    numLayers: 24,
    numHeads: 16,
    headDim: 64,
    params: '350M',
    contextLength: 32768,
    strengths: ['long-context', 'efficiency'],
  },

  'lfm2-1b': {
    name: 'LFM2-1B',
    hiddenDim: 2048,
    numLayers: 24,
    numHeads: 16,
    headDim: 128,
    params: '1B',
    contextLength: 32768,
    strengths: ['long-context', 'reasoning'],
  },

  // SmolLM2 - Hugging Face's tiny models
  'smollm2-135m': {
    name: 'SmolLM2-135M',
    hiddenDim: 576,
    numLayers: 30,
    numHeads: 9,
    headDim: 64,
    params: '135M',
    contextLength: 8192,
    strengths: ['ultra-small', 'mobile'],
  },

  'smollm2-360m': {
    name: 'SmolLM2-360M',
    hiddenDim: 960,
    numLayers: 32,
    numHeads: 15,
    headDim: 64,
    params: '360M',
    contextLength: 8192,
    strengths: ['small', 'versatile'],
  },

  'smollm2-1.7b': {
    name: 'SmolLM2-1.7B',
    hiddenDim: 2048,
    numLayers: 24,
    numHeads: 32,
    headDim: 64,
    params: '1.7B',
    contextLength: 8192,
    strengths: ['balanced', 'quality'],
  },

  // Qwen2.5 - Alibaba's efficient models
  'qwen2.5-0.5b': {
    name: 'Qwen2.5-0.5B',
    hiddenDim: 896,
    numLayers: 24,
    numHeads: 14,
    headDim: 64,
    params: '0.5B',
    contextLength: 32768,
    strengths: ['multilingual', 'code'],
  },

  'qwen2.5-1.5b': {
    name: 'Qwen2.5-1.5B',
    hiddenDim: 1536,
    numLayers: 28,
    numHeads: 12,
    headDim: 128,
    params: '1.5B',
    contextLength: 32768,
    strengths: ['multilingual', 'reasoning'],
  },

  // Phi-3.5 Mini - Microsoft's tiny powerhouse
  'phi-3.5-mini': {
    name: 'Phi-3.5-Mini',
    hiddenDim: 3072,
    numLayers: 32,
    numHeads: 32,
    headDim: 96,
    params: '3.8B',
    contextLength: 128000,
    strengths: ['long-context', 'reasoning', 'code'],
  },

  // Gemma 2 - Google's efficient models
  'gemma2-2b': {
    name: 'Gemma2-2B',
    hiddenDim: 2304,
    numLayers: 26,
    numHeads: 8,
    headDim: 256,
    params: '2B',
    contextLength: 8192,
    strengths: ['general', 'instruction-following'],
  },

  // TinyLlama - Community favorite
  'tinyllama-1.1b': {
    name: 'TinyLlama-1.1B',
    hiddenDim: 2048,
    numLayers: 22,
    numHeads: 32,
    headDim: 64,
    params: '1.1B',
    contextLength: 2048,
    strengths: ['fast', 'general'],
  },

  // MobileLLM - Meta's mobile-optimized
  'mobilellm-125m': {
    name: 'MobileLLM-125M',
    hiddenDim: 512,
    numLayers: 30,
    numHeads: 8,
    headDim: 64,
    params: '125M',
    contextLength: 2048,
    strengths: ['mobile', 'edge', 'ultra-fast'],
  },

  'mobilellm-350m': {
    name: 'MobileLLM-350M',
    hiddenDim: 768,
    numLayers: 32,
    numHeads: 12,
    headDim: 64,
    params: '350M',
    contextLength: 2048,
    strengths: ['mobile', 'edge'],
  },
};

// ============================================
// Quantization Configurations
// ============================================

const QUANTIZATION_CONFIGS = {
  'fp16': {
    name: 'FP16',
    bitsPerWeight: 16,
    memoryReduction: 0.5,
    qualityLoss: 0,
    onnxType: 'float16',
  },
  'int8': {
    name: 'INT8',
    bitsPerWeight: 8,
    memoryReduction: 0.25,
    qualityLoss: 0.01,
    onnxType: 'int8',
  },
  'int4': {
    name: 'INT4',
    bitsPerWeight: 4,
    memoryReduction: 0.125,
    qualityLoss: 0.03,
    onnxType: 'int4',
  },
  'int4-gptq': {
    name: 'INT4-GPTQ',
    bitsPerWeight: 4,
    memoryReduction: 0.125,
    qualityLoss: 0.02,
    onnxType: 'int4',
    method: 'gptq',
  },
  'int4-awq': {
    name: 'INT4-AWQ',
    bitsPerWeight: 4,
    memoryReduction: 0.125,
    qualityLoss: 0.015,
    onnxType: 'int4',
    method: 'awq',
  },
};

// ============================================
// Federated Training Coordinator
// ============================================

class FederatedCoordinator {
  constructor(modelKey, options = {}) {
    const modelConfig = TINY_MODELS[modelKey];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(TINY_MODELS).join(', ')}`);
    }

    this.modelKey = modelKey;
    this.modelConfig = modelConfig;
    this.options = {
      quantization: 'fp16',
      microLoraRank: 2,
      baseLoraRank: 8,
      learningRate: 0.002,
      trajectoryCapacity: 50000,
      patternClusters: 200,
      ewcLambda: 2000,
      exportDir: './exports',
      checkpointInterval: 1000,
      ...options,
    };

    this.engine = SonaEngine.withConfig({
      hiddenDim: modelConfig.hiddenDim,
      microLoraRank: this.options.microLoraRank,
      baseLoraRank: this.options.baseLoraRank,
      microLoraLr: this.options.learningRate,
      trajectoryCapacity: this.options.trajectoryCapacity,
      patternClusters: this.options.patternClusters,
      ewcLambda: this.options.ewcLambda,
      enableSimd: true,
    });

    this.agentRegistry = new Map();
    this.trainingHistory = [];
    this.checkpoints = [];
    this.totalTrajectories = 0;
    this.startTime = Date.now();
  }

  // Register a new agent
  registerAgent(agentId, metadata = {}) {
    this.agentRegistry.set(agentId, {
      id: agentId,
      registeredAt: Date.now(),
      trajectoryCount: 0,
      avgQuality: 0,
      lastSeen: Date.now(),
      ...metadata,
    });
    return agentId;
  }

  // Ingest trajectories from an agent
  ingestTrajectories(agentId, trajectories) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    let qualitySum = 0;
    let ingested = 0;

    for (const traj of trajectories) {
      // Quality filter - only ingest good trajectories
      if (traj.quality >= 0.3) {
        const embedding = this._normalizeEmbedding(traj.embedding);
        const tid = this.engine.beginTrajectory(embedding);
        this.engine.endTrajectory(tid, traj.quality);
        qualitySum += traj.quality;
        ingested++;
        this.totalTrajectories++;
      }
    }

    // Update agent stats
    agent.trajectoryCount += ingested;
    agent.avgQuality = (agent.avgQuality * (agent.trajectoryCount - ingested) + qualitySum) / agent.trajectoryCount;
    agent.lastSeen = Date.now();

    // Auto-checkpoint
    if (this.totalTrajectories % this.options.checkpointInterval === 0) {
      this._autoCheckpoint();
    }

    return { ingested, filtered: trajectories.length - ingested };
  }

  // Force learning consolidation
  consolidate() {
    this.engine.forceLearn();
    this.trainingHistory.push({
      timestamp: Date.now(),
      totalTrajectories: this.totalTrajectories,
      agentCount: this.agentRegistry.size,
    });
  }

  // Get current training stats
  getStats() {
    const engineStats = this.engine.getStats();
    return {
      model: this.modelConfig.name,
      params: this.modelConfig.params,
      quantization: this.options.quantization,
      totalTrajectories: this.totalTrajectories,
      activeAgents: this.agentRegistry.size,
      uptime: Date.now() - this.startTime,
      checkpoints: this.checkpoints.length,
      engineStats,
    };
  }

  // Export trained adapter
  async exportAdapter(format = 'safetensors') {
    const exportPath = path.join(this.options.exportDir, this.modelKey);
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sona-adapter-${this.modelKey}-${timestamp}`;

    const adapterMeta = {
      model: this.modelKey,
      modelConfig: this.modelConfig,
      sonaConfig: {
        microLoraRank: this.options.microLoraRank,
        baseLoraRank: this.options.baseLoraRank,
        learningRate: this.options.learningRate,
      },
      training: {
        totalTrajectories: this.totalTrajectories,
        agentCount: this.agentRegistry.size,
        duration: Date.now() - this.startTime,
      },
      quantization: QUANTIZATION_CONFIGS[this.options.quantization],
      exportedAt: new Date().toISOString(),
    };

    // Write metadata
    fs.writeFileSync(
      path.join(exportPath, `${filename}.json`),
      JSON.stringify(adapterMeta, null, 2)
    );

    // Write adapter config (PEFT-compatible)
    const peftConfig = {
      base_model_name_or_path: this._getHuggingFacePath(),
      bias: 'none',
      fan_in_fan_out: false,
      inference_mode: true,
      lora_alpha: this.options.baseLoraRank * 2,
      lora_dropout: 0.0,
      r: this.options.baseLoraRank,
      target_modules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
      task_type: 'CAUSAL_LM',
    };

    fs.writeFileSync(
      path.join(exportPath, 'adapter_config.json'),
      JSON.stringify(peftConfig, null, 2)
    );

    return {
      path: exportPath,
      files: [`${filename}.json`, 'adapter_config.json'],
      meta: adapterMeta,
    };
  }

  // Internal methods
  _normalizeEmbedding(embedding) {
    const targetDim = this.modelConfig.hiddenDim;
    if (Array.isArray(embedding)) {
      if (embedding.length === targetDim) return embedding;
      // Pad or truncate
      if (embedding.length < targetDim) {
        return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
      }
      return embedding.slice(0, targetDim);
    }
    // Generate random if not provided
    return Array.from({ length: targetDim }, () => (Math.random() - 0.5) * 0.1);
  }

  _getHuggingFacePath() {
    const mapping = {
      'lfm2-350m': 'liquid/lfm2-350m',
      'lfm2-1b': 'liquid/lfm2-1b',
      'smollm2-135m': 'HuggingFaceTB/SmolLM2-135M',
      'smollm2-360m': 'HuggingFaceTB/SmolLM2-360M',
      'smollm2-1.7b': 'HuggingFaceTB/SmolLM2-1.7B',
      'qwen2.5-0.5b': 'Qwen/Qwen2.5-0.5B',
      'qwen2.5-1.5b': 'Qwen/Qwen2.5-1.5B',
      'phi-3.5-mini': 'microsoft/Phi-3.5-mini-instruct',
      'gemma2-2b': 'google/gemma-2-2b',
      'tinyllama-1.1b': 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
      'mobilellm-125m': 'facebook/MobileLLM-125M',
      'mobilellm-350m': 'facebook/MobileLLM-350M',
    };
    return mapping[this.modelKey] || this.modelKey;
  }

  _autoCheckpoint() {
    this.consolidate();
    this.checkpoints.push({
      timestamp: Date.now(),
      trajectories: this.totalTrajectories,
    });
  }
}

// ============================================
// Ephemeral Agent (Worker)
// ============================================

class EphemeralAgent {
  constructor(coordinatorRef, agentId = null) {
    this.coordinator = coordinatorRef;
    this.agentId = agentId || `agent-${crypto.randomBytes(4).toString('hex')}`;
    this.modelConfig = coordinatorRef.modelConfig;

    // Lightweight local engine
    this.engine = SonaEngine.withConfig({
      hiddenDim: this.modelConfig.hiddenDim,
      microLoraRank: 2,
      baseLoraRank: 4,  // Smaller for ephemeral agents
      trajectoryCapacity: 500,
      patternClusters: 25,
    });

    this.localTrajectories = [];
    this.coordinator.registerAgent(this.agentId, {
      model: this.modelConfig.name,
    });
  }

  // Process a single input and record trajectory
  async process(input, qualityFn) {
    const embedding = this._embed(input);
    const tid = this.engine.beginTrajectory(embedding);

    // Apply micro-LoRA
    const enhanced = this.engine.applyMicroLora(embedding);

    // Get quality score (from external evaluator)
    const quality = typeof qualityFn === 'function'
      ? await qualityFn(enhanced)
      : qualityFn;

    this.engine.endTrajectory(tid, quality);

    // Store for batch upload
    this.localTrajectories.push({
      embedding,
      quality,
      timestamp: Date.now(),
    });

    return { enhanced, quality };
  }

  // Upload trajectories to coordinator
  async sync() {
    if (this.localTrajectories.length === 0) return { synced: 0 };

    const result = this.coordinator.ingestTrajectories(
      this.agentId,
      this.localTrajectories
    );

    this.localTrajectories = [];
    return result;
  }

  // Shutdown and final sync
  async shutdown() {
    await this.sync();
    this.engine.forceLearn();
    return { agentId: this.agentId, status: 'shutdown' };
  }

  _embed(input) {
    // Simple hash-based embedding for demo
    // In production, use actual model embeddings
    const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest();
    const embedding = [];
    for (let i = 0; i < this.modelConfig.hiddenDim; i++) {
      embedding.push((hash[i % hash.length] / 255 - 0.5) * 0.1);
    }
    return embedding;
  }
}

// ============================================
// Training Pipeline
// ============================================

class TrainingPipeline {
  constructor(modelKey, options = {}) {
    this.coordinator = new FederatedCoordinator(modelKey, options);
    this.agents = new Map();
    this.isRunning = false;
  }

  // Spawn multiple agents
  spawnAgents(count) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const agent = new EphemeralAgent(this.coordinator);
      this.agents.set(agent.agentId, agent);
      spawned.push(agent.agentId);
    }
    return spawned;
  }

  // Train with a dataset
  async train(dataset, options = {}) {
    const {
      batchSize = 32,
      epochs = 1,
      agentCount = 5,
      onProgress = null,
    } = options;

    this.isRunning = true;
    const agentIds = this.spawnAgents(agentCount);
    const agents = agentIds.map(id => this.agents.get(id));

    let processed = 0;
    const total = dataset.length * epochs;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < dataset.length; i += batchSize) {
        const batch = dataset.slice(i, i + batchSize);

        // Distribute batch across agents
        await Promise.all(batch.map(async (item, idx) => {
          const agent = agents[idx % agents.length];
          await agent.process(item.input, item.quality || 0.5);
        }));

        processed += batch.length;

        // Periodic sync
        if (processed % (batchSize * 10) === 0) {
          await Promise.all(agents.map(a => a.sync()));
          this.coordinator.consolidate();
        }

        if (onProgress) {
          onProgress({
            processed,
            total,
            percent: (processed / total) * 100,
            epoch: epoch + 1,
          });
        }
      }
    }

    // Final sync
    await Promise.all(agents.map(a => a.shutdown()));
    this.coordinator.consolidate();
    this.isRunning = false;

    return this.coordinator.getStats();
  }

  // Export the trained model
  async export(format = 'safetensors') {
    return this.coordinator.exportAdapter(format);
  }

  // Get training stats
  getStats() {
    return this.coordinator.getStats();
  }
}

// ============================================
// ONNX Export Helper
// ============================================

class ONNXExporter {
  static getConfig(modelKey, quantization = 'int8') {
    const model = TINY_MODELS[modelKey];
    const quant = QUANTIZATION_CONFIGS[quantization];

    if (!model || !quant) {
      throw new Error('Invalid model or quantization config');
    }

    // Calculate memory footprint
    const paramsNum = parseFloat(model.params.replace(/[BM]/g, '')) *
      (model.params.includes('B') ? 1e9 : 1e6);
    const memoryBytes = paramsNum * (quant.bitsPerWeight / 8);
    const memoryMB = memoryBytes / (1024 * 1024);

    return {
      model: model.name,
      params: model.params,
      quantization: quant.name,
      onnxType: quant.onnxType,
      estimatedMemoryMB: Math.round(memoryMB),
      qualityRetention: `${((1 - quant.qualityLoss) * 100).toFixed(1)}%`,
      exportCommand: `python -m optimum.exporters.onnx --model ${modelKey} --task text-generation-with-past --opset 17 ./${modelKey}-onnx`,
      quantizeCommand: quant.method
        ? `python -m auto_gptq --model ${modelKey} --method ${quant.method} --bits 4`
        : `python -m onnxruntime.quantization --model ./${modelKey}.onnx --output ./${modelKey}-${quantization}.onnx --quant_format ${quant.onnxType}`,
    };
  }

  static listModels() {
    return Object.entries(TINY_MODELS).map(([key, config]) => ({
      key,
      name: config.name,
      params: config.params,
      hiddenDim: config.hiddenDim,
      contextLength: config.contextLength,
      strengths: config.strengths,
    }));
  }

  static getMemoryEstimates(modelKey) {
    const model = TINY_MODELS[modelKey];
    if (!model) return null;

    const paramsNum = parseFloat(model.params.replace(/[BM]/g, '')) *
      (model.params.includes('B') ? 1e9 : 1e6);

    return Object.entries(QUANTIZATION_CONFIGS).map(([key, quant]) => {
      const memoryBytes = paramsNum * (quant.bitsPerWeight / 8);
      return {
        quantization: key,
        name: quant.name,
        memoryMB: Math.round(memoryBytes / (1024 * 1024)),
        qualityRetention: `${((1 - quant.qualityLoss) * 100).toFixed(1)}%`,
      };
    });
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  FederatedCoordinator,
  EphemeralAgent,
  TrainingPipeline,
  ONNXExporter,
  TINY_MODELS,
  QUANTIZATION_CONFIGS,
};
