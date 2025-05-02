# MCP Client Implementation Examples

This document provides examples of how to implement clients for the Cloudflare MCP server in various programming languages.

## Table of Contents

- [JavaScript/TypeScript Client](#javascripttypescript-client)
- [Python Client](#python-client)
- [Curl Examples](#curl-examples)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)

## JavaScript/TypeScript Client

### Basic Client

```typescript
// mcp-client.ts
export class McpClient {
  private baseUrl: string;
  private requestId: number = 1;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Execute a tool on the MCP server
   */
  async useTool(toolName: string, parameters: Record<string, any> = {}): Promise<any> {
    const response = await this.sendRequest('mcp.use_tool', {
      tool: toolName,
      parameters
    });
    return response.result;
  }

  /**
   * Access a resource on the MCP server
   */
  async accessResource(uri: string): Promise<any> {
    const response = await this.sendRequest('mcp.access_resource', {
      uri
    });
    return response.result.content;
  }

  /**
   * List available tools on the MCP server
   */
  async listTools(): Promise<any> {
    const response = await this.sendRequest('mcp.list_tools', {});
    return response.result.tools;
  }

  /**
   * List available resources on the MCP server
   */
  async listResources(): Promise<any> {
    const response = await this.sendRequest('mcp.list_resources', {});
    return response.result.resources;
  }

  /**
   * Get schema for a specific tool
   */
  async getToolSchema(toolName: string): Promise<any> {
    const response = await this.sendRequest('mcp.get_tool_schema', {
      tool: toolName
    });
    return response.result;
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    const response = await this.sendRequest('mcp.get_server_info', {});
    return response.result;
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    const requestId = this.requestId++;
    
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP error: ${data.error.message} (code: ${data.error.code})`);
    }

    return data;
  }
}
```

### Usage Example

```typescript
// example-usage.ts
import { McpClient } from './mcp-client';

