import { z } from 'zod';
import { DocumentMetadataSchema } from './metadataValidator';
import crypto from 'crypto';

/**
 * Maximum file size: 100MB as per ADR-001
 */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Allowed MIME types for document upload
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/tiff',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
] as const;

/**
 * Zod schema for file upload validation
 */
export const FileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum(ALLOWED_MIME_TYPES as any, {
    errorMap: () => ({ message: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` })
  }),
  size: z.number()
    .max(MAX_FILE_SIZE_BYTES, `File size must not exceed ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`),
  buffer: z.instanceof(Buffer)
});

/**
 * Zod schema for complete document upload request
 */
export const DocumentUploadRequestSchema = z.object({
  captureRequestId: z.string()
    .uuid({ message: 'captureRequestId must be a valid UUID v4' }),

  filePath: z.string()
    .min(1, 'filePath is required')
    .max(500, 'filePath must be less than 500 characters')
    .regex(/^[a-zA-Z0-9\/\-_.]+$/, 'filePath contains invalid characters'),

  metadata: DocumentMetadataSchema,

  checksum: z.string()
    .length(64, 'checksum must be a 64-character SHA-256 hash')
    .regex(/^[a-f0-9]{64}$/i, 'checksum must be a valid SHA-256 hex string'),

  file: FileUploadSchema
});

export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequestSchema>;

/**
 * Sanitize file path to prevent path traversal attacks
 */
export function sanitizeFilePath(filePath: string): string {
  return filePath
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/\/\//g, '/') // Remove double slashes
    .replace(/^\//, '') // Remove leading slash
    .trim();
}

/**
 * Verify file checksum matches expected value
 * @param fileBuffer - File content buffer
 * @param expectedChecksum - Expected SHA-256 checksum
 * @returns true if checksum matches, false otherwise
 */
export function verifyChecksum(fileBuffer: Buffer, expectedChecksum: string): boolean {
  const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
}

/**
 * Calculate SHA-256 checksum of file buffer
 */
export function calculateChecksum(fileBuffer: Buffer): string {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Validate complete document upload request
 */
export function validateUploadRequest(request: unknown) {
  return DocumentUploadRequestSchema.safeParse(request);
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if file extension matches MIME type
 */
export function validateFileExtension(filename: string, mimeType: string): boolean {
  const extension = getFileExtension(filename);
  const mimeExtensionMap: Record<string, string[]> = {
    'application/pdf': ['pdf'],
    'image/tiff': ['tiff', 'tif'],
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'text/plain': ['txt'],
    'text/csv': ['csv']
  };

  const expectedExtensions = mimeExtensionMap[mimeType] || [];
  return expectedExtensions.includes(extension);
}
