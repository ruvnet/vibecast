/**
 * Domain Services - FlowManager Document Intake
 *
 * Services that encapsulate domain logic that doesn't naturally fit
 * within a single entity or value object.
 */

import type { Document, DocumentId } from '../entities/index.js';
import type {
  CaptureRequestId,
  DocumentMetadata,
  FileContent,
  FilePath,
  Checksum,
  ValidationResult,
} from '../value-objects/index.js';

/**
 * Trace context for OpenTelemetry propagation
 */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: string;
  readonly traceState?: string;
}

/**
 * Document upload request from Capture service
 */
export interface DocumentUploadRequest {
  readonly captureRequestId: CaptureRequestId;
  readonly filePath: FilePath;
  readonly content: FileContent;
  readonly metadata: DocumentMetadata;
  readonly providedChecksum?: Checksum;
}

/**
 * Result of document intake processing
 */
export interface DocumentIntakeResult {
  readonly success: boolean;
  readonly document?: Document;
  readonly error?: DocumentIntakeError;
  readonly isIdempotentHit: boolean;
}

/**
 * Document intake error details
 */
export interface DocumentIntakeError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Result of duplicate request check
 */
export type DuplicateCheckResult =
  | { readonly isDuplicate: false }
  | {
      readonly isDuplicate: true;
      readonly existingDocument: Document;
    };

/**
 * Document Intake Service
 *
 * Core domain service for processing incoming documents from Capture service.
 * Orchestrates validation, deduplication, and storage.
 */
export interface DocumentIntakeService {
  /**
   * Process incoming document from Capture service
   * Ensures idempotency via captureRequestId
   */
  processIncomingDocument(
    request: DocumentUploadRequest,
    traceContext: TraceContext
  ): Promise<DocumentIntakeResult>;

  /**
   * Check if document was already processed (idempotency check)
   */
  checkDuplicateRequest(captureRequestId: CaptureRequestId): Promise<DuplicateCheckResult>;
}

/**
 * Document Validation Service
 *
 * Validates document content and metadata against business rules.
 */
export interface DocumentValidationService {
  /**
   * Validate document content
   */
  validateContent(content: FileContent): ValidationResult;

  /**
   * Validate document metadata
   */
  validateMetadata(metadata: DocumentMetadata): ValidationResult;

  /**
   * Validate complete document upload request
   */
  validateRequest(request: DocumentUploadRequest): ValidationResult;

  /**
   * Verify checksum matches content
   */
  verifyChecksum(content: FileContent, providedChecksum: Checksum): boolean;
}

/**
 * Checksum Service
 *
 * Generates and verifies content checksums.
 */
export interface ChecksumService {
  /**
   * Generate SHA-256 checksum for content
   */
  generate(data: Buffer): Checksum;

  /**
   * Verify content matches checksum
   */
  verify(data: Buffer, checksum: Checksum): boolean;
}

/**
 * Document ID Generation Service
 *
 * Generates unique document identifiers.
 */
export interface DocumentIdService {
  /**
   * Generate a new unique document ID
   */
  generate(): DocumentId;

  /**
   * Generate deterministic ID from capture request and content
   */
  generateDeterministic(captureRequestId: CaptureRequestId, checksum: Checksum): DocumentId;
}
