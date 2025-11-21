import { PubNubService } from '../core/PubNubService';
import { MessageType } from '../core/types';

/**
 * MCP (Model Context Protocol) implementation for PubNub
 * Inspired by ruv.io MCP patterns
 */

export interface MCPRequest {
  id: string;
  method: string;
  params: Record<string, any>;
  timestamp: number;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  timestamp: number;
}

export class MCPProtocol {
  private pubnub: PubNubService;
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private pendingRequests: Map<string, (response: MCPResponse) => void> = new Map();

  constructor(pubnub: PubNubService) {
    this.pubnub = pubnub;
    this.setupMCPChannels();
  }

  /**
   * Setup MCP channels
   */
  private setupMCPChannels(): void {
    this.pubnub.subscribe('mcp:requests');
    this.pubnub.subscribe('mcp:responses');

    // Listen for MCP requests
    this.pubnub.onMessage('mcp:requests', async (message) => {
      if (message.type === MessageType.MCP_REQUEST) {
        await this.handleRequest(message.payload as MCPRequest);
      }
    });

    // Listen for MCP responses
    this.pubnub.onMessage('mcp:responses', async (message) => {
      if (message.type === MessageType.MCP_RESPONSE) {
        this.handleResponse(message.payload as MCPResponse);
      }
    });

    console.log('MCP Protocol initialized');
  }

  /**
   * Register a method handler
   */
  registerMethod(
    method: string,
    handler: (params: any) => Promise<any>
  ): void {
    this.requestHandlers.set(method, handler);
    console.log(`Registered MCP method: ${method}`);
  }

  /**
   * Send MCP request
   */
  async request(method: string, params: Record<string, any>): Promise<any> {
    const request: MCPRequest = {
      id: `mcp-${Date.now()}-${Math.random()}`,
      method,
      params,
      timestamp: Date.now(),
    };

    // Publish request
    await this.pubnub.publish(
      'mcp:requests',
      MessageType.MCP_REQUEST,
      request
    );

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(request.id, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });
    });
  }

  /**
   * Handle incoming MCP request
   */
  private async handleRequest(request: MCPRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);

    const response: MCPResponse = {
      id: request.id,
      timestamp: Date.now(),
    };

    if (!handler) {
      response.error = {
        code: -32601,
        message: `Method not found: ${request.method}`,
      };
    } else {
      try {
        response.result = await handler(request.params);
      } catch (error) {
        response.error = {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Send response
    await this.pubnub.publish(
      'mcp:responses',
      MessageType.MCP_RESPONSE,
      response
    );
  }

  /**
   * Handle incoming MCP response
   */
  private handleResponse(response: MCPResponse): void {
    const resolver = this.pendingRequests.get(response.id);
    if (resolver) {
      resolver(response);
      this.pendingRequests.delete(response.id);
    }
  }

  /**
   * Get registered methods
   */
  getMethods(): string[] {
    return Array.from(this.requestHandlers.keys());
  }
}
