import { v4 as uuidv4 } from 'uuid';
import { DocumentId } from '../entities/Document';
import { CaptureRequestId } from '../value-objects/CaptureRequestId';
import { FilePath } from '../value-objects/FilePath';
import { DocumentMetadata } from '../value-objects/DocumentMetadata';
import { Checksum } from '../value-objects/Checksum';

/**
 * Event ID value object for domain events.
 */
export class EventId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(): EventId {
    return new EventId(uuidv4());
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * OpenTelemetry trace context for event correlation.
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

/**
 * Domain Event: Document Received
 *
 * Published when a document is successfully received from the Capture service.
 * This event triggers downstream processing workflows.
 */
export class DocumentReceivedEvent {
  private readonly _eventId: EventId;
  private readonly _occurredAt: Date;
  private readonly _documentId: DocumentId;
  private readonly _captureRequestId: CaptureRequestId;
  private readonly _filePath: FilePath;
  private readonly _metadata: DocumentMetadata;
  private readonly _checksum: Checksum;
  private readonly _traceContext: TraceContext;

  private constructor(params: {
    eventId: EventId;
    occurredAt: Date;
    documentId: DocumentId;
    captureRequestId: CaptureRequestId;
    filePath: FilePath;
    metadata: DocumentMetadata;
    checksum: Checksum;
    traceContext: TraceContext;
  }) {
    this._eventId = params.eventId;
    this._occurredAt = params.occurredAt;
    this._documentId = params.documentId;
    this._captureRequestId = params.captureRequestId;
    this._filePath = params.filePath;
    this._metadata = params.metadata;
    this._checksum = params.checksum;
    this._traceContext = params.traceContext;
  }

  /**
   * Creates a new DocumentReceivedEvent.
   */
  static create(params: {
    documentId: DocumentId;
    captureRequestId: CaptureRequestId;
    filePath: FilePath;
    metadata: DocumentMetadata;
    checksum: Checksum;
    traceContext: TraceContext;
  }): DocumentReceivedEvent {
    return new DocumentReceivedEvent({
      eventId: EventId.create(),
      occurredAt: new Date(),
      documentId: params.documentId,
      captureRequestId: params.captureRequestId,
      filePath: params.filePath,
      metadata: params.metadata,
      checksum: params.checksum,
      traceContext: params.traceContext,
    });
  }

  // Getters

  get eventId(): EventId {
    return this._eventId;
  }

  get eventType(): string {
    return 'DocumentReceived';
  }

  get occurredAt(): Date {
    return new Date(this._occurredAt);
  }

  get documentId(): DocumentId {
    return this._documentId;
  }

  get captureRequestId(): CaptureRequestId {
    return this._captureRequestId;
  }

  get filePath(): FilePath {
    return this._filePath;
  }

  get metadata(): DocumentMetadata {
    return this._metadata;
  }

  get checksum(): Checksum {
    return this._checksum;
  }

  get traceContext(): TraceContext {
    return { ...this._traceContext };
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    eventId: string;
    eventType: string;
    occurredAt: string;
    documentId: string;
    captureRequestId: string;
    filePath: ReturnType<FilePath['toJSON']>;
    metadata: ReturnType<DocumentMetadata['toJSON']>;
    checksum: ReturnType<Checksum['toJSON']>;
    traceContext: TraceContext;
  } {
    return {
      eventId: this._eventId.value,
      eventType: this.eventType,
      occurredAt: this._occurredAt.toISOString(),
      documentId: this._documentId.value,
      captureRequestId: this._captureRequestId.value,
      filePath: this._filePath.toJSON(),
      metadata: this._metadata.toJSON(),
      checksum: this._checksum.toJSON(),
      traceContext: this._traceContext,
    };
  }
}
