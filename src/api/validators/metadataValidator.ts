import { z } from 'zod';

/**
 * Zod schema for document metadata validation
 * Based on ADR-001 DocumentMetadata specification
 */
export const DocumentMetadataSchema = z.object({
  captureTimestamp: z.string().datetime({ message: 'captureTimestamp must be a valid ISO 8601 datetime' }),

  sourceSystem: z.string()
    .min(1, 'sourceSystem is required')
    .max(100, 'sourceSystem must be less than 100 characters')
    .regex(/^[A-Z0-9\-_]+$/i, 'sourceSystem must contain only alphanumeric characters, hyphens, and underscores'),

  documentType: z.string()
    .min(1, 'documentType is required')
    .max(50, 'documentType must be less than 50 characters')
    .regex(/^[A-Z0-9_]+$/i, 'documentType must contain only alphanumeric characters and underscores'),

  batchId: z.string()
    .max(100, 'batchId must be less than 100 characters')
    .optional(),

  customFields: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ]))
    .optional()
    .default({})
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/**
 * Validate metadata object
 * @param metadata - Raw metadata object to validate
 * @returns Validation result with parsed data or errors
 */
export function validateMetadata(metadata: unknown) {
  return DocumentMetadataSchema.safeParse(metadata);
}

/**
 * Parse metadata JSON string
 * @param metadataJson - JSON string containing metadata
 * @returns Parsed and validated metadata
 * @throws Error if JSON is invalid or validation fails
 */
export function parseMetadataJson(metadataJson: string): DocumentMetadata {
  try {
    const parsed = JSON.parse(metadataJson);
    const result = DocumentMetadataSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Metadata validation failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format in metadata field');
    }
    throw error;
  }
}
