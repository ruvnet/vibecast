import { Request, Response, NextFunction } from 'express';
import { trace, context, propagation, SpanStatusCode, Span } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended Express Request with tracing context
 */
export interface TracedRequest extends Request {
  traceId?: string;
  requestId?: string;
  span?: Span;
}

/**
 * OpenTelemetry tracing middleware
 * Extracts trace context from incoming requests and creates spans
 *
 * Based on ADR-001 OpenTelemetry Implementation section
 */
export function tracingMiddleware() {
  const tracer = trace.getTracer('flowmanager-document-intake', '1.0.0');

  return (req: TracedRequest, res: Response, next: NextFunction) => {
    // Extract trace context from headers (W3C Trace Context propagation)
    const extractedContext = propagation.extract(context.active(), req.headers);

    // Generate or extract request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.requestId = requestId;

    // Start a new span for this request
    const span = tracer.startSpan(
      `HTTP ${req.method} ${req.path}`,
      {
        kind: 1, // SpanKind.SERVER
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.headers['user-agent'] || '',
          'request.id': requestId,
          'service.name': 'flowmanager-document-intake',
          'service.namespace': 'iip',
          'service.tier': 'intake'
        }
      },
      extractedContext
    );

    // Extract trace ID from span context
    const traceId = span.spanContext().traceId;
    req.traceId = traceId;
    req.span = span;

    // Set response headers for trace propagation
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Request-ID', requestId);

    // Intercept response to record span status and end span
    const originalSend = res.send;
    res.send = function(data: any) {
      // Record response status
      span.setAttribute('http.status_code', res.statusCode);

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // End the span
      span.end();

      // Call original send
      return originalSend.call(this, data);
    };

    // Handle errors
    res.on('error', (error: Error) => {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.end();
    });

    // Continue with request in context of this span
    context.with(trace.setSpan(extractedContext, span), () => {
      next();
    });
  };
}

/**
 * Helper to create child span within current context
 * @param name - Span name
 * @param callback - Function to execute within span context
 */
export async function withSpan<T>(
  name: string,
  callback: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const tracer = trace.getTracer('flowmanager-document-intake');
  const span = tracer.startSpan(name, { attributes });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), async () => {
      return await callback(span);
    });

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add custom attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Record event on current span
 */
export function recordSpanEvent(name: string, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Span names as defined in ADR-001
 */
export const SPAN_NAMES = {
  DOCUMENT_INTAKE: 'document.intake',
  DOCUMENT_VALIDATION: 'document.validation',
  IDEMPOTENCY_CHECK: 'document.idempotency.check',
  BLOB_UPLOAD: 'blob.storage.upload',
  METADATA_PERSIST: 'document.metadata.persist',
  EVENT_PUBLISH: 'event.document.received.publish',
  CHECKSUM_VERIFY: 'document.checksum.verify'
} as const;
