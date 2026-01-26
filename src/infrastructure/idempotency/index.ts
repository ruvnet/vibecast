/**
 * Idempotency Infrastructure - FlowManager Document Intake
 *
 * Redis-based idempotency service for preventing duplicate processing.
 */

import type { CaptureRequestId, DocumentId } from '../../domain/index.js';
import type { DocumentViewModel } from '../../application/queries/index.js';

/**
 * Redis configuration
 */
export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly db: number;
  readonly tls: boolean;
  readonly keyPrefix: string;
  readonly connectionTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly maxRetries: number;
}

/**
 * Idempotency record stored in Redis
 */
export interface IdempotencyRecord {
  readonly captureRequestId: string;
  readonly contentHash: string;
  readonly documentId: string;
  readonly status: 'in_progress' | 'completed' | 'failed';
  readonly response?: DocumentViewModel;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * Result of idempotency check
 */
export type IdempotencyCheckResult =
  | { readonly found: false }
  | { readonly found: true; readonly cached: true; readonly response: DocumentViewModel }
  | { readonly found: true; readonly inProgress: true };

/**
 * Result of content duplicate check
 */
export type ContentDuplicateResult =
  | { readonly isDuplicate: false }
  | {
      readonly isDuplicate: true;
      readonly existingDocumentId: DocumentId;
      readonly existingCaptureRequestId: CaptureRequestId;
    };

/**
 * Distributed lock interface
 */
export interface DistributedLock {
  /**
   * Unique lock identifier
   */
  readonly id: string;

  /**
   * Release the lock
   */
  release(): Promise<void>;

  /**
   * Extend lock TTL
   */
  extend(ttlMs: number): Promise<boolean>;

  /**
   * Check if lock is still held
   */
  isHeld(): Promise<boolean>;
}

/**
 * Idempotency Service Interface
 *
 * Provides multi-layer idempotency checking and caching.
 */
export interface IdempotencyService {
  /**
   * Check if request was already processed
   * Returns cached response if found
   */
  checkAndGet(captureRequestId: CaptureRequestId): Promise<IdempotencyCheckResult>;

  /**
   * Acquire distributed lock for processing
   * Prevents concurrent processing of same request
   */
  acquireLock(captureRequestId: CaptureRequestId, ttlMs: number): Promise<DistributedLock | null>;

  /**
   * Mark request as in progress
   */
  markInProgress(captureRequestId: CaptureRequestId, contentHash: string, ttlMs: number): Promise<void>;

  /**
   * Store completed response for future idempotent requests
   */
  storeCompleted(
    captureRequestId: CaptureRequestId,
    contentHash: string,
    documentId: DocumentId,
    response: DocumentViewModel,
    ttlMs: number
  ): Promise<void>;

  /**
   * Mark request as failed
   */
  markFailed(captureRequestId: CaptureRequestId, ttlMs: number): Promise<void>;

  /**
   * Check for content-based duplicates
   */
  checkContentDuplicate(contentHash: string): Promise<ContentDuplicateResult>;

  /**
   * Store content hash mapping for deduplication
   */
  storeContentHash(
    contentHash: string,
    documentId: DocumentId,
    captureRequestId: CaptureRequestId,
    ttlMs: number
  ): Promise<void>;

  /**
   * Delete idempotency record (for cleanup)
   */
  delete(captureRequestId: CaptureRequestId): Promise<void>;

  /**
   * Check service health
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Redis client interface
 */
export interface RedisClient {
  /**
   * Get value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Set value with optional TTL
   */
  set(key: string, value: string, ttlMs?: number): Promise<void>;

  /**
   * Set value only if key doesn't exist (for locking)
   */
  setNX(key: string, value: string, ttlMs: number): Promise<boolean>;

  /**
   * Delete key
   */
  del(key: string): Promise<void>;

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set TTL on existing key
   */
  expire(key: string, ttlMs: number): Promise<boolean>;

  /**
   * Execute Lua script (for atomic operations)
   */
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;

  /**
   * Ping for health check
   */
  ping(): Promise<boolean>;

  /**
   * Close connection
   */
  close(): Promise<void>;
}

/**
 * Factory for creating idempotency components
 */
export interface IdempotencyFactory {
  createRedisClient(config: RedisConfig): RedisClient;
  createIdempotencyService(client: RedisClient, keyPrefix: string): IdempotencyService;
}

/**
 * Default TTL values
 */
export const IdempotencyTTL = {
  /** TTL for completed requests (24 hours) */
  COMPLETED_MS: 24 * 60 * 60 * 1000,
  /** TTL for in-progress requests (5 minutes) */
  IN_PROGRESS_MS: 5 * 60 * 1000,
  /** TTL for failed requests (1 hour) */
  FAILED_MS: 60 * 60 * 1000,
  /** TTL for distributed lock (30 seconds) */
  LOCK_MS: 30 * 1000,
  /** TTL for content hash mapping (7 days) */
  CONTENT_HASH_MS: 7 * 24 * 60 * 60 * 1000,
} as const;
