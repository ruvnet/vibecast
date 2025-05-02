# Cloudflare MCP Server

A Model Context Protocol (MCP) server implementation using Cloudflare Workers. This server provides a JSON-RPC 2.0 compatible endpoint for AI assistants to access tools and resources.

## What is MCP?

The Model Context Protocol (MCP) is an open standard designed to facilitate seamless integration between Large Language Model (LLM) applications and external data sources or tools. It allows AI assistants to extend their capabilities by accessing external services.

## Features

- **JSON-RPC 2.0 Compatible API**: Follows the JSON-RPC 2.0 specification for request/response handling
- **Tool and Resource Support**: Provides a framework for implementing and exposing tools and resources
- **Cloudflare Workers Integration**: Designed to run on Cloudflare's edge computing platform
- **Extensible Architecture**: Easily add new tools and resources to extend functionality
- **CORS Support**: Built-in support for cross-origin requests
- **Comprehensive Tools**: Text processing, data retrieval, and data analysis tools included
- **Rich Resources**: Documentation, reference data, and server information resources
- **Comprehensive Testing**: Unit, integration, and end-to-end tests
- **CI/CD Pipeline**: Automated testing and deployment via GitHub Actions
- **Validation Tools**: Client-side validation for API endpoints
- **Load Testing**: Performance testing under various load conditions
- **Security Checks**: Automated security validation

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Cloudflare account (for deployment)
- Wrangler CLI (`npm install -g wrangler`) - only needed for deployment, not for local development

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/cloudflare-mcp-server.git
cd cloudflare-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Configure your Cloudflare account with Wrangler (only needed for deployment):

```bash
wrangler login
```

### GLIBC Version Compatibility

The Cloudflare Workers runtime (workerd) requires specific GLIBC versions (2.32, 2.33, 2.34, or 2.35) that may not be available on all systems. If you encounter errors like:

```
Error: workerd binary doesn't support this platform.
Required GLIBC versions: 2.32, 2.33, 2.34, 2.35
```

We provide several alternative development methods that don't require Wrangler or specific GLIBC versions.

### Development

#### Using Minimal HTTP Server (Recommended)

Run the server locally using our minimal Node.js HTTP server:

```bash
npm run dev
# or
npm start
```

This will start a server at `http://localhost:3001` that implements the MCP functionality using Node.js's built-in HTTP module without any external dependencies. This server includes:

- Full MCP JSON-RPC 2.0 API implementation
- Server-Sent Events (SSE) support for real-time updates
- Standard `.well-known` endpoints for discovery
- Detailed documentation and examples

#### Using Standalone Express Server

Run the server locally using our standalone Express-based server:

```bash
npm run dev:standalone
```

This will start a server at `http://localhost:3001` that implements the MCP functionality directly in Express without requiring Wrangler.

#### Using Express Server with TypeScript Implementation

Run the server using our Express-based server that runs the compiled TypeScript code:

```bash
npm run dev:express
```

This will start a server at `http://localhost:3001` that runs the compiled TypeScript code.

#### Using Wrangler

If you prefer to use Wrangler and have compatible GLIBC versions (2.32+):

```bash
npm run dev:wrangler
```

This will start a local development server at `http://localhost:8787`.

#### Using Mock Server

For testing with a simplified mock implementation:

```bash
npm run dev:mock
```

This will start a mock MCP server at `http://localhost:3001`.

For more details, see the [Local Development Guide](docs/local-development.md).

### Deployment

Deploy to Cloudflare Workers:

```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to production environment
npm run deploy
```

## Testing and Validation

The MCP server includes a comprehensive testing suite to ensure reliability, performance, and security.

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
```

### Validation

Validate a server to ensure it's functioning correctly:

```bash
# Validate local environment
npm run validate:local

# Validate development environment
npm run validate:dev

# Validate production environment
npm run validate:production
```

### Load Testing

Test the server's performance under load:

```bash
# Run load tests against local environment
npm run load-test:local

# Run load tests against production
npm run load-test

# Run load tests with custom parameters (concurrency, requests per client)
node scripts/load-test.js production 100 50
```

### Security Testing

Check for security vulnerabilities:

```bash
# Run security checks against local environment
npm run security-check:local

# Run security checks against production
npm run security-check

# Run security checks against development
node scripts/security-check.js dev
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow for continuous integration and deployment:

- **Automated Testing**: Runs linting and all tests on every push and pull request
- **Automated Deployment**: Deploys to development on push to main branch
- **Manual Production Deployment**: Allows manual deployment to production with approval

For more details, see the [Testing and Deployment Guide](docs/testing-deployment.md).

## API Reference

### Endpoints

- `GET /health`: Health check endpoint
- `GET /mcp`: Server information endpoint
- `POST /mcp`: JSON-RPC 2.0 endpoint for MCP requests
- `GET /mcp/events`: Server-Sent Events (SSE) endpoint for real-time updates

