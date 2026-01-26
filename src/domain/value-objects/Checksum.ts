import { createHash } from 'crypto';

/**
 * Supported checksum algorithms.
 */
export type ChecksumAlgorithm = 'SHA-256';

/**
 * Value Object representing a cryptographic checksum for file integrity verification.
 * Uses SHA-256 algorithm for content verification.
 */
export class Checksum {
  private readonly _algorithm: ChecksumAlgorithm;
  private readonly _value: string;

  private constructor(algorithm: ChecksumAlgorithm, value: string) {
    this._algorithm = algorithm;
    this._value = value;
  }

  /**
   * Creates a new Checksum from a hex-encoded hash string.
   * @param value - Hex-encoded SHA-256 hash
   * @param algorithm - Hashing algorithm (default: SHA-256)
   * @throws {Error} if the checksum format is invalid
   */
  static create(value: string, algorithm: ChecksumAlgorithm = 'SHA-256'): Checksum {
    if (!value || typeof value !== 'string') {
      throw new Error('Checksum value must be a non-empty string');
    }

    const trimmedValue = value.trim().toLowerCase();

    if (algorithm !== 'SHA-256') {
      throw new Error(`Unsupported checksum algorithm: ${algorithm}. Only SHA-256 is supported.`);
    }

    // SHA-256 produces 64 hex characters
    if (trimmedValue.length !== 64) {
      throw new Error(`Invalid SHA-256 checksum length: expected 64 characters, got ${trimmedValue.length}`);
    }

    // Validate hex format
    if (!/^[a-f0-9]{64}$/.test(trimmedValue)) {
      throw new Error('Invalid checksum format: must be 64 hexadecimal characters');
    }

    return new Checksum(algorithm, trimmedValue);
  }

  /**
   * Computes a SHA-256 checksum from buffer content.
   * @param content - File content buffer
   * @returns Checksum instance
   */
  static fromBuffer(content: Buffer): Checksum {
    const hash = createHash('sha256')
      .update(content)
      .digest('hex');

    return new Checksum('SHA-256', hash);
  }

  /**
   * Gets the checksum algorithm.
   */
  get algorithm(): ChecksumAlgorithm {
    return this._algorithm;
  }

  /**
   * Gets the hex-encoded checksum value.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Verifies content against this checksum.
   * @param content - File content buffer to verify
   * @returns true if content matches checksum, false otherwise
   */
  verify(content: Buffer): boolean {
    try {
      const computedChecksum = Checksum.fromBuffer(content);
      return this._value === computedChecksum._value;
    } catch {
      return false;
    }
  }

  /**
   * Compares this Checksum with another for equality.
   */
  equals(other: Checksum): boolean {
    if (!other || !(other instanceof Checksum)) {
      return false;
    }
    return this._algorithm === other._algorithm && this._value === other._value;
  }

  /**
   * Returns the string representation of this Checksum.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    algorithm: ChecksumAlgorithm;
    value: string;
  } {
    return {
      algorithm: this._algorithm,
      value: this._value,
    };
  }
}
