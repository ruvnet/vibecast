import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';

/**
 * Request logging middleware
 */
export function createRequestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'];

    // Log request start
    logger.info(
      {
        requestId,
        method: req.method,
        url: req.url,
        headers: sanitizeHeaders(req.headers),
        query: req.query,
      },
      'Request started'
    );

    // Capture response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // Determine log level based on status code
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      logger[level](
        {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          contentLength: res.getHeader('content-length'),
        },
        'Request completed'
      );
    });

    next();
  };
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };

  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
  ];

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Request size logging middleware
 */
export function createRequestSizeLogger(logger: Logger, maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      logger.warn(
        {
          requestId: req.headers['x-request-id'],
          contentLength,
          maxSizeBytes,
        },
        'Request size exceeds maximum'
      );
    }

    next();
  };
}

/**
 * Slow request logging middleware
 */
export function createSlowRequestLogger(logger: Logger, thresholdMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        logger.warn(
          {
            requestId: req.headers['x-request-id'],
            method: req.method,
            url: req.url,
            duration,
            thresholdMs,
          },
          'Slow request detected'
        );
      }
    });

    next();
  };
}
