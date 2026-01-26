import { MockDocumentRepository } from '../../mocks/MockDocumentRepository';
import { MockBlobStorageRepository } from '../../mocks/MockBlobStorageRepository';
import { MockIdempotencyService } from '../../mocks/MockIdempotencyService';
import { UploadRequestBuilder } from '../../utils/testDataBuilders';
import crypto from 'crypto';

// DocumentIntakeService
class DocumentIntakeService {
  constructor(
    private documentRepository: any,
    private blobStorageRepository: any,
    private idempotencyService: any
  ) {}

  async processIncomingDocument(request: any): Promise<any> {
    // 1. Check idempotency
    const idempotencyCheck = await this.idempotencyService.checkAndGet(
      request.captureRequestId
    );

    if (idempotencyCheck.found) {
      if (idempotencyCheck.inProgress) {
        throw new Error('Request is currently being processed');
      }
      return idempotencyCheck.response;
    }

    // 2. Mark as in progress
    await this.idempotencyService.markInProgress(request.captureRequestId);

    try {
      // 3. Check for content duplicates
      const duplicateCheck = await this.idempotencyService.checkContentDuplicate(
        request.filePath,
        request.checksum
      );

      if (duplicateCheck.isDuplicate) {
        throw new Error(
          `Duplicate content detected. Existing document: ${duplicateCheck.existingDocumentId}`
        );
      }

      // 4. Verify checksum
      const computedChecksum = crypto
        .createHash('sha256')
        .update(request.file)
        .digest('hex');

      if (computedChecksum !== request.checksum) {
        throw new Error('Checksum mismatch - file corrupted during transfer');
      }

      // 5. Store in blob storage
      const documentId = crypto.randomUUID();
      const blobPath = this.generateBlobPath(documentId, request.metadata);
      const blobResult = await this.blobStorageRepository.store(request.file, blobPath);

      // 6. Save document record
      const document = {
        id: documentId,
        captureRequestId: request.captureRequestId,
        filePath: request.filePath,
        contentHash: computedChecksum,
        blobUri: blobResult.uri,
        status: 'STORED' as const,
        metadata: request.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.documentRepository.save(document);

      // 7. Store idempotency record
      const response = {
        documentId: document.id,
        captureRequestId: document.captureRequestId,
        status: document.status,
        blobUri: document.blobUri,
        receivedAt: document.createdAt.toISOString(),
        storedAt: document.updatedAt.toISOString(),
        metadata: document.metadata,
      };

      const contentHash = `${request.filePath}:${request.checksum}`;
      await this.idempotencyService.store(request.captureRequestId, contentHash, response, 86400);

      return response;
    } catch (error) {
      await this.idempotencyService.clearInProgress(request.captureRequestId);
      throw error;
    }
  }

  private generateBlobPath(documentId: string, metadata: any): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}/${metadata.sourceSystem}/${documentId}/content.bin`;
  }
}

describe('DocumentIntakeService', () => {
  let service: DocumentIntakeService;
  let documentRepository: MockDocumentRepository;
  let blobStorageRepository: MockBlobStorageRepository;
  let idempotencyService: MockIdempotencyService;

  beforeEach(() => {
    documentRepository = new MockDocumentRepository();
    blobStorageRepository = new MockBlobStorageRepository();
    idempotencyService = new MockIdempotencyService();
    service = new DocumentIntakeService(
      documentRepository,
      blobStorageRepository,
      idempotencyService
    );
  });

  describe('processIncomingDocument', () => {
    it('should successfully process a new document', async () => {
      const request = new UploadRequestBuilder().build();

      const result = await service.processIncomingDocument(request);

      expect(result).toHaveProperty('documentId');
      expect(result.captureRequestId).toBe(request.captureRequestId);
      expect(result.status).toBe('STORED');
      expect(result.blobUri).toBeTruthy();
      expect(documentRepository.save).toHaveBeenCalledTimes(1);
      expect(blobStorageRepository.store).toHaveBeenCalledTimes(1);
    });

    it('should return cached response for duplicate captureRequestId', async () => {
      const request = new UploadRequestBuilder().build();

      // First request
      const firstResult = await service.processIncomingDocument(request);

      // Second request with same captureRequestId
      const secondResult = await service.processIncomingDocument(request);

      expect(secondResult.documentId).toBe(firstResult.documentId);
      expect(documentRepository.save).toHaveBeenCalledTimes(1); // Only called once
      expect(blobStorageRepository.store).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should throw error for duplicate content with different captureRequestId', async () => {
      const fileContent = Buffer.from('Duplicate content');
      const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');

      // First request
      const request1 = new UploadRequestBuilder()
        .withFile(fileContent)
        .withChecksum(checksum)
        .build();

      await service.processIncomingDocument(request1);

      // Second request with same content but different captureRequestId
      const request2 = new UploadRequestBuilder()
        .withCaptureRequestId(crypto.randomUUID())
        .withFile(fileContent)
        .withChecksum(checksum)
        .build();

      await expect(service.processIncomingDocument(request2)).rejects.toThrow(
        'Duplicate content detected'
      );
    });

    it('should throw error for checksum mismatch', async () => {
      const request = new UploadRequestBuilder()
        .withChecksum('0000000000000000000000000000000000000000000000000000000000000000')
        .build();

      await expect(service.processIncomingDocument(request)).rejects.toThrow(
        'Checksum mismatch - file corrupted during transfer'
      );
    });

    it('should mark request as in progress during processing', async () => {
      const request = new UploadRequestBuilder().build();

      await service.processIncomingDocument(request);

      // Check that it was marked as in progress during processing
      expect(idempotencyService.markInProgress).toHaveBeenCalledWith(request.captureRequestId);
    });

    it('should clear in-progress flag on error', async () => {
      const request = new UploadRequestBuilder().build();

      // Force an error by making blob storage fail
      blobStorageRepository.store.mockRejectedValueOnce(new Error('Storage failure'));

      await expect(service.processIncomingDocument(request)).rejects.toThrow('Storage failure');
      expect(idempotencyService.clearInProgress).toHaveBeenCalledWith(request.captureRequestId);
    });

    it('should throw error if request is already in progress', async () => {
      const request = new UploadRequestBuilder().build();

      // Mark as in progress manually
      await idempotencyService.markInProgress(request.captureRequestId);

      await expect(service.processIncomingDocument(request)).rejects.toThrow(
        'Request is currently being processed'
      );
    });

    it('should generate correct blob path', async () => {
      const request = new UploadRequestBuilder()
        .withMetadata({ sourceSystem: 'IIP-CAPTURE-TEST' })
        .build();

      await service.processIncomingDocument(request);

      expect(blobStorageRepository.store).toHaveBeenCalled();
      const blobPath = blobStorageRepository.store.mock.calls[0][1];

      // Should match pattern: {year}/{month}/{day}/{sourceSystem}/{documentId}/content.bin
      expect(blobPath).toMatch(/^\d{4}\/\d{2}\/\d{2}\/IIP-CAPTURE-TEST\/[a-f0-9-]+\/content\.bin$/);
    });

    it('should store idempotency record with 24-hour TTL', async () => {
      const request = new UploadRequestBuilder().build();

      await service.processIncomingDocument(request);

      expect(idempotencyService.store).toHaveBeenCalledWith(
        request.captureRequestId,
        expect.any(String),
        expect.any(Object),
        86400 // 24 hours in seconds
      );
    });

    it('should include all metadata in response', async () => {
      const request = new UploadRequestBuilder()
        .withMetadata({
          captureTimestamp: '2026-01-26T10:30:00Z',
          sourceSystem: 'IIP-CAPTURE-PROD',
          documentType: 'INVOICE',
          batchId: 'BATCH-001',
          customFields: { priority: 'HIGH' },
        })
        .build();

      const result = await service.processIncomingDocument(request);

      expect(result.metadata).toEqual(request.metadata);
    });
  });

  describe('validation', () => {
    it('should validate file content integrity', async () => {
      const originalContent = Buffer.from('Original content');
      const checksum = crypto.createHash('sha256').update(originalContent).digest('hex');

      const request = new UploadRequestBuilder()
        .withFile(originalContent)
        .withChecksum(checksum)
        .build();

      const result = await service.processIncomingDocument(request);

      expect(result).toHaveProperty('documentId');
    });

    it('should reject tampered file content', async () => {
      const originalContent = Buffer.from('Original content');
      const originalChecksum = crypto.createHash('sha256').update(originalContent).digest('hex');

      const tamperedContent = Buffer.from('Tampered content');

      const request = new UploadRequestBuilder()
        .withFile(tamperedContent)
        .withChecksum(originalChecksum)
        .build();

      await expect(service.processIncomingDocument(request)).rejects.toThrow('Checksum mismatch');
    });
  });
});
