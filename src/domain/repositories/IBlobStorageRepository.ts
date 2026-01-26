import { FileContent } from '../value-objects/FileContent';
import { BlobUri } from '../value-objects/BlobUri';

/**
 * Blob storage path specification.
 */
export interface BlobPath {
  container: string;
  path: string;
}

/**
 * Blob permissions for SAS URL generation.
 */
export interface BlobPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  list: boolean;
}

/**
 * Options for blob upload operation.
 */
export interface BlobUploadOptions {
  /**
   * Whether to overwrite existing blob.
   */
  overwrite: boolean;

  /**
   * Metadata to store with the blob.
   */
  metadata?: Record<string, string>;

  /**
   * Content type (MIME type) for the blob.
   */
  contentType?: string;

  /**
   * Content disposition header.
   */
  contentDisposition?: string;

  /**
   * Cache control header.
   */
  cacheControl?: string;

  /**
   * MD5 hash for Azure integrity verification.
   */
  contentMD5?: string;
}

/**
 * Result of a blob upload operation.
 */
export interface BlobUploadResult {
  uri: BlobUri;
  etag: string;
  versionId?: string;
  contentMD5: string;
  uploadDurationMs: number;
}

/**
 * SAS (Shared Access Signature) URL with expiry.
 */
export interface SasUrl {
  url: string;
  expiresAt: Date;
}

/**
 * Repository interface for blob storage operations.
 *
 * This interface abstracts cloud storage interactions (e.g., Azure Blob Storage).
 * Implementations should handle file uploads, downloads, and access control.
 */
export interface IBlobStorageRepository {
  /**
   * Uploads file content to blob storage.
   * @param content - File content to upload
   * @param path - Target blob path
   * @param options - Upload options
   * @returns Upload result with URI and metadata
   * @throws {Error} if upload fails
   */
  store(
    content: FileContent,
    path: BlobPath,
    options?: BlobUploadOptions
  ): Promise<BlobUploadResult>;

  /**
   * Checks if a blob exists at the specified path.
   * @param path - Blob path to check
   * @returns true if blob exists, false otherwise
   */
  exists(path: BlobPath): Promise<boolean>;

  /**
   * Checks if a blob exists by URI.
   * @param uri - Blob URI to check
   * @returns true if blob exists, false otherwise
   */
  existsByUri(uri: BlobUri): Promise<boolean>;

  /**
   * Deletes a blob from storage.
   * @param uri - Blob URI to delete
   * @returns true if deleted, false if not found
   * @throws {Error} if deletion fails
   */
  delete(uri: BlobUri): Promise<boolean>;

  /**
   * Downloads blob content.
   * @param uri - Blob URI to download
   * @returns File content
   * @throws {Error} if download fails or blob not found
   */
  download(uri: BlobUri): Promise<FileContent>;

  /**
   * Generates a temporary signed URL for blob access.
   * Useful for providing time-limited access to downstream services.
   * @param uri - Blob URI
   * @param permissions - Access permissions
   * @param expiryDurationMs - Time until URL expires (in milliseconds)
   * @returns Signed URL with expiry information
   * @throws {Error} if SAS generation fails
   */
  generateSasUrl(
    uri: BlobUri,
    permissions: BlobPermissions,
    expiryDurationMs: number
  ): Promise<SasUrl>;

  /**
   * Copies a blob to a new location.
   * Useful for archiving or moving documents between containers.
   * @param sourceUri - Source blob URI
   * @param destinationPath - Destination blob path
   * @returns URI of the copied blob
   * @throws {Error} if copy operation fails
   */
  copy(sourceUri: BlobUri, destinationPath: BlobPath): Promise<BlobUri>;

  /**
   * Gets blob metadata without downloading content.
   * @param uri - Blob URI
   * @returns Blob metadata
   * @throws {Error} if blob not found
   */
  getMetadata(uri: BlobUri): Promise<Record<string, string>>;

  /**
   * Sets blob metadata.
   * @param uri - Blob URI
   * @param metadata - Metadata to set
   * @throws {Error} if operation fails
   */
  setMetadata(uri: BlobUri, metadata: Record<string, string>): Promise<void>;
}
