/**
 * AgentDB - High-performance WASM database for franchise platform
 *
 * This module provides a TypeScript wrapper around the WASM core with:
 * - Connection pooling
 * - Caching layer
 * - Promise-based API
 * - Error handling
 */

import init, {
  WasmAgentDb,
  DbResult,
  Agent,
  Franchise,
  Event,
  QueryFilter,
  DbStats,
  AgentRole,
  AgentStatus,
  now,
  version
} from '../../agentdb-wasm/pkg/agentdb_wasm';

export * from '../../agentdb-wasm/pkg/agentdb_wasm';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface PoolConfig {
  maxInstances?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number; // milliseconds
}

/**
 * Enhanced AgentDB with connection pooling and caching
 */
export class AgentDB {
  private db: WasmAgentDb;
  private cache: Map<string, CacheEntry<any>>;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private initialized: boolean = false;

  constructor(config: PoolConfig = {}) {
    this.db = new WasmAgentDb();
    this.cache = new Map();
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.cacheTTL = config.cacheTTL ?? 5000; // 5 seconds default
  }

  /**
   * Initialize WASM module (must be called before use)
   */
  static async init(): Promise<void> {
    await init();
  }

  /**
   * Create a new agent
   */
  createAgent(name: string, role: AgentRole): Agent {
    const result = this.db.createAgent(name, role);
    this.handleResult(result);
    this.invalidateCache('agents');
    return result.data;
  }

  /**
   * Upsert an agent
   */
  upsertAgent(agent: Agent): Agent {
    const result = this.db.upsertAgent(agent);
    this.handleResult(result);
    this.invalidateCache('agents');
    this.invalidateCache(`agent:${agent.id}`);
    return result.data;
  }

  /**
   * Get agent by ID with caching
   */
  getAgent(id: string): Agent {
    const cacheKey = `agent:${id}`;

    if (this.cacheEnabled) {
      const cached = this.getFromCache<Agent>(cacheKey);
      if (cached) return cached;
    }

    const result = this.db.getAgent(id);
    this.handleResult(result);

    if (this.cacheEnabled) {
      this.setCache(cacheKey, result.data);
    }

    return result.data;
  }

  /**
   * Query agents with optional caching
   */
  queryAgents(filter: QueryFilter = {}): Agent[] {
    const cacheKey = `agents:${JSON.stringify(filter)}`;

    if (this.cacheEnabled) {
      const cached = this.getFromCache<Agent[]>(cacheKey);
      if (cached) return cached;
    }

    const result = this.db.queryAgents(filter);
    this.handleResult(result);

    if (this.cacheEnabled) {
      this.setCache(cacheKey, result.data);
    }

    return result.data;
  }

  /**
   * Delete agent by ID
   */
  deleteAgent(id: string): void {
    const result = this.db.deleteAgent(id);
    this.handleResult(result);
    this.invalidateCache('agents');
    this.invalidateCache(`agent:${id}`);
  }

  /**
   * Create a franchise
   */
  createFranchise(name: string, ownerId: string, location: string): Franchise {
    const result = this.db.createFranchise(name, ownerId, location);
    this.handleResult(result);
    this.invalidateCache('franchises');
    return result.data;
  }

  /**
   * Upsert a franchise
   */
  upsertFranchise(franchise: Franchise): Franchise {
    const result = this.db.upsertFranchise(franchise);
    this.handleResult(result);
    this.invalidateCache('franchises');
    this.invalidateCache(`franchise:${franchise.id}`);
    return result.data;
  }

  /**
   * Get franchise by ID with caching
   */
  getFranchise(id: string): Franchise {
    const cacheKey = `franchise:${id}`;

    if (this.cacheEnabled) {
      const cached = this.getFromCache<Franchise>(cacheKey);
      if (cached) return cached;
    }

    const result = this.db.getFranchise(id);
    this.handleResult(result);

    if (this.cacheEnabled) {
      this.setCache(cacheKey, result.data);
    }

    return result.data;
  }

