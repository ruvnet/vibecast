/**
 * VibeCast Pro - Advanced Demo
 *
 * Demonstrates the multi-agent swarm architecture with:
 * - Vector embeddings for semantic understanding
 * - AgenticFlow-powered agent orchestration
 * - Conversational discovery interface
 *
 * Built for the Agentics Foundation TV5 Hackathon
 * Track: Entertainment Discovery
 */

import { getContentCatalog, getUserProfileService } from './services';
import { getVectorStore } from './embeddings';
import { getSwarmOrchestrator } from './agents/swarm';
import { getConversationalDiscovery } from './discovery';

/**
 * Run the VibeCast Pro demonstration
 */
export function runProDemo(): void {
  console.info('\n');
  console.info('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.info('║                                                                           ║');
  console.info('║   ██╗   ██╗██╗██████╗ ███████╗ ██████╗ █████╗ ███████╗████████╗          ║');
  console.info('║   ██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝╚══██╔══╝          ║');
  console.info('║   ██║   ██║██║██████╔╝█████╗  ██║     ███████║███████╗   ██║             ║');
  console.info('║   ╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██║     ██╔══██║╚════██║   ██║             ║');
  console.info('║    ╚████╔╝ ██║██████╔╝███████╗╚██████╗██║  ██║███████║   ██║             ║');
  console.info('║     ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝             ║');
  console.info('║                                                                           ║');
  console.info('║                    🚀 PRO - Multi-Agent Discovery 🚀                      ║');
  console.info('║                                                                           ║');
  console.info('║         Powered by AgenticFlow + RuVector | TV5 Hackathon                 ║');
  console.info('║                                                                           ║');
  console.info('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.info('\n');

  // Initialize services
  const catalog = getContentCatalog();
  const userService = getUserProfileService();
  const vectorStore = getVectorStore();
  const orchestrator = getSwarmOrchestrator();

  console.info('📊 Initializing VibeCast Pro...\n');

  // Index content for semantic search
  console.info('🧠 Building semantic vector index...');
  vectorStore.indexAll(catalog.getAll());
  console.info(`   ✓ Indexed ${vectorStore.size()} content items\n`);

  // Show agent swarm
  console.info('🤖 Agent Swarm Status:');
  const agentStates = orchestrator.getAgentStates();
  agentStates.forEach(agent => {
    console.info(`   • ${agent.name} [${agent.status}]`);
  });
  console.info('');

  // Create demo user
  const user = userService.create('Alex', 'alex@vibecast.ai');
  userService.updatePreferences(user.id, {
    favoriteGenres: ['sci-fi', 'thriller', 'documentary'],
    preferredMoods: ['thought-provoking', 'exciting'],
    subscribedPlatforms: ['netflix', 'amazon-prime', 'hbo-max'],
    minimumRating: 7.5
  });
  console.info(`👤 Created user: ${user.name}\n`);

  // Run orchestrated discovery
  console.info('═'.repeat(75));
  console.info('\n🎯 MULTI-AGENT DISCOVERY\n');
  console.info('Query: "I want something mind-bending and exciting, not too long"\n');

  runOrchestration(user.id);
}

async function runOrchestration(userId: string): Promise<void> {
  const discovery = getConversationalDiscovery();
  const orchestrator = getSwarmOrchestrator();

  try {
    const result = await orchestrator.orchestrate({
      userId,
      sessionId: 'demo-session',
      query: 'I want something mind-bending and exciting, not too long',
      preferences: {
        maxDuration: 120
      },
      constraints: {
        excludeWatched: true
      },
      signals: {
        timeOfDay: 'evening',
        dayOfWeek: 'weekend'
      }
    }, 5);

    console.info(`⚡ Orchestration complete in ${result.totalProcessingTime}ms\n`);

    // Show agent contributions
    console.info('📈 Agent Contributions:');
    for (const [agent, contribution] of result.agentContributions) {
      const bar = '█'.repeat(Math.round(contribution * 20));
      const spaces = ' '.repeat(20 - Math.round(contribution * 20));
      console.info(`   ${agent.padEnd(20)} [${bar}${spaces}] ${(contribution * 100).toFixed(1)}%`);
    }
    console.info('');

    // Show recommendations
    console.info('🎬 TOP RECOMMENDATIONS:\n');
    result.recommendations.forEach((rec, index) => {
      const emoji = rec.consensusLevel === 'strong' ? '🌟' : (rec.consensusLevel === 'moderate' ? '⭐' : '•');
      console.info(`${emoji} ${index + 1}. "${rec.title}"`);
      console.info(`   Score: ${(rec.finalScore * 100).toFixed(1)}% | Consensus: ${rec.consensusLevel}`);
      console.info(`   Reasons: ${rec.reasons.slice(0, 2).join('; ')}`);
      console.info(`   Sources: ${rec.sources.join(', ')}`);
      console.info('');
    });

    // Explain top pick
    if (result.recommendations.length > 0) {
      console.info('═'.repeat(75));
      console.info('\n📋 DETAILED EXPLANATION FOR TOP PICK:\n');
      console.info(orchestrator.explainRecommendation(result.recommendations[0]));
    }

    // Conversational demo
    console.info('\n' + '═'.repeat(75));
    console.info('\n💬 CONVERSATIONAL DISCOVERY DEMO:\n');

    const response = await discovery.quickDiscover(
      userId,
      'Something funny to watch with friends tonight'
    );

    console.info(response.message);
    console.info('\n🤔 Follow-up suggestions:');
    response.followUpQuestions.forEach(q => {
      console.info(`   • ${q}`);
    });

    console.info('\n' + '═'.repeat(75));
    console.info('\n✨ VibeCast Pro Demo Complete!');
    console.info('   No more 45-minute decision paralysis.');
    console.info('   Just ask, and we\'ll find your perfect watch.\n');

  } catch (error) {
    console.error('Demo error:', error);
  }
}

// Run demo if executed directly
if (require.main === module) {
  runProDemo();
}
