# Vibecast MCP Server

A complete implementation of the Model Context Protocol (MCP) Server specification for Vibecast live coding sessions.

## Overview

This MCP server provides a robust implementation of the Model Context Protocol, supporting tool discovery, invocation, authentication, and comprehensive audit logging. Built with TypeScript and designed for extensibility.

## Features

- **Tool Discovery**: Automatic discovery of tools from the `/tools/` directory using JSON Schema 1.1 descriptors
- **STDIO Transport**: Full support for local development via standard input/output
- **Request/Response Protocol**: UUID-based request tracking with sync/async execution modes
- **Security**: OAuth 2.1 Bearer tokens, mutual TLS, and keypair authentication support
- **Audit Logging**: Comprehensive logging for security and compliance
- **Input/Output Validation**: JSON Schema-based validation for all tool inputs and outputs
- **Extensible Architecture**: Easy to add new tools and handlers

## Installation

```bash
npm install
npm run build
```

## Quick Start

### Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### Using the Server

The server listens on STDIN and responds on STDOUT. You can interact with it using JSON-formatted requests or special commands.

#### Special Commands

- `/help` - Show help message
- `/tools` - List all available tools
- `/info` - Show server information
- `/search <keyword>` - Search tools by keyword
- `/reload` - Reload tools from disk
- `/exit` - Exit the server

#### Tool Invocation

Send a JSON request to invoke a tool:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "toolId": "calculator",
  "arguments": {
    "operation": "add",
    "a": 5,
    "b": 3
  },
  "executionMode": "sync"
}
```

Response:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "result": {
    "result": 8,
    "operation": "add"
  },
  "metadata": {
    "executionDuration": 2
  }
}
```

## Built-in Tools

### Calculator

Performs basic arithmetic operations.

**Tool ID**: `calculator`

**Input**:
```json
{
  "operation": "add|subtract|multiply|divide",
  "a": 10,
  "b": 5
}
```

**Output**:
```json
{
  "result": 15,
  "operation": "add"
}
```

### Text Analyzer

Analyzes text and returns statistics.

**Tool ID**: `text-analyzer`

**Input**:
```json
{
  "text": "Hello world! This is a test."
}
```

**Output**:
```json
{
  "wordCount": 6,
  "characterCount": 28,
  "sentenceCount": 2,
  "averageWordLength": 4.17
}
```

### UUID Generator

Generates UUIDs (version 4).

**Tool ID**: `uuid-generator`

**Input**:
```json
{
  "count": 3
}
```

**Output**:
```json
{
  "uuids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
  ],
  "count": 3
}
```

## Creating Custom Tools

### 1. Create a Tool Descriptor

Create a JSON file in the `/tools/` directory:

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "Description of what the tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "First parameter"
      }
    },
    "required": ["param1"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "string"
      }
    },
    "required": ["result"]
  },
  "metadata": {
    "version": "1.0.0",
    "author": "Your Name",
    "tags": ["category", "tag"]
  }
}
```

### 2. Register the Handler

In `src/index.ts`, add a handler:

```typescript
server.registerTool('my-tool', async (args) => {
  const { param1 } = args;
  // Your tool logic here
  return { result: `Processed: ${param1}` };
});
```

### 3. Reload Tools

Run `/reload` command or restart the server to load new tools.

## Architecture

```
┌─────────────────┐
│   MCP Client    │ (AI Runtime with SDK)
└────────┬────────┘
         │ STDIO/HTTP/WebSocket
         │
┌────────▼────────┐
│   MCP Server    │
├─────────────────┤
│ - Tool Discovery│
│ - Tool Executor │
│ - Auth Manager  │
│ - Audit Logger  │
└────────┬────────┘
         │
┌────────▼────────┐
│   Tools (.json) │
│ - Calculator    │
│ - Text Analyzer │
│ - UUID Gen      │
└─────────────────┘
```

## Security

### Authentication

Configure authentication in `src/index.ts`:

```typescript
const config: ServerConfig = {
  // ...
  auth: {
    type: AuthType.BEARER,
    token: 'your-secret-token'
  }
};
```

Supported auth types:
- `NONE` - No authentication (default)
- `BEARER` - OAuth 2.1 Bearer tokens
- `MTLS` - Mutual TLS certificate pinning
- `KEYPAIR` - Local keypair exchange

### Audit Logging

All tool invocations are logged to `./logs/audit.log` by default:

```json
{
  "timestamp": "2025-11-14T12:00:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "toolId": "calculator",
  "action": "invoke",
  "status": "success",
  "duration": 2
}
```

## Configuration

Edit the configuration in `src/index.ts`:

```typescript
const config: ServerConfig = {
  name: 'Your Server Name',
  version: '1.0.0',
  toolsDirectory: './tools',
  transport: 'stdio',
  auth: { type: AuthType.NONE },
  logging: {
    level: 'info',
    auditLog: true
  },
  security: {
    enableSandbox: false,
    resourceQuota: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxExecutionTime: 30000
    }
  }
};
```

## Testing

```bash
npm test
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Lint code
npm run lint
```

## Protocol Specification

This implementation follows the MCP specification:
- Release Candidate: November 14, 2025
- Final Release: November 25, 2025

### Key Features:
- **File-based tool discovery** reduces token usage by ~98%
- **Async execution** for long-running operations
- **Job handles** for resumable async tasks
- **Comprehensive validation** with JSON Schema 1.1
- **Security-first** design with multiple auth options

## Examples

See the `/examples` directory for:
- Client implementations
- Integration examples
- Advanced usage patterns

## Contributing

This is part of the Vibecast weekly live coding sessions. Check branches for weekly content.

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: [Report issues](https://github.com/ruvnet/vibecast/issues)
- Weekly Sessions: Check branches for live coding sessions

---

Built with ❤️ during Vibecast live coding sessions by rUv 
