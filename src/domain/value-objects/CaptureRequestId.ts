import { validate as uuidValidate, version as uuidVersion } from 'uuid';

/**
 * Value Object representing a unique capture request identifier from the Capture service.
 * Used as the primary idempotency key to prevent duplicate document processing.
 */
export class CaptureRequestId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Creates a new CaptureRequestId from a UUID string.
   * @param value - UUID v4 string from Capture service
   * @throws {Error} if the UUID is invalid
   */
  static create(value: string): CaptureRequestId {
    if (!value || typeof value !== 'string') {
      throw new Error('CaptureRequestId value must be a non-empty string');
    }

    const trimmedValue = value.trim();

    if (!uuidValidate(trimmedValue)) {
      throw new Error(`Invalid UUID format for CaptureRequestId: ${trimmedValue}`);
    }

    if (uuidVersion(trimmedValue) !== 4) {
      throw new Error(`CaptureRequestId must be a UUID v4, received version ${uuidVersion(trimmedValue)}`);
    }

    return new CaptureRequestId(trimmedValue);
  }

  /**
   * Validates a UUID string without creating an instance.
   * @param value - UUID string to validate
   * @returns true if valid UUID v4, false otherwise
   */
  static validate(value: string): boolean {
    try {
      if (!value || typeof value !== 'string') {
        return false;
      }
      const trimmedValue = value.trim();
      return uuidValidate(trimmedValue) && uuidVersion(trimmedValue) === 4;
    } catch {
      return false;
    }
  }

  /**
   * Gets the UUID string value.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Compares this CaptureRequestId with another for equality.
   * @param other - Another CaptureRequestId to compare
   * @returns true if the values are equal
   */
  equals(other: CaptureRequestId): boolean {
    if (!other || !(other instanceof CaptureRequestId)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Returns the string representation of this CaptureRequestId.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): string {
    return this._value;
  }
}
