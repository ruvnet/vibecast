/**
 * Temporal Hyperdimensional Database
 *
 * Time is not a timestamp - it's a storage DIMENSION
 * Uses circular permutation to encode temporal position
 * Enables:
 * - Querying "what was X like around time T?"
 * - Temporal interpolation
 * - Time-travel queries
 * - Automatic decay and evolution
 */

import { HyperVector } from './hypervector.js';

interface TemporalEntry {
  data: HyperVector;
  encoded: HyperVector; // data bound with time
  timestamp: number;
}

export class TemporalDatabase {
  private entries: Map<string, TemporalEntry[]> = new Map();
  private timeOrigin: number = Date.now();
  private timeScale: number = 1000; // ms per time unit

  /**
   * Encode time as a hypervector using circular permutation
   * Each time unit = one rotation step
   * This makes temporally close items have similar vectors
   */
  private encodeTime(timestamp: number): HyperVector {
    const timeUnits = Math.floor((timestamp - this.timeOrigin) / this.timeScale);
    const baseTime = HyperVector.random(); // Base time vector
    return baseTime.permute(timeUnits);
  }

  /**
   * Store data at current time
   * Data is BOUND with time, creating 4D+ encoding
   */
  store(key: string, data: any): void {
    const timestamp = Date.now();
    const dataVec = HyperVector.encode(data);
    const timeVec = this.encodeTime(timestamp);

    // BINDING: data * time = temporal snapshot
    const encoded = dataVec.bind(timeVec);

    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }

    this.entries.get(key)!.push({
      data: dataVec,
      encoded,
      timestamp
    });

