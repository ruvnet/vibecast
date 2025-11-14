# Architecture Documentation

## Overview

The Vibecast MCP Server is built with a modular architecture that separates concerns and enables extensibility.

## Core Components

### 1. Protocol Types (`src/types/protocol.ts`)

Defines all TypeScript types and Zod schemas for the MCP protocol:
- **ToolDescriptor**: JSON Schema-based tool definitions
- **ToolRequest/Response**: Request/response message formats
- **ServerConfig**: Server configuration options
- **AuthConfig**: Authentication configuration
- **AuditLogEntry**: Audit log structure

### 2. Tool Discovery (`src/core/tool-discovery.ts`)

Responsible for discovering and loading tools from the file system:

```typescript
class ToolDiscovery {
  discoverTools(): Promise<void>
  getTool(toolId: string): ToolDescriptor | undefined
  getAllTools(): ToolDescriptor[]
  searchTools(keyword: string): ToolDescriptor[]
  getToolsByTag(tag: string): ToolDescriptor[]
}
```

**Features:**
- Scans `/tools/` directory for `.json` files
- Validates tool descriptors against JSON Schema
- Provides search and filtering capabilities
- Supports hot-reloading of tools

### 3. Tool Executor (`src/core/tool-executor.ts`)

Handles tool invocation and execution:

```typescript
class ToolExecutor {
  registerHandler(toolId: string, handler: ToolHandler): void
  execute(request: ToolRequest): Promise<ToolResponse>
  executeSync(): Promise<ToolResponse>
  executeAsync(): Promise<ToolResponse>
  getJobResult(jobHandle: string): Promise<any>
}
```

**Features:**
- Input/output validation using JSON Schema
- Synchronous and asynchronous execution modes
- Job handle management for async operations
- Comprehensive error handling

### 4. MCP Server (`src/core/mcp-server.ts`)

Main server class that coordinates all components:

```typescript
class MCPServer {
  initialize(): Promise<void>
  registerTool(toolId: string, handler: ToolHandler): void
  handleRequest(requestData: any, headers?: Record<string, string>): Promise<ToolResponse>
  getTools(): ToolDescriptor[]
  reloadTools(): Promise<void>
}
```

**Responsibilities:**
- Initializes all subsystems
- Coordinates authentication and authorization
- Routes requests to appropriate handlers
- Manages audit logging

### 5. Transport Layer (`src/transport/stdio.ts`)

Handles communication via STDIO:

```typescript
class STDIOTransport {
  start(): void
  handleLine(line: string): Promise<void>
  handleCommand(command: string): Promise<void>
  sendResponse(response: any): void
}
```

**Features:**
- JSON-based request/response protocol
- Special command support (e.g., `/help`, `/tools`)
- Error handling and user feedback
- Graceful shutdown handling

### 6. Security Components

#### Auth Manager (`src/security/auth.ts`)

Handles authentication and authorization:

```typescript
class AuthManager {
  authenticate(headers: Record<string, string>): Promise<AuthResult>
  authenticateBearer(headers: Record<string, string>): AuthResult
  authenticateKeypair(challenge?: string, signature?: string): AuthResult
  authenticateMTLS(headers: Record<string, string>): AuthResult
}
```

**Supported Auth Types:**
- **None**: No authentication required
- **Bearer**: OAuth 2.1 Bearer tokens
- **Keypair**: Challenge-response with public/private keys
- **mTLS**: Mutual TLS certificate authentication

#### Audit Logger (`src/security/audit-log.ts`)

Provides comprehensive audit logging:

```typescript
class AuditLogger {
  log(entry: AuditLogEntry): Promise<void>
  logInvocation(requestId: string, toolId: string, ...): Promise<void>
  logDiscovery(requestId: string, toolId: string, ...): Promise<void>
  logAuthentication(requestId: string, status: ResponseStatus, ...): Promise<void>
  readLogs(limit: number): Promise<AuditLogEntry[]>
}
```

**Features:**
- JSON-formatted log entries
- Timestamp tracking
- User and request tracking
- Searchable audit trail

### 7. Validation (`src/utils/validator.ts`)

JSON Schema validation utilities:

