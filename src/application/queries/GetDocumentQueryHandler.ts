/**
 * Get Document Query Handler
 *
 * Handles queries to retrieve document details by document ID.
 */

import { GetDocumentQuery } from './GetDocumentQuery';
import { DocumentDto } from '../types/DocumentDto';

export interface GetDocumentQueryHandlerDependencies {
  documentRepository: IDocumentRepository;
  telemetryService: ITelemetryService;
  logger: ILogger;
}

export class GetDocumentQueryHandler {
  constructor(private readonly deps: GetDocumentQueryHandlerDependencies) {}

  /**
   * Execute the get document query
   *
   * @param query - The get document query
   * @returns Document details or null if not found
   */
  async execute(query: GetDocumentQuery): Promise<DocumentDto | null> {
    const { documentRepository, telemetryService, logger } = this.deps;

    return telemetryService.startSpan('document.query.by_id', async (span) => {
      span.setAttributes({
        'document.id': query.documentId,
      });

      logger.info('Querying document by ID', {
        documentId: query.documentId,
      });

      try {
        const document = await documentRepository.findById(query.documentId);

        if (!document) {
          logger.info('Document not found', { documentId: query.documentId });
          span.setAttributes({ 'query.found': false });
          return null;
        }

        span.setAttributes({
          'query.found': true,
          'document.status': document.status,
        });

        // Map domain entity to DTO
        return this.mapToDto(document);
      } catch (error) {
        logger.error('Error querying document', {
          documentId: query.documentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        span.recordException(error as Error);
        throw error;
      }
    });
  }

  /**
   * Map domain document entity to DTO
   */
  private mapToDto(document: any): DocumentDto {
    return {
      documentId: document.id,
      captureRequestId: document.captureRequestId,
      filePath: document.filePath,
      blobUri: document.blobUri,
      status: document.status,
      metadata: document.metadata,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      checksum: document.checksum,
    };
  }
}

// Type definitions

interface IDocumentRepository {
  findById(documentId: string): Promise<any | null>;
}

interface ITelemetryService {
  startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

interface Span {
  setAttributes(attrs: Record<string, any>): void;
  recordException(error: Error): void;
}

interface ILogger {
  info(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}
