import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
  BlobUploadCommonResponse,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from 'pino';
import { createHash } from 'crypto';
import { Readable } from 'stream';

/**
 * Blob storage configuration
 */
export interface BlobStorageConfig {
  accountName: string;
  accountKey?: string;
  connectionString?: string;
  containerName: string;
  quarantineContainerName: string;
  useManagedIdentity?: boolean;
}

/**
 * File content interface
 */
export interface FileContent {
  data: Buffer | Readable;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

/**
 * Document metadata for storage
 */
export interface StorageMetadata {
  captureRequestId: string;
  sourceSystem: string;
  documentType: string;
  batchId?: string;
  uploadTimestamp: string;
}

/**
 * Blob path structure following ADR pattern:
 * /{year}/{month}/{day}/{source-system}/{batch-id}/{document-id}/
 */
export interface BlobPath {
  year: string;
  month: string;
  day: string;
  sourceSystem: string;
  batchId: string;
  documentId: string;
  filename: string;
  fullPath: string;
}

/**
 * Blob upload result
 */
export interface BlobUploadResult {
  uri: string;
  etag: string;
  versionId?: string;
  contentMD5: string;
  uploadDurationMs: number;
  path: BlobPath;
}

/**
 * Upload options
 */
export interface UploadOptions {
  overwrite?: boolean;
  blobMetadata?: Record<string, string>;
  contentType?: string;
  contentDisposition?: string;
  contentMD5?: string;
  tags?: Record<string, string>;
}

/**
 * Blob storage repository interface
 */
export interface IBlobStorageRepository {
  uploadDocument(
    content: FileContent,
    documentId: string,
    metadata: StorageMetadata,
    options?: UploadOptions
  ): Promise<BlobUploadResult>;

  generateBlobPath(documentId: string, metadata: StorageMetadata, filename: string): BlobPath;

  exists(path: BlobPath): Promise<boolean>;

  delete(uri: string): Promise<void>;

  generateSasUrl(uri: string, expiryMinutes: number): Promise<string>;
}

/**
 * Azure Blob Storage implementation
 */
export class BlobStorageService implements IBlobStorageRepository {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;
  private readonly quarantineContainerClient: ContainerClient;

