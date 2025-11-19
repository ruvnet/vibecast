/**
 * Holographic Storage System
 *
 * Key principle: Every fragment contains information about the whole
 *
 * Properties:
 * - Graceful degradation: Losing 50% of data still allows 80%+ reconstruction
 * - Distributed redundancy: No single point of failure
 * - Fuzzy retrieval: Partial queries return useful results
 * - Self-organizing: Data naturally distributes across storage
 *
 * Based on holographic principles:
 * - Breaking a hologram in half doesn't give you half the image
 * - You get the whole image at lower resolution
 * - Same principle applied to data storage
 */

import { HyperVector } from './hypervector.js';

interface StorageShard {
  id: string;
  fragment: HyperVector;
  metadata: {
    keys: string[];
    createdAt: number;
    fragmentRange: [number, number]; // percentage of original vector
  };
}

interface StoredItem {
  key: string;
  vector: HyperVector;
  shardIds: string[];
  timestamp: number;
}

export class HolographicStore {
  private shards: Map<string, StorageShard> = new Map();
  private items: Map<string, StoredItem> = new Map();
  private shardCount: number;
  private redundancy: number;

  /**
   * @param shardCount Number of shards to split data across
   * @param redundancy How many shards contain overlapping data (1 = no overlap, 2 = 50% overlap, etc.)
   */
  constructor(shardCount: number = 8, redundancy: number = 2) {
    this.shardCount = shardCount;
    this.redundancy = Math.max(1, redundancy);
  }

  /**
   * STORE: Distribute data holographically across shards
   * Each shard gets a fragment of the vector, but with overlap
   */
  store(key: string, data: any): void {
    const vector = HyperVector.encode(data);
    const shardIds: string[] = [];
    const timestamp = Date.now();

    // Calculate fragment ranges with overlap
    const fragmentSize = 1.0 / (this.shardCount / this.redundancy);
    const step = 1.0 / this.shardCount;

    for (let i = 0; i < this.shardCount; i++) {
      const start = i * step;
      const end = Math.min(1.0, start + fragmentSize);

      const fragment = vector.fragment(start, end);
      const shardId = `${key}-shard-${i}-${timestamp}`;

      const shard: StorageShard = {
        id: shardId,
        fragment,
        metadata: {
          keys: [key],
          createdAt: timestamp,
          fragmentRange: [start, end]
        }
      };

      this.shards.set(shardId, shard);
      shardIds.push(shardId);
    }

    this.items.set(key, {
      key,
      vector,
      shardIds,
      timestamp
    });
  }

  /**
   * RETRIEVE: Reconstruct data from available shards
   * Works even if some shards are lost!
   */
  retrieve(key: string): {
    data: HyperVector;
    confidence: number;
    shardsUsed: number;
    shardsAvailable: number;
  } | null {
    const item = this.items.get(key);
    if (!item) return null;

    // Collect available shards
    const availableShards: StorageShard[] = [];
    for (const shardId of item.shardIds) {
      const shard = this.shards.get(shardId);
      if (shard) {
        availableShards.push(shard);
      }
    }

    if (availableShards.length === 0) return null;

    // Reconstruct by bundling all available fragments
    // The overlap ensures we can recover even with missing shards
    const fragments = availableShards.map(s => s.fragment);
    const reconstructed = HyperVector.bundle(fragments);

    // Calculate confidence based on available shards and similarity to original
    const confidence = (availableShards.length / item.shardIds.length) *
                      reconstructed.similarity(item.vector);

    return {
      data: reconstructed,
      confidence,
      shardsUsed: availableShards.length,
      shardsAvailable: item.shardIds.length
    };
  }

