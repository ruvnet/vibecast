#!/usr/bin/env node

/**
 * MCP Server Security Check Script
 * 
 * This script performs security checks on the MCP server to identify
 * potential vulnerabilities and security issues.
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

// Security checks
const securityChecks = [
  {
    name: 'HTTP Headers Check',
    description: 'Verify that appropriate security headers are present',
    run: async () => {
      const response = await fetch(`${envConfig.url}/health`);
      
      const headers = response.headers;
      const results = [];
      
      // Check for Content-Type header
      if (headers.get('Content-Type')) {
        results.push({ name: 'Content-Type', status: 'pass' });
      } else {
        results.push({ 
          name: 'Content-Type', 
          status: 'warn',
          message: 'Content-Type header is missing' 
        });
      }
      
      // Check for CORS headers
      if (headers.get('Access-Control-Allow-Origin')) {
        const corsValue = headers.get('Access-Control-Allow-Origin');
        if (corsValue === '*') {
          results.push({ 
            name: 'CORS', 
            status: 'warn',
            message: 'CORS allows all origins (*), consider restricting to specific domains' 
          });
        } else {
          results.push({ name: 'CORS', status: 'pass' });
        }
      } else {
        results.push({ 
          name: 'CORS', 
          status: 'info',
          message: 'CORS headers not present on this endpoint' 
        });
      }
      
      // Check for Content-Security-Policy
      if (headers.get('Content-Security-Policy')) {
        results.push({ name: 'Content-Security-Policy', status: 'pass' });
      } else {
        results.push({ 
          name: 'Content-Security-Policy', 
          status: 'warn',
          message: 'Content-Security-Policy header is missing' 
        });
      }
      
      // Check for X-Content-Type-Options
      if (headers.get('X-Content-Type-Options') === 'nosniff') {
        results.push({ name: 'X-Content-Type-Options', status: 'pass' });
      } else {
        results.push({ 
          name: 'X-Content-Type-Options', 
          status: 'warn',
          message: 'X-Content-Type-Options: nosniff header is missing' 
        });
      }
      
      // Check for X-Frame-Options
      if (headers.get('X-Frame-Options')) {
        results.push({ name: 'X-Frame-Options', status: 'pass' });
      } else {
        results.push({ 
          name: 'X-Frame-Options', 
          status: 'warn',
          message: 'X-Frame-Options header is missing' 
        });
      }
      
      // Check for X-XSS-Protection
      if (headers.get('X-XSS-Protection')) {
        results.push({ name: 'X-XSS-Protection', status: 'pass' });
      } else {
        results.push({ 
          name: 'X-XSS-Protection', 
          status: 'warn',
          message: 'X-XSS-Protection header is missing' 
        });
      }
      
      return results;
    }
  },
  {
    name: 'JSON Injection Test',
    description: 'Test for JSON injection vulnerabilities',
    run: async () => {
      const results = [];
      
      // Test with malformed JSON
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{"jsonrpc": "2.0", "id": 1, "method": "mcp.list_tools", "params": {"foo": "bar"',
        });
        
        if (response.status === 400 || response.status === 200) {
          const data = await response.json();
          if (data.error && data.error.code === -32700) {
            results.push({ 
              name: 'Malformed JSON Handling', 
              status: 'pass',
              message: 'Server correctly handles malformed JSON' 
            });
          } else {
            results.push({ 
              name: 'Malformed JSON Handling', 
              status: 'warn',
              message: 'Server does not return proper JSON-RPC parse error for malformed JSON' 
            });
          }
        } else {
          results.push({ 
            name: 'Malformed JSON Handling', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Malformed JSON Handling', 
          status: 'error',
          message: `Error testing malformed JSON: ${error.message}` 
        });
      }
      
      // Test with JSON containing potentially dangerous values
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '"><script>alert(1)</script>',
            method: 'mcp.list_tools',
            params: {
              injection: '"; DROP TABLE users; --',
            },
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.id === '"><script>alert(1)</script>') {
            results.push({ 
              name: 'JSON Value Sanitization', 
              status: 'pass',
              message: 'Server correctly handles potentially dangerous JSON values' 
            });
          } else {
            results.push({ 
              name: 'JSON Value Sanitization', 
              status: 'warn',
              message: 'Server modifies JSON values, which may indicate improper handling' 
            });
          }
        } else {
          results.push({ 
            name: 'JSON Value Sanitization', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'JSON Value Sanitization', 
          status: 'error',
          message: `Error testing JSON value sanitization: ${error.message}` 
        });
      }
      
      return results;
    }
  },
  {
    name: 'Method Validation Test',
    description: 'Test for proper validation of JSON-RPC methods',
    run: async () => {
      const results = [];
      
      // Test with invalid method
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'mcp.invalid_method',
            params: {},
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.error && data.error.code === -32601) {
            results.push({ 
              name: 'Invalid Method Handling', 
              status: 'pass',
              message: 'Server correctly handles invalid methods' 
            });
          } else {
            results.push({ 
              name: 'Invalid Method Handling', 
              status: 'warn',
              message: 'Server does not return proper JSON-RPC method not found error' 
            });
          }
        } else {
          results.push({ 
            name: 'Invalid Method Handling', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Invalid Method Handling', 
          status: 'error',
          message: `Error testing invalid method: ${error.message}` 
        });
      }
      
      // Test with method injection attempt
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'mcp.list_tools; DROP TABLE users; --',
            params: {},
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.error && data.error.code === -32601) {
            results.push({ 
              name: 'Method Injection Prevention', 
              status: 'pass',
              message: 'Server correctly handles method injection attempts' 
            });
          } else {
            results.push({ 
              name: 'Method Injection Prevention', 
              status: 'warn',
              message: 'Server does not return proper error for method injection attempt' 
            });
          }
        } else {
          results.push({ 
            name: 'Method Injection Prevention', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Method Injection Prevention', 
          status: 'error',
          message: `Error testing method injection: ${error.message}` 
        });
      }
      
      return results;
    }
  },
  {
    name: 'Parameter Validation Test',
    description: 'Test for proper validation of tool parameters',
    run: async () => {
      const results = [];
      
      // Test with missing required parameter
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
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
                // Missing 'message' parameter which is required
              },
            },
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.error) {
            results.push({ 
              name: 'Required Parameter Validation', 
              status: 'pass',
              message: 'Server correctly validates required parameters' 
            });
          } else {
            results.push({ 
              name: 'Required Parameter Validation', 
              status: 'fail',
              message: 'Server does not validate required parameters' 
            });
          }
        } else {
          results.push({ 
            name: 'Required Parameter Validation', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Required Parameter Validation', 
          status: 'error',
          message: `Error testing parameter validation: ${error.message}` 
        });
      }
      
      // Test with parameter type mismatch
      try {
        const response = await fetch(`${envConfig.url}/mcp`, {
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
                message: 123, // Should be a string
              },
            },
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // Note: Some implementations might coerce types, so this isn't necessarily a failure
          results.push({ 
            name: 'Parameter Type Validation', 
            status: 'info',
            message: 'Server processed parameter with incorrect type' 
          });
        } else {
          results.push({ 
            name: 'Parameter Type Validation', 
            status: 'warn',
            message: `Unexpected status code: ${response.status}` 
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Parameter Type Validation', 
          status: 'error',
          message: `Error testing parameter type validation: ${error.message}` 
        });
      }
      
      return results;
    }
  },
];

/**
 * Run all security checks
 */
