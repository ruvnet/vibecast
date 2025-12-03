/**
 * ruvector Integration for Toyota Simulation
 * High-performance vector memory and GNN-based learning
 */

import { VectorDB, getImplementationType, isNative } from 'ruvector';
import { RuvectorLayer, TensorCompress, differentiableSearch, hierarchicalForward } from '@ruvector/gnn';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import { Agent, MemoryItem, LearningEvent } from '../types';

// ============================================================================
// VECTOR MEMORY SYSTEM
// ============================================================================

export interface VectorMemoryConfig {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dot';
  persistPath?: string;
  autoPersist?: boolean;
  hnswM?: number;
  hnswEfConstruction?: number;
  hnswEfSearch?: number;
}

export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  content: string;
  type: 'observation' | 'decision' | 'outcome' | 'learning' | 'skill' | 'relationship';
  importance: number;
  embedding: number[];
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface MemorySearchResult {
  entry: AgentMemoryEntry;
  similarity: number;
}

/**
 * Vector-based memory system for agents using ruvector
 */
export class RuvectorMemorySystem extends EventEmitter {
  private db: typeof VectorDB;
  private config: VectorMemoryConfig;
  private memoryCache: Map<string, AgentMemoryEntry> = new Map();
  private compressor: TensorCompress;
  private initialized: boolean = false;

  constructor(config: Partial<VectorMemoryConfig> = {}) {
    super();

    this.config = {
      dimension: config.dimension || 384, // Typical embedding dimension
      metric: config.metric || 'cosine',
      persistPath: config.persistPath,
      autoPersist: config.autoPersist || false,
      hnswM: config.hnswM || 16,
      hnswEfConstruction: config.hnswEfConstruction || 200,
      hnswEfSearch: config.hnswEfSearch || 100,
    };

    this.compressor = new TensorCompress();
  }

  async initialize(): Promise<void> {
    console.log(`Initializing ruvector Memory System (${getImplementationType()})...`);

    this.db = new VectorDB({
      dimension: this.config.dimension,
      metric: this.config.metric,
      path: this.config.persistPath,
      autoPersist: this.config.autoPersist,
      hnsw: {
        m: this.config.hnswM,
        efConstruction: this.config.hnswEfConstruction,
        efSearch: this.config.hnswEfSearch,
      },
    });

    this.initialized = true;
    console.log(`  ✓ ruvector Memory System initialized (Native: ${isNative()})`);
  }

  /**
   * Store a memory with its embedding
   */
  async storeMemory(entry: Omit<AgentMemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    if (!this.initialized) await this.initialize();

    const id = uuidv4();
    const fullEntry: AgentMemoryEntry = {
      ...entry,
      id,
      timestamp: new Date(),
    };

    // Store in vector DB
    this.db.insert({
      id,
      vector: entry.embedding,
      metadata: {
        agentId: entry.agentId,
        content: entry.content,
        type: entry.type,
        importance: entry.importance,
        timestamp: fullEntry.timestamp.toISOString(),
        ...entry.metadata,
      },
    });

    // Cache for quick access
    this.memoryCache.set(id, fullEntry);

    return id;
  }

  /**
   * Store multiple memories in batch
   */
  async storeMemoryBatch(entries: Array<Omit<AgentMemoryEntry, 'id' | 'timestamp'>>): Promise<string[]> {
    if (!this.initialized) await this.initialize();

    const ids: string[] = [];
    const vectorEntries = entries.map(entry => {
      const id = uuidv4();
      ids.push(id);

      const fullEntry: AgentMemoryEntry = {
        ...entry,
        id,
        timestamp: new Date(),
      };
      this.memoryCache.set(id, fullEntry);

      return {
        id,
        vector: entry.embedding,
        metadata: {
          agentId: entry.agentId,
          content: entry.content,
          type: entry.type,
          importance: entry.importance,
          timestamp: fullEntry.timestamp.toISOString(),
          ...entry.metadata,
        },
      };
    });

    this.db.insertBatch(vectorEntries);
    return ids;
  }

