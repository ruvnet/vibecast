#!/usr/bin/env node

/**
 * SWE-Bench Comparison Runner
 *
 * Runs both baseline and agentic tests, then generates comprehensive comparison
 */

import fs from 'fs';
import path from 'path';
import { BaselineRunner } from './baseline-runner.js';
import { AgenticRunner } from './agentic-runner.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Models to test
const TEST_MODELS = [
  'deepseek/deepseek-chat',           // Fast, cost-effective
  'meta-llama/llama-3.3-70b-instruct', // Open source, balanced
  'openai/gpt-3.5-turbo',             // Popular, affordable
];

class ComparisonRunner {
  constructor(models) {
    this.models = models;
    this.results = {};
  }

  /**
   * Run both baseline and agentic for a single model
   */
  async runModelComparison(modelId, tasks) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`COMPARING MODEL: ${modelId}`);
    console.log(`${'='.repeat(70)}\n`);

    const results = {
      modelId,
      baseline: null,
      agentic: null,
      comparison: null
    };

    try {
      // Run baseline
      console.log(`\n📊 Running BASELINE test for ${modelId}...\n`);
      const baselineRunner = new BaselineRunner(modelId);
      results.baseline = await baselineRunner.runAll(tasks);

      // Wait a bit between runs
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run agentic
      console.log(`\n🧠 Running AGENTIC test for ${modelId}...\n`);
      const agenticRunner = new AgenticRunner(modelId);
      results.agentic = await agenticRunner.runAll(tasks);

      // Generate comparison
      results.comparison = this.compareResults(results.baseline, results.agentic);

      this.results[modelId] = results;

    } catch (error) {
      console.error(`❌ Error running comparison for ${modelId}:`, error.message);
      results.error = error.message;
      this.results[modelId] = results;
    }

    return results;
  }

  /**
   * Compare baseline vs agentic results
   */
  compareResults(baseline, agentic) {
    const comparison = {
      successRateImprovement: {
        baseline: parseFloat(baseline.summary.successRate),
        agentic: parseFloat(agentic.summary.successRate),
        delta: parseFloat(agentic.summary.successRate) - parseFloat(baseline.summary.successRate),
        percentageImprovement: ((parseFloat(agentic.summary.successRate) - parseFloat(baseline.summary.successRate)) / parseFloat(baseline.summary.successRate) * 100).toFixed(2)
      },
      averageScoreImprovement: {
        baseline: parseFloat(baseline.summary.averageScore),
        agentic: parseFloat(agentic.summary.averageScore),
        delta: parseFloat(agentic.summary.averageScore) - parseFloat(baseline.summary.averageScore),
        percentageImprovement: ((parseFloat(agentic.summary.averageScore) - parseFloat(baseline.summary.averageScore)) / parseFloat(baseline.summary.averageScore) * 100).toFixed(2)
      },
      timeComparison: {
        baseline: parseFloat(baseline.summary.averageTimePerTask),
        agentic: parseFloat(agentic.summary.averageTimePerTask),
        delta: parseFloat(agentic.summary.averageTimePerTask) - parseFloat(baseline.summary.averageTimePerTask),
        percentageChange: ((parseFloat(agentic.summary.averageTimePerTask) - parseFloat(baseline.summary.averageTimePerTask)) / parseFloat(baseline.summary.averageTimePerTask) * 100).toFixed(2)
      },
      tokenComparison: {
        baseline: baseline.summary.totalTokens,
        agentic: agentic.summary.totalTokens,
        delta: agentic.summary.totalTokens - baseline.summary.totalTokens,
        percentageChange: ((agentic.summary.totalTokens - baseline.summary.totalTokens) / baseline.summary.totalTokens * 100).toFixed(2)
      },
      agenticFeatures: agentic.agenticFeatures || {},
      byDifficulty: this.compareDifficulties(baseline.byDifficulty, agentic.byDifficulty),
      byCategory: this.compareCategories(baseline.byCategory, agentic.byCategory)
    };

    return comparison;
  }

  /**
   * Compare results by difficulty
   */
  compareDifficulties(baseline, agentic) {
    const difficulties = ['easy', 'medium', 'hard'];
    const result = {};

    difficulties.forEach(diff => {
      const baseRate = parseFloat(baseline[diff]?.successRate || 0);
      const agenticRate = parseFloat(agentic[diff]?.successRate || 0);

      result[diff] = {
        baseline: baseRate,
        agentic: agenticRate,
        improvement: agenticRate - baseRate,
        percentageImprovement: baseRate > 0 ? ((agenticRate - baseRate) / baseRate * 100).toFixed(2) : 'N/A'
      };
    });

    return result;
  }

  /**
   * Compare results by category
   */
  compareCategories(baseline, agentic) {
    const categories = new Set([
      ...Object.keys(baseline),
      ...Object.keys(agentic)
    ]);

    const result = {};

    categories.forEach(cat => {
      const baseRate = parseFloat(baseline[cat]?.successRate || 0);
      const agenticRate = parseFloat(agentic[cat]?.successRate || 0);

      result[cat] = {
        baseline: baseRate,
        agentic: agenticRate,
        improvement: agenticRate - baseRate,
        percentageImprovement: baseRate > 0 ? ((agenticRate - baseRate) / baseRate * 100).toFixed(2) : 'N/A'
      };
    });

    return result;
  }

  /**
   * Run all model comparisons
   */
  async runAll(tasks) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`SWE-BENCH COMPARISON: BASELINE VS AGENTIC`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Models to test: ${this.models.length}`);
    console.log(`Tasks per model: ${tasks.length}`);
    console.log(`Total test runs: ${this.models.length * 2} (${this.models.length} baseline + ${this.models.length} agentic)`);
    console.log(`${'='.repeat(70)}\n`);

    for (const modelId of this.models) {
      await this.runModelComparison(modelId, tasks);

      // Wait between models to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return this.generateFinalReport();
  }

  /**
   * Generate comprehensive final report
   */
  generateFinalReport() {
    const report = {
      timestamp: new Date().toISOString(),
      modelsCompared: this.models.length,
      totalTasksPerModel: Object.values(this.results)[0]?.baseline?.summary?.totalTasks || 0,
      results: this.results,
      overallStatistics: this.calculateOverallStats(),
      conclusions: this.generateConclusions()
    };

    // Print summary
    this.printSummary(report);

    return report;
  }

  /**
   * Calculate overall statistics across all models
   */
  calculateOverallStats() {
    const stats = {
      averageSuccessRateImprovement: 0,
      averageScoreImprovement: 0,
      averageTimeChange: 0,
      totalMemoryHits: 0,
      totalReflexionApplied: 0,
      modelsWithImprovement: 0
    };

    let validComparisons = 0;

    Object.values(this.results).forEach(result => {
      if (result.comparison && !result.error) {
        validComparisons++;
        stats.averageSuccessRateImprovement += parseFloat(result.comparison.successRateImprovement.percentageImprovement);
        stats.averageScoreImprovement += parseFloat(result.comparison.averageScoreImprovement.percentageImprovement);
        stats.averageTimeChange += parseFloat(result.comparison.timeComparison.percentageChange);
        stats.totalMemoryHits += result.comparison.agenticFeatures.memoryHits || 0;
        stats.totalReflexionApplied += result.comparison.agenticFeatures.reflexionApplied || 0;

        if (parseFloat(result.comparison.successRateImprovement.percentageImprovement) > 0) {
          stats.modelsWithImprovement++;
        }
      }
    });

    if (validComparisons > 0) {
      stats.averageSuccessRateImprovement = (stats.averageSuccessRateImprovement / validComparisons).toFixed(2);
      stats.averageScoreImprovement = (stats.averageScoreImprovement / validComparisons).toFixed(2);
      stats.averageTimeChange = (stats.averageTimeChange / validComparisons).toFixed(2);
    }

    stats.improvementRate = ((stats.modelsWithImprovement / validComparisons) * 100).toFixed(2);

    return stats;
  }

  /**
   * Generate conclusions based on results
   */
  generateConclusions() {
    const stats = this.calculateOverallStats();
    const conclusions = [];

    // Success rate improvement
    if (parseFloat(stats.averageSuccessRateImprovement) > 5) {
      conclusions.push(`✅ Agentic enhancements improved success rate by an average of ${stats.averageSuccessRateImprovement}%`);
    } else if (parseFloat(stats.averageSuccessRateImprovement) > 0) {
      conclusions.push(`⚠️ Agentic enhancements showed modest improvement (${stats.averageSuccessRateImprovement}%)`);
    } else {
      conclusions.push(`❌ Agentic enhancements did not improve success rate significantly`);
    }

    // Score improvement
    if (parseFloat(stats.averageScoreImprovement) > 10) {
      conclusions.push(`✅ Solution quality improved by ${stats.averageScoreImprovement}% on average`);
    }

    // Time impact
    if (parseFloat(stats.averageTimeChange) > 10) {
      conclusions.push(`⚠️ Agentic mode increased execution time by ${stats.averageTimeChange}% (due to reflexion and memory queries)`);
    } else if (parseFloat(stats.averageTimeChange) < -5) {
      conclusions.push(`✅ Agentic mode decreased execution time by ${Math.abs(parseFloat(stats.averageTimeChange))}%`);
    }

    // Memory and learning features
    if (stats.totalMemoryHits > 0) {
      conclusions.push(`🧠 Memory system was utilized ${stats.totalMemoryHits} times across all tests`);
    }

    if (stats.totalReflexionApplied > 0) {
      conclusions.push(`🔄 Reflexion system improved solutions ${stats.totalReflexionApplied} times`);
    }

    // Overall conclusion
    if (parseFloat(stats.improvementRate) >= 75) {
      conclusions.push(`🎯 STRONG EVIDENCE: Agentic enhancements improved performance in ${stats.improvementRate}% of models tested`);
    } else if (parseFloat(stats.improvementRate) >= 50) {
      conclusions.push(`📊 MODERATE EVIDENCE: Agentic enhancements improved performance in ${stats.improvementRate}% of models tested`);
    } else {
      conclusions.push(`🤔 INCONCLUSIVE: Agentic enhancements showed mixed results (${stats.improvementRate}% improvement rate)`);
    }

    return conclusions;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`FINAL COMPARISON REPORT`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`📊 Overall Statistics:`);
    const stats = report.overallStatistics;
    console.log(`   • Average Success Rate Improvement: ${stats.averageSuccessRateImprovement}%`);
    console.log(`   • Average Score Improvement: ${stats.averageScoreImprovement}%`);
    console.log(`   • Average Time Change: ${stats.averageTimeChange}%`);
    console.log(`   • Models with Improvement: ${stats.modelsWithImprovement}/${this.models.length} (${stats.improvementRate}%)`);
    console.log(`   • Total Memory Hits: ${stats.totalMemoryHits}`);
    console.log(`   • Total Reflexion Applied: ${stats.totalReflexionApplied}`);

    console.log(`\n🔍 Per-Model Results:\n`);

    Object.entries(this.results).forEach(([modelId, result]) => {
      if (result.comparison && !result.error) {
        const comp = result.comparison;
        console.log(`   ${modelId}:`);
        console.log(`      Success Rate: ${comp.successRateImprovement.baseline}% → ${comp.successRateImprovement.agentic}% (${comp.successRateImprovement.delta > 0 ? '+' : ''}${comp.successRateImprovement.delta.toFixed(2)}%)`);
        console.log(`      Avg Score: ${comp.averageScoreImprovement.baseline}% → ${comp.averageScoreImprovement.agentic}% (${comp.averageScoreImprovement.delta > 0 ? '+' : ''}${comp.averageScoreImprovement.delta.toFixed(2)}%)`);
        console.log(`      Agentic Features: ${comp.agenticFeatures.memoryHits || 0} memory hits, ${comp.agenticFeatures.reflexionApplied || 0} reflexion applied`);
        console.log();
      }
    });

    console.log(`\n💡 Conclusions:\n`);
    report.conclusions.forEach((conclusion, i) => {
      console.log(`   ${i + 1}. ${conclusion}`);
    });

    console.log(`\n${'='.repeat(70)}\n`);
  }
}

// Main execution
async function main() {
  if (!OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY environment variable not set');
    console.error('Please set it: export OPENROUTER_API_KEY=your_key_here');
    process.exit(1);
  }

  // Load tasks
  const tasksFile = path.join(process.cwd(), 'swe-bench-tasks.json');
  if (!fs.existsSync(tasksFile)) {
    console.error('❌ Error: swe-bench-tasks.json not found');
    process.exit(1);
  }

  const tasksData = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  const tasks = tasksData.tasks;

  // Get models from command line or use defaults
  const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : TEST_MODELS;

  console.log(`\n🚀 Starting SWE-Bench Comparison`);
  console.log(`   Models: ${models.join(', ')}`);
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   Estimated time: ~${models.length * tasks.length * 2} minutes\n`);

  const runner = new ComparisonRunner(models);
  const report = await runner.runAll(tasks);

  // Save comprehensive report
  const reportFile = `comparison-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved to: ${reportFile}`);

  // Save markdown summary
  const markdownReport = generateMarkdownReport(report);
  const markdownFile = `comparison-report-${Date.now()}.md`;
  fs.writeFileSync(markdownFile, markdownReport);
  console.log(`📄 Markdown report saved to: ${markdownFile}`);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  let md = `# SWE-Bench Comparison: Baseline vs Agentic

**Generated**: ${report.timestamp}
**Models Compared**: ${report.modelsCompared}
**Tasks Per Model**: ${report.totalTasksPerModel}

## Executive Summary

`;

  report.conclusions.forEach(conclusion => {
    md += `- ${conclusion}\n`;
  });

  md += `\n## Overall Statistics

| Metric | Value |
|--------|-------|
| Average Success Rate Improvement | ${report.overallStatistics.averageSuccessRateImprovement}% |
| Average Score Improvement | ${report.overallStatistics.averageScoreImprovement}% |
| Average Time Change | ${report.overallStatistics.averageTimeChange}% |
| Models with Improvement | ${report.overallStatistics.modelsWithImprovement}/${report.modelsCompared} (${report.overallStatistics.improvementRate}%) |
| Total Memory Hits | ${report.overallStatistics.totalMemoryHits} |
| Total Reflexion Applied | ${report.overallStatistics.totalReflexionApplied} |

## Per-Model Results

`;

  Object.entries(report.results).forEach(([modelId, result]) => {
    if (result.comparison && !result.error) {
      const comp = result.comparison;
      md += `### ${modelId}

#### Success Rate
- **Baseline**: ${comp.successRateImprovement.baseline}%
- **Agentic**: ${comp.successRateImprovement.agentic}%
- **Improvement**: ${comp.successRateImprovement.delta > 0 ? '+' : ''}${comp.successRateImprovement.delta.toFixed(2)}% (${comp.successRateImprovement.percentageImprovement}% relative)

#### Average Score
- **Baseline**: ${comp.averageScoreImprovement.baseline}%
- **Agentic**: ${comp.averageScoreImprovement.agentic}%
- **Improvement**: ${comp.averageScoreImprovement.delta > 0 ? '+' : ''}${comp.averageScoreImprovement.delta.toFixed(2)}%

#### Performance
- **Baseline Time**: ${comp.timeComparison.baseline}ms per task
- **Agentic Time**: ${comp.timeComparison.agentic}ms per task
- **Time Change**: ${comp.timeComparison.percentageChange}%

#### Agentic Features Used
- **Memory Hits**: ${comp.agenticFeatures.memoryHits || 0}
- **Reflexion Applied**: ${comp.agenticFeatures.reflexionApplied || 0}
- **Learning Improvements**: ${comp.agenticFeatures.learningImprovements || 0}

---

`;
    }
  });

  md += `## Methodology

### Baseline Mode
- Direct API calls to OpenRouter
- No memory or learning systems
- Each task treated independently
- No reflexion or self-correction

### Agentic Mode
- AgentDB for persistent memory
- ReasoningBank for pattern learning
- Reflexion for self-correction
- Causal reasoning for context
- Agent Booster for optimization

### Evaluation Criteria
- **Success Rate**: Percentage of tasks solved correctly
- **Average Score**: Quality of solutions (0-100%)
- **Time**: Execution time per task
- **Tokens**: API token usage

## Conclusion

${report.conclusions.join('\n\n')}
`;

  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ComparisonRunner };
