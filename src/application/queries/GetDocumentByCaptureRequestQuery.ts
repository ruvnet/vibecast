/**
 * Get Document By Capture Request Query
 *
 * Query to retrieve document details by the original capture request ID.
 * Useful for idempotency checks and status lookups.
 */

export interface GetDocumentByCaptureRequestQuery {
  /**
   * The capture request ID from the IIP Capture service
   */
  readonly captureRequestId: string;

  /**
   * Optional trace context for observability
   */
  readonly traceContext?: Record<string, string>;
}

/**
 * Factory for creating get document by capture request queries
 */
export class GetDocumentByCaptureRequestQueryFactory {
  static create(params: {
    captureRequestId: string;
    traceContext?: Record<string, string>;
  }): GetDocumentByCaptureRequestQuery {
    return {
      captureRequestId: params.captureRequestId,
      traceContext: params.traceContext,
    };
  }
}
