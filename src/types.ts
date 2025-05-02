/**
 * Type definitions for the MCP implementation
 */

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Success Response
 */
export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result: any;
}

/**
 * JSON-RPC 2.0 Error Response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * JSON-RPC 2.0 Response (Success or Error)
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, McpParameterDefinition>;
  handler: (params: Record<string, any>) => Promise<any>;
}

/**
 * MCP Parameter definition
 */
export interface McpParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * MCP Resource definition
 */
export interface McpResource {
  uri: string;
  description: string;
  handler: () => Promise<any>;
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  name: string;
  version: string;
  description: string;
  tools: Record<string, McpTool>;
  resources: Record<string, McpResource>;
}

/**
 * MCP Error response
 */
export interface McpErrorResponse {
  error: string;
  code?: number;
  details?: any;
}

/**
 * MCP Tool response
 */
export interface McpToolResponse {
  result: any;
}

/**
 * MCP Resource response
 */
export interface McpResourceResponse {
  content: any;
}

/**
 * MCP Tool Request
 */
export interface McpToolRequest {
  type: 'tool';
  tool: string;
  parameters: Record<string, any>;
}

/**
 * MCP Resource Request
 */
export interface McpResourceRequest {
  type: 'resource';
  uri: string;
}

/**
 * MCP Request (Tool or Resource)
 */
export type McpRequest = McpToolRequest | McpResourceRequest;

/**
 * JSON-RPC Error Codes
 */
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR_START = -32000,
  SERVER_ERROR_END = -32099
}