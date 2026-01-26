/**
 * Get Document By Capture Request Query Handler
 *
 * Handles queries to retrieve document details by capture request ID.
 */

import { GetDocumentByCaptureRequestQuery } from './GetDocumentByCaptureRequestQuery';
import { DocumentDto } from '../types/DocumentDto';

export interface GetDocumentByCaptureRequestQueryHandlerDependencies {
  documentRepository: IDocumentRepository;
  telemetryService: ITelemetryService;
  logger: ILogger;
}

export class GetDocumentByCaptureRequestQueryHandler {
  constructor(
    private readonly deps: GetDocumentByCaptureRequestQueryHandlerDependencies
  ) {}

  /**
   * Execute the get document by capture request query
   *
   * @param query - The query object
   * @returns Document details or null if not found
   */
  async execute(
    query: GetDocumentByCaptureRequestQuery
  ): Promise<DocumentDto | null> {
    const { documentRepository, telemetryService, logger } = this.deps;

    return telemetryService.startSpan(
      'document.query.by_capture_request',
      async (span) => {
        span.setAttributes({
          'document.capture_request_id': query.captureRequestId,
        });

        logger.info('Querying document by capture request ID', {
          captureRequestId: query.captureRequestId,
        });

        try {
          const document = await documentRepository.findByCaptureRequestId(
            query.captureRequestId
          );

          if (!document) {
            logger.info('Document not found for capture request', {
              captureRequestId: query.captureRequestId,
            });
            span.setAttributes({ 'query.found': false });
            return null;
          }

          span.setAttributes({
            'query.found': true,
            'document.id': document.id,
            'document.status': document.status,
          });

          // Map domain entity to DTO
          return this.mapToDto(document);
        } catch (error) {
          logger.error('Error querying document by capture request', {
            captureRequestId: query.captureRequestId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          span.recordException(error as Error);
          throw error;
        }
      }
    );
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
  findByCaptureRequestId(captureRequestId: string): Promise<any | null>;
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
