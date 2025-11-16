#!/usr/bin/env node

/**
 * ROS3 MCP Server CLI
 */

import { ROS3McpServer } from './server.js';

async function main() {
  const server = new ROS3McpServer({
    name: 'ros3-mcp-server',
    version: '1.0.0',
    dbPath: process.env.AGENTDB_PATH || './ros3-agentdb.db',
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down ROS3 MCP Server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nShutting down ROS3 MCP Server...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();

  // Keep the process running
  console.error('\nPress Ctrl+C to stop the server');

  // Simple REPL for testing
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  console.error('\nEnter commands (e.g., "get_pose", "get_status"):');

  rl.on('line', async (line) => {
    const cmd = line.trim();

    try {
      switch (cmd) {
        case 'get_pose':
          console.log(await server.getPose());
          break;
        case 'get_status':
          console.log(await server.getStatus());
          break;
        case 'get_memory_stats':
          console.log(await server.getMemoryStats());
          break;
        case 'info':
          console.log(JSON.stringify(server.getInfo(), null, 2));
          break;
        case 'help':
          console.log('Available commands:');
          console.log('  get_pose - Get current robot pose');
          console.log('  get_status - Get robot status');
          console.log('  get_memory_stats - Get memory statistics');
          console.log('  info - Get server info');
          console.log('  help - Show this help');
          console.log('  exit - Stop the server');
          break;
        case 'exit':
          await server.stop();
          process.exit(0);
          break;
        default:
          if (cmd) {
            console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
          }
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
    }
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
