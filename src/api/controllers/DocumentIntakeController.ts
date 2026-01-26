import { Response, NextFunction } from 'express';
import { TracedRequest, withSpan, SPAN_NAMES, addSpanAttributes } from '../middleware/tracingMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {
  validateUploadRequest,
  verifyChecksum,
  sanitizeFilePath,
  calculateChecksum
} from '../validators/uploadValidator';
import { parseMetadataJson } from '../validators/metadataValidator';
import {
  ValidationError,
  ChecksumMismatchError,
  ConflictError,
  ServiceUnavailableError
} from '../middleware/errorMiddleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Combined request type with auth and tracing
 */
type IntakeRequest = AuthenticatedRequest & TracedRequest;

/**
 * Document intake response structure (ADR-001)
 */
interface DocumentIntakeResponse {
  documentId: string;
  captureRequestId: string;
  status: 'RECEIVED' | 'STORED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  blobUri: string;
  receivedAt: string;
  storedAt?: string;
  metadata: any;
  traceId?: string;
}

/**
 * Controller for document intake endpoint
 * Implements POST /api/v1/documents/intake
 * Based on ADR-001 API Specification
 */
export class DocumentIntakeController {
  /**
   * Handle document upload from Capture service
   * POST /api/v1/documents/intake
   */
  async uploadDocument(req: IntakeRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await withSpan(SPAN_NAMES.DOCUMENT_INTAKE, async (span) => {
        // Extract multipart form data
        const file = req.file;
        if (!file) {
          throw new ValidationError('File is required in multipart upload');
        }

        // Extract form fields
        const captureRequestId = req.body.captureRequestId;
        const filePath = req.body.filePath;
        const metadataJson = req.body.metadata;
        const checksum = req.body.checksum;

        // Parse and validate metadata
        let metadata;
        try {
          metadata = parseMetadataJson(metadataJson);
        } catch (error) {
          throw new ValidationError((error as Error).message);
        }

        // Build request object for validation
        const uploadRequest = {
          captureRequestId,
          filePath: sanitizeFilePath(filePath),
          metadata,
          checksum,
          file: {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer
          }
        };

        // Validate complete request
        const validationResult = validateUploadRequest(uploadRequest);
        if (!validationResult.success) {
          throw new ValidationError('Request validation failed', validationResult.error.errors);
        }

        // Add document attributes to span
        addSpanAttributes({
          'document.capture_request_id': captureRequestId,
          'document.source_system': metadata.sourceSystem,
          'document.type': metadata.documentType,
          'document.size_bytes': file.size,
          'document.mime_type': file.mimetype,
          'idempotency.key': captureRequestId
        });

        // Step 1: Verify checksum
        await withSpan(SPAN_NAMES.CHECKSUM_VERIFY, async () => {
          if (!verifyChecksum(file.buffer, checksum)) {
            const actualChecksum = calculateChecksum(file.buffer);
            throw new ChecksumMismatchError(checksum, actualChecksum);
          }
        });

        // Step 2: Check idempotency (check if document already processed)
        const idempotencyResult = await withSpan(SPAN_NAMES.IDEMPOTENCY_CHECK, async () => {
          return await this.checkIdempotency(captureRequestId, filePath, checksum);
        });

        if (idempotencyResult.found) {
          // Document already processed - return cached response (200 OK)
          addSpanAttributes({ 'idempotency.cache_hit': true });
          res.setHeader('X-Idempotency-Cache-Hit', 'true');
          res.status(200).json(idempotencyResult.response);
          return;
        }

        addSpanAttributes({ 'idempotency.cache_hit': false });

        // Step 3: Generate document ID
        const documentId = uuidv4();
        addSpanAttributes({ 'document.id': documentId });

        // Step 4: Store document in blob storage
        const blobUri = await withSpan(SPAN_NAMES.BLOB_UPLOAD, async () => {
          return await this.uploadToBlob(documentId, file.buffer, metadata);
        });

        addSpanAttributes({
          'blob.uri': blobUri,
          'blob.container': 'document-intake'
        });

        // Step 5: Persist document metadata
        await withSpan(SPAN_NAMES.METADATA_PERSIST, async () => {
          await this.persistMetadata(documentId, captureRequestId, filePath, checksum, metadata, blobUri);
        });

        // Step 6: Publish domain event
        await withSpan(SPAN_NAMES.EVENT_PUBLISH, async () => {
          await this.publishDocumentReceivedEvent(documentId, captureRequestId, metadata, blobUri);
        });

        // Step 7: Store response in idempotency cache
        const receivedAt = new Date().toISOString();
        const response: DocumentIntakeResponse = {
          documentId,
          captureRequestId,
          status: 'STORED',
          blobUri,
          receivedAt,
          storedAt: receivedAt,
          metadata,
          traceId: req.traceId
        };

        await this.storeIdempotencyResponse(captureRequestId, response);

        // Return 201 Created
        res.setHeader('Location', `/api/v1/documents/${documentId}`);
        res.status(201).json(response);
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if document was already processed (idempotency check)
   * Returns cached response if found
   */
  private async checkIdempotency(
    captureRequestId: string,
    filePath: string,
    checksum: string
  ): Promise<{ found: boolean; response?: DocumentIntakeResponse }> {
    // TODO: Implement Redis lookup for idempotency
    // For now, return not found
    // In production:
    // 1. Check Redis for captureRequestId key
    // 2. If found and status is "complete", return cached response
    // 3. If found and status is "in_progress", wait or return 409
    // 4. Check content hash (filePath + checksum) for duplicate content
    // 5. If duplicate content with different captureRequestId, return 409 Conflict

    return { found: false };
  }

  /**
   * Upload document to blob storage
   * Returns blob URI
   */
  private async uploadToBlob(
    documentId: string,
    fileBuffer: Buffer,
    metadata: any
  ): Promise<string> {
    // TODO: Implement Azure Blob Storage upload
    // For now, return placeholder URI
    // In production:
    // 1. Generate blob path: /{year}/{month}/{day}/{source-system}/{batch-id}/{document-id}/
    // 2. Upload file buffer to Azure Blob Storage
    // 3. Set blob metadata (captureRequestId, sourceSystem, documentType, uploadTimestamp)
    // 4. Return blob URI

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const sourceSystem = metadata.sourceSystem || 'UNKNOWN';
    const batchId = metadata.batchId || 'NOBATCH';

    const blobPath = `${year}/${month}/${day}/${sourceSystem}/${batchId}/${documentId}/content.bin`;
    const blobUri = `https://iipflowmanagerprod.blob.core.windows.net/document-intake/${blobPath}`;

    return blobUri;
  }

  /**
   * Persist document metadata to database
   */
  private async persistMetadata(
    documentId: string,
    captureRequestId: string,
    filePath: string,
    checksum: string,
    metadata: any,
    blobUri: string
  ): Promise<void> {
    // TODO: Implement PostgreSQL insert
    // For now, placeholder
    // In production:
    // 1. Insert into documents table with UNIQUE constraint on capture_request_id
    // 2. Handle race conditions with ON CONFLICT
    // 3. Store in document_events_outbox for reliable event publishing
    console.log('Persisting metadata:', {
      documentId,
      captureRequestId,
      filePath,
      checksum,
      metadata,
      blobUri
    });
  }

  /**
   * Publish DocumentReceived domain event
   */
  private async publishDocumentReceivedEvent(
    documentId: string,
    captureRequestId: string,
    metadata: any,
    blobUri: string
  ): Promise<void> {
    // TODO: Implement event publishing (e.g., to Azure Service Bus, Event Grid, or Kafka)
    // For now, placeholder
    // In production:
    // 1. Create DocumentReceivedEvent with trace context
    // 2. Publish to event bus
    // 3. Downstream services subscribe to process document
    console.log('Publishing DocumentReceivedEvent:', {
      documentId,
      captureRequestId,
      metadata,
      blobUri
    });
  }

  /**
   * Store response in idempotency cache (Redis)
   */
  private async storeIdempotencyResponse(
    captureRequestId: string,
    response: DocumentIntakeResponse
  ): Promise<void> {
    // TODO: Implement Redis storage with TTL (24 hours)
    // For now, placeholder
    // In production:
    // 1. Store response in Redis with key: idempotency:{captureRequestId}
    // 2. Set TTL to 24 hours
    // 3. Store content hash for duplicate detection
    console.log('Storing idempotency response:', {
      captureRequestId,
      response
    });
  }
}

// Export singleton instance
export const documentIntakeController = new DocumentIntakeController();
