/**
 * MCP server implementation with JSON-RPC 2.0 compatibility
 */
import { 
  parseJsonBody, 
  jsonRpcSuccess, 
  jsonRpcError, 
  validateJsonRpcRequest,
  jsonRpcResponse
} from './utils';
import { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  JsonRpcErrorCode,
  McpToolRequest,
  McpResourceRequest
} from './types';
import { tools } from './tools';
import { resources } from './resources';

/**
 * Handle MCP requests using JSON-RPC 2.0 protocol
 */
export async function handleMcpRequest(request: Request, env: any): Promise<Response> {
  try {
    // Parse the request body
    const body = await parseJsonBody<any>(request);
    
    // Handle batch requests
    if (Array.isArray(body)) {
      return handleBatchRequest(body, env);
    }
    
    // Handle single request
    const response = await processSingleRequest(body, env);
    return jsonRpcResponse(response);
  } catch (error) {
    // Handle parsing errors
    console.error('Error handling MCP request:', error);
    const response = jsonRpcError(
      null,
      JsonRpcErrorCode.PARSE_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return jsonRpcResponse(response);
  }
}

/**
 * Process a single JSON-RPC request
 */
async function processSingleRequest(body: any, env: any): Promise<JsonRpcResponse> {
  // Validate the request format
  const validationError = validateJsonRpcRequest(body);
  if (validationError) {
    return validationError;
  }
  
  const rpcRequest = body as JsonRpcRequest;
  
  // Handle method
  try {
    switch (rpcRequest.method) {
      case 'mcp.use_tool':
        return await handleToolRequest(rpcRequest, env);
      case 'mcp.access_resource':
        return await handleResourceRequest(rpcRequest, env);
      case 'mcp.list_tools':
        return await handleListToolsRequest(rpcRequest);
      case 'mcp.list_resources':
        return await handleListResourcesRequest(rpcRequest);
      case 'mcp.get_tool_schema':
        return await handleGetToolSchemaRequest(rpcRequest);
      case 'mcp.get_server_info':
        return await handleGetServerInfoRequest(rpcRequest, env);
      default:
        return jsonRpcError(
          rpcRequest.id,
          JsonRpcErrorCode.METHOD_NOT_FOUND,
          `Method not found: ${rpcRequest.method}`
        );
    }
  } catch (error) {
    console.error(`Error processing request:`, error);
    return jsonRpcError(
      rpcRequest.id,
      JsonRpcErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle batch JSON-RPC requests
 */
async function handleBatchRequest(batch: any[], env: any): Promise<Response> {
  // Check if batch is empty
  if (batch.length === 0) {
    const response = jsonRpcError(
      null,
      JsonRpcErrorCode.INVALID_REQUEST,
      'Invalid request: Batch array cannot be empty'
    );
    return jsonRpcResponse(response);
  }
  
  // Process each request in the batch
  const responses = await Promise.all(
    batch.map(request => processSingleRequest(request, env))
  );
  
  // For batch requests, we need to return the array directly
  return new Response(JSON.stringify(responses), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Handle MCP tool requests
 */
async function handleToolRequest(request: JsonRpcRequest, env: any): Promise<JsonRpcResponse> {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object') {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.INVALID_PARAMS,
      'Invalid params: Expected object with tool and parameters'
    );
  }
  
  const { tool: toolName, parameters } = params as McpToolRequest;
  
  if (!toolName) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.INVALID_PARAMS,
      'Invalid params: tool name is required'
    );
  }
  
  // Check if the requested tool exists
  const tool = tools[toolName];
  if (!tool) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.METHOD_NOT_FOUND,
      `Tool not found: ${toolName}`
    );
  }
  
  try {
    // Execute the tool handler
    const result = await tool.handler(parameters || {});
    return jsonRpcSuccess(request.id, result);
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.SERVER_ERROR_START,
      `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle MCP resource requests
 */
async function handleResourceRequest(request: JsonRpcRequest, env: any): Promise<JsonRpcResponse> {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object') {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.INVALID_PARAMS,
      'Invalid params: Expected object with uri'
    );
  }
  
  const { uri } = params as McpResourceRequest;
  
  if (!uri) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.INVALID_PARAMS,
      'Invalid params: uri is required'
    );
  }
  
  // Check if the requested resource exists
  const resource = resources[uri];
  if (!resource) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.METHOD_NOT_FOUND,
      `Resource not found: ${uri}`
    );
  }
  
  try {
    // Execute the resource handler
    const content = await resource.handler();
    return jsonRpcSuccess(request.id, { content });
  } catch (error) {
    console.error(`Error accessing resource ${uri}:`, error);
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.SERVER_ERROR_START,
      `Error accessing resource: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle list tools request
 */
async function handleListToolsRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const toolList = Object.entries(tools).map(([id, tool]) => ({
    id,
    name: tool.name,
    description: tool.description
  }));
  
  return jsonRpcSuccess(request.id, { tools: toolList });
}

/**
 * Handle list resources request
 */
async function handleListResourcesRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const resourceList = Object.entries(resources).map(([id, resource]) => ({
    id,
    uri: resource.uri,
    description: resource.description
  }));
  
  return jsonRpcSuccess(request.id, { resources: resourceList });
}

/**
 * Handle get tool schema request
 */
async function handleGetToolSchemaRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const params = request.params;
  
  // Validate params
  if (!params || typeof params !== 'object' || !params.tool) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.INVALID_PARAMS,
      'Invalid params: Expected object with tool name'
    );
  }
  
  const toolName = params.tool;
  
  // Check if the requested tool exists
  const tool = tools[toolName];
  if (!tool) {
    return jsonRpcError(
      request.id,
      JsonRpcErrorCode.METHOD_NOT_FOUND,
      `Tool not found: ${toolName}`
    );
  }
  
  // Return the tool schema
  return jsonRpcSuccess(request.id, {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  });
}

/**
 * Handle get server info request
 */
async function handleGetServerInfoRequest(request: JsonRpcRequest, env: any): Promise<JsonRpcResponse> {
  return jsonRpcSuccess(request.id, {
    name: env.MCP_SERVER_NAME,
    version: env.MCP_VERSION,
    protocol: 'mcp',
    protocol_version: '0.1.0',
    jsonrpc: '2.0',
    description: 'Model Context Protocol server implemented with Cloudflare Workers',
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