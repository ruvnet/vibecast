import { metrics, Counter, Histogram, ObservableGauge, ValueType } from '@opentelemetry/api';
import { Logger } from 'pino';

/**
 * Document intake metrics from ADR
 */
export interface DocumentIntakeMetrics {
  // Counters
  totalDocuments: Counter;
  documentsByStatus: Counter;
  idempotencyCacheHits: Counter;
  validationFailures: Counter;
  checksumMismatches: Counter;

  // Histograms
  documentSizeBytes: Histogram;
  intakeDurationMs: Histogram;
  uploadDurationMs: Histogram;
  validationDurationMs: Histogram;

  // Gauges (observable)
  activeUploads: ObservableGauge;
}

/**
 * Metric labels (compatible with OpenTelemetry Attributes)
 */
export interface MetricLabels {
  [key: string]: string | number | boolean | undefined;
  status?: string;
  documentType?: string;
  sourceSystem?: string;
  errorType?: string;
  mimeType?: string;
}

/**
 * Metrics service for custom OpenTelemetry metrics
 */
export class MetricsService {
  private readonly meter;
  private readonly metrics: DocumentIntakeMetrics;
  private activeUploadsCount = 0;

  constructor(
    serviceName: string,
    private readonly logger: Logger
  ) {
    this.meter = metrics.getMeter(serviceName);
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize all metrics
   */
  private initializeMetrics(): DocumentIntakeMetrics {
    // Counter: Total documents received
    const totalDocuments = this.meter.createCounter('document.intake.total', {
      description: 'Total number of documents received',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Counter: Documents by status
    const documentsByStatus = this.meter.createCounter('document.intake.by_status', {
      description: 'Number of documents by processing status',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Counter: Idempotent request hits
    const idempotencyCacheHits = this.meter.createCounter('document.idempotency.cache_hits', {
      description: 'Number of idempotent cache hits',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Counter: Validation failures
    const validationFailures = this.meter.createCounter('document.validation.failures', {
      description: 'Number of validation failures',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Counter: Checksum mismatches
    const checksumMismatches = this.meter.createCounter('document.checksum.mismatches', {
      description: 'Number of checksum verification failures',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Histogram: Document size distribution
    const documentSizeBytes = this.meter.createHistogram('document.size.bytes', {
      description: 'Distribution of document sizes',
      unit: 'By',
      valueType: ValueType.DOUBLE,
    });

    // Histogram: Intake processing duration
    const intakeDurationMs = this.meter.createHistogram('document.intake.duration_ms', {
      description: 'Time taken to process document intake',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });

    // Histogram: Upload duration
    const uploadDurationMs = this.meter.createHistogram('document.upload.duration_ms', {
      description: 'Time taken to upload document to blob storage',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });

    // Histogram: Validation duration
    const validationDurationMs = this.meter.createHistogram('document.validation.duration_ms', {
      description: 'Time taken to validate document',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });

    // Gauge: Active uploads
    const activeUploads = this.meter.createObservableGauge('document.uploads.active', {
      description: 'Number of currently active document uploads',
      unit: '1',
      valueType: ValueType.INT,
    });

    activeUploads.addCallback((observableResult) => {
      observableResult.observe(this.activeUploadsCount);
    });

    return {
      totalDocuments,
      documentsByStatus,
      idempotencyCacheHits,
      validationFailures,
      checksumMismatches,
      documentSizeBytes,
      intakeDurationMs,
      uploadDurationMs,
      validationDurationMs,
      activeUploads,
    };
  }

  /**
   * Record document received
   */
  recordDocumentReceived(labels: MetricLabels = {}): void {
    this.metrics.totalDocuments.add(1, labels);
    this.logger.debug({ labels }, 'Metric: document received');
  }

  /**
   * Record document by status
   */
  recordDocumentStatus(status: string, labels: MetricLabels = {}): void {
    this.metrics.documentsByStatus.add(1, { ...labels, status });
    this.logger.debug({ status, labels }, 'Metric: document status');
  }

  /**
   * Record idempotency cache hit
   */
  recordIdempotencyCacheHit(cacheHit: boolean, labels: MetricLabels = {}): void {
    if (cacheHit) {
      this.metrics.idempotencyCacheHits.add(1, labels);
      this.logger.debug({ labels }, 'Metric: idempotency cache hit');
    }
  }

  /**
   * Record validation failure
   */
  recordValidationFailure(errorType: string, labels: MetricLabels = {}): void {
    this.metrics.validationFailures.add(1, { ...labels, errorType });
    this.logger.debug({ errorType, labels }, 'Metric: validation failure');
  }

  /**
   * Record checksum mismatch
   */
  recordChecksumMismatch(labels: MetricLabels = {}): void {
    this.metrics.checksumMismatches.add(1, labels);
    this.logger.debug({ labels }, 'Metric: checksum mismatch');
  }

  /**
   * Record document size
   */
  recordDocumentSize(sizeBytes: number, labels: MetricLabels = {}): void {
    this.metrics.documentSizeBytes.record(sizeBytes, labels);
    this.logger.debug({ sizeBytes, labels }, 'Metric: document size');
  }

  /**
   * Record intake duration
   */
  recordIntakeDuration(durationMs: number, labels: MetricLabels = {}): void {
    this.metrics.intakeDurationMs.record(durationMs, labels);
    this.logger.debug({ durationMs, labels }, 'Metric: intake duration');
  }

  /**
   * Record upload duration
   */
  recordUploadDuration(durationMs: number, labels: MetricLabels = {}): void {
    this.metrics.uploadDurationMs.record(durationMs, labels);
    this.logger.debug({ durationMs, labels }, 'Metric: upload duration');
  }

  /**
   * Record validation duration
   */
  recordValidationDuration(durationMs: number, labels: MetricLabels = {}): void {
    this.metrics.validationDurationMs.record(durationMs, labels);
    this.logger.debug({ durationMs, labels }, 'Metric: validation duration');
  }

  /**
   * Increment active uploads
   */
  incrementActiveUploads(): void {
    this.activeUploadsCount++;
    this.logger.debug({ count: this.activeUploadsCount }, 'Metric: active uploads incremented');
  }

  /**
   * Decrement active uploads
   */
  decrementActiveUploads(): void {
    this.activeUploadsCount = Math.max(0, this.activeUploadsCount - 1);
    this.logger.debug({ count: this.activeUploadsCount }, 'Metric: active uploads decremented');
  }

  /**
   * Get current active uploads count
   */
  getActiveUploadsCount(): number {
    return this.activeUploadsCount;
  }

  /**
   * Reset active uploads count (for testing)
   */
  resetActiveUploadsCount(): void {
    this.activeUploadsCount = 0;
  }
}

/**
 * Factory function to create MetricsService
 */
export function createMetricsService(serviceName: string, logger: Logger): MetricsService {
  return new MetricsService(serviceName, logger);
}
