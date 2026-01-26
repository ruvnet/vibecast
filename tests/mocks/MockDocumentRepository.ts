export interface Document {
  id: string;
  captureRequestId: string;
  filePath: string;
  contentHash: string;
  blobUri: string;
  status: 'RECEIVED' | 'STORED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRepository {
  findById(id: string): Promise<Document | null>;
  findByCaptureRequestId(id: string): Promise<Document | null>;
  save(document: Document): Promise<void>;
  exists(captureRequestId: string): Promise<boolean>;
}

export class MockDocumentRepository implements DocumentRepository {
  private documents: Map<string, Document> = new Map();
  private captureRequestIndex: Map<string, string> = new Map();

  findById = jest.fn(async (id: string): Promise<Document | null> => {
    return this.documents.get(id) || null;
  });

  findByCaptureRequestId = jest.fn(async (captureRequestId: string): Promise<Document | null> => {
    const documentId = this.captureRequestIndex.get(captureRequestId);
    if (!documentId) return null;
    return this.documents.get(documentId) || null;
  });

  save = jest.fn(async (document: Document): Promise<void> => {
    this.documents.set(document.id, document);
    this.captureRequestIndex.set(document.captureRequestId, document.id);
  });

  exists = jest.fn(async (captureRequestId: string): Promise<boolean> => {
    return this.captureRequestIndex.has(captureRequestId);
  });

  // Helper methods for testing
  clear(): void {
    this.documents.clear();
    this.captureRequestIndex.clear();
  }

  getAll(): Document[] {
    return Array.from(this.documents.values());
  }

  addDocument(document: Document): void {
    this.documents.set(document.id, document);
    this.captureRequestIndex.set(document.captureRequestId, document.id);
  }
}