  /**
   * Search for similar memories
   */
  async searchMemories(
    queryEmbedding: number[],
    options: {
      k?: number;
      threshold?: number;
      agentId?: string;
      type?: string;
    } = {}
  ): Promise<MemorySearchResult[]> {
    if (!this.initialized) await this.initialize();

    const filter: Record<string, any> = {};
    if (options.agentId) filter.agentId = options.agentId;
    if (options.type) filter.type = options.type;

    const results = this.db.search({
      vector: queryEmbedding,
      k: options.k || 10,
      threshold: options.threshold || 0.5,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    return results.map((result: any) => ({
      entry: {
        id: result.id,
        agentId: result.metadata?.agentId,
        content: result.metadata?.content,
        type: result.metadata?.type,
        importance: result.metadata?.importance,
        embedding: result.vector,
        timestamp: new Date(result.metadata?.timestamp),
        metadata: result.metadata,
      },
      similarity: result.score,
    }));
  }

  /**
   * Search memories for multiple agents at once
   */
  async searchAgentMemories(
    agentIds: string[],
    queryEmbedding: number[],
    k: number = 5
  ): Promise<Map<string, MemorySearchResult[]>> {
    const results = new Map<string, MemorySearchResult[]>();

    for (const agentId of agentIds) {
      const agentResults = await this.searchMemories(queryEmbedding, { k, agentId });
      results.set(agentId, agentResults);
    }

    return results;
  }

  /**
   * Get memory by ID
   */
  getMemory(id: string): AgentMemoryEntry | null {
    // Check cache first
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    // Fallback to DB
    const entry = this.db.get(id);
    if (entry) {
      const memoryEntry: AgentMemoryEntry = {
        id: entry.id,
        agentId: entry.metadata?.agentId,
        content: entry.metadata?.content,
        type: entry.metadata?.type,
        importance: entry.metadata?.importance,
        embedding: entry.vector,
        timestamp: new Date(entry.metadata?.timestamp),
        metadata: entry.metadata,
      };
      this.memoryCache.set(id, memoryEntry);
      return memoryEntry;
    }

    return null;
  }

  /**
   * Compress memory for long-term storage
   */
  compressMemory(embedding: number[], accessFrequency: number): string {
    return this.compressor.compress(embedding, accessFrequency);
  }

  /**
   * Decompress memory
   */
  decompressMemory(compressedJson: string): number[] {
    return this.compressor.decompress(compressedJson);
  }

  /**
   * Get database statistics
   */
  getStats(): object {
    if (!this.initialized) return { initialized: false };

    const stats = this.db.stats();
    return {
      initialized: true,
      implementation: getImplementationType(),
      isNative: isNative(),
      vectorCount: stats.count,
      dimension: stats.dimension,
      metric: stats.metric,
      cacheSize: this.memoryCache.size,
      memoryUsage: stats.memoryUsage,
    };
  }

  /**
   * Build index for faster search
   */
  buildIndex(): void {
    if (this.initialized) {
      this.db.buildIndex();
    }
  }

  /**
   * Optimize database
   */
  optimize(): void {
    if (this.initialized) {
      this.db.optimize();
    }
  }

  /**
   * Save to disk
   */
  save(path?: string): void {
    if (this.initialized) {
      this.db.save(path);
    }
  }

  /**
   * Clear all memories
   */
  clear(): void {
    if (this.initialized) {
      this.db.clear();
      this.memoryCache.clear();
    }
  }
}

// ============================================================================
// GNN LEARNING SYSTEM
// ============================================================================

export interface GNNConfig {
  inputDimension: number;
  hiddenDimension: number;
  attentionHeads: number;
  dropout: number;
  numLayers: number;
}

export interface AgentRelationship {
  sourceId: string;
  targetId: string;
  weight: number;
  type: string;
}

/**
 * GNN-based learning system for agent networks
 */
export class RuvectorGNNLearner extends EventEmitter {
  private layers: RuvectorLayer[] = [];
  private config: GNNConfig;
  private relationshipGraph: Map<string, AgentRelationship[]> = new Map();
  private agentEmbeddings: Map<string, number[]> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<GNNConfig> = {}) {
    super();

    this.config = {
      inputDimension: config.inputDimension || 128,
      hiddenDimension: config.hiddenDimension || 256,
      attentionHeads: config.attentionHeads || 4,
      dropout: config.dropout || 0.1,
      numLayers: config.numLayers || 3,
    };
  }

  async initialize(): Promise<void> {
    console.log('Initializing ruvector GNN Learning System...');

    // Create GNN layers
    for (let i = 0; i < this.config.numLayers; i++) {
      const inputDim = i === 0 ? this.config.inputDimension : this.config.hiddenDimension;
      const layer = new RuvectorLayer(
        inputDim,
        this.config.hiddenDimension,
        this.config.attentionHeads,
        this.config.dropout
      );
      this.layers.push(layer);
    }

    this.initialized = true;
    console.log(`  ✓ GNN initialized with ${this.config.numLayers} layers`);
  }

  /**
   * Register agent with initial embedding
   */
  registerAgent(agentId: string, embedding: number[]): void {
    // Ensure embedding matches input dimension
    const paddedEmbedding = this.padEmbedding(embedding, this.config.inputDimension);
    this.agentEmbeddings.set(agentId, paddedEmbedding);
    this.relationshipGraph.set(agentId, []);
  }

  /**
   * Add relationship between agents
   */
  addRelationship(sourceId: string, targetId: string, weight: number, type: string): void {
    const relationships = this.relationshipGraph.get(sourceId) || [];
    relationships.push({ sourceId, targetId, weight, type });
    this.relationshipGraph.set(sourceId, relationships);
  }

  /**
   * Forward pass through GNN for an agent
   */
  forwardPass(agentId: string): number[] {
    if (!this.initialized) {
      throw new Error('GNN not initialized');
    }

    const agentEmbedding = this.agentEmbeddings.get(agentId);
    if (!agentEmbedding) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    const relationships = this.relationshipGraph.get(agentId) || [];

    // Get neighbor embeddings and weights
    const neighborEmbeddings: number[][] = [];
    const edgeWeights: number[] = [];

    for (const rel of relationships) {
      const neighborEmbed = this.agentEmbeddings.get(rel.targetId);
      if (neighborEmbed) {
        neighborEmbeddings.push(neighborEmbed);
        edgeWeights.push(rel.weight);
      }
    }

    // If no neighbors, return original embedding
    if (neighborEmbeddings.length === 0) {
      return agentEmbedding;
    }

    // Process through all layers
    let currentEmbedding = agentEmbedding;
    for (const layer of this.layers) {
      currentEmbedding = layer.forward(currentEmbedding, neighborEmbeddings, edgeWeights);
    }

    return currentEmbedding;
  }

  /**
   * Hierarchical forward pass with layer-organized embeddings
   */
  hierarchicalForwardPass(queryEmbedding: number[]): number[] {
    if (!this.initialized || this.layers.length === 0) {
      return queryEmbedding;
    }

    // Organize embeddings by hierarchy level
    const layerEmbeddings: number[][][] = [];
    const allEmbeddings = Array.from(this.agentEmbeddings.values());

    // Split embeddings across layers (simple partitioning)
    const perLayer = Math.ceil(allEmbeddings.length / this.config.numLayers);
    for (let i = 0; i < this.config.numLayers; i++) {
      const start = i * perLayer;
      const end = Math.min(start + perLayer, allEmbeddings.length);
      layerEmbeddings.push(allEmbeddings.slice(start, end));
    }

    // Get layer JSONs
    const layerJsons = this.layers.map(layer => layer.toJson());

    // Perform hierarchical forward pass
    return hierarchicalForward(queryEmbedding, layerEmbeddings, layerJsons);
  }

  /**
   * Search for similar agents using differentiable search
   */
  searchSimilarAgents(
    queryEmbedding: number[],
    k: number = 5,
    temperature: number = 1.0
  ): { agentIds: string[]; weights: number[] } {
    const agentIds = Array.from(this.agentEmbeddings.keys());
    const embeddings = Array.from(this.agentEmbeddings.values());

    if (embeddings.length === 0) {
      return { agentIds: [], weights: [] };
    }

    const result = differentiableSearch(
      this.padEmbedding(queryEmbedding, this.config.inputDimension),
      embeddings,
      Math.min(k, embeddings.length),
      temperature
    );

    return {
      agentIds: result.indices.map(i => agentIds[i]),
      weights: result.weights,
    };
  }

  /**
   * Update agent embedding based on new learning
   */
  updateAgentEmbedding(agentId: string, learningDelta: number[], learningRate: number = 0.1): void {
    const currentEmbedding = this.agentEmbeddings.get(agentId);
    if (!currentEmbedding) return;

    const paddedDelta = this.padEmbedding(learningDelta, this.config.inputDimension);

    // Apply learning update
    const newEmbedding = currentEmbedding.map((v, i) =>
      v + learningRate * (paddedDelta[i] || 0)
    );

    this.agentEmbeddings.set(agentId, newEmbedding);
  }

  /**
   * Propagate learning through the network
   */
  propagateLearning(sourceAgentId: string, learningDelta: number[], hops: number = 2): void {
    const visited = new Set<string>();
    const queue: Array<{ agentId: string; hop: number; decay: number }> = [
      { agentId: sourceAgentId, hop: 0, decay: 1.0 }
    ];

    while (queue.length > 0) {
      const { agentId, hop, decay } = queue.shift()!;

      if (visited.has(agentId) || hop > hops) continue;
      visited.add(agentId);

      // Apply decayed learning
      this.updateAgentEmbedding(agentId, learningDelta, 0.1 * decay);

      // Add neighbors to queue
      const relationships = this.relationshipGraph.get(agentId) || [];
      for (const rel of relationships) {
        if (!visited.has(rel.targetId)) {
          queue.push({
            agentId: rel.targetId,
            hop: hop + 1,
            decay: decay * rel.weight * 0.5,
          });
        }
      }
    }
  }

  /**
   * Get GNN statistics
   */
  getStats(): object {
    return {
      initialized: this.initialized,
      numLayers: this.layers.length,
      inputDimension: this.config.inputDimension,
      hiddenDimension: this.config.hiddenDimension,
      attentionHeads: this.config.attentionHeads,
      registeredAgents: this.agentEmbeddings.size,
      totalRelationships: Array.from(this.relationshipGraph.values())
        .reduce((sum, rels) => sum + rels.length, 0),
    };
  }

  /**
   * Save GNN state
   */
  saveState(): object {
    return {
      config: this.config,
      layers: this.layers.map(l => l.toJson()),
      agentEmbeddings: Object.fromEntries(this.agentEmbeddings),
      relationshipGraph: Object.fromEntries(
        Array.from(this.relationshipGraph.entries()).map(([k, v]) => [k, v])
      ),
    };
  }

  /**
   * Load GNN state
   */
  loadState(state: any): void {
    this.config = state.config;
    this.layers = state.layers.map((json: string) => RuvectorLayer.fromJson(json));
    this.agentEmbeddings = new Map(Object.entries(state.agentEmbeddings));
    this.relationshipGraph = new Map(Object.entries(state.relationshipGraph));
    this.initialized = true;
  }

  private padEmbedding(embedding: number[], targetDim: number): number[] {
    if (embedding.length >= targetDim) {
      return embedding.slice(0, targetDim);
    }
    return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
  }
}

// ============================================================================
// INTEGRATED RUVECTOR SYSTEM
// ============================================================================

export interface RuvectorSystemConfig {
  memory?: Partial<VectorMemoryConfig>;
  gnn?: Partial<GNNConfig>;
  enableMemory?: boolean;
  enableGNN?: boolean;
}

/**
 * Integrated ruvector system combining memory and GNN
 */
export class RuvectorSystem extends EventEmitter {
  public memory: RuvectorMemorySystem | null = null;
  public gnn: RuvectorGNNLearner | null = null;
  private config: RuvectorSystemConfig;