  constructor(
    private readonly config: BlobStorageConfig,
    private readonly logger: Logger
  ) {
    // Initialize blob service client
    if (config.connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
    } else if (config.useManagedIdentity) {
      const credential = new DefaultAzureCredential();
      this.blobServiceClient = new BlobServiceClient(
        `https://${config.accountName}.blob.core.windows.net`,
        credential
      );
    } else if (config.accountKey) {
      const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.accountName};AccountKey=${config.accountKey};EndpointSuffix=core.windows.net`;
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      throw new StorageError('No valid Azure Storage credentials provided');
    }

    this.containerClient = this.blobServiceClient.getContainerClient(config.containerName);
    this.quarantineContainerClient = this.blobServiceClient.getContainerClient(
      config.quarantineContainerName
    );
  }

  /**
   * Upload document to blob storage
   */
  async uploadDocument(
    content: FileContent,
    documentId: string,
    metadata: StorageMetadata,
    options: UploadOptions = {}
  ): Promise<BlobUploadResult> {
    const startTime = Date.now();

    try {
      // Generate blob path
      const blobPath = this.generateBlobPath(documentId, metadata, 'content.bin');

      // Create blob client
      const blobClient = this.containerClient.getBlockBlobClient(blobPath.fullPath);

      // Prepare upload options
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: options.contentType || content.mimeType,
          blobContentDisposition: options.contentDisposition,
          blobContentMD5: options.contentMD5 ? Buffer.from(options.contentMD5, 'hex') : undefined,
        },
        metadata: {
          captureRequestId: metadata.captureRequestId,
          sourceSystem: metadata.sourceSystem,
          documentType: metadata.documentType,
          batchId: metadata.batchId || '',
          uploadTimestamp: metadata.uploadTimestamp,
          documentId: documentId,
          checksum: content.checksum,
          ...options.blobMetadata,
        },
        tags: options.tags,
      };

      // Upload blob
      let response: BlobUploadCommonResponse;
      if (Buffer.isBuffer(content.data)) {
        response = await blobClient.upload(content.data, content.sizeBytes, uploadOptions);
      } else {
        response = await blobClient.uploadStream(
          content.data as Readable,
          undefined,
          undefined,
          uploadOptions
        );
      }

      // Also upload metadata.json
      await this.uploadMetadataFile(blobPath, metadata);

      // Create manifest.json for integrity verification
      await this.uploadManifestFile(blobPath, content, metadata);

      const duration = Date.now() - startTime;

      this.logger.info(
        {
          documentId,
          blobUri: blobClient.url,
          sizeBytes: content.sizeBytes,
          duration,
          etag: response.etag,
        },
        'Document uploaded to blob storage'
      );

      return {
        uri: blobClient.url,
        etag: response.etag || '',
        versionId: response.versionId,
        contentMD5: response.contentMD5 ? Buffer.from(response.contentMD5).toString('hex') : content.checksum,
        uploadDurationMs: duration,
        path: blobPath,
      };
    } catch (error) {
      this.logger.error({ error, documentId }, 'Error uploading document to blob storage');
      throw new StorageError('Failed to upload document to blob storage', { cause: error });
    }
  }

  /**
   * Generate blob path following ADR pattern
   * Pattern: /{year}/{month}/{day}/{source-system}/{batch-id}/{document-id}/
   */
  generateBlobPath(documentId: string, metadata: StorageMetadata, filename: string): BlobPath {
    const timestamp = new Date(metadata.uploadTimestamp);
    const year = timestamp.getFullYear().toString();
    const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
    const day = timestamp.getDate().toString().padStart(2, '0');

    // Sanitize source system and batch ID for use in paths
    const sourceSystem = this.sanitizePathComponent(metadata.sourceSystem);
    const batchId = this.sanitizePathComponent(metadata.batchId || 'NO-BATCH');

    const fullPath = `${year}/${month}/${day}/${sourceSystem}/${batchId}/${documentId}/${filename}`;

    return {
      year,
      month,
      day,
      sourceSystem,
      batchId,
      documentId,
      filename,
      fullPath,
    };
  }

  /**
   * Check if blob exists
   */
  async exists(path: BlobPath): Promise<boolean> {
    try {
      const blobClient = this.containerClient.getBlockBlobClient(path.fullPath);
      return await blobClient.exists();
    } catch (error) {
      this.logger.error({ error, path }, 'Error checking blob existence');
      return false;
    }
  }

  /**
   * Delete blob
   */
  async delete(uri: string): Promise<void> {
    try {
      // Extract blob name from URI
      const url = new URL(uri);
      const blobName = url.pathname.split('/').slice(2).join('/');

      const blobClient = this.containerClient.getBlockBlobClient(blobName);
      await blobClient.deleteIfExists();

      this.logger.info({ uri, blobName }, 'Blob deleted successfully');
    } catch (error) {
      this.logger.error({ error, uri }, 'Error deleting blob');
      throw new StorageError('Failed to delete blob', { cause: error });
    }
  }

  /**
   * Generate SAS URL for blob access
   */
  async generateSasUrl(uri: string, expiryMinutes: number = 60): Promise<string> {
    try {
      const url = new URL(uri);
      const blobName = url.pathname.split('/').slice(2).join('/');

      const blobClient = this.containerClient.getBlockBlobClient(blobName);

      // Generate SAS token with read permissions
      const expiresOn = new Date();
      expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

      // Note: SAS URL generation requires account key or user delegation key
      // This is a simplified version - actual implementation would use generateBlobSASQueryParameters
      const sasUrl = `${blobClient.url}?se=${expiresOn.toISOString()}&sp=r`;

      this.logger.debug({ uri, expiryMinutes }, 'SAS URL generated');

      return sasUrl;
    } catch (error) {
      this.logger.error({ error, uri }, 'Error generating SAS URL');
      throw new StorageError('Failed to generate SAS URL', { cause: error });
    }
  }

  /**
   * Ensure containers exist
   */
  async ensureContainersExist(): Promise<void> {
    try {
      await this.containerClient.createIfNotExists({
        access: undefined, // Private access - no public read
        metadata: {
          purpose: 'Document intake storage',
          created: new Date().toISOString(),
        },
      });

      await this.quarantineContainerClient.createIfNotExists({
        access: undefined, // Private access - no public read
        metadata: {
          purpose: 'Quarantine for failed validation',
          created: new Date().toISOString(),
        },
      });

      this.logger.info('Blob storage containers verified');
    } catch (error) {
      this.logger.error({ error }, 'Error ensuring containers exist');
      throw new StorageError('Failed to ensure containers exist', { cause: error });
    }
  }

  /**
   * Upload metadata.json file
   */
  private async uploadMetadataFile(blobPath: BlobPath, metadata: StorageMetadata): Promise<void> {
    const metadataPath = { ...blobPath, filename: 'metadata.json' };
    metadataPath.fullPath = metadataPath.fullPath.replace('content.bin', 'metadata.json');

    const blobClient = this.containerClient.getBlockBlobClient(metadataPath.fullPath);
    const metadataJson = JSON.stringify(metadata, null, 2);

    await blobClient.upload(metadataJson, metadataJson.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
      },
    });
  }

  /**
   * Upload manifest.json file for integrity verification
   */
  private async uploadManifestFile(
    blobPath: BlobPath,
    content: FileContent,
    metadata: StorageMetadata
  ): Promise<void> {
    const manifestPath = { ...blobPath, filename: 'manifest.json' };
    manifestPath.fullPath = manifestPath.fullPath.replace('content.bin', 'manifest.json');

    const manifest = {
      documentId: blobPath.documentId,
      captureRequestId: metadata.captureRequestId,
      checksum: {
        algorithm: 'SHA-256',
        value: content.checksum,
      },
      sizeBytes: content.sizeBytes,
      mimeType: content.mimeType,
      uploadedAt: new Date().toISOString(),
    };

    const blobClient = this.containerClient.getBlockBlobClient(manifestPath.fullPath);
    const manifestJson = JSON.stringify(manifest, null, 2);

    await blobClient.upload(manifestJson, manifestJson.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
      },
    });
  }

  /**
   * Sanitize path components to prevent path traversal
   */
  private sanitizePathComponent(component: string): string {
    return component.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 255);
  }
}

/**
 * Custom error for storage operations
 */
export class StorageError extends Error {
  public override readonly name = 'StorageError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory function to create BlobStorageService
 */
export function createBlobStorageService(
  config: BlobStorageConfig,
  logger: Logger
): IBlobStorageRepository {
  return new BlobStorageService(config, logger);
}
