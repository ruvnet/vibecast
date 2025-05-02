/**
 * End-to-end tests for the MCP client-server interaction
 */

// Mock fetch for testing
global.fetch = jest.fn();

// Helper function to create a mock JSON-RPC response
const createMockJsonRpcResponse = (id: string | number | null, result: any) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id,
      result,
    }),
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  };
};

// Helper function to create a mock JSON-RPC error response
const createMockJsonRpcErrorResponse = (id: string | number | null, code: number, message: string) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
      },
    }),
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  };
};

/**
 * Simple MCP client implementation for testing
 */
class McpClient {
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Execute a tool on the MCP server
   */
  async useTool(toolName: string, parameters: Record<string, any> = {}) {
    const response = await this.sendJsonRpcRequest('mcp.use_tool', {
      tool: toolName,
      parameters,
    });

    return response;
  }

  /**
   * Access a resource on the MCP server
   */
  async accessResource(uri: string) {
    const response = await this.sendJsonRpcRequest('mcp.access_resource', {
      uri,
    });

    return response;
  }

  /**
   * List available tools on the MCP server
   */
  async listTools() {
    const response = await this.sendJsonRpcRequest('mcp.list_tools', {});
    return response;
  }

  /**
   * List available resources on the MCP server
   */
  async listResources() {
    const response = await this.sendJsonRpcRequest('mcp.list_resources', {});
    return response;
  }

  /**
   * Get schema for a specific tool
   */
  async getToolSchema(toolName: string) {
    const response = await this.sendJsonRpcRequest('mcp.get_tool_schema', {
      tool: toolName,
    });

    return response;
  }

  /**
   * Get server information
   */
  async getServerInfo() {
    const response = await this.sendJsonRpcRequest('mcp.get_server_info', {});
    return response;
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async sendJsonRpcRequest(method: string, params: any) {
    const requestId = Math.random().toString(36).substring(2, 9);
    
    const requestBody = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    };

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const jsonResponse = await response.json() as {
      jsonrpc: string;
      id: string | number | null;
      result?: any;
      error?: {
        code: number;
        message: string;
        data?: any;
      };
    };

    if (jsonResponse.error) {
      throw new Error(`JSON-RPC error: ${jsonResponse.error.message} (code: ${jsonResponse.error.code})`);
    }

    return jsonResponse.result;
  }
}

/**
 * Helper class for testing batch requests
 */
class McpBatchClient {
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Send a batch of JSON-RPC requests to the MCP server
   */
  async sendBatch(requests: Array<{method: string, params: any}>) {
    const batch = requests.map(req => ({
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(2, 9),
      method: req.method,
      params: req.params
    }));

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const jsonResponse = await response.json() as Array<{
      jsonrpc: string;
      id: string | number | null;
      result?: any;
      error?: {
        code: number;
        message: string;
        data?: any;
      };
    }>;

    return jsonResponse.map(res => {
      if (res.error) {
        throw new Error(`JSON-RPC error: ${res.error.message} (code: ${res.error.code})`);
      }
      return res.result;
    });
  }
}

