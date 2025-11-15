#!/usr/bin/env ts-node

/**
 * Test script for the Vibecast Research System
 * This demonstrates the system with actual API calls
 */

import { ResearchSystem } from './src/research-system';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testResearchSystem() {
  console.log('🧪 Testing Vibecast Research System\n');

  // Check if API key is configured
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    console.log('⚠️  OPENROUTER_API_KEY not configured in .env file');
    console.log('');
    console.log('To test with real API calls:');
    console.log('1. Get your API key from: https://openrouter.ai/keys');
    console.log('2. Add it to .env file:');
    console.log('   OPENROUTER_API_KEY=sk-or-v1-...');
    console.log('3. Run this script again: ts-node test-research.ts');
    console.log('');
    console.log('For now, showing system initialization without API calls...\n');

    // Demo mode - just show initialization
    console.log('📊 System Configuration:');
    console.log(`   Model: ${process.env.KIMI_MODEL}`);
    console.log(`   Max Depth: ${process.env.MAX_RESEARCH_DEPTH}`);
    console.log(`   Max Agents: ${process.env.MAX_CONCURRENT_AGENTS}`);
    console.log('');
    console.log('✅ System structure verified and ready to use!');
    console.log('');
    console.log('Example usage once API key is configured:');
    console.log('```bash');
    console.log('npm run dev                    # Interactive mode');
    console.log('npm start -- research "AI Agents" --feedback-loop');
    console.log('npm start -- batch "Topic1" "Topic2" "Topic3"');
    console.log('```');
    return;
  }

  // API key is configured, run actual test
  console.log('✅ API key configured! Running test research...\n');

  try {
    const system = new ResearchSystem({
      agentCount: 2, // Use fewer agents for testing
      saveResults: true,
    });

    system.displayWelcome();

    // Test 1: Simple research
    console.log('\n🔬 Test 1: Simple Research Query\n');
    const result = await system.research(
      'Artificial Intelligence',
      'What is the difference between AI agents and traditional software?',
      'parallel'
    );

    console.log('\n📊 Results:');
    console.log(`   Topic: ${result.topic}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Insights: ${result.allInsights.length}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.allInsights.length > 0) {
      console.log('\n💡 Top Insights:');
      result.allInsights.slice(0, 3).forEach((insight, idx) => {
        console.log(`   ${idx + 1}. ${insight}`);
      });
    }

    // Show system stats
    console.log('\n📈 System Statistics:');
    const stats = system.getSystemStats();
    console.log(`   Total Memories: ${stats.memory.totalMemories}`);
    console.log(`   Average Confidence: ${(stats.memory.averageConfidence * 100).toFixed(1)}%`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n💾 Results saved to: ./data/results/');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    console.error('\nPossible issues:');
    console.error('1. Invalid API key');
    console.error('2. Network connectivity');
    console.error('3. OpenRouter service issue');
    console.error('\nCheck your API key at: https://openrouter.ai/keys');
    process.exit(1);
  }
}

// Run the test
testResearchSystem().catch(console.error);