    // Auto-decay: keep only recent history (sliding window)
    this.decay(key);
  }

  /**
   * Retrieve data from a specific time
   * Uses temporal similarity - doesn't need exact timestamp!
   */
  retrieve(key: string, timestamp?: number): any | null {
    const entries = this.entries.get(key);
    if (!entries || entries.length === 0) return null;

    timestamp = timestamp ?? Date.now();

    // Find temporally closest entry using hypervector similarity
    const targetTime = this.encodeTime(timestamp);
    let bestEntry: TemporalEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of entries) {
      const entryTime = this.encodeTime(entry.timestamp);
      const similarity = targetTime.similarity(entryTime);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  /**
   * HOLOGRAPHIC QUERY: Retrieve using partial/noisy information
   * The database "remembers" based on similarity, not exact match
   */
  retrieveByPattern(pattern: any, timeRange?: [number, number]): Map<string, any> {
    const patternVec = HyperVector.encode(pattern);
    const results = new Map<string, any>();

    const [startTime, endTime] = timeRange ?? [0, Date.now()];

    for (const [key, entries] of this.entries) {
      for (const entry of entries) {
        if (entry.timestamp < startTime || entry.timestamp > endTime) continue;

        const similarity = entry.data.similarity(patternVec);
        if (similarity > 0.6) { // Fuzzy match threshold
          results.set(key, {
            data: entry.data,
            timestamp: entry.timestamp,
            similarity
          });
        }
      }
    }

    return results;
  }

  /**
   * TEMPORAL BUNDLING: Aggregate across time
   * Creates summary vector representing entire time period
   */
  summarize(key: string, timeRange?: [number, number]): HyperVector | null {
    const entries = this.entries.get(key);
    if (!entries || entries.length === 0) return null;

    const [startTime, endTime] = timeRange ?? [0, Date.now()];
    const relevantVectors = entries
      .filter(e => e.timestamp >= startTime && e.timestamp <= endTime)
      .map(e => e.data);

    if (relevantVectors.length === 0) return null;

    // Bundle creates a "holographic summary"
    return HyperVector.bundle(relevantVectors);
  }

  /**
   * TRAJECTORY: Get evolution of data over time
   * Returns sequence of temporal snapshots
   */
  trajectory(key: string, samples: number = 10): Array<{time: number, data: HyperVector}> {
    const entries = this.entries.get(key);
    if (!entries || entries.length === 0) return [];

    const step = Math.max(1, Math.floor(entries.length / samples));
    const trajectory = [];

    for (let i = 0; i < entries.length; i += step) {
      trajectory.push({
        time: entries[i].timestamp,
        data: entries[i].data
      });
    }

    return trajectory;
  }

  /**
   * Decay old entries (temporal sliding window)
   * In a real system, could use probabilistic decay
   */
  private decay(key: string, maxEntries: number = 1000): void {
    const entries = this.entries.get(key);
    if (!entries) return;

    if (entries.length > maxEntries) {
      // Remove oldest entries
      entries.splice(0, entries.length - maxEntries);
    }
  }

  /**
   * HOLOGRAPHIC PROPERTY: Reconstruct from fragment
   * Even with partial data, can recover information
   */
  reconstructFromFragment(fragment: HyperVector): string[] {
    const matches: Array<{key: string, similarity: number}> = [];

    for (const [key, entries] of this.entries) {
      if (entries.length === 0) continue;

      // Check against most recent entry
      const latest = entries[entries.length - 1];
      const similarity = fragment.similarity(latest.data);

      if (similarity > 0.5) {
        matches.push({ key, similarity });
      }
    }

    // Return best matches, sorted by similarity
    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .map(m => m.key);
  }

  /**
   * Get current state of all keys
   */
  snapshot(): Map<string, any> {
    const snapshot = new Map();
    for (const [key, entries] of this.entries) {
      if (entries.length > 0) {
        const latest = entries[entries.length - 1];
        snapshot.set(key, {
          timestamp: latest.timestamp,
          data: latest.data
        });
      }
    }
    return snapshot;
  }

  /**
   * TEMPORAL INTERPOLATION: Estimate state at any time
   * Blends neighboring temporal vectors for smooth transitions
   */
  interpolate(key: string, timestamp: number): HyperVector | null {
    const entries = this.entries.get(key);
    if (!entries || entries.length === 0) return null;

    // Find surrounding entries
    let before: TemporalEntry | null = null;
    let after: TemporalEntry | null = null;

    for (const entry of entries) {
      if (entry.timestamp <= timestamp) {
        if (!before || entry.timestamp > before.timestamp) {
          before = entry;
        }
      }
      if (entry.timestamp >= timestamp) {
        if (!after || entry.timestamp < after.timestamp) {
          after = entry;
        }
      }
    }

    // If exact match, return it
    if (before && before.timestamp === timestamp) return before.data;
    if (after && after.timestamp === timestamp) return after.data;

    // If only one side exists, return that
    if (!before) return after?.data || null;
    if (!after) return before?.data || null;

    // Interpolate using weighted bundling based on temporal distance
    const totalDist = after.timestamp - before.timestamp;
    const beforeDist = timestamp - before.timestamp;
    const afterDist = after.timestamp - timestamp;

    const beforeWeight = 1 - (beforeDist / totalDist);
    const afterWeight = 1 - (afterDist / totalDist);

    return HyperVector.weightedBundle([
      { vector: before.data, weight: beforeWeight },
      { vector: after.data, weight: afterWeight }
    ]);
  }

  /**
   * TIME-TRAVEL QUERY: Get state as it was at specific time
   * Returns exact historical snapshot with metadata
   */
  timeTravelQuery(key: string, timestamp: number): {
    data: HyperVector;
    actualTime: number;
    interpolated: boolean;
  } | null {
    const entries = this.entries.get(key);
    if (!entries || entries.length === 0) return null;

    // Try exact match first
    const exact = entries.find(e => e.timestamp === timestamp);
    if (exact) {
      return {
        data: exact.data,
        actualTime: exact.timestamp,
        interpolated: false
      };
    }

    // Find nearest entry
    let nearest: TemporalEntry | null = null;
    let minDistance = Infinity;

    for (const entry of entries) {
      const distance = Math.abs(entry.timestamp - timestamp);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = entry;
      }
    }

    if (!nearest) return null;

    // If very close, return actual entry
    if (minDistance < this.timeScale) {
      return {
        data: nearest.data,
        actualTime: nearest.timestamp,
        interpolated: false
      };
    }

    // Otherwise interpolate
    const interpolated = this.interpolate(key, timestamp);
    if (!interpolated) return null;

    return {
      data: interpolated,
      actualTime: timestamp,
      interpolated: true
    };
  }

  /**
   * TEMPORAL ANALYTICS: Analyze changes over time
   */
  analyzeEvolution(key: string): {
    totalChanges: number;
    averageChange: number;
    volatility: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  } | null {
    const entries = this.entries.get(key);
    if (!entries || entries.length < 2) return null;

    let totalChange = 0;
    const changes: number[] = [];

    for (let i = 1; i < entries.length; i++) {
      const change = 1 - entries[i - 1].data.similarity(entries[i].data);
      changes.push(change);
      totalChange += change;
    }

    const averageChange = totalChange / changes.length;

    // Calculate volatility (standard deviation of changes)
    const variance = changes.reduce((sum, change) => {
      return sum + Math.pow(change - averageChange, 2);
    }, 0) / changes.length;
    const volatility = Math.sqrt(variance);

    // Determine trend by comparing first and last halves
    const midpoint = Math.floor(changes.length / 2);
    const firstHalfAvg = changes.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const secondHalfAvg = changes.slice(midpoint).reduce((a, b) => a + b, 0) / (changes.length - midpoint);

    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    const trendDiff = secondHalfAvg - firstHalfAvg;
    if (Math.abs(trendDiff) > averageChange * 0.2) {
      trend = trendDiff > 0 ? 'increasing' : 'decreasing';
    }

    return {
      totalChanges: changes.length,
      averageChange,
      volatility,
      trend
    };
  }

  /**
   * TEMPORAL RANGE QUERY: Get all entries in time window
   */
  rangeQuery(key: string, startTime: number, endTime: number): TemporalEntry[] {
    const entries = this.entries.get(key);
    if (!entries) return [];

    return entries.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * MULTI-KEY CORRELATION: Find temporal relationships between keys
   */
  correlate(key1: string, key2: string, timeWindow: number = 10000): number {
    const entries1 = this.entries.get(key1);
    const entries2 = this.entries.get(key2);

    if (!entries1 || !entries2 || entries1.length === 0 || entries2.length === 0) {
      return 0;
    }

    let correlationSum = 0;
    let count = 0;

    // For each entry in key1, find closest entry in key2 within window
    for (const e1 of entries1) {
      for (const e2 of entries2) {
        const timeDiff = Math.abs(e1.timestamp - e2.timestamp);
        if (timeDiff <= timeWindow) {
          correlationSum += e1.data.similarity(e2.data);
          count++;
        }
      }
    }

    return count > 0 ? correlationSum / count : 0;
  }

  /**
   * EXPORT DATA: Serialize database to JSON
   */
  export(): any {
    const exported: any = {
      timeOrigin: this.timeOrigin,
      timeScale: this.timeScale,
      entries: {}
    };

    for (const [key, entries] of this.entries) {
      exported.entries[key] = entries.map(e => ({
        data: e.data.toJSON(),
        encoded: e.encoded.toJSON(),
        timestamp: e.timestamp
      }));
    }

    return exported;
  }

  /**
   * IMPORT DATA: Restore database from JSON
   */
  static import(data: any): TemporalDatabase {
    const db = new TemporalDatabase();
    db.timeOrigin = data.timeOrigin;
    db.timeScale = data.timeScale;

    for (const [key, entries] of Object.entries(data.entries)) {
      db.entries.set(key, (entries as any[]).map(e => ({
        data: HyperVector.fromJSON(e.data),
        encoded: HyperVector.fromJSON(e.encoded),
        timestamp: e.timestamp
      })));
    }

    return db;
  }

  /**
   * Statistics for monitoring
   */
  stats(): any {
    let totalEntries = 0;
    const keyStats = new Map();

    for (const [key, entries] of this.entries) {
      totalEntries += entries.length;
      keyStats.set(key, {
        count: entries.length,
        oldest: entries[0]?.timestamp,
        newest: entries[entries.length - 1]?.timestamp
      });
    }

    return {
      keys: this.entries.size,
      totalEntries,
      keyStats
    };
  }
}
