import OpenAI from 'openai';
import { benchmarkTests, evaluationMetrics } from './benchmark-config.js';
import * as fs from 'fs';
import * as path from 'path';

// Model configurations
const MODELS = {
  deepseek: {
    name: 'deepseek/deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'OpenRouter',
    vendor: 'DeepSeek'
  },
  kimi: {
    name: 'moonshot/moonshot-v1-128k',
    displayName: 'Kimi K2',
    provider: 'OpenRouter',
    vendor: 'Moonshot AI'
  },
  gpt4o: {
    name: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    provider: 'OpenRouter',
    vendor: 'OpenAI'
  },
  claude: {
    name: 'anthropic/claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4.5',
    provider: 'OpenRouter',
    vendor: 'Anthropic'
  },
  gemini: {
    name: 'google/gemini-2.0-flash-exp:free',
    displayName: 'Gemini 2.0 Flash',
    provider: 'OpenRouter',
    vendor: 'Google'
  }
};

// Get API key from environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY environment variable is not set');
  console.error('Please set it using: export OPENROUTER_API_KEY=your_key_here');
  process.exit(1);
}

// Initialize OpenRouter client
const client = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// Helper function to measure execution time
async function measureExecution(fn) {
  const startTime = Date.now();
  const result = await fn();
  const endTime = Date.now();
  return {
    result,
    executionTime: endTime - startTime
  };
}

// Function to call model and get response
async function callModel(modelName, prompt, temperature = 0.7) {
  try {
    const { result, executionTime } = await measureExecution(async () => {
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature,
        max_tokens: 2000
      });
      return response;
    });

    return {
      success: true,
      response: result.choices[0].message.content,
      executionTime,
      usage: result.usage,
      model: result.model
    };
  } catch (error) {
    console.error('    Error details:', error.message);
    if (error.response) {
      console.error('    Response status:', error.response.status);
      console.error('    Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message,
      errorDetails: error.response?.data || error.toString(),
      executionTime: 0
    };
  }
}

// Function to run a single test
async function runTest(modelKey, modelConfig, test, categoryName) {
  console.log(`  Testing: ${test.name}...`);

  const result = await callModel(modelConfig.name, test.prompt);

  if (!result.success) {
    console.log(`    ❌ Failed: ${result.error}`);
    return {
      testName: test.name,
      category: categoryName,
      success: false,
      error: result.error
    };
  }

  console.log(`    ✓ Completed in ${result.executionTime}ms`);

  return {
    testName: test.name,
    category: categoryName,
    success: true,
    response: result.response,
    executionTime: result.executionTime,
    usage: result.usage,
    responseLength: result.response.length,
    model: result.model
  };
}

