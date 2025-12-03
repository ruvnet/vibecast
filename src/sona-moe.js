/**
 * SONA Mixture of Experts (MoE)
 *
 * Combines multiple specialized tiny models into a unified system.
 * Each expert is trained on a specific domain using SONA federated learning.
 */

const { SonaEngine } = require('@ruvector/sona');
const {
  FederatedCoordinator,
  EphemeralAgent,
  TrainingPipeline,
  TINY_MODELS,
} = require('./federated-trainer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// Expert Definitions
// ============================================

const EXPERT_CONFIGS = {
  'code': {
    name: 'Code Expert',
    description: 'Specialized in code generation, debugging, and explanation',
    baseModel: 'qwen2.5-0.5b',
    domains: ['python', 'javascript', 'rust', 'sql', 'debugging', 'refactoring'],
    keywords: ['function', 'class', 'code', 'bug', 'error', 'implement', 'write', 'script', 'api'],
  },
  'math': {
    name: 'Math Expert',
    description: 'Specialized in mathematical reasoning and calculations',
    baseModel: 'smollm2-135m',
    domains: ['arithmetic', 'algebra', 'calculus', 'statistics', 'logic'],
    keywords: ['calculate', 'solve', 'equation', 'number', 'math', 'formula', 'proof', 'sum'],
  },
  'reasoning': {
    name: 'Reasoning Expert',
    description: 'Specialized in logical reasoning and analysis',
    baseModel: 'lfm2-350m',
    domains: ['logic', 'analysis', 'planning', 'problem-solving', 'decision'],
    keywords: ['why', 'because', 'therefore', 'analyze', 'reason', 'think', 'plan', 'decide'],
  },
  'chat': {
    name: 'Chat Expert',
    description: 'Specialized in conversational interactions',
    baseModel: 'smollm2-135m',
    domains: ['conversation', 'greeting', 'small-talk', 'assistance'],
    keywords: ['hello', 'hi', 'thanks', 'help', 'please', 'how are', 'what is'],
  },
  'creative': {
    name: 'Creative Expert',
    description: 'Specialized in creative writing and ideation',
    baseModel: 'smollm2-360m',
    domains: ['writing', 'stories', 'poetry', 'ideas', 'brainstorm'],
    keywords: ['write', 'story', 'creative', 'imagine', 'idea', 'poem', 'describe'],
  },
  'knowledge': {
    name: 'Knowledge Expert',
    description: 'Specialized in factual knowledge and explanations',
    baseModel: 'qwen2.5-0.5b',
    domains: ['facts', 'history', 'science', 'geography', 'definitions'],
    keywords: ['what', 'who', 'when', 'where', 'explain', 'define', 'tell me about'],
  },
};

// ============================================
// Expert Class
// ============================================

class Expert {
  constructor(expertKey, config = {}) {
    const expertConfig = EXPERT_CONFIGS[expertKey];
    if (!expertConfig) {
      throw new Error(`Unknown expert: ${expertKey}`);
    }

    this.key = expertKey;
    this.config = expertConfig;
    this.baseModel = TINY_MODELS[expertConfig.baseModel];

    // Initialize SONA engine for this expert
    this.engine = SonaEngine.withConfig({
      hiddenDim: this.baseModel.hiddenDim,
      microLoraRank: 1,
      baseLoraRank: config.baseLoraRank || 8,
      microLoraLr: config.learningRate || 0.005,
      trajectoryCapacity: config.trajectoryCapacity || 5000,
      patternClusters: config.patternClusters || 50,
      ewcLambda: 2000,
      enableSimd: true,
    });

    this.trainingCount = 0;
    this.avgQuality = 0;
    this.activations = 0;
  }

  // Train expert on domain-specific data
  train(trajectories) {
    for (const traj of trajectories) {
      const embedding = this._embed(traj.input);
      const tid = this.engine.beginTrajectory(embedding);
      this.engine.applyMicroLora(embedding);
      this.engine.endTrajectory(tid, traj.quality);
      this.trainingCount++;
      this.avgQuality = (this.avgQuality * (this.trainingCount - 1) + traj.quality) / this.trainingCount;
    }
    this.engine.forceLearn();
  }

  // Process input and return enhanced embedding + confidence
  process(input) {
    const embedding = this._embed(input);
    const enhanced = this.engine.applyMicroLora(embedding);
    const confidence = this._calculateConfidence(input);
    this.activations++;

    return {
      embedding: enhanced,
      confidence,
      expert: this.key,
    };
  }

  // Calculate confidence based on keyword matching
  _calculateConfidence(input) {
    const text = typeof input === 'string' ? input.toLowerCase() : JSON.stringify(input).toLowerCase();

    let matches = 0;
    for (const keyword of this.config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    // Base confidence from keyword matches
    const keywordScore = Math.min(1, matches / 3);

    // Add domain-specific boost
    let domainBoost = 0;
    for (const domain of this.config.domains) {
      if (text.includes(domain)) {
        domainBoost += 0.1;
      }
    }

    return Math.min(1, keywordScore * 0.7 + domainBoost + 0.1);
  }

  _embed(input) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const hash = crypto.createHash('sha256').update(text).digest();
    return Array.from({ length: this.baseModel.hiddenDim }, (_, i) =>
      (hash[i % hash.length] / 255 - 0.5) * 0.1
    );
  }

  getStats() {
    return {
      expert: this.key,
      name: this.config.name,
      baseModel: this.config.baseModel,
      trainingCount: this.trainingCount,
      avgQuality: this.avgQuality.toFixed(3),
      activations: this.activations,
    };
  }
}

// ============================================
// Router Class
// ============================================

class Router {
  constructor(config = {}) {
    this.topK = config.topK || 2;  // Number of experts to activate
    this.threshold = config.threshold || 0.3;  // Minimum confidence to activate
    this.routingHistory = [];
  }

  // Route input to best experts
  route(input, experts) {
    const scores = [];

    for (const [key, expert] of Object.entries(experts)) {
      const confidence = expert._calculateConfidence(input);
      scores.push({ key, confidence });
    }

    // Sort by confidence descending
    scores.sort((a, b) => b.confidence - a.confidence);

    // Select top-K experts above threshold
    const selected = scores
      .filter(s => s.confidence >= this.threshold)
      .slice(0, this.topK);

    // If none above threshold, use top expert anyway
    if (selected.length === 0) {
      selected.push(scores[0]);
    }

    // Normalize weights
    const totalConf = selected.reduce((sum, s) => sum + s.confidence, 0);
    const weights = selected.map(s => ({
      expert: s.key,
      weight: s.confidence / totalConf,
      rawConfidence: s.confidence,
    }));

    this.routingHistory.push({
      input: typeof input === 'string' ? input.slice(0, 50) : 'object',
      selected: weights,
      timestamp: Date.now(),
    });

    return weights;
  }

  getStats() {
    const expertCounts = {};
    for (const record of this.routingHistory) {
      for (const sel of record.selected) {
        expertCounts[sel.expert] = (expertCounts[sel.expert] || 0) + 1;
      }
    }

    return {
      totalRoutes: this.routingHistory.length,
      expertDistribution: expertCounts,
    };
  }
}

// ============================================
// MoE System
// ============================================

class SonaMoE {
  constructor(config = {}) {
    this.experts = {};
    this.router = new Router({
      topK: config.topK || 2,
      threshold: config.threshold || 0.3,
    });
    this.config = config;
    this.processCount = 0;
  }

  // Add an expert
  addExpert(expertKey, expertConfig = {}) {
    this.experts[expertKey] = new Expert(expertKey, expertConfig);
    return this;
  }

  // Add all default experts
  addAllExperts(expertConfig = {}) {
    for (const key of Object.keys(EXPERT_CONFIGS)) {
      this.addExpert(key, expertConfig);
    }
    return this;
  }

  // Train a specific expert
  trainExpert(expertKey, trajectories) {
    if (!this.experts[expertKey]) {
      throw new Error(`Expert not found: ${expertKey}`);
    }
    this.experts[expertKey].train(trajectories);
    return this;
  }

  // Process input through MoE
  process(input) {
    // Route to experts
    const routing = this.router.route(input, this.experts);

    // Get responses from selected experts
    const responses = routing.map(({ expert, weight }) => {
      const result = this.experts[expert].process(input);
      return {
        ...result,
        weight,
      };
    });

    // Combine embeddings (weighted average)
    const combinedEmbedding = this._combineEmbeddings(responses);

    this.processCount++;

    return {
      routing,
      responses,
      combined: combinedEmbedding,
      primaryExpert: routing[0].expert,
    };
  }

  _combineEmbeddings(responses) {
    if (responses.length === 0) return null;

    const dim = responses[0].embedding.length;
    const combined = new Array(dim).fill(0);

    for (const resp of responses) {
      for (let i = 0; i < dim; i++) {
        combined[i] += resp.embedding[i] * resp.weight;
      }
    }

    return combined;
  }

  // Get system stats
  getStats() {
    return {
      totalExperts: Object.keys(this.experts).length,
      processCount: this.processCount,
      router: this.router.getStats(),
      experts: Object.fromEntries(
        Object.entries(this.experts).map(([k, e]) => [k, e.getStats()])
      ),
    };
  }

  // Export MoE configuration
  export(exportDir) {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const manifest = {
      type: 'sona-moe',
      version: '1.0.0',
      experts: Object.fromEntries(
        Object.entries(this.experts).map(([key, expert]) => [
          key,
          {
            name: expert.config.name,
            baseModel: expert.config.baseModel,
            hiddenDim: expert.baseModel.hiddenDim,
            domains: expert.config.domains,
            trainingCount: expert.trainingCount,
            avgQuality: expert.avgQuality,
          },
        ])
      ),
      router: {
        topK: this.router.topK,
        threshold: this.router.threshold,
      },
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(exportDir, 'moe_manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Export each expert config
    for (const [key, expert] of Object.entries(this.experts)) {
      const expertDir = path.join(exportDir, 'experts', key);
      if (!fs.existsSync(expertDir)) {
        fs.mkdirSync(expertDir, { recursive: true });
      }

      const expertConfig = {
        key,
        ...expert.config,
        baseModelConfig: expert.baseModel,
        sonaConfig: {
          microLoraRank: 1,
          baseLoraRank: 8,
          learningRate: 0.005,
        },
        training: {
          count: expert.trainingCount,
          avgQuality: expert.avgQuality,
        },
      };

      fs.writeFileSync(
        path.join(expertDir, 'config.json'),
        JSON.stringify(expertConfig, null, 2)
      );
    }

    return { directory: exportDir, manifest };
  }
}

// ============================================
// Training Functions
// ============================================

function generateExpertTrainingData(expertKey, count = 500) {
  const config = EXPERT_CONFIGS[expertKey];
  const data = [];

  for (let i = 0; i < count; i++) {
    // Generate domain-specific input
    const domain = config.domains[i % config.domains.length];
    const keyword = config.keywords[i % config.keywords.length];

    const input = {
      domain,
      keyword,
      id: i,
      complexity: Math.random(),
    };

    // Quality improves with training
    const quality = 0.4 + (i / count) * 0.4 + (Math.random() - 0.5) * 0.1;

    data.push({ input, quality });
  }

  return data;
}

async function trainMoE(moe, options = {}) {
  const {
    trajectoriesPerExpert = 1000,
    onProgress = null,
  } = options;

  const expertKeys = Object.keys(moe.experts);
  let totalTrained = 0;

  for (const key of expertKeys) {
    const data = generateExpertTrainingData(key, trajectoriesPerExpert);

    // Train in batches
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      moe.trainExpert(key, batch);
      totalTrained += batch.length;

      if (onProgress) {
        onProgress({
          expert: key,
          trained: totalTrained,
          total: expertKeys.length * trajectoriesPerExpert,
        });
      }
    }
  }

  return totalTrained;
}

// ============================================
// Exports
// ============================================

module.exports = {
  SonaMoE,
  Expert,
  Router,
  EXPERT_CONFIGS,
  trainMoE,
  generateExpertTrainingData,
};
