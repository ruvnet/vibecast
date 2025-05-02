# Project Structure and Architecture

This document provides an overview of the Cloudflare MCP Server project structure and architecture.

## Table of Contents

- [Project Overview](#project-overview)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Request Flow](#request-flow)
- [Extension Points](#extension-points)
- [Deployment Architecture](#deployment-architecture)

## Project Overview

The Cloudflare MCP Server is a Model Context Protocol (MCP) implementation using Cloudflare Workers. It provides a JSON-RPC 2.0 compatible API that allows AI assistants to access tools and resources.

The server is designed to be:

- **Lightweight**: Optimized for Cloudflare Workers' serverless environment
- **Extensible**: Easy to add new tools and resources
- **Standards-Compliant**: Follows the JSON-RPC 2.0 specification
- **Secure**: Implements proper validation and error handling
- **Performant**: Designed for low-latency responses

## Directory Structure

```
/
├── .github/workflows/    # GitHub Actions workflows
│   └── ci-cd.yml         # CI/CD pipeline configuration
├── docs/                 # Documentation
│   ├── client-examples.md # Client implementation examples
│   ├── project-structure.md # Project structure documentation
│   └── testing-deployment.md # Testing and deployment guide
├── scripts/              # Utility scripts
│   ├── load-test.js      # Load testing script
│   ├── security-check.js # Security testing script
│   └── validate.js       # Validation script
├── src/                  # Source code
│   ├── tools/            # MCP tools implementation
│   │   ├── index.ts      # Tools export
│   │   ├── text-processor.ts # Text processing tools
│   │   ├── data-retriever.ts # Data retrieval tools
│   │   └── data-analyzer.ts  # Data analysis tools
│   ├── resources/        # MCP resources implementation
│   │   ├── index.ts      # Resources export
│   │   ├── documentation.ts # Documentation resources
│   │   ├── data.ts       # Data resources
│   │   └── server-info.ts # Server information resources
│   ├── tests/            # Test files
│   │   ├── unit/         # Unit tests
│   │   │   ├── utils.test.ts # Utility function tests
│   │   │   └── mcp.test.ts # MCP implementation tests
│   │   ├── integration/  # Integration tests
│   │   │   └── server.test.ts # Server integration tests
│   │   ├── e2e/          # End-to-end tests
│   │   │   └── client.test.ts # Client-server interaction tests
│   │   └── setup.ts      # Test setup file
│   ├── index.ts          # Main entry point
│   ├── mcp.ts            # MCP implementation
│   ├── types.ts          # Type definitions
│   └── utils.ts          # Utility functions
├── .gitignore            # Git ignore file
├── jest.config.js        # Jest configuration
├── package.json          # NPM package configuration
├── tsconfig.json         # TypeScript configuration
└── wrangler.toml         # Wrangler configuration
```

## Core Components

### Entry Point (`src/index.ts`)

The main entry point for the Cloudflare Worker. It sets up the router, defines the endpoints, and handles incoming requests.

Key responsibilities:
- Setting up HTTP routes
- Handling CORS
- Providing health check endpoint
- Exposing MCP server information
- Routing MCP requests to the appropriate handler

### MCP Implementation (`src/mcp.ts`)

The core MCP implementation that handles JSON-RPC requests and routes them to the appropriate tools and resources.

Key responsibilities:
- Parsing and validating JSON-RPC requests
- Handling batch requests
- Routing requests to the appropriate tool or resource
- Formatting JSON-RPC responses
- Error handling

### Types (`src/types.ts`)

Type definitions for the MCP implementation, including JSON-RPC request/response types, tool and resource definitions, and error codes.

Key types:
- `JsonRpcRequest`: JSON-RPC 2.0 request
- `JsonRpcResponse`: JSON-RPC 2.0 response
- `McpTool`: Tool definition
- `McpResource`: Resource definition
- `McpServerConfig`: Server configuration

### Utilities (`src/utils.ts`)

Utility functions for handling requests, responses, and common operations.

Key functions:
- `handleCors`: Handle CORS preflight requests
- `parseJsonBody`: Parse and validate JSON from a request
- `jsonResponse`: Create a JSON response with proper headers
- `jsonRpcSuccess`: Create a JSON-RPC success response
- `jsonRpcError`: Create a JSON-RPC error response
- `validateJsonRpcRequest`: Validate a JSON-RPC request

### Tools (`src/tools/`)

Implementation of MCP tools that can be executed by clients.

Each tool follows this structure:
```typescript
export const exampleTool: McpTool = {
  name: 'example_tool',
  description: 'Description of the tool',
  parameters: {
    // Parameter definitions
  },
  handler: async (params) => {
    // Tool implementation
    return {
      // Tool result
    };
  }
};
```

### Resources (`src/resources/`)

Implementation of MCP resources that can be accessed by clients.

Each resource follows this structure:
```typescript
export const exampleResource: McpResource = {
  uri: 'example_resource',
  description: 'Description of the resource',
  handler: async () => {
    // Resource implementation
    return {
      // Resource content
    };
  }
};
```

## Request Flow

1. **HTTP Request**: Client sends an HTTP request to the MCP server
2. **Router**: The router in `index.ts` routes the request to the appropriate handler
3. **MCP Handler**: For MCP requests, the handler in `mcp.ts` processes the JSON-RPC request
4. **Validation**: The request is validated using `validateJsonRpcRequest`
5. **Method Routing**: The request is routed to the appropriate method handler based on the method name
6. **Tool/Resource Execution**: For tool or resource requests, the appropriate tool or resource handler is executed
7. **Response Formatting**: The response is formatted as a JSON-RPC response
8. **HTTP Response**: The response is sent back to the client

### Example: Tool Execution Flow

```
Client Request
  ↓
HTTP Router (index.ts)
  ↓
MCP Handler (mcp.ts)
  ↓
JSON-RPC Validation
  ↓
Method Routing (mcp.use_tool)
  ↓
Tool Lookup (tools/index.ts)
  ↓
Tool Execution (e.g., tools/text-processor.ts)
  ↓
Result Formatting
  ↓
JSON-RPC Response
  ↓
HTTP Response
```

## Extension Points

The MCP server is designed to be easily extensible. The main extension points are:

### Adding New Tools

To add a new tool:

1. Create a new tool definition in an appropriate file in the `src/tools/` directory
2. Export the tool from the file
3. Import and add the tool to the tools map in `src/tools/index.ts`

Example:
```typescript
// src/tools/my-category.ts
import { McpTool } from '../types';

export const myNewTool: McpTool = {
  name: 'my_new_tool',
  description: 'Description of my new tool',
  parameters: {
    param1: {
      type: 'string',
      description: 'Description of parameter 1',
      required: true,
    },
    param2: {
      type: 'number',
      description: 'Description of parameter 2',
      required: false,
      default: 0,
    },
  },
  handler: async (params: Record<string, any>) => {
    // Implement your tool logic here
    return {
      result: 'Tool result',
    };
  },
};

// src/tools/index.ts
import { myNewTool } from './my-category';

export const tools: Record<string, McpTool> = {
  // ...existing tools
  my_new_tool: myNewTool,
};
```

### Adding New Resources

To add a new resource:

1. Create a new resource definition in an appropriate file in the `src/resources/` directory
2. Export the resource from the file
3. Import and add the resource to the resources map in `src/resources/index.ts`

Example:
```typescript
// src/resources/my-category.ts
import { McpResource } from '../types';

export const myNewResource: McpResource = {
  uri: 'my_category/my_new_resource',
  description: 'Description of my new resource',
  handler: async () => {
    // Implement your resource logic here
    return {
      data: 'Resource data',
    };
  },
};

// src/resources/index.ts
import { myNewResource } from './my-category';

export const resources: Record<string, McpResource> = {
  // ...existing resources
  'my_category/my_new_resource': myNewResource,
};
```

### Adding New Methods

To add a new JSON-RPC method:

1. Add the method name to the `methods` array in `src/index.ts`
2. Add a handler function for the method in `src/mcp.ts`
3. Add the method to the switch statement in the `processSingleRequest` function in `src/mcp.ts`

Example:
```typescript
// src/mcp.ts
async function handleNewMethod(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  // Implement your method logic here
  return jsonRpcSuccess(request.id, {
    result: 'Method result',
  });
}

// In processSingleRequest function
switch (rpcRequest.method) {
  // ...existing methods
  case 'mcp.new_method':
    return await handleNewMethod(rpcRequest);
  // ...
}

// src/index.ts
// In the GET /mcp handler
methods: [
  // ...existing methods
  'mcp.new_method',
]
```

## Deployment Architecture

The MCP server is designed to be deployed to Cloudflare Workers, a serverless platform that runs on Cloudflare's global network.

### Development Environment

The development environment is deployed to a separate Cloudflare Workers instance with the following configuration:

```toml
# wrangler.toml
[env.dev]
name = "cloudflare-mcp-server-dev"
vars = { MCP_SERVER_NAME = "cloudflare-mcp-dev", MCP_VERSION = "1.0.0", MCP_ENV = "dev" }
```

### Production Environment

The production environment is deployed to the main Cloudflare Workers instance with the following configuration:

```toml
# wrangler.toml
[env.production]
name = "cloudflare-mcp-server"
vars = { MCP_SERVER_NAME = "cloudflare-mcp", MCP_VERSION = "1.0.0", MCP_ENV = "production" }
```

### CI/CD Pipeline

The CI/CD pipeline is implemented using GitHub Actions and consists of the following stages:

1. **Test**: Run linting and all tests
2. **Build**: Build the project
3. **Deploy to Development**: Deploy to the development environment (on push to main or manual trigger)
4. **Deploy to Production**: Deploy to the production environment (manual trigger only)

The pipeline is defined in `.github/workflows/ci-cd.yml`.

### Monitoring and Logging

Monitoring and logging are handled by Cloudflare Workers' built-in monitoring and logging capabilities:

- **Logs**: Available in the Cloudflare Workers dashboard
- **Metrics**: Request count, CPU time, and error rate metrics are available in the dashboard
- **Alerts**: Can be configured in the Cloudflare dashboard

For additional monitoring, consider implementing:

- Custom logging to an external service
- Health check endpoint monitoring
- Performance monitoring using the load testing script