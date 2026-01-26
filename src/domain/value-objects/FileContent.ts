import { Readable } from 'stream';
import { Checksum } from './Checksum';

/**
 * MIME type for file content.
 */
export type MimeType = string;

/**
 * Value Object representing file content with metadata.
 * Supports both Buffer and Stream for flexible content handling.
 */
export class FileContent {
  private readonly _data: Buffer | Readable;
  private readonly _mimeType: MimeType;
  private readonly _sizeBytes: number;
  private readonly _checksum: Checksum;

  private constructor(
    data: Buffer | Readable,
    mimeType: MimeType,
    sizeBytes: number,
    checksum: Checksum
  ) {
    this._data = data;
    this._mimeType = mimeType;
    this._sizeBytes = sizeBytes;
    this._checksum = checksum;
  }

  /**
   * Creates a new FileContent from a Buffer.
   * @param params - File content parameters
   * @throws {Error} if validation fails
   */
  static createFromBuffer(params: {
    data: Buffer;
    mimeType: MimeType;
    checksum?: Checksum;
  }): FileContent {
    // Validate data
    if (!Buffer.isBuffer(params.data)) {
      throw new Error('data must be a Buffer');
    }

    if (params.data.length === 0) {
      throw new Error('File content cannot be empty');
    }

    // Validate mime type
    if (!params.mimeType || typeof params.mimeType !== 'string') {
      throw new Error('mimeType must be a non-empty string');
    }

    const mimeType = params.mimeType.trim();
    if (mimeType.length === 0) {
      throw new Error('mimeType cannot be empty or whitespace only');
    }

    if (!FileContent.isValidMimeType(mimeType)) {
      throw new Error(`Invalid MIME type format: ${mimeType}`);
    }

    // Compute or validate checksum
    const checksum = params.checksum || Checksum.fromBuffer(params.data);

    if (params.checksum && !checksum.verify(params.data)) {
      throw new Error('Checksum verification failed: provided checksum does not match file content');
    }

    return new FileContent(
      params.data,
      mimeType,
      params.data.length,
      checksum
    );
  }

  /**
   * Creates a new FileContent from a Stream.
   * Note: When using streams, size and checksum must be provided upfront.
   * @param params - File content parameters
   * @throws {Error} if validation fails
   */
  static createFromStream(params: {
    data: Readable;
    mimeType: MimeType;
    sizeBytes: number;
    checksum: Checksum;
  }): FileContent {
    // Validate stream
    if (!(params.data instanceof Readable)) {
      throw new Error('data must be a Readable stream');
    }

    // Validate mime type
    if (!params.mimeType || typeof params.mimeType !== 'string') {
      throw new Error('mimeType must be a non-empty string');
    }

    const mimeType = params.mimeType.trim();
    if (mimeType.length === 0) {
      throw new Error('mimeType cannot be empty or whitespace only');
    }

    if (!FileContent.isValidMimeType(mimeType)) {
      throw new Error(`Invalid MIME type format: ${mimeType}`);
    }

    // Validate size
    if (typeof params.sizeBytes !== 'number' || params.sizeBytes <= 0) {
      throw new Error('sizeBytes must be a positive number');
    }

    // Checksum is required for streams
    if (!params.checksum || !(params.checksum instanceof Checksum)) {
      throw new Error('checksum is required when using stream data');
    }

    return new FileContent(
      params.data,
      mimeType,
      params.sizeBytes,
      params.checksum
    );
  }

  /**
   * Validates MIME type format (basic validation).
   */
  private static isValidMimeType(mimeType: string): boolean {
    // Basic MIME type format: type/subtype
    const mimeTypePattern = /^[a-z]+\/[a-z0-9\-\+\.]+$/i;
    return mimeTypePattern.test(mimeType);
  }

  /**
   * Gets the file content data (Buffer or Stream).
   */
  get data(): Buffer | Readable {
    return this._data;
  }

  /**
   * Gets the MIME type.
   */
  get mimeType(): MimeType {
    return this._mimeType;
  }

  /**
   * Gets the file size in bytes.
   */
  get sizeBytes(): number {
    return this._sizeBytes;
  }

  /**
   * Gets the content checksum.
   */
  get checksum(): Checksum {
    return this._checksum;
  }

  /**
   * Checks if the content is stored as a Buffer.
   */
  isBuffer(): boolean {
    return Buffer.isBuffer(this._data);
  }

  /**
   * Checks if the content is stored as a Stream.
   */
  isStream(): boolean {
    return this._data instanceof Readable;
  }

  /**
   * Gets the content as a Buffer.
   * @throws {Error} if content is a stream
   */
  asBuffer(): Buffer {
    if (!this.isBuffer()) {
      throw new Error('Content is a stream, cannot convert to buffer directly');
    }
    return this._data as Buffer;
  }

  /**
   * Gets the content as a Stream.
   * If content is a Buffer, creates a new stream from it.
   */
  asStream(): Readable {
    if (this.isStream()) {
      return this._data as Readable;
    }

    // Create a readable stream from buffer
    const buffer = this._data as Buffer;
    return Readable.from(buffer);
  }

  /**
   * Returns a JSON-serializable representation (excludes binary data).
   */
  toJSON(): {
    mimeType: MimeType;
    sizeBytes: number;
    checksum: ReturnType<Checksum['toJSON']>;
    isStream: boolean;
  } {
    return {
      mimeType: this._mimeType,
      sizeBytes: this._sizeBytes,
      checksum: this._checksum.toJSON(),
      isStream: this.isStream(),
    };
  }
}
