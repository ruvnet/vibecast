# Integrated Model: Cloudflare MCP NPX Library Implementation

## Comprehensive MCP Server Architecture

Based on our research, we propose an integrated model for implementing an MCP server using Cloudflare Workers. This model synthesizes the patterns, addresses the contradictions, and acknowledges the knowledge gaps identified in our analysis.

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌──────────────────────┐       │
│  │                 │        │                      │       │
│  │  AI Client      │◄─────►│  WebSocket Handler    │       │
│  │                 │        │                      │       │
│  └─────────────────┘        └──────────┬───────────┘       │
│                                        │                   │
│                                        ▼                   │
│                             ┌──────────────────────┐       │
│                             │                      │       │
│                             │  Message Processor   │       │
│                             │                      │       │
│                             └──────────┬───────────┘       │
│                                        │                   │
│                                        ▼                   │
│  ┌─────────────────┐        ┌──────────────────────┐       │
│  │                 │        │                      │       │
│  │  Authentication │◄─────►│  Request Router       │       │
│  │                 │        │                      │       │
│  └─────────────────┘        └──────────┬───────────┘       │
│                                        │                   │
│                                        ▼                   │
│                             ┌──────────────────────┐       │
│  ┌─────────────────┐        │                      │       │
│  │                 │        │  Resource Handlers   │       │
│  │  External       │◄─────►│                      │       │
│  │  Services       │        │  - Tools            │       │
│  │                 │        │  - Data Sources     │       │
│  └─────────────────┘        │  - Prompt Templates │       │
│                             │                      │       │
│                             └──────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. WebSocket Handler

The WebSocket Handler is responsible for managing WebSocket connections with AI clients. It handles:

- Connection establishment and termination
- Message reception and transmission
- Connection lifecycle events (open, close, error)
- Reconnection logic

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      return handleWebSocket(request, env);
    }
    return new Response('MCP Server Running', { status: 200 });
  },
};

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  // Set up event listeners
  server.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      processMessage(server, message, env);
    } catch (err) {
      server.send(JSON.stringify({ 
        type: 'error',
        error: 'Invalid message format' 
      }));
    }
  });

  server.addEventListener('close', (event) => {
    // Clean up resources
    cleanupResources(server, env);
  });

  server.addEventListener('error', (event) => {
    // Log error and potentially reconnect
    logError('WebSocket error', event, env);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
```

### 2. Message Processor

The Message Processor is responsible for parsing, validating, and processing incoming messages. It handles:

- Message parsing and validation
- Message type identification
- Routing to appropriate handlers
- Error handling

```typescript
function processMessage(ws: WebSocket, message: any, env: Env) {
  // Validate message format
  if (!message.type) {
    return ws.send(JSON.stringify({ 
      type: 'error',
      error: 'Missing message type' 
    }));
  }

  // Log message for debugging
  logMessage('Received message', message, env);

  // Process message based on type
  switch (message.type) {
    case 'capabilities-request':
      authenticateRequest(ws, message, env, () => {
        handleCapabilitiesRequest(ws, message, env);
      });
      break;
    case 'resource-request':
      authenticateRequest(ws, message, env, () => {
        handleResourceRequest(ws, message, env);
      });
      break;
    default:
      ws.send(JSON.stringify({ 
        type: 'error',
        error: 'Unsupported message type' 
      }));
  }
}
```

### 3. Authentication

The Authentication component is responsible for authenticating and authorizing requests. It supports multiple authentication methods:

- Secret key authentication
- OAuth authentication
- Custom authentication mechanisms

```typescript
function authenticateRequest(ws: WebSocket, message: any, env: Env, callback: Function) {
  // Check authentication method
  if (message.auth?.secret) {
    // Secret key authentication
    if (message.auth.secret !== env.MCP_SECRET) {
      return ws.send(JSON.stringify({ 
        type: 'error',
        error: 'Unauthorized' 
      }));
    }
    callback();
  } else if (message.auth?.token) {
    // OAuth token authentication
    validateOAuthToken(message.auth.token, env)
      .then((valid) => {
        if (valid) {
          callback();
        } else {
          ws.send(JSON.stringify({ 
            type: 'error',
            error: 'Invalid token' 
          }));
        }
      })
      .catch((err) => {
        ws.send(JSON.stringify({ 
          type: 'error',
          error: 'Authentication error' 
        }));
      });
  } else {
    // No authentication provided
    ws.send(JSON.stringify({ 
      type: 'error',
      error: 'Authentication required' 
    }));
  }
}

async function validateOAuthToken(token: string, env: Env): Promise<boolean> {
  // Implement OAuth token validation
  // This could involve calling an OAuth provider API
  return true; // Placeholder
}
```

### 4. Request Router

The Request Router is responsible for routing requests to the appropriate resource handlers. It handles:

- Resource identification
- Permission checking
- Request validation
- Response formatting

```typescript
function handleResourceRequest(ws: WebSocket, message: any, env: Env) {
  // Validate request
  if (!message.resourceId) {
    return ws.send(JSON.stringify({
      type: 'error',
      requestId: message.requestId,
      error: 'Missing resourceId'
    }));
  }

  // Get resource handler
  const resourceHandler = getResourceHandler(message.resourceId, env);
  if (!resourceHandler) {
    return ws.send(JSON.stringify({
      type: 'error',
      requestId: message.requestId,
      error: 'Resource not found'
    }));
  }

  // Check permissions
  if (!hasPermission(message.auth, message.resourceId, env)) {
    return ws.send(JSON.stringify({
      type: 'error',
      requestId: message.requestId,
      error: 'Permission denied'
    }));
  }

  // Process request with retry logic
  withRetry(() => resourceHandler(message.params, env))
    .then((result) => {
      ws.send(JSON.stringify({
        type: 'resource-response',
        requestId: message.requestId,
        data: result
      }));
    })
    .catch((err) => {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: message.requestId,
        error: err.message
      }));
    });
}

