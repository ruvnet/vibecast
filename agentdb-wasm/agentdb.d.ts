/**
 * TypeScript type definitions for AgentDB WASM module
 */

export interface DbResult<T = any> {
  success: boolean;
  error?: string;
  data: T;
}

export type AgentRole = 'owner' | 'manager' | 'worker' | 'specialist' | 'coordinator';
export type AgentStatus = 'active' | 'idle' | 'busy' | 'offline' | 'error';
export type FranchiseTier = 'starter' | 'professional' | 'enterprise' | 'elite';
export type EventType = 'created' | 'updated' | 'deleted' | 'status_changed' | 'assigned' | 'unassigned';
export type EntityType = 'agent' | 'franchise' | 'task' | 'user';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  franchise_id?: string;
  capabilities: string[];
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Franchise {
  id: string;
  name: string;
  owner_id: string;
  location: string;
  tier: FranchiseTier;
  agents: string[];
  revenue: number;
  established_at: string;
  metadata: Record<string, string>;
}

export interface Event {
  id: string;
  event_type: EventType;
  entity_id: string;
  entity_type: EntityType;
  data: any;
  timestamp: string;
  user_id?: string;
}

export interface QueryFilter {
  entity_type?: string;
  status?: string;
  franchise_id?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export interface DbStats {
  total_agents: number;
  total_franchises: number;
  total_events: number;
  active_agents: number;
  memory_usage: number;
}

/**
 * Main AgentDB WASM interface
 */
export class WasmAgentDb {
  constructor();

  /**
   * Create a new agent
   * @param name - Agent name
   * @param role - Agent role
   * @returns Result containing the created agent
   */
  createAgent(name: string, role: AgentRole): DbResult<Agent>;

  /**
   * Upsert an agent (insert or update)
   * @param agent - Agent object
   * @returns Result containing the upserted agent
   */
  upsertAgent(agent: Agent): DbResult<Agent>;

  /**
   * Get agent by ID
   * @param id - Agent ID
   * @returns Result containing the agent
   */
  getAgent(id: string): DbResult<Agent>;

  /**
   * Query agents with filters
   * @param filter - Query filter object
   * @returns Result containing array of agents
   */
  queryAgents(filter: QueryFilter): DbResult<Agent[]>;

  /**
   * Delete agent by ID
   * @param id - Agent ID
   * @returns Result indicating success
   */
  deleteAgent(id: string): DbResult<string>;

  /**
   * Create a new franchise
   * @param name - Franchise name
   * @param ownerId - Owner agent ID
   * @param location - Franchise location
   * @returns Result containing the created franchise
   */
  createFranchise(name: string, ownerId: string, location: string): DbResult<Franchise>;

  /**
   * Upsert a franchise (insert or update)
   * @param franchise - Franchise object
   * @returns Result containing the upserted franchise
   */
  upsertFranchise(franchise: Franchise): DbResult<Franchise>;

  /**
   * Get franchise by ID
   * @param id - Franchise ID
   * @returns Result containing the franchise
   */
  getFranchise(id: string): DbResult<Franchise>;

  /**
   * Query franchises with filters
   * @param filter - Query filter object
   * @returns Result containing array of franchises
   */
  queryFranchises(filter: QueryFilter): DbResult<Franchise[]>;

  /**
   * Delete franchise by ID
   * @param id - Franchise ID
   * @returns Result indicating success
   */
  deleteFranchise(id: string): DbResult<string>;

  /**
   * Assign agent to franchise
   * @param agentId - Agent ID
   * @param franchiseId - Franchise ID
   * @returns Result indicating success
   */
  assignAgent(agentId: string, franchiseId: string): DbResult<string>;

  /**
   * Unassign agent from franchise
   * @param agentId - Agent ID
   * @returns Result indicating success
   */
  unassignAgent(agentId: string): DbResult<string>;

  /**
   * Get events with optional filtering
   * @param entityId - Optional entity ID to filter by
   * @param limit - Optional limit on number of events
   * @returns Result containing array of events
   */
  getEvents(entityId?: string, limit?: number): DbResult<Event[]>;

  /**
   * Get database statistics
   * @returns Result containing database statistics
   */
  getStats(): DbResult<DbStats>;

  /**
   * Export database as JSON string
   * @returns Result containing JSON string
   */
  export(): DbResult<string>;

  /**
   * Import database from JSON string
   * @param json - JSON string to import
   * @returns Result indicating success
   */
  import(json: string): DbResult<string>;

  /**
   * Clear all data from database
   * @returns Result indicating success
   */
  clear(): DbResult<string>;

  /**
   * Log info message (for debugging)
   * @param message - Message to log
   */
  logInfo(message: string): void;
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number;

/**
 * Get WASM module version
 */
export function version(): string;

/**
 * Initialize WASM module
 */
export function initSync(module: WebAssembly.Module): void;

/**
 * Initialize WASM module (async)
 */
export default function init(input?: string | URL | Request | BufferSource | WebAssembly.Module): Promise<void>;