### .well-known Endpoints

- `GET /.well-known/mcp`: MCP server discovery endpoint
- `GET /.well-known/oauth-authorization-server`: OAuth discovery endpoint
- `GET /.well-known/capabilities`: Server capabilities endpoint
- `GET /.well-known/`: Directory index with detailed information about all .well-known endpoints

### JSON-RPC Methods

- `mcp.use_tool`: Execute a tool
- `mcp.access_resource`: Access a resource
- `mcp.list_tools`: List available tools
- `mcp.list_resources`: List available resources
- `mcp.get_tool_schema`: Get schema for a specific tool
- `mcp.get_server_info`: Get server information

### Example Requests

#### List Tools

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "mcp.list_tools",
  "params": {}
}
```

#### Execute a Tool

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "mcp.use_tool",
  "params": {
    "tool": "example_tool",
    "parameters": {
      "message": "Hello, world!",
      "uppercase": true
    }
  }
}
```

#### Access a Resource

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "mcp.access_resource",
  "params": {
    "uri": "example_resource"
  }
}
```

### Available Tools

The server provides the following tools:

#### Text Processing Tools
- `summarize_text`: Summarizes text by extracting key sentences based on importance
- `translate_text`: Translates text between languages using a simple dictionary-based approach

#### Data Retrieval Tools
- `search_data`: Search for data in the database based on query parameters
- `fetch_data`: Fetch specific records by ID from the database
- `aggregate_data`: Perform aggregation operations on data

#### Data Analysis Tools
- `analyze_statistics`: Performs statistical analysis on numerical data
- `analyze_time_series`: Analyzes time series data to identify trends and patterns
- `linear_regression`: Performs linear regression analysis on data points

#### Utility Tools
- `example_tool`: An example tool for demonstration purposes
- `get_weather`: Get current weather information for a location
- `calculator`: Perform basic arithmetic calculations

### Available Resources

The server provides the following resources:

#### Documentation Resources
- `documentation/api`: API documentation for the MCP server
- `documentation/tools`: Documentation for available MCP tools
- `documentation/protocol`: Documentation for the Model Context Protocol

#### Data Resources
- `data/countries`: Reference data for countries
- `data/currencies`: Reference data for currencies
- `data/timezones`: Reference data for time zones
- `data/sample_dataset`: Sample dataset for demonstration and testing

#### Server Information Resources
- `server/system`: System information for the MCP server
- `server/config`: Configuration information for the MCP server
- `server/status`: Status information for the MCP server
- `server/usage`: Usage statistics for the MCP server

#### Basic Resources
- `example_resource`: An example resource for demonstration purposes
- `server_info`: Information about the MCP server
- `documentation`: Documentation for the MCP server

## Project Structure

The project is organized into the following structure:

```
/
├── .github/workflows/    # GitHub Actions workflows
├── docs/                 # Documentation
├── scripts/                    # Utility scripts
│   ├── validate.js             # API validation script
│   ├── load-test.js            # Load testing script
│   ├── security-check.js       # Security validation script
│   ├── mock-server.js          # Express-based mock server for local development
│   ├── express-server.js       # Express server with TypeScript implementation
│   ├── standalone-express-server.js # Standalone Express server
│   ├── simple-express-server.js # Simple Express server
│   └── minimal-server.js       # Minimal HTTP server without dependencies
├── src/                  # Source code
│   ├── tools/            # MCP tools implementation
│   │   ├── index.ts      # Tools export
│   │   ├── text-processor.ts
│   │   ├── data-retriever.ts
│   │   └── data-analyzer.ts
│   ├── resources/        # MCP resources implementation
│   │   ├── index.ts      # Resources export
│   │   ├── documentation.ts
│   │   ├── data.ts
│   │   └── server-info.ts
│   ├── tests/            # Test files
│   │   ├── unit/         # Unit tests
│   │   ├── integration/  # Integration tests
│   │   └── e2e/          # End-to-end tests
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

## Adding New Tools and Resources

### Adding a New Tool

1. Create a new tool in an appropriate file in the `src/tools/` directory:

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
```

2. Import and add your tool to the tools map in `src/tools/index.ts`:

```typescript
// src/tools/index.ts
import { myNewTool } from './my-category';

export const tools: Record<string, McpTool> = {
  // ...existing tools
  my_new_tool: myNewTool,
};
```

### Adding a New Resource

1. Create a new resource in an appropriate file in the `src/resources/` directory:

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
```

2. Import and add your resource to the resources map in `src/resources/index.ts`:

```typescript
// src/resources/index.ts
import { myNewResource } from './my-category';

export const resources: Record<string, McpResource> = {
  // ...existing resources
  'my_category/my_new_resource': myNewResource,
};
```

## Client Implementation Examples

For examples of how to implement clients for the MCP server, see the [client examples](docs/client-examples.md) documentation.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

