/**
 * Represents the type of document being processed.
 */
export type DocumentType =
  | 'INVOICE'
  | 'RECEIPT'
  | 'CONTRACT'
  | 'FORM'
  | 'REPORT'
  | 'OTHER';

/**
 * Type for custom metadata field values.
 */
export type MetadataValue = string | number | boolean | null;

/**
 * Validation result for metadata.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Value Object representing document metadata from the Capture service.
 * Contains capture information, classification, and custom fields.
 */
export class DocumentMetadata {
  private readonly _captureTimestamp: Date;
  private readonly _sourceSystem: string;
  private readonly _documentType: DocumentType;
  private readonly _batchId?: string;
  private readonly _customFields: ReadonlyMap<string, MetadataValue>;

  private constructor(
    captureTimestamp: Date,
    sourceSystem: string,
    documentType: DocumentType,
    batchId: string | undefined,
    customFields: Map<string, MetadataValue>
  ) {
    this._captureTimestamp = captureTimestamp;
    this._sourceSystem = sourceSystem;
    this._documentType = documentType;
    this._batchId = batchId;
    this._customFields = new Map(customFields);
  }

  /**
   * Creates a new DocumentMetadata instance.
   * @param params - Metadata parameters
   * @throws {Error} if validation fails
   */
  static create(params: {
    captureTimestamp: Date | string;
    sourceSystem: string;
    documentType: DocumentType;
    batchId?: string;
    customFields?: Record<string, MetadataValue>;
  }): DocumentMetadata {
    // Validate and parse captureTimestamp
    const timestamp = params.captureTimestamp instanceof Date
      ? params.captureTimestamp
      : new Date(params.captureTimestamp);

    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid captureTimestamp: must be a valid date');
    }

    if (timestamp > new Date()) {
      throw new Error('captureTimestamp cannot be in the future');
    }

    // Validate sourceSystem
    if (!params.sourceSystem || typeof params.sourceSystem !== 'string') {
      throw new Error('sourceSystem must be a non-empty string');
    }

    const sourceSystem = params.sourceSystem.trim();
    if (sourceSystem.length === 0) {
      throw new Error('sourceSystem cannot be empty or whitespace only');
    }

    // Validate documentType
    const validDocumentTypes: DocumentType[] = [
      'INVOICE', 'RECEIPT', 'CONTRACT', 'FORM', 'REPORT', 'OTHER'
    ];
    if (!validDocumentTypes.includes(params.documentType)) {
      throw new Error(`Invalid documentType: ${params.documentType}. Must be one of: ${validDocumentTypes.join(', ')}`);
    }

    // Validate batchId if provided
    let batchId: string | undefined;
    if (params.batchId !== undefined) {
      if (typeof params.batchId !== 'string') {
        throw new Error('batchId must be a string');
      }
      const trimmedBatchId = params.batchId.trim();
      if (trimmedBatchId.length === 0) {
        throw new Error('batchId cannot be empty or whitespace only');
      }
      batchId = trimmedBatchId;
    }

    // Validate and convert customFields
    const customFields = new Map<string, MetadataValue>();
    if (params.customFields) {
      for (const [key, value] of Object.entries(params.customFields)) {
        if (!key || key.trim().length === 0) {
          throw new Error('Custom field key cannot be empty');
        }

        // Validate value type
        if (
          value !== null &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean'
        ) {
          throw new Error(`Invalid type for custom field "${key}": must be string, number, boolean, or null`);
        }

        customFields.set(key.trim(), value);
      }
    }

    return new DocumentMetadata(
      timestamp,
      sourceSystem,
      params.documentType,
      batchId,
      customFields
    );
  }

  /**
   * Gets the capture timestamp.
   */
  get captureTimestamp(): Date {
    return new Date(this._captureTimestamp);
  }

  /**
   * Gets the source system identifier.
   */
  get sourceSystem(): string {
    return this._sourceSystem;
  }

  /**
   * Gets the document type.
   */
  get documentType(): DocumentType {
    return this._documentType;
  }

  /**
   * Gets the optional batch ID.
   */
  get batchId(): string | undefined {
    return this._batchId;
  }

  /**
   * Gets the custom fields as a read-only map.
   */
  get customFields(): ReadonlyMap<string, MetadataValue> {
    return this._customFields;
  }

  /**
   * Gets a specific custom field value.
   */
  getCustomField(key: string): MetadataValue | undefined {
    return this._customFields.get(key);
  }

  /**
   * Validates the metadata (additional business rules).
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    // Check if capture timestamp is too old (e.g., more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (this._captureTimestamp < oneYearAgo) {
      errors.push('captureTimestamp is more than 1 year old');
    }

    // Additional validation rules can be added here

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    captureTimestamp: string;
    sourceSystem: string;
    documentType: DocumentType;
    batchId?: string;
    customFields: Record<string, MetadataValue>;
  } {
    const customFieldsObj: Record<string, MetadataValue> = {};
    this._customFields.forEach((value, key) => {
      customFieldsObj[key] = value;
    });

    return {
      captureTimestamp: this._captureTimestamp.toISOString(),
      sourceSystem: this._sourceSystem,
      documentType: this._documentType,
      batchId: this._batchId,
      customFields: customFieldsObj,
    };
  }
}
