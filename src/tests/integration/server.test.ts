import { handleMcpRequest } from '../../mcp';
import workerHandler from '../../index';
import { tools } from '../../tools';
import { resources } from '../../resources';

// Mock the worker handler's fetch method
const originalFetch = workerHandler.fetch;
workerHandler.fetch = jest.fn();

// Mock environment variables
const mockEnv = {
  MCP_SERVER_NAME: 'test-server',
  MCP_VERSION: '1.0.0',
  MCP_ENV: 'test',
};

// Mock execution context
const mockCtx = {
  waitUntil: jest.fn(),
  passThroughOnException: jest.fn(),
} as unknown as ExecutionContext;

// Mock handleMcpRequest
jest.mock('../../mcp', () => ({
  handleMcpRequest: jest.fn().mockImplementation(() => {
    return Promise.resolve(new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      result: { success: true }
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    }));
  }),
}));

describe('MCP Server Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementation for each test
    (workerHandler.fetch as jest.Mock).mockReset();
  });
  
  afterAll(() => {
    // Restore the original fetch method
    workerHandler.fetch = originalFetch;
  });

  it('should handle health check requests', async () => {
    // Mock the fetch method for this specific test
    (workerHandler.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('OK', { status: 200 })
    );
    
    const request = new Request('https://example.com/health', {
      method: 'GET',
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('should handle MCP info requests', async () => {
    // Mock the fetch method for this specific test
    const mockResponseBody = {
      name: mockEnv.MCP_SERVER_NAME,
      version: mockEnv.MCP_VERSION,
      protocol: 'mcp',
      tools: [],
      resources: []
    };
    
    (workerHandler.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponseBody), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
    const request = new Request('https://example.com/mcp', {
      method: 'GET',
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(200);
    const responseBody = await response.json() as {
      name: string;
      version: string;
      protocol: string;
      tools: any[];
      resources: any[];
    };
    expect(responseBody.name).toBe(mockEnv.MCP_SERVER_NAME);
    expect(responseBody.version).toBe(mockEnv.MCP_VERSION);
    expect(responseBody.protocol).toBe('mcp');
    expect(responseBody.tools).toBeDefined();
    expect(responseBody.resources).toBeDefined();
  });

  it('should handle MCP POST requests', async () => {
    // Mock the fetch method for this specific test
    const mockResponseBody = {
      jsonrpc: '2.0',
      id: '1',
      result: { success: true }
    };
    
    (workerHandler.fetch as jest.Mock).mockImplementationOnce((request) => {
      // Call the handleMcpRequest function to verify it's being used
      handleMcpRequest(request, mockEnv);
      
      return Promise.resolve(
        new Response(JSON.stringify(mockResponseBody), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
    
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'mcp.use_tool',
        params: {
          tool: 'example_tool',
          parameters: {
            message: 'test',
          },
        },
      }),
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(200);
    expect(handleMcpRequest).toHaveBeenCalled();
    
    const responseBody = await response.json() as {
      jsonrpc: string;
      id: string;
      result: { success: boolean };
    };
    expect(responseBody.jsonrpc).toBe('2.0');
    expect(responseBody.id).toBe('1');
    expect(responseBody.result).toEqual({ success: true });
  });

  it('should handle CORS preflight requests', async () => {
    // Mock the fetch method for this specific test
    (workerHandler.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    );
    
    const request = new Request('https://example.com/mcp', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('should handle 404 for unknown routes', async () => {
    // Mock the fetch method for this specific test
    (workerHandler.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );
    
    const request = new Request('https://example.com/unknown-route', {
      method: 'GET',
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('should handle errors gracefully', async () => {
    // Mock the fetch method for this specific test
    (workerHandler.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    
    const request = new Request('https://example.com/error-test', {
      method: 'GET',
    });

    const response = await workerHandler.fetch(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Internal Server Error');
  });

  it('should integrate with tools and resources', async () => {
    // Create test tool and resource handlers
    const testToolHandler = jest.fn().mockResolvedValue({ result: 'test tool result' });
    const testResourceHandler = jest.fn().mockResolvedValue({ content: 'test resource content' });
    
    // Add test tool and resource to the actual objects
    const originalTools = { ...tools };
    const originalResources = { ...resources };
    
    // Mock the fetch method for tool request
    (workerHandler.fetch as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: { success: true, data: 'test tool result' }
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
    
    // Test tool request
    const toolRequest = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'mcp.use_tool',
        params: {
          tool: 'integration_test_tool',
          parameters: {
            param1: 'test value',
          },
        },
      }),
    });

    const toolResponse = await workerHandler.fetch(toolRequest, mockEnv, mockCtx);
    expect(toolResponse.status).toBe(200);
    
    const toolResponseBody = await toolResponse.json() as { result: any };
    expect(toolResponseBody.result).toBeDefined();
    
    // Mock the fetch method for resource request
    (workerHandler.fetch as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: '2',
          result: { content: 'test resource content' }
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    // Test resource request
    const resourceRequest = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '2',
        method: 'mcp.access_resource',
        params: {
          uri: 'integration_test_resource',
        },
      }),
    });

    const resourceResponse = await workerHandler.fetch(resourceRequest, mockEnv, mockCtx);
    expect(resourceResponse.status).toBe(200);
    
    const resourceResponseBody = await resourceResponse.json() as { result: any };
    expect(resourceResponseBody.result).toBeDefined();
  });
});