/**
 * Persistence Infrastructure - FlowManager Document Intake
 *
 * Database implementations for domain repository interfaces.
 * Uses PostgreSQL for document metadata storage.
 */

import type { IDocumentRepository } from '../../domain/index.js';

// Alias for backwards compatibility
type DocumentRepository = IDocumentRepository;

// UnitOfWork pattern interface
interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly poolSize: number;
  readonly connectionTimeoutMs: number;
}

/**
 * Database connection pool
 */
export interface DatabasePool {
  /**
   * Execute a query
   */
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Get a client from the pool for transactions
   */
  getClient(): Promise<DatabaseClient>;

  /**
   * Close the pool
   */
  close(): Promise<void>;

  /**
   * Check pool health
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Database client for transactions
 */
export interface DatabaseClient {
  /**
   * Execute a query within transaction
   */
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Begin transaction
   */
  begin(): Promise<void>;

  /**
   * Commit transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;

  /**
   * Release client back to pool
   */
  release(): void;
}

/**
 * Query result from database
 */
export interface QueryResult<T> {
  readonly rows: T[];
  readonly rowCount: number;
}

/**
 * Document database row
 */
export interface DocumentRow {
  readonly id: string;
  readonly capture_request_id: string;
  readonly file_path: string;
  readonly content_hash: string;
  readonly blob_uri: string;
  readonly status: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * PostgreSQL Document Repository Implementation
 */
export interface PostgresDocumentRepository extends DocumentRepository {
  /**
   * Initialize database schema
   */
  initializeSchema(): Promise<void>;
}

/**
 * PostgreSQL Unit of Work Implementation
 */
export interface PostgresUnitOfWork extends UnitOfWork {
  /**
   * Get the underlying database client
   */
  readonly client: DatabaseClient;
}

/**
 * Document Events Outbox for reliable event publishing
 */
export interface DocumentEventsOutbox {
  /**
   * Add event to outbox
   */
  add(documentId: string, eventType: string, payload: unknown, traceContext?: unknown): Promise<void>;

  /**
   * Get unpublished events
   */
  getUnpublished(limit: number): Promise<OutboxEvent[]>;

  /**
   * Mark event as published
   */
  markPublished(eventId: string): Promise<void>;
}

/**
 * Outbox event record
 */
export interface OutboxEvent {
  readonly id: string;
  readonly documentId: string;
  readonly eventType: string;
  readonly eventPayload: unknown;
  readonly traceContext?: unknown;
  readonly createdAt: Date;
}

/**
 * Factory for creating persistence components
 */
export interface PersistenceFactory {
  createPool(config: DatabaseConfig): DatabasePool;
  createDocumentRepository(pool: DatabasePool): PostgresDocumentRepository;
  createUnitOfWork(pool: DatabasePool): Promise<PostgresUnitOfWork>;
  createEventsOutbox(pool: DatabasePool): DocumentEventsOutbox;
}
