/**
 * VibeCast Pro - Trend Spotter Agent
 *
 * Identifies trending content and cultural moments.
 * Considers social signals and zeitgeist for recommendations.
 */

import {
  BaseAgent,
  DiscoveryContext,
  AgentResult,
  ContentRecommendation
} from './base-agent';
import { getContentCatalog } from '../../services/content-catalog';
import type { ContentItem } from '../../types';

/**
 * Trend data for content
 */
interface TrendData {
  contentId: string;
  trendScore: number;
  trendType: 'viral' | 'rising' | 'steady' | 'classic';
  reasons: string[];
}

/**
 * Trend Spotter Agent - Cultural relevance expert
 */
export class TrendSpotterAgent extends BaseAgent {
  constructor() {
    super('trend-spotter', 'Trend Spotter');
  }

  getDescription(): string {
    return 'Identifies trending content and cultural moments, considering what\'s popular and conversation-worthy right now.';
  }

  /**
   * Calculate trend score for content
   */
  private calculateTrendScore(content: ContentItem, context: DiscoveryContext): TrendData {
    let score = 0;
    const reasons: string[] = [];

    // Recency boost (newer content trends more)
    const currentYear = new Date().getFullYear();
    const yearsOld = currentYear - content.releaseYear;

    if (yearsOld === 0) {
      score += 0.4;
      reasons.push('New release - high cultural relevance');
    } else if (yearsOld === 1) {
      score += 0.3;
      reasons.push('Recent release - still trending');
    } else if (yearsOld <= 3) {
      score += 0.2;
      reasons.push('Modern content');
    }

    // High rating boost (quality content trends more)
    if (content.rating >= 8.5) {
      score += 0.3;
      reasons.push('Critically acclaimed');
    } else if (content.rating >= 8.0) {
      score += 0.2;
      reasons.push('Highly rated');
    }

    // Genre trends (simulate current cultural moments)
    const trendingGenres = this.getCurrentTrendingGenres();
    const matchingTrends = content.genres.filter(g => trendingGenres.includes(g));
    if (matchingTrends.length > 0) {
      score += 0.2 * matchingTrends.length;
      reasons.push(`Trending genre: ${matchingTrends.join(', ')}`);
    }

    // Time-based contextual trends
    if (context.signals?.dayOfWeek === 'weekend') {
      if (content.type === 'movie') {
        score += 0.1;
        reasons.push('Movies trend on weekends');
      }
    }

    // Determine trend type
    let trendType: TrendData['trendType'];
    if (score >= 0.7) {
      trendType = 'viral';
    } else if (score >= 0.5) {
      trendType = 'rising';
    } else if (yearsOld > 5 && content.rating >= 8.0) {
      trendType = 'classic';
      score += 0.1;
      reasons.push('Enduring classic');
    } else {
      trendType = 'steady';
    }

    return {
      contentId: content.id,
      trendScore: Math.min(1, score),
      trendType,
      reasons
    };
  }

  /**
   * Get currently trending genres (simulated)
   */
  private getCurrentTrendingGenres(): string[] {
    // In production, this would pull from real trend data
    const hour = new Date().getHours();
    const day = new Date().getDay();

    // Simulate different trends based on time
    if (day === 0 || day === 6) {
      // Weekend trends
      return ['action', 'adventure', 'comedy', 'family'];
    } else if (hour >= 20 || hour < 6) {
      // Night trends
      return ['thriller', 'horror', 'mystery', 'drama'];
    } else {
      // Day trends
      return ['documentary', 'drama', 'comedy'];
    }
  }

  async process(context: DiscoveryContext): Promise<AgentResult<ContentRecommendation[]>> {
    const startTime = Date.now();
    this.updateState({ status: 'processing' });

    try {
      const catalog = getContentCatalog();
      const allContent = catalog.getAll();

      // Calculate trend scores for all content
      const trendData = allContent.map(content =>
        this.calculateTrendScore(content, context)
      );

      // Sort by trend score
      trendData.sort((a, b) => b.trendScore - a.trendScore);

      // Take top trending
      const topTrending = trendData.slice(0, 10);

      // Calculate confidence based on trend distribution
      const avgTrendScore = topTrending.reduce((sum, t) => sum + t.trendScore, 0) / topTrending.length;

      const reasoning = [
        `Analyzed ${allContent.length} items for cultural relevance`,
        `Current trending genres: ${this.getCurrentTrendingGenres().join(', ')}`,
        `Top trend score: ${(topTrending[0]?.trendScore * 100 || 0).toFixed(0)}%`
      ];

      // Convert to recommendations
      const recommendations: ContentRecommendation[] = topTrending.map(trend => {
        const content = catalog.getById(trend.contentId);
        return {
          contentId: trend.contentId,
          title: content?.title || 'Unknown',
          score: trend.trendScore,
          reasons: [
            `Trend type: ${trend.trendType}`,
            ...trend.reasons.slice(0, 2)
          ],
          source: this.state.name
        };
      });

      this.recordSuccess();

      return this.createResult(
        recommendations,
        avgTrendScore,
        reasoning,
        startTime
      );
    } catch (error) {
      this.recordError();
      throw error;
    }
  }
}
