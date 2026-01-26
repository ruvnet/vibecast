/**
 * Telemetry Infrastructure - FlowManager Document Intake
 *
 * OpenTelemetry implementation for distributed tracing and metrics.
 */

import type { TraceContext } from '../../domain/index.js';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: 'development' | 'staging' | 'production';
  readonly otlpEndpoint: string;
  readonly samplingRatio: number;
  readonly metricsIntervalMs: number;
  readonly enabled: boolean;
}

/**
 * Span attribute names for document intake
 */
export const SpanAttributes = {
  DOCUMENT_ID: 'document.id',
  CAPTURE_REQUEST_ID: 'document.capture_request_id',
  SOURCE_SYSTEM: 'document.source_system',
  DOCUMENT_TYPE: 'document.type',
  FILE_SIZE_BYTES: 'document.size_bytes',
  MIME_TYPE: 'document.mime_type',
  IDEMPOTENCY_KEY: 'idempotency.key',
  IDEMPOTENCY_CACHE_HIT: 'idempotency.cache_hit',
  BLOB_CONTAINER: 'blob.container',
  BLOB_PATH: 'blob.path',
  BLOB_URI: 'blob.uri',
  VALIDATION_PASSED: 'processing.validation_passed',
  CHECKSUM_VERIFIED: 'processing.checksum_verified',
  ERROR_TYPE: 'error.type',
  ERROR_CODE: 'error.code',
  ERROR_MESSAGE: 'error.message',
} as const;

/**
 * Span names for document intake operations
 */
export const SpanNames = {
  DOCUMENT_INTAKE: 'document.intake',
  DOCUMENT_VALIDATION: 'document.validation',
  IDEMPOTENCY_CHECK: 'document.idempotency.check',
  BLOB_UPLOAD: 'blob.storage.upload',
  METADATA_PERSIST: 'document.metadata.persist',
  EVENT_PUBLISH: 'event.document.received.publish',
} as const;

/**
 * Metric names for document intake
 */
export const MetricNames = {
  INTAKE_TOTAL: 'document.intake.total',
  INTAKE_BY_STATUS: 'document.intake.by_status',
  DOCUMENT_SIZE_BYTES: 'document.size.bytes',
  INTAKE_DURATION_MS: 'document.intake.duration_ms',
  IDEMPOTENCY_CACHE_HITS: 'document.idempotency.cache_hits',
  UPLOADS_ACTIVE: 'document.uploads.active',
  STORAGE_DURATION_MS: 'document.storage.duration_ms',
} as const;

/**
 * Span interface for tracing
 */
export interface Span {
  /**
   * Set attribute on span
   */
  setAttribute(key: string, value: string | number | boolean): void;

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void;

  /**
   * Record exception on span
   */
  recordException(error: Error): void;

  /**
   * Set span status
   */
  setStatus(status: SpanStatus): void;

  /**
   * Add event to span
   */
  addEvent(name: string, attributes?: Record<string, unknown>): void;

  /**
   * End the span
   */
  end(): void;

  /**
   * Get span context for propagation
   */
  getContext(): TraceContext;
}

/**
 * Span status
 */
export interface SpanStatus {
  readonly code: 'OK' | 'ERROR' | 'UNSET';
  readonly message?: string;
}

/**
 * Tracer interface for creating spans
 */
export interface Tracer {
  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span;

  /**
   * Start span as child of given context
   */
  startSpanWithContext(name: string, context: TraceContext, options?: SpanOptions): Span;

  /**
   * Execute function within span
   */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: SpanOptions): Promise<T>;

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string | string[] | undefined>): TraceContext | null;

  /**
   * Inject trace context into headers
   */
  injectContext(context: TraceContext, headers: Record<string, string>): void;
}

/**
 * Span options
 */
export interface SpanOptions {
  readonly kind?: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  readonly attributes?: Record<string, string | number | boolean>;
}

/**
 * Metrics interface
 */
export interface Metrics {
  /**
   * Create or get counter
   */
  counter(name: string, description?: string): Counter;

  /**
   * Create or get histogram
   */
  histogram(name: string, description?: string): Histogram;

  /**
   * Create or get gauge
   */
  gauge(name: string, description?: string): Gauge;
}

/**
 * Counter metric
 */
export interface Counter {
  add(value: number, labels?: Record<string, string>): void;
}

/**
 * Histogram metric
 */
export interface Histogram {
  record(value: number, labels?: Record<string, string>): void;
}

/**
 * Gauge metric
 */
export interface Gauge {
  set(value: number, labels?: Record<string, string>): void;
}

/**
 * Telemetry service interface
 */
export interface TelemetryService {
  /**
   * Get tracer for creating spans
   */
  readonly tracer: Tracer;

  /**
   * Get metrics for recording measurements
   */
  readonly metrics: Metrics;

  /**
   * Initialize telemetry
   */
  initialize(): Promise<void>;

  /**
   * Shutdown telemetry (flush pending data)
   */
  shutdown(): Promise<void>;
}

/**
 * Factory for creating telemetry components
 */
export interface TelemetryFactory {
  createTelemetryService(config: TelemetryConfig): TelemetryService;
}
