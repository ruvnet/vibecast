// SWE-bench Comparison - Compare Baseline vs Agentic Flow vs AgentDB
// Demonstrates practical impact of agent frameworks and memory systems

import { BaselineRunner } from './baseline-runner.js';
import { AgenticFlowRunner } from './agentic-flow-runner.js';
import { AgentDBRunner } from './agentdb-runner.js';
import { sweBenchTasks } from './swe-bench-tasks.js';
import * as fs from 'fs';

const MODELS = {
  'gemini-flash': 'google/gemini-2.0-flash-exp:free',
  'gpt4o-mini': 'openai/gpt-4o-mini',
  'deepseek': 'deepseek/deepseek-chat',
  'claude-haiku': 'anthropic/claude-3.5-haiku'
};

export async function runComparison(modelKey = 'gemini-flash', taskSubset = null) {
  const modelName = MODELS[modelKey] || MODELS['gemini-flash'];
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║     SWE-BENCH: Agent Framework Impact Analysis                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log(`\nModel: ${modelName}`);
  console.log(`Tasks: ${taskSubset ? taskSubset.length : sweBenchTasks.length}`);
  console.log(`Approaches: Baseline | Agentic Flow | AgentDB\n`);

  const tasks = taskSubset || sweBenchTasks;
  const results = {};

  // Run Baseline
  console.log('\n' + '═'.repeat(75));
  const baseline = new BaselineRunner(modelName, apiKey);
  results.baseline = await baseline.runAll(tasks);

  // Run Agentic Flow
  console.log('\n' + '═'.repeat(75));
  const agenticFlow = new AgenticFlowRunner(modelName, apiKey, 3);
  results.agenticFlow = await agenticFlow.runAll(tasks);

  // Run AgentDB
  console.log('\n' + '═'.repeat(75));
  const agentDB = new AgentDBRunner(modelName, apiKey, 3);
  results.agentDB = await agentDB.runAll(tasks);

  // Generate comparison report
  const comparison = generateComparison(results);

  // Print summary
  printSummary(comparison);

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `swe-bench-results-${modelKey}-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: modelName,
    modelKey,
    comparison,
    detailedResults: results
  }, null, 2));

  console.log(`\n💾 Detailed results saved to: ${filename}\n`);

  return comparison;
}

function generateComparison(results) {
  const approaches = ['baseline', 'agenticFlow', 'agentDB'];

  const comparison = {
    summary: {},
    improvements: {},
    byCategory: {},
    byDifficulty: {},
    costAnalysis: {},
    practicalImpact: {}
  };

  // Calculate summary metrics
  approaches.forEach(approach => {
    comparison.summary[approach] = {
      successRate: parseFloat(results[approach].successRate),
      avgScore: parseFloat(results[approach].avgScore),
      avgExecutionTime: results[approach].avgExecutionTime,
      avgTokensPerTask: results[approach].avgTokensPerTask,
      totalTokens: results[approach].totalTokens,
      totalAttempts: results[approach].totalAttempts,
      avgAttemptsPerTask: parseFloat(results[approach].avgAttemptsPerTask || 1)
    };
  });

  // Calculate improvements
  const baselineScore = comparison.summary.baseline.avgScore;
  const baselineSuccess = comparison.summary.baseline.successRate;

  comparison.improvements.agenticFlow = {
    scoreImprovement: ((comparison.summary.agenticFlow.avgScore - baselineScore) / baselineScore * 100).toFixed(1),
    successRateImprovement: ((comparison.summary.agenticFlow.successRate - baselineSuccess) / baselineSuccess * 100).toFixed(1),
    tokenCostIncrease: ((comparison.summary.agenticFlow.totalTokens - comparison.summary.baseline.totalTokens) / comparison.summary.baseline.totalTokens * 100).toFixed(1)
  };

  comparison.improvements.agentDB = {
    scoreImprovement: ((comparison.summary.agentDB.avgScore - baselineScore) / baselineScore * 100).toFixed(1),
    successRateImprovement: ((comparison.summary.agentDB.successRate - baselineSuccess) / baselineSuccess * 100).toFixed(1),
    tokenCostIncrease: ((comparison.summary.agentDB.totalTokens - comparison.summary.baseline.totalTokens) / comparison.summary.baseline.totalTokens * 100).toFixed(1),
    vsAgenticFlow: {
      scoreDiff: (comparison.summary.agentDB.avgScore - comparison.summary.agenticFlow.avgScore).toFixed(1),
      successRateDiff: (comparison.summary.agentDB.successRate - comparison.summary.agenticFlow.successRate).toFixed(1)
    }
  };

  // Category analysis
  const categories = Object.keys(results.baseline.byCategory);
  categories.forEach(cat => {
    comparison.byCategory[cat] = {
      baseline: {
        successRate: parseFloat(results.baseline.byCategory[cat].successRate),
        avgScore: parseFloat(results.baseline.byCategory[cat].avgScore)
      },
      agenticFlow: {
        successRate: parseFloat(results.agenticFlow.byCategory[cat].successRate),
        avgScore: parseFloat(results.agenticFlow.byCategory[cat].avgScore)
      },
      agentDB: {
        successRate: parseFloat(results.agentDB.byCategory[cat].successRate),
        avgScore: parseFloat(results.agentDB.byCategory[cat].avgScore)
      }
    };
  });

  // Difficulty analysis
  const difficulties = Object.keys(results.baseline.byDifficulty);
  difficulties.forEach(diff => {
    comparison.byDifficulty[diff] = {
      baseline: {
        successRate: parseFloat(results.baseline.byDifficulty[diff].successRate),
        avgScore: parseFloat(results.baseline.byDifficulty[diff].avgScore)
      },
      agenticFlow: {
        successRate: parseFloat(results.agenticFlow.byDifficulty[diff].successRate),
        avgScore: parseFloat(results.agenticFlow.byDifficulty[diff].avgScore)
      },
      agentDB: {
        successRate: parseFloat(results.agentDB.byDifficulty[diff].successRate),
        avgScore: parseFloat(results.agentDB.byDifficulty[diff].avgScore)
      }
    };
  });

  // Cost analysis
  comparison.costAnalysis = {
    baseline: {
      tokensPerTask: comparison.summary.baseline.avgTokensPerTask,
      attemptsPerTask: 1,
      efficiency: comparison.summary.baseline.avgScore / comparison.summary.baseline.avgTokensPerTask * 1000
    },
    agenticFlow: {
      tokensPerTask: comparison.summary.agenticFlow.avgTokensPerTask,
      attemptsPerTask: comparison.summary.agenticFlow.avgAttemptsPerTask,
      efficiency: comparison.summary.agenticFlow.avgScore / comparison.summary.agenticFlow.avgTokensPerTask * 1000
    },
    agentDB: {
      tokensPerTask: comparison.summary.agentDB.avgTokensPerTask,
      attemptsPerTask: comparison.summary.agentDB.avgAttemptsPerTask,
      efficiency: comparison.summary.agentDB.avgScore / comparison.summary.agentDB.avgTokensPerTask * 1000
    }
  };

  // Practical impact assessment
  comparison.practicalImpact = assessPracticalImpact(comparison);

  return comparison;
}

function assessPracticalImpact(comparison) {
  const impact = {
    overallAssessment: '',
    keyBenefits: [],
    costVsBenefit: '',
    recommendations: []
  };

  const agenticImprovement = parseFloat(comparison.improvements.agenticFlow.scoreImprovement);
  const agentDBImprovement = parseFloat(comparison.improvements.agentDB.scoreImprovement);
  const tokenIncrease = parseFloat(comparison.improvements.agentDB.tokenCostIncrease);

  // Overall assessment
  if (agentDBImprovement > 20) {
    impact.overallAssessment = 'HIGH IMPACT - Significant improvement in code quality and success rate';
  } else if (agentDBImprovement > 10) {
    impact.overallAssessment = 'MODERATE IMPACT - Notable improvements justify the additional cost';
  } else if (agentDBImprovement > 5) {
    impact.overallAssessment = 'LOW IMPACT - Marginal improvements, cost may not be justified';
  } else {
    impact.overallAssessment = 'MINIMAL IMPACT - Consider baseline approach';
  }

  // Key benefits
  if (agenticImprovement > 10) {
    impact.keyBenefits.push(`Agentic Flow: ${agenticImprovement}% improvement through iteration and reflection`);
  }
  if (agentDBImprovement > agenticImprovement + 5) {
    impact.keyBenefits.push(`Memory/Learning: Additional ${(agentDBImprovement - agenticImprovement).toFixed(1)}% gain from past experience`);
  }
  if (comparison.summary.agentDB.successRate > comparison.summary.baseline.successRate + 10) {
    impact.keyBenefits.push(`Success rate increased by ${comparison.improvements.agentDB.successRateImprovement}%`);
  }

  // Cost vs benefit
  const roi = agentDBImprovement / tokenIncrease;
  if (roi > 1) {
    impact.costVsBenefit = `POSITIVE ROI - ${roi.toFixed(2)}x improvement per token spent`;
  } else if (roi > 0.5) {
    impact.costVsBenefit = `NEUTRAL ROI - Benefits roughly match costs`;
  } else {
    impact.costVsBenefit = `NEGATIVE ROI - ${roi.toFixed(2)}x improvement per token spent`;
  }

  // Recommendations
  if (agentDBImprovement > 15 && roi > 0.8) {
    impact.recommendations.push('RECOMMENDED: Use AgentDB approach for production systems');
    impact.recommendations.push('The learning benefits compound over time');
  } else if (agenticImprovement > 10) {
    impact.recommendations.push('RECOMMENDED: Use Agentic Flow for better results without memory overhead');
  } else {
    impact.recommendations.push('CONSIDER: Baseline may be sufficient for simple tasks');
  }

  if (tokenIncrease > 200) {
    impact.recommendations.push('WARNING: High token cost - optimize prompts or use smaller model');
  }

  return impact;
}

function printSummary(comparison) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    COMPARISON SUMMARY                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  // Performance comparison table
  console.log('📊 Performance Metrics:\n');
  console.log('┌─────────────────────┬──────────┬──────────────┬─────────────┐');
  console.log('│ Approach            │ Success  │ Avg Score    │ Tokens/Task │');
  console.log('├─────────────────────┼──────────┼──────────────┼─────────────┤');

  ['baseline', 'agenticFlow', 'agentDB'].forEach(approach => {
    const name = approach === 'baseline' ? 'Baseline' :
                 approach === 'agenticFlow' ? 'Agentic Flow' : 'AgentDB';
    const data = comparison.summary[approach];
    console.log(`│ ${name.padEnd(19)} │ ${String(data.successRate + '%').padStart(7)} │ ${String(data.avgScore + '%').padStart(11)} │ ${String(data.avgTokensPerTask).padStart(11)} │`);
  });

  console.log('└─────────────────────┴──────────┴──────────────┴─────────────┘\n');

  // Improvements
  console.log('📈 Improvements Over Baseline:\n');
  console.log(`🟢 Agentic Flow:`);
  console.log(`   Score:        +${comparison.improvements.agenticFlow.scoreImprovement}%`);
  console.log(`   Success Rate: +${comparison.improvements.agenticFlow.successRateImprovement}%`);
  console.log(`   Token Cost:   +${comparison.improvements.agenticFlow.tokenCostIncrease}%`);

  console.log(`\n🟣 AgentDB:`);
  console.log(`   Score:        +${comparison.improvements.agentDB.scoreImprovement}%`);
  console.log(`   Success Rate: +${comparison.improvements.agentDB.successRateImprovement}%`);
  console.log(`   Token Cost:   +${comparison.improvements.agentDB.tokenCostIncrease}%`);
  console.log(`   vs Agentic:   +${comparison.improvements.agentDB.vsAgenticFlow.scoreDiff}% score`);

  // Practical impact
  console.log('\n💡 Practical Impact Assessment:\n');
  console.log(`   ${comparison.practicalImpact.overallAssessment}\n`);

  if (comparison.practicalImpact.keyBenefits.length > 0) {
    console.log('   Key Benefits:');
    comparison.practicalImpact.keyBenefits.forEach(benefit => {
      console.log(`   • ${benefit}`);
    });
    console.log('');
  }

  console.log(`   Cost vs Benefit: ${comparison.practicalImpact.costVsBenefit}\n`);

  console.log('   Recommendations:');
  comparison.practicalImpact.recommendations.forEach(rec => {
    console.log(`   ▸ ${rec}`);
  });

  console.log('\n' + '═'.repeat(75));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const modelKey = process.argv[2] || 'gemini-flash';

  // For testing, use subset of tasks
  const testSubset = sweBenchTasks.slice(0, 5); // First 5 tasks for quick test

  runComparison(modelKey, testSubset)
    .then(() => {
      console.log('✅ Benchmark completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}