// Function to run all benchmarks
async function runBenchmarks() {
  console.log('🚀 Starting LLM Benchmark: DeepSeek vs Kimi K2\n');
  console.log('=' .repeat(70));

  const results = {
    deepseek: [],
    kimi: []
  };

  // Run benchmarks for each model
  for (const [modelKey, modelConfig] of Object.entries(MODELS)) {
    console.log(`\n📊 Testing ${modelConfig.displayName}`);
    console.log('-'.repeat(70));

    for (const category of benchmarkTests) {
      console.log(`\n${category.category}:`);

      for (const test of category.tests) {
        const result = await runTest(modelKey, modelConfig, test, category.category);
        results[modelKey].push(result);

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return results;
}

// Function to calculate statistics
function calculateStats(results) {
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    return {
      totalTests: results.length,
      successfulTests: 0,
      failedTests: results.length,
      avgExecutionTime: 0,
      avgResponseLength: 0,
      totalTokens: 0
    };
  }

  const avgExecutionTime = successfulResults.reduce((sum, r) => sum + r.executionTime, 0) / successfulResults.length;
  const avgResponseLength = successfulResults.reduce((sum, r) => sum + r.responseLength, 0) / successfulResults.length;
  const totalTokens = successfulResults.reduce((sum, r) => sum + (r.usage?.total_tokens || 0), 0);

  return {
    totalTests: results.length,
    successfulTests: successfulResults.length,
    failedTests: results.length - successfulResults.length,
    avgExecutionTime: Math.round(avgExecutionTime),
    avgResponseLength: Math.round(avgResponseLength),
    totalTokens
  };
}

// Function to generate comparison report
function generateReport(results) {
  console.log('\n\n' + '='.repeat(70));
  console.log('📈 BENCHMARK RESULTS');
  console.log('='.repeat(70));

  const deepseekStats = calculateStats(results.deepseek);
  const kimiStats = calculateStats(results.kimi);

  console.log('\n🤖 DeepSeek Chat:');
  console.log(`   Total Tests: ${deepseekStats.totalTests}`);
  console.log(`   Successful: ${deepseekStats.successfulTests} ✓`);
  console.log(`   Failed: ${deepseekStats.failedTests} ✗`);
  console.log(`   Avg Response Time: ${deepseekStats.avgExecutionTime}ms`);
  console.log(`   Avg Response Length: ${deepseekStats.avgResponseLength} chars`);
  console.log(`   Total Tokens Used: ${deepseekStats.totalTokens}`);

  console.log('\n🤖 Kimi K2:');
  console.log(`   Total Tests: ${kimiStats.totalTests}`);
  console.log(`   Successful: ${kimiStats.successfulTests} ✓`);
  console.log(`   Failed: ${kimiStats.failedTests} ✗`);
  console.log(`   Avg Response Time: ${kimiStats.avgExecutionTime}ms`);
  console.log(`   Avg Response Length: ${kimiStats.avgResponseLength} chars`);
  console.log(`   Total Tokens Used: ${kimiStats.totalTokens}`);

  console.log('\n📊 Performance Comparison:');
  console.log('-'.repeat(70));

  // Speed comparison
  if (deepseekStats.avgExecutionTime < kimiStats.avgExecutionTime) {
    const diff = ((kimiStats.avgExecutionTime - deepseekStats.avgExecutionTime) / kimiStats.avgExecutionTime * 100).toFixed(1);
    console.log(`   ⚡ Speed Winner: DeepSeek (${diff}% faster)`);
  } else if (kimiStats.avgExecutionTime < deepseekStats.avgExecutionTime) {
    const diff = ((deepseekStats.avgExecutionTime - kimiStats.avgExecutionTime) / deepseekStats.avgExecutionTime * 100).toFixed(1);
    console.log(`   ⚡ Speed Winner: Kimi K2 (${diff}% faster)`);
  } else {
    console.log(`   ⚡ Speed: Tied`);
  }

  // Response length comparison
  if (deepseekStats.avgResponseLength > kimiStats.avgResponseLength) {
    const diff = ((deepseekStats.avgResponseLength - kimiStats.avgResponseLength) / kimiStats.avgResponseLength * 100).toFixed(1);
    console.log(`   📝 More Detailed: DeepSeek (${diff}% longer responses)`);
  } else if (kimiStats.avgResponseLength > deepseekStats.avgResponseLength) {
    const diff = ((kimiStats.avgResponseLength - deepseekStats.avgResponseLength) / deepseekStats.avgResponseLength * 100).toFixed(1);
    console.log(`   📝 More Detailed: Kimi K2 (${diff}% longer responses)`);
  } else {
    console.log(`   📝 Response Detail: Tied`);
  }

  // Success rate comparison
  const deepseekSuccessRate = (deepseekStats.successfulTests / deepseekStats.totalTests * 100).toFixed(1);
  const kimiSuccessRate = (kimiStats.successfulTests / kimiStats.totalTests * 100).toFixed(1);
  console.log(`   ✅ Success Rate: DeepSeek ${deepseekSuccessRate}% | Kimi K2 ${kimiSuccessRate}%`);

  // Category breakdown
  console.log('\n📂 Performance by Category:');
  console.log('-'.repeat(70));

  const categories = [...new Set(results.deepseek.map(r => r.category))];

  for (const category of categories) {
    const deepseekCategoryResults = results.deepseek.filter(r => r.category === category && r.success);
    const kimiCategoryResults = results.kimi.filter(r => r.category === category && r.success);

    const deepseekAvgTime = deepseekCategoryResults.length > 0
      ? Math.round(deepseekCategoryResults.reduce((sum, r) => sum + r.executionTime, 0) / deepseekCategoryResults.length)
      : 0;
    const kimiAvgTime = kimiCategoryResults.length > 0
      ? Math.round(kimiCategoryResults.reduce((sum, r) => sum + r.executionTime, 0) / kimiCategoryResults.length)
      : 0;

    console.log(`\n   ${category}:`);
    console.log(`      DeepSeek: ${deepseekAvgTime}ms avg | ${deepseekCategoryResults.length}/${results.deepseek.filter(r => r.category === category).length} passed`);
    console.log(`      Kimi K2:  ${kimiAvgTime}ms avg | ${kimiCategoryResults.length}/${results.kimi.filter(r => r.category === category).length} passed`);
  }

  return { deepseekStats, kimiStats };
}

// Function to save detailed results to JSON
function saveResults(results, stats) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `benchmark-results-${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    models: MODELS,
    summary: stats,
    detailedResults: results,
    testConfiguration: {
      totalCategories: benchmarkTests.length,
      totalTests: benchmarkTests.reduce((sum, cat) => sum + cat.tests.length, 0)
    }
  };

  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Detailed results saved to: ${filename}`);

  return filename;
}

// Main execution
async function main() {
  try {
    const results = await runBenchmarks();
    const stats = generateReport(results);
    const filename = saveResults(results, stats);

    console.log('\n✨ Benchmark completed successfully!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the benchmark
main();