async function runSecurityChecks() {
  console.log(chalkFn.blue(`🔒 Running security checks on MCP server in ${environment} environment`));
  console.log(chalkFn.blue(`🌐 Server URL: ${envConfig.url}`));
  console.log();

  let pass = 0;
  let warn = 0;
  let fail = 0;
  let info = 0;
  let error = 0;

  for (const check of securityChecks) {
    console.log(chalkFn.cyan(`Running check: ${check.name}`));
    console.log(`  ${check.description}`);
    
    try {
      const results = await check.run();
      
      for (const result of results) {
        switch (result.status) {
          case 'pass':
            pass++;
            console.log(chalkFn.green(`  ✓ ${result.name}: PASS`));
            if (result.message) {
              console.log(`    ${result.message}`);
            }
            break;
          case 'warn':
            warn++;
            console.log(chalkFn.yellow(`  ⚠ ${result.name}: WARNING`));
            if (result.message) {
              console.log(`    ${result.message}`);
            }
            break;
          case 'fail':
            fail++;
            console.log(chalkFn.red(`  ✗ ${result.name}: FAIL`));
            if (result.message) {
              console.log(`    ${result.message}`);
            }
            break;
          case 'info':
            info++;
            console.log(chalkFn.blue(`  ℹ ${result.name}: INFO`));
            if (result.message) {
              console.log(`    ${result.message}`);
            }
            break;
          case 'error':
            error++;
            console.log(chalkFn.red(`  ! ${result.name}: ERROR`));
            if (result.message) {
              console.log(`    ${result.message}`);
            }
            break;
        }
      }
    } catch (error) {
      console.log(chalkFn.red(`  ! Error running check: ${error.message}`));
    }
    
    console.log();
  }

  console.log(chalkFn.blue('📊 Security Check Results:'));
  console.log(`  Pass: ${pass}`);
  console.log(`  Warning: ${warn}`);
  console.log(`  Fail: ${fail}`);
  console.log(`  Info: ${info}`);
  console.log(`  Error: ${error}`);
  
  if (fail > 0) {
    console.log(chalkFn.red('❌ Security check failed!'));
    console.log(chalkFn.yellow('  Please address the failing checks before deploying to production.'));
    
    // For local environment, don't exit with error code
    if (environment === 'local') {
      console.log(chalkFn.blue('ℹ️ This is a local environment, so we\'re ignoring failures for now.'));
    } else {
      process.exit(1);
    }
  } else if (warn > 0) {
    console.log(chalkFn.yellow('⚠ Security check passed with warnings.'));
    console.log(chalkFn.yellow('  Consider addressing the warnings to improve security.'));
  } else {
    console.log(chalkFn.green('✅ Security check passed!'));
  }
}

// Run the security checks
runSecurityChecks().catch(error => {
  console.error(chalkFn.red('Error running security checks:'));
  console.error(error);
  process.exit(1);
});