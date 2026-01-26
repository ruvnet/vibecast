import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';

/**
 * Custom application error
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApplicationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: unknown;
  traceId?: string;
  timestamp: string;
}

/**
 * Create error handling middleware
 */
export function createErrorHandler(logger: Logger) {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Extract request context
    const requestId = req.headers['x-request-id'];
    const traceId = res.getHeader('X-Trace-ID') as string;

    // Log error with context
    logger.error(
      {
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
        request: {
          id: requestId,
          method: req.method,
          url: req.url,
          headers: sanitizeHeaders(req.headers),
        },
        traceId,
      },
      'Request error'
    );

    // Build error response
    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      traceId,
      timestamp: new Date().toISOString(),
    };

    let statusCode = 500;

    // Handle specific error types
    if (err instanceof ApplicationError) {
      statusCode = err.statusCode;
      errorResponse.error = getErrorNameFromStatusCode(statusCode);
      errorResponse.code = err.code;
      errorResponse.message = err.message;
      errorResponse.details = err.details;
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      errorResponse.error = 'Bad Request';
      errorResponse.code = 'VALIDATION_ERROR';
      errorResponse.message = err.message;
    } else if (err.name === 'UnauthorizedError') {
      statusCode = 401;
      errorResponse.error = 'Unauthorized';
      errorResponse.code = 'UNAUTHORIZED';
      errorResponse.message = 'Authentication required';
    } else if (err.name === 'ForbiddenError') {
      statusCode = 403;
      errorResponse.error = 'Forbidden';
      errorResponse.code = 'FORBIDDEN';
      errorResponse.message = 'Access denied';
    } else if (err.name === 'NotFoundError') {
      statusCode = 404;
      errorResponse.error = 'Not Found';
      errorResponse.code = 'NOT_FOUND';
      errorResponse.message = err.message;
    } else if (err.name === 'ConflictError') {
      statusCode = 409;
      errorResponse.error = 'Conflict';
      errorResponse.code = 'CONFLICT';
      errorResponse.message = err.message;
    } else if (err.name === 'DatabaseError') {
      statusCode = 503;
      errorResponse.error = 'Service Unavailable';
      errorResponse.code = 'DATABASE_ERROR';
      errorResponse.message = 'Database temporarily unavailable';
    } else if (err.name === 'StorageError') {
      statusCode = 503;
      errorResponse.error = 'Service Unavailable';
      errorResponse.code = 'STORAGE_ERROR';
      errorResponse.message = 'Storage service temporarily unavailable';
    } else if (err.name === 'IdempotencyError') {
      statusCode = 503;
      errorResponse.error = 'Service Unavailable';
      errorResponse.code = 'IDEMPOTENCY_ERROR';
      errorResponse.message = 'Idempotency service temporarily unavailable';
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Get error name from status code
 */
function getErrorNameFromStatusCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 413:
      return 'Payload Too Large';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Internal Server Error';
    case 503:
      return 'Service Unavailable';
    default:
      return 'Error';
  }
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...headers };

  // Remove sensitive headers
  delete sanitized['authorization'];
  delete sanitized['cookie'];
  delete sanitized['x-api-key'];

  return sanitized;
}

/**
 * Not found error handler
 */
export function notFoundHandler(req: Request, res: Response) {
  const traceId = res.getHeader('X-Trace-ID') as string;

  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.url} not found`,
    traceId,
    timestamp: new Date().toISOString(),
  });
}
