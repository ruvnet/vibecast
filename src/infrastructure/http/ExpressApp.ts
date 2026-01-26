import express, { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Logger } from 'pino';
import pinoHttp from 'pino-http';
import { TracingService } from '../telemetry/TracingService';
import { MetricsService } from '../telemetry/MetricsService';

/**
 * HTTP server configuration
 */
export interface HttpConfig {
  port: number;
  host: string;
  maxFileSize: number;
  uploadTimeout: number;
  allowedOrigins: string[];
  logLevel: string;
}

/**
 * Multer configuration for file uploads
 */
export interface MulterConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  dest?: string;
}

/**
 * Express application factory
 */
export class ExpressApp {
  private app: Express;
  private httpLogger;

  constructor(
    private readonly config: HttpConfig,
    private readonly logger: Logger,
    private readonly tracingService: TracingService,
    private readonly metricsService: MetricsService
  ) {
    this.app = express();
    this.httpLogger = pinoHttp({
      logger: this.logger,
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
      },
    });

    this.setupMiddleware();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Request logging middleware
    this.app.use(this.httpLogger);

    // Request correlation ID middleware
    this.app.use(this.correlationIdMiddleware());

    // Trace context propagation middleware
    this.app.use(this.traceContextMiddleware());

    // CORS middleware
    this.app.use(this.corsMiddleware());

    // Body parser for JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', this.healthCheckHandler());

    // Ready check endpoint
    this.app.get('/ready', this.readyCheckHandler());

    // Metrics endpoint (optional, for Prometheus scraping)
    this.app.get('/metrics', this.metricsHandler());
  }

  /**
   * Correlation ID middleware
   * Generates or extracts X-Request-ID header
   */
  private correlationIdMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] || this.generateRequestId();
      req.headers['x-request-id'] = requestId as string;
      res.setHeader('X-Request-ID', requestId);
      next();
    };
  }

  /**
   * Trace context propagation middleware
   * Extracts W3C Trace Context from headers
   */
  private traceContextMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const traceparent = req.headers['traceparent'] as string;
      const traceContext = this.tracingService.extractTraceContext(traceparent);

      if (traceContext) {
        res.setHeader('X-Trace-ID', traceContext.traceId);
        this.logger.debug({ traceContext }, 'Trace context extracted from request');
      }

      next();
    };
  }

  /**
   * CORS middleware
   */
  private corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;

      if (origin && this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, traceparent, X-Idempotency-Key');
        res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Trace-ID');
        res.setHeader('Access-Control-Max-Age', '86400');
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    };
  }

  /**
   * Health check handler
   */
  private healthCheckHandler() {
    return (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        service: 'flowmanager-document-intake',
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Ready check handler
   */
  private readyCheckHandler() {
    return async (req: Request, res: Response) => {
      // TODO: Check database, Redis, blob storage connectivity
      res.status(200).json({
        status: 'ready',
        service: 'flowmanager-document-intake',
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Metrics handler
   */
  private metricsHandler() {
    return (req: Request, res: Response) => {
      const activeUploads = this.metricsService.getActiveUploadsCount();

      res.status(200).json({
        activeUploads,
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Create multer upload middleware
   */
  createUploadMiddleware(multerConfig: MulterConfig): multer.Multer {
    const storage = multer.memoryStorage();

    return multer({
      storage,
      limits: {
        fileSize: multerConfig.maxFileSize,
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (
          multerConfig.allowedMimeTypes.length > 0 &&
          !multerConfig.allowedMimeTypes.includes(file.mimetype)
        ) {
          this.logger.warn({ mimeType: file.mimetype }, 'Invalid MIME type');
          cb(new MulterError('Invalid file type', 'INVALID_MIME_TYPE'));
          return;
        }

        cb(null, true);
      },
    });
  }

  /**
   * Error handling middleware
   */
  useErrorHandler(): void {
    this.app.use(this.errorHandler());
  }

  /**
   * Error handler
   */
  private errorHandler() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      // Get trace context
      const traceContext = this.tracingService.getCurrentTraceContext();

      // Log error
      this.logger.error(
        {
          error: err,
          requestId: req.headers['x-request-id'],
          traceId: traceContext?.traceId,
          method: req.method,
          url: req.url,
        },
        'Request error'
      );

      // Handle specific error types
      if (err instanceof MulterError) {
        return this.handleMulterError(err, res, traceContext);
      }

      if (err.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: err.message,
          traceId: traceContext?.traceId,
        });
      }

      if (err.name === 'DatabaseError') {
        return res.status(503).json({
          error: 'Service Unavailable',
          code: 'DATABASE_ERROR',
          message: 'Database temporarily unavailable',
          traceId: traceContext?.traceId,
        });
      }

      if (err.name === 'StorageError') {
        return res.status(503).json({
          error: 'Service Unavailable',
          code: 'STORAGE_ERROR',
          message: 'Storage service temporarily unavailable',
          traceId: traceContext?.traceId,
        });
      }

      // Default error response
      res.status(500).json({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        traceId: traceContext?.traceId,
      });
    };
  }

  /**
   * Handle Multer-specific errors
   */
  private handleMulterError(
    err: multer.MulterError | MulterError,
    res: Response,
    traceContext: { traceId: string } | null
  ): void {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'Payload Too Large',
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
        traceId: traceContext?.traceId,
      });
      return;
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Bad Request',
        code: 'TOO_MANY_FILES',
        message: 'Only one file can be uploaded at a time',
        traceId: traceContext?.traceId,
      });
      return;
    }

    if (err.message === 'INVALID_MIME_TYPE') {
      res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_FILE_TYPE',
        message: 'File type not allowed',
        traceId: traceContext?.traceId,
      });
      return;
    }

    res.status(400).json({
      error: 'Bad Request',
      code: 'UPLOAD_ERROR',
      message: err.message,
      traceId: traceContext?.traceId,
    });
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    if (this.config.allowedOrigins.includes('*')) {
      return true;
    }

    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(
          {
            port: this.config.port,
            host: this.config.host,
          },
          'HTTP server started'
        );
        resolve();
      });
    });
  }
}

/**
 * Custom Multer error
 */
class MulterError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'MulterError';
  }
}

/**
 * Factory function to create Express app
 */
export function createExpressApp(
  config: HttpConfig,
  logger: Logger,
  tracingService: TracingService,
  metricsService: MetricsService
): ExpressApp {
  return new ExpressApp(config, logger, tracingService, metricsService);
}
