import { benchmarkTests, evaluationMetrics } from './benchmark-config.js';
import * as fs from 'fs';

// Model configurations
const MODELS = {
  deepseek: {
    name: 'deepseek/deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'OpenRouter'
  },
  kimi: {
    name: 'moonshot/moonshot-v1-128k',
    displayName: 'Kimi K2 (Moonshot)',
    provider: 'OpenRouter'
  }
};

// Simulated response generator with realistic variations
function generateSimulatedResponse(modelKey, test, categoryName) {
  // Simulate different performance characteristics for each model
  const modelCharacteristics = {
    deepseek: {
      speedMultiplier: 1.0,  // Baseline speed
      lengthMultiplier: 1.1, // Slightly longer responses
      successRate: 0.98,     // 98% success rate
      tokenMultiplier: 1.05
    },
    kimi: {
      speedMultiplier: 0.85, // 15% faster
      lengthMultiplier: 1.0, // Standard length
      successRate: 0.96,     // 96% success rate
      tokenMultiplier: 1.0
    }
  };

  const chars = modelCharacteristics[modelKey];
  const baseTime = 800 + Math.random() * 1200; // 800-2000ms base
  const executionTime = Math.round(baseTime * chars.speedMultiplier);

  // Simulate occasional failures
  if (Math.random() > chars.successRate) {
    return {
      testName: test.name,
      category: categoryName,
      success: false,
      error: 'Rate limit exceeded'
    };
  }

  // Generate sample responses based on test type
  const responseTemplates = {
    'Simple Function': 'Here\'s a factorial function with error handling:\n\n```javascript\nfunction factorial(n) {\n  if (n < 0) throw new Error("Cannot calculate factorial of negative number");\n  if (n === 0 || n === 1) return 1;\n  return n * factorial(n - 1);\n}\n```\n\nThis implementation includes proper error handling for negative numbers and handles base cases correctly.',

    'Algorithm Implementation': 'Here\'s a complete Binary Search Tree implementation in Python:\n\n```python\nclass Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\nclass BST:\n    def __init__(self):\n        self.root = None\n    \n    def insert(self, value):\n        if not self.root:\n            self.root = Node(value)\n        else:\n            self._insert_recursive(self.root, value)\n    \n    def _insert_recursive(self, node, value):\n        if value < node.value:\n            if node.left is None:\n                node.left = Node(value)\n            else:\n                self._insert_recursive(node.left, value)\n        else:\n            if node.right is None:\n                node.right = Node(value)\n            else:\n                self._insert_recursive(node.right, value)\n```',

    'Mathematical Reasoning': 'Let\'s solve this step by step:\n\n1. First segment: 120 km in 2 hours = 60 km/h\n2. Stop time: 30 minutes = 0.5 hours\n3. Second segment: 180 km in 3 hours = 60 km/h\n4. Total distance: 120 + 180 = 300 km\n5. Total time: 2 + 0.5 + 3 = 5.5 hours\n6. Average speed = 300 / 5.5 = 54.55 km/h\n\nThe average speed including the stop time is approximately 54.55 km/h.',

    'Sentiment Analysis': 'This text expresses mixed sentiment with several layers:\n\n1. Superficial politeness: "I appreciate the effort"\n2. Underlying disappointment: "expected more"\n3. Sense of being misled: "given the promises made"\n4. Grudging acceptance: "functional"\n5. Clear dissatisfaction: "not what was advertised"\n\nOverall sentiment: Negative-neutral (3/10). The speaker is diplomatically expressing disappointment while trying to remain constructive.',
  };

  // Get a response or generate a generic one
  const response = responseTemplates[test.name] || `This is a ${categoryName} response addressing: ${test.name}. ${modelKey === 'deepseek' ? 'The response includes detailed explanation and examples.' : 'The response is concise and to the point.'}`;

  const baseLength = response.length;
  const responseLength = Math.round(baseLength * chars.lengthMultiplier);

  // Simulate token usage
  const promptTokens = Math.round(test.prompt.length / 4);
  const completionTokens = Math.round(responseLength / 4);
  const totalTokens = Math.round((promptTokens + completionTokens) * chars.tokenMultiplier);

  return {
    testName: test.name,
    category: categoryName,
    success: true,
    response: response,
    executionTime: executionTime,
    responseLength: responseLength,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    },
    model: MODELS[modelKey].name
  };
}

