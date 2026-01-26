import {
  trace,
  context,
  Span,
  SpanStatusCode,
  Context,
  Tracer,
  SpanKind,
  Attributes,
} from '@opentelemetry/api';
import { Logger } from 'pino';
import { SPAN_NAMES, DocumentIntakeSpanAttributes } from './OpenTelemetryConfig';

/**
 * Trace context for propagation between services
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
  traceState?: string;
}

/**
 * Span options
 */
export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Partial<DocumentIntakeSpanAttributes>;
}

/**
 * Tracing service for OpenTelemetry span management
 */
export class TracingService {
  private readonly tracer: Tracer;

  constructor(serviceName: string, private readonly logger: Logger) {
    this.tracer = trace.getTracer(serviceName);
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options: SpanOptions = {}): Span {
    const span = this.tracer.startSpan(
      name,
      {
        kind: options.kind || SpanKind.INTERNAL,
        attributes: options.attributes as Attributes,
      },
      context.active()
    );

    this.logger.debug({ spanName: name, spanId: span.spanContext().spanId }, 'Span started');

    return span;
  }

  /**
   * Start document intake span
   */
  startDocumentIntakeSpan(attributes: Partial<DocumentIntakeSpanAttributes>): Span {
    return this.startSpan(SPAN_NAMES.DOCUMENT_INTAKE, {
      kind: SpanKind.SERVER,
      attributes,
    });
  }

  /**
   * Start document validation span
   */
  startValidationSpan(documentId: string, captureRequestId: string): Span {
    return this.startSpan(SPAN_NAMES.DOCUMENT_VALIDATION, {
      attributes: {
        'document.id': documentId,
        'document.capture_request_id': captureRequestId,
      },
    });
  }

  /**
   * Start idempotency check span
   */
  startIdempotencyCheckSpan(captureRequestId: string, idempotencyKey: string): Span {
    return this.startSpan(SPAN_NAMES.IDEMPOTENCY_CHECK, {
      attributes: {
        'document.capture_request_id': captureRequestId,
        'idempotency.key': idempotencyKey,
      },
    });
  }

  /**
   * Start blob upload span
   */
  startBlobUploadSpan(documentId: string, container: string, path: string): Span {
    return this.startSpan(SPAN_NAMES.BLOB_UPLOAD, {
      kind: SpanKind.CLIENT,
      attributes: {
        'document.id': documentId,
        'blob.container': container,
        'blob.path': path,
      },
    });
  }

  /**
   * Start metadata persist span
   */
  startMetadataPersistSpan(documentId: string): Span {
    return this.startSpan(SPAN_NAMES.METADATA_PERSIST, {
      kind: SpanKind.CLIENT,
      attributes: {
        'document.id': documentId,
      },
    });
  }

  /**
   * Start event publish span
   */
  startEventPublishSpan(eventType: string, documentId: string): Span {
    const span = this.startSpan(SPAN_NAMES.EVENT_PUBLISH, {
      kind: SpanKind.PRODUCER,
      attributes: {
        'document.id': documentId,
      },
    });
    span.setAttribute('event.type', eventType);
    return span;
  }

  /**
   * Execute function within a span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: SpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordError(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record error on span
   */
  recordError(span: Span, error: unknown): void {
    const err = error as Error;

    span.recordException(err);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });

    span.setAttributes({
      'error.type': err.name,
      'error.message': err.message,
      'error.stack': err.stack || '',
    });

    this.logger.error(
      {
        spanId: span.spanContext().spanId,
        error: err,
      },
      'Error recorded on span'
    );
  }

  /**
   * Add event to span
   */
  addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.addEvent(name, attributes);
  }

  /**
   * Set span attributes
   */
  setAttributes(span: Span, attributes: Partial<DocumentIntakeSpanAttributes>): void {
    span.setAttributes(attributes as any);
  }

  /**
   * Mark span as successful
   */
  markSuccess(span: Span): void {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  /**
   * Mark span as failed
   */
  markFailed(span: Span, message: string): void {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message,
    });
  }

  /**
   * End span
   */
  endSpan(span: Span): void {
    span.end();
    this.logger.debug({ spanId: span.spanContext().spanId }, 'Span ended');
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): TraceContext | null {
    const span = trace.getSpan(context.active());
    if (!span) {
      return null;
    }

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags.toString(16).padStart(2, '0'),
      traceState: spanContext.traceState?.serialize(),
    };
  }

  /**
   * Extract trace context from headers (W3C Trace Context format)
   */
  extractTraceContext(traceparent?: string): TraceContext | null {
    if (!traceparent) {
      return null;
    }

    // Parse traceparent header: version-traceId-spanId-traceFlags
    const parts = traceparent.split('-');
    if (parts.length !== 4) {
      this.logger.warn({ traceparent }, 'Invalid traceparent header');
      return null;
    }

    const traceId = parts[1];
    const spanId = parts[2];
    const traceFlags = parts[3];

    if (!traceId || !spanId || !traceFlags) {
      this.logger.warn({ traceparent }, 'Invalid traceparent header parts');
      return null;
    }

    return {
      traceId,
      spanId,
      traceFlags,
    };
  }

  /**
   * Format trace context for headers (W3C Trace Context format)
   */
  formatTraceContext(traceContext: TraceContext): string {
    return `00-${traceContext.traceId}-${traceContext.spanId}-${traceContext.traceFlags}`;
  }

  /**
   * Get active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }

  /**
   * Get active context
   */
  getActiveContext(): Context {
    return context.active();
  }

  /**
   * Set active context
   */
  setActiveContext(ctx: Context): Context {
    return context.with(ctx, () => context.active());
  }
}

/**
 * Factory function to create TracingService
 */
export function createTracingService(serviceName: string, logger: Logger): TracingService {
  return new TracingService(serviceName, logger);
}
