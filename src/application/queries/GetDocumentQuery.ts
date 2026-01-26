/**
 * Get Document Query
 *
 * Query to retrieve document details by document ID.
 */

export interface GetDocumentQuery {
  /**
   * The unique document identifier
   */
  readonly documentId: string;

  /**
   * Optional trace context for observability
   */
  readonly traceContext?: Record<string, string>;
}

/**
 * Factory for creating get document queries
 */
export class GetDocumentQueryFactory {
  static create(params: {
    documentId: string;
    traceContext?: Record<string, string>;
  }): GetDocumentQuery {
    return {
      documentId: params.documentId,
      traceContext: params.traceContext,
    };
  }
}
