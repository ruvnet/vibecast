/**
 * Utility functions for the MCP server
 */
import { JsonRpcRequest, JsonRpcResponse, JsonRpcErrorCode } from './types';

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: Request): Response {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  const headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS pre-flight request
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  } else {
    // Handle standard OPTIONS request
    return new Response(null, {
      headers: {
        Allow: 'GET, POST, OPTIONS',
      },
    });
  }
}

/**
 * Parse and validate JSON from a request
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }

  try {
    return await request.json() as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Create a JSON response with proper headers
 */
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Create a JSON-RPC 2.0 success response
 */
export function jsonRpcSuccess(id: string | number | null, result: any): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

/**
 * Create a JSON-RPC 2.0 error response
 */
export function jsonRpcError(
  id: string | number | null, 
  code: number, 
  message: string, 
  data?: any
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data
    }
  };
}

/**
 * Validate a JSON-RPC 2.0 request
 * Returns null if valid, or an error response if invalid
 */
export function validateJsonRpcRequest(request: any): JsonRpcResponse | null {
  // Check if it's an object
  if (!request || typeof request !== 'object') {
    return jsonRpcError(
      null,
      JsonRpcErrorCode.INVALID_REQUEST,
      "Invalid request: Request must be an object"
    );
  }

  // Check jsonrpc version
  if (request.jsonrpc !== "2.0") {
    return jsonRpcError(
      request.id || null,
      JsonRpcErrorCode.INVALID_REQUEST,
      "Invalid request: jsonrpc must be '2.0'"
    );
  }

  // Check method
  if (typeof request.method !== 'string') {
    return jsonRpcError(
      request.id || null,
      JsonRpcErrorCode.INVALID_REQUEST,
      "Invalid request: method must be a string"
    );
  }

  // Check id (can be string, number, null, or undefined for notifications)
  if (
    request.id !== null && 
    request.id !== undefined && 
    typeof request.id !== 'string' && 
    typeof request.id !== 'number'
  ) {
    return jsonRpcError(
      null,
      JsonRpcErrorCode.INVALID_REQUEST,
      "Invalid request: id must be a string, number, or null"
    );
  }

  // Request is valid
  return null;
}

/**
 * Create a JSON-RPC 2.0 response
 */
export function jsonRpcResponse(response: JsonRpcResponse): Response {
  return jsonResponse(response);
}