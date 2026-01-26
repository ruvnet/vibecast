export interface IdempotencyRecord {
  captureRequestId: string;
  contentHash: string;
  documentId: string;
  response: any;
  createdAt: Date;
  expiresAt: Date;
}

export type IdempotencyCheckResult =
  | { found: false }
  | { found: true; cached: true; response: any }
  | { found: true; inProgress: true };

export type ContentDuplicateResult =
  | { isDuplicate: false }
  | { isDuplicate: true; existingDocumentId: string; existingCaptureRequestId: string };

export interface IdempotencyService {
  checkAndGet(captureRequestId: string): Promise<IdempotencyCheckResult>;
  store(captureRequestId: string, contentHash: string, response: any, ttlSeconds: number): Promise<void>;
  checkContentDuplicate(filePath: string, checksum: string): Promise<ContentDuplicateResult>;
  markInProgress(captureRequestId: string): Promise<void>;
  clearInProgress(captureRequestId: string): Promise<void>;
}

export class MockIdempotencyService implements IdempotencyService {
  private records: Map<string, IdempotencyRecord> = new Map();
  private inProgressRequests: Set<string> = new Set();
  private contentIndex: Map<string, { documentId: string; captureRequestId: string }> = new Map();

  checkAndGet = jest.fn(async (captureRequestId: string): Promise<IdempotencyCheckResult> => {
    if (this.inProgressRequests.has(captureRequestId)) {
      return { found: true, inProgress: true };
    }

    const record = this.records.get(captureRequestId);
    if (!record) {
      return { found: false };
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      this.records.delete(captureRequestId);
      return { found: false };
    }

    return { found: true, cached: true, response: record.response };
  });

  store = jest.fn(async (
    captureRequestId: string,
    contentHash: string,
    response: any,
    ttlSeconds: number
  ): Promise<void> => {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    this.records.set(captureRequestId, {
      captureRequestId,
      contentHash,
      documentId: response.documentId,
      response,
      createdAt: new Date(),
      expiresAt,
    });

    // Index by content hash for duplicate detection
    this.contentIndex.set(contentHash, {
      documentId: response.documentId,
      captureRequestId,
    });

    this.inProgressRequests.delete(captureRequestId);
  });

  checkContentDuplicate = jest.fn(async (
    filePath: string,
    checksum: string
  ): Promise<ContentDuplicateResult> => {
    const contentHash = `${filePath}:${checksum}`;
    const existing = this.contentIndex.get(contentHash);

    if (!existing) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingDocumentId: existing.documentId,
      existingCaptureRequestId: existing.captureRequestId,
    };
  });

  markInProgress = jest.fn(async (captureRequestId: string): Promise<void> => {
    this.inProgressRequests.add(captureRequestId);
  });

  clearInProgress = jest.fn(async (captureRequestId: string): Promise<void> => {
    this.inProgressRequests.delete(captureRequestId);
  });

  // Helper methods for testing
  clear(): void {
    this.records.clear();
    this.inProgressRequests.clear();
    this.contentIndex.clear();
  }

  getRecord(captureRequestId: string): IdempotencyRecord | undefined {
    return this.records.get(captureRequestId);
  }

  isInProgress(captureRequestId: string): boolean {
    return this.inProgressRequests.has(captureRequestId);
  }

  getAllRecords(): IdempotencyRecord[] {
    return Array.from(this.records.values());
  }
}
