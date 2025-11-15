#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * Model Context Protocol (MCP) Server Implementation
 */

import { v4 as uuidv4 } from 'uuid';
import { MCPServer } from './core/mcp-server.js';
import { STDIOTransport } from './transport/stdio.js';
import { HttpSSETransport } from './transport/http-sse.js';
import { ServerConfig, AuthType } from './types/protocol.js';

// Server configuration
const transportMode = (process.env.TRANSPORT || 'stdio') as 'stdio' | 'http';
const httpPort = parseInt(process.env.PORT || '3000', 10);
const httpHost = process.env.HOST || 'localhost';

const config: ServerConfig = {
  name: 'Vibecast MCP Server',
  version: '1.0.0',
  description: 'Model Context Protocol Server for Vibecast - Supporting tool discovery, invocation, and resources',
  toolsDirectory: './tools',
  resourcesDirectory: './resources',
  transport: transportMode,
  http: {
    port: httpPort,
    host: httpHost,
    corsEnabled: true,
    corsOrigins: ['*'],
  },
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

// Register tool and resource handlers
registerToolHandlers(server);
registerResourceHandlers(server);

// Initialize and start server
async function main() {
  try {
    // Initialize server
    await server.initialize();

    // Start appropriate transport
    if (config.transport === 'http' && config.http) {
      const transport = new HttpSSETransport(server, config.http);
      await transport.start();
    } else {
      const transport = new STDIOTransport(server);
      transport.start();
    }
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

  // Async processor tool (demonstrates async execution with progress)
  server.registerTool('async-processor', async (args) => {
    const items = Math.min(Math.max(args.items || 10, 1), 100);
    const delay = args.delay || 100;
    const startTime = Date.now();

    // Simulate processing with delay
    await new Promise((resolve) => setTimeout(resolve, items * delay));

    return {
      processed: items,
      duration: Date.now() - startTime,
    };
  });
}

/**
 * Register handlers for all resources
 */
function registerResourceHandlers(server: MCPServer) {
  // Server config resource
  server.registerResource('server-config', async () => {
    return {
      config: server.getConfig(),
      info: server.getInfo(),
      capabilities: {
        tools: true,
        resources: true,
        stdio: true,
        http: true,
        authentication: ['none', 'bearer', 'mtls', 'keypair'],
      },
    };
  });

  // Server status resource
  server.registerResource('server-status', async () => {
    const memUsage = process.memoryUsage();
    return {
      status: 'online',
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB',
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Audit logs resource
  server.registerResource('audit-logs', async (parameters) => {
    const limit = parameters?.limit || 100;
    const auditLogger = server.getAuditLogger();
    const logs = await auditLogger.readLogs(limit);
    return {
      count: logs.length,
      logs,
    };
  });

  // Metrics resource
  server.registerResource('metrics', async () => {
    const auditLogger = server.getAuditLogger();
    const logs = await auditLogger.readLogs(1000);

    // Calculate metrics from audit logs
    const totalRequests = logs.length;
    const successCount = logs.filter((l) => l.status === 'success').length;
    const errorCount = logs.filter((l) => l.status === 'error').length;
    const avgDuration =
      logs.length > 0
        ? logs.reduce((sum, l) => sum + l.duration, 0) / logs.length
        : 0;

    // Group by tool
    const toolStats: Record<string, any> = {};
    logs.forEach((log) => {
      if (!toolStats[log.toolId]) {
        toolStats[log.toolId] = { count: 0, errors: 0, totalDuration: 0 };
      }
      toolStats[log.toolId].count++;
      if (log.status === 'error') toolStats[log.toolId].errors++;
      toolStats[log.toolId].totalDuration += log.duration;
    });

    // Calculate average duration per tool
    Object.keys(toolStats).forEach((toolId) => {
      toolStats[toolId].avgDuration = Math.round(
        toolStats[toolId].totalDuration / toolStats[toolId].count
      );
      delete toolStats[toolId].totalDuration;
    });

    return {
      summary: {
        totalRequests,
        successCount,
        errorCount,
        successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
        avgDuration: Math.round(avgDuration * 100) / 100,
      },
      toolStats,
      timestamp: new Date().toISOString(),
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
