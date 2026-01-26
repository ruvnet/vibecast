import crypto from 'crypto';
import path from 'path';

// FilePath value object implementation
class FilePath {
  readonly directory: string;
  readonly filename: string;
  readonly extension: string;
  readonly fullPath: string;

  constructor(fullPath: string) {
    this.validatePath(fullPath);
    this.fullPath = fullPath;
    this.directory = path.dirname(fullPath);
    this.extension = path.extname(fullPath);
    this.filename = path.basename(fullPath, this.extension);
  }

  private validatePath(filePath: string): void {
    if (!filePath || filePath.trim() === '') {
      throw new Error('FilePath cannot be empty');
    }

    // Path traversal prevention
    if (filePath.includes('..')) {
      throw new Error('FilePath cannot contain path traversal sequences (..)');
    }

    // Null byte injection prevention
    if (filePath.includes('\0')) {
      throw new Error('FilePath cannot contain null bytes');
    }

    // Must be an absolute path
    if (!path.isAbsolute(filePath)) {
      throw new Error('FilePath must be absolute');
    }
  }

  toHash(): string {
    return crypto.createHash('sha256').update(this.fullPath).digest('hex');
  }

  equals(other: FilePath): boolean {
    return this.fullPath === other.fullPath;
  }

  toString(): string {
    return this.fullPath;
  }
}

describe('FilePath', () => {
  describe('construction', () => {
    it('should create a valid FilePath with absolute path', () => {
      const fullPath = '/capture/batch-2026-01/invoice-001.pdf';
      const filePath = new FilePath(fullPath);

      expect(filePath.fullPath).toBe(fullPath);
      expect(filePath.directory).toBe('/capture/batch-2026-01');
      expect(filePath.filename).toBe('invoice-001');
      expect(filePath.extension).toBe('.pdf');
    });

    it('should throw error for empty path', () => {
      expect(() => new FilePath('')).toThrow('FilePath cannot be empty');
    });

    it('should throw error for whitespace-only path', () => {
      expect(() => new FilePath('   ')).toThrow('FilePath cannot be empty');
    });

    it('should throw error for relative path', () => {
      expect(() => new FilePath('relative/path/file.pdf')).toThrow('FilePath must be absolute');
    });

    it('should throw error for path traversal attempts', () => {
      expect(() => new FilePath('/capture/../../../etc/passwd')).toThrow(
        'FilePath cannot contain path traversal sequences (..)'
      );
    });

    it('should throw error for null byte injection', () => {
      expect(() => new FilePath('/capture/file.pdf\0.txt')).toThrow(
        'FilePath cannot contain null bytes'
      );
    });
  });

  describe('parsing', () => {
    it('should correctly parse directory path', () => {
      const filePath = new FilePath('/capture/2026/01/26/document.pdf');

      expect(filePath.directory).toBe('/capture/2026/01/26');
    });

    it('should correctly parse filename without extension', () => {
      const filePath = new FilePath('/capture/invoice-001.pdf');

      expect(filePath.filename).toBe('invoice-001');
    });

    it('should correctly parse file extension', () => {
      const filePath = new FilePath('/capture/document.pdf');

      expect(filePath.extension).toBe('.pdf');
    });

    it('should handle files with no extension', () => {
      const filePath = new FilePath('/capture/document');

      expect(filePath.extension).toBe('');
      expect(filePath.filename).toBe('document');
    });

    it('should handle files with multiple dots', () => {
      const filePath = new FilePath('/capture/document.backup.pdf');

      expect(filePath.extension).toBe('.pdf');
      expect(filePath.filename).toBe('document.backup');
    });
  });

  describe('toHash', () => {
    it('should generate consistent hash for same path', () => {
      const path1 = new FilePath('/capture/document.pdf');
      const path2 = new FilePath('/capture/document.pdf');

      expect(path1.toHash()).toBe(path2.toHash());
    });

    it('should generate different hashes for different paths', () => {
      const path1 = new FilePath('/capture/document1.pdf');
      const path2 = new FilePath('/capture/document2.pdf');

      expect(path1.toHash()).not.toBe(path2.toHash());
    });

    it('should generate 64-character hex hash (SHA-256)', () => {
      const filePath = new FilePath('/capture/document.pdf');
      const hash = filePath.toHash();

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('equality', () => {
    it('should return true for equal file paths', () => {
      const path1 = new FilePath('/capture/document.pdf');
      const path2 = new FilePath('/capture/document.pdf');

      expect(path1.equals(path2)).toBe(true);
    });

    it('should return false for different file paths', () => {
      const path1 = new FilePath('/capture/document1.pdf');
      const path2 = new FilePath('/capture/document2.pdf');

      expect(path1.equals(path2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the full path as string', () => {
      const fullPath = '/capture/batch-2026-01/invoice-001.pdf';
      const filePath = new FilePath(fullPath);

      expect(filePath.toString()).toBe(fullPath);
    });
  });
});
