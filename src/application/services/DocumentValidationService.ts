/**
 * Document Validation Service
 *
 * Validates document content and metadata according to business rules.
 */

import { DocumentMetadataDto } from '../commands/UploadDocumentCommand';
import { createHash } from 'crypto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ContentValidationInput {
  data: Buffer | ReadableStream;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export class DocumentValidationService {
  // Configuration
  private readonly MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/tiff',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  private readonly REQUIRED_METADATA_FIELDS = [
    'captureTimestamp',
    'sourceSystem',
    'documentType',
  ];

  /**
   * Validate file content
   */
  validateContent(input: ContentValidationInput): ValidationResult {
    const errors: string[] = [];

    // Validate file size
    if (input.sizeBytes <= 0) {
      errors.push('File size must be greater than 0');
    }

    if (input.sizeBytes > this.MAX_FILE_SIZE_BYTES) {
      errors.push(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE_BYTES} bytes`
      );
    }

    // Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      errors.push(
        `MIME type '${input.mimeType}' is not allowed. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // Validate checksum format (SHA-256 is 64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(input.checksum)) {
      errors.push('Checksum must be a valid SHA-256 hash (64 hexadecimal characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate document metadata
   */
  validateMetadata(metadata: DocumentMetadataDto): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    for (const field of this.REQUIRED_METADATA_FIELDS) {
      if (!metadata[field as keyof DocumentMetadataDto]) {
        errors.push(`Required field '${field}' is missing`);
      }
    }

    // Validate captureTimestamp is a valid ISO 8601 date
    if (metadata.captureTimestamp) {
      const timestamp = new Date(metadata.captureTimestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('captureTimestamp must be a valid ISO 8601 date string');
      }

      // Check if timestamp is not in the future
      if (timestamp.getTime() > Date.now()) {
        errors.push('captureTimestamp cannot be in the future');
      }
    }

    // Validate sourceSystem format
    if (metadata.sourceSystem && !/^[A-Z0-9\-_]+$/i.test(metadata.sourceSystem)) {
      errors.push(
        'sourceSystem must contain only alphanumeric characters, hyphens, and underscores'
      );
    }

    // Validate documentType format
    if (metadata.documentType && !/^[A-Z_]+$/.test(metadata.documentType)) {
      errors.push(
        'documentType must contain only uppercase letters and underscores'
      );
    }

    // Validate batchId format if provided
    if (metadata.batchId && !/^[A-Z0-9\-_]+$/i.test(metadata.batchId)) {
      errors.push(
        'batchId must contain only alphanumeric characters, hyphens, and underscores'
      );
    }

    // Validate customFields if provided
    if (metadata.customFields) {
      const customFieldsErrors = this.validateCustomFields(metadata.customFields);
      errors.push(...customFieldsErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Verify file checksum
   */
  async verifyChecksum(
    data: Buffer | ReadableStream,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(data);
      return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
    } catch (error) {
      // If checksum calculation fails, consider it invalid
      return false;
    }
  }

  /**
   * Calculate SHA-256 checksum of file content
   */
  private async calculateChecksum(data: Buffer | ReadableStream): Promise<string> {
    const hash = createHash('sha256');

    if (Buffer.isBuffer(data)) {
      hash.update(data);
      return hash.digest('hex');
    } else {
      // Handle ReadableStream
      return new Promise((resolve, reject) => {
        const stream = data as any;
        stream.on('data', (chunk: Buffer) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    }
  }

  /**
   * Validate custom fields structure
   */
  private validateCustomFields(customFields: Record<string, unknown>): string[] {
    const errors: string[] = [];

    // Check for maximum nesting depth (prevent DoS via deeply nested objects)
    const maxDepth = 3;
    if (this.getObjectDepth(customFields) > maxDepth) {
      errors.push(`customFields nesting depth exceeds maximum of ${maxDepth}`);
    }

    // Check field name format
    for (const key of Object.keys(customFields)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        errors.push(
          `customFields key '${key}' must contain only alphanumeric characters and underscores`
        );
      }
    }

    // Check for reasonable size (serialized JSON < 10KB)
    const serialized = JSON.stringify(customFields);
    const maxSize = 10 * 1024; // 10KB
    if (serialized.length > maxSize) {
      errors.push(`customFields size exceeds maximum of ${maxSize} bytes`);
    }

    return errors;
  }

  /**
   * Calculate maximum depth of nested object
   */
  private getObjectDepth(obj: unknown, currentDepth = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    const depths = Object.values(obj).map((value) =>
      this.getObjectDepth(value, currentDepth + 1)
    );

    return Math.max(currentDepth, ...depths);
  }
}
