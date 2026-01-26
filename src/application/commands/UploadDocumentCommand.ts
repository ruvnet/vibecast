/**
 * Upload Document Command
 *
 * Command object representing a document upload request from the IIP Capture service.
 * This is an immutable data structure following CQRS principles.
 */

export interface UploadDocumentCommand {
  /**
   * Unique identifier from Capture service (idempotency key)
   */
  readonly captureRequestId: string;

  /**
   * The actual file content
   */
  readonly file: Buffer | ReadableStream;

  /**
   * Original file path from source system
   */
  readonly filePath: string;

  /**
   * Document metadata as JSON
   */
  readonly metadata: DocumentMetadataDto;

  /**
   * SHA-256 checksum for integrity verification
   */
  readonly checksum: string;

  /**
   * MIME type of the file
   */
  readonly mimeType: string;

  /**
   * File size in bytes
   */
  readonly sizeBytes: number;

  /**
   * Optional request correlation ID for tracing
   */
  readonly requestId?: string;

  /**
   * OpenTelemetry trace context
   */
  readonly traceContext?: Record<string, string>;
}

export interface DocumentMetadataDto {
  /**
   * Timestamp when document was captured
   */
  readonly captureTimestamp: string;

  /**
   * Source system identifier
   */
  readonly sourceSystem: string;

  /**
   * Type of document (e.g., INVOICE, PURCHASE_ORDER)
   */
  readonly documentType: string;

  /**
   * Optional batch identifier
   */
  readonly batchId?: string;

  /**
   * Custom fields for extensibility
   */
  readonly customFields?: Record<string, unknown>;
}

/**
 * Factory for creating upload document commands
 */
export class UploadDocumentCommandFactory {
  static create(params: {
    captureRequestId: string;
    file: Buffer | ReadableStream;
    filePath: string;
    metadata: DocumentMetadataDto;
    checksum: string;
    mimeType: string;
    sizeBytes: number;
    requestId?: string;
    traceContext?: Record<string, string>;
  }): UploadDocumentCommand {
    return {
      captureRequestId: params.captureRequestId,
      file: params.file,
      filePath: params.filePath,
      metadata: params.metadata,
      checksum: params.checksum,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      requestId: params.requestId,
      traceContext: params.traceContext,
    };
  }
}
