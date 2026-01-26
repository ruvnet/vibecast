import crypto from 'crypto';

// Document aggregate root
type DocumentStatus = 'RECEIVED' | 'STORED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface DocumentProps {
  id: string;
  captureRequestId: string;
  filePath: string;
  contentHash: string;
  metadata: any;
  status: DocumentStatus;
  blobUri?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

class Document {
  readonly id: string;
  readonly captureRequestId: string;
  readonly filePath: string;
  readonly contentHash: string;
  readonly metadata: any;
  private _status: DocumentStatus;
  private _blobUri?: string;
  private _failureReason?: string;
  readonly createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: any[] = [];

  constructor(props: DocumentProps) {
    this.id = props.id;
    this.captureRequestId = props.captureRequestId;
    this.filePath = props.filePath;
    this.contentHash = props.contentHash;
    this.metadata = props.metadata;
    this._status = props.status;
    this._blobUri = props.blobUri;
    this._failureReason = props.failureReason;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get status(): DocumentStatus {
    return this._status;
  }

  get blobUri(): string | undefined {
    return this._blobUri;
  }

  get failureReason(): string | undefined {
    return this._failureReason;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): any[] {
    return [...this._domainEvents];
  }

  markAsReceived(): void {
    if (this._status !== 'RECEIVED') {
      throw new Error('Document must be in RECEIVED status');
    }

    this._domainEvents.push({
      type: 'DocumentReceived',
      documentId: this.id,
      captureRequestId: this.captureRequestId,
      occurredAt: new Date(),
    });
  }

  markAsStored(blobUri: string): void {
    if (this._status !== 'RECEIVED' && this._status !== 'PROCESSING') {
      throw new Error('Document must be in RECEIVED or PROCESSING status to be marked as STORED');
    }

    this._status = 'STORED';
    this._blobUri = blobUri;
    this._updatedAt = new Date();

    this._domainEvents.push({
      type: 'DocumentStored',
      documentId: this.id,
      blobUri,
      occurredAt: new Date(),
    });
  }

  markAsFailed(reason: string): void {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot mark completed document as failed');
    }

    this._status = 'FAILED';
    this._failureReason = reason;
    this._updatedAt = new Date();

    this._domainEvents.push({
      type: 'DocumentIntakeFailed',
      documentId: this.id,
      captureRequestId: this.captureRequestId,
      failureReason: reason,
      occurredAt: new Date(),
    });
  }

  markAsProcessing(): void {
    if (this._status !== 'STORED') {
      throw new Error('Document must be in STORED status to be marked as PROCESSING');
    }

    this._status = 'PROCESSING';
    this._updatedAt = new Date();
  }

