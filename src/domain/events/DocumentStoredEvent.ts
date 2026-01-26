import { EventId, TraceContext } from './DocumentReceivedEvent';
import { DocumentId } from '../entities/Document';
import { BlobUri } from '../value-objects/BlobUri';

/**
 * Domain Event: Document Stored
 *
 * Published when a document is successfully stored in blob storage.
 * This event indicates the document is persisted and can be accessed by downstream services.
 */
export class DocumentStoredEvent {
  private readonly _eventId: EventId;
  private readonly _occurredAt: Date;
  private readonly _documentId: DocumentId;
  private readonly _blobUri: BlobUri;
  private readonly _storageDurationMs: number;
  private readonly _traceContext: TraceContext;

  private constructor(params: {
    eventId: EventId;
    occurredAt: Date;
    documentId: DocumentId;
    blobUri: BlobUri;
    storageDurationMs: number;
    traceContext: TraceContext;
  }) {
    this._eventId = params.eventId;
    this._occurredAt = params.occurredAt;
    this._documentId = params.documentId;
    this._blobUri = params.blobUri;
    this._storageDurationMs = params.storageDurationMs;
    this._traceContext = params.traceContext;
  }

  /**
   * Creates a new DocumentStoredEvent.
   */
  static create(params: {
    documentId: DocumentId;
    blobUri: BlobUri;
    storageDurationMs: number;
    traceContext: TraceContext;
  }): DocumentStoredEvent {
    if (params.storageDurationMs < 0) {
      throw new Error('storageDurationMs cannot be negative');
    }

    return new DocumentStoredEvent({
      eventId: EventId.create(),
      occurredAt: new Date(),
      documentId: params.documentId,
      blobUri: params.blobUri,
      storageDurationMs: params.storageDurationMs,
      traceContext: params.traceContext,
    });
  }

  // Getters

  get eventId(): EventId {
    return this._eventId;
  }

  get eventType(): string {
    return 'DocumentStored';
  }

  get occurredAt(): Date {
    return new Date(this._occurredAt);
  }

  get documentId(): DocumentId {
    return this._documentId;
  }

  get blobUri(): BlobUri {
    return this._blobUri;
  }

  get storageDurationMs(): number {
    return this._storageDurationMs;
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
    blobUri: ReturnType<BlobUri['toJSON']>;
    storageDurationMs: number;
    traceContext: TraceContext;
  } {
    return {
      eventId: this._eventId.value,
      eventType: this.eventType,
      occurredAt: this._occurredAt.toISOString(),
      documentId: this._documentId.value,
      blobUri: this._blobUri.toJSON(),
      storageDurationMs: this._storageDurationMs,
      traceContext: this._traceContext,
    };
  }
}
