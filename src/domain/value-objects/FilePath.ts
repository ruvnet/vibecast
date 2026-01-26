import { createHash } from 'crypto';
import * as path from 'path';

/**
 * Value Object representing a file path with parsing and hash generation capabilities.
 * Used for content-based deduplication and blob storage path generation.
 */
export class FilePath {
  private readonly _directory: string;
  private readonly _filename: string;
  private readonly _extension: string;
  private readonly _fullPath: string;

  private constructor(directory: string, filename: string, extension: string, fullPath: string) {
    this._directory = directory;
    this._filename = filename;
    this._extension = extension;
    this._fullPath = fullPath;
  }

  /**
   * Creates a new FilePath from a full path string.
   * @param fullPath - Complete file path (e.g., "/capture/batch-2026-01/invoice-001.pdf")
   * @throws {Error} if the path is invalid
   */
  static create(fullPath: string): FilePath {
    if (!fullPath || typeof fullPath !== 'string') {
      throw new Error('FilePath must be a non-empty string');
    }

    const trimmedPath = fullPath.trim();

    if (trimmedPath.length === 0) {
      throw new Error('FilePath cannot be empty or whitespace only');
    }

    // Validate path doesn't contain dangerous patterns
    if (FilePath.containsPathTraversal(trimmedPath)) {
      throw new Error('FilePath contains path traversal patterns');
    }

    // Parse the path components
    const directory = path.dirname(trimmedPath);
    const basename = path.basename(trimmedPath);
    const extension = path.extname(basename);
    const filename = extension ? basename.slice(0, -extension.length) : basename;

    if (!filename) {
      throw new Error('FilePath must contain a valid filename');
    }

    return new FilePath(directory, filename, extension, trimmedPath);
  }

  /**
   * Checks for path traversal patterns.
   */
  private static containsPathTraversal(pathStr: string): boolean {
    const normalized = path.normalize(pathStr);
    return normalized.includes('..') || pathStr.includes('..\\') || pathStr.includes('../');
  }

  /**
   * Gets the directory component of the path.
   */
  get directory(): string {
    return this._directory;
  }

  /**
   * Gets the filename without extension.
   */
  get filename(): string {
    return this._filename;
  }

  /**
   * Gets the file extension (including the dot).
   */
  get extension(): string {
    return this._extension;
  }

  /**
   * Gets the complete file path.
   */
  get fullPath(): string {
    return this._fullPath;
  }

  /**
   * Generates a deterministic SHA-256 hash of the file path.
   * Used for content-based deduplication.
   * @returns hex-encoded SHA-256 hash
   */
  toHash(): string {
    return createHash('sha256')
      .update(this._fullPath)
      .digest('hex');
  }

  /**
   * Generates a sanitized filename safe for blob storage.
   * Removes special characters and normalizes the path.
   */
  toSanitizedName(): string {
    const sanitized = this._filename.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitized}${this._extension}`;
  }

  /**
   * Compares this FilePath with another for equality.
   */
  equals(other: FilePath): boolean {
    if (!other || !(other instanceof FilePath)) {
      return false;
    }
    return this._fullPath === other._fullPath;
  }

  /**
   * Returns the string representation of this FilePath.
   */
  toString(): string {
    return this._fullPath;
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    directory: string;
    filename: string;
    extension: string;
    fullPath: string;
  } {
    return {
      directory: this._directory,
      filename: this._filename,
      extension: this._extension,
      fullPath: this._fullPath,
    };
  }
}
