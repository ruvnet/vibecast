/**
 * Document DTO
 *
 * Data Transfer Object for document query responses.
 */

import { DocumentMetadataDto } from '../commands/UploadDocumentCommand';
import { DocumentStatus } from './DocumentIntakeResult';

export interface DocumentDto {
  /**
   * Internal document identifier
   */
  documentId: string;

  /**
   * Original capture request ID from Capture service
   */
  captureRequestId: string;

  /**
   * Original file path from source system
   */
  filePath: string;

  /**
   * URI where document is stored in blob storage
   */
  blobUri: string;

  /**
   * Current document status
   */
  status: DocumentStatus;

  /**
   * Document metadata
   */
  metadata: DocumentMetadataDto;

  /**
   * Timestamp when document was created
   */
  createdAt: string;

  /**
   * Timestamp when document was last updated
   */
  updatedAt: string;

  /**
   * SHA-256 checksum of file content
   */
  checksum: string;
}
