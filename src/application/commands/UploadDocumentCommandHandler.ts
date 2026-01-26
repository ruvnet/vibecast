/**
 * Upload Document Command Handler
 *
 * Handles the document upload flow:
 * 1. Check idempotency (prevent duplicate processing)
 * 2. Validate document content and metadata
 * 3. Store document in blob storage
 * 4. Persist document record in database
 * 5. Publish domain events
 * 6. Return response
 */

import { UploadDocumentCommand } from './UploadDocumentCommand';
import { DocumentIntakeResult } from '../types/DocumentIntakeResult';

/**
 * Dependencies required by the command handler (injected)
 */
export interface UploadDocumentCommandHandlerDependencies {
  // Domain services
  documentIntakeService: IDocumentIntakeService;
  documentValidationService: IDocumentValidationService;

  // Infrastructure services
  idempotencyService: IIdempotencyService;
  blobStorageRepository: IBlobStorageRepository;
  documentRepository: IDocumentRepository;
  eventPublisher: IEventPublisher;

  // Observability
  telemetryService: ITelemetryService;
  logger: ILogger;
}

export class UploadDocumentCommandHandler {
  constructor(private readonly deps: UploadDocumentCommandHandlerDependencies) {}

  /**
   * Execute the upload document command
   *
   * @param command - The upload document command
   * @returns Result of the document intake operation
   */
  async execute(command: UploadDocumentCommand): Promise<DocumentIntakeResult> {
    const { telemetryService, logger } = this.deps;

    // Start root span for document intake
    return telemetryService.startSpan('document.intake', async (span) => {
      try {
        // Add span attributes
        span.setAttributes({
          'document.capture_request_id': command.captureRequestId,
          'document.source_system': command.metadata.sourceSystem,
          'document.type': command.metadata.documentType,
          'document.size_bytes': command.sizeBytes,
          'document.mime_type': command.mimeType,
        });

        logger.info('Starting document intake', {
          captureRequestId: command.captureRequestId,
          filePath: command.filePath,
          sourceSystem: command.metadata.sourceSystem,
        });

        // Step 1: Check idempotency
        const idempotencyResult = await this.checkIdempotency(command);
        if (idempotencyResult.found) {
          logger.info('Idempotent request detected, returning cached response', {
            captureRequestId: command.captureRequestId,
          });

          span.setAttributes({
            'idempotency.cache_hit': true,
          });

          return idempotencyResult.response!;
        }

        span.setAttributes({
          'idempotency.cache_hit': false,
        });

        // Step 2: Validate document content and metadata
        await this.validateDocument(command);

        // Step 3: Process the document through domain service
        const result = await this.processDocument(command);

        // Step 4: Store idempotency record
        await this.storeIdempotencyRecord(command, result);

        logger.info('Document intake completed successfully', {
          documentId: result.documentId,
          captureRequestId: command.captureRequestId,
        });

        span.setAttributes({
          'document.id': result.documentId,
          'processing.success': true,
        });

        return result;

      } catch (error) {
        logger.error('Document intake failed', {
          captureRequestId: command.captureRequestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        span.setAttributes({
          'processing.success': false,
          'error.type': error instanceof Error ? error.constructor.name : 'Unknown',
          'error.message': error instanceof Error ? error.message : 'Unknown error',
        });

        span.recordException(error as Error);
        throw error;
      }
    });
  }

  /**
   * Check if this request has already been processed (idempotency)
   */
  private async checkIdempotency(
    command: UploadDocumentCommand
  ): Promise<IdempotencyCheckResult> {
    const { idempotencyService, telemetryService } = this.deps;

    return telemetryService.startSpan('document.idempotency.check', async (span) => {
      span.setAttributes({
        'idempotency.key': command.captureRequestId,
      });

      const result = await idempotencyService.checkAndGet(command.captureRequestId);

      // Also check for content-based duplicates
      if (!result.found) {
        const contentDuplicate = await idempotencyService.checkContentDuplicate(
          command.filePath,
          command.checksum
        );

        if (contentDuplicate.isDuplicate && contentDuplicate.existingDocumentId && contentDuplicate.existingCaptureRequestId) {
          throw new ConflictError(
            'Document with same content but different captureRequestId exists',
            contentDuplicate.existingDocumentId,
            contentDuplicate.existingCaptureRequestId
          );
        }
      }

      return result;
    });
  }

  /**
   * Validate document content and metadata
   */
  private async validateDocument(command: UploadDocumentCommand): Promise<void> {
    const { documentValidationService, telemetryService } = this.deps;

    return telemetryService.startSpan('document.validation', async (span) => {
      // Validate file content
      const contentValidation = documentValidationService.validateContent({
        data: command.file,
        mimeType: command.mimeType,
        sizeBytes: command.sizeBytes,
        checksum: command.checksum,
      });

      if (!contentValidation.isValid) {
        span.setAttributes({
          'processing.validation_passed': false,
          'validation.error': contentValidation.errors.join(', '),
        });
        throw new ValidationError('Content validation failed', contentValidation.errors);
      }

      // Validate metadata
      const metadataValidation = documentValidationService.validateMetadata(
        command.metadata
      );

      if (!metadataValidation.isValid) {
        span.setAttributes({
          'processing.validation_passed': false,
          'validation.error': metadataValidation.errors.join(', '),
        });
        throw new ValidationError('Metadata validation failed', metadataValidation.errors);
      }

      // Verify checksum
      const checksumValid = await documentValidationService.verifyChecksum(
        command.file,
        command.checksum
      );

      if (!checksumValid) {
        span.setAttributes({
          'processing.checksum_verified': false,
        });
        throw new ChecksumMismatchError(
          'File checksum verification failed',
          command.checksum
        );
      }

      span.setAttributes({
        'processing.validation_passed': true,
        'processing.checksum_verified': true,
      });
    });
  }

  /**
   * Process the document through the domain service
   */
  private async processDocument(
    command: UploadDocumentCommand
  ): Promise<DocumentIntakeResult> {
    const { documentIntakeService } = this.deps;

    return documentIntakeService.processIncomingDocument({
      captureRequestId: command.captureRequestId,
      file: command.file,
      filePath: command.filePath,
      metadata: command.metadata,
      checksum: command.checksum,
      mimeType: command.mimeType,
      sizeBytes: command.sizeBytes,
    });
  }

  /**
   * Store idempotency record for future duplicate requests
   */
  private async storeIdempotencyRecord(
    command: UploadDocumentCommand,
    result: DocumentIntakeResult
  ): Promise<void> {
    const { idempotencyService } = this.deps;

    const contentHash = `${command.filePath}:${command.checksum}`;
    const ttlHours = 24; // 24 hour TTL for idempotency cache

    await idempotencyService.store(
      command.captureRequestId,
      contentHash,
      result,
      ttlHours * 60 * 60 * 1000 // Convert to milliseconds
    );
  }
}

// ============================================================================
// Type definitions for dependencies (interfaces to be implemented by domain/infra layers)
// ============================================================================

interface IDocumentIntakeService {
  processIncomingDocument(request: {
    captureRequestId: string;
    file: Buffer | ReadableStream;
    filePath: string;
    metadata: any;
    checksum: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DocumentIntakeResult>;
}

interface IDocumentValidationService {
  validateContent(content: {
    data: Buffer | ReadableStream;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
  }): ValidationResult;

  validateMetadata(metadata: any): ValidationResult;

  verifyChecksum(data: Buffer | ReadableStream, expectedChecksum: string): Promise<boolean>;
}

interface IIdempotencyService {
  checkAndGet(captureRequestId: string): Promise<IdempotencyCheckResult>;
  checkContentDuplicate(filePath: string, checksum: string): Promise<ContentDuplicateResult>;
  store(
    captureRequestId: string,
    contentHash: string,
    response: DocumentIntakeResult,
    ttlMs: number
  ): Promise<void>;
}

interface IBlobStorageRepository {
  store(content: Buffer | ReadableStream, path: string): Promise<BlobUploadResult>;
  exists(path: string): Promise<boolean>;
}

interface IDocumentRepository {
  save(document: any): Promise<void>;
  findByCaptureRequestId(captureRequestId: string): Promise<any | null>;
}

interface IEventPublisher {
  publish(event: any): Promise<void>;
}

interface ITelemetryService {
  startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

interface Span {
  setAttributes(attrs: Record<string, any>): void;
  recordException(error: Error): void;
}

interface ILogger {
  info(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
}

// Result types

interface IdempotencyCheckResult {
  found: boolean;
  response?: DocumentIntakeResult;
  inProgress?: boolean;
}

interface ContentDuplicateResult {
  isDuplicate: boolean;
  existingDocumentId?: string;
  existingCaptureRequestId?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface BlobUploadResult {
  uri: string;
  etag: string;
  uploadDurationMs: number;
}

// Custom errors

export class ValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ChecksumMismatchError extends Error {
  constructor(message: string, public readonly expectedChecksum: string) {
    super(message);
    this.name = 'ChecksumMismatchError';
  }
}

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly existingDocumentId: string,
    public readonly existingCaptureRequestId: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}
