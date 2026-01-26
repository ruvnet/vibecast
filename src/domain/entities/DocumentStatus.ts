/**
 * Enum representing the lifecycle status of a document in the intake process.
 */
export enum DocumentStatus {
  /**
   * Document has been received by the API but not yet stored.
   */
  RECEIVED = 'RECEIVED',

  /**
   * Document has been successfully stored in blob storage.
   */
  STORED = 'STORED',

  /**
   * Document is currently being processed by downstream services.
   */
  PROCESSING = 'PROCESSING',

  /**
   * Document processing has completed successfully.
   */
  COMPLETED = 'COMPLETED',

  /**
   * Document intake or processing has failed.
   */
  FAILED = 'FAILED',
}

/**
 * Type guard to check if a string is a valid DocumentStatus.
 */
export function isValidDocumentStatus(status: string): status is DocumentStatus {
  return Object.values(DocumentStatus).includes(status as DocumentStatus);
}

/**
 * Gets all valid document status values.
 */
export function getAllDocumentStatuses(): DocumentStatus[] {
  return Object.values(DocumentStatus);
}

/**
 * Determines if a status transition is valid.
 * @param from - Current status
 * @param to - Target status
 * @returns true if transition is allowed
 */
export function isValidStatusTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  // Define valid state transitions
  const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
    [DocumentStatus.RECEIVED]: [
      DocumentStatus.STORED,
      DocumentStatus.FAILED,
    ],
    [DocumentStatus.STORED]: [
      DocumentStatus.PROCESSING,
      DocumentStatus.FAILED,
    ],
    [DocumentStatus.PROCESSING]: [
      DocumentStatus.COMPLETED,
      DocumentStatus.FAILED,
    ],
    [DocumentStatus.COMPLETED]: [
      // Terminal state - no transitions allowed
    ],
    [DocumentStatus.FAILED]: [
      // Terminal state - no transitions allowed
      // Note: Could allow retry transitions in future if needed
    ],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Gets human-readable description of a status.
 */
export function getStatusDescription(status: DocumentStatus): string {
  const descriptions: Record<DocumentStatus, string> = {
    [DocumentStatus.RECEIVED]: 'Document received by API',
    [DocumentStatus.STORED]: 'Document stored in blob storage',
    [DocumentStatus.PROCESSING]: 'Document being processed',
    [DocumentStatus.COMPLETED]: 'Document processing completed',
    [DocumentStatus.FAILED]: 'Document intake or processing failed',
  };

  return descriptions[status] ?? 'Unknown status';
}
