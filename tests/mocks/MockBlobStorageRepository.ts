export interface BlobUploadResult {
  uri: string;
  etag: string;
  versionId?: string;
  contentMD5: string;
  uploadDurationMs: number;
}

export interface BlobStorageRepository {
  store(content: Buffer, path: string): Promise<BlobUploadResult>;
  exists(uri: string): Promise<boolean>;
  delete(uri: string): Promise<void>;
}

export class MockBlobStorageRepository implements BlobStorageRepository {
  private blobs: Map<string, Buffer> = new Map();

  store = jest.fn(async (content: Buffer, path: string): Promise<BlobUploadResult> => {
    const uri = `https://storage.example.com/${path}`;
    this.blobs.set(uri, content);

    return {
      uri,
      etag: `"${Math.random().toString(36).substring(7)}"`,
      contentMD5: Buffer.from(content).toString('base64'),
      uploadDurationMs: Math.floor(Math.random() * 100) + 50,
    };
  });

  exists = jest.fn(async (uri: string): Promise<boolean> => {
    return this.blobs.has(uri);
  });

  delete = jest.fn(async (uri: string): Promise<void> => {
    this.blobs.delete(uri);
  });

  // Helper methods for testing
  clear(): void {
    this.blobs.clear();
  }

  getBlob(uri: string): Buffer | undefined {
    return this.blobs.get(uri);
  }

  getAllUris(): string[] {
    return Array.from(this.blobs.keys());
  }
}
