/**
 * Value Object representing a URI to a blob in cloud storage.
 * Follows Azure Blob Storage URI format.
 */
export class BlobUri {
  private readonly _container: string;
  private readonly _path: string;
  private readonly _fullUri: string;

  private constructor(container: string, path: string, fullUri: string) {
    this._container = container;
    this._path = path;
    this._fullUri = fullUri;
  }

  /**
   * Creates a new BlobUri from components.
   * @param params - Blob URI components
   * @throws {Error} if validation fails
   */
  static create(params: {
    container: string;
    path: string;
    storageAccountName?: string;
    baseUrl?: string;
  }): BlobUri {
    // Validate container
    if (!params.container || typeof params.container !== 'string') {
      throw new Error('container must be a non-empty string');
    }

    const container = params.container.trim().toLowerCase();
    if (container.length === 0) {
      throw new Error('container cannot be empty or whitespace only');
    }

    if (!BlobUri.isValidContainerName(container)) {
      throw new Error(`Invalid container name: ${container}. Must be 3-63 lowercase alphanumeric characters or hyphens.`);
    }

    // Validate path
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('path must be a non-empty string');
    }

    const path = params.path.trim();
    if (path.length === 0) {
      throw new Error('path cannot be empty or whitespace only');
    }

    // Remove leading slash from path if present
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

    // Construct full URI
    let fullUri: string;
    if (params.baseUrl) {
      // Custom base URL provided
      const baseUrl = params.baseUrl.endsWith('/') ? params.baseUrl.slice(0, -1) : params.baseUrl;
      fullUri = `${baseUrl}/${container}/${normalizedPath}`;
    } else if (params.storageAccountName) {
      // Azure Blob Storage format
      fullUri = `https://${params.storageAccountName}.blob.core.windows.net/${container}/${normalizedPath}`;
    } else {
      throw new Error('Either storageAccountName or baseUrl must be provided');
    }

    return new BlobUri(container, normalizedPath, fullUri);
  }

  /**
   * Creates a new BlobUri from a full URI string.
   * @param fullUri - Complete blob storage URI
   * @throws {Error} if URI format is invalid
   */
  static fromUri(fullUri: string): BlobUri {
    if (!fullUri || typeof fullUri !== 'string') {
      throw new Error('URI must be a non-empty string');
    }

    const trimmedUri = fullUri.trim();

    try {
      const url = new URL(trimmedUri);

      // Extract container and path from pathname
      // Format: /{container}/{path}
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);

      if (pathParts.length < 2) {
        throw new Error('URI must contain at least container and path');
      }

      const container = pathParts[0];
      const path = pathParts.slice(1).join('/');

      return new BlobUri(container, path, trimmedUri);
    } catch (error) {
      throw new Error(`Invalid blob URI format: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Validates Azure Blob Storage container name rules.
   * - Must be 3-63 characters
   * - Lowercase letters, numbers, and hyphens only
   * - Must start with letter or number
   * - Cannot contain consecutive hyphens
   */
  private static isValidContainerName(name: string): boolean {
    if (name.length < 3 || name.length > 63) {
      return false;
    }

    // Must match pattern: lowercase alphanumeric, hyphens allowed but not consecutive or at start/end
    const pattern = /^[a-z0-9]([a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/;
    return pattern.test(name);
  }

  /**
   * Gets the container name.
   */
  get container(): string {
    return this._container;
  }

  /**
   * Gets the blob path within the container.
   */
  get path(): string {
    return this._path;
  }

  /**
   * Gets the complete blob URI.
   */
  get fullUri(): string {
    return this._fullUri;
  }

  /**
   * Gets the file name from the path.
   */
  get fileName(): string {
    const parts = this._path.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Compares this BlobUri with another for equality.
   */
  equals(other: BlobUri): boolean {
    if (!other || !(other instanceof BlobUri)) {
      return false;
    }
    return this._fullUri === other._fullUri;
  }

  /**
   * Returns the string representation of this BlobUri.
   */
  toString(): string {
    return this._fullUri;
  }

  /**
   * Returns a JSON-serializable representation.
   */
  toJSON(): {
    container: string;
    path: string;
    fullUri: string;
  } {
    return {
      container: this._container,
      path: this._path,
      fullUri: this._fullUri,
    };
  }
}
