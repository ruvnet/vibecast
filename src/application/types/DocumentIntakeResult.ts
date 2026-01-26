/**
 * Document Intake Result
 *
 * Result returned after successful document intake processing.
 */

import { DocumentMetadataDto } from '../commands/UploadDocumentCommand';

export interface DocumentIntakeResult {
  /**
   * Internal document identifier
   */
  documentId: string;

  /**
   * Original capture request ID from Capture service
   */
  captureRequestId: string;

  /**
   * Current document status
   */
  status: DocumentStatus;

  /**
   * URI where document is stored in blob storage
   */
  blobUri: string;

  /**
   * Timestamp when document was received
   */
  receivedAt: string;

  /**
   * Timestamp when document was stored in blob storage
   */
  storedAt: string;

  /**
   * Document metadata
   */
  metadata: DocumentMetadataDto;

  /**
   * Total processing duration in milliseconds
   */
  processingDurationMs: number;

  /**
   * OpenTelemetry trace ID for end-to-end tracing
   */
  traceId?: string;
}

export type DocumentStatus =
  | 'RECEIVED'
  | 'STORED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';
