/**
 * FlowManager Document Intake API
 * Main exports for API layer
 */

// Routes
export { documentRoutes, createDocumentRoutes } from './routes/documentRoutes';

// Controllers
export { documentIntakeController, DocumentIntakeController } from './controllers/DocumentIntakeController';
export { documentQueryController, DocumentQueryController } from './controllers/DocumentQueryController';

// Middleware
export {
  authMiddleware,
  requireScope,
  optionalAuth,
  AuthenticatedRequest
} from './middleware/authMiddleware';

export {
  tracingMiddleware,
  withSpan,
  addSpanAttributes,
  recordSpanEvent,
  TracedRequest,
  SPAN_NAMES
} from './middleware/tracingMiddleware';

export {
  errorMiddleware,
  asyncHandler,
  AppError,
  ValidationError,
  ConflictError,
  ChecksumMismatchError,
  FileTooLargeError,
  ServiceUnavailableError
} from './middleware/errorMiddleware';

export {
  rateLimitMiddleware,
  uploadRateLimitMiddleware,
  queryRateLimitMiddleware,
  resetRateLimit
} from './middleware/rateLimitMiddleware';

// Validators
export {
  DocumentMetadataSchema,
  DocumentMetadata,
  validateMetadata,
  parseMetadataJson
} from './validators/metadataValidator';

export {
  FileUploadSchema,
  DocumentUploadRequestSchema,
  DocumentUploadRequest,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  validateUploadRequest,
  sanitizeFilePath,
  verifyChecksum,
  calculateChecksum,
  getFileExtension,
  validateFileExtension
} from './validators/uploadValidator';
