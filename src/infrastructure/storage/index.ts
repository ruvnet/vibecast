/**
 * Storage Infrastructure - FlowManager Document Intake
 *
 * Azure Blob Storage implementation for document storage.
 */

export {
  BlobStorageService,
  StorageError,
  createBlobStorageService,
  type BlobStorageConfig,
  type FileContent,
  type StorageMetadata,
  type BlobPath,
  type BlobUploadResult,
  type UploadOptions,
  type IBlobStorageRepository,
} from './BlobStorageService.js';
