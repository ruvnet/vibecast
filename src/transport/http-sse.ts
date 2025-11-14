/**
 * HTTP/SSE Transport
 * Handles communication via HTTP with Server-Sent Events for async operations
 */

import http from 'http';
import { MCPServer } from '../core/mcp-server.js';
import { HttpConfig } from '../types/protocol.js';

export class HttpSSETransport {
  private server: MCPServer;
  private httpServer?: http.Server;
  private config: HttpConfig;
  private sseClients: Map<string, http.ServerResponse> = new Map();

  constructor(server: MCPServer, config: HttpConfig) {
    this.server = server;
    this.config = config;
  }

  /**
   * Start the HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(`[HTTP/SSE Transport] Server listening on http://${this.config.host}:${this.config.port}`);
        console.log('[HTTP/SSE Transport] Endpoints:');
        console.log('  POST   /tools/invoke     - Invoke a tool');
        console.log('  GET    /tools            - List all tools');
        console.log('  GET    /tools/:id        - Get tool details');
        console.log('  POST   /resources/fetch  - Fetch a resource');
        console.log('  GET    /resources        - List all resources');
        console.log('  GET    /resources/:id    - Get resource details');
        console.log('  GET    /events           - SSE endpoint for async updates');
        console.log('  GET    /info            - Server information');
        console.log('  GET    /health          - Health check');
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers
    if (this.config.corsEnabled) {
      const origin = this.config.corsOrigins.includes('*') ? '*' : this.config.corsOrigins[0];
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
      // Route requests
      if (method === 'GET' && path === '/info') {
        await this.handleGetInfo(req, res);
      } else if (method === 'GET' && path === '/health') {
        await this.handleHealthCheck(req, res);
      } else if (method === 'GET' && path === '/tools') {
        await this.handleListTools(req, res);
      } else if (method === 'GET' && path.startsWith('/tools/')) {
        const toolId = path.substring(7);
        await this.handleGetTool(req, res, toolId);
      } else if (method === 'POST' && path === '/tools/invoke') {
        await this.handleInvokeTool(req, res);
      } else if (method === 'GET' && path === '/resources') {
        await this.handleListResources(req, res);
      } else if (method === 'GET' && path.startsWith('/resources/')) {
        const resourceId = path.substring(11);
        await this.handleGetResource(req, res, resourceId);
      } else if (method === 'POST' && path === '/resources/fetch') {
        await this.handleFetchResource(req, res);
      } else if (method === 'GET' && path === '/events') {
        await this.handleSSEConnection(req, res);
      } else {
        this.sendError(res, 404, 'Not found');
      }
    } catch (error) {
      console.error('[HTTP/SSE Transport] Request error:', error);
      this.sendError(res, 500, error instanceof Error ? error.message : 'Internal server error');
    }
  }

  /**
   * Handle GET /info
   */
  private async handleGetInfo(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const info = this.server.getInfo();
    this.sendJSON(res, 200, info);
  }

  /**
   * Handle GET /health
   */
  private async handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.sendJSON(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle GET /tools
   */
  private async handleListTools(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const tools = this.server.getTools();
    this.sendJSON(res, 200, {
      count: tools.length,
      tools,
    });
  }

  /**
   * Handle GET /tools/:id
   */
  private async handleGetTool(req: http.IncomingMessage, res: http.ServerResponse, toolId: string): Promise<void> {
    const tool = this.server.getTool(toolId);
    if (!tool) {
      this.sendError(res, 404, `Tool not found: ${toolId}`);
      return;
    }
    this.sendJSON(res, 200, tool);
  }

  /**
   * Handle POST /tools/invoke
   */
  private async handleInvokeTool(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const headers = this.extractHeaders(req);

    const response = await this.server.handleRequest(body, headers);
    this.sendJSON(res, 200, response);
  }

  /**
   * Handle GET /resources
   */
  private async handleListResources(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const resources = this.server.getResources();
    this.sendJSON(res, 200, {
      count: resources.length,
      resources,
    });
  }

  /**
   * Handle GET /resources/:id
   */
  private async handleGetResource(req: http.IncomingMessage, res: http.ServerResponse, resourceId: string): Promise<void> {
    const resource = this.server.getResource(resourceId);
    if (!resource) {
      this.sendError(res, 404, `Resource not found: ${resourceId}`);
      return;
    }
    this.sendJSON(res, 200, resource);
  }

  /**
   * Handle POST /resources/fetch
   */
  private async handleFetchResource(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const headers = this.extractHeaders(req);

    const response = await this.server.handleResourceRequest(body, headers);
    this.sendJSON(res, 200, response);
  }

  /**
   * Handle SSE connection
   */
  private async handleSSEConnection(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const clientId = Math.random().toString(36).substring(7);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Store client for future events
    this.sseClients.set(clientId, res);

    // Handle client disconnect
    req.on('close', () => {
      this.sseClients.delete(clientId);
      console.log(`[HTTP/SSE Transport] Client ${clientId} disconnected`);
    });

    console.log(`[HTTP/SSE Transport] Client ${clientId} connected to SSE`);
  }

  /**
   * Send SSE event to all connected clients
   */
  sendSSEEvent(eventType: string, data: any): void {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [clientId, res] of this.sseClients.entries()) {
      try {
        res.write(message);
      } catch (error) {
        console.error(`[HTTP/SSE Transport] Failed to send event to client ${clientId}:`, error);
        this.sseClients.delete(clientId);
      }
    }
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Extract headers for authentication
   */
  private extractHeaders(req: http.IncomingMessage): Record<string, string> {
    const headers: Record<string, string> = {};
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-client-cert']) {
      headers['x-client-cert'] = req.headers['x-client-cert'] as string;
    }
    return headers;
  }

  /**
   * Send JSON response
   */
  private sendJSON(res: http.ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  private sendError(res: http.ServerResponse, status: number, message: string): void {
    this.sendJSON(res, status, {
      error: {
        code: status,
        message,
      },
    });
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all SSE connections
      for (const [clientId, res] of this.sseClients.entries()) {
        res.end();
      }
      this.sseClients.clear();

      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('[HTTP/SSE Transport] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
