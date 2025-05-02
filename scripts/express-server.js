/**
 * Express Server for Cloudflare MCP
 * 
 * This script creates an Express server that runs the actual compiled MCP implementation
 * without requiring Wrangler or specific GLIBC versions.
 * 
 * It adapts Express requests/responses to the Cloudflare Workers format expected by the MCP code.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// Check if chalk is ESM module (v5+) and handle accordingly
const chalkFn = chalk.red ? chalk : chalk.default;

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3001;

// Create Express app
const app = express();

// Ensure the dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  console.error(chalkFn.red('❌ Error: dist directory not found. Please run "npm run build" first.'));
  process.exit(1);
}

// Environment variables for the MCP server
const env = {
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME || 'cloudflare-mcp-server',
  MCP_VERSION: process.env.MCP_VERSION || '1.0.0',
  MCP_ENV: process.env.MCP_ENV || 'local'
};

// Create a mock ExecutionContext
const ctx = {
  waitUntil: (promise) => {
    // Track background tasks
    promise.catch(err => console.error('Background task error:', err));
  },
  passThroughOnException: () => {
    // Exception handling
  }
};

// Import required modules from the compiled code
let handleMcpRequest, jsonResponse, errorResponse;
try {
  // Import specific functions instead of the entire worker
  const mcp = require('../dist/mcp.js');
  const utils = require('../dist/utils.js');
  
  handleMcpRequest = mcp.handleMcpRequest;
  jsonResponse = utils.jsonResponse;
  errorResponse = utils.errorResponse;
  
  console.log(chalkFn.green('✅ Successfully loaded MCP implementation'));
} catch (error) {
  console.error(chalkFn.red('❌ Error loading MCP implementation:'));
  console.error(error);
  process.exit(1);
}

// Middleware to adapt Express request to Cloudflare Worker Request
function adaptRequest(req) {
  // Create headers object from Express request headers
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    headers.append(key, value);
  });

  // Create a URL object
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
  
  // Create request init object
  const init = {
    method: req.method,
    headers: headers
  };

  // Add body for non-GET/HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // If body is already parsed as JSON, stringify it
    if (req.body && typeof req.body === 'object') {
      init.body = JSON.stringify(req.body);
    } else if (req._body && req.body) {
      // If body is already parsed but not as JSON
      init.body = req.body;
    } else {
      // For raw body
      init.body = req.rawBody;
    }
  }

  // Create and return a Request object
  return new Request(url.toString(), init);
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
          // Leave raw body as is if JSON parsing fails
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

// Define routes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/mcp', (req, res) => {
  const serverInfo = {
    name: env.MCP_SERVER_NAME,
    version: env.MCP_VERSION,
    protocol: 'mcp',
    protocol_version: '0.1.0',
    jsonrpc: '2.0',
    description: 'Model Context Protocol server implemented with Express'
  };
  
  // Use the jsonResponse function but extract the body
  const response = jsonResponse(serverInfo);
  res.json(JSON.parse(response.body));
});

app.post('/mcp', async (req, res) => {
  try {
    // Adapt Express request to Cloudflare Worker Request
    const workerRequest = adaptRequest(req);
    
    // Process the request using the handleMcpRequest function
    const workerResponse = await handleMcpRequest(workerRequest, env);
    
    // Set status code
    res.status(workerResponse.status);
    
    // Set headers
    const headers = Object.fromEntries(workerResponse.headers.entries());
    Object.entries(headers).forEach(([key, value]) => {
      res.set(key, value);
    });
    
    // Send response body
    const contentType = workerResponse.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      // JSON response
      const json = await workerResponse.json();
      res.json(json);
    } else {
      // Text or other response
      const text = await workerResponse.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error.message
      },
      id: null
    });
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
  console.log(chalkFn.blue('🚀 Express MCP Server running at http://localhost:' + port));
  console.log(chalkFn.blue(`🌐 Server Name: ${env.MCP_SERVER_NAME}`));
  console.log(chalkFn.blue(`📋 Version: ${env.MCP_VERSION}`));
  console.log(chalkFn.blue(`🔧 Environment: ${env.MCP_ENV}`));
  console.log(chalkFn.cyan(`💡 Press Ctrl+C to stop the server`));
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalkFn.yellow('\n🛑 Shutting down server...'));
  console.log(chalkFn.green('👋 Server has been stopped'));
  process.exit(0);
});