import crypto from 'crypto';

// Checksum value object implementation
class Checksum {
  readonly algorithm: 'SHA-256' = 'SHA-256';
  readonly value: string;

  constructor(value: string) {
    this.validateChecksum(value);
    this.value = value.toLowerCase();
  }

  private validateChecksum(value: string): void {
    if (!value || value.trim() === '') {
      throw new Error('Checksum cannot be empty');
    }

    // SHA-256 produces 64 hex characters
    if (!/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new Error('Checksum must be a valid SHA-256 hex string (64 characters)');
    }
  }

  verify(content: Buffer): boolean {
    const computedHash = crypto.createHash('sha256').update(content).digest('hex');
    return computedHash === this.value;
  }

  equals(other: Checksum): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  static fromBuffer(content: Buffer): Checksum {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return new Checksum(hash);
  }
}

describe('Checksum', () => {
  describe('construction', () => {
    it('should create a valid Checksum with SHA-256 hash', () => {
      const hash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const checksum = new Checksum(hash);

      expect(checksum.value).toBe(hash);
      expect(checksum.algorithm).toBe('SHA-256');
    });

    it('should accept uppercase SHA-256 hash and convert to lowercase', () => {
      const hash = 'A591A6D40BF420404A011733CFB7B190D62C65BF0BCDA32B57B277D9AD9F146E';
      const checksum = new Checksum(hash);

      expect(checksum.value).toBe(hash.toLowerCase());
    });

    it('should throw error for empty checksum', () => {
      expect(() => new Checksum('')).toThrow('Checksum cannot be empty');
    });

    it('should throw error for invalid hex string', () => {
      expect(() => new Checksum('not-a-valid-hash')).toThrow(
        'Checksum must be a valid SHA-256 hex string (64 characters)'
      );
    });

    it('should throw error for wrong length hash', () => {
      const shortHash = 'a591a6d40bf420404a011733cfb7b190'; // Only 32 characters
      expect(() => new Checksum(shortHash)).toThrow(
        'Checksum must be a valid SHA-256 hex string (64 characters)'
      );
    });

    it('should throw error for hash with invalid characters', () => {
      const invalidHash = 'z591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      expect(() => new Checksum(invalidHash)).toThrow(
        'Checksum must be a valid SHA-256 hex string (64 characters)'
      );
    });
  });

  describe('verify', () => {
    it('should verify matching content hash', () => {
      const content = Buffer.from('Test file content');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const checksum = new Checksum(hash);

      expect(checksum.verify(content)).toBe(true);
    });

    it('should reject non-matching content hash', () => {
      const content = Buffer.from('Test file content');
      const wrongContent = Buffer.from('Different content');
      const hash = crypto.createHash('sha256').update(wrongContent).digest('hex');
      const checksum = new Checksum(hash);

      expect(checksum.verify(content)).toBe(false);
    });

    it('should verify empty buffer', () => {
      const content = Buffer.from('');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const checksum = new Checksum(hash);

      expect(checksum.verify(content)).toBe(true);
    });

    it('should verify large buffer', () => {
      const content = Buffer.alloc(1024 * 1024, 'a'); // 1MB of 'a'
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const checksum = new Checksum(hash);

      expect(checksum.verify(content)).toBe(true);
    });
  });

  describe('equality', () => {
    it('should return true for equal checksums', () => {
      const hash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const checksum1 = new Checksum(hash);
      const checksum2 = new Checksum(hash);

      expect(checksum1.equals(checksum2)).toBe(true);
    });

    it('should return false for different checksums', () => {
      const hash1 = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const hash2 = 'b591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const checksum1 = new Checksum(hash1);
      const checksum2 = new Checksum(hash2);

      expect(checksum1.equals(checksum2)).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      const hash1 = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const hash2 = 'A591A6D40BF420404A011733CFB7B190D62C65BF0BCDA32B57B277D9AD9F146E';
      const checksum1 = new Checksum(hash1);
      const checksum2 = new Checksum(hash2);

      expect(checksum1.equals(checksum2)).toBe(true);
    });
  });

  describe('fromBuffer', () => {
    it('should create Checksum from buffer content', () => {
      const content = Buffer.from('Test file content');
      const checksum = Checksum.fromBuffer(content);

      expect(checksum.verify(content)).toBe(true);
    });

    it('should create identical checksums from same content', () => {
      const content = Buffer.from('Test file content');
      const checksum1 = Checksum.fromBuffer(content);
      const checksum2 = Checksum.fromBuffer(content);

      expect(checksum1.equals(checksum2)).toBe(true);
    });

    it('should create different checksums from different content', () => {
      const content1 = Buffer.from('Content 1');
      const content2 = Buffer.from('Content 2');
      const checksum1 = Checksum.fromBuffer(content1);
      const checksum2 = Checksum.fromBuffer(content2);

      expect(checksum1.equals(checksum2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the hash value as string', () => {
      const hash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
      const checksum = new Checksum(hash);

      expect(checksum.toString()).toBe(hash);
    });
  });
});
