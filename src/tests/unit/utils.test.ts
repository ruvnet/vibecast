import { 
  handleCors, 
  parseJsonBody, 
  jsonResponse, 
  errorResponse, 
  jsonRpcSuccess, 
  jsonRpcError, 
  validateJsonRpcRequest,
  jsonRpcResponse
} from '../../utils';
import { JsonRpcErrorCode, JsonRpcErrorResponse } from '../../types';

// Mock Request and Response objects
const mockRequest = (body: any, headers: Record<string, string> = {}) => {
  return {
    headers: {
      get: (name: string) => headers[name] || null,
    },
    json: async () => body,
  } as unknown as Request;
};

describe('Utils', () => {
  describe('handleCors', () => {
    it('should handle CORS preflight requests', () => {
      const request = mockRequest({}, {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      });
      
      const response = handleCors(request);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should handle standard OPTIONS requests', () => {
      const request = mockRequest({});
      
      const response = handleCors(request);
      
      expect(response.headers.get('Allow')).toBe('GET, POST, OPTIONS');
    });
  });

  describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const body = { test: 'value' };
      const request = mockRequest(body, { 'content-type': 'application/json' });
      
      const result = await parseJsonBody(request);
      
      expect(result).toEqual(body);
    });

    it('should throw error for non-JSON content type', async () => {
      const request = mockRequest({}, { 'content-type': 'text/plain' });
      
      await expect(parseJsonBody(request)).rejects.toThrow('Content-Type must be application/json');
    });

    it('should throw error for invalid JSON', async () => {
      const request = mockRequest(undefined, { 'content-type': 'application/json' });
      request.json = async () => { throw new Error('Invalid JSON'); };
      
      await expect(parseJsonBody(request)).rejects.toThrow('Invalid JSON in request body');
    });
  });

  describe('jsonResponse', () => {
    it('should create a JSON response with proper headers', () => {
      const data = { test: 'value' };
      
      const response = jsonResponse(data);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should create a JSON response with custom status', () => {
      const data = { test: 'value' };
      
      const response = jsonResponse(data, 201);
      
      expect(response.status).toBe(201);
    });
  });

  describe('errorResponse', () => {
    it('should create an error response', () => {
      const message = 'Error message';
      
      const response = errorResponse(message);
      
      expect(response.status).toBe(400);
    });

    it('should create an error response with custom status', () => {
      const message = 'Error message';
      
      const response = errorResponse(message, 500);
      
      expect(response.status).toBe(500);
    });
  });

  describe('jsonRpcSuccess', () => {
    it('should create a JSON-RPC success response', () => {
      const id = '123';
      const result = { test: 'value' };
      
      const response = jsonRpcSuccess(id, result);
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id,
        result
      });
    });
  });

  describe('jsonRpcError', () => {
    it('should create a JSON-RPC error response', () => {
      const id = '123';
      const code = JsonRpcErrorCode.INVALID_REQUEST;
      const message = 'Error message';
      
      const response = jsonRpcError(id, code, message);
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id,
        error: {
          code,
          message,
        }
      });
    });

    it('should create a JSON-RPC error response with data', () => {
      const id = '123';
      const code = JsonRpcErrorCode.INVALID_REQUEST;
      const message = 'Error message';
      const data = { details: 'error details' };
      
      const response = jsonRpcError(id, code, message, data);
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id,
        error: {
          code,
          message,
          data
        }
      });
    });
  });

  describe('validateJsonRpcRequest', () => {
    it('should return null for valid request', () => {
      const request = {
        jsonrpc: '2.0',
        id: '123',
        method: 'test_method'
      };
      
      const result = validateJsonRpcRequest(request);
      
      expect(result).toBeNull();
    });

    it('should return error for non-object request', () => {
      const request = 'not an object';
      
      const result = validateJsonRpcRequest(request);
      
      // Type assertion to JsonRpcErrorResponse
      expect((result as JsonRpcErrorResponse)?.error).toBeDefined();
      expect((result as JsonRpcErrorResponse)?.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });

    it('should return error for invalid jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        id: '123',
        method: 'test_method'
      };
      
      const result = validateJsonRpcRequest(request);
      
      // Type assertion to JsonRpcErrorResponse
      expect((result as JsonRpcErrorResponse)?.error).toBeDefined();
      expect((result as JsonRpcErrorResponse)?.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });

    it('should return error for missing method', () => {
      const request = {
        jsonrpc: '2.0',
        id: '123'
      };
      
      const result = validateJsonRpcRequest(request);
      
      // Type assertion to JsonRpcErrorResponse
      expect((result as JsonRpcErrorResponse)?.error).toBeDefined();
      expect((result as JsonRpcErrorResponse)?.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });

    it('should return error for invalid id type', () => {
      const request = {
        jsonrpc: '2.0',
        id: {},
        method: 'test_method'
      };
      
      const result = validateJsonRpcRequest(request);
      
      // Type assertion to JsonRpcErrorResponse
      expect((result as JsonRpcErrorResponse)?.error).toBeDefined();
      expect((result as JsonRpcErrorResponse)?.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });
  });

  describe('jsonRpcResponse', () => {
    it('should create a Response from a JSON-RPC response object', () => {
      const rpcResponse = jsonRpcSuccess('123', { test: 'value' });
      
      const response = jsonRpcResponse(rpcResponse);
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});