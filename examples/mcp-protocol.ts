/**
 * MCP (Model Context Protocol) example
 * Demonstrates MCP-based communication patterns
 */

import {
  PubNubService,
  MCPProtocol
} from '../src';

async function main() {
  console.log('=== MCP Protocol Example ===\n');

  // Initialize PubNub
  const pubnub = new PubNubService({
    publishKey: 'demo',
    subscribeKey: 'demo',
    userId: 'mcp-client',
    logVerbosity: false,
  });

  // Initialize MCP Protocol
  const mcp = new MCPProtocol(pubnub);

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Register MCP methods
  console.log('📝 Registering MCP methods...\n');

  // Method 1: Get system info
  mcp.registerMethod('system.info', async (params) => {
    console.log('   📊 Handling system.info request');
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      platform: 'vibecast',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };
  });

  // Method 2: Calculate
  mcp.registerMethod('math.calculate', async (params) => {
    console.log(`   🔢 Calculating: ${params.operation}`);
    await new Promise(resolve => setTimeout(resolve, 300));

    const { operation, a, b } = params;
    let result;

    switch (operation) {
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
        result = b !== 0 ? a / b : null;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { result, operation, inputs: { a, b } };
  });

  // Method 3: Data processing
  mcp.registerMethod('data.process', async (params) => {
    console.log(`   ⚙️  Processing ${params.items?.length || 0} items`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const items = params.items || [];
    const processed = items.map((item: any) => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }));

    return {
      total: items.length,
      processed: processed.length,
      items: processed
    };
  });

  // Method 4: Search
  mcp.registerMethod('search.query', async (params) => {
    console.log(`   🔍 Searching for: "${params.query}"`);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simulate search results
    const mockResults = [
      { id: 1, title: 'Result 1', relevance: 0.95 },
      { id: 2, title: 'Result 2', relevance: 0.87 },
      { id: 3, title: 'Result 3', relevance: 0.72 }
    ].filter(r => r.relevance >= (params.minRelevance || 0));

    return {
      query: params.query,
      results: mockResults,
      count: mockResults.length,
      timestamp: Date.now()
    };
  });

  console.log('✅ Registered methods:', mcp.getMethods().join(', '));
  console.log();

  // Wait for registration to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Make MCP requests
  console.log('📤 Making MCP requests...\n');

  // Request 1: System info
  console.log('1️⃣  Requesting system info...');
  try {
    const systemInfo = await mcp.request('system.info', {});
    console.log('   ✅ Response:', JSON.stringify(systemInfo, null, 2));
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Request 2: Math calculation
  console.log('2️⃣  Requesting calculation...');
  try {
    const calcResult = await mcp.request('math.calculate', {
      operation: 'multiply',
      a: 42,
      b: 2
    });
    console.log('   ✅ Response:', calcResult);
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Request 3: Data processing
  console.log('3️⃣  Requesting data processing...');
  try {
    const processResult = await mcp.request('data.process', {
      items: [
        { id: 1, value: 'alpha' },
        { id: 2, value: 'beta' },
        { id: 3, value: 'gamma' }
      ]
    });
    console.log('   ✅ Response:', {
      total: processResult.total,
      processed: processResult.processed,
      sample: processResult.items[0]
    });
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Request 4: Search
  console.log('4️⃣  Requesting search...');
  try {
    const searchResult = await mcp.request('search.query', {
      query: 'vibecast',
      minRelevance: 0.8
    });
    console.log('   ✅ Response:', {
      query: searchResult.query,
      count: searchResult.count,
      results: searchResult.results
    });
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Request 5: Multiple parallel requests
  console.log('5️⃣  Making parallel requests...\n');
  try {
    const startTime = Date.now();
    const [calc1, calc2, calc3] = await Promise.all([
      mcp.request('math.calculate', { operation: 'add', a: 10, b: 5 }),
      mcp.request('math.calculate', { operation: 'subtract', a: 20, b: 8 }),
      mcp.request('math.calculate', { operation: 'divide', a: 100, b: 4 })
    ]);
    const duration = Date.now() - startTime;

    console.log('   ✅ All requests completed in', duration, 'ms');
    console.log('   Results:', [calc1.result, calc2.result, calc3.result]);
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Request 6: Error handling
  console.log('6️⃣  Testing error handling...');
  try {
    await mcp.request('nonexistent.method', {});
  } catch (error) {
    console.log('   ✅ Error caught correctly:', (error as Error).message);
  }
  console.log();

  // Request 7: Complex nested data
  console.log('7️⃣  Processing complex data...');
  try {
    const complexResult = await mcp.request('data.process', {
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        value: `item-${i + 1}`,
        metadata: {
          priority: Math.floor(Math.random() * 5) + 1,
          tags: ['tag1', 'tag2']
        }
      }))
    });
    console.log('   ✅ Processed', complexResult.processed, 'items');
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Performance test
  console.log('8️⃣  Performance test (10 rapid requests)...');
  const perfStart = Date.now();
  const perfPromises = Array.from({ length: 10 }, (_, i) =>
    mcp.request('math.calculate', {
      operation: 'multiply',
      a: i + 1,
      b: 2
    })
  );

  try {
    const perfResults = await Promise.all(perfPromises);
    const perfDuration = Date.now() - perfStart;
    console.log(`   ✅ Completed ${perfResults.length} requests in ${perfDuration}ms`);
    console.log(`   ⚡ Average: ${(perfDuration / perfResults.length).toFixed(2)}ms per request`);
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  console.log();

  // Summary
  console.log('📊 MCP Protocol Summary:');
  console.log(`   Registered methods: ${mcp.getMethods().length}`);
  console.log(`   Methods: ${mcp.getMethods().join(', ')}`);

  // Cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\n🔌 Disconnecting...');
  pubnub.disconnect();
  console.log('✅ Done!\n');
}

// Run example
main().catch(console.error);
