/**
 * Application Queries - FlowManager Document Intake
 *
 * Queries represent requests for data without side effects.
 * Following CQRS pattern for command-query separation.
 */

import type {
  DocumentId,
  CaptureRequestId,
  DocumentStatus,
} from '../../domain/index.js';

/**
 * Query: Get Document by ID
 */
export interface GetDocumentByIdQuery {
  readonly type: 'GetDocumentById';
  readonly documentId: DocumentId;
}

/**
 * Query: Get Document by Capture Request ID
 */
export interface GetDocumentByCaptureRequestIdQuery {
  readonly type: 'GetDocumentByCaptureRequestId';
  readonly captureRequestId: CaptureRequestId;
}

/**
 * Query: List Documents
 */
export interface ListDocumentsQuery {
  readonly type: 'ListDocuments';
  readonly filters?: DocumentFilters;
  readonly pagination?: PaginationOptions;
  readonly sorting?: SortingOptions;
}

/**
 * Document filters for listing
 */
export interface DocumentFilters {
  readonly status?: DocumentStatus;
  readonly sourceSystem?: string;
  readonly documentType?: string;
  readonly batchId?: string;
  readonly fromDate?: Date;
  readonly toDate?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Sorting options
 */
export interface SortingOptions {
  readonly field: 'createdAt' | 'updatedAt' | 'status';
  readonly direction: 'asc' | 'desc';
}

/**
 * Union type for all queries
 */
export type DocumentIntakeQuery =
  | GetDocumentByIdQuery
  | GetDocumentByCaptureRequestIdQuery
  | ListDocumentsQuery;

/**
 * Document view model for API responses
 */
export interface DocumentViewModel {
  readonly documentId: string;
  readonly captureRequestId: string;
  readonly status: DocumentStatus;
  readonly blobUri?: string;
  readonly filePath: string;
  readonly receivedAt: string;
  readonly storedAt?: string;
  readonly metadata: DocumentMetadataViewModel;
  readonly traceId?: string;
}

/**
 * Document metadata view model
 */
export interface DocumentMetadataViewModel {
  readonly captureTimestamp: string;
  readonly sourceSystem: string;
  readonly documentType: string;
  readonly batchId?: string;
  readonly customFields: Record<string, unknown>;
}

/**
 * Paginated list result
 */
export interface PaginatedResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * Query result wrapper
 */
export interface QueryResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: QueryError;
}

/**
 * Query error details
 */
export interface QueryError {
  readonly code: string;
  readonly message: string;
}

/**
 * Query Handler interface
 */
export interface QueryHandler<TQuery, TResult> {
  /**
   * Execute the query
   */
  execute(query: TQuery): Promise<QueryResult<TResult>>;
}

/**
 * Get Document Query Handler
 */
export interface GetDocumentQueryHandler
  extends QueryHandler<GetDocumentByIdQuery | GetDocumentByCaptureRequestIdQuery, DocumentViewModel> {}

/**
 * List Documents Query Handler
 */
export interface ListDocumentsQueryHandler
  extends QueryHandler<ListDocumentsQuery, PaginatedResult<DocumentViewModel>> {}