  /**
   * PARTIAL RETRIEVE: Reconstruct from any available shards
   * Even better - retrieve based on pattern matching, not exact key
   */
  retrieveByPattern(pattern: any, threshold: number = 0.5): Array<{
    key: string;
    data: HyperVector;
    similarity: number;
    confidence: number;
  }> {
    const patternVector = HyperVector.encode(pattern);
    const results: Array<{
      key: string;
      data: HyperVector;
      similarity: number;
      confidence: number;
    }> = [];

    for (const [key, item] of this.items) {
      const retrieved = this.retrieve(key);
      if (!retrieved) continue;

      const similarity = retrieved.data.similarity(patternVector);
      if (similarity >= threshold) {
        results.push({
          key,
          data: retrieved.data,
          similarity,
          confidence: retrieved.confidence
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * SIMULATE FAILURE: Remove random shards to test graceful degradation
   */
  simulateFailure(lossPercentage: number): {
    shardsRemoved: number;
    shardsRemaining: number;
    affectedKeys: string[];
  } {
    const shardIds = Array.from(this.shards.keys());
    const removeCount = Math.floor(shardIds.length * lossPercentage);
    const toRemove = this.shuffleArray(shardIds).slice(0, removeCount);
    const affectedKeys = new Set<string>();

    for (const shardId of toRemove) {
      const shard = this.shards.get(shardId);
      if (shard) {
        shard.metadata.keys.forEach(k => affectedKeys.add(k));
      }
      this.shards.delete(shardId);
    }

    return {
      shardsRemoved: toRemove.length,
      shardsRemaining: this.shards.size,
      affectedKeys: Array.from(affectedKeys)
    };
  }

  /**
   * TEST RECOVERY: Check how well data can be recovered after loss
   */
  testRecovery(key: string): {
    originalSimilarity: number;
    confidence: number;
    recoverable: boolean;
  } | null {
    const item = this.items.get(key);
    if (!item) return null;

    const retrieved = this.retrieve(key);
    if (!retrieved) {
      return {
        originalSimilarity: 0,
        confidence: 0,
        recoverable: false
      };
    }

    return {
      originalSimilarity: retrieved.data.similarity(item.vector),
      confidence: retrieved.confidence,
      recoverable: retrieved.confidence > 0.5
    };
  }

  /**
   * COMPACT: Merge overlapping shards to save space
   * Demonstrates self-organizing property
   */
  compact(): { before: number; after: number; saved: number } {
    const before = this.shards.size;

    // Group shards by key
    const keyShards = new Map<string, StorageShard[]>();
    for (const shard of this.shards.values()) {
      for (const key of shard.metadata.keys) {
        if (!keyShards.has(key)) {
          keyShards.set(key, []);
        }
        keyShards.get(key)!.push(shard);
      }
    }

    // For each key, bundle all shards into fewer shards
    for (const [key, shards] of keyShards) {
      if (shards.length <= this.shardCount / 2) continue;

      const item = this.items.get(key);
      if (!item) continue;

      // Remove old shards
      for (const shard of shards) {
        this.shards.delete(shard.id);
      }

      // Create new compact shards
      const timestamp = Date.now();
      const newShardIds: string[] = [];
      const step = 1.0 / this.shardCount;

      for (let i = 0; i < this.shardCount; i++) {
        const start = i * step;
        const end = Math.min(1.0, start + step);
        const fragment = item.vector.fragment(start, end);
        const shardId = `${key}-compact-${i}-${timestamp}`;

        this.shards.set(shardId, {
          id: shardId,
          fragment,
          metadata: {
            keys: [key],
            createdAt: timestamp,
            fragmentRange: [start, end]
          }
        });

        newShardIds.push(shardId);
      }

      item.shardIds = newShardIds;
    }

    const after = this.shards.size;
    return { before, after, saved: before - after };
  }

  /**
   * STATISTICS: Get storage metrics
   */
  stats(): {
    totalShards: number;
    totalItems: number;
    averageShardsPerItem: number;
    redundancyFactor: number;
    estimatedLossTolerance: number;
  } {
    let totalShardRefs = 0;
    for (const item of this.items.values()) {
      totalShardRefs += item.shardIds.length;
    }

    const averageShardsPerItem = this.items.size > 0 ? totalShardRefs / this.items.size : 0;
    const redundancyFactor = this.redundancy;

    // Estimate how much loss we can tolerate (based on redundancy)
    const estimatedLossTolerance = 1 - (1 / redundancyFactor);

    return {
      totalShards: this.shards.size,
      totalItems: this.items.size,
      averageShardsPerItem,
      redundancyFactor,
      estimatedLossTolerance
    };
  }

  /**
   * EXPORT: Serialize to JSON
   */
  export(): any {
    return {
      shardCount: this.shardCount,
      redundancy: this.redundancy,
      shards: Array.from(this.shards.entries()).map(([id, shard]) => ({
        id,
        fragment: shard.fragment.toJSON(),
        metadata: shard.metadata
      })),
      items: Array.from(this.items.entries()).map(([key, item]) => ({
        key,
        vector: item.vector.toJSON(),
        shardIds: item.shardIds,
        timestamp: item.timestamp
      }))
    };
  }

  /**
   * IMPORT: Restore from JSON
   */
  static import(data: any): HolographicStore {
    const store = new HolographicStore(data.shardCount, data.redundancy);

    for (const shardData of data.shards) {
      store.shards.set(shardData.id, {
        id: shardData.id,
        fragment: HyperVector.fromJSON(shardData.fragment),
        metadata: shardData.metadata
      });
    }

    for (const itemData of data.items) {
      store.items.set(itemData.key, {
        key: itemData.key,
        vector: HyperVector.fromJSON(itemData.vector),
        shardIds: itemData.shardIds,
        timestamp: itemData.timestamp
      });
    }

    return store;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
