#!/usr/bin/env node

/**
 * MCP Server Load Testing Script
 * 
 * This script performs load testing on the MCP server to verify its performance
 * under various levels of concurrent requests.
 */

// Import node-fetch with the correct syntax
const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;
const chalk = require('chalk');
const { performance } = require('perf_hooks');

// Check if chalk is ESM module (v5+) and handle accordingly
const chalkFn = chalk.red ? chalk : chalk.default;

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'dev';
const concurrency = parseInt(args[1], 10) || 50;
const requestsPerClient = parseInt(args[2], 10) || 20;

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

// Test scenarios
const scenarios = [
  {
    name: 'Health Check',
    run: async () => {
      const response = await fetch(`${envConfig.url}/health`);
      return response.ok;
    }
  },
  {
    name: 'Server Info',
    run: async () => {
      const response = await fetch(`${envConfig.url}/mcp`);
      return response.ok;
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
          id: Math.random().toString(36).substring(2, 9),
          method: 'mcp.list_tools',
          params: {},
        }),
      });
      return response.ok;
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
          id: Math.random().toString(36).substring(2, 9),
          method: 'mcp.use_tool',
          params: {
            tool: 'example_tool',
            parameters: {
              message: 'Load test message',
            },
          },
        }),
      });
      return response.ok;
    }
  },
];

/**
 * Run a single client's load test
 */
async function runClientTest(clientId, scenario) {
  const results = {
    clientId,
    scenario: scenario.name,
    successful: 0,
    failed: 0,
    totalTime: 0,
    responseTimes: [],
  };

  for (let i = 0; i < requestsPerClient; i++) {
    const startTime = performance.now();
    
    try {
      const success = await scenario.run();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.responseTimes.push(responseTime);
      results.totalTime += responseTime;
      
      if (success) {
        results.successful++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
    }
    
    // Small delay to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return results;
}

/**
 * Run load test for a specific scenario
 */
async function runScenarioTest(scenario) {
  console.log(chalkFn.blue(`🔥 Running load test for: ${scenario.name}`));
  console.log(chalkFn.blue(`   Concurrency: ${concurrency}, Requests per client: ${requestsPerClient}`));
  
  const startTime = performance.now();
  
  // Create an array of client test promises
  const clientPromises = [];
  for (let i = 0; i < concurrency; i++) {
    clientPromises.push(runClientTest(i, scenario));
  }
  
  // Wait for all clients to complete
  const clientResults = await Promise.all(clientPromises);
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  // Aggregate results
  const aggregatedResults = {
    scenario: scenario.name,
    totalRequests: concurrency * requestsPerClient,
    successful: 0,
    failed: 0,
    responseTimes: [],
    totalTime,
  };
  
  clientResults.forEach(result => {
    aggregatedResults.successful += result.successful;
    aggregatedResults.failed += result.failed;
    aggregatedResults.responseTimes = aggregatedResults.responseTimes.concat(result.responseTimes);
  });
  
  // Calculate statistics
  aggregatedResults.successRate = (aggregatedResults.successful / aggregatedResults.totalRequests) * 100;
  aggregatedResults.requestsPerSecond = (aggregatedResults.totalRequests / (totalTime / 1000));
  
  // Calculate response time statistics
  const sortedTimes = [...aggregatedResults.responseTimes].sort((a, b) => a - b);
  aggregatedResults.minResponseTime = sortedTimes[0];
  aggregatedResults.maxResponseTime = sortedTimes[sortedTimes.length - 1];
  aggregatedResults.avgResponseTime = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length;
  aggregatedResults.medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
  aggregatedResults.p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  aggregatedResults.p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  
  // Print results
  console.log(chalkFn.green(`✅ Test completed in ${totalTime.toFixed(2)}ms`));
  console.log(`   Total Requests: ${aggregatedResults.totalRequests}`);
  console.log(`   Successful: ${aggregatedResults.successful} (${aggregatedResults.successRate.toFixed(2)}%)`);
  console.log(`   Failed: ${aggregatedResults.failed}`);
  console.log(`   Requests/second: ${aggregatedResults.requestsPerSecond.toFixed(2)}`);
  console.log(`   Response Times (ms):`);
  console.log(`     Min: ${aggregatedResults.minResponseTime.toFixed(2)}`);
  console.log(`     Max: ${aggregatedResults.maxResponseTime.toFixed(2)}`);
  console.log(`     Avg: ${aggregatedResults.avgResponseTime.toFixed(2)}`);
  console.log(`     Median: ${aggregatedResults.medianResponseTime.toFixed(2)}`);
  console.log(`     95th percentile: ${aggregatedResults.p95ResponseTime.toFixed(2)}`);
  console.log(`     99th percentile: ${aggregatedResults.p99ResponseTime.toFixed(2)}`);
  console.log();
  
  return aggregatedResults;
}

/**
 * Run all load tests
 */
async function runLoadTests() {
  console.log(chalkFn.blue(`🔍 Load testing MCP server in ${environment} environment`));
  console.log(chalkFn.blue(`🌐 Server URL: ${envConfig.url}`));
  console.log();

  const results = [];
  
  for (const scenario of scenarios) {
    const result = await runScenarioTest(scenario);
    results.push(result);
  }
  
  // Print summary
  console.log(chalkFn.blue('📊 Load Test Summary:'));
  
  const totalRequests = results.reduce((sum, result) => sum + result.totalRequests, 0);
  const totalSuccessful = results.reduce((sum, result) => sum + result.successful, 0);
  const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
  const successRate = (totalSuccessful / totalRequests) * 100;
  
  console.log(`  Total Scenarios: ${scenarios.length}`);
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Successful: ${totalSuccessful} (${successRate.toFixed(2)}%)`);
  console.log(`  Failed: ${totalFailed}`);
  
  // Check if the test passed
  const passed = successRate >= 95;
  
  if (passed) {
    console.log(chalkFn.green('✅ Load test passed!'));
  } else {
    console.log(chalkFn.red('❌ Load test failed!'));
    console.log(chalkFn.yellow('  Success rate is below 95%'));
    process.exit(1);
  }
}

// Run the load tests
runLoadTests().catch(error => {
  console.error(chalkFn.red('Error running load tests:'));
  console.error(error);
  process.exit(1);
});