# Testing and Deployment Guide

This document provides comprehensive instructions for testing and deploying the Cloudflare MCP server.

## Table of Contents

- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [Integration Tests](#integration-tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [Validation Tests](#validation-tests)
  - [Load Testing](#load-testing)
  - [Security Testing](#security-testing)
- [Deployment](#deployment)
  - [Local Environment](#local-environment)
  - [Development Environment](#development-environment)
  - [Production Environment](#production-environment)
  - [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
  - [Environment Variables](#environment-variables)
  - [Secrets Management](#secrets-management)

## Testing

The MCP server includes a comprehensive testing suite to ensure reliability, performance, and security.

### Unit Tests

Unit tests verify the functionality of individual components in isolation.

```bash
# Run all unit tests
npm run test:unit

# Run specific unit test file
npx jest src/tests/unit/utils.test.ts
```

Unit tests cover:
- JSON-RPC request/response handling
- Tool and resource registration
- Parameter validation
- Error handling

### Integration Tests

Integration tests verify that different components work together correctly.

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npx jest src/tests/integration/server.test.ts
```

Integration tests cover:
- HTTP routing
- Request handling
- Tool execution
- Resource access
- Error handling

### End-to-End Tests

End-to-end tests simulate real-world usage of the MCP server from a client perspective.

```bash
# Run all end-to-end tests
npm run test:e2e

# Run specific end-to-end test file
npx jest src/tests/e2e/client.test.ts
```

End-to-end tests cover:
- Complete client-server workflows
- Error handling
- Edge cases

### Validation Tests
Validation tests verify that a deployed or local MCP server is functioning correctly.

```bash
# Validate local environment
npm run validate:local

# Validate development environment
npm run validate:dev

# Validate production environment
npm run validate:production
```
```

The validation script checks:
- Server health
- Server information
- Tool listing
- Resource listing
- Tool execution
- Resource access
- CORS support

### Load Testing

Load testing verifies the performance of the MCP server under various levels of load.

```bash
# Run load tests against local environment
npm run load-test:local

# Run load tests against production
npm run load-test

# Run load tests with custom parameters
node scripts/load-test.js production 100 50
```

The load testing script supports the following parameters:
- Environment (local, dev, production)
- Concurrency (number of simultaneous clients)
- Requests per client (number of requests each client sends)

The script measures:
- Success rate
- Requests per second
- Response time statistics (min, max, avg, median, 95th percentile, 99th percentile)

### Security Testing

Security testing checks for common security vulnerabilities and issues.

```bash
# Run security checks against local environment
npm run security-check:local

# Run security checks against production
npm run security-check

# Run security checks against development
node scripts/security-check.js dev
```

The security testing script checks:
- HTTP headers
- JSON injection vulnerabilities
- Method validation
- Parameter validation

## Deployment

The MCP server can be deployed to Cloudflare Workers using Wrangler or run locally using Express.

### Local Environment

For local development and testing without requiring Wrangler or specific GLIBC versions, you can use the Express-based mock server:

```bash
# Start the local mock server
npm run dev:local
```

This will start a mock MCP server at `http://localhost:3001` that implements the same API as the Cloudflare Workers version.

To validate the local server:

```bash
# Validate local environment
npm run validate:local
```

To run load tests against the local server:

```bash
# Run load tests against local environment
npm run load-test:local
```

To run security checks against the local server:

```bash
# Run security checks against local environment
npm run security-check:local
```

For more details, see the [Local Development Guide](./local-development.md).

### Development Environment

To deploy to the development environment:

```bash
# Deploy to development
npm run dev

# Or using Wrangler directly
npx wrangler deploy --env dev
```

### Production Environment

To deploy to the production environment:

```bash
# Deploy to production
npm run deploy

# Or using Wrangler directly
npx wrangler deploy
```

### CI/CD Pipeline

The project includes a GitHub Actions workflow for continuous integration and deployment.

The workflow is defined in `.github/workflows/ci-cd.yml` and includes the following jobs:

1. **Test**: Runs linting and all tests
2. **Build**: Builds the project
3. **Deploy to Development**: Deploys to the development environment (on push to main or manual trigger)
4. **Deploy to Production**: Deploys to the production environment (manual trigger only)

To manually trigger a deployment:

1. Go to the GitHub repository
2. Click on "Actions"
3. Select the "CI/CD Pipeline" workflow
4. Click "Run workflow"
5. Select the branch and environment
6. Click "Run workflow"

## Environment Configuration

### Environment Variables

The MCP server requires the following environment variables:

- `MCP_SERVER_NAME`: The name of the MCP server
- `MCP_VERSION`: The version of the MCP server
- `MCP_ENV`: The environment (dev, production)

These variables can be configured in the `wrangler.toml` file:

```toml
[env.dev]
name = "cloudflare-mcp-server-dev"
vars = { MCP_SERVER_NAME = "cloudflare-mcp-dev", MCP_VERSION = "1.0.0", MCP_ENV = "dev" }

[env.production]
name = "cloudflare-mcp-server"
vars = { MCP_SERVER_NAME = "cloudflare-mcp", MCP_VERSION = "1.0.0", MCP_ENV = "production" }
```

### Secrets Management

Sensitive information such as API keys should be stored as secrets.

To add a secret using Wrangler:

```bash
# Add a secret to development environment
npx wrangler secret put API_KEY --env dev

# Add a secret to production environment
npx wrangler secret put API_KEY
```

To use a secret in your code:

```typescript
export interface Env {
  API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Access the secret
    const apiKey = env.API_KEY;
    // ...
  }
};
```

For CI/CD, secrets should be stored in GitHub Secrets and referenced in the workflow file:

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}