  markAsCompleted(): void {
    if (this._status !== 'PROCESSING') {
      throw new Error('Document must be in PROCESSING status to be marked as COMPLETED');
    }

    this._status = 'COMPLETED';
    this._updatedAt = new Date();
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  static create(props: Omit<DocumentProps, 'createdAt' | 'updatedAt' | 'status'>): Document {
    return new Document({
      ...props,
      status: 'RECEIVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

describe('Document Aggregate Root', () => {
  let documentProps: DocumentProps;

  beforeEach(() => {
    documentProps = {
      id: crypto.randomUUID(),
      captureRequestId: crypto.randomUUID(),
      filePath: '/capture/batch-2026-01/invoice-001.pdf',
      contentHash: crypto.randomBytes(32).toString('hex'),
      metadata: {
        captureTimestamp: new Date().toISOString(),
        sourceSystem: 'IIP-CAPTURE-TEST-01',
        documentType: 'INVOICE',
      },
      status: 'RECEIVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('construction', () => {
    it('should create a Document with all properties', () => {
      const document = new Document(documentProps);

      expect(document.id).toBe(documentProps.id);
      expect(document.captureRequestId).toBe(documentProps.captureRequestId);
      expect(document.filePath).toBe(documentProps.filePath);
      expect(document.status).toBe('RECEIVED');
      expect(document.domainEvents).toHaveLength(0);
    });

    it('should create a Document using factory method', () => {
      const document = Document.create({
        id: documentProps.id,
        captureRequestId: documentProps.captureRequestId,
        filePath: documentProps.filePath,
        contentHash: documentProps.contentHash,
        metadata: documentProps.metadata,
      });

      expect(document.status).toBe('RECEIVED');
      expect(document.createdAt).toBeInstanceOf(Date);
      expect(document.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('markAsReceived', () => {
    it('should emit DocumentReceived event', () => {
      const document = Document.create(documentProps);

      document.markAsReceived();

      expect(document.domainEvents).toHaveLength(1);
      expect(document.domainEvents[0].type).toBe('DocumentReceived');
      expect(document.domainEvents[0].documentId).toBe(document.id);
    });

    it('should throw error if not in RECEIVED status', () => {
      const document = new Document({ ...documentProps, status: 'STORED' });

      expect(() => document.markAsReceived()).toThrow('Document must be in RECEIVED status');
    });
  });

  describe('markAsStored', () => {
    it('should transition from RECEIVED to STORED', () => {
      const document = Document.create(documentProps);
      const blobUri = 'https://storage.example.com/documents/test-document';

      document.markAsStored(blobUri);

      expect(document.status).toBe('STORED');
      expect(document.blobUri).toBe(blobUri);
      expect(document.updatedAt).toBeInstanceOf(Date);
    });

    it('should emit DocumentStored event', () => {
      const document = Document.create(documentProps);
      const blobUri = 'https://storage.example.com/documents/test-document';

      document.markAsStored(blobUri);

      expect(document.domainEvents).toHaveLength(1);
      expect(document.domainEvents[0].type).toBe('DocumentStored');
      expect(document.domainEvents[0].blobUri).toBe(blobUri);
    });

    it('should allow transition from PROCESSING to STORED', () => {
      const document = new Document({ ...documentProps, status: 'PROCESSING' });
      const blobUri = 'https://storage.example.com/documents/test-document';

      expect(() => document.markAsStored(blobUri)).not.toThrow();
      expect(document.status).toBe('STORED');
    });

    it('should throw error if not in RECEIVED or PROCESSING status', () => {
      const document = new Document({ ...documentProps, status: 'COMPLETED' });

      expect(() => document.markAsStored('uri')).toThrow(
        'Document must be in RECEIVED or PROCESSING status to be marked as STORED'
      );
    });
  });

  describe('markAsFailed', () => {
    it('should transition to FAILED status with reason', () => {
      const document = Document.create(documentProps);
      const failureReason = 'Checksum validation failed';

      document.markAsFailed(failureReason);

      expect(document.status).toBe('FAILED');
      expect(document.failureReason).toBe(failureReason);
      expect(document.updatedAt).toBeInstanceOf(Date);
    });

    it('should emit DocumentIntakeFailed event', () => {
      const document = Document.create(documentProps);
      const failureReason = 'Storage service unavailable';

      document.markAsFailed(failureReason);

      expect(document.domainEvents).toHaveLength(1);
      expect(document.domainEvents[0].type).toBe('DocumentIntakeFailed');
      expect(document.domainEvents[0].failureReason).toBe(failureReason);
    });

    it('should throw error if document is already COMPLETED', () => {
      const document = new Document({ ...documentProps, status: 'COMPLETED' });

      expect(() => document.markAsFailed('reason')).toThrow(
        'Cannot mark completed document as failed'
      );
    });
  });

  describe('markAsProcessing', () => {
    it('should transition from STORED to PROCESSING', () => {
      const document = new Document({ ...documentProps, status: 'STORED' });

      document.markAsProcessing();

      expect(document.status).toBe('PROCESSING');
    });

    it('should throw error if not in STORED status', () => {
      const document = Document.create(documentProps);

      expect(() => document.markAsProcessing()).toThrow(
        'Document must be in STORED status to be marked as PROCESSING'
      );
    });
  });

  describe('markAsCompleted', () => {
    it('should transition from PROCESSING to COMPLETED', () => {
      const document = new Document({ ...documentProps, status: 'PROCESSING' });

      document.markAsCompleted();

      expect(document.status).toBe('COMPLETED');
    });

    it('should throw error if not in PROCESSING status', () => {
      const document = new Document({ ...documentProps, status: 'STORED' });

      expect(() => document.markAsCompleted()).toThrow(
        'Document must be in PROCESSING status to be marked as COMPLETED'
      );
    });
  });

  describe('domain events', () => {
    it('should accumulate multiple domain events', () => {
      const document = Document.create(documentProps);

      document.markAsReceived();
      document.markAsStored('https://storage.example.com/doc');

      expect(document.domainEvents).toHaveLength(2);
      expect(document.domainEvents[0].type).toBe('DocumentReceived');
      expect(document.domainEvents[1].type).toBe('DocumentStored');
    });

    it('should clear domain events', () => {
      const document = Document.create(documentProps);

      document.markAsReceived();
      document.clearDomainEvents();

      expect(document.domainEvents).toHaveLength(0);
    });

    it('should return copy of events to prevent external mutation', () => {
      const document = Document.create(documentProps);
      document.markAsReceived();

      const events = document.domainEvents;
      events.push({ type: 'FakeEvent' });

      expect(document.domainEvents).toHaveLength(1);
    });
  });
});