  /**
   * Query franchises with optional caching
   */
  queryFranchises(filter: QueryFilter = {}): Franchise[] {
    const cacheKey = `franchises:${JSON.stringify(filter)}`;

    if (this.cacheEnabled) {
      const cached = this.getFromCache<Franchise[]>(cacheKey);
      if (cached) return cached;
    }

    const result = this.db.queryFranchises(filter);
    this.handleResult(result);

    if (this.cacheEnabled) {
      this.setCache(cacheKey, result.data);
    }

    return result.data;
  }

  /**
   * Delete franchise by ID
   */
  deleteFranchise(id: string): void {
    const result = this.db.deleteFranchise(id);
    this.handleResult(result);
    this.invalidateCache('franchises');
    this.invalidateCache(`franchise:${id}`);
  }

  /**
   * Assign agent to franchise
   */
  assignAgent(agentId: string, franchiseId: string): void {
    const result = this.db.assignAgent(agentId, franchiseId);
    this.handleResult(result);
    this.invalidateCache('agents');
    this.invalidateCache('franchises');
    this.invalidateCache(`agent:${agentId}`);
    this.invalidateCache(`franchise:${franchiseId}`);
  }

  /**
   * Unassign agent from franchise
   */
  unassignAgent(agentId: string): void {
    const result = this.db.unassignAgent(agentId);
    this.handleResult(result);
    this.invalidateCache('agents');
    this.invalidateCache('franchises');
    this.invalidateCache(`agent:${agentId}`);
  }

  /**
   * Get events with optional filtering
   */
  getEvents(entityId?: string, limit?: number): Event[] {
    const result = this.db.getEvents(entityId, limit);
    this.handleResult(result);
    return result.data;
  }

  /**
   * Get database statistics
   */
  getStats(): DbStats {
    const result = this.db.getStats();
    this.handleResult(result);
    return result.data;
  }

  /**
   * Export database as JSON
   */
  export(): string {
    const result = this.db.export();
    this.handleResult(result);
    return result.data;
  }

  /**
   * Import database from JSON
   */
  import(json: string): void {
    const result = this.db.import(json);
    this.handleResult(result);
    this.clearCache();
  }

  /**
   * Clear all data
   */
  clear(): void {
    const result = this.db.clear();
    this.handleResult(result);
    this.clearCache();
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Get current timestamp in milliseconds
   */
  static now(): number {
    return now();
  }

  /**
   * Get WASM module version
   */
  static version(): string {
    return version();
  }

  // Private helper methods

  private handleResult<T>(result: DbResult<T>): void {
    if (!result.success) {
      throw new Error(result.error || 'Unknown database error');
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const currentTime = Date.now();
    if (currentTime - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTTL,
    });
  }

  private invalidateCache(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Connection pool manager for multiple database instances
 */
export class AgentDBPool {
  private instances: AgentDB[] = [];
  private currentIndex: number = 0;
  private maxInstances: number;

  constructor(config: PoolConfig = {}) {
    this.maxInstances = config.maxInstances ?? 5;

    // Pre-create instances
    for (let i = 0; i < this.maxInstances; i++) {
      this.instances.push(new AgentDB(config));
    }
  }

  /**
   * Get a database instance from the pool (round-robin)
   */
  getInstance(): AgentDB {
    const instance = this.instances[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.maxInstances;
    return instance;
  }

  /**
   * Execute a function with a pooled instance
   */
  async execute<T>(fn: (db: AgentDB) => T): Promise<T> {
    const db = this.getInstance();
    return fn(db);
  }

  /**
   * Clear all instances in the pool
   */
  clearAll(): void {
    for (const instance of this.instances) {
      instance.clear();
    }
  }
}

// Export types
export type {
  DbResult,
  Agent,
  Franchise,
  Event,
  QueryFilter,
  DbStats,
  AgentRole,
  AgentStatus,
  PoolConfig,
};
