/**
 * Main entry point for the Cloudflare Worker MCP server
 */
import { Router, IRequest } from 'itty-router';
import { handleCors, jsonResponse, errorResponse } from './utils';

// Type adapter for converting IRequest to Request
const adaptRequest = (request: IRequest): Request => request as unknown as Request;
import { handleMcpRequest } from './mcp';
import { tools } from './tools';
import { resources } from './resources';

// Type for request handlers
type RouteHandler = (request: IRequest, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;

// Define environment variables interface
interface Env {
  MCP_SERVER_NAME: string;
  MCP_VERSION: string;
  MCP_ENV: string;
}

// Create a new router
const router = Router();

// CORS preflight requests
router.options('*', (req) => handleCors(adaptRequest(req)));

// Health check endpoint
router.get('/health', () => {
  return new Response('OK', { status: 200 });
});

// MCP server info endpoint
router.get('/mcp', async (request: IRequest, env: Env) => {
  return jsonResponse({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_VERSION,
    protocol: 'mcp',
    protocol_version: '0.1.0',
    jsonrpc: '2.0',
    description: 'Model Context Protocol server implemented with Cloudflare Workers',
    tools: Object.keys(tools).map(key => ({
      id: key,
      name: tools[key].name,
      description: tools[key].description
    })),
    resources: Object.keys(resources).map(key => ({
      id: key,
      uri: resources[key].uri,
      description: resources[key].description
    })),
    methods: [
      'mcp.use_tool',
      'mcp.access_resource',
      'mcp.list_tools',
      'mcp.list_resources',
      'mcp.get_tool_schema',
      'mcp.get_server_info'
    ]
  });
});

// MCP request handler
router.post('/mcp', (req, env, ctx) => handleMcpRequest(adaptRequest(req), env));

// Documentation endpoint
router.get('/', () => {
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MCP Server</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 { color: #2c3e50; }
          h2 { color: #3498db; }
          pre {
            background-color: #f8f8f8;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code { font-family: monospace; }
          .endpoint { margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h1>Model Context Protocol (MCP) Server</h1>
        <p>This server implements the Model Context Protocol (MCP) using JSON-RPC 2.0.</p>
        
        <h2>Endpoints</h2>
        
        <div class="endpoint">
          <h3>GET /health</h3>
          <p>Health check endpoint.</p>
        </div>
        
        <div class="endpoint">
          <h3>GET /mcp</h3>
          <p>Returns information about the MCP server, including available tools and resources.</p>
        </div>
        
        <div class="endpoint">
          <h3>POST /mcp</h3>
          <p>JSON-RPC 2.0 endpoint for MCP requests.</p>
          <h4>Available Methods:</h4>
          <ul>
            <li><code>mcp.use_tool</code> - Execute a tool</li>
            <li><code>mcp.access_resource</code> - Access a resource</li>
            <li><code>mcp.list_tools</code> - List available tools</li>
            <li><code>mcp.list_resources</code> - List available resources</li>
            <li><code>mcp.get_tool_schema</code> - Get schema for a specific tool</li>
            <li><code>mcp.get_server_info</code> - Get server information</li>
          </ul>
        </div>
        
        <h2>Example Request</h2>
        <pre><code>{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "mcp.list_tools",
  "params": {}
}</code></pre>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Export default worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle the request with our router
      return router.handle(request, env, ctx);
    } catch (error) {
      // Handle any errors
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};