async function main() {
  // Create a new MCP client
  const client = new McpClient('https://your-mcp-server.workers.dev');

  try {
    // Get server information
    const serverInfo = await client.getServerInfo();
    console.log('Server info:', serverInfo);

    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:', tools);

    // Execute a tool
    const result = await client.useTool('summarize_text', {
      text: 'The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources. It enables models to perform actions beyond their training data, such as accessing real-time information, executing code, or interacting with external systems.',
      max_sentences: 1
    });
    console.log('Summarization result:', result);

    // Access a resource
    const documentation = await client.accessResource('documentation/api');
    console.log('API documentation:', documentation);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### React Hook Example

```typescript
// useMcp.ts
import { useState, useEffect } from 'react';
import { McpClient } from './mcp-client';

export function useMcp(baseUrl: string) {
  const [client] = useState(() => new McpClient(baseUrl));
  const [tools, setTools] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [toolsData, resourcesData] = await Promise.all([
          client.listTools(),
          client.listResources()
        ]);
        setTools(toolsData);
        setResources(resourcesData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [client]);

  return {
    client,
    tools,
    resources,
    loading,
    error,
    useTool: client.useTool.bind(client),
    accessResource: client.accessResource.bind(client),
    getToolSchema: client.getToolSchema.bind(client),
    getServerInfo: client.getServerInfo.bind(client)
  };
}
```

## Python Client

### Basic Client

```python
# mcp_client.py
import json
import requests
from typing import Dict, Any, List, Optional, Union

class McpClient:
    def __init__(self, base_url: str):
        """
        Initialize the MCP client with the server base URL
        
        Args:
            base_url: The base URL of the MCP server
        """
        self.base_url = base_url
        self.request_id = 1
    
    def use_tool(self, tool_name: str, parameters: Optional[Dict[str, Any]] = None) -> Any:
        """
        Execute a tool on the MCP server
        
        Args:
            tool_name: The name of the tool to execute
            parameters: Parameters for the tool
            
        Returns:
            The result of the tool execution
        """
        if parameters is None:
            parameters = {}
        
        response = self._send_request('mcp.use_tool', {
            'tool': tool_name,
            'parameters': parameters
        })
        
        return response['result']
    
    def access_resource(self, uri: str) -> Any:
        """
        Access a resource on the MCP server
        
        Args:
            uri: The URI of the resource to access
            
        Returns:
            The content of the resource
        """
        response = self._send_request('mcp.access_resource', {
            'uri': uri
        })
        
        return response['result']['content']
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """
        List available tools on the MCP server
        
        Returns:
            A list of available tools
        """
        response = self._send_request('mcp.list_tools', {})
        
        return response['result']['tools']
    
    def list_resources(self) -> List[Dict[str, Any]]:
        """
        List available resources on the MCP server
        
        Returns:
            A list of available resources
        """
        response = self._send_request('mcp.list_resources', {})
        
        return response['result']['resources']
    
    def get_tool_schema(self, tool_name: str) -> Dict[str, Any]:
        """
        Get schema for a specific tool
        
        Args:
            tool_name: The name of the tool
            
        Returns:
            The schema for the tool
        """
        response = self._send_request('mcp.get_tool_schema', {
            'tool': tool_name
        })
        
        return response['result']
    
    def get_server_info(self) -> Dict[str, Any]:
        """
        Get server information
        
        Returns:
            Information about the MCP server
        """
        response = self._send_request('mcp.get_server_info', {})
        
        return response['result']
    
    def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a JSON-RPC request to the MCP server
        
        Args:
            method: The JSON-RPC method to call
            params: The parameters for the method
            
        Returns:
            The JSON-RPC response
            
        Raises:
            Exception: If the request fails or returns an error
        """
        request_id = self.request_id
        self.request_id += 1
        
        payload = {
            'jsonrpc': '2.0',
            'id': request_id,
            'method': method,
            'params': params
        }
        
        response = requests.post(
            f"{self.base_url}/mcp",
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )
        
        if not response.ok:
            raise Exception(f"HTTP error: {response.status_code} {response.reason}")
        
        data = response.json()
        
        if 'error' in data:
            raise Exception(f"MCP error: {data['error']['message']} (code: {data['error']['code']})")
        
        return data
```

### Usage Example

```python
# example_usage.py
from mcp_client import McpClient

def main():
    # Create a new MCP client
    client = McpClient('https://your-mcp-server.workers.dev')
    
    try:
        # Get server information
        server_info = client.get_server_info()
        print('Server info:', server_info)
        
        # List available tools
        tools = client.list_tools()
        print('Available tools:', tools)
        
        # Execute a tool
        result = client.use_tool('summarize_text', {
            'text': 'The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources. It enables models to perform actions beyond their training data, such as accessing real-time information, executing code, or interacting with external systems.',
            'max_sentences': 1
        })
        print('Summarization result:', result)
        
        # Access a resource
        documentation = client.access_resource('documentation/api')
        print('API documentation:', documentation)
    except Exception as e:
        print('Error:', e)

if __name__ == '__main__':
    main()
```

## Curl Examples

### List Tools

```bash
curl -X POST https://your-mcp-server.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "mcp.list_tools",
    "params": {}
  }'
```

### Execute a Tool

```bash
curl -X POST https://your-mcp-server.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "mcp.use_tool",
    "params": {
      "tool": "summarize_text",
      "parameters": {
        "text": "The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources. It enables models to perform actions beyond their training data, such as accessing real-time information, executing code, or interacting with external systems.",
        "max_sentences": 1
      }
    }
  }'
```

### Access a Resource

```bash
curl -X POST https://your-mcp-server.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "mcp.access_resource",
    "params": {
      "uri": "documentation/api"
    }
  }'
```

### Get Tool Schema

```bash
curl -X POST https://your-mcp-server.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "mcp.get_tool_schema",
    "params": {
      "tool": "summarize_text"
    }
  }'
```

### Get Server Information

```bash
curl -X POST https://your-mcp-server.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "mcp.get_server_info",
    "params": {}
  }'
```

## Best Practices

### Error Handling

Always implement proper error handling in your client:

1. Handle HTTP errors (non-200 responses)
2. Handle JSON-RPC errors (error field in the response)
3. Handle network errors (connection issues)
4. Implement retry logic for transient errors

### Authentication

If your MCP server requires authentication:

1. Implement a secure method for storing and retrieving credentials
2. Add authentication headers to your requests
3. Handle authentication errors properly

### Caching

Consider implementing caching for frequently accessed resources:

1. Cache tool schemas and server information
2. Implement cache invalidation strategies
3. Use conditional requests (If-Modified-Since, ETag) when appropriate

### Batching

Use JSON-RPC batch requests to reduce network overhead when making multiple requests:

```typescript
// TypeScript example of batch requests
async function sendBatchRequest(requests: Array<{method: string, params: any}>): Promise<any[]> {
  const batch = requests.map((req, index) => ({
    jsonrpc: '2.0',
    id: index + 1,
    method: req.method,
    params: req.params
  }));
  
  const response = await fetch(`${this.baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batch)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}
```

## Error Handling

### Common Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist / is not available |
| -32602 | Invalid params | Invalid method parameter(s) |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 to -32099 | Server error | Reserved for implementation-defined server errors |

### Handling Specific Errors

```typescript
// TypeScript example of error handling
try {
  const result = await client.useTool('example_tool', { param: 'value' });
  console.log('Success:', result);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Method not found')) {
      console.error('Tool not available:', error.message);
    } else if (error.message.includes('Invalid params')) {
      console.error('Invalid parameters:', error.message);
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
}