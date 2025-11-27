/**
 * VibeCast - AI-Powered Entertainment Discovery
 *
 * Solving the 45-minute decision problem with intelligent
 * content recommendations powered by agentic AI.
 *
 * Built for the Agentics Foundation TV5 Hackathon
 */

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Export services
export * from './services';

// Export agents
export * from './agents';

// Main entry point demonstration
import { getContentCatalog, getUserProfileService } from './services';
import { createRecommendationAgent } from './agents';

/**
 * Run a demonstration of the VibeCast recommendation system
 */
export function runDemo(): void {
  console.info('🎬 VibeCast - Entertainment Discovery Demo\n');
  console.info('Solving the 45-minute decision problem!\n');
  console.info('='.repeat(50));

  // Initialize services
  const catalog = getContentCatalog();
  const userService = getUserProfileService();

  console.info(`\n📚 Content catalog loaded: ${catalog.count()} items`);

  // Create a demo user
  const user = userService.create('Demo User', 'demo@vibecast.ai');
  console.info(`\n👤 Created user: ${user.name} (${user.id})`);

  // Set user preferences
  userService.updatePreferences(user.id, {
    favoriteGenres: ['sci-fi', 'thriller', 'documentary'],
    preferredMoods: ['thought-provoking', 'exciting'],
    subscribedPlatforms: ['netflix', 'amazon-prime', 'hbo-max'],
    minimumRating: 7.0
  });
  console.info('✅ User preferences updated\n');

  // Create recommendation agent
  const agent = createRecommendationAgent(user.id);
  console.info('🤖 Recommendation agent initialized\n');

  // Get recommendations
  console.info('='.repeat(50));
  console.info('\n🎯 Getting personalized recommendations...\n');

  const recommendations = agent.getRecommendations({
    mood: 'exciting',
    limit: 3,
    excludeWatched: true
  });

  recommendations.forEach((rec, index) => {
    console.info(`\n${index + 1}. ${rec.content.title}`);
    console.info(`   Type: ${rec.content.type} | Rating: ${rec.content.rating}/10`);
    console.info(`   Genres: ${rec.content.genres.join(', ')}`);
    console.info(`   Available on: ${rec.content.platforms.join(', ')}`);
    console.info(`   Match score: ${(rec.score * 100).toFixed(1)}%`);
    console.info(`   Why: ${rec.reasons[0]}`);
  });

  // Quick pick demo
  console.info('\n' + '='.repeat(50));
  console.info('\n⚡ Quick Pick for "thought-provoking" mood:\n');

  const quickPick = agent.quickPick('thought-provoking');
  if (quickPick) {
    console.info(`   "${quickPick.content.title}"`);
    console.info(`   ${quickPick.content.description}`);
  }

  console.info('\n' + '='.repeat(50));
  console.info('\n✨ Demo complete! No more 45-minute decision paralysis.\n');
}

// Run demo if executed directly
if (require.main === module) {
  runDemo();
}
