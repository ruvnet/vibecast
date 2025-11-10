/**
 * Basic Usage Examples for Vibecast Research System
 *
 * This file demonstrates how to use the research system programmatically
 */

import { ResearchSystem } from '../src/research-system';

async function main() {
  console.log('🚀 Vibecast Research System - Basic Usage Examples\n');

  // Example 1: Single Research Task
  console.log('Example 1: Single Research Task');
  console.log('─'.repeat(80));

  const system = new ResearchSystem({
    agentCount: 3,
    saveResults: true,
  });

  system.displayWelcome();

  // Note: Uncomment these examples after setting up your .env with OPENROUTER_API_KEY

  /*
  const result = await system.research(
    'Artificial Intelligence',
    'What are the latest developments in multi-agent AI systems?',
    'hierarchical'
  );

  console.log('\n📊 Research Results:');
  console.log(`Topic: ${result.topic}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`Insights: ${result.allInsights.length}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log('\nSummary:');
  console.log(result.aggregatedFindings.substring(0, 500) + '...');
  */

  // Example 2: Self-Learning Research with Feedback Loop
  console.log('\n\nExample 2: Self-Learning Research with Feedback Loop');
  console.log('─'.repeat(80));

  /*
  const improvedResult = await system.researchWithFeedbackLoop(
    'Quantum Computing',
    'Explain quantum algorithms for machine learning',
    0.85  // Target confidence of 85%
  );

  console.log(`\nFinal Confidence: ${(improvedResult.confidence * 100).toFixed(1)}%`);
  */

  // Example 3: Batch Research
  console.log('\n\nExample 3: Batch Research');
  console.log('─'.repeat(80));

  /*
  const topics = [
    'AI Safety',
    'Neural Networks',
    'Reinforcement Learning'
  ];

  const batchResults = await system.parallelResearch(topics);

  console.log('\n📊 Batch Results:');
  batchResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.topic}: ${(result.confidence * 100).toFixed(1)}% confidence`);
  });
  */

  // Example 4: System Statistics
  console.log('\n\nExample 4: System Statistics');
  console.log('─'.repeat(80));

  const stats = system.getSystemStats();
  console.log('\n📊 Current Stats:');
  console.log(`Total Memories: ${stats.memory.totalMemories}`);
  console.log(`Total Reflexions: ${stats.memory.totalReflexions}`);
  console.log(`Average Confidence: ${(stats.memory.averageConfidence * 100).toFixed(1)}%`);

  console.log('\nRecent Research:');
  if (stats.recentResearch.length === 0) {
    console.log('  No research history yet. Run a research task to see results here!');
  } else {
    stats.recentResearch.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.topic} (${(r.confidence * 100).toFixed(1)}%)`);
    });
  }

  // Example 5: Export Results
  console.log('\n\nExample 5: Export Results');
  console.log('─'.repeat(80));
  console.log('To export results, run:');
  console.log('  npm start -- export -f markdown');
  console.log('  npm start -- export -f json');

  console.log('\n✅ Examples complete!\n');
  console.log('Next steps:');
  console.log('1. Set up your .env file with OPENROUTER_API_KEY');
  console.log('2. Uncomment the examples above to test the system');
  console.log('3. Try the CLI: npm start -- research "Your Topic"');
  console.log('4. Or use interactive mode: npm run dev\n');
}

main().catch(console.error);