  constructor(config: RuvectorSystemConfig = {}) {
    super();
    this.config = {
      enableMemory: config.enableMemory ?? true,
      enableGNN: config.enableGNN ?? true,
      memory: config.memory || {},
      gnn: config.gnn || {},
    };
  }

  async initialize(): Promise<void> {
    console.log('\n┌─ Initializing ruvector AI System ────────────────────────────────┐');

    if (this.config.enableMemory) {
      this.memory = new RuvectorMemorySystem(this.config.memory);
      await this.memory.initialize();
    }

    if (this.config.enableGNN) {
      this.gnn = new RuvectorGNNLearner(this.config.gnn);
      await this.gnn.initialize();
    }

    console.log('└────────────────────────────────────────────────────────────────┘\n');
  }

  getStats(): object {
    return {
      memory: this.memory?.getStats() || { enabled: false },
      gnn: this.gnn?.getStats() || { enabled: false },
    };
  }
}

// Export singleton for easy use
let defaultSystem: RuvectorSystem | null = null;

export async function getRuvectorSystem(config?: RuvectorSystemConfig): Promise<RuvectorSystem> {
  if (!defaultSystem) {
    defaultSystem = new RuvectorSystem(config);
    await defaultSystem.initialize();
  }
  return defaultSystem;
}
