/**
 * MCP Server
 * Main server implementation with STDIO transport
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ServerConfig,
  ToolRequest,
  ToolResponse,
  ToolRequestSchema,
  ResourceRequest,
  ResourceResponse,
  ResourceRequestSchema,
  ResponseStatus,
} from '../types/protocol.js';
import { ToolDiscovery } from './tool-discovery.js';
import { ToolExecutor, ToolHandler } from './tool-executor.js';
import { ResourceDiscovery } from './resource-discovery.js';
import { ResourceExecutor, ResourceHandler } from './resource-executor.js';
import { AuthManager } from '../security/auth.js';
import { AuditLogger } from '../security/audit-log.js';

export class MCPServer {
  private config: ServerConfig;
  private toolDiscovery: ToolDiscovery;
  private toolExecutor: ToolExecutor;
  private resourceDiscovery: ResourceDiscovery;
  private resourceExecutor: ResourceExecutor;
  private authManager: AuthManager;
  private auditLogger: AuditLogger;
  private initialized: boolean = false;

  constructor(config: ServerConfig) {
    this.config = config;
    this.toolDiscovery = new ToolDiscovery(config.toolsDirectory);
    this.toolExecutor = new ToolExecutor(this.toolDiscovery);
    this.resourceDiscovery = new ResourceDiscovery(config.resourcesDirectory);
    this.resourceExecutor = new ResourceExecutor(this.resourceDiscovery);
    this.authManager = new AuthManager(config.auth);
    this.auditLogger = new AuditLogger(
      './logs',
      config.logging?.auditLog ?? true
    );
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`[MCP Server] Initializing ${this.config.name} v${this.config.version}`);

    // Initialize audit logger
    await this.auditLogger.initialize();

    // Discover tools
    await this.toolDiscovery.discoverTools();

    // Discover resources
    await this.resourceDiscovery.discoverResources();

    this.initialized = true;
    console.log('[MCP Server] Server initialized successfully');
  }

  /**
   * Register a tool handler
   */
  registerTool(toolId: string, handler: ToolHandler): void {
    this.toolExecutor.registerHandler(toolId, handler);
  }

  /**
   * Register a resource handler
   */
  registerResource(resourceId: string, handler: ResourceHandler): void {
    this.resourceExecutor.registerHandler(resourceId, handler);
  }

  /**
   * Handle a tool request
   */
  async handleRequest(
    requestData: any,
    headers: Record<string, string> = {}
  ): Promise<ToolResponse> {
    const startTime = Date.now();
    let requestId: string;

    try {
      // Parse and validate request
      const request = ToolRequestSchema.parse(requestData);
      requestId = request.requestId;

      // Authenticate
      const authResult = await this.authManager.authenticate(headers);
      if (!authResult.authenticated) {
        const response: ToolResponse = {
          requestId,
          status: ResponseStatus.ERROR,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: authResult.error || 'Authentication failed',
          },
          metadata: {
            executionDuration: Date.now() - startTime,
          },
        };

        await this.auditLogger.logAuthentication(
          requestId,
          ResponseStatus.ERROR,
          undefined,
          { error: authResult.error }
        );

        return response;
      }

      // Execute tool
      const response = await this.toolExecutor.execute(request);

      // Log execution
      await this.auditLogger.logInvocation(
        requestId,
        request.toolId,
        response.status,
        response.metadata?.executionDuration || 0,
        authResult.userId,
        {
          executionMode: request.executionMode,
          hasJobHandle: !!response.metadata?.jobHandle,
        }
      );

      return response;
    } catch (error) {
      requestId = uuidv4();
      const response: ToolResponse = {
        requestId,
        status: ResponseStatus.ERROR,
        error: {
          code: 'REQUEST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          executionDuration: Date.now() - startTime,
        },
      };

      return response;
    }
  }

  /**
   * Get all available tools
   */
  getTools() {
    return this.toolDiscovery.getAllTools();
  }

  /**
   * Get a specific tool
   */
  getTool(toolId: string) {
    return this.toolDiscovery.getTool(toolId);
  }

  /**
   * Search tools
   */
  searchTools(keyword: string) {
    return this.toolDiscovery.searchTools(keyword);
  }

  /**
   * Get tools by tag
   */
  getToolsByTag(tag: string) {
    return this.toolDiscovery.getToolsByTag(tag);
  }

  /**
   * Reload tools from disk
   */
  async reloadTools() {
    await this.toolDiscovery.reload();
  }

  /**
   * Get async job result
   */
  async getJobResult(jobHandle: string) {
    return await this.toolExecutor.getJobResult(jobHandle);
  }

  /**
   * Handle a resource request
   */
  async handleResourceRequest(
    requestData: any,
    headers: Record<string, string> = {}
  ): Promise<ResourceResponse> {
    const startTime = Date.now();
    let requestId: string;

    try {
      // Parse and validate request
      const request = ResourceRequestSchema.parse(requestData);
      requestId = request.requestId;

      // Authenticate
      const authResult = await this.authManager.authenticate(headers);
      if (!authResult.authenticated) {
        const response: ResourceResponse = {
          requestId,
          status: ResponseStatus.ERROR,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: authResult.error || 'Authentication failed',
          },
          metadata: {
            executionDuration: Date.now() - startTime,
          },
        };

        await this.auditLogger.logAuthentication(
          requestId,
          ResponseStatus.ERROR,
          undefined,
          { error: authResult.error }
        );

        return response;
      }

      // Fetch resource
      const response = await this.resourceExecutor.fetch(request);

      // Log execution
      await this.auditLogger.log({
        timestamp: new Date().toISOString(),
        requestId,
        toolId: request.resourceId,
        userId: authResult.userId,
        action: 'resource',
        status: response.status,
        duration: response.metadata?.executionDuration || 0,
      });

      return response;
    } catch (error) {
      requestId = uuidv4();
      const response: ResourceResponse = {
        requestId,
        status: ResponseStatus.ERROR,
        error: {
          code: 'REQUEST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          executionDuration: Date.now() - startTime,
        },
      };

      return response;
    }
  }

  /**
   * Get all available resources
   */
  getResources() {
    return this.resourceDiscovery.getAllResources();
  }

  /**
   * Get a specific resource
   */
  getResource(resourceId: string) {
    return this.resourceDiscovery.getResource(resourceId);
  }

  /**
   * Search resources
   */
  searchResources(keyword: string) {
    return this.resourceDiscovery.searchResources(keyword);
  }

  /**
   * Get resources by tag
   */
  getResourcesByTag(tag: string) {
    return this.resourceDiscovery.getResourcesByTag(tag);
  }

  /**
   * Reload resources from disk
   */
  async reloadResources() {
    await this.resourceDiscovery.reload();
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      description: this.config.description,
      transport: this.config.transport,
      toolCount: this.toolDiscovery.getAllTools().length,
      resourceCount: this.resourceDiscovery.getAllResources().length,
      authType: this.config.auth?.type || 'none',
    };
  }

  /**
   * Get server config
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get auth manager
   */
  getAuthManager() {
    return this.authManager;
  }

  /**
   * Get audit logger
   */
  getAuditLogger() {
    return this.auditLogger;
  }
}
