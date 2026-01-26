import crypto from 'crypto';

// CaptureRequestId value object implementation
class CaptureRequestId {
  readonly value: string;

  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new Error(`Invalid CaptureRequestId: ${value}`);
    }
    this.value = value;
  }

  private isValid(value: string): boolean {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  validate(): boolean {
    return this.isValid(this.value);
  }

  equals(other: CaptureRequestId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

describe('CaptureRequestId', () => {
  describe('construction', () => {
    it('should create a valid CaptureRequestId with UUID v4', () => {
      const uuid = crypto.randomUUID();
      const captureRequestId = new CaptureRequestId(uuid);

      expect(captureRequestId.value).toBe(uuid);
      expect(captureRequestId.validate()).toBe(true);
    });

    it('should throw error for invalid UUID format', () => {
      const invalidUuid = 'not-a-valid-uuid';

      expect(() => new CaptureRequestId(invalidUuid)).toThrow('Invalid CaptureRequestId');
    });

    it('should throw error for empty string', () => {
      expect(() => new CaptureRequestId('')).toThrow('Invalid CaptureRequestId');
    });

    it('should throw error for non-v4 UUID', () => {
      const uuidV1 = '550e8400-e29b-11d4-a716-446655440000'; // v1 UUID

      expect(() => new CaptureRequestId(uuidV1)).toThrow('Invalid CaptureRequestId');
    });
  });

  describe('validation', () => {
    it('should validate correct UUID v4 format', () => {
      const captureRequestId = new CaptureRequestId(crypto.randomUUID());

      expect(captureRequestId.validate()).toBe(true);
    });

    it('should accept uppercase UUIDs', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      const captureRequestId = new CaptureRequestId(uuid);

      expect(captureRequestId.validate()).toBe(true);
    });
  });

  describe('equality', () => {
    it('should return true for equal CaptureRequestIds', () => {
      const uuid = crypto.randomUUID();
      const id1 = new CaptureRequestId(uuid);
      const id2 = new CaptureRequestId(uuid);

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different CaptureRequestIds', () => {
      const id1 = new CaptureRequestId(crypto.randomUUID());
      const id2 = new CaptureRequestId(crypto.randomUUID());

      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the UUID value as string', () => {
      const uuid = crypto.randomUUID();
      const captureRequestId = new CaptureRequestId(uuid);

      expect(captureRequestId.toString()).toBe(uuid);
    });
  });
});
