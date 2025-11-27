/**
 * VibeCast Pro - Personalization Agent
 *
 * Deep personalization based on user preferences and watch history.
 * Learns and adapts to individual taste patterns.
 */

import {
  BaseAgent,
  DiscoveryContext,
  AgentResult,
  ContentRecommendation
} from './base-agent';
import { getContentCatalog } from '../../services/content-catalog';
import { getUserProfileService } from '../../services/user-profile';
import { calculatePreferenceScore, getMatchedPreferences } from '../../utils/scoring';
import type { ContentItem, UserProfile } from '../../types';

/**
 * Personalization insights
 */
interface PersonalizationInsights {
  topGenres: string[];
  avoidGenres: string[];
  preferredDuration: 'short' | 'medium' | 'long' | 'any';
  qualityThreshold: number;
  platformPreference: string[];
}

/**
 * Personalization Agent - Individual taste expert
 */
export class PersonalizationAgent extends BaseAgent {
  constructor() {
    super('personalization', 'Personalization Expert');
  }

  getDescription(): string {
    return 'Provides deeply personalized recommendations based on user preferences, watch history, and learned taste patterns.';
  }

  /**
   * Analyze user profile for insights
   */
  private analyzeProfile(profile: UserProfile): PersonalizationInsights {
    const prefs = profile.preferences;

    // Determine duration preference
    let preferredDuration: PersonalizationInsights['preferredDuration'] = 'any';
    if (prefs.maxContentDuration) {
      if (prefs.maxContentDuration <= 60) {
        preferredDuration = 'short';
      } else if (prefs.maxContentDuration <= 120) {
        preferredDuration = 'medium';
      } else {
        preferredDuration = 'long';
      }
    }

    return {
      topGenres: prefs.favoriteGenres.slice(0, 5),
      avoidGenres: prefs.dislikedGenres,
      preferredDuration,
      qualityThreshold: prefs.minimumRating,
      platformPreference: prefs.subscribedPlatforms
    };
  }

  /**
   * Calculate personalization score
   */
  private calculatePersonalizationScore(
    content: ContentItem,
    profile: UserProfile,
    insights: PersonalizationInsights
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = calculatePreferenceScore(content, profile.preferences);

    // Boost for matching top genres
    const matchingGenres = content.genres.filter(g =>
      insights.topGenres.includes(g)
    );
    if (matchingGenres.length > 0) {
      score += 0.1 * matchingGenres.length;
      reasons.push(`Matches your favorite: ${matchingGenres.join(', ')}`);
    }

    // Penalty for avoided genres
    const avoidedGenres = content.genres.filter(g =>
      insights.avoidGenres.includes(g)
    );
    if (avoidedGenres.length > 0) {
      score -= 0.3;
      reasons.push(`Contains disliked: ${avoidedGenres.join(', ')}`);
    }

    // Platform availability boost
    const availablePlatforms = content.platforms.filter(p =>
      insights.platformPreference.includes(p)
    );
    if (availablePlatforms.length > 0) {
      score += 0.1;
      reasons.push(`Available on: ${availablePlatforms.join(', ')}`);
    } else if (insights.platformPreference.length > 0) {
      score -= 0.2;
      reasons.push('Not on your subscribed platforms');
    }

    // Quality threshold
    if (content.rating >= insights.qualityThreshold) {
      reasons.push(`Rating ${content.rating}/10 meets your standards`);
    }

    // Watch history check
    const userService = getUserProfileService();
    if (userService.hasWatched(profile.id, content.id)) {
      score = 0;
      reasons.push('Already watched');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      reasons
    };
  }

  async process(context: DiscoveryContext): Promise<AgentResult<ContentRecommendation[]>> {
    const startTime = Date.now();
    this.updateState({ status: 'processing' });

    try {
      const catalog = getContentCatalog();
      const userService = getUserProfileService();
      const profile = userService.getById(context.userId);

      if (!profile) {
        this.recordError();
        return this.createResult(
          [],
          0,
          ['User profile not found'],
          startTime
        );
      }

      const insights = this.analyzeProfile(profile);
      const allContent = catalog.getAll();

      // Score all content
      const scoredContent = allContent.map(content => ({
        content,
        ...this.calculatePersonalizationScore(content, profile, insights)
      }));

      // Filter out watched if requested
      let filteredContent = scoredContent;
      if (context.constraints?.excludeWatched) {
        filteredContent = scoredContent.filter(item =>
          !userService.hasWatched(profile.id, item.content.id)
        );
      }

      // Apply additional constraints
      if (context.constraints?.excludeIds) {
        filteredContent = filteredContent.filter(item =>
          !context.constraints!.excludeIds!.includes(item.content.id)
        );
      }

      if (context.preferences?.maxDuration) {
        filteredContent = filteredContent.filter(item =>
          item.content.duration <= context.preferences!.maxDuration!
        );
      }

      // Sort by score
      filteredContent.sort((a, b) => b.score - a.score);

      // Take top results
      const topResults = filteredContent.slice(0, 10);

      const reasoning = [
        `Analyzed ${allContent.length} items against your profile`,
        `Top genres: ${insights.topGenres.join(', ') || 'none set'}`,
        `Quality threshold: ${insights.qualityThreshold}+`,
        `Duration preference: ${insights.preferredDuration}`,
        `Platforms: ${insights.platformPreference.join(', ') || 'any'}`
      ];

      // Convert to recommendations
      const recommendations: ContentRecommendation[] = topResults.map(item => ({
        contentId: item.content.id,
        title: item.content.title,
        score: item.score,
        reasons: item.reasons.filter(r => !r.includes('Already watched')),
        source: this.state.name
      }));

      // Calculate confidence based on profile completeness
      const profileCompleteness =
        (insights.topGenres.length > 0 ? 0.3 : 0) +
        (insights.platformPreference.length > 0 ? 0.3 : 0) +
        (profile.watchHistory.length > 0 ? 0.2 : 0) +
        (insights.qualityThreshold > 0 ? 0.2 : 0);

      this.recordSuccess();

      return this.createResult(
        recommendations,
        profileCompleteness,
        reasoning,
        startTime
      );
    } catch (error) {
      this.recordError();
      throw error;
    }
  }
}
