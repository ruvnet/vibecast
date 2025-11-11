/**
 * Checkpoint management - LangGraph-compatible
 */

import { State } from './state';

export interface CheckpointConfig {
  checkpointId: string;
  threadId: string;
}

export interface Checkpoint {
  state: any;
  config: CheckpointConfig;
  timestamp: string;
}

/**
 * Base checkpointer interface
 */
export interface Checkpointer {
  put(checkpoint: Checkpoint, config: CheckpointConfig): Promise<void>;
  get(checkpointId: string): Promise<Checkpoint | null>;
  list(threadId: string, limit?: number): Promise<Checkpoint[]>;
  delete(checkpointId: string): Promise<void>;
  deleteThread(threadId: string): Promise<void>;
}

/**
 * In-memory checkpointer (fast, not persistent)
 */
export class MemoryCheckpointer implements Checkpointer {
  private checkpoints: Map<string, Checkpoint>;
  private threadIndex: Map<string, string[]>;

  constructor() {
    this.checkpoints = new Map();
    this.threadIndex = new Map();
  }

  async put(checkpoint: Checkpoint, config: CheckpointConfig): Promise<void> {
    this.checkpoints.set(config.checkpointId, checkpoint);

    if (!this.threadIndex.has(config.threadId)) {
      this.threadIndex.set(config.threadId, []);
    }
    this.threadIndex.get(config.threadId)!.push(config.checkpointId);
  }

  async get(checkpointId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(checkpointId) || null;
  }

  async list(threadId: string, limit?: number): Promise<Checkpoint[]> {
    const checkpointIds = this.threadIndex.get(threadId) || [];
    let checkpoints = checkpointIds
      .map(id => this.checkpoints.get(id)!)
      .filter(cp => cp !== undefined);

    if (limit) {
      checkpoints = checkpoints.slice(0, limit);
    }

    return checkpoints;
  }

  async delete(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      this.checkpoints.delete(checkpointId);

      const threadId = checkpoint.config.threadId;
      const threadCheckpoints = this.threadIndex.get(threadId);
      if (threadCheckpoints) {
        const index = threadCheckpoints.indexOf(checkpointId);
        if (index > -1) {
          threadCheckpoints.splice(index, 1);
        }
      }
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const checkpointIds = this.threadIndex.get(threadId) || [];
    for (const id of checkpointIds) {
      this.checkpoints.delete(id);
    }
    this.threadIndex.delete(threadId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalCheckpoints: this.checkpoints.size,
      threads: this.threadIndex.size,
      memoryUsage: `~${Math.round(JSON.stringify(Array.from(this.checkpoints.values())).length / 1024)}KB`
    };
  }
}

/**
 * SQLite checkpointer (persistent storage)
 * Note: This is a placeholder that would connect to the Rust SQLite implementation
 */
export class SqliteCheckpointer implements Checkpointer {
  private dbPath: string;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
    // In a real implementation, this would initialize the Rust SQLite backend
  }

  async put(checkpoint: Checkpoint, config: CheckpointConfig): Promise<void> {
    // Placeholder - would call Rust implementation
    throw new Error('SQLite checkpointer requires Rust WASM binding');
  }

  async get(checkpointId: string): Promise<Checkpoint | null> {
    throw new Error('SQLite checkpointer requires Rust WASM binding');
  }

  async list(threadId: string, limit?: number): Promise<Checkpoint[]> {
    throw new Error('SQLite checkpointer requires Rust WASM binding');
  }

  async delete(checkpointId: string): Promise<void> {
    throw new Error('SQLite checkpointer requires Rust WASM binding');
  }

  async deleteThread(threadId: string): Promise<void> {
    throw new Error('SQLite checkpointer requires Rust WASM binding');
  }
}