// Function to run all benchmarks
async function runBenchmarks() {
  console.log('🚀 Starting LLM Benchmark: DeepSeek vs Kimi K2 (SIMULATED)');
  console.log('Note: This is a simulated run demonstrating the benchmark structure\n');
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
        console.log(`  Testing: ${test.name}...`);

        const result = generateSimulatedResponse(modelKey, test, category.category);
        results[modelKey].push(result);

        if (result.success) {
          console.log(`    ✓ Completed in ${result.executionTime}ms`);
        } else {
          console.log(`    ❌ Failed: ${result.error}`);
        }

        // Simulate delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
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
    totalTokens,
    minExecutionTime: Math.min(...successfulResults.map(r => r.executionTime)),
    maxExecutionTime: Math.max(...successfulResults.map(r => r.executionTime)),
    medianExecutionTime: Math.round(successfulResults.map(r => r.executionTime).sort((a, b) => a - b)[Math.floor(successfulResults.length / 2)])
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
  console.log(`   Response Time Range: ${deepseekStats.minExecutionTime}ms - ${deepseekStats.maxExecutionTime}ms`);
  console.log(`   Median Response Time: ${deepseekStats.medianExecutionTime}ms`);
  console.log(`   Avg Response Length: ${deepseekStats.avgResponseLength} chars`);
  console.log(`   Total Tokens Used: ${deepseekStats.totalTokens}`);
  console.log(`   Success Rate: ${(deepseekStats.successfulTests / deepseekStats.totalTests * 100).toFixed(1)}%`);

  console.log('\n🤖 Kimi K2 (Moonshot):');
  console.log(`   Total Tests: ${kimiStats.totalTests}`);
  console.log(`   Successful: ${kimiStats.successfulTests} ✓`);
  console.log(`   Failed: ${kimiStats.failedTests} ✗`);
  console.log(`   Avg Response Time: ${kimiStats.avgExecutionTime}ms`);
  console.log(`   Response Time Range: ${kimiStats.minExecutionTime}ms - ${kimiStats.maxExecutionTime}ms`);
  console.log(`   Median Response Time: ${kimiStats.medianExecutionTime}ms`);
  console.log(`   Avg Response Length: ${kimiStats.avgResponseLength} chars`);
  console.log(`   Total Tokens Used: ${kimiStats.totalTokens}`);
  console.log(`   Success Rate: ${(kimiStats.successfulTests / kimiStats.totalTests * 100).toFixed(1)}%`);

  console.log('\n📊 Head-to-Head Comparison:');
  console.log('-'.repeat(70));

  // Speed comparison
  if (deepseekStats.avgExecutionTime < kimiStats.avgExecutionTime) {
    const diff = ((kimiStats.avgExecutionTime - deepseekStats.avgExecutionTime) / kimiStats.avgExecutionTime * 100).toFixed(1);
    console.log(`   ⚡ Speed Winner: DeepSeek (${diff}% faster) 🏆`);
  } else if (kimiStats.avgExecutionTime < deepseekStats.avgExecutionTime) {
    const diff = ((deepseekStats.avgExecutionTime - kimiStats.avgExecutionTime) / deepseekStats.avgExecutionTime * 100).toFixed(1);
    console.log(`   ⚡ Speed Winner: Kimi K2 (${diff}% faster) 🏆`);
  } else {
    console.log(`   ⚡ Speed: Tied`);
  }

  // Response length comparison
  if (deepseekStats.avgResponseLength > kimiStats.avgResponseLength) {
    const diff = ((deepseekStats.avgResponseLength - kimiStats.avgResponseLength) / kimiStats.avgResponseLength * 100).toFixed(1);
    console.log(`   📝 More Detailed: DeepSeek (+${diff}% longer responses)`);
  } else if (kimiStats.avgResponseLength > deepseekStats.avgResponseLength) {
    const diff = ((kimiStats.avgResponseLength - deepseekStats.avgResponseLength) / deepseekStats.avgResponseLength * 100).toFixed(1);
    console.log(`   📝 More Detailed: Kimi K2 (+${diff}% longer responses)`);
  } else {
    console.log(`   📝 Response Detail: Tied`);
  }

  // Success rate comparison
  const deepseekSuccessRate = (deepseekStats.successfulTests / deepseekStats.totalTests * 100).toFixed(1);
  const kimiSuccessRate = (kimiStats.successfulTests / kimiStats.totalTests * 100).toFixed(1);

  if (parseFloat(deepseekSuccessRate) > parseFloat(kimiSuccessRate)) {
    console.log(`   ✅ Reliability Winner: DeepSeek (${deepseekSuccessRate}% vs ${kimiSuccessRate}%) 🏆`);
  } else if (parseFloat(kimiSuccessRate) > parseFloat(deepseekSuccessRate)) {
    console.log(`   ✅ Reliability Winner: Kimi K2 (${kimiSuccessRate}% vs ${deepseekSuccessRate}%) 🏆`);
  } else {
    console.log(`   ✅ Reliability: Tied (both ${deepseekSuccessRate}%)`);
  }

  // Token efficiency
  const deepseekTokensPerTest = (deepseekStats.totalTokens / deepseekStats.successfulTests).toFixed(0);
  const kimiTokensPerTest = (kimiStats.totalTokens / kimiStats.successfulTests).toFixed(0);

  if (deepseekStats.totalTokens < kimiStats.totalTokens) {
    const diff = ((kimiStats.totalTokens - deepseekStats.totalTokens) / kimiStats.totalTokens * 100).toFixed(1);
    console.log(`   💰 Token Efficiency Winner: DeepSeek (${diff}% fewer tokens) 🏆`);
  } else if (kimiStats.totalTokens < deepseekStats.totalTokens) {
    const diff = ((deepseekStats.totalTokens - kimiStats.totalTokens) / deepseekStats.totalTokens * 100).toFixed(1);
    console.log(`   💰 Token Efficiency Winner: Kimi K2 (${diff}% fewer tokens) 🏆`);
  }
  console.log(`      DeepSeek: ${deepseekTokensPerTest} tokens/test | Kimi K2: ${kimiTokensPerTest} tokens/test`);

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

    const winner = deepseekAvgTime < kimiAvgTime ? 'DeepSeek 🏆' : kimiAvgTime < deepseekAvgTime ? 'Kimi K2 🏆' : 'Tied';

    console.log(`\n   ${category}:`);
    console.log(`      DeepSeek: ${deepseekAvgTime}ms avg | ${deepseekCategoryResults.length}/${results.deepseek.filter(r => r.category === category).length} passed`);
    console.log(`      Kimi K2:  ${kimiAvgTime}ms avg | ${kimiCategoryResults.length}/${results.kimi.filter(r => r.category === category).length} passed`);
    console.log(`      Winner: ${winner}`);
  }

  // Overall verdict
  console.log('\n🏆 Overall Verdict:');
  console.log('-'.repeat(70));

  let deepseekScore = 0;
  let kimiScore = 0;

  if (deepseekStats.avgExecutionTime < kimiStats.avgExecutionTime) deepseekScore++;
  else if (kimiStats.avgExecutionTime < deepseekStats.avgExecutionTime) kimiScore++;

  if (deepseekStats.successfulTests > kimiStats.successfulTests) deepseekScore++;
  else if (kimiStats.successfulTests > deepseekStats.successfulTests) kimiScore++;

  if (deepseekStats.totalTokens < kimiStats.totalTokens) deepseekScore++;
  else if (kimiStats.totalTokens < deepseekStats.totalTokens) kimiScore++;

  console.log(`   DeepSeek Chat: ${deepseekScore} wins`);
  console.log(`   Kimi K2: ${kimiScore} wins`);

  if (deepseekScore > kimiScore) {
    console.log(`\n   🎉 Overall Winner: DeepSeek Chat`);
    console.log(`   DeepSeek excels in ${deepseekStats.avgExecutionTime < kimiStats.avgExecutionTime ? 'speed' : 'other metrics'} and provides ${deepseekStats.avgResponseLength > kimiStats.avgResponseLength ? 'more detailed' : 'efficient'} responses.`);
  } else if (kimiScore > deepseekScore) {
    console.log(`\n   🎉 Overall Winner: Kimi K2`);
    console.log(`   Kimi K2 excels in ${kimiStats.avgExecutionTime < deepseekStats.avgExecutionTime ? 'speed' : 'other metrics'} and provides ${kimiStats.avgResponseLength > deepseekStats.avgResponseLength ? 'more detailed' : 'efficient'} responses.`);
  } else {
    console.log(`\n   🤝 Result: Very close match!`);
    console.log(`   Both models show comparable performance across the benchmark suite.`);
  }

  return { deepseekStats, kimiStats };
}

// Function to save detailed results to JSON
function saveResults(results, stats) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `benchmark-results-${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    benchmarkType: 'simulated',
    models: MODELS,
    summary: stats,
    detailedResults: results,
    testConfiguration: {
      totalCategories: benchmarkTests.length,
      totalTests: benchmarkTests.reduce((sum, cat) => sum + cat.tests.length, 0),
      categories: benchmarkTests.map(cat => ({
        name: cat.category,
        testCount: cat.tests.length
      }))
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
    console.log('='.repeat(70));
    console.log('\nNote: To run with real API calls, ensure:');
    console.log('1. OPENROUTER_API_KEY environment variable is set');
    console.log('2. Network connectivity to OpenRouter is available');
    console.log('3. Run: node benchmark.js\n');

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the benchmark
main();
