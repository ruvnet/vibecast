#!/usr/bin/env node

/**
 * Run Cloudflare MCP Server Locally
 * 
 * This script uses Miniflare to run the Cloudflare MCP server locally
 * without requiring specific GLIBC versions.
 */

const { Miniflare } = require('miniflare');
const path = require('path');
const chalk = require('chalk');

// Check if chalk is ESM module (v5+) and handle accordingly
const chalkFn = chalk.red ? chalk : chalk.default;

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3001;

async function startMiniflare() {
  console.log(chalkFn.blue('🚀 Starting Cloudflare MCP Server locally using Miniflare'));
  console.log(chalkFn.blue(`🌐 Server will be available at http://localhost:${port}`));
  console.log();

  try {
    // Create a new Miniflare instance
    const mf = new Miniflare({
      // Miniflare configuration
      scriptPath: path.join(__dirname, '../dist/index.js'),
      modules: true,
      port,
      watch: true,
      buildCommand: 'npm run build',
      envPath: path.join(__dirname, '../.env'),
      env: {
        // Environment variables
        MCP_SERVER_NAME: 'cloudflare-mcp-server',
        MCP_VERSION: '1.0.0'
      }
    });

    // Start the server - Miniflare automatically starts a server
    console.log(chalkFn.green('✅ Cloudflare MCP Server is running!'));
    console.log(chalkFn.cyan(`💡 Press Ctrl+C to stop the server`));

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalkFn.yellow('\n🛑 Shutting down server...'));
      console.log(chalkFn.green('👋 Server has been stopped'));
      process.exit(0);
    });
  } catch (error) {
    console.error(chalkFn.red('❌ Error starting Miniflare:'));
    console.error(error);
    process.exit(1);
  }
}

// Run the server
startMiniflare().catch(error => {
  console.error(chalkFn.red('❌ Unhandled error:'));
  console.error(error);
  process.exit(1);
});