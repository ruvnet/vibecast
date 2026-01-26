import { EventId, TraceContext } from './DocumentReceivedEvent';
import { DocumentId } from '../entities/Document';
import { CaptureRequestId } from '../value-objects/CaptureRequestId';

/**
 * Error codes for document intake failures.
 */
export enum IntakeErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  STORAGE_FAILED = 'STORAGE_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  DUPLICATE_CONTENT = 'DUPLICATE_CONTENT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Failure reason with details.
 */
export interface FailureDetails {
  code: IntakeErrorCode;
  message: string;
  retryable: boolean;
  technicalDetails?: Record<string, unknown>;
}

/**
 * Domain Event: Document Intake Failed
 *
 * Published when document intake fails at any stage.
 * This event triggers error handling workflows and alerts.
 */
export class DocumentIntakeFailedEvent {
  private readonly _eventId: EventId;
  private readonly _occurredAt: Date;
  private readonly _documentId?: DocumentId;
  private readonly _captureRequestId: CaptureRequestId;
  private readonly _failureReason: FailureDetails;
  private readonly _traceContext: TraceContext;

  private constructor(params: {
    eventId: EventId;
    occurredAt: Date;
    documentId: DocumentId | undefined;
    captureRequestId: CaptureRequestId;
    failureReason: FailureDetails;
    traceContext: TraceContext;
  }) {
    this._eventId = params.eventId;
    this._occurredAt = params.occurredAt;
    this._documentId = params.documentId;
    this._captureRequestId = params.captureRequestId;
    this._failureReason = params.failureReason;
    this._traceContext = params.traceContext;
  }

  /**
   * Creates a new DocumentIntakeFailedEvent.
   */
  static create(params: {
    documentId?: DocumentId;
    captureRequestId: CaptureRequestId;
    failureReason: FailureDetails;
    traceContext: TraceContext;
  }): DocumentIntakeFailedEvent {
    if (!params.failureReason) {
      throw new Error('failureReason is required');
    }

    if (!params.failureReason.code || !params.failureReason.message) {
      throw new Error('failureReason must contain code and message');
    }

    return new DocumentIntakeFailedEvent({
      eventId: EventId.create(),
      occurredAt: new Date(),
      documentId: params.documentId,
      captureRequestId: params.captureRequestId,
      failureReason: params.failureReason,
      traceContext: params.traceContext,
    });
  }

  // Getters

  get eventId(): EventId {
    return this._eventId;
  }

  get eventType(): string {
    return 'DocumentIntakeFailed';
  }

  get occurredAt(): Date {
    return new Date(this._occurredAt);
  }

  get documentId(): DocumentId | undefined {
    return this._documentId;
  }

  get captureRequestId(): CaptureRequestId {
    return this._captureRequestId;
  }

  get failureReason(): FailureDetails {
    return { ...this._failureReason };
  }

  get errorCode(): IntakeErrorCode {
    return this._failureReason.code;
  }

  get traceContext(): TraceContext {
    return { ...this._traceContext };
  }

  /**
   * Checks if the failure is retryable.
   */
  isRetryable(): boolean {
    return this._failureReason.retryable;
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    eventId: string;
    eventType: string;
    occurredAt: string;
    documentId?: string;
    captureRequestId: string;
    failureReason: FailureDetails;
    traceContext: TraceContext;
  } {
    return {
      eventId: this._eventId.value,
      eventType: this.eventType,
      occurredAt: this._occurredAt.toISOString(),
      documentId: this._documentId?.value,
      captureRequestId: this._captureRequestId.value,
      failureReason: this._failureReason,
      traceContext: this._traceContext,
    };
  }
}
