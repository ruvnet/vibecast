/**
 * Resource Handler
 * Handles resource fetching and content delivery
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ResourceRequest,
  ResourceResponse,
  ResponseStatus,
  ResourceDescriptor,
} from '../types/protocol.js';
import { ResourceDiscovery } from './resource-discovery.js';

export interface ResourceHandler {
  (parameters?: Record<string, any>, context?: Record<string, any>): Promise<any>;
}

export class ResourceExecutor {
  private handlers: Map<string, ResourceHandler> = new Map();
  private resourceDiscovery: ResourceDiscovery;

  constructor(resourceDiscovery: ResourceDiscovery) {
    this.resourceDiscovery = resourceDiscovery;
  }

  /**
   * Register a resource handler
   */
  registerHandler(resourceId: string, handler: ResourceHandler): void {
    this.handlers.set(resourceId, handler);
    console.log(`[Resource Executor] Registered handler for resource: ${resourceId}`);
  }

  /**
   * Fetch a resource
   */
  async fetch(request: ResourceRequest): Promise<ResourceResponse> {
    const startTime = Date.now();

    try {
      // Get resource descriptor
      const resource = this.resourceDiscovery.getResource(request.resourceId);
      if (!resource) {
        return this.createErrorResponse(
          request.requestId,
          'RESOURCE_NOT_FOUND',
          `Resource not found: ${request.resourceId}`,
          startTime
        );
      }

      // Get handler
      const handler = this.handlers.get(request.resourceId);
      if (!handler) {
        return this.createErrorResponse(
          request.requestId,
          'HANDLER_NOT_FOUND',
          `No handler registered for resource: ${request.resourceId}`,
          startTime
        );
      }

      // Execute handler
      const content = await handler(request.parameters, { sessionId: request.sessionId });

      const executionDuration = Date.now() - startTime;
      const contentSize = typeof content === 'string' ? content.length : JSON.stringify(content).length;

      return {
        requestId: request.requestId,
        status: ResponseStatus.SUCCESS,
        content,
        mimeType: resource.mimeType,
        metadata: {
          executionDuration,
          size: contentSize,
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.requestId,
        'FETCH_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    requestId: string,
    code: string,
    message: string,
    startTime: number
  ): ResourceResponse {
    return {
      requestId,
      status: ResponseStatus.ERROR,
      error: {
        code,
        message,
      },
      metadata: {
        executionDuration: Date.now() - startTime,
      },
    };
  }
}
