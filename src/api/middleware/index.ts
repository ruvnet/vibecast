/**
 * API Middleware - FlowManager Document Intake
 *
 * Express middleware for request processing, authentication, and error handling.
 */

import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import type { TraceContext } from '../../domain/index.js';

/**
 * Extended Express Request with custom properties
 */
export interface ExtendedRequest extends Request {
  /**
   * Unique request identifier
   */
  requestId: string;

  /**
   * OpenTelemetry trace context
   */
  traceContext: TraceContext | null;

  /**
   * Request start time for duration tracking
   */
  startTime: number;

  /**
   * Authenticated client ID (from JWT)
   */
  clientId?: string;

  /**
   * Client scopes (from JWT)
   */
  scopes?: string[];
}

/**
 * Request ID middleware
 *
 * Extracts or generates request ID for correlation.
 */
export interface RequestIdMiddleware {
  (): RequestHandler;
}

/**
 * Trace context middleware
 *
 * Extracts OpenTelemetry trace context from headers.
 */
export interface TraceContextMiddleware {
  (): RequestHandler;
}

/**
 * Authentication middleware
 *
 * Validates JWT tokens and extracts client information.
 */
export interface AuthenticationMiddleware {
  (): RequestHandler;
}

/**
 * Authorization middleware
 *
 * Checks required scopes for access control.
 */
export interface AuthorizationMiddleware {
  (requiredScopes: string[]): RequestHandler;
}

/**
 * Rate limiting middleware
 *
 * Limits request rate per client.
 */
export interface RateLimitMiddleware {
  (options: RateLimitOptions): RequestHandler;
}

/**
 * Rate limit options
 */
export interface RateLimitOptions {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly keyGenerator?: (req: Request) => string;
  readonly skipFailedRequests?: boolean;
}

/**
 * File upload middleware
 *
 * Handles multipart/form-data uploads.
 */
export interface FileUploadMiddleware {
  (options: FileUploadOptions): RequestHandler;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  readonly maxFileSize: number;
  readonly allowedMimeTypes: string[];
  readonly fieldName: string;
}

/**
 * Request validation middleware
 *
 * Validates request body against schema.
 */
export interface RequestValidationMiddleware {
  <T>(schema: ValidationSchema<T>): RequestHandler;
}

/**
 * Validation schema interface
 */
export interface ValidationSchema<T> {
  parse(data: unknown): T;
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: ValidationError };
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly issues: ReadonlyArray<{
    readonly path: ReadonlyArray<string | number>;
    readonly message: string;
    readonly code: string;
  }>;
}

/**
 * Error handling middleware
 *
 * Global error handler for consistent error responses.
 */
export interface ErrorHandlerMiddleware {
  (): ErrorRequestHandler;
}

/**
 * Not found middleware
 *
 * Handles 404 for unmatched routes.
 */
export interface NotFoundMiddleware {
  (): RequestHandler;
}

/**
 * Request logging middleware
 *
 * Logs request details for debugging.
 */
export interface RequestLoggingMiddleware {
  (): RequestHandler;
}

/**
 * Response time middleware
 *
 * Adds X-Response-Time header.
 */
export interface ResponseTimeMiddleware {
  (): RequestHandler;
}

/**
 * Security headers middleware
 *
 * Adds security headers (via helmet).
 */
export interface SecurityHeadersMiddleware {
  (options?: SecurityHeaderOptions): RequestHandler;
}

/**
 * Security header options
 */
export interface SecurityHeaderOptions {
  readonly contentSecurityPolicy?: boolean;
  readonly crossOriginEmbedderPolicy?: boolean;
  readonly crossOriginOpenerPolicy?: boolean;
  readonly crossOriginResourcePolicy?: boolean;
  readonly dnsPrefetchControl?: boolean;
  readonly frameguard?: boolean;
  readonly hidePoweredBy?: boolean;
  readonly hsts?: boolean;
  readonly ieNoOpen?: boolean;
  readonly noSniff?: boolean;
  readonly referrerPolicy?: boolean;
  readonly xssFilter?: boolean;
}

/**
 * CORS middleware
 *
 * Handles Cross-Origin Resource Sharing.
 */
export interface CorsMiddleware {
  (options?: CorsOptions): RequestHandler;
}

/**
 * CORS options
 */
export interface CorsOptions {
  readonly origin?: string | string[] | boolean;
  readonly methods?: string[];
  readonly allowedHeaders?: string[];
  readonly exposedHeaders?: string[];
  readonly credentials?: boolean;
  readonly maxAge?: number;
}

/**
 * Middleware factory
 */
export interface MiddlewareFactory {
  createRequestIdMiddleware(): RequestIdMiddleware;
  createTraceContextMiddleware(): TraceContextMiddleware;
  createAuthenticationMiddleware(): AuthenticationMiddleware;
  createAuthorizationMiddleware(): AuthorizationMiddleware;
  createRateLimitMiddleware(): RateLimitMiddleware;
  createFileUploadMiddleware(): FileUploadMiddleware;
  createRequestValidationMiddleware(): RequestValidationMiddleware;
  createErrorHandlerMiddleware(): ErrorHandlerMiddleware;
  createNotFoundMiddleware(): NotFoundMiddleware;
  createRequestLoggingMiddleware(): RequestLoggingMiddleware;
  createResponseTimeMiddleware(): ResponseTimeMiddleware;
  createSecurityHeadersMiddleware(): SecurityHeadersMiddleware;
  createCorsMiddleware(): CorsMiddleware;
}
