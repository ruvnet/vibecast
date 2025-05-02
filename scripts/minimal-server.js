/**
 * Minimal HTTP Server for Cloudflare MCP
 * 
 * This script creates a minimal HTTP server that implements the MCP functionality
 * without requiring Wrangler, Express, or specific GLIBC versions.
 */

const http = require('http');
const url = require('url');

// Environment variables for the MCP server
const env = {
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME || 'cloudflare-mcp-server',
  MCP_VERSION: process.env.MCP_VERSION || '1.0.0',
  MCP_ENV: process.env.MCP_ENV || 'local'
};

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3001;

// JSON-RPC Error Codes
const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099
};

// Helper functions for JSON-RPC
function jsonRpcSuccess(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  };
}

// Mock tools
const tools = {
  analyze_code: {
    name: 'analyze_code',
    description: 'Analyzes code for patterns and issues',
    parameters: {
      code: { type: 'string', description: 'Code to analyze', required: true },
      language: { type: 'string', description: 'Programming language', required: false }
    },
    handler: async (params) => {
      return {
        analysis: `Analyzed ${params.language || 'unknown'} code (${params.code?.length || 0} characters)`,
        issues: [],
        suggestions: ['Use consistent formatting', 'Add more comments']
      };
    }
  },
  modify_code: {
    name: 'modify_code',
    description: 'Modifies code based on instructions',
    parameters: {
      code: { type: 'string', description: 'Code to modify', required: true },
      instructions: { type: 'string', description: 'Modification instructions', required: true }
    },
    handler: async (params) => {
      return {
        modified_code: `// Modified according to: ${params.instructions || 'no instructions'}\n${params.code || ''}`,
        changes: ['Added comment', 'Applied formatting']
      };
    }
  },
  search_code: {
    name: 'search_code',
    description: 'Searches code for specific patterns',
    parameters: {
      pattern: { type: 'string', description: 'Pattern to search for', required: true },
      files: { type: 'array', description: 'Files to search in', required: false }
    },
    handler: async (params) => {
      return {
        matches: [
          { file: 'example.js', line: 10, context: `function example() { // ${params.pattern || 'pattern'} }` },
          { file: 'test.js', line: 25, context: `// TODO: ${params.pattern || 'pattern'}` }
        ],
        count: 2
      };
    }
  }
};

