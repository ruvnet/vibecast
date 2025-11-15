#!/usr/bin/env node

import { Command } from 'commander';
import { ResearchSystem } from './research-system';
import * as readline from 'readline';

const program = new Command();

program
  .name('vibecast-research')
  .description('Self-learning research system powered by Kimi K2 and agentic-flow')
  .version('1.0.0');

program
  .command('research')
  .description('Conduct research on a topic')
  .argument('<topic>', 'Research topic')
  .option('-q, --query <query>', 'Specific query (optional)')
  .option('-s, --strategy <strategy>', 'Research strategy: parallel, sequential, or hierarchical', 'hierarchical')
  .option('-a, --agents <count>', 'Number of agents to use', '5')
  .option('-f, --feedback-loop', 'Enable self-learning feedback loop', false)
  .option('-c, --min-confidence <value>', 'Minimum confidence threshold for feedback loop', '0.8')
  .action(async (topic, options) => {
    try {
      const system = new ResearchSystem({
        agentCount: parseInt(options.agents),
      });

      system.displayWelcome();

      const query = options.query || `Comprehensive research on ${topic}`;
      const strategy = options.strategy as 'parallel' | 'sequential' | 'hierarchical';

      let result;
      if (options.feedbackLoop) {
        result = await system.researchWithFeedbackLoop(
          topic,
          query,
          parseFloat(options.minConfidence)
        );
      } else {
        result = await system.research(topic, query, strategy);
      }

      console.log('\n📋 FINAL RESULTS:\n');
      console.log(result.aggregatedFindings);
      console.log('\n💾 Results saved to data/results/');

      // Export results
      system.exportResults('markdown');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Research multiple topics in parallel')
  .argument('<topics...>', 'Topics to research (space-separated)')
  .option('-a, --agents <count>', 'Number of agents to use', '5')
  .action(async (topics, options) => {
    try {
      const system = new ResearchSystem({
        agentCount: parseInt(options.agents),
      });

      system.displayWelcome();

      const results = await system.parallelResearch(topics);

      console.log('\n📊 BATCH RESEARCH COMPLETE\n');
      results.forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.topic}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Insights: ${result.allInsights.length}`);
        console.log('');
      });

      system.exportResults('markdown');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show research system statistics')
  .action(() => {
    try {
      const system = new ResearchSystem();
      const stats = system.getSystemStats();

      console.log('\n📊 RESEARCH SYSTEM STATISTICS\n');
      console.log('Memory:');
      console.log(`  Total Memories: ${stats.memory.totalMemories}`);
      console.log(`  Total Reflexions: ${stats.memory.totalReflexions}`);
      console.log(`  Average Confidence: ${(stats.memory.averageConfidence * 100).toFixed(1)}%`);
      console.log('\nRecent Research:');
      stats.recentResearch.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.topic} (${(r.confidence * 100).toFixed(1)}%)`);
      });
      console.log('');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start interactive research mode')
  .option('-a, --agents <count>', 'Number of agents to use', '5')
  .action(async (options) => {
    try {
      const system = new ResearchSystem({
        agentCount: parseInt(options.agents),
      });

      system.displayWelcome();

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('🎤 Interactive Research Mode');
      console.log('Type your research topic (or "exit" to quit)\n');

      const askQuestion = () => {
        rl.question('Research topic > ', async (topic) => {
          if (topic.toLowerCase() === 'exit') {
            console.log('\n👋 Goodbye!');
            rl.close();
            return;
          }

          if (!topic.trim()) {
            askQuestion();
            return;
          }

          try {
            const result = await system.research(
              topic,
              `Comprehensive research on ${topic}`,
              'hierarchical'
            );

            console.log('\n📋 RESEARCH SUMMARY:\n');
            console.log(result.aggregatedFindings.substring(0, 500) + '...\n');
            console.log(`💡 Generated ${result.allInsights.length} insights`);
            console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);

            askQuestion();
          } catch (error) {
            console.error('❌ Error:', error instanceof Error ? error.message : error);
            askQuestion();
          }
        });
      };

      askQuestion();

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export research history')
  .option('-f, --format <format>', 'Export format: json or markdown', 'markdown')
  .action((options) => {
    try {
      const system = new ResearchSystem();
      system.exportResults(options.format as 'json' | 'markdown');
      console.log('✅ Export complete');
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
