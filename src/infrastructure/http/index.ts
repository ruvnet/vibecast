/**
 * HTTP Infrastructure - FlowManager Document Intake
 *
 * HTTP client and server utilities for API communication.
 */

import type { TraceContext } from '../../domain/index.js';

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  readonly port: number;
  readonly host: string;
  readonly trustProxy: boolean;
  readonly bodyLimit: string;
  readonly uploadLimit: string;
  readonly requestTimeoutMs: number;
  readonly keepAliveTimeoutMs: number;
}

/**
 * HTTP request context
 */
export interface RequestContext {
  readonly requestId: string;
  readonly traceContext: TraceContext | null;
  readonly clientIp: string;
  readonly userAgent: string;
  readonly startTime: number;
}

/**
 * Standard HTTP headers
 */
export const HttpHeaders = {
  REQUEST_ID: 'X-Request-ID',
  TRACE_ID: 'X-Trace-ID',
  IDEMPOTENCY_KEY: 'X-Idempotency-Key',
  IDEMPOTENCY_CACHE_HIT: 'X-Idempotency-Cache-Hit',
  TRACE_PARENT: 'traceparent',
  TRACE_STATE: 'tracestate',
  RETRY_AFTER: 'Retry-After',
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
} as const;

/**
 * Standard HTTP status codes used in the API
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly message: string;
  readonly details?: ReadonlyArray<ApiErrorDetail>;
  readonly traceId?: string;
}

/**
 * API error detail
 */
export interface ApiErrorDetail {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Conflict error response (for 409)
 */
export interface ConflictErrorResponse extends ApiErrorResponse {
  readonly existingDocumentId: string;
  readonly existingCaptureRequestId: string;
}

/**
 * Checksum error response (for 422)
 */
export interface ChecksumErrorResponse extends ApiErrorResponse {
  readonly expectedChecksum: string;
  readonly actualChecksum: string;
}

/**
 * HTTP error factory
 */
export interface HttpErrorFactory {
  badRequest(message: string, details?: ApiErrorDetail[]): ApiError;
  unauthorized(message: string): ApiError;
  forbidden(message: string): ApiError;
  notFound(message: string): ApiError;
  conflict(message: string, existingDocumentId: string, existingCaptureRequestId: string): ApiError;
  payloadTooLarge(message: string, maxSize: string): ApiError;
  checksumMismatch(expected: string, actual: string): ApiError;
  tooManyRequests(retryAfterSeconds: number): ApiError;
  internalError(message: string): ApiError;
  serviceUnavailable(message: string, retryAfterSeconds: number): ApiError;
}

/**
 * API error class
 */
export interface ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ReadonlyArray<ApiErrorDetail>;
  readonly retryAfter?: number;

  toResponse(traceId?: string): ApiErrorResponse;
}

/**
 * Multipart file upload
 */
export interface UploadedFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly encoding: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

/**
 * Multipart form data
 */
export interface MultipartFormData {
  readonly file?: UploadedFile;
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * HTTP client interface for outbound requests
 */
export interface HttpClient {
  /**
   * Make GET request
   */
  get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /**
   * Make POST request
   */
  post<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /**
   * Make PUT request
   */
  put<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /**
   * Make DELETE request
   */
  delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly traceContext?: TraceContext;
}

/**
 * HTTP response
 */
export interface HttpResponse<T> {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly data: T;
}

/**
 * Factory for creating HTTP components
 */
export interface HttpFactory {
  createHttpClient(baseUrl?: string): HttpClient;
  createErrorFactory(): HttpErrorFactory;
}