```typescript
function validateInput(data: any, schema: JSONSchema): string | null
function validateOutput(data: any, schema: JSONSchema): string | null
```

**Features:**
- Type validation
- Required field checking
- Nested object validation
- Array validation
- Additional properties enforcement

## Data Flow

### Tool Invocation Flow

```
1. Client sends JSON request via STDIN
   ↓
2. STDIOTransport.handleLine() parses the request
   ↓
3. MCPServer.handleRequest() validates and authenticates
   ↓
4. AuthManager.authenticate() checks credentials
   ↓
5. ToolExecutor.execute() validates input and runs handler
   ↓
6. Tool handler performs the actual work
   ↓
7. ToolExecutor validates output
   ↓
8. AuditLogger.logInvocation() records the execution
   ↓
9. MCPServer returns response
   ↓
10. STDIOTransport.sendResponse() sends JSON to STDOUT
```

### Tool Discovery Flow

```
1. Server starts
   ↓
2. MCPServer.initialize() is called
   ↓
3. ToolDiscovery.discoverTools() scans /tools/ directory
   ↓
4. Each .json file is read and parsed
   ↓
5. ToolDescriptorSchema validates the descriptor
   ↓
6. Valid tools are added to internal registry
   ↓
7. Tools are available for invocation
```

## Extension Points

### Adding New Tools

1. Create a JSON descriptor in `/tools/`
2. Register a handler in `src/index.ts`
3. Implement the handler function

### Adding New Transports

1. Implement a transport class following the pattern in `src/transport/stdio.ts`
2. Handle connection lifecycle
3. Parse requests and send responses
4. Integrate with MCPServer

### Adding New Auth Methods

1. Extend `AuthType` enum in `src/types/protocol.ts`
2. Implement authentication logic in `src/security/auth.ts`
3. Update configuration schema

### Custom Validation

1. Extend validation logic in `src/utils/validator.ts`
2. Add custom validators for specific data types
3. Integrate with tool execution flow

## Security Considerations

### Input Validation

- All tool inputs are validated against JSON Schema
- Type checking prevents injection attacks
- Required fields are enforced
- Additional properties can be rejected

### Authentication

- Multiple auth methods supported
- Token-based authentication for stateless operation
- Certificate-based authentication for high security
- Challenge-response for keypair authentication

### Audit Logging

- All tool invocations are logged
- Authentication attempts are recorded
- Logs include timestamp, user, and action
- Logs are append-only for integrity

### Resource Management

- Configurable resource quotas
- Execution time limits
- Memory limits
- CPU usage controls

## Performance Optimizations

### Token Usage Reduction

- File-based tool discovery reduces context size
- Tools referenced by ID rather than full schema
- ~98% reduction in token usage (150k → 2k tokens)

### Async Execution

- Long-running operations use async mode
- Job handles allow polling for results
- Non-blocking execution
- Concurrent request handling

### Caching

- Tool descriptors cached in memory
- No disk I/O during execution
- Fast lookup by ID

## Testing Strategy

### Unit Tests

- Test individual components in isolation
- Mock dependencies
- Focus on business logic

### Integration Tests

- Test component interactions
- End-to-end request/response flows
- Authentication and authorization

### Load Tests

- Concurrent request handling
- Performance under load
- Resource usage monitoring

## Deployment

### Local Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]
```

## Monitoring

### Metrics to Track

- Request rate
- Response times
- Error rates
- Tool usage patterns
- Authentication failures

### Log Analysis

- Parse audit logs for patterns
- Identify frequently used tools
- Detect anomalous behavior
- Track performance trends

## Future Enhancements

### Planned Features

1. **HTTP/WebSocket Transport**: Remote server access
2. **Tool Marketplace**: Discover and install community tools
3. **Sandboxing**: Docker/VM isolation for code execution
4. **Rate Limiting**: Prevent abuse
5. **Caching**: Response caching for idempotent operations
6. **Metrics Dashboard**: Real-time monitoring UI
7. **Plugin System**: Dynamic tool loading
8. **Multi-tenancy**: Support multiple clients

### API Evolution

- Backward compatibility guarantees
- Version negotiation
- Graceful degradation
- Feature flags for experimental features
