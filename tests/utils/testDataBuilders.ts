import crypto from 'crypto';

export interface TestDocument {
  id: string;
  captureRequestId: string;
  filePath: string;
  contentHash: string;
  blobUri: string;
  status: 'RECEIVED' | 'STORED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata: TestDocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDocumentMetadata {
  captureTimestamp: string;
  sourceSystem: string;
  documentType: string;
  batchId?: string;
  customFields?: Record<string, any>;
}

export interface TestFileContent {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export class DocumentBuilder {
  private document: Partial<TestDocument>;

  constructor() {
    this.document = {
      id: crypto.randomUUID(),
      captureRequestId: crypto.randomUUID(),
      filePath: '/capture/batch-test/document-001.pdf',
      contentHash: crypto.randomBytes(32).toString('hex'),
      blobUri: 'https://storage.example.com/documents/test-document',
      status: 'RECEIVED',
      metadata: {
        captureTimestamp: new Date().toISOString(),
        sourceSystem: 'IIP-CAPTURE-TEST-01',
        documentType: 'INVOICE',
        batchId: 'BATCH-TEST-001',
        customFields: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  withId(id: string): this {
    this.document.id = id;
    return this;
  }

  withCaptureRequestId(captureRequestId: string): this {
    this.document.captureRequestId = captureRequestId;
    return this;
  }

  withFilePath(filePath: string): this {
    this.document.filePath = filePath;
    return this;
  }

  withContentHash(contentHash: string): this {
    this.document.contentHash = contentHash;
    return this;
  }

  withStatus(status: TestDocument['status']): this {
    this.document.status = status;
    return this;
  }

  withMetadata(metadata: Partial<TestDocumentMetadata>): this {
    this.document.metadata = { ...this.document.metadata!, ...metadata };
    return this;
  }

  build(): TestDocument {
    return this.document as TestDocument;
  }
}

export class FileContentBuilder {
  private content: Partial<TestFileContent>;

  constructor() {
    const data = Buffer.from('Test file content');
    this.content = {
      data,
      mimeType: 'application/pdf',
      sizeBytes: data.length,
      checksum: crypto.createHash('sha256').update(data).digest('hex'),
    };
  }

  withData(data: Buffer): this {
    this.content.data = data;
    this.content.sizeBytes = data.length;
    this.content.checksum = crypto.createHash('sha256').update(data).digest('hex');
    return this;
  }

  withMimeType(mimeType: string): this {
    this.content.mimeType = mimeType;
    return this;
  }

  withSize(sizeBytes: number): this {
    this.content.sizeBytes = sizeBytes;
    return this;
  }

  build(): TestFileContent {
    return this.content as TestFileContent;
  }
}

export class UploadRequestBuilder {
  private request: any;

  constructor() {
    const fileContent = new FileContentBuilder().build();
    this.request = {
      captureRequestId: crypto.randomUUID(),
      filePath: '/capture/batch-test/document-001.pdf',
      file: fileContent.data,
      metadata: {
        captureTimestamp: new Date().toISOString(),
        sourceSystem: 'IIP-CAPTURE-TEST-01',
        documentType: 'INVOICE',
        batchId: 'BATCH-TEST-001',
        customFields: {
          department: 'Finance',
          priority: 'HIGH',
        },
      },
      checksum: fileContent.checksum,
    };
  }

  withCaptureRequestId(captureRequestId: string): this {
    this.request.captureRequestId = captureRequestId;
    return this;
  }

  withFilePath(filePath: string): this {
    this.request.filePath = filePath;
    return this;
  }

  withFile(data: Buffer): this {
    this.request.file = data;
    this.request.checksum = crypto.createHash('sha256').update(data).digest('hex');
    return this;
  }

  withMetadata(metadata: any): this {
    this.request.metadata = { ...this.request.metadata, ...metadata };
    return this;
  }

  withChecksum(checksum: string): this {
    this.request.checksum = checksum;
    return this;
  }

  build(): any {
    return this.request;
  }
}

// Helper functions
export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createTestBuffer(size: number): Buffer {
  return Buffer.alloc(size, 'a');
}
