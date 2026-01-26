// DocumentMetadata value object implementation
interface DocumentMetadataProps {
  captureTimestamp: Date;
  sourceSystem: string;
  documentType: string;
  batchId?: string;
  customFields?: Map<string, any>;
}

class DocumentMetadata {
  readonly captureTimestamp: Date;
  readonly sourceSystem: string;
  readonly documentType: string;
  readonly batchId?: string;
  readonly customFields: Map<string, any>;

  constructor(props: DocumentMetadataProps) {
    this.validateMetadata(props);
    this.captureTimestamp = props.captureTimestamp;
    this.sourceSystem = props.sourceSystem;
    this.documentType = props.documentType;
    this.batchId = props.batchId;
    this.customFields = props.customFields || new Map();
  }

  private validateMetadata(props: DocumentMetadataProps): void {
    if (!props.captureTimestamp) {
      throw new Error('captureTimestamp is required');
    }

    if (!props.sourceSystem || props.sourceSystem.trim() === '') {
      throw new Error('sourceSystem is required and cannot be empty');
    }

    if (!props.documentType || props.documentType.trim() === '') {
      throw new Error('documentType is required and cannot be empty');
    }

    // Validate timestamp is not in the future
    if (props.captureTimestamp > new Date()) {
      throw new Error('captureTimestamp cannot be in the future');
    }

    // Validate sourceSystem format
    if (!/^[A-Z0-9-]+$/i.test(props.sourceSystem)) {
      throw new Error('sourceSystem must contain only alphanumeric characters and hyphens');
    }

    // Validate documentType format
    if (!/^[A-Z_]+$/i.test(props.documentType)) {
      throw new Error('documentType must contain only uppercase letters and underscores');
    }
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.validateMetadata({
        captureTimestamp: this.captureTimestamp,
        sourceSystem: this.sourceSystem,
        documentType: this.documentType,
        batchId: this.batchId,
        customFields: this.customFields,
      });
    } catch (error: any) {
      errors.push(error.message);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toJSON(): object {
    return {
      captureTimestamp: this.captureTimestamp.toISOString(),
      sourceSystem: this.sourceSystem,
      documentType: this.documentType,
      batchId: this.batchId,
      customFields: Object.fromEntries(this.customFields),
    };
  }
}

describe('DocumentMetadata', () => {
  describe('construction', () => {
    it('should create valid DocumentMetadata with required fields', () => {
      const metadata = new DocumentMetadata({
        captureTimestamp: new Date('2026-01-26T10:30:00Z'),
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
      });

      expect(metadata.captureTimestamp).toBeInstanceOf(Date);
      expect(metadata.sourceSystem).toBe('IIP-CAPTURE-PROD-01');
      expect(metadata.documentType).toBe('INVOICE');
      expect(metadata.customFields.size).toBe(0);
    });

    it('should create DocumentMetadata with optional fields', () => {
      const customFields = new Map([
        ['department', 'Finance'],
        ['priority', 'HIGH'],
      ]);

      const metadata = new DocumentMetadata({
        captureTimestamp: new Date('2026-01-26T10:30:00Z'),
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
        batchId: 'BATCH-2026-01-26-001',
        customFields,
      });

      expect(metadata.batchId).toBe('BATCH-2026-01-26-001');
      expect(metadata.customFields.get('department')).toBe('Finance');
      expect(metadata.customFields.get('priority')).toBe('HIGH');
    });

    it('should throw error for missing captureTimestamp', () => {
      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: null as any,
            sourceSystem: 'IIP-CAPTURE-PROD-01',
            documentType: 'INVOICE',
          })
      ).toThrow('captureTimestamp is required');
    });

    it('should throw error for empty sourceSystem', () => {
      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: new Date(),
            sourceSystem: '',
            documentType: 'INVOICE',
          })
      ).toThrow('sourceSystem is required and cannot be empty');
    });

    it('should throw error for empty documentType', () => {
      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: new Date(),
            sourceSystem: 'IIP-CAPTURE-PROD-01',
            documentType: '',
          })
      ).toThrow('documentType is required and cannot be empty');
    });

    it('should throw error for future captureTimestamp', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour in future

      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: futureDate,
            sourceSystem: 'IIP-CAPTURE-PROD-01',
            documentType: 'INVOICE',
          })
      ).toThrow('captureTimestamp cannot be in the future');
    });

    it('should throw error for invalid sourceSystem format', () => {
      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: new Date(),
            sourceSystem: 'IIP@CAPTURE#PROD',
            documentType: 'INVOICE',
          })
      ).toThrow('sourceSystem must contain only alphanumeric characters and hyphens');
    });

    it('should throw error for invalid documentType format', () => {
      expect(
        () =>
          new DocumentMetadata({
            captureTimestamp: new Date(),
            sourceSystem: 'IIP-CAPTURE-PROD-01',
            documentType: 'invoice-123',
          })
      ).toThrow('documentType must contain only uppercase letters and underscores');
    });
  });

  describe('validate', () => {
    it('should return valid result for correct metadata', () => {
      const metadata = new DocumentMetadata({
        captureTimestamp: new Date('2026-01-26T10:30:00Z'),
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
      });

      const result = metadata.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON with ISO timestamp', () => {
      const metadata = new DocumentMetadata({
        captureTimestamp: new Date('2026-01-26T10:30:00Z'),
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
        batchId: 'BATCH-001',
      });

      const json = metadata.toJSON();

      expect(json).toEqual({
        captureTimestamp: '2026-01-26T10:30:00.000Z',
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
        batchId: 'BATCH-001',
        customFields: {},
      });
    });

    it('should serialize customFields to plain object', () => {
      const customFields = new Map([
        ['department', 'Finance'],
        ['priority', 'HIGH'],
      ]);

      const metadata = new DocumentMetadata({
        captureTimestamp: new Date('2026-01-26T10:30:00Z'),
        sourceSystem: 'IIP-CAPTURE-PROD-01',
        documentType: 'INVOICE',
        customFields,
      });

      const json: any = metadata.toJSON();

      expect(json.customFields).toEqual({
        department: 'Finance',
        priority: 'HIGH',
      });
    });
  });
});
