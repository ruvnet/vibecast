import { createClient, RedisClientType } from 'redis';
import { Logger } from 'pino';
import { createHash } from 'crypto';

/**
 * Document intake response for caching
 */
export interface DocumentIntakeResponse {
  documentId: string;
  captureRequestId: string;
  status: string;
  blobUri: string;
  receivedAt: string;
  storedAt?: string;
  metadata: Record<string, unknown>;
  traceId?: string;
}

/**
 * Idempotency record stored in Redis
 */
export interface IdempotencyRecord {
  captureRequestId: string;
  contentHash: string;
  documentId: string;
  response: DocumentIntakeResponse;
  createdAt: string;
  expiresAt: string;
}

/**
 * Idempotency check result
 */
export type IdempotencyCheckResult =
  | { found: false }
  | { found: true; cached: true; response: DocumentIntakeResponse }
  | { found: true; inProgress: true };

/**
 * Content duplicate check result
 */
export type ContentDuplicateResult =
  | { isDuplicate: false }
  | {
      isDuplicate: true;
      existingDocumentId: string;
      existingCaptureRequestId: string;
    };

/**
 * Idempotency service configuration
 */
export interface IdempotencyConfig {
  redisUrl: string;
  ttlHours: number;
  lockTimeoutMs: number;
  maxRetries: number;
}

/**
 * Idempotency service interface implementing 3-layer strategy from ADR:
 * Layer 1: Request Idempotency Key (captureRequestId)
 * Layer 2: Content-Based Deduplication (SHA-256 hash)
 * Layer 3: Database Constraints (handled by repository)
 */
export interface IIdempotencyService {
  checkAndGet(captureRequestId: string): Promise<IdempotencyCheckResult>;
  store(
    captureRequestId: string,
    contentHash: string,
    response: DocumentIntakeResponse
  ): Promise<void>;
  checkContentDuplicate(filePath: string, checksum: string): Promise<ContentDuplicateResult>;
  acquireLock(captureRequestId: string, ttlMs: number): Promise<boolean>;
  releaseLock(captureRequestId: string): Promise<void>;
  markInProgress(captureRequestId: string): Promise<void>;
}

/**
 * Redis-based idempotency service implementation
 * Implements distributed locking with double-check pattern (DCCP)
 */
export class IdempotencyService implements IIdempotencyService {
  private readonly redis: RedisClientType;
  private readonly ttlSeconds: number;

