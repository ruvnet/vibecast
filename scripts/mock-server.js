/**
 * Mock MCP Server for testing and validation
 * 
 * This script creates a simple Express server that simulates the Cloudflare MCP server
 * for local testing and validation without requiring Wrangler or specific GLIBC versions.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();

// Custom middleware for handling malformed JSON
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/mcp') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
        next();
      } catch (e) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: e.message
          },
          id: null
        });
      }
    });
  } else {
    next();
  }
});

// Regular JSON parsing for other routes
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

// Server configuration
const PORT = process.env.PORT || 3001;
const SERVER_NAME = process.env.MCP_SERVER_NAME || 'cloudflare-mcp-server';
const VERSION = process.env.MCP_VERSION || '1.0.0';

// Mock tools and resources
const mockTools = [
  {
    name: 'analyze_code',
    description: 'Analyzes code for patterns and issues',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' }
      },
      required: ['code']
    }
  },
  {
    name: 'modify_code',
    description: 'Modifies code based on instructions',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to modify' },
        instructions: { type: 'string', description: 'Modification instructions' }
      },
      required: ['code', 'instructions']
    }
  },
  {
    name: 'search_code',
    description: 'Searches code for specific patterns',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Pattern to search for' },
        files: { type: 'array', items: { type: 'string' }, description: 'Files to search in' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'example_tool',
    description: 'Example tool for testing',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' }
      },
      required: ['message']
    }
  }
];

const mockResources = [
  {
    uri: 'server-info',
    description: 'Server information'
  },
  {
    uri: 'documentation',
    description: 'API documentation'
  },
  {
    uri: 'example_resource',
    description: 'Example resource for testing'
  }
];

// Helper function to create JSON-RPC responses
function createJsonRpcResponse(id, result = null, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };

  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  return response;
}

// Routes
app.get('/health', (req, res) => {
  // Add security headers specifically for the health endpoint
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.send('OK');
});

app.get('/mcp', (req, res) => {
  res.json({
    name: SERVER_NAME,
    version: VERSION,
    protocol: 'MCP/1.0',
    description: 'Mock MCP Server for testing and validation'
  });
});

// Handle CORS preflight requests
app.options('/mcp', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// MCP JSON-RPC endpoint
app.post('/mcp', (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Validate JSON-RPC request
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0') {
    return res.json(createJsonRpcResponse(id, null, {
      code: -32600,
      message: 'Invalid JSON-RPC version'
    }));
  }

  // Handle methods
  switch (method) {
    case 'mcp.list_tools':
      return res.json(createJsonRpcResponse(id, {
        tools: mockTools
      }));

    case 'mcp.list_resources':
      return res.json(createJsonRpcResponse(id, {
        resources: mockResources
      }));

    case 'mcp.use_tool':
      const { tool, parameters } = params;

      // Validate required parameters
      if (!tool) {
        return res.json(createJsonRpcResponse(id, null, {
          code: -32602,
          message: 'Invalid params',
          data: 'Missing required parameter: tool'
        }));
      }

      if (tool === 'example_tool') {
        // Validate required parameters for example_tool
        if (!parameters || !parameters.message) {
          return res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Missing required parameter: message'
          }));
        }

        return res.json(createJsonRpcResponse(id, {
          message: `Received message: ${parameters.message}`,
          status: 'success'
        }));
      }

      return res.json(createJsonRpcResponse(id, {
        message: `Tool ${tool} executed successfully`,
        status: 'success'
      }));

    case 'mcp.access_resource':
      const { uri } = params;
      
      if (uri === 'example_resource') {
        return res.json(createJsonRpcResponse(id, {
          content: {
            data: 'This is example resource data',
            type: 'text'
          }
        }));
      }

      if (uri === 'server-info') {
        return res.json(createJsonRpcResponse(id, {
          content: {
            name: SERVER_NAME,
            version: VERSION,
            protocol: 'MCP/1.0'
          }
        }));
      }

      return res.json(createJsonRpcResponse(id, {
        content: {
          message: `Resource ${uri} accessed successfully`
        }
      }));

    default:
      return res.json(createJsonRpcResponse(id, null, {
        code: -32601,
        message: `Method '${method}' not found`
      }));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock MCP Server running at http://localhost:${PORT}`);
  console.log(`Server Name: ${SERVER_NAME}`);
  console.log(`Version: ${VERSION}`);
});