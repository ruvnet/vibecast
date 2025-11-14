/**
 * MCP Client Example
 * Demonstrates how to interact with the MCP server programmatically
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

interface ToolRequest {
  requestId: string;
  toolId: string;
  arguments: Record<string, any>;
  executionMode?: 'sync' | 'async';
}

class MCPClient {
  private serverProcess: any;

  /**
   * Start the MCP server
   */
  start() {
    this.serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.serverProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        this.handleResponse(line);
      }
    });
  }

  /**
   * Send a request to the server
   */
  async sendRequest(request: ToolRequest): Promise<void> {
    const json = JSON.stringify(request) + '\n';
    this.serverProcess.stdin.write(json);
  }

  /**
   * Handle response from server
   */
  private handleResponse(line: string) {
    try {
      const response = JSON.parse(line);
      console.log('Received:', JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('Raw output:', line);
    }
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

// Example usage
async function main() {
  const client = new MCPClient();
  client.start();

  // Wait for server to initialize
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example 1: Calculator
  console.log('\n=== Example 1: Calculator ===');
  await client.sendRequest({
    requestId: uuidv4(),
    toolId: 'calculator',
    arguments: {
      operation: 'add',
      a: 10,
      b: 5,
    },
    executionMode: 'sync',
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Example 2: Text Analyzer
  console.log('\n=== Example 2: Text Analyzer ===');
  await client.sendRequest({
    requestId: uuidv4(),
    toolId: 'text-analyzer',
    arguments: {
      text: 'Hello world! This is an example text for analysis.',
    },
    executionMode: 'sync',
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Example 3: UUID Generator
  console.log('\n=== Example 3: UUID Generator ===');
  await client.sendRequest({
    requestId: uuidv4(),
    toolId: 'uuid-generator',
    arguments: {
      count: 5,
    },
    executionMode: 'sync',
  });

  // Wait for responses then cleanup
  setTimeout(() => {
    client.stop();
    process.exit(0);
  }, 2000);
}

main().catch(console.error);
