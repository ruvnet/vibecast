/**
 * Simple Express Server for Cloudflare MCP
 * 
 * This script creates a minimal Express server that implements the MCP functionality
 * without requiring Wrangler or specific GLIBC versions.
 */

const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

// Environment variables for the MCP server
const env = {
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME || 'cloudflare-mcp-server',
  MCP_VERSION: process.env.MCP_VERSION || '1.0.0',
  MCP_ENV: process.env.MCP_ENV || 'local'
};

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

// Middleware for JSON parsing
app.use(express.json());

// Add security headers middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// MCP server info endpoint
app.get('/mcp', (req, res) => {
  res.json({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_VERSION,
    protocol: 'mcp',
    protocol_version: '0.1.0',
    jsonrpc: '2.0',
    description: 'Model Context Protocol server implemented with Express',
    tools: [
      {
        id: 'analyze_code',
        name: 'analyze_code',
        description: 'Analyzes code for patterns and issues'
      },
      {
        id: 'modify_code',
        name: 'modify_code',
        description: 'Modifies code based on instructions'
      },
      {
        id: 'search_code',
        name: 'search_code',
        description: 'Searches code for specific patterns'
      }
    ],
    resources: [
      {
        id: 'server-info',
        uri: 'server-info',
        description: 'Server information'
      },
      {
        id: 'documentation',
        uri: 'documentation',
        description: 'API documentation'
      }
    ],
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

// MCP JSON-RPC endpoint
app.post('/mcp', (req, res) => {
  try {
    const body = req.body;
    
    // Validate the request format
    if (!body || typeof body !== 'object') {
      return res.status(400).json(jsonRpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: Request must be an object'));
    }
    
    if (body.jsonrpc !== '2.0') {
      return res.status(400).json(jsonRpcError(body.id || null, JsonRpcErrorCode.INVALID_REQUEST, "Invalid request: jsonrpc must be '2.0'"));
    }
    
    if (typeof body.method !== 'string') {
      return res.status(400).json(jsonRpcError(body.id || null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: method must be a string'));
    }
    
    // Handle method
    switch (body.method) {
      case 'mcp.list_tools':
        return res.json(jsonRpcSuccess(body.id, {
          tools: [
            {
              id: 'analyze_code',
              name: 'analyze_code',
              description: 'Analyzes code for patterns and issues'
            },
            {
              id: 'modify_code',
              name: 'modify_code',
              description: 'Modifies code based on instructions'
            },
            {
              id: 'search_code',
              name: 'search_code',
              description: 'Searches code for specific patterns'
            }
          ]
        }));
      
      case 'mcp.list_resources':
        return res.json(jsonRpcSuccess(body.id, {
          resources: [
            {
              id: 'server-info',
              uri: 'server-info',
              description: 'Server information'
            },
            {
              id: 'documentation',
              uri: 'documentation',
              description: 'API documentation'
            }
          ]
        }));
      
      case 'mcp.get_server_info':
        return res.json(jsonRpcSuccess(body.id, {
          name: env.MCP_SERVER_NAME,
          version: env.MCP_VERSION,
          protocol: 'mcp',
          protocol_version: '0.1.0',
          jsonrpc: '2.0',
          description: 'Model Context Protocol server implemented with Express'
        }));
      
      case 'mcp.use_tool':
        const { tool, parameters } = body.params || {};
        
        if (!tool) {
          return res.status(400).json(jsonRpcError(body.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: tool name is required'));
        }
        
        // Mock tool responses
        switch (tool) {
          case 'analyze_code':
            return res.json(jsonRpcSuccess(body.id, {
              analysis: `Analyzed ${parameters?.language || 'unknown'} code (${parameters?.code?.length || 0} characters)`,
              issues: [],
              suggestions: ['Use consistent formatting', 'Add more comments']
            }));
          
          case 'modify_code':
            return res.json(jsonRpcSuccess(body.id, {
              modified_code: `// Modified according to: ${parameters?.instructions || 'no instructions'}\n${parameters?.code || ''}`,
              changes: ['Added comment', 'Applied formatting']
            }));
          
          case 'search_code':
            return res.json(jsonRpcSuccess(body.id, {
              matches: [
                { file: 'example.js', line: 10, context: `function example() { // ${parameters?.pattern || 'pattern'} }` },
                { file: 'test.js', line: 25, context: `// TODO: ${parameters?.pattern || 'pattern'}` }
              ],
              count: 2
            }));
          
          default:
            return res.status(404).json(jsonRpcError(body.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${tool}`));
        }
      
      case 'mcp.access_resource':
        const { uri } = body.params || {};
        
        if (!uri) {
          return res.status(400).json(jsonRpcError(body.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: uri is required'));
        }
        
        // Mock resource responses
        switch (uri) {
          case 'server-info':
            return res.json(jsonRpcSuccess(body.id, {
              content: {
                name: env.MCP_SERVER_NAME,
                version: env.MCP_VERSION,
                protocol: 'mcp',
                protocol_version: '0.1.0',
                uptime: process.uptime()
              }
            }));
          
          case 'documentation':
            return res.json(jsonRpcSuccess(body.id, {
              content: {
                title: 'MCP API Documentation',
                methods: [
                  { name: 'mcp.use_tool', description: 'Execute a tool' },
                  { name: 'mcp.access_resource', description: 'Access a resource' },
                  { name: 'mcp.list_tools', description: 'List available tools' },
                  { name: 'mcp.list_resources', description: 'List available resources' },
                  { name: 'mcp.get_tool_schema', description: 'Get schema for a specific tool' },
                  { name: 'mcp.get_server_info', description: 'Get server information' }
                ]
              }
            }));
          
          default:
            return res.status(404).json(jsonRpcError(body.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Resource not found: ${uri}`));
        }
      
      case 'mcp.get_tool_schema':
        const { tool: toolName } = body.params || {};
        
        if (!toolName) {
          return res.status(400).json(jsonRpcError(body.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: tool name is required'));
        }
        
        // Mock tool schemas
        switch (toolName) {
          case 'analyze_code':
            return res.json(jsonRpcSuccess(body.id, {
              name: 'analyze_code',
              description: 'Analyzes code for patterns and issues',
              parameters: {
                code: { type: 'string', description: 'Code to analyze', required: true },
                language: { type: 'string', description: 'Programming language', required: false }
              }
            }));
          
          case 'modify_code':
            return res.json(jsonRpcSuccess(body.id, {
              name: 'modify_code',
              description: 'Modifies code based on instructions',
              parameters: {
                code: { type: 'string', description: 'Code to modify', required: true },
                instructions: { type: 'string', description: 'Modification instructions', required: true }
              }
            }));
          
          case 'search_code':
            return res.json(jsonRpcSuccess(body.id, {
              name: 'search_code',
              description: 'Searches code for specific patterns',
              parameters: {
                pattern: { type: 'string', description: 'Pattern to search for', required: true },
                files: { type: 'array', description: 'Files to search in', required: false }
              }
            }));
          
          default:
            return res.status(404).json(jsonRpcError(body.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${toolName}`));
        }
      
      default:
        return res.status(404).json(jsonRpcError(body.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${body.method}`));
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return res.status(500).json(jsonRpcError(null, JsonRpcErrorCode.INTERNAL_ERROR, error.message));
  }
});

// Documentation endpoint
app.get('/', (req, res) => {
  res.send(`
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
  `);
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).send('Not Found');
});

// Start server
app.listen(port, () => {
  console.log('\x1b[34m%s\x1b[0m', `🚀 Simple Express MCP Server running at http://localhost:${port}`);
  console.log('\x1b[34m%s\x1b[0m', `🌐 Server Name: ${env.MCP_SERVER_NAME}`);
  console.log('\x1b[34m%s\x1b[0m', `📋 Version: ${env.MCP_VERSION}`);
  console.log('\x1b[34m%s\x1b[0m', `🔧 Environment: ${env.MCP_ENV}`);
  console.log('\x1b[36m%s\x1b[0m', `💡 Press Ctrl+C to stop the server`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '🛑 Shutting down server...');
  console.log('\x1b[32m%s\x1b[0m', '👋 Server has been stopped');
  process.exit(0);
});