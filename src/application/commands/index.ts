/**
 * Application Commands - FlowManager Document Intake
 *
 * Commands represent intentions to change the system state.
 * Following CQRS pattern for command-query separation.
 */

import type {
  CaptureRequestId,
  DocumentMetadata,
  FileContent,
  FilePath,
  Checksum,
  TraceContext,
  DocumentId,
  BlobUri,
} from '../../domain/index.js';

/**
 * Command: Intake Document
 *
 * Initiates the document intake process from Capture service.
 */
export interface IntakeDocumentCommand {
  readonly type: 'IntakeDocument';
  readonly captureRequestId: CaptureRequestId;
  readonly filePath: FilePath;
  readonly content: FileContent;
  readonly metadata: DocumentMetadata;
  readonly providedChecksum?: Checksum;
  readonly traceContext: TraceContext;
  readonly requestId?: string;
}

/**
 * Result of IntakeDocumentCommand execution
 */
export interface IntakeDocumentResult {
  readonly success: boolean;
  readonly documentId?: DocumentId;
  readonly blobUri?: BlobUri;
  readonly isIdempotentHit: boolean;
  readonly error?: CommandError;
}

/**
 * Command: Mark Document Stored
 *
 * Updates document status after successful blob storage.
 */
export interface MarkDocumentStoredCommand {
  readonly type: 'MarkDocumentStored';
  readonly documentId: DocumentId;
  readonly blobUri: BlobUri;
  readonly storageDurationMs: number;
  readonly traceContext: TraceContext;
}

/**
 * Command: Mark Document Failed
 *
 * Updates document status after intake failure.
 */
export interface MarkDocumentFailedCommand {
  readonly type: 'MarkDocumentFailed';
  readonly documentId?: DocumentId;
  readonly captureRequestId: CaptureRequestId;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly traceContext: TraceContext;
}

/**
 * Union type for all commands
 */
export type DocumentIntakeCommand =
  | IntakeDocumentCommand
  | MarkDocumentStoredCommand
  | MarkDocumentFailedCommand;

/**
 * Command error details
 */
export interface CommandError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Generic command result
 */
export interface CommandResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: CommandError;
}

/**
 * Command Handler interface
 */
export interface CommandHandler<TCommand, TResult> {
  /**
   * Execute the command
   */
  execute(command: TCommand): Promise<TResult>;
}

/**
 * Intake Document Command Handler
 */
export interface IntakeDocumentCommandHandler
  extends CommandHandler<IntakeDocumentCommand, IntakeDocumentResult> {}

/**
 * Mark Document Stored Command Handler
 */
export interface MarkDocumentStoredCommandHandler
  extends CommandHandler<MarkDocumentStoredCommand, CommandResult> {}

/**
 * Mark Document Failed Command Handler
 */
export interface MarkDocumentFailedCommandHandler
  extends CommandHandler<MarkDocumentFailedCommand, CommandResult> {}
