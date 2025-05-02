/**
 * Standalone Express Server for Cloudflare MCP
 *
 * This script creates a standalone Express server that implements the MCP functionality
 * without requiring Wrangler or specific GLIBC versions.
 *
 * It implements the MCP JSON-RPC 2.0 API directly in Express.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Simple colored console output
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  white: (text) => `\x1b[37m${text}\x1b[0m`
};

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3001;

// Create Express app
const app = express();

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
        analysis: `Analyzed ${params.language || 'unknown'} code (${params.code.length} characters)`,
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
        modified_code: `// Modified according to: ${params.instructions}\n${params.code}`,
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
          { file: 'example.js', line: 10, context: `function example() { // ${params.pattern} }` },
          { file: 'test.js', line: 25, context: `// TODO: ${params.pattern}` }
        ],
        count: 2
      };
    }
  },
  example_tool: {
    name: 'example_tool',
    description: 'Example tool for testing',
    parameters: {
      message: { type: 'string', description: 'Message to echo', required: true }
    },
    handler: async (params) => {
      return {
        message: `Received message: ${params.message}`,
        status: 'success'
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
  },
  'example_resource': {
    uri: 'example_resource',
    description: 'Example resource for testing',
    handler: async () => {
      return {
        data: 'This is example resource data',
        type: 'text'
      };
    }
  }
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

// Middleware to capture raw body
app.use((req, res, next) => {
  if (req.method === 'POST') {
    let data = '';
    req.on('data', chunk => {
      data += chunk.toString();
    });
    
    req.on('end', () => {
      req.rawBody = data;
      
      // Try to parse JSON
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        try {
          req.body = JSON.parse(data);
        } catch (e) {
          // If JSON parsing fails, send a JSON-RPC error response
          if (req.path === '/mcp') {
            return res.status(400).json(jsonRpcError(null, JsonRpcErrorCode.PARSE_ERROR, 'Parse error', e.message));
          }
        }
      }
      
      next();
    });
  } else {
    next();
  }
});

// Regular JSON parsing for other routes
app.use(express.json({ strict: false, verify: (req, res, buf) => {
  // Store raw body
  req.rawBody = buf.toString();
}}));

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

// MCP JSON-RPC endpoint
app.post('/mcp', async (req, res) => {
  try {
    const body = req.body;
    
    // Handle batch requests
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return res.status(400).json(jsonRpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: Batch array cannot be empty'));
      }
      
      const responses = await Promise.all(body.map(request => processSingleRequest(request)));
      return res.json(responses);
    }
    
    // Handle single request
    const response = await processSingleRequest(body);
    return res.json(response);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return res.status(500).json(jsonRpcError(null, JsonRpcErrorCode.INTERNAL_ERROR, error.message));
  }
});

// Process a single JSON-RPC request
async function processSingleRequest(request) {
  // Validate the request format
  if (!request || typeof request !== 'object') {
    return jsonRpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: Request must be an object');
  }
  
  if (request.jsonrpc !== '2.0') {
    return jsonRpcError(request.id || null, JsonRpcErrorCode.INVALID_REQUEST, "Invalid request: jsonrpc must be '2.0'");
  }
  
  if (typeof request.method !== 'string') {
    return jsonRpcError(request.id || null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: method must be a string');
  }
  
  if (request.id !== null && request.id !== undefined && typeof request.id !== 'string' && typeof request.id !== 'number') {
    return jsonRpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid request: id must be a string, number, or null');
  }
  
  // Handle method
  try {
    switch (request.method) {
      case 'mcp.use_tool':
        return await handleToolRequest(request);
      case 'mcp.access_resource':
        return await handleResourceRequest(request);
      case 'mcp.list_tools':
        return await handleListToolsRequest(request);
      case 'mcp.list_resources':
        return await handleListResourcesRequest(request);
      case 'mcp.get_tool_schema':
        return await handleGetToolSchemaRequest(request);
      case 'mcp.get_server_info':
        return await handleGetServerInfoRequest(request);
      default:
        return jsonRpcError(request.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
    }
  } catch (error) {
    console.error(`Error processing request:`, error);
    return jsonRpcError(request.id, JsonRpcErrorCode.INTERNAL_ERROR, error.message);
  }
}

// Handle MCP tool requests
async function handleToolRequest(request) {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object') {
    return jsonRpcError(request.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: Expected object with tool and parameters');
  }
  
  const { tool: toolName, parameters } = params;
  
  if (!toolName) {
    return jsonRpcError(request.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: tool name is required');
  }
  
  // Check if the requested tool exists
  const tool = tools[toolName];
  if (!tool) {
    return jsonRpcError(request.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${toolName}`);
  }
  
  try {
    // Execute the tool handler
    const result = await tool.handler(parameters || {});
    return jsonRpcSuccess(request.id, result);
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return jsonRpcError(request.id, JsonRpcErrorCode.SERVER_ERROR_START, `Error executing tool: ${error.message}`);
  }
}

// Handle MCP resource requests
async function handleResourceRequest(request) {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object') {
    return jsonRpcError(request.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: Expected object with uri');
  }
  
  const { uri } = params;
  
  if (!uri) {
    return jsonRpcError(request.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: uri is required');
  }
  
  // Check if the requested resource exists
  const resource = resources[uri];
  if (!resource) {
    return jsonRpcError(request.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Resource not found: ${uri}`);
  }
  
  try {
    // Execute the resource handler
    const content = await resource.handler();
    return jsonRpcSuccess(request.id, { content });
  } catch (error) {
    console.error(`Error accessing resource ${uri}:`, error);
    return jsonRpcError(request.id, JsonRpcErrorCode.SERVER_ERROR_START, `Error accessing resource: ${error.message}`);
  }
}

// Handle list tools request
async function handleListToolsRequest(request) {
  const toolList = Object.entries(tools).map(([id, tool]) => ({
    id,
    name: tool.name,
    description: tool.description
  }));
  
  return jsonRpcSuccess(request.id, { tools: toolList });
}

// Handle list resources request
async function handleListResourcesRequest(request) {
  const resourceList = Object.entries(resources).map(([id, resource]) => ({
    id,
    uri: resource.uri,
    description: resource.description
  }));
  
  return jsonRpcSuccess(request.id, { resources: resourceList });
}

// Handle get tool schema request
async function handleGetToolSchemaRequest(request) {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object' || !params.tool) {
    return jsonRpcError(request.id, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: Expected object with tool name');
  }
  
  const toolName = params.tool;
  
  // Check if the requested tool exists
  const tool = tools[toolName];
  if (!tool) {
    return jsonRpcError(request.id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${toolName}`);
  }
  
  // Return the tool schema
  return jsonRpcSuccess(request.id, {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  });
}

// Handle get server info request
async function handleGetServerInfoRequest(request) {
  return jsonRpcSuccess(request.id, {
    name: env.MCP_SERVER_NAME,
    version: env.MCP_VERSION,
    protocol: 'mcp',
    protocol_version: '0.1.0',
    jsonrpc: '2.0',
    description: 'Model Context Protocol server implemented with Express',
    methods: [
      'mcp.use_tool',
      'mcp.access_resource',
      'mcp.list_tools',
      'mcp.list_resources',
      'mcp.get_tool_schema',
      'mcp.get_server_info'
    ]
  });
}

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
  console.log(colors.blue('🚀 Standalone Express MCP Server running at http://localhost:' + port));
  console.log(colors.blue(`🌐 Server Name: ${env.MCP_SERVER_NAME}`));
  console.log(colors.blue(`📋 Version: ${env.MCP_VERSION}`));
  console.log(colors.blue(`🔧 Environment: ${env.MCP_ENV}`));
  console.log(colors.cyan(`💡 Press Ctrl+C to stop the server`));
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(colors.yellow('\n🛑 Shutting down server...'));
  console.log(colors.green('👋 Server has been stopped'));
  process.exit(0);
});