import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { Logger } from 'pino';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: 'development' | 'staging' | 'production';
  otlpEndpoint: string;
  otlpTracesEndpoint?: string;
  otlpMetricsEndpoint?: string;
  samplingRatio: number;
  logLevel: string;
}

/**
 * Span naming conventions from ADR
 */
export const SPAN_NAMES = {
  DOCUMENT_INTAKE: 'document.intake',
  DOCUMENT_VALIDATION: 'document.validation',
  IDEMPOTENCY_CHECK: 'document.idempotency.check',
  BLOB_UPLOAD: 'blob.storage.upload',
  METADATA_PERSIST: 'document.metadata.persist',
  EVENT_PUBLISH: 'event.document.received.publish',
} as const;

/**
 * Semantic attributes for document intake spans from ADR
 */
export interface DocumentIntakeSpanAttributes {
  // Required attributes
  'document.id': string;
  'document.capture_request_id': string;
  'document.source_system': string;
  'document.type': string;
  'document.size_bytes': number;
  'document.mime_type': string;

  // Idempotency attributes
  'idempotency.key': string;
  'idempotency.cache_hit': boolean;

  // Storage attributes
  'blob.container'?: string;
  'blob.path'?: string;
  'blob.uri'?: string;

  // Processing attributes
  'processing.validation_passed'?: boolean;
  'processing.checksum_verified'?: boolean;

  // Error attributes (when applicable)
  'error.type'?: string;
  'error.code'?: string;
  'error.message'?: string;
}

/**
 * OpenTelemetry SDK configuration and initialization
 */
export class OpenTelemetryConfig {
  private sdk: NodeSDK | null = null;

  constructor(
    private readonly config: TelemetryConfig,
    private readonly logger: Logger
  ) {}

  /**
   * Initialize OpenTelemetry SDK
   */
  initialize(): NodeSDK {
    try {
      // Create resource with service information
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        'service.namespace': 'iip',
        'service.tier': 'intake',
      });

      // Configure OTLP trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: this.config.otlpTracesEndpoint || `${this.config.otlpEndpoint}/v1/traces`,
        headers: {},
      });

      // Configure OTLP metric exporter
      const metricExporter = new OTLPMetricExporter({
        url: this.config.otlpMetricsEndpoint || `${this.config.otlpEndpoint}/v1/metrics`,
        headers: {},
      });

      // Configure metric reader with 60-second collection interval
      const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // 60 seconds
      });

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations: [
          new HttpInstrumentation({
            requestHook: (span, request) => {
              // Add custom attributes to HTTP spans
              span.setAttribute('http.client_ip', request.socket?.remoteAddress || 'unknown');
            },
          }),
          new ExpressInstrumentation({
            requestHook: (span, info) => {
              // Add Express-specific attributes
              span.setAttribute('express.type', info.layerType);
            },
          }),
        ],
      });

      // Start the SDK
      this.sdk.start();

      this.logger.info(
        {
          serviceName: this.config.serviceName,
          serviceVersion: this.config.serviceVersion,
          environment: this.config.environment,
          otlpEndpoint: this.config.otlpEndpoint,
        },
        'OpenTelemetry SDK initialized'
      );

      // Handle graceful shutdown
      process.on('SIGTERM', () => {
        this.shutdown()
          .then(() => {
            this.logger.info('OpenTelemetry SDK shut down successfully');
            process.exit(0);
          })
          .catch((error) => {
            this.logger.error({ error }, 'Error shutting down OpenTelemetry SDK');
            process.exit(1);
          });
      });

      return this.sdk;
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize OpenTelemetry SDK');
      throw new TelemetryError('Failed to initialize OpenTelemetry SDK', { cause: error });
    }
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.sdk = null;
    }
  }

  /**
   * Get SDK instance
   */
  getSDK(): NodeSDK | null {
    return this.sdk;
  }
}

/**
 * Custom error for telemetry operations
 */
export class TelemetryError extends Error {
  public override readonly name = 'TelemetryError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory function to create and initialize OpenTelemetry SDK
 */
export function initializeOpenTelemetry(config: TelemetryConfig, logger: Logger): NodeSDK {
  const otelConfig = new OpenTelemetryConfig(config, logger);
  return otelConfig.initialize();
}

/**
 * Load telemetry configuration from environment
 */
export function loadTelemetryConfig(): TelemetryConfig {
  const env = process.env;
  return {
    serviceName: env['OTEL_SERVICE_NAME'] || 'flowmanager-document-intake',
    serviceVersion: env['OTEL_SERVICE_VERSION'] || '1.0.0',
    environment: (env['NODE_ENV'] as TelemetryConfig['environment']) || 'development',
    otlpEndpoint: env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318',
    otlpTracesEndpoint: env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'],
    otlpMetricsEndpoint: env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'],
    samplingRatio: parseFloat(env['OTEL_SAMPLING_RATIO'] || '1.0'),
    logLevel: env['OTEL_LOG_LEVEL'] || 'info',
  };
}
