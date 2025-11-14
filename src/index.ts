#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * Model Context Protocol (MCP) Server Implementation
 */

import { v4 as uuidv4 } from 'uuid';
import { MCPServer } from './core/mcp-server.js';
import { STDIOTransport } from './transport/stdio.js';
import { ServerConfig, AuthType } from './types/protocol.js';

// Server configuration
const config: ServerConfig = {
  name: 'Vibecast MCP Server',
  version: '1.0.0',
  description: 'Model Context Protocol Server for Vibecast - Supporting tool discovery and invocation',
  toolsDirectory: './tools',
  transport: 'stdio',
  auth: {
    type: AuthType.NONE, // Set to BEARER, MTLS, or KEYPAIR for authentication
  },
  logging: {
    level: 'info',
    auditLog: true,
  },
  security: {
    enableSandbox: false,
    resourceQuota: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxExecutionTime: 30000,
    },
  },
};

// Create server instance
const server = new MCPServer(config);

// Register tool handlers
registerToolHandlers(server);

// Initialize and start server
async function main() {
  try {
    // Initialize server
    await server.initialize();

    // Start STDIO transport
    const transport = new STDIOTransport(server);
    transport.start();
  } catch (error) {
    console.error('[MCP Server] Failed to start:', error);
    process.exit(1);
  }
}

/**
 * Register handlers for all tools
 */
function registerToolHandlers(server: MCPServer) {
  // Calculator tool
  server.registerTool('calculator', async (args) => {
    const { operation, a, b } = args;
    let result: number;

    switch (operation.toLowerCase()) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Division by zero');
        }
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { result, operation };
  });

  // Text analyzer tool
  server.registerTool('text-analyzer', async (args) => {
    const { text } = args;

    const words = text.trim().split(/\s+/).filter((w: string) => w.length > 0);
    const wordCount = words.length;
    const characterCount = text.length;
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const averageWordLength =
      wordCount > 0
        ? words.reduce((sum: number, word: string) => sum + word.length, 0) / wordCount
        : 0;

    return {
      wordCount,
      characterCount,
      sentenceCount,
      averageWordLength: Math.round(averageWordLength * 100) / 100,
    };
  });

  // UUID generator tool
  server.registerTool('uuid-generator', async (args) => {
    const count = Math.min(Math.max(args.count || 1, 1), 100);
    const uuids: string[] = [];

    for (let i = 0; i < count; i++) {
      uuids.push(uuidv4());
    }

    return {
      uuids,
      count: uuids.length,
    };
  });
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n[MCP Server] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[MCP Server] Shutting down gracefully...');
  process.exit(0);
});

// Start the server
main();