  constructor(
    private readonly config: IdempotencyConfig,
    private readonly logger: Logger
  ) {
    this.redis = createClient({
      url: config.redisUrl,
    }) as RedisClientType;

    this.ttlSeconds = config.ttlHours * 3600;

    // Handle Redis connection events
    this.redis.on('error', (err) => {
      this.logger.error({ error: err }, 'Redis connection error');
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis client connected');
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis client ready');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  /**
   * Check if request was already processed (Layer 1: Request Idempotency)
   * Returns cached response if found
   */
  async checkAndGet(captureRequestId: string): Promise<IdempotencyCheckResult> {
    try {
      const key = this.getIdempotencyKey(captureRequestId);
      const data = await this.redis.get(key);

      if (!data) {
        return { found: false };
      }

      const record: IdempotencyRecord = JSON.parse(data);

      // Check if request is in progress
      if (record.response.status === 'IN_PROGRESS') {
        this.logger.info({ captureRequestId }, 'Request in progress');
        return { found: true, inProgress: true };
      }

      this.logger.info({ captureRequestId }, 'Idempotency cache hit');
      return {
        found: true,
        cached: true,
        response: record.response,
      };
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error checking idempotency');
      throw new IdempotencyError('Failed to check idempotency', { cause: error });
    }
  }

  /**
   * Store response for future idempotent requests (Layer 1)
   */
  async store(
    captureRequestId: string,
    contentHash: string,
    response: DocumentIntakeResponse
  ): Promise<void> {
    try {
      const key = this.getIdempotencyKey(captureRequestId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

      const record: IdempotencyRecord = {
        captureRequestId,
        contentHash,
        documentId: response.documentId,
        response,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await this.redis.setEx(key, this.ttlSeconds, JSON.stringify(record));

      // Also store content hash mapping for Layer 2
      await this.storeContentHashMapping(contentHash, captureRequestId, response.documentId);

      this.logger.info(
        { captureRequestId, contentHash, ttl: this.ttlSeconds },
        'Idempotency record stored'
      );
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error storing idempotency record');
      throw new IdempotencyError('Failed to store idempotency record', { cause: error });
    }
  }

  /**
   * Check for content-based duplicates (Layer 2: Content Deduplication)
   * Prevents same document with different captureRequestIds
   */
  async checkContentDuplicate(filePath: string, checksum: string): Promise<ContentDuplicateResult> {
    try {
      const contentHash = this.generateContentHash(filePath, checksum);
      const key = this.getContentHashKey(contentHash);
      const data = await this.redis.get(key);

      if (!data) {
        return { isDuplicate: false };
      }

      const mapping = JSON.parse(data);

      this.logger.warn(
        {
          filePath,
          checksum,
          existingCaptureRequestId: mapping.captureRequestId,
        },
        'Content duplicate detected'
      );

      return {
        isDuplicate: true,
        existingDocumentId: mapping.documentId,
        existingCaptureRequestId: mapping.captureRequestId,
      };
    } catch (error) {
      this.logger.error({ error, filePath }, 'Error checking content duplicate');
      throw new IdempotencyError('Failed to check content duplicate', { cause: error });
    }
  }

  /**
   * Acquire distributed lock using Redis SET NX
   * Implements distributed locking pattern from ADR
   */
  async acquireLock(captureRequestId: string, ttlMs: number): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(captureRequestId);
      const lockValue = this.generateLockValue();
      const ttlSeconds = Math.ceil(ttlMs / 1000);

      // SET NX (set if not exists) with expiry
      const result = await this.redis.set(lockKey, lockValue, {
        NX: true,
        EX: ttlSeconds,
      });

      const acquired = result === 'OK';

      if (acquired) {
        this.logger.debug({ captureRequestId, ttlMs }, 'Lock acquired');
      } else {
        this.logger.debug({ captureRequestId }, 'Lock acquisition failed');
      }

      return acquired;
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error acquiring lock');
      throw new IdempotencyError('Failed to acquire lock', { cause: error });
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(captureRequestId: string): Promise<void> {
    try {
      const lockKey = this.getLockKey(captureRequestId);
      await this.redis.del(lockKey);

      this.logger.debug({ captureRequestId }, 'Lock released');
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error releasing lock');
      // Don't throw - lock will expire naturally
    }
  }

  /**
   * Mark request as in progress
   * Used in double-check pattern after acquiring lock
   */
  async markInProgress(captureRequestId: string): Promise<void> {
    try {
      const key = this.getIdempotencyKey(captureRequestId);
      const now = new Date();

      const record: Partial<IdempotencyRecord> = {
        captureRequestId,
        response: {
          documentId: '',
          captureRequestId,
          status: 'IN_PROGRESS',
          blobUri: '',
          receivedAt: now.toISOString(),
          metadata: {},
        },
        createdAt: now.toISOString(),
      };

      // Store with shorter TTL (request timeout)
      await this.redis.setEx(key, 300, JSON.stringify(record)); // 5 minutes

      this.logger.debug({ captureRequestId }, 'Request marked as in progress');
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error marking request in progress');
      throw new IdempotencyError('Failed to mark request in progress', { cause: error });
    }
  }

  /**
   * Generate content hash for Layer 2 deduplication
   * SHA-256(filePath + checksum)
   */
  private generateContentHash(filePath: string, checksum: string): string {
    return createHash('sha256')
      .update(filePath)
      .update(checksum)
      .digest('hex');
  }

  /**
   * Store content hash mapping for duplicate detection
   */
  private async storeContentHashMapping(
    contentHash: string,
    captureRequestId: string,
    documentId: string
  ): Promise<void> {
    const key = this.getContentHashKey(contentHash);
    const mapping = {
      contentHash,
      captureRequestId,
      documentId,
      createdAt: new Date().toISOString(),
    };

    await this.redis.setEx(key, this.ttlSeconds, JSON.stringify(mapping));
  }

  /**
   * Generate lock value with timestamp
   */
  private generateLockValue(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Redis key generators
   */
  private getIdempotencyKey(captureRequestId: string): string {
    return `idempotency:request:${captureRequestId}`;
  }

  private getContentHashKey(contentHash: string): string {
    return `idempotency:content:${contentHash}`;
  }

  private getLockKey(captureRequestId: string): string {
    return `idempotency:lock:${captureRequestId}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }
}

/**
 * Custom error for idempotency operations
 */
export class IdempotencyError extends Error {
  public override readonly name = 'IdempotencyError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory function to create IdempotencyService
 */
export function createIdempotencyService(
  config: IdempotencyConfig,
  logger: Logger
): IIdempotencyService {
  return new IdempotencyService(config, logger);
}