describe('MCP Client-Server E2E Tests', () => {
  const serverUrl = 'https://example.com/mcp';
  let client: McpClient;

  beforeEach(() => {
    client = new McpClient(serverUrl);
    jest.clearAllMocks();
  });

  it('should execute a tool successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', { result: 'success' })
    );

    // Execute the tool
    const result = await client.useTool('example_tool', { message: 'test' });

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.use_tool"'),
    });

    // Verify the request parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tool":"example_tool"'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"message":"test"'),
      })
    );

    // Verify the result
    expect(result).toEqual({ result: 'success' });
  });

  it('should access a resource successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', { content: 'resource content' })
    );

    // Access the resource
    const result = await client.accessResource('example_resource');

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.access_resource"'),
    });

    // Verify the request parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"uri":"example_resource"'),
      })
    );

    // Verify the result
    expect(result).toEqual({ content: 'resource content' });
  });

  it('should list tools successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', {
        tools: [
          { id: 'tool1', name: 'Tool 1', description: 'Description 1' },
          { id: 'tool2', name: 'Tool 2', description: 'Description 2' },
        ],
      })
    );

    // List tools
    const result = await client.listTools();

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.list_tools"'),
    });

    // Verify the result
    expect(result).toEqual({
      tools: [
        { id: 'tool1', name: 'Tool 1', description: 'Description 1' },
        { id: 'tool2', name: 'Tool 2', description: 'Description 2' },
      ],
    });
    expect(result.tools.length).toBe(2);
    expect(result.tools[0].id).toBe('tool1');
    expect(result.tools[1].id).toBe('tool2');
  });

  it('should list resources successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', {
        resources: [
          { id: 'resource1', uri: 'resource://1', description: 'Resource 1' },
          { id: 'resource2', uri: 'resource://2', description: 'Resource 2' },
        ],
      })
    );

    // List resources
    const result = await client.listResources();

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.list_resources"'),
    });

    // Verify the result
    expect(result).toEqual({
      resources: [
        { id: 'resource1', uri: 'resource://1', description: 'Resource 1' },
        { id: 'resource2', uri: 'resource://2', description: 'Resource 2' },
      ],
    });
    expect(result.resources.length).toBe(2);
    expect(result.resources[0].id).toBe('resource1');
    expect(result.resources[1].id).toBe('resource2');
  });

  it('should get server info successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', {
        name: 'Test MCP Server',
        version: '1.0.0',
        protocol: 'mcp',
        protocol_version: '0.1.0',
        jsonrpc: '2.0',
        description: 'Test MCP Server for E2E tests',
        methods: [
          'mcp.use_tool',
          'mcp.access_resource',
          'mcp.list_tools',
          'mcp.list_resources',
          'mcp.get_tool_schema',
          'mcp.get_server_info'
        ]
      })
    );

    // Get server info
    const result = await client.getServerInfo();

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.get_server_info"'),
    });

    // Verify the result
    expect(result.name).toBe('Test MCP Server');
    expect(result.version).toBe('1.0.0');
    expect(result.protocol).toBe('mcp');
    expect(result.protocol_version).toBe('0.1.0');
    expect(result.methods).toContain('mcp.use_tool');
    expect(result.methods).toContain('mcp.access_resource');
    expect(result.methods.length).toBe(6);
  });

  it('should get tool schema successfully', async () => {
    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', {
        name: 'Example Tool',
        description: 'An example tool for testing',
        parameters: {
          message: {
            type: 'string',
            description: 'A message to echo back',
            required: true,
          },
          uppercase: {
            type: 'boolean',
            description: 'Whether to convert the message to uppercase',
            required: false,
            default: false,
          },
        },
      })
    );

    // Get tool schema
    const result = await client.getToolSchema('example_tool');

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.get_tool_schema"'),
    });

    // Verify the request parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tool":"example_tool"'),
      })
    );

    // Verify the result
    expect(result.name).toBe('Example Tool');
    expect(result.description).toBe('An example tool for testing');
    expect(result.parameters.message.type).toBe('string');
    expect(result.parameters.message.required).toBe(true);
    expect(result.parameters.uppercase.required).toBe(false);
    expect(result.parameters.uppercase.default).toBe(false);
  });

  it('should handle JSON-RPC errors', async () => {
    // Mock the fetch response with an error
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcErrorResponse('1', -32601, 'Method not found')
    );

    // Attempt to execute a tool and expect an error
    await expect(client.useTool('nonexistent_tool')).rejects.toThrow(
      'JSON-RPC error: Method not found (code: -32601)'
    );
  });

  it('should handle invalid params error', async () => {
    // Mock the fetch response with an invalid params error
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcErrorResponse('1', -32602, 'Invalid params: tool name is required')
    );

    // Attempt to execute a tool with invalid params
    await expect(client.useTool('')).rejects.toThrow(
      'JSON-RPC error: Invalid params: tool name is required (code: -32602)'
    );
  });

  it('should handle HTTP errors', async () => {
    // Mock the fetch response with an HTTP error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // Attempt to execute a tool and expect an error
    await expect(client.useTool('example_tool')).rejects.toThrow(
      'HTTP error: 404'
    );
  });

  it('should handle network errors', async () => {
    // Mock the fetch to throw a network error
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    // Attempt to execute a tool and expect an error
    await expect(client.useTool('example_tool')).rejects.toThrow(
      'Network error'
    );
  });

  it('should execute a complete workflow', async () => {
    // Mock the fetch responses for a complete workflow
    
    // 1. Get server info
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('1', {
        name: 'Test MCP Server',
        version: '1.0.0',
        protocol: 'mcp',
        protocol_version: '0.1.0',
        jsonrpc: '2.0',
        description: 'Test MCP Server for E2E tests',
        methods: [
          'mcp.use_tool',
          'mcp.access_resource',
          'mcp.list_tools',
          'mcp.list_resources',
          'mcp.get_tool_schema',
          'mcp.get_server_info'
        ]
      })
    );
    
    // 2. List tools
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('2', {
        tools: [
          { id: 'example_tool', name: 'Example Tool', description: 'An example tool' },
          { id: 'data_tool', name: 'Data Tool', description: 'A data processing tool' },
        ],
      })
    );

    // 3. List resources
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('3', {
        resources: [
          { id: 'example_resource', uri: 'resource://example', description: 'An example resource' },
        ],
      })
    );

    // 4. Get tool schema
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('4', {
        name: 'Example Tool',
        description: 'An example tool',
        parameters: {
          message: {
            type: 'string',
            description: 'A message to echo back',
            required: true,
          },
          uppercase: {
            type: 'boolean',
            description: 'Whether to convert the message to uppercase',
            required: false,
            default: false,
          },
        },
      })
    );

    // 5. Execute tool
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('5', {
        message: 'HELLO WORLD',
        timestamp: '2023-05-18T12:00:00Z',
      })
    );

    // 6. Access resource
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createMockJsonRpcResponse('6', {
        content: 'Example resource content',
      })
    );

    // Execute the workflow
    // 1. Get server info
    const serverInfo = await client.getServerInfo();
    expect(serverInfo.name).toBe('Test MCP Server');
    expect(serverInfo.methods).toContain('mcp.use_tool');
    
    // 2. List tools
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(2);
    expect(tools.tools[0].id).toBe('example_tool');

    // 3. List resources
    const resources = await client.listResources();
    expect(resources.resources.length).toBe(1);
    expect(resources.resources[0].id).toBe('example_resource');

    // 4. Get tool schema
    const toolSchema = await client.getToolSchema('example_tool');
    expect(toolSchema.name).toBe('Example Tool');
    expect(toolSchema.parameters.message.required).toBe(true);

    // 5. Execute tool
    const toolResult = await client.useTool('example_tool', {
      message: 'Hello World',
      uppercase: true,
    });
    expect(toolResult.message).toBe('HELLO WORLD');
    expect(toolResult.timestamp).toBeDefined();

    // 6. Access resource
    const resourceResult = await client.accessResource('resource://example');
    expect(resourceResult.content).toBe('Example resource content');

    // Verify all fetch calls were made
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it('should handle batch requests successfully', async () => {
    // Create a batch client
    const batchClient = new McpBatchClient(serverUrl);

    // Mock the fetch response for a batch request
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          jsonrpc: '2.0',
          id: '1',
          result: {
            tools: [
              { id: 'tool1', name: 'Tool 1', description: 'Description 1' },
              { id: 'tool2', name: 'Tool 2', description: 'Description 2' },
            ],
          },
        },
        {
          jsonrpc: '2.0',
          id: '2',
          result: {
            name: 'Test MCP Server',
            version: '1.0.0',
            protocol: 'mcp',
            protocol_version: '0.1.0',
          },
        },
        {
          jsonrpc: '2.0',
          id: '3',
          result: {
            content: 'Example resource content',
          },
        },
      ],
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });

    // Send a batch request
    const results = await batchClient.sendBatch([
      { method: 'mcp.list_tools', params: {} },
      { method: 'mcp.get_server_info', params: {} },
      { method: 'mcp.access_resource', params: { uri: 'example_resource' } },
    ]);

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.list_tools"'),
    });

    // Verify the request contains all methods
    const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
    expect(requestBody).toContain('"method":"mcp.list_tools"');
    expect(requestBody).toContain('"method":"mcp.get_server_info"');
    expect(requestBody).toContain('"method":"mcp.access_resource"');
    expect(requestBody).toContain('"uri":"example_resource"');

    // Verify the results
    expect(results.length).toBe(3);
    expect(results[0].tools.length).toBe(2);
    expect(results[0].tools[0].id).toBe('tool1');
    expect(results[1].name).toBe('Test MCP Server');
    expect(results[1].version).toBe('1.0.0');
    expect(results[2].content).toBe('Example resource content');
  });

  it('should handle batch request with errors', async () => {
    // Create a batch client
    const batchClient = new McpBatchClient(serverUrl);

    // Mock the fetch response for a batch request with an error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          jsonrpc: '2.0',
          id: '1',
          result: {
            tools: [
              { id: 'tool1', name: 'Tool 1', description: 'Description 1' },
            ],
          },
        },
        {
          jsonrpc: '2.0',
          id: '2',
          error: {
            code: -32601,
            message: 'Method not found',
          },
        },
      ],
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });

    // Send a batch request and expect an error
    await expect(
      batchClient.sendBatch([
        { method: 'mcp.list_tools', params: {} },
        { method: 'invalid_method', params: {} },
      ])
    ).rejects.toThrow('JSON-RPC error: Method not found (code: -32601)');

    // Verify the request
    expect(global.fetch).toHaveBeenCalledWith(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"method":"mcp.list_tools"'),
    });

    // Verify the request contains all methods
    const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
    expect(requestBody).toContain('"method":"mcp.list_tools"');
    expect(requestBody).toContain('"method":"invalid_method"');
  });
});