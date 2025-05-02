import { handleMcpRequest } from '../../mcp';
import * as utils from '../../utils';
import { JsonRpcErrorCode } from '../../types';

// Mock the tools and resources
jest.mock('../../tools', () => ({
  tools: {
    test_tool: {
      name: 'test_tool',
      description: 'Test tool for unit tests',
      parameters: {
        param1: {
          type: 'string',
          description: 'Test parameter',
          required: true,
        },
      },
      handler: jest.fn().mockResolvedValue({ result: 'success' }),
    },
  },
}));

jest.mock('../../resources', () => ({
  resources: {
    test_resource: {
      uri: 'test_resource',
      description: 'Test resource for unit tests',
      handler: jest.fn().mockResolvedValue({ content: 'test content' }),
    },
  },
}));

describe('MCP Request Handler', () => {
  // Mock environment variables
  const mockEnv = {
    MCP_SERVER_NAME: 'test-server',
    MCP_VERSION: '1.0.0',
    MCP_ENV: 'test',
  };

  // Spy on utility functions
  let parseJsonBodySpy: jest.SpyInstance;
  let jsonRpcSuccessSpy: jest.SpyInstance;
  let jsonRpcErrorSpy: jest.SpyInstance;
  let validateJsonRpcRequestSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup spies
    parseJsonBodySpy = jest.spyOn(utils, 'parseJsonBody');
    jsonRpcSuccessSpy = jest.spyOn(utils, 'jsonRpcSuccess');
    jsonRpcErrorSpy = jest.spyOn(utils, 'jsonRpcError');
    validateJsonRpcRequestSpy = jest.spyOn(utils, 'validateJsonRpcRequest');
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should handle a valid tool request', async () => {
    // Mock request body
    const requestBody = {
      jsonrpc: '2.0',
      id: '1',
      method: 'mcp.use_tool',
      params: {
        tool: 'test_tool',
        parameters: {
          param1: 'test value',
        },
      },
    };

    // Mock parseJsonBody to return our test request
    parseJsonBodySpy.mockResolvedValue(requestBody);
    
    // Mock validateJsonRpcRequest to return null (valid)
    validateJsonRpcRequestSpy.mockReturnValue(null);

    // Create a mock request
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200);
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(validateJsonRpcRequestSpy).toHaveBeenCalledWith(requestBody);
    expect(jsonRpcSuccessSpy).toHaveBeenCalled();
  });

  it('should handle a valid resource request', async () => {
    // Mock request body
    const requestBody = {
      jsonrpc: '2.0',
      id: '2',
      method: 'mcp.access_resource',
      params: {
        uri: 'test_resource',
      },
    };

    // Mock parseJsonBody to return our test request
    parseJsonBodySpy.mockResolvedValue(requestBody);
    
    // Mock validateJsonRpcRequest to return null (valid)
    validateJsonRpcRequestSpy.mockReturnValue(null);

    // Create a mock request
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200);
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(validateJsonRpcRequestSpy).toHaveBeenCalledWith(requestBody);
    expect(jsonRpcSuccessSpy).toHaveBeenCalled();
  });

  it('should handle an invalid request', async () => {
    // Mock request body
    const requestBody = {
      jsonrpc: '1.0', // Invalid version
      id: '3',
      method: 'mcp.use_tool',
    };

    // Mock parseJsonBody to return our test request
    parseJsonBodySpy.mockResolvedValue(requestBody);
    
    // Mock validateJsonRpcRequest to return an error
    validateJsonRpcRequestSpy.mockReturnValue(utils.jsonRpcError(
      '3',
      JsonRpcErrorCode.INVALID_REQUEST,
      "Invalid request: jsonrpc must be '2.0'"
    ));

    // Create a mock request
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200); // JSON-RPC always returns 200 with error in body
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(validateJsonRpcRequestSpy).toHaveBeenCalledWith(requestBody);
    expect(jsonRpcErrorSpy).toHaveBeenCalled();
  });

  it('should handle a method not found error', async () => {
    // Mock request body
    const requestBody = {
      jsonrpc: '2.0',
      id: '4',
      method: 'mcp.invalid_method',
    };

    // Mock parseJsonBody to return our test request
    parseJsonBodySpy.mockResolvedValue(requestBody);
    
    // Mock validateJsonRpcRequest to return null (valid)
    validateJsonRpcRequestSpy.mockReturnValue(null);

    // Create a mock request
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200); // JSON-RPC always returns 200 with error in body
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(validateJsonRpcRequestSpy).toHaveBeenCalledWith(requestBody);
    expect(jsonRpcErrorSpy).toHaveBeenCalledWith(
      '4',
      JsonRpcErrorCode.METHOD_NOT_FOUND,
      `Method not found: mcp.invalid_method`
    );
  });

  it('should handle a batch request', async () => {
    // Mock batch request body
    const batchRequestBody = [
      {
        jsonrpc: '2.0',
        id: '5',
        method: 'mcp.use_tool',
        params: {
          tool: 'test_tool',
          parameters: {
            param1: 'test value',
          },
        },
      },
      {
        jsonrpc: '2.0',
        id: '6',
        method: 'mcp.access_resource',
        params: {
          uri: 'test_resource',
        },
      },
    ];

    // Mock parseJsonBody to return our test batch request
    parseJsonBodySpy.mockResolvedValue(batchRequestBody);
    
    // Mock validateJsonRpcRequest to return null (valid) for both requests
    validateJsonRpcRequestSpy.mockReturnValue(null);

    // Create a mock request
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchRequestBody),
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200);
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(validateJsonRpcRequestSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle a parsing error', async () => {
    // Mock parseJsonBody to throw an error
    parseJsonBodySpy.mockRejectedValue(new Error('Invalid JSON'));

    // Create a mock request with invalid JSON
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{invalid json}',
    });

    // Call the handler
    const response = await handleMcpRequest(request, mockEnv);
    
    // Verify response
    expect(response.status).toBe(200); // JSON-RPC always returns 200 with error in body
    expect(parseJsonBodySpy).toHaveBeenCalledWith(request);
    expect(jsonRpcErrorSpy).toHaveBeenCalledWith(
      null,
      JsonRpcErrorCode.PARSE_ERROR,
      'Invalid JSON'
    );
  });
});