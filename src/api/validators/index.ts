/**
 * API Validators - FlowManager Document Intake
 *
 * Zod schemas for request validation.
 */

import { z } from 'zod';

/**
 * UUID validation pattern
 */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * SHA-256 checksum validation pattern
 */
const sha256Pattern = /^[a-f0-9]{64}$/i;

/**
 * Document types enum
 */
export const documentTypeEnum = z.enum([
  'INVOICE',
  'CONTRACT',
  'RECEIPT',
  'FORM',
  'CORRESPONDENCE',
  'REPORT',
  'OTHER',
]);

/**
 * Custom fields schema (flexible key-value pairs)
 */
export const customFieldsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

/**
 * Document metadata schema
 */
export const documentMetadataSchema = z.object({
  captureTimestamp: z.string().datetime({ message: 'Invalid ISO 8601 datetime format' }),
  sourceSystem: z.string().min(1).max(100),
  documentType: documentTypeEnum,
  batchId: z.string().max(100).optional(),
  customFields: customFieldsSchema.optional().default({}),
});

/**
 * Capture request ID schema
 */
export const captureRequestIdSchema = z.string().regex(uuidPattern, {
  message: 'Invalid UUID format for captureRequestId',
});

/**
 * Document ID schema
 */
export const documentIdSchema = z.string().regex(uuidPattern, {
  message: 'Invalid UUID format for documentId',
});

/**
 * File path schema
 */
export const filePathSchema = z.string().min(1).max(1000).refine(
  (path) => !path.includes('..'),
  { message: 'File path cannot contain parent directory references (..)' }
);

/**
 * Checksum schema
 */
export const checksumSchema = z.string().regex(sha256Pattern, {
  message: 'Invalid SHA-256 checksum format',
});

/**
 * Document intake request schema (for multipart form)
 */
export const documentIntakeRequestSchema = z.object({
  captureRequestId: captureRequestIdSchema,
  filePath: filePathSchema,
  metadata: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      return documentMetadataSchema.parse(parsed);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON format for metadata',
      });
      return z.NEVER;
    }
  }),
  checksum: checksumSchema.optional(),
});

/**
 * Get document by ID request schema
 */
export const getDocumentByIdSchema = z.object({
  params: z.object({
    documentId: documentIdSchema,
  }),
});

/**
 * Get document by capture request ID schema
 */
export const getDocumentByCaptureRequestIdSchema = z.object({
  params: z.object({
    captureRequestId: captureRequestIdSchema,
  }),
});

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * List documents query schema
 */
export const listDocumentsQuerySchema = z.object({
  status: z.enum(['RECEIVED', 'STORED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  sourceSystem: z.string().optional(),
  documentType: documentTypeEnum.optional(),
  batchId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Type exports for validated data
 */
export type DocumentIntakeRequest = z.infer<typeof documentIntakeRequestSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type GetDocumentByIdRequest = z.infer<typeof getDocumentByIdSchema>;
export type GetDocumentByCaptureRequestIdRequest = z.infer<typeof getDocumentByCaptureRequestIdSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Validation helper functions
 */
export const validators = {
  /**
   * Validate document intake request
   */
  validateIntakeRequest: (data: unknown) => documentIntakeRequestSchema.safeParse(data),

  /**
   * Validate document ID param
   */
  validateDocumentId: (id: string) => documentIdSchema.safeParse(id),

  /**
   * Validate capture request ID param
   */
  validateCaptureRequestId: (id: string) => captureRequestIdSchema.safeParse(id),

  /**
   * Validate list documents query
   */
  validateListQuery: (query: unknown) => listDocumentsQuerySchema.safeParse(query),

  /**
   * Validate checksum
   */
  validateChecksum: (checksum: string) => checksumSchema.safeParse(checksum),

  /**
   * Validate metadata JSON
   */
  validateMetadata: (data: unknown) => documentMetadataSchema.safeParse(data),
};

/**
 * File validation constants
 */
export const FileValidation = {
  /**
   * Maximum file size (100MB)
   */
  MAX_SIZE_BYTES: 100 * 1024 * 1024,

  /**
   * Allowed MIME types
   */
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/tiff',
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  /**
   * Allowed file extensions
   */
  ALLOWED_EXTENSIONS: ['.pdf', '.tiff', '.tif', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx', '.xls', '.xlsx'],
} as const;

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: { size: number; mimetype: string; originalname: string } | undefined
): { valid: true } | { valid: false; error: string } {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  if (file.size > FileValidation.MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${FileValidation.MAX_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }

  if (!(FileValidation.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type '${file.mimetype}' is not allowed. Allowed types: ${FileValidation.ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!(FileValidation.ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      valid: false,
      error: `File extension '${extension}' is not allowed`,
    };
  }

  return { valid: true };
}
