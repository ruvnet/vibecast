/**
 * AgentDB - Pattern storage and reflexion memory
 */

import { State } from './state';
import { Pattern } from './types';

/**
 * Embedding model interface
 */
export interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
  dimension: number;
}

/**
 * Mock embedding model for testing
 */
export class MockEmbeddingModel implements EmbeddingModel {
  public dimension = 384;

  async embed(text: string): Promise<number[]> {
    // Simple hash-based mock embedding
    const embedding = new Array(this.dimension).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % this.dimension] += charCode;
    }
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
}

/**
 * AgentDB - Main class for pattern storage
 */
export class AgentDB {
  private patterns: Map<string, Pattern>;
  private embeddingModel: EmbeddingModel;

  constructor(embeddingModel: EmbeddingModel = new MockEmbeddingModel()) {
    this.patterns = new Map();
    this.embeddingModel = embeddingModel;
  }

  /**
   * Store a pattern
   */
  async storePattern(
    name: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const id = `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const embedding = await this.embeddingModel.embed(content);
    const now = new Date().toISOString();

    const pattern: Pattern = {
      id,
      name,
      content,
      embedding,
      score: 0,
      usageCount: 0,
      metadata,
      createdAt: now,
      updatedAt: now
    };

    this.patterns.set(id, pattern);
    return id;
  }

  /**
   * Search for similar patterns using cosine similarity
   */
  async searchSimilar(query: string, limit: number = 5): Promise<Pattern[]> {
    const queryEmbedding = await this.embeddingModel.embed(query);

    const results = Array.from(this.patterns.values()).map(pattern => {
      const similarity = this.cosineSimilarity(queryEmbedding, pattern.embedding);
      return { pattern, similarity };
    });

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit).map(r => ({
      ...r.pattern,
      score: r.similarity
    }));
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): Pattern | null {
    return this.patterns.get(id) || null;
  }

  /**
   * Update pattern usage
   */
  incrementUsage(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.usageCount++;
      pattern.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dotProduct / (magA * magB);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalPatterns: this.patterns.size,
      embeddingDimension: this.embeddingModel.dimension,
      totalUsage: Array.from(this.patterns.values()).reduce(
        (sum, p) => sum + p.usageCount,
        0
      )
    };
  }

  /**
   * Export patterns to JSON
   */
  export(): any[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Import patterns from JSON
   */
  import(patterns: Pattern[]): void {
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
    }
  }
}

/**
 * Reflexion Memory - Learning from past executions
 */
export class ReflexionMemory {
  private agentDb: AgentDB;

  constructor(agentDb: AgentDB) {
    this.agentDb = agentDb;
  }

  /**
   * Record a successful execution
   */
  async recordSuccess(
    name: string,
    state: State,
    score: number = 1.0
  ): Promise<string> {
    const content = JSON.stringify(state.toObject());
    return this.agentDb.storePattern(name, content, { type: 'success', score });
  }

  /**
   * Record a failed execution
   */
  async recordFailure(
    name: string,
    state: State,
    error: string
  ): Promise<string> {
    const content = JSON.stringify({ state: state.toObject(), error });
    return this.agentDb.storePattern(name, content, { type: 'failure' });
  }

  /**
   * Recall similar past executions
   */
  async recallSimilar(state: State, limit: number = 5): Promise<Pattern[]> {
    const content = JSON.stringify(state.toObject());
    return this.agentDb.searchSimilar(content, limit);
  }

  /**
   * Get learning statistics
   */
  getStats() {
    const stats = this.agentDb.getStats();
    const patterns = this.agentDb.export();
    const successes = patterns.filter(p => p.metadata.type === 'success').length;
    const failures = patterns.filter(p => p.metadata.type === 'failure').length;

    return {
      ...stats,
      successes,
      failures,
      successRate: successes / (successes + failures || 1)
    };
  }
}

// Export Pattern type
export type { Pattern };
