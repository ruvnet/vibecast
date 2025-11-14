/**
 * Tool Executor
 * Handles tool invocation and execution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ToolRequest,
  ToolResponse,
  ResponseStatus,
  ExecutionMode,
  ToolDescriptor,
} from '../types/protocol.js';
import { ToolDiscovery } from './tool-discovery.js';
import { validateInput, validateOutput } from '../utils/validator.js';

export interface ToolHandler {
  (args: Record<string, any>, context?: Record<string, any>): Promise<any>;
}

export class ToolExecutor {
  private handlers: Map<string, ToolHandler> = new Map();
  private toolDiscovery: ToolDiscovery;
  private asyncJobs: Map<string, Promise<any>> = new Map();

  constructor(toolDiscovery: ToolDiscovery) {
    this.toolDiscovery = toolDiscovery;
  }

  /**
   * Register a tool handler
   */
  registerHandler(toolId: string, handler: ToolHandler): void {
    this.handlers.set(toolId, handler);
    console.log(`[Tool Executor] Registered handler for tool: ${toolId}`);
  }

  /**
   * Execute a tool request
   */
  async execute(request: ToolRequest): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      // Get tool descriptor
      const tool = this.toolDiscovery.getTool(request.toolId);
      if (!tool) {
        return this.createErrorResponse(
          request.requestId,
          'TOOL_NOT_FOUND',
          `Tool not found: ${request.toolId}`,
          startTime
        );
      }

      // Validate input
      const validationError = validateInput(request.arguments, tool.inputSchema);
      if (validationError) {
        return this.createErrorResponse(
          request.requestId,
          'INVALID_INPUT',
          validationError,
          startTime
        );
      }

      // Get handler
      const handler = this.handlers.get(request.toolId);
      if (!handler) {
        return this.createErrorResponse(
          request.requestId,
          'HANDLER_NOT_FOUND',
          `No handler registered for tool: ${request.toolId}`,
          startTime
        );
      }

      // Execute based on mode
      if (request.executionMode === ExecutionMode.ASYNC) {
        return await this.executeAsync(request, handler, tool, startTime);
      } else {
        return await this.executeSync(request, handler, tool, startTime);
      }
    } catch (error) {
      return this.createErrorResponse(
        request.requestId,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Execute synchronously
   */
  private async executeSync(
    request: ToolRequest,
    handler: ToolHandler,
    tool: ToolDescriptor,
    startTime: number
  ): Promise<ToolResponse> {
    try {
      const result = await handler(request.arguments, request.context);

      // Validate output
      const outputValidationError = validateOutput(result, tool.outputSchema);
      if (outputValidationError) {
        return this.createErrorResponse(
          request.requestId,
          'INVALID_OUTPUT',
          outputValidationError,
          startTime
        );
      }

      const executionDuration = Date.now() - startTime;

      return {
        requestId: request.requestId,
        status: ResponseStatus.SUCCESS,
        result,
        metadata: {
          executionDuration,
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.requestId,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Execute asynchronously
   */
  private async executeAsync(
    request: ToolRequest,
    handler: ToolHandler,
    tool: ToolDescriptor,
    startTime: number
  ): Promise<ToolResponse> {
    const jobHandle = uuidv4();

    // Create async job
    const job = handler(request.arguments, request.context).then((result) => {
      // Validate output
      const outputValidationError = validateOutput(result, tool.outputSchema);
      if (outputValidationError) {
        throw new Error(outputValidationError);
      }
      return result;
    });

    this.asyncJobs.set(jobHandle, job);

    // Clean up job after completion
    job.finally(() => {
      setTimeout(() => {
        this.asyncJobs.delete(jobHandle);
      }, 60000); // Keep job for 1 minute
    });

    const executionDuration = Date.now() - startTime;

    return {
      requestId: request.requestId,
      status: ResponseStatus.PENDING,
      metadata: {
        executionDuration,
        jobHandle,
      },
    };
  }

  /**
   * Get async job result
   */
  async getJobResult(jobHandle: string): Promise<any> {
    const job = this.asyncJobs.get(jobHandle);
    if (!job) {
      throw new Error(`Job not found: ${jobHandle}`);
    }
    return await job;
  }

  /**
   * Check if job exists
   */
  hasJob(jobHandle: string): boolean {
    return this.asyncJobs.has(jobHandle);
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    requestId: string,
    code: string,
    message: string,
    startTime: number
  ): ToolResponse {
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