// Mock resources
const resources = {
  'server-info': {
    uri: 'server-info',
    description: 'Server information',
    handler: async () => {
      return {
        name: env.MCP_SERVER_NAME,
        version: env.MCP_VERSION,
        protocol: 'mcp',
        protocol_version: '0.1.0',
        uptime: process.uptime()
      };
    }
  },
  'documentation': {
    uri: 'documentation',
    description: 'API documentation',
    handler: async () => {
      return {
        title: 'MCP API Documentation',
        methods: [
          { name: 'mcp.use_tool', description: 'Execute a tool' },
          { name: 'mcp.access_resource', description: 'Access a resource' },
          { name: 'mcp.list_tools', description: 'List available tools' },
          { name: 'mcp.list_resources', description: 'List available resources' },
          { name: 'mcp.get_tool_schema', description: 'Get schema for a specific tool' },
          { name: 'mcp.get_server_info', description: 'Get server information' }
        ]
      };
    }
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // Set security headers
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Health check endpoint
  if (path === '/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('OK');
    return;
  }
  
  // MCP GET endpoint for server info
  if (path === '/mcp' && req.method === 'GET') {
    // Check if client is requesting SSE
    if (req.headers['accept'] && req.headers['accept'].includes('text/event-stream')) {
      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable buffering for Nginx
      });
      
      // Send initial connection established event
      res.write(`data: ${JSON.stringify({ type: 'connection_established', timestamp: Date.now() })}\n\n`);
      
      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
      }, 30000); // Send heartbeat every 30 seconds
      
      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeatInterval);
      });
      
      return;
    }
    
    // Regular JSON response for non-SSE requests
    const serverInfo = {
      name: env.MCP_SERVER_NAME,
      version: env.MCP_VERSION,
      protocol: 'mcp',
      protocol_version: '0.1.0',
      jsonrpc: '2.0',
      description: 'Model Context Protocol server implemented with Node.js',
      tools: Object.entries(tools).map(([id, tool]) => ({
        id,
        name: tool.name,
        description: tool.description
      })),
      resources: Object.entries(resources).map(([id, resource]) => ({
        id,
        uri: resource.uri,
        description: resource.description
      })),
      methods: [
        'mcp.use_tool',
        'mcp.access_resource',
        'mcp.list_tools',
        'mcp.list_resources',
        'mcp.get_tool_schema',
        'mcp.get_server_info'
      ]
    };
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(serverInfo));
    return;
  }
  
  // MCP SSE endpoint for event streaming
  if (path === '/mcp/events' && req.method === 'GET') {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering for Nginx
    });
    
    // Send initial connection established event
    res.write(`data: ${JSON.stringify({ type: 'connection_established', timestamp: Date.now() })}\n\n`);
    
    // Keep connection alive with heartbeat
    const heartbeatInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    }, 30000); // Send heartbeat every 30 seconds
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
    
    return;
  }
  
  // MCP JSON-RPC endpoint
  if (path === '/mcp' && req.method === 'POST') {
    let body = '';
    
    // Collect request body
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    // Process request when body is fully received
    req.on('end', async () => {
      try {
        // Check if client is requesting SSE (some clients might use POST with a special header)
        if (req.headers['accept'] === 'text/event-stream') {
          // Set headers for SSE
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable buffering for Nginx
          });
          
          // Send initial connection established event
          res.write(`data: ${JSON.stringify({ type: 'connection_established', timestamp: Date.now() })}\n\n`);
          
          // Keep connection alive with heartbeat
          const heartbeatInterval = setInterval(() => {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
          }, 30000); // Send heartbeat every 30 seconds
          
          // Handle client disconnect
          req.on('close', () => {
            clearInterval(heartbeatInterval);
          });
          
          return;
        }
        
        // Parse JSON body
        let jsonBody;
        try {
          jsonBody = JSON.parse(body);
        } catch (e) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(jsonRpcError(null, JsonRpcErrorCode.PARSE_ERROR, 'Parse error', e.message)));
          return;
        }
        
        // Validate the request format
        if (!jsonBody || typeof jsonBody !== 'object') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(jsonRpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: Request must be an object')));
          return;
        }
        
        if (jsonBody.jsonrpc !== '2.0') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(jsonRpcError(jsonBody.id || null, JsonRpcErrorCode.INVALID_REQUEST, "Invalid request: jsonrpc must be '2.0'")));
          return;
        }
        
        if (typeof jsonBody.method !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(jsonRpcError(jsonBody.id || null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: method must be a string')));
          return;
        }
        
        // Handle method
        let response;
        try {
          switch (jsonBody.method) {
            case 'mcp.list_tools':
              response = jsonRpcSuccess(jsonBody.id, {
                tools: Object.entries(tools).map(([id, tool]) => ({
                  id,
                  name: tool.name,
                  description: tool.description
                }))
              });
              break;
            
            case 'mcp.list_resources':
              response = jsonRpcSuccess(jsonBody.id, {
                resources: Object.entries(resources).map(([id, resource]) => ({
                  id,
                  uri: resource.uri,
                  description: resource.description
                }))
              });
              break;
            
            case 'mcp.get_server_info':
              response = jsonRpcSuccess(jsonBody.id, {
                name: env.MCP_SERVER_NAME,
                version: env.MCP_VERSION,
                protocol: 'mcp',
                protocol_version: '0.1.0',
                jsonrpc: '2.0',
                description: 'Model Context Protocol server implemented with Node.js'
              });
              break;
            
            case 'mcp.use_tool':
              const { tool: toolName, parameters } = jsonBody.params || {};
              
              if (!toolName) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: tool name is required');
                break;
              }
              
              const tool = tools[toolName];
              if (!tool) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${toolName}`);
                break;
              }
              
              const toolResult = await tool.handler(parameters || {});
              response = jsonRpcSuccess(jsonBody.id, toolResult);
              break;
            
            case 'mcp.access_resource':
              const { uri } = jsonBody.params || {};
              
              if (!uri) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: uri is required');
                break;
              }
              
              const resource = resources[uri];
              if (!resource) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Resource not found: ${uri}`);
                break;
              }
              
              const resourceContent = await resource.handler();
              response = jsonRpcSuccess(jsonBody.id, { content: resourceContent });
              break;
            
            case 'mcp.get_tool_schema':
              const { tool: schemaToolName } = jsonBody.params || {};
              
              if (!schemaToolName) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: tool name is required');
                break;
              }
              
              const schemaTool = tools[schemaToolName];
              if (!schemaTool) {
                response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${schemaToolName}`);
                break;
              }
              
              response = jsonRpcSuccess(jsonBody.id, {
                name: schemaTool.name,
                description: schemaTool.description,
                parameters: schemaTool.parameters
              });
              break;
            
            default:
              response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${jsonBody.method}`);
              break;
          }
        } catch (error) {
          console.error(`Error processing request:`, error);
          response = jsonRpcError(jsonBody.id, JsonRpcErrorCode.INTERNAL_ERROR, error.message);
        }
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Error handling MCP request:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(jsonRpcError(null, JsonRpcErrorCode.INTERNAL_ERROR, error.message)));
      }
    });
    
    return;
  }
  
  // .well-known/ directory index
  if (path === '/.well-known/' || path === '/.well-known' && req.method === 'GET') {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>MCP Server - .well-known Directory</title>
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
            h3 { color: #2980b9; }
            pre {
              background-color: #f8f8f8;
              padding: 10px;
              border-radius: 5px;
              overflow-x: auto;
            }
            code { font-family: monospace; }
            .endpoint {
              margin-bottom: 30px;
              padding: 15px;
              border: 1px solid #e1e4e8;
              border-radius: 6px;
            }
            .endpoint:hover {
              background-color: #f6f8fa;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
            }
            .tag {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              margin-right: 5px;
            }
            .tag-standard {
              background-color: #e1f5fe;
              color: #0288d1;
            }
            .tag-mcp {
              background-color: #e8f5e9;
              color: #388e3c;
            }
            .tag-oauth {
              background-color: #fff8e1;
              color: #ffa000;
            }
          </style>
        </head>
        <body>
          <h1>.well-known Directory Overview</h1>
          <p>This page provides a detailed overview of all the available .well-known/ endpoints on this MCP server.</p>
          
          <h2>Available .well-known Endpoints</h2>
          
          <div class="endpoint">
            <h3>
              <a href="/.well-known/mcp">/.well-known/mcp</a>
              <span class="tag tag-mcp">MCP</span>
              <span class="tag tag-standard">Standard</span>
            </h3>
            <p><strong>Purpose:</strong> MCP server discovery endpoint. Provides basic information about the MCP server, similar to how robots.txt works for web crawlers.</p>
            <p><strong>Format:</strong> JSON</p>
            <p><strong>Authentication Required:</strong> No</p>
            <p><strong>Description:</strong> This endpoint returns basic information about the MCP server, including the server name, protocol version, supported features, and capabilities.</p>
            <h4>Example Response:</h4>
            <pre><code>{
  "server_name": "${env.MCP_SERVER_NAME}",
  "protocol_version": "MCP/1.0",
  "jsonrpc_version": "2.0",
  "supported_features": ["Resources", "Tools", "Events"],
  "capabilities": ["JSON-RPC", "CORS", "SSE"],
  "endpoints": {
    "jsonrpc": "http://localhost:${port}/mcp",
    "sse": "http://localhost:${port}/mcp/events",
    "health": "http://localhost:${port}/health"
  },
  "description": "Model Context Protocol server implemented with Node.js"
}</code></pre>
          </div>
          
          <div class="endpoint">
            <h3>
              <a href="/.well-known/oauth-authorization-server">/.well-known/oauth-authorization-server</a>
              <span class="tag tag-oauth">OAuth</span>
              <span class="tag tag-standard">Standard</span>
            </h3>
            <p><strong>Purpose:</strong> OAuth discovery endpoint. Provides information about the OAuth authorization server.</p>
            <p><strong>Format:</strong> JSON</p>
            <p><strong>Authentication Required:</strong> No</p>
            <p><strong>Description:</strong> This endpoint returns information about the OAuth authorization server, including authorization endpoints, token endpoints, and supported grant types.</p>
            <h4>Example Response:</h4>
            <pre><code>{
  "issuer": "http://localhost:${port}",
  "authorization_endpoint": "http://localhost:${port}/oauth/authorize",
  "token_endpoint": "http://localhost:${port}/oauth/token",
  "introspection_endpoint": "http://localhost:${port}/oauth/introspect",
  "revocation_endpoint": "http://localhost:${port}/oauth/revoke",
  "jwks_uri": "http://localhost:${port}/.well-known/jwks.json",
  "response_types_supported": ["code", "token"],
  "grant_types_supported": ["authorization_code", "client_credentials"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"]
}</code></pre>
          </div>
          
          <div class="endpoint">
            <h3>
              <a href="/.well-known/capabilities">/.well-known/capabilities</a>
              <span class="tag tag-mcp">MCP</span>
            </h3>
            <p><strong>Purpose:</strong> Server capabilities endpoint. Provides detailed information about the server's capabilities.</p>
            <p><strong>Format:</strong> JSON</p>
            <p><strong>Authentication Required:</strong> No</p>
            <p><strong>Description:</strong> This endpoint returns detailed information about the server's capabilities, including available tools, resources, and methods.</p>
            <h4>Example Response:</h4>
            <pre><code>{
  "tools": {
    "analyze_code": {
      "version": "1.0.0",
      "description": "Analyzes code for patterns and issues",
      "parameters": {
        "code": { "type": "string", "description": "Code to analyze", "required": true },
        "language": { "type": "string", "description": "Programming language", "required": false }
      }
    },
    // Additional tools...
  },
  "resources": {
    "server-info": {
      "version": "1.0.0",
      "description": "Server information"
    },
    // Additional resources...
  },
  "methods": [
    "mcp.use_tool",
    "mcp.access_resource",
    "mcp.list_tools",
    "mcp.list_resources",
    "mcp.get_tool_schema",
    "mcp.get_server_info"
  ]
}</code></pre>
          </div>
          
          <h2>Implementation Notes</h2>
          <ul>
            <li>All .well-known endpoints are accessible without authentication to facilitate public discovery.</li>
            <li>The endpoints return JSON responses with appropriate content types.</li>
            <li>These endpoints follow standard conventions for .well-known URLs as defined in RFC 8615.</li>
          </ul>
          
          <h2>References</h2>
          <ul>
            <li><a href="https://modelcontextprotocol.io/specification/2025-03-26" target="_blank">MCP Specification</a></li>
            <li><a href="https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/" target="_blank">MCP Authorization Specification</a></li>
            <li><a href="https://datatracker.ietf.org/doc/html/rfc8615" target="_blank">RFC 8615: Well-Known Uniform Resource Identifiers (URIs)</a></li>
            <li><a href="https://datatracker.ietf.org/doc/html/rfc8414" target="_blank">RFC 8414: OAuth 2.0 Authorization Server Metadata</a></li>
          </ul>
        </body>
      </html>
    `;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
    return;
  }

  // .well-known/mcp endpoint for server discovery
  if (path === '/.well-known/mcp' && req.method === 'GET') {
    const mcpDiscovery = {
      server_name: env.MCP_SERVER_NAME,
      protocol_version: "MCP/1.0",
      jsonrpc_version: "2.0",
      supported_features: ["Resources", "Tools", "Events"],
      capabilities: ["JSON-RPC", "CORS", "SSE"],
      endpoints: {
        jsonrpc: `http://localhost:${port}/mcp`,
        sse: `http://localhost:${port}/mcp/events`,
        health: `http://localhost:${port}/health`
      },
      description: "Model Context Protocol server implemented with Node.js"
    };
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(mcpDiscovery));
    return;
  }
  
  // .well-known/oauth-authorization-server endpoint for OAuth discovery
  if (path === '/.well-known/oauth-authorization-server' && req.method === 'GET') {
    const oauthDiscovery = {
      issuer: `http://localhost:${port}`,
      authorization_endpoint: `http://localhost:${port}/oauth/authorize`,
      token_endpoint: `http://localhost:${port}/oauth/token`,
      introspection_endpoint: `http://localhost:${port}/oauth/introspect`,
      revocation_endpoint: `http://localhost:${port}/oauth/revoke`,
      jwks_uri: `http://localhost:${port}/.well-known/jwks.json`,
      response_types_supported: ["code", "token"],
      grant_types_supported: ["authorization_code", "client_credentials"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"]
    };
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(oauthDiscovery));
    return;
  }
  
  // .well-known/capabilities endpoint for detailed server capabilities
  if (path === '/.well-known/capabilities' && req.method === 'GET') {
    const capabilities = {
      tools: {
        analyze_code: {
          version: "1.0.0",
          description: "Analyzes code for patterns and issues",
          parameters: {
            code: { type: "string", description: "Code to analyze", required: true },
            language: { type: "string", description: "Programming language", required: false }
          }
        },
        modify_code: {
          version: "1.0.0",
          description: "Modifies code based on instructions",
          parameters: {
            code: { type: "string", description: "Code to modify", required: true },
            instructions: { type: "string", description: "Modification instructions", required: true }
          }
        },
        search_code: {
          version: "1.0.0",
          description: "Searches code for specific patterns",
          parameters: {
            pattern: { type: "string", description: "Pattern to search for", required: true },
            files: { type: "array", description: "Files to search in", required: false }
          }
        }
      },
      resources: {
        "server-info": {
          version: "1.0.0",
          description: "Server information"
        },
        "documentation": {
          version: "1.0.0",
          description: "API documentation"
        }
      },
      methods: [
        "mcp.use_tool",
        "mcp.access_resource",
        "mcp.list_tools",
        "mcp.list_resources",
        "mcp.get_tool_schema",
        "mcp.get_server_info"
      ],
      events: {
        "connection_established": {
          description: "Sent when the SSE connection is established",
          data: {
            type: "string",
            timestamp: "number"
          }
        },
        "heartbeat": {
          description: "Sent periodically to keep the SSE connection alive",
          data: {
            type: "string",
            timestamp: "number"
          }
        }
      },
      protocols: {
        "json-rpc": {
          version: "2.0",
          endpoint: `/mcp`,
          description: "JSON-RPC 2.0 protocol for MCP requests"
        },
        "sse": {
          endpoint: `/mcp/events`,
          description: "Server-Sent Events protocol for real-time updates"
        }
      }
    };
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(capabilities));
    return;
  }
  
  // Documentation endpoint
  if (path === '/' && req.method === 'GET') {
    const html = `
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
          
          <div class="endpoint">
            <h3>GET /mcp/events</h3>
            <p>Server-Sent Events (SSE) endpoint for real-time updates from the MCP server.</p>
            <p>This endpoint uses the SSE protocol to provide a persistent connection for receiving real-time updates from the server.</p>
            <h4>Event Types:</h4>
            <ul>
              <li><code>connection_established</code> - Sent when the connection is established</li>
              <li><code>heartbeat</code> - Sent periodically to keep the connection alive</li>
            </ul>
            <h4>Example Usage:</h4>
            <pre><code>// JavaScript example
const eventSource = new EventSource('/mcp/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};</code></pre>
          </div>
          
          <h2>.well-known Endpoints</h2>
          
          <div class="endpoint">
            <h3>GET /.well-known/mcp</h3>
            <p>MCP server discovery endpoint. Returns basic information about the MCP server.</p>
          </div>
          
          <div class="endpoint">
            <h3>GET /.well-known/oauth-authorization-server</h3>
            <p>OAuth discovery endpoint. Returns information about the OAuth authorization server.</p>
          </div>
          
          <div class="endpoint">
            <h3>GET /.well-known/capabilities</h3>
            <p>Server capabilities endpoint. Returns detailed information about the server's capabilities, including tools and resources.</p>
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
    `;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
    return;
  }
  
  // 404 handler
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Not Found');
});

// Start server
server.listen(port, () => {
  console.log('\x1b[34m%s\x1b[0m', `🚀 Minimal MCP Server running at http://localhost:${port}`);
  console.log('\x1b[34m%s\x1b[0m', `🌐 Server Name: ${env.MCP_SERVER_NAME}`);
  console.log('\x1b[34m%s\x1b[0m', `📋 Version: ${env.MCP_VERSION}`);
  console.log('\x1b[34m%s\x1b[0m', `🔧 Environment: ${env.MCP_ENV}`);
  console.log('\x1b[36m%s\x1b[0m', `💡 Press Ctrl+C to stop the server`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '🛑 Shutting down server...');
  server.close(() => {
    console.log('\x1b[32m%s\x1b[0m', '👋 Server has been stopped');
    process.exit(0);
  });
});