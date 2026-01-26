import { Document, DocumentId } from '../entities/Document';
import { CaptureRequestId } from '../value-objects/CaptureRequestId';

/**
 * Repository interface for Document aggregate persistence.
 *
 * This interface defines the contract for storing and retrieving documents.
 * Implementations should handle database interactions and maintain consistency.
 */
export interface IDocumentRepository {
  /**
   * Finds a document by its unique identifier.
   * @param id - Document ID
   * @returns The document if found, null otherwise
   */
  findById(id: DocumentId): Promise<Document | null>;

  /**
   * Finds a document by its capture request ID (idempotency key).
   * @param captureRequestId - Capture request ID from source system
   * @returns The document if found, null otherwise
   */
  findByCaptureRequestId(captureRequestId: CaptureRequestId): Promise<Document | null>;

  /**
   * Saves a document (insert or update).
   * @param document - Document to save
   * @throws {Error} if save operation fails
   */
  save(document: Document): Promise<void>;

  /**
   * Checks if a document exists with the given capture request ID.
   * Used for efficient idempotency checks.
   * @param captureRequestId - Capture request ID to check
   * @returns true if document exists, false otherwise
   */
  exists(captureRequestId: CaptureRequestId): Promise<boolean>;

  /**
   * Checks for duplicate content by file path and checksum.
   * Used for content-based deduplication.
   * @param filePath - Original file path
   * @param checksumValue - SHA-256 checksum
   * @returns Document with matching content if found, null otherwise
   */
  findByContentHash(filePath: string, checksumValue: string): Promise<Document | null>;

  /**
   * Retrieves documents by batch ID.
   * Useful for batch processing and reporting.
   * @param batchId - Batch identifier
   * @param limit - Maximum number of results
   * @param offset - Result offset for pagination
   * @returns Array of documents in the batch
   */
  findByBatchId(batchId: string, limit?: number, offset?: number): Promise<Document[]>;

  /**
   * Retrieves documents by status.
   * Useful for monitoring and reprocessing.
   * @param status - Document status to filter by
   * @param limit - Maximum number of results
   * @param offset - Result offset for pagination
   * @returns Array of documents with the specified status
   */
  findByStatus(status: string, limit?: number, offset?: number): Promise<Document[]>;

  /**
   * Deletes a document by ID.
   * Note: Should be used carefully as it removes the document permanently.
   * @param id - Document ID to delete
   * @returns true if document was deleted, false if not found
   */
  delete(id: DocumentId): Promise<boolean>;
}
