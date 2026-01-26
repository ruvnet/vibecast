/**
 * API Controllers - FlowManager Document Intake
 *
 * REST API controllers for handling HTTP requests.
 */

import type { Request, Response, NextFunction } from 'express';
import type { DocumentViewModel } from '../../application/queries/index.js';

/**
 * Document Intake Controller
 *
 * Handles document upload requests from Capture service.
 */
export interface DocumentIntakeController {
  /**
   * POST /api/v1/documents/intake
   *
   * Upload document from Capture service.
   * Supports multipart/form-data with file and metadata.
   */
  uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Document Query Controller
 *
 * Handles document query requests.
 */
export interface DocumentQueryController {
  /**
   * GET /api/v1/documents/:documentId
   *
   * Get document by internal ID.
   */
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;

  /**
   * GET /api/v1/documents/by-capture-request/:captureRequestId
   *
   * Get document by Capture service request ID.
   */
  getByCaptureRequestId(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Health Controller
 *
 * Handles health check and readiness probe requests.
 */
export interface HealthController {
  /**
   * GET /health
   *
   * Basic health check (liveness probe).
   */
  health(req: Request, res: Response): Promise<void>;

  /**
   * GET /ready
   *
   * Readiness probe (checks all dependencies).
   */
  ready(req: Request, res: Response): Promise<void>;
}

/**
 * Document intake response DTO
 */
export interface DocumentIntakeResponseDto {
  readonly documentId: string;
  readonly captureRequestId: string;
  readonly status: string;
  readonly blobUri: string;
  readonly receivedAt: string;
  readonly storedAt?: string;
  readonly metadata: DocumentMetadataDto;
  readonly traceId?: string;
}

/**
 * Document metadata DTO
 */
export interface DocumentMetadataDto {
  readonly captureTimestamp: string;
  readonly sourceSystem: string;
  readonly documentType: string;
  readonly batchId?: string;
  readonly customFields: Record<string, unknown>;
}

/**
 * Error response DTO
 */
export interface ErrorResponseDto {
  readonly error: string;
  readonly code: string;
  readonly message: string;
  readonly details?: ReadonlyArray<ErrorDetailDto>;
  readonly traceId?: string;
}

/**
 * Error detail DTO
 */
export interface ErrorDetailDto {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Health response DTO
 */
export interface HealthResponseDto {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: string;
  readonly checks?: ReadonlyArray<HealthCheckDto>;
}

/**
 * Health check DTO
 */
export interface HealthCheckDto {
  readonly name: string;
  readonly status: 'healthy' | 'unhealthy';
  readonly latencyMs?: number;
  readonly message?: string;
}

/**
 * Controller factory
 */
export interface ControllerFactory {
  createDocumentIntakeController(): DocumentIntakeController;
  createDocumentQueryController(): DocumentQueryController;
  createHealthController(): HealthController;
}

/**
 * Route registration function type
 */
export type RouteRegistrar = (app: Express.Application) => void;
