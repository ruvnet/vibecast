// Helper function to generate comparison report for all models
export function generateComprehensiveReport(results, MODELS) {
  console.log('\n\n' + '='.repeat(80));
  console.log('📈 COMPREHENSIVE BENCHMARK RESULTS - 5 MODEL COMPARISON');
  console.log('='.repeat(80));

  // Calculate stats for all models
  const allStats = {};
  for (const modelKey of Object.keys(results)) {
    allStats[modelKey] = calculateStats(results[modelKey]);
  }

  // Print individual model summaries
  console.log('\n📊 Individual Model Performance:\n');

  for (const [modelKey, stats] of Object.entries(allStats)) {
    const modelInfo = MODELS[modelKey];
    console.log(`🤖 ${modelInfo.displayName} (${modelInfo.vendor}):`);
    console.log(`   Total Tests: ${stats.totalTests}`);
    console.log(`   Success Rate: ${(stats.successfulTests / stats.totalTests * 100).toFixed(1)}% (${stats.successfulTests}/${stats.totalTests})`);
    console.log(`   Avg Response Time: ${stats.avgExecutionTime}ms`);
    console.log(`   Response Time Range: ${stats.minExecutionTime}ms - ${stats.maxExecutionTime}ms`);
    console.log(`   Median Response Time: ${stats.medianExecutionTime}ms`);
    console.log(`   Avg Response Length: ${stats.avgResponseLength} chars`);
    console.log(`   Total Tokens: ${stats.totalTokens} | Per Test: ${Math.round(stats.totalTokens / stats.successfulTests)}`);
    console.log('');
  }

  // Speed Rankings
  console.log('='.repeat(80));
  console.log('🏆 RANKINGS BY METRIC\n');

  console.log('⚡ Speed (Avg Response Time):');
  const speedRankings = Object.entries(allStats)
    .sort((a, b) => a[1].avgExecutionTime - b[1].avgExecutionTime)
    .map((entry, index) => {
      const [modelKey, stats] = entry;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      return `   ${medal} #${index + 1}: ${MODELS[modelKey].displayName.padEnd(25)} - ${stats.avgExecutionTime}ms`;
    });
  speedRankings.forEach(line => console.log(line));

  console.log('\n💰 Token Efficiency (Fewer tokens = better):');
  const tokenRankings = Object.entries(allStats)
    .sort((a, b) => a[1].totalTokens - b[1].totalTokens)
    .map((entry, index) => {
      const [modelKey, stats] = entry;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const perTest = Math.round(stats.totalTokens / stats.successfulTests);
      return `   ${medal} #${index + 1}: ${MODELS[modelKey].displayName.padEnd(25)} - ${stats.totalTokens} tokens (${perTest}/test)`;
    });
  tokenRankings.forEach(line => console.log(line));

  console.log('\n✅ Reliability (Success Rate):');
  const reliabilityRankings = Object.entries(allStats)
    .sort((a, b) => (b[1].successfulTests / b[1].totalTests) - (a[1].successfulTests / a[1].totalTests))
    .map((entry, index) => {
      const [modelKey, stats] = entry;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const rate = (stats.successfulTests / stats.totalTests * 100).toFixed(1);
      return `   ${medal} #${index + 1}: ${MODELS[modelKey].displayName.padEnd(25)} - ${rate}% (${stats.successfulTests}/${stats.totalTests})`;
    });
  reliabilityRankings.forEach(line => console.log(line));

  console.log('\n📝 Response Detail (Avg chars):');
  const detailRankings = Object.entries(allStats)
    .sort((a, b) => b[1].avgResponseLength - a[1].avgResponseLength)
    .map((entry, index) => {
      const [modelKey, stats] = entry;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      return `   ${medal} #${index + 1}: ${MODELS[modelKey].displayName.padEnd(25)} - ${stats.avgResponseLength} chars`;
    });
  detailRankings.forEach(line => console.log(line));

  // Overall scoring
  console.log('\n' + '='.repeat(80));
  console.log('🎯 OVERALL SCORE (Based on Rankings):\n');

  const scores = {};
  Object.keys(results).forEach(key => scores[key] = 0);

  // Award points: 1st place = 5 pts, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1
  const pointSystem = [5, 4, 3, 2, 1];

  // Speed points
  Object.entries(allStats)
    .sort((a, b) => a[1].avgExecutionTime - b[1].avgExecutionTime)
    .forEach(([key], index) => scores[key] += pointSystem[index]);

  // Token efficiency points
  Object.entries(allStats)
    .sort((a, b) => a[1].totalTokens - b[1].totalTokens)
    .forEach(([key], index) => scores[key] += pointSystem[index]);

  // Reliability points
  Object.entries(allStats)
    .sort((a, b) => (b[1].successfulTests / b[1].totalTests) - (a[1].successfulTests / a[1].totalTests))
    .forEach(([key], index) => scores[key] += pointSystem[index]);

  // Sort by total score
  const finalRankings = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map((entry, index) => {
      const [modelKey, score] = entry;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const trophy = index === 0 ? ' 🏆 OVERALL WINNER!' : '';
      return `   ${medal} #${index + 1}: ${MODELS[modelKey].displayName.padEnd(25)} - ${score} points${trophy}`;
    });

  finalRankings.forEach(line => console.log(line));

  // Performance comparison table
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPARATIVE PERFORMANCE TABLE:\n');

  console.log('Model                      Speed(ms)  Tokens  Success%  Detail(chars)');
  console.log('-'.repeat(80));

  Object.entries(allStats).forEach(([modelKey, stats]) => {
    const name = MODELS[modelKey].displayName.padEnd(25);
    const speed = String(stats.avgExecutionTime).padStart(8);
    const tokens = String(stats.totalTokens).padStart(7);
    const success = String((stats.successfulTests / stats.totalTests * 100).toFixed(1) + '%').padStart(8);
    const detail = String(stats.avgResponseLength).padStart(13);
    console.log(`${name} ${speed}  ${tokens}  ${success}  ${detail}`);
  });

  // Category analysis
  console.log('\n' + '='.repeat(80));
  console.log('📂 PERFORMANCE BY CATEGORY:\n');

  const categories = [...new Set(results[Object.keys(results)[0]].map(r => r.category))];

  for (const category of categories) {
    console.log(`   ${category}:`);

    const categoryPerf = {};
    for (const modelKey of Object.keys(results)) {
      const categoryResults = results[modelKey].filter(r => r.category === category && r.success);
      if (categoryResults.length > 0) {
        const avgTime = Math.round(categoryResults.reduce((sum, r) => sum + r.executionTime, 0) / categoryResults.length);
        categoryPerf[modelKey] = avgTime;
      } else {
        categoryPerf[modelKey] = Infinity;
      }
    }

    // Find winner
    const sortedPerf = Object.entries(categoryPerf).sort((a, b) => a[1] - b[1]);
    const winner = sortedPerf[0];

    sortedPerf.forEach(([modelKey, time], index) => {
      const marker = index === 0 ? '🏆' : '  ';
      const passed = results[modelKey].filter(r => r.category === category && r.success).length;
      const total = results[modelKey].filter(r => r.category === category).length;
      console.log(`      ${marker} ${MODELS[modelKey].displayName.padEnd(25)}: ${time}ms avg | ${passed}/${total} passed`);
    });
    console.log('');
  }

  // Key insights
  console.log('='.repeat(80));
  console.log('💡 KEY INSIGHTS:\n');

  const fastestModel = Object.entries(allStats).sort((a, b) => a[1].avgExecutionTime - b[1].avgExecutionTime)[0];
  const mostEfficientModel = Object.entries(allStats).sort((a, b) => a[1].totalTokens - b[1].totalTokens)[0];
  const mostDetailedModel = Object.entries(allStats).sort((a, b) => b[1].avgResponseLength - a[1].avgResponseLength)[0];
  const mostReliableModel = Object.entries(allStats).sort((a, b) => (b[1].successfulTests / b[1].totalTests) - (a[1].successfulTests / a[1].totalTests))[0];

  console.log(`   ⚡ Fastest: ${MODELS[fastestModel[0]].displayName} (${fastestModel[1].avgExecutionTime}ms avg)`);
  console.log(`   💰 Most Token-Efficient: ${MODELS[mostEfficientModel[0]].displayName} (${mostEfficientModel[1].totalTokens} tokens)`);
  console.log(`   📝 Most Detailed: ${MODELS[mostDetailedModel[0]].displayName} (${mostDetailedModel[1].avgResponseLength} chars avg)`);
  console.log(`   ✅ Most Reliable: ${MODELS[mostReliableModel[0]].displayName} (${(mostReliableModel[1].successfulTests / mostReliableModel[1].totalTests * 100).toFixed(1)}%)`);

  return allStats;
}

function calculateStats(results) {
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    return {
      totalTests: results.length,
      successfulTests: 0,
      failedTests: results.length,
      avgExecutionTime: 0,
      avgResponseLength: 0,
      totalTokens: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      medianExecutionTime: 0
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
