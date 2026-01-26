/**
 * Application Services - FlowManager Document Intake
 *
 * Application services orchestrate use cases by coordinating
 * domain services, repositories, and infrastructure.
 */

import type {
  IntakeDocumentCommand,
  IntakeDocumentResult,
} from '../commands/index.js';
import type {
  GetDocumentByIdQuery,
  GetDocumentByCaptureRequestIdQuery,
  DocumentViewModel,
  QueryResult,
} from '../queries/index.js';
import type { TraceContext } from '../../domain/index.js';

/**
 * Document Intake Application Service
 *
 * Main entry point for document intake use cases.
 * Coordinates the entire intake workflow.
 */
export interface DocumentIntakeApplicationService {
  /**
   * Process document intake from Capture service
   *
   * Workflow:
   * 1. Check idempotency (return cached if duplicate)
   * 2. Validate content and metadata
   * 3. Store in blob storage
   * 4. Persist document record
   * 5. Publish domain events
   */
  intakeDocument(command: IntakeDocumentCommand): Promise<IntakeDocumentResult>;
}

/**
 * Document Query Application Service
 *
 * Handles document queries and lookups.
 */
export interface DocumentQueryApplicationService {
  /**
   * Get document by internal ID
   */
  getById(query: GetDocumentByIdQuery): Promise<QueryResult<DocumentViewModel>>;

  /**
   * Get document by capture request ID (idempotency check)
   */
  getByCaptureRequestId(
    query: GetDocumentByCaptureRequestIdQuery
  ): Promise<QueryResult<DocumentViewModel>>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks: ReadonlyArray<ComponentHealth>;
  readonly timestamp: string;
}

/**
 * Individual component health
 */
export interface ComponentHealth {
  readonly name: string;
  readonly status: 'healthy' | 'unhealthy';
  readonly latencyMs?: number;
  readonly message?: string;
}

/**
 * Health Check Service
 *
 * Provides system health information.
 */
export interface HealthCheckService {
  /**
   * Check overall system health
   */
  check(): Promise<HealthCheckResult>;

  /**
   * Check specific component health
   */
  checkComponent(name: string): Promise<ComponentHealth>;
}

/**
 * Metrics to track for document intake
 */
export interface DocumentIntakeMetrics {
  /**
   * Record successful document intake
   */
  recordIntakeSuccess(durationMs: number, fileSizeBytes: number): void;

  /**
   * Record failed document intake
   */
  recordIntakeFailure(errorCode: string): void;

  /**
   * Record idempotency cache hit
   */
  recordIdempotencyHit(): void;

  /**
   * Record blob storage duration
   */
  recordStorageDuration(durationMs: number): void;

  /**
   * Increment active uploads counter
   */
  incrementActiveUploads(): void;

  /**
   * Decrement active uploads counter
   */
  decrementActiveUploads(): void;
}

/**
 * Document mapper for converting between domain and view models
 */
export interface DocumentMapper {
  /**
   * Map domain document to view model
   */
  toViewModel(document: unknown): DocumentViewModel;

  /**
   * Map view model to domain (for updates)
   */
  toDomain(viewModel: DocumentViewModel): unknown;
}