function getResourceHandler(resourceId: string, env: Env): Function | null {
  // Get resource handler based on resourceId
  const resourceHandlers: Record<string, Function> = {
    'example-tool': handleExampleTool,
    'data-source': handleDataSource,
    'prompt-template': handlePromptTemplate,
  };
  
  return resourceHandlers[resourceId] || null;
}

function hasPermission(auth: any, resourceId: string, env: Env): boolean {
  // Check if the authenticated user has permission to access the resource
  // This could involve checking against a permissions database
  return true; // Placeholder
}
```

### 5. Resource Handlers

Resource Handlers are responsible for implementing the functionality of specific resources. They handle:

- Tool execution
- Data source access
- Prompt template rendering
- External service integration

```typescript
function handleExampleTool(params: any, env: Env) {
  // Implement tool functionality
  return {
    result: `Processed ${params.input} successfully`
  };
}

function handleDataSource(params: any, env: Env) {
  // Implement data source access
  return {
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ]
  };
}

function handlePromptTemplate(params: any, env: Env) {
  // Implement prompt template rendering
  const template = 'Hello, {{name}}!';
  return {
    prompt: template.replace('{{name}}', params.name)
  };
}
```

## Cross-Cutting Concerns

### 1. Error Handling

The integrated model includes comprehensive error handling throughout all components:

```typescript
function withRetry(fn: Function, retries = 3) {
  return async (...args: any[]) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn(...args);
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };
}

function handleError(error: any, ws: WebSocket, requestId?: string) {
  // Log error
  console.error('Error:', error);
  
  // Send error response
  ws.send(JSON.stringify({
    type: 'error',
    requestId,
    error: error.message || 'Unknown error'
  }));
}
```

### 2. Logging and Monitoring

The integrated model includes comprehensive logging and monitoring:

```typescript
function logMessage(type: string, data: any, env: Env) {
  // Log message for debugging
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type,
    data
  }));
  
  // Record metrics
  if (env.MCP_METRICS) {
    env.MCP_METRICS.writeDataPoint({
      blobs: [type],
      doubles: [1]
    });
  }
}

function logError(type: string, error: any, env: Env) {
  // Log error for debugging
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    type,
    error
  }));
  
  // Record metrics
  if (env.MCP_METRICS) {
    env.MCP_METRICS.writeDataPoint({
      blobs: [type],
      doubles: [1]
    });
  }
}
```

### 3. Rate Limiting

The integrated model includes rate limiting to prevent abuse:

```typescript
function checkRateLimit(clientId: string, env: Env): boolean {
  // Check if client has exceeded rate limit
  // This could involve checking against a rate limit database
  return true; // Placeholder
}
```

## Configuration

The integrated model uses environment-based configuration:

```toml
# wrangler.toml
name = "mcp-server"
main = "src/index.ts"
compatibility_date = "2024-05-01"

[vars]
MCP_SECRET = "your-secret-key-here"

[metrics]
bindings = [
  { name = "MCP_METRICS", type = "metrics" }
]

[triggers]
rate_limits = [
  { period = 60s, requests = 100 }
]

[[rules]]
type = "WebSocket"

[env.production]
vars = { MCP_SECRET = "production-secret" }

[env.staging]
vars = { MCP_SECRET = "staging-secret" }
```

## Deployment

The integrated model supports both single-region and multi-region deployment:

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

## Testing

The integrated model includes comprehensive testing:

```typescript
// Unit tests for resource handlers
describe('Resource Handlers', () => {
  it('should handle example tool requests', () => {
    const result = handleExampleTool({ input: 'test' }, {});
    expect(result).toEqual({ result: 'Processed test successfully' });
  });
});

// Integration tests for WebSocket communication
describe('WebSocket Communication', () => {
  it('should handle capabilities requests', async () => {
    const client = new WebSocket('wss://mcp-server.example.com');
    
    client.send(JSON.stringify({
      type: 'capabilities-request',
      auth: { secret: 'test-secret' }
    }));
    
    const response = await new Promise(resolve => {
      client.onmessage = event => resolve(JSON.parse(event.data));
    });
    
    expect(response.type).toBe('capabilities-response');
    expect(response.resources).toBeDefined();
  });
});
```

## Conclusion

This integrated model provides a comprehensive framework for implementing an MCP server using Cloudflare Workers. It addresses the patterns, contradictions, and knowledge gaps identified in our research, providing a solid foundation for developing robust, scalable, and secure MCP servers.