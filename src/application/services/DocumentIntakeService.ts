/**
 * Document Intake Service
 *
 * Main orchestration service for document intake process.
 * Coordinates between repositories, storage, and event publishing.
 */

import { DocumentIntakeResult } from '../types/DocumentIntakeResult';
import { DocumentMetadataDto } from '../commands/UploadDocumentCommand';

export interface DocumentIntakeServiceDependencies {
  blobStorageRepository: IBlobStorageRepository;
  documentRepository: IDocumentRepository;
  eventPublisher: IEventPublisher;
  telemetryService: ITelemetryService;
  logger: ILogger;
}

export interface DocumentUploadRequest {
  captureRequestId: string;
  file: Buffer | ReadableStream;
  filePath: string;
  metadata: DocumentMetadataDto;
  checksum: string;
  mimeType: string;
  sizeBytes: number;
}

export class DocumentIntakeService {
  constructor(private readonly deps: DocumentIntakeServiceDependencies) {}

  /**
   * Process incoming document from Capture service
   *
   * Main orchestration flow:
   * 1. Create domain Document aggregate
   * 2. Store file content in blob storage
   * 3. Update document with blob URI
   * 4. Persist document to repository
   * 5. Publish domain events
   *
   * @param request - Document upload request
   * @returns Result of the intake operation
   */
  async processIncomingDocument(
    request: DocumentUploadRequest
  ): Promise<DocumentIntakeResult> {
    const {
      blobStorageRepository,
      documentRepository,
      eventPublisher,
      telemetryService,
      logger,
    } = this.deps;

    return telemetryService.startSpan('document.intake.process', async (span) => {
      const startTime = Date.now();

      try {
        logger.info('Processing incoming document', {
          captureRequestId: request.captureRequestId,
          filePath: request.filePath,
        });

        // Step 1: Create domain document aggregate (to be implemented with domain layer)
        const documentId = this.generateDocumentId();
        const document = this.createDocumentAggregate({
          id: documentId,
          captureRequestId: request.captureRequestId,
          filePath: request.filePath,
          metadata: request.metadata,
          checksum: request.checksum,
          mimeType: request.mimeType,
          sizeBytes: request.sizeBytes,
        });

        span.setAttributes({
          'document.id': documentId,
        });

        // Step 2: Generate blob storage path
        const blobPath = this.generateBlobPath(documentId, request.metadata);

        // Step 3: Store document in blob storage
        const uploadResult = await this.storeInBlobStorage(
          request.file,
          blobPath,
          request
        );

        span.setAttributes({
          'blob.uri': uploadResult.uri,
          'blob.upload_duration_ms': uploadResult.uploadDurationMs,
        });

        // Step 4: Update document with storage information
        document.blobUri = uploadResult.uri;
        document.status = 'STORED';
        document.storedAt = new Date();

        // Step 5: Persist document to repository
        await documentRepository.save(document);

        logger.info('Document persisted to repository', {
          documentId: documentId,
          blobUri: uploadResult.uri,
        });

        // Step 6: Publish domain events
        await this.publishDomainEvents(document);

        const processingDurationMs = Date.now() - startTime;

        span.setAttributes({
          'processing.duration_ms': processingDurationMs,
        });

        // Step 7: Return result
        return {
          documentId: documentId,
          captureRequestId: request.captureRequestId,
          status: 'STORED',
          blobUri: uploadResult.uri,
          receivedAt: document.createdAt.toISOString(),
          storedAt: document.storedAt.toISOString(),
          metadata: request.metadata,
          processingDurationMs,
        };
      } catch (error) {
        logger.error('Document intake processing failed', {
          captureRequestId: request.captureRequestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Publish failure event
        await this.publishFailureEvent(request.captureRequestId, error as Error);

        throw error;
      }
    });
  }

  /**
   * Store document content in blob storage
   */
  private async storeInBlobStorage(
    file: Buffer | ReadableStream,
    blobPath: string,
    request: DocumentUploadRequest
  ): Promise<BlobUploadResult> {
    const { blobStorageRepository, telemetryService } = this.deps;

    return telemetryService.startSpan('blob.storage.upload', async (span) => {
      span.setAttributes({
        'blob.path': blobPath,
        'blob.size_bytes': request.sizeBytes,
      });

      const uploadResult = await blobStorageRepository.store(file, blobPath);

      return uploadResult;
    });
  }

  /**
   * Publish domain events for the document
   */
  private async publishDomainEvents(document: any): Promise<void> {
    const { eventPublisher, telemetryService } = this.deps;

    return telemetryService.startSpan('event.document.publish', async (span) => {
      // Publish DocumentReceivedEvent
      await eventPublisher.publish({
        eventType: 'DocumentReceived',
        eventId: this.generateEventId(),
        occurredAt: new Date().toISOString(),
        documentId: document.id,
        captureRequestId: document.captureRequestId,
        filePath: document.filePath,
        metadata: document.metadata,
      });

      // Publish DocumentStoredEvent
      await eventPublisher.publish({
        eventType: 'DocumentStored',
        eventId: this.generateEventId(),
        occurredAt: new Date().toISOString(),
        documentId: document.id,
        blobUri: document.blobUri,
        storageDurationMs: document.storedAt.getTime() - document.createdAt.getTime(),
      });

      span.setAttributes({
        'events.published': 2,
      });
    });
  }

  /**
   * Publish failure event when intake fails
   */
  private async publishFailureEvent(
    captureRequestId: string,
    error: Error
  ): Promise<void> {
    const { eventPublisher } = this.deps;

    try {
      await eventPublisher.publish({
        eventType: 'DocumentIntakeFailed',
        eventId: this.generateEventId(),
        occurredAt: new Date().toISOString(),
        captureRequestId: captureRequestId,
        failureReason: error.message,
        errorCode: error.name,
      });
    } catch (publishError) {
      // Log but don't throw - failure to publish shouldn't mask original error
      this.deps.logger.error('Failed to publish failure event', {
        captureRequestId,
        error: publishError instanceof Error ? publishError.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate deterministic blob storage path
   */
  private generateBlobPath(documentId: string, metadata: DocumentMetadataDto): string {
    const date = new Date(metadata.captureTimestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const sourceSystem = metadata.sourceSystem;
    const batchId = metadata.batchId || 'no-batch';

    return `${year}/${month}/${day}/${sourceSystem}/${batchId}/${documentId}/content.bin`;
  }

  /**
   * Create document aggregate (placeholder until domain layer is implemented)
   */
  private createDocumentAggregate(params: any): any {
    return {
      id: params.id,
      captureRequestId: params.captureRequestId,
      filePath: params.filePath,
      metadata: params.metadata,
      checksum: params.checksum,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      status: 'RECEIVED',
      createdAt: new Date(),
      updatedAt: new Date(),
      blobUri: null,
      storedAt: null,
    };
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    // UUID v4 generation (in production, use a proper UUID library)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return this.generateDocumentId();
  }
}

// Type definitions

interface IBlobStorageRepository {
  store(content: Buffer | ReadableStream, path: string): Promise<BlobUploadResult>;
}

interface BlobUploadResult {
  uri: string;
  etag: string;
  uploadDurationMs: number;
}

interface IDocumentRepository {
  save(document: any): Promise<void>;
}

interface IEventPublisher {
  publish(event: any): Promise<void>;
}

interface ITelemetryService {
  startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

interface Span {
  setAttributes(attrs: Record<string, any>): void;
}

interface ILogger {
  info(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}
