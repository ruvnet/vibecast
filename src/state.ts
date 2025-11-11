/**
 * State management - LangGraph-compatible
 */

export interface StateMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  custom: Record<string, any>;
}

/**
 * State class - mimics Python LangGraph State
 */
export class State {
  private data: Map<string, any>;
  public metadata: StateMetadata;

  constructor(initialData: Record<string, any> = {}) {
    this.data = new Map(Object.entries(initialData));
    const now = new Date().toISOString();
    this.metadata = {
      version: 0,
      createdAt: now,
      updatedAt: now,
      custom: {}
    };
  }

  /**
   * Get a value from the state
   */
  get(key: string): any {
    return this.data.get(key);
  }

  /**
   * Set a value in the state
   */
  set(key: string, value: any): void {
    this.data.set(key, value);
    this.metadata.version++;
    // Note: Timestamp updates removed for performance (matching Rust optimization)
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Remove a key from the state
   */
  delete(key: string): boolean {
    const result = this.data.delete(key);
    if (result) {
      this.metadata.version++;
    }
    return result;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get all entries
   */
  entries(): [string, any][] {
    return Array.from(this.data.entries());
  }

  /**
   * Convert to plain object
   */
  toObject(): Record<string, any> {
    return Object.fromEntries(this.data);
  }

  /**
   * Merge with another state
   */
  merge(other: State): void {
    for (const [key, value] of other.data) {
      this.data.set(key, value);
    }
    this.metadata.version++;
  }

  /**
   * Clone the state
   */
  clone(): State {
    const cloned = new State(this.toObject());
    cloned.metadata = { ...this.metadata };
    return cloned;
  }

  /**
   * Get state size (number of entries)
   */
  get size(): number {
    return this.data.size;
  }

  /**
   * Manually update timestamp (for when needed)
   */
  updateTimestamp(): void {
    this.metadata.updatedAt = new Date().toISOString();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      data: this.toObject(),
      metadata: this.metadata
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: any): State {
    const state = new State(json.data);
    if (json.metadata) {
      state.metadata = json.metadata;
    }
    return state;
  }
}
