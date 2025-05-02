b# Local Development Guide for Cloudflare MCP Server

This guide explains how to run and test the Cloudflare MCP server locally without requiring specific GLIBC versions or Wrangler.

## GLIBC Version Issue

Cloudflare's Wrangler tool uses the `workerd` binary which requires newer GLIBC versions (2.32, 2.33, 2.34, 2.35) than what's available on many systems. This can result in errors like:

```
Error: The module '/path/to/node_modules/wrangler/node_modules/@cloudflare/workerd-linux-64/bin/workerd' was compiled against a different Node.js version using NODE_MODULE_VERSION $XYZ. This version of Node.js requires NODE_MODULE_VERSION $ABC.
```

or

```
Error: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.32' not found
Error: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.33' not found
Error: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.34' not found
```

## Development Options

We provide three options for local development:

1. **Express Server (Recommended)**: Runs the actual compiled MCP implementation using Express
2. **Mock Server**: Uses a simplified mock implementation
3. **Wrangler**: For systems with compatible GLIBC versions

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Start the Express server (recommended):
   ```bash
   npm run dev
   ```

   This will start the Express server running the actual MCP implementation at http://localhost:3001.

## Development Server Options

### 1. Express Server (Recommended)

The Express server is implemented in `scripts/express-server.js` and provides the following:

- Runs the actual compiled TypeScript code from the `dist` directory
- Adapts Express requests/responses to the Cloudflare Workers format
- Properly handles all routes defined in the MCP implementation
- Provides the same API and functionality as the Cloudflare Workers version
- Works without requiring specific GLIBC versions

To use the Express server:

```bash
npm run dev
# or
npm run dev:express
```

### 2. Mock Server

The mock server is implemented in `scripts/mock-server.js` and provides a simplified implementation:

- `/health` endpoint for health checks
- `/mcp` endpoint for MCP JSON-RPC requests
- Security headers for all responses
- Proper JSON-RPC error handling
- Parameter validation for tools

To use the mock server:

```bash
npm run dev:mock
```

### 3. Wrangler (Requires compatible GLIBC)

If your system has compatible GLIBC versions (2.32+), you can use Wrangler for development:

```bash
npm run dev:wrangler
```

## Validation and Testing

The following scripts are available to validate and test your MCP server:

### Validation

Run the validation script to verify that your MCP server is functioning correctly:

```bash
npm run validate:local
```

This script tests various endpoints and functionality, including:
- Health check
- Server info
- List tools
- List resources
- Execute example tool
- Access example resource
- CORS support

### Load Testing

Run the load test script to verify the performance of your MCP server under load:

```bash
npm run load-test:local
```

This script simulates multiple concurrent clients making requests to your MCP server and reports performance metrics.

### Security Checks

Run the security check script to identify potential security issues:

```bash
npm run security-check:local
```

This script checks for:
- Proper HTTP headers
- JSON injection vulnerabilities
- Method validation
- Parameter validation

## Environment Configuration

The validation, load testing, and security check scripts support different environments:

- `local`: http://localhost:3001
- `dev`: https://cloudflare-mcp-server-dev.workers.dev
- `production`: https://cloudflare-mcp-server.workers.dev

## Troubleshooting

### Common Issues

1. **GLIBC version errors with Wrangler**: If you encounter GLIBC version errors when using Wrangler, switch to the Express server:
   ```bash
   npm run dev:express
   ```

2. **Port already in use**: If port 3001 is already in use, you can change the port in the server scripts:
   ```bash
   # For Express server
   node scripts/express-server.js 3002
   
   # For Mock server
   node scripts/mock-server.js 3002
   ```

3. **Missing dependencies**: If you encounter errors about missing dependencies, run `npm install` to install all required packages.

4. **TypeScript build errors**: If you encounter TypeScript build errors, check your code for type errors and fix them before building.

5. **Module not found errors**: If you see errors about modules not being found when running the Express server, make sure you've built the TypeScript code:
   ```bash
   npm run build
   npm run dev:express
   ```

### Security Warnings

The security check script may report warnings for the local environment. These warnings are informational and do not prevent the script from passing in the local environment.

## Docker Alternative

If you prefer to use Wrangler but have GLIBC version issues, you can use Docker to run Wrangler in a compatible environment:

```dockerfile
FROM node:18-alpine
RUN npm install -g wrangler
WORKDIR /app
VOLUME ["/app"]
EXPOSE 8787
CMD ["wrangler", "dev", "--local"]
```

Save this as `Dockerfile` and run:

```bash
docker build -t wrangler-dev .
docker run -it -v $(pwd):/app -p 8787:8787 wrangler-dev
```

## Next Steps

After validating your MCP server locally, you can deploy it to Cloudflare Workers using Wrangler:

```bash
npm run deploy
```

This will deploy your MCP server to Cloudflare Workers using the configuration in `wrangler.toml`.