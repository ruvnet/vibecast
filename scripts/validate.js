#!/usr/bin/env node

/**
 * MCP Server Validation Script
 * 
 * This script validates that the MCP server is running correctly by testing
 * various endpoints and functionality.
 */

// Import node-fetch with the correct syntax
const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;
const chalk = require('chalk');

// Check if chalk is ESM module (v5+) and handle accordingly
const chalkFn = chalk.red ? chalk : chalk.default;

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'dev';

// Configuration for different environments
const config = {
  dev: {
    url: 'https://cloudflare-mcp-server-dev.workers.dev',
  },
  production: {
    url: 'https://cloudflare-mcp-server.workers.dev',
  },
  local: {
    url: 'http://localhost:3001',
  }
};

// Get the configuration for the specified environment
const envConfig = config[environment];
if (!envConfig) {
  console.error(chalkFn.red(`Error: Unknown environment '${environment}'`));
  console.error(chalkFn.yellow('Available environments: dev, production'));
  process.exit(1);
}

// Validation tests
const tests = [
  {
    name: 'Health Check',
    run: async () => {
      const response = await fetch(`${envConfig.url}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      const text = await response.text();
      if (text !== 'OK') {
        throw new Error(`Health check returned unexpected response: ${text}`);
      }
      return 'Health check passed';
    }
  },
  {
    name: 'Server Info',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`);
      if (!response.ok) {
        throw new Error(`Server info request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data.name || !data.version || !data.protocol) {
        throw new Error('Server info missing required fields');
      }
      return `Server info: ${data.name} v${data.version}`;
    }
  },
  {
    name: 'List Tools',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'mcp.list_tools',
          params: {},
        }),
      });
      if (!response.ok) {
        throw new Error(`List tools request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data.result || !data.result.tools) {
        throw new Error('List tools response missing tools array');
      }
      return `Found ${data.result.tools.length} tools`;
    }
  },
  {
    name: 'List Resources',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '2',
          method: 'mcp.list_resources',
          params: {},
        }),
      });
      if (!response.ok) {
        throw new Error(`List resources request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data.result || !data.result.resources) {
        throw new Error('List resources response missing resources array');
      }
      return `Found ${data.result.resources.length} resources`;
    }
  },
  {
    name: 'Execute Example Tool',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '3',
          method: 'mcp.use_tool',
          params: {
            tool: 'example_tool',
            parameters: {
              message: 'Hello from validation script',
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Execute tool request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data.result || !data.result.message) {
        throw new Error('Execute tool response missing expected fields');
      }
      return `Tool executed successfully: ${data.result.message}`;
    }
  },
  {
    name: 'Access Example Resource',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '4',
          method: 'mcp.access_resource',
          params: {
            uri: 'example_resource',
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Access resource request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data.result || !data.result.content) {
        throw new Error('Access resource response missing expected fields');
      }
      return `Resource accessed successfully`;
    }
  },
  {
    name: 'CORS Support',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });
      if (!response.ok) {
        throw new Error(`CORS preflight request failed with status ${response.status}`);
      }
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      if (!corsHeader) {
        throw new Error('CORS headers missing in response');
      }
      return `CORS support verified`;
    }
  },
];

async function runTests() {
  console.log(chalkFn.blue(`🔍 Validating MCP server in ${environment} environment`));
  console.log(chalkFn.blue(`🌐 Server URL: ${envConfig.url}`));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(chalkFn.cyan(`Running test: ${test.name}... `));
    
    try {
      const result = await test.run();
      passed++;
      console.log(chalkFn.green('✓ PASSED'));
      console.log(`  ${result}`);
    } catch (error) {
      failed++;
      console.log(chalkFn.red('✗ FAILED'));
      console.log(`  ${error.message}`);
    }
    
    console.log();
  }

  console.log(chalkFn.blue('📊 Test Results:'));
  console.log(`  Total: ${tests.length}`);
  console.log(chalkFn.green(`  Passed: ${passed}`));
  
  if (failed > 0) {
    console.log(chalkFn.red(`  Failed: ${failed}`));
    process.exit(1);
  } else {
    console.log(chalkFn.green('✅ All tests passed!'));
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalkFn.red('Error running tests:'));
  console.error(error);
  process.exit(1);
});