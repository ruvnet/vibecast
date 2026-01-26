import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { TracedRequest } from './tracingMiddleware';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: any[];
  traceId?: string;
  requestId?: string;
}

/**
 * Conflict error response (409)
 */
export interface ConflictErrorResponse extends ErrorResponse {
  existingDocumentId?: string;
  existingCaptureRequestId?: string;
}

/**
 * Checksum error response (422)
 */
export interface ChecksumErrorResponse extends ErrorResponse {
  expectedChecksum: string;
  actualChecksum: string;
}

/**
 * Custom application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    public existingDocumentId?: string,
    public existingCaptureRequestId?: string
  ) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class ChecksumMismatchError extends AppError {
  constructor(
    public expectedChecksum: string,
    public actualChecksum: string
  ) {
    super(422, 'CHECKSUM_MISMATCH', 'File checksum verification failed');
    this.name = 'ChecksumMismatchError';
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxSize: number) {
    super(413, 'FILE_TOO_LARGE', `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    this.name = 'FileTooLargeError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, public retryAfter?: number) {
    super(503, 'SERVICE_UNAVAILABLE', message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Centralized error handling middleware
 * Converts errors to standardized JSON responses
 * Based on ADR-001 error response schemas
 */
export function errorMiddleware(
  err: Error,
  req: TracedRequest,
  res: Response,
  next: NextFunction
) {
  // Log error (sanitize PII in production)
  console.error('Error processing request:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    requestId: req.requestId,
    traceId: req.traceId,
    path: req.path,
    method: req.method
  });

  // Record error in span if available
  if (req.span) {
    req.span.recordException(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
      })),
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(400).json(errorResponse);
  }

  // Handle ChecksumMismatchError (422)
  if (err instanceof ChecksumMismatchError) {
    const errorResponse: ChecksumErrorResponse = {
      error: 'Unprocessable Entity',
      code: err.code,
      message: err.message,
      expectedChecksum: err.expectedChecksum,
      actualChecksum: err.actualChecksum,
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle ConflictError (409)
  if (err instanceof ConflictError) {
    const errorResponse: ConflictErrorResponse = {
      error: 'Conflict',
      code: err.code,
      message: err.message,
      existingDocumentId: err.existingDocumentId,
      existingCaptureRequestId: err.existingCaptureRequestId,
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle ServiceUnavailableError (503)
  if (err instanceof ServiceUnavailableError) {
    if (err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter.toString());
    }

    const errorResponse: ErrorResponse = {
      error: 'Service Unavailable',
      code: err.code,
      message: err.message,
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: getErrorName(err.statusCode),
      code: err.code,
      message: err.message,
      details: err.details,
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle multer file upload errors
  if (err.name === 'MulterError') {
    const multerErr = err as any;
    let statusCode = 400;
    let code = 'UPLOAD_ERROR';
    let message = 'File upload error';

    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      code = 'FILE_TOO_LARGE';
      message = 'File size exceeds maximum allowed size';
    } else if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
      code = 'UNEXPECTED_FIELD';
      message = 'Unexpected file field in upload';
    }

    const errorResponse: ErrorResponse = {
      error: getErrorName(statusCode),
      code,
      message,
      traceId: req.traceId,
      requestId: req.requestId
    };

    return res.status(statusCode).json(errorResponse);
  }

  // Default to 500 Internal Server Error
  const errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred',
    traceId: req.traceId,
    requestId: req.requestId
  };

  res.status(500).json(errorResponse);
}

/**
 * Get human-readable error name from status code
 */
function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
  };

  return errorNames[statusCode] || 'Error';
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
