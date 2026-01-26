import { Response, NextFunction } from 'express';
import { TracedRequest, withSpan } from '../middleware/tracingMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorMiddleware';

/**
 * Combined request type with auth and tracing
 */
type QueryRequest = AuthenticatedRequest & TracedRequest;

/**
 * Document details response
 */
interface DocumentDetailsResponse {
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
 * Controller for document query endpoints
 * Implements GET /api/v1/documents/{documentId}
 * Implements GET /api/v1/documents/by-capture-request/{captureRequestId}
 * Based on ADR-001 API Specification
 */
export class DocumentQueryController {
  /**
   * Get document by ID
   * GET /api/v1/documents/:documentId
   */
  async getDocumentById(req: QueryRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await withSpan('document.query.by_id', async (span) => {
        const { documentId } = req.params;

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(documentId)) {
          throw new AppError(400, 'INVALID_DOCUMENT_ID', 'Document ID must be a valid UUID');
        }

        span.setAttribute('document.id', documentId);

        // Fetch document from database
        const document = await this.fetchDocumentById(documentId);

        if (!document) {
          throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with ID ${documentId} not found`);
        }

        // Build response
        const response: DocumentDetailsResponse = {
          documentId: document.id,
          captureRequestId: document.captureRequestId,
          status: document.status,
          blobUri: document.blobUri,
          receivedAt: document.receivedAt,
          storedAt: document.storedAt,
          metadata: document.metadata,
          traceId: req.traceId
        };

        res.status(200).json(response);
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get document by Capture service request ID
   * GET /api/v1/documents/by-capture-request/:captureRequestId
   */
  async getDocumentByCaptureRequest(req: QueryRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await withSpan('document.query.by_capture_request', async (span) => {
        const { captureRequestId } = req.params;

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(captureRequestId)) {
          throw new AppError(400, 'INVALID_CAPTURE_REQUEST_ID', 'Capture request ID must be a valid UUID');
        }

        span.setAttribute('document.capture_request_id', captureRequestId);

        // Fetch document from database
        const document = await this.fetchDocumentByCaptureRequestId(captureRequestId);

        if (!document) {
          throw new AppError(
            404,
            'DOCUMENT_NOT_FOUND',
            `No document found for capture request ID ${captureRequestId}`
          );
        }

        // Build response
        const response: DocumentDetailsResponse = {
          documentId: document.id,
          captureRequestId: document.captureRequestId,
          status: document.status,
          blobUri: document.blobUri,
          receivedAt: document.receivedAt,
          storedAt: document.storedAt,
          metadata: document.metadata,
          traceId: req.traceId
        };

        res.status(200).json(response);
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch document from database by ID
   */
  private async fetchDocumentById(documentId: string): Promise<any | null> {
    // TODO: Implement PostgreSQL query
    // For now, return placeholder
    // In production:
    // 1. Query documents table by id
    // 2. Return document record or null if not found
    console.log('Fetching document by ID:', documentId);
    return null;
  }

  /**
   * Fetch document from database by capture request ID
   */
  private async fetchDocumentByCaptureRequestId(captureRequestId: string): Promise<any | null> {
    // TODO: Implement PostgreSQL query
    // For now, return placeholder
    // In production:
    // 1. Query documents table by capture_request_id (indexed)
    // 2. Return document record or null if not found
    console.log('Fetching document by capture request ID:', captureRequestId);
    return null;
  }
}

// Export singleton instance
export const documentQueryController = new DocumentQueryController();
