import { Pool, PoolClient } from 'pg';
import { Logger } from 'pino';

/**
 * Document entity as stored in the database
 */
export interface DocumentEntity {
  id: string;
  capture_request_id: string;
  file_path: string;
  content_hash: string;
  blob_uri: string;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  created_at: Date;
  updated_at: Date;
}

export type DocumentStatus = 'RECEIVED' | 'STORED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentMetadata {
  captureTimestamp: string;
  sourceSystem: string;
  documentType: string;
  batchId?: string;
  customFields?: Record<string, unknown>;
}

/**
 * Repository interface for document persistence operations
 */
export interface IDocumentRepository {
  findById(id: string): Promise<DocumentEntity | null>;
  findByCaptureRequestId(captureRequestId: string): Promise<DocumentEntity | null>;
  save(document: Omit<DocumentEntity, 'created_at' | 'updated_at'>): Promise<DocumentEntity>;
  exists(captureRequestId: string): Promise<boolean>;
  updateStatus(id: string, status: DocumentStatus): Promise<void>;
  findByContentHash(contentHash: string): Promise<DocumentEntity[]>;
}

/**
 * PostgreSQL/SQLite implementation of DocumentRepository
 */
export class DocumentRepository implements IDocumentRepository {
  constructor(
    private readonly pool: Pool,
    private readonly logger: Logger
  ) {}

  /**
   * Find document by internal ID
   */
  async findById(id: string): Promise<DocumentEntity | null> {
    const startTime = Date.now();
    try {
      const result = await this.pool.query<DocumentEntity>(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );

      this.logger.debug({ id, duration: Date.now() - startTime }, 'Document findById query executed');

      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      this.logger.error({ error, id }, 'Error finding document by ID');
      throw new DatabaseError('Failed to find document by ID', { cause: error });
    }
  }

  /**
   * Find document by capture request ID (idempotency key)
   */
  async findByCaptureRequestId(captureRequestId: string): Promise<DocumentEntity | null> {
    const startTime = Date.now();
    try {
      const result = await this.pool.query<DocumentEntity>(
        'SELECT * FROM documents WHERE capture_request_id = $1',
        [captureRequestId]
      );

      this.logger.debug(
        { captureRequestId, duration: Date.now() - startTime },
        'Document findByCaptureRequestId query executed'
      );

      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error finding document by capture request ID');
      throw new DatabaseError('Failed to find document by capture request ID', { cause: error });
    }
  }

  /**
   * Save new document or update existing
   */
  async save(document: Omit<DocumentEntity, 'created_at' | 'updated_at'>): Promise<DocumentEntity> {
    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if document exists
      const existing = await this.findByCaptureRequestId(document.capture_request_id);

      let result;
      if (existing) {
        // Update existing document
        result = await client.query<DocumentEntity>(
          `UPDATE documents
           SET file_path = $2,
               content_hash = $3,
               blob_uri = $4,
               status = $5,
               metadata = $6,
               updated_at = NOW()
           WHERE capture_request_id = $1
           RETURNING *`,
          [
            document.capture_request_id,
            document.file_path,
            document.content_hash,
            document.blob_uri,
            document.status,
            JSON.stringify(document.metadata),
          ]
        );
      } else {
        // Insert new document
        result = await client.query<DocumentEntity>(
          `INSERT INTO documents (
            id, capture_request_id, file_path, content_hash,
            blob_uri, status, metadata, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING *`,
          [
            document.id,
            document.capture_request_id,
            document.file_path,
            document.content_hash,
            document.blob_uri,
            document.status,
            JSON.stringify(document.metadata),
          ]
        );
      }

      await client.query('COMMIT');

      const savedDocument = this.mapRow(result.rows[0]);

      this.logger.info(
        {
          documentId: savedDocument.id,
          captureRequestId: savedDocument.capture_request_id,
          duration: Date.now() - startTime,
          operation: existing ? 'update' : 'insert',
        },
        'Document saved successfully'
      );

      return savedDocument;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, document }, 'Error saving document');
      throw new DatabaseError('Failed to save document', { cause: error });
    } finally {
      client.release();
    }
  }

  /**
   * Check if document exists by capture request ID
   */
  async exists(captureRequestId: string): Promise<boolean> {
    try {
      const result = await this.pool.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM documents WHERE capture_request_id = $1) as exists',
        [captureRequestId]
      );

      return result.rows[0]?.exists || false;
    } catch (error) {
      this.logger.error({ error, captureRequestId }, 'Error checking document existence');
      throw new DatabaseError('Failed to check document existence', { cause: error });
    }
  }

  /**
   * Update document status
   */
  async updateStatus(id: string, status: DocumentStatus): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, id]
      );

      this.logger.info({ id, status }, 'Document status updated');
    } catch (error) {
      this.logger.error({ error, id, status }, 'Error updating document status');
      throw new DatabaseError('Failed to update document status', { cause: error });
    }
  }

  /**
   * Find documents by content hash (for duplicate detection)
   */
  async findByContentHash(contentHash: string): Promise<DocumentEntity[]> {
    try {
      const result = await this.pool.query<DocumentEntity>(
        'SELECT * FROM documents WHERE content_hash = $1',
        [contentHash]
      );

      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      this.logger.error({ error, contentHash }, 'Error finding documents by content hash');
      throw new DatabaseError('Failed to find documents by content hash', { cause: error });
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY,
          capture_request_id UUID NOT NULL UNIQUE,
          file_path TEXT NOT NULL,
          content_hash VARCHAR(64) NOT NULL,
          blob_uri TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
          metadata JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

          CONSTRAINT chk_status CHECK (status IN ('RECEIVED', 'STORED', 'PROCESSING', 'COMPLETED', 'FAILED'))
        );

        CREATE INDEX IF NOT EXISTS idx_documents_capture_request_id ON documents(capture_request_id);
        CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
        CREATE INDEX IF NOT EXISTS idx_documents_path_hash ON documents(file_path, content_hash);

        -- Domain events outbox table
        CREATE TABLE IF NOT EXISTS document_events_outbox (
          id UUID PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES documents(id),
          event_type VARCHAR(50) NOT NULL,
          event_payload JSONB NOT NULL,
          trace_context JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          published_at TIMESTAMPTZ,

          CONSTRAINT chk_event_type CHECK (event_type IN ('DocumentReceived', 'DocumentStored', 'DocumentIntakeFailed'))
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON document_events_outbox(created_at) WHERE published_at IS NULL;
      `);

      this.logger.info('Database schema initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error initializing database schema');
      throw new DatabaseError('Failed to initialize database schema', { cause: error });
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to DocumentEntity
   */
  private mapRow(row: any): DocumentEntity {
    return {
      id: row.id,
      capture_request_id: row.capture_request_id,
      file_path: row.file_path,
      content_hash: row.content_hash,
      blob_uri: row.blob_uri,
      status: row.status,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

/**
 * Custom error for database operations
 */
export class DatabaseError extends Error {
  public override readonly name = 'DatabaseError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory function to create DocumentRepository
 */
export function createDocumentRepository(pool: Pool, logger: Logger): IDocumentRepository {
  return new DocumentRepository(pool, logger);
}
