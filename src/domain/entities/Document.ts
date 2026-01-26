import { v4 as uuidv4 } from 'uuid';
import { CaptureRequestId } from '../value-objects/CaptureRequestId';
import { FilePath } from '../value-objects/FilePath';
import { DocumentMetadata } from '../value-objects/DocumentMetadata';
import { FileContent } from '../value-objects/FileContent';
import { BlobUri } from '../value-objects/BlobUri';
import { DocumentStatus, isValidStatusTransition } from './DocumentStatus';

/**
 * Document ID value object.
 */
export class DocumentId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value?: string): DocumentId {
    if (value) {
      // Validate existing UUID
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`Invalid UUID v4 format: ${value}`);
      }
      return new DocumentId(value);
    }
    // Generate new UUID v4
    return new DocumentId(uuidv4());
  }

  get value(): string {
    return this._value;
  }

  equals(other: DocumentId): boolean {
    return other instanceof DocumentId && this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Failure reason for failed documents.
 */
export interface FailureReason {
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Document Aggregate Root.
 * Represents a document in the intake process with its complete lifecycle.
 */
export class Document {
  private _id: DocumentId;
  private readonly _captureRequestId: CaptureRequestId;
  private readonly _filePath: FilePath;
  private readonly _metadata: DocumentMetadata;
  private readonly _content: FileContent;
  private _status: DocumentStatus;
  private _blobUri?: BlobUri;
  private _failureReason?: FailureReason;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(params: {
    id: DocumentId;
    captureRequestId: CaptureRequestId;
    filePath: FilePath;
    metadata: DocumentMetadata;
    content: FileContent;
    status: DocumentStatus;
    blobUri?: BlobUri;
    failureReason?: FailureReason;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = params.id;
    this._captureRequestId = params.captureRequestId;
    this._filePath = params.filePath;
    this._metadata = params.metadata;
    this._content = params.content;
    this._status = params.status;
    this._blobUri = params.blobUri;
    this._failureReason = params.failureReason;
    this._createdAt = params.createdAt;
    this._updatedAt = params.updatedAt;
  }

  /**
   * Creates a new Document instance when a document is first received.
   */
  static create(params: {
    captureRequestId: CaptureRequestId;
    filePath: FilePath;
    metadata: DocumentMetadata;
    content: FileContent;
  }): Document {
    const now = new Date();

    return new Document({
      id: DocumentId.create(),
      captureRequestId: params.captureRequestId,
      filePath: params.filePath,
      metadata: params.metadata,
      content: params.content,
      status: DocumentStatus.RECEIVED,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitutes a Document from persistence.
   */
  static reconstitute(params: {
    id: string;
    captureRequestId: CaptureRequestId;
    filePath: FilePath;
    metadata: DocumentMetadata;
    content: FileContent;
    status: DocumentStatus;
    blobUri?: BlobUri;
    failureReason?: FailureReason;
    createdAt: Date;
    updatedAt: Date;
  }): Document {
    return new Document({
      id: DocumentId.create(params.id),
      captureRequestId: params.captureRequestId,
      filePath: params.filePath,
      metadata: params.metadata,
      content: params.content,
      status: params.status,
      blobUri: params.blobUri,
      failureReason: params.failureReason,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });
  }

  // Getters

  get id(): DocumentId {
    return this._id;
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

  get content(): FileContent {
    return this._content;
  }

  get status(): DocumentStatus {
    return this._status;
  }

  get blobUri(): BlobUri | undefined {
    return this._blobUri;
  }

  get failureReason(): FailureReason | undefined {
    return this._failureReason;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  // Domain methods

  /**
   * Marks the document as received.
   * This is the initial state when a document enters the system.
   */
  markAsReceived(): void {
    this.updateStatus(DocumentStatus.RECEIVED);
  }

  /**
   * Marks the document as stored in blob storage.
   * @param blobUri - URI where the document was stored
   * @throws {Error} if status transition is invalid
   */
  markAsStored(blobUri: BlobUri): void {
    if (!blobUri) {
      throw new Error('blobUri is required when marking document as stored');
    }

    this.updateStatus(DocumentStatus.STORED);
    this._blobUri = blobUri;
  }

  /**
   * Marks the document as being processed.
   * @throws {Error} if status transition is invalid
   */
  markAsProcessing(): void {
    this.updateStatus(DocumentStatus.PROCESSING);
  }

  /**
   * Marks the document processing as completed.
   * @throws {Error} if status transition is invalid
   */
  markAsCompleted(): void {
    this.updateStatus(DocumentStatus.COMPLETED);
  }

  /**
   * Marks the document intake or processing as failed.
   * @param reason - Failure details
   * @throws {Error} if status transition is invalid
   */
  markAsFailed(reason: FailureReason): void {
    if (!reason) {
      throw new Error('FailureReason is required when marking document as failed');
    }

    this.updateStatus(DocumentStatus.FAILED);
    this._failureReason = reason;
  }

  /**
   * Updates the document status with validation.
   */
  private updateStatus(newStatus: DocumentStatus): void {
    if (!isValidStatusTransition(this._status, newStatus)) {
      throw new Error(
        `Invalid status transition: cannot transition from ${this._status} to ${newStatus}`
      );
    }

    this._status = newStatus;
    this._updatedAt = new Date();
  }

  /**
   * Checks if the document is in a terminal state.
   */
  isTerminal(): boolean {
    return this._status === DocumentStatus.COMPLETED || this._status === DocumentStatus.FAILED;
  }

  /**
   * Checks if the document processing was successful.
   */
  isSuccessful(): boolean {
    return this._status === DocumentStatus.COMPLETED;
  }

  /**
   * Checks if the document processing failed.
   */
  isFailed(): boolean {
    return this._status === DocumentStatus.FAILED;
  }

  /**
   * Returns a JSON-serializable representation (without binary content).
   */
  toJSON(): {
    id: string;
    captureRequestId: string;
    filePath: ReturnType<FilePath['toJSON']>;
    metadata: ReturnType<DocumentMetadata['toJSON']>;
    content: ReturnType<FileContent['toJSON']>;
    status: DocumentStatus;
    blobUri?: ReturnType<BlobUri['toJSON']>;
    failureReason?: FailureReason;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this._id.value,
      captureRequestId: this._captureRequestId.value,
      filePath: this._filePath.toJSON(),
      metadata: this._metadata.toJSON(),
      content: this._content.toJSON(),
      status: this._status,
      blobUri: this._blobUri?.toJSON(),
      failureReason: this._failureReason,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
