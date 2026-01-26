import { Router } from 'express';
import multer from 'multer';
import { documentIntakeController } from '../controllers/DocumentIntakeController';
import { documentQueryController } from '../controllers/DocumentQueryController';
import { authMiddleware, requireScope } from '../middleware/authMiddleware';
import { tracingMiddleware } from '../middleware/tracingMiddleware';
import { errorMiddleware, asyncHandler } from '../middleware/errorMiddleware';
import {
  uploadRateLimitMiddleware,
  queryRateLimitMiddleware
} from '../middleware/rateLimitMiddleware';
import { MAX_FILE_SIZE_BYTES } from '../validators/uploadValidator';

/**
 * Configure multer for file uploads
 * Store files in memory buffer for processing
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 100MB max
    files: 1, // Only one file per request
    fields: 10 // Maximum 10 form fields
  },
  fileFilter: (req, file, cb) => {
    // Basic file filter - detailed validation happens in controller
    // Accept all files here, validate MIME type in uploadValidator
    cb(null, true);
  }
});

/**
 * Create document routes router
 * All routes are prefixed with /api/v1/documents
 */
export function createDocumentRoutes(): Router {
  const router = Router();

  // Apply global tracing middleware
  router.use(tracingMiddleware());

  /**
   * POST /api/v1/documents/intake
   * Upload document from Capture service
   *
   * Security:
   * - Requires authentication (Bearer token)
   * - Requires scope: documents:write
   * - Rate limited: 20 uploads per minute per client
   *
   * Request:
   * - Content-Type: multipart/form-data
   * - Fields: captureRequestId, file, filePath, metadata, checksum
   *
   * Response:
   * - 201 Created: Document successfully received and stored
   * - 200 OK: Document already processed (idempotent)
   * - 400 Bad Request: Validation error
   * - 409 Conflict: Duplicate content with different captureRequestId
   * - 413 Payload Too Large: File exceeds size limit
   * - 422 Unprocessable Entity: Checksum mismatch
   * - 503 Service Unavailable: Storage backend issue
   */
  router.post(
    '/intake',
    requireScope('documents:write'), // Require OAuth scope
    uploadRateLimitMiddleware(), // Rate limiting for uploads
    upload.single('file'), // Parse multipart with single file field
    asyncHandler(documentIntakeController.uploadDocument.bind(documentIntakeController))
  );

  /**
   * GET /api/v1/documents/:documentId
   * Get document status and details by document ID
   *
   * Security:
   * - Requires authentication (Bearer token)
   * - Rate limited: 200 queries per minute per client
   *
   * Parameters:
   * - documentId: UUID of the document
   *
   * Response:
   * - 200 OK: Document details
   * - 404 Not Found: Document not found
   */
  router.get(
    '/:documentId',
    authMiddleware(), // Require authentication
    queryRateLimitMiddleware(), // Rate limiting for queries
    asyncHandler(documentQueryController.getDocumentById.bind(documentQueryController))
  );

  /**
   * GET /api/v1/documents/by-capture-request/:captureRequestId
   * Get document by Capture service request ID
   * Useful for checking idempotency status
   *
   * Security:
   * - Requires authentication (Bearer token)
   * - Rate limited: 200 queries per minute per client
   *
   * Parameters:
   * - captureRequestId: UUID from Capture service
   *
   * Response:
   * - 200 OK: Document details
   * - 404 Not Found: No document found for this capture request
   */
  router.get(
    '/by-capture-request/:captureRequestId',
    authMiddleware(), // Require authentication
    queryRateLimitMiddleware(), // Rate limiting for queries
    asyncHandler(documentQueryController.getDocumentByCaptureRequest.bind(documentQueryController))
  );

  // Apply error handling middleware (must be last)
  router.use(errorMiddleware);

  return router;
}

/**
 * Export configured router
 */
export const documentRoutes = createDocumentRoutes();
