import type {
  ContentItem,
  Recommendation,
  RecommendationRequest,
  UserProfile
} from '../types';
import { getContentCatalog } from '../services/content-catalog';
import { getUserProfileService } from '../services/user-profile';
import {
  calculatePreferenceScore,
  calculateMoodScore,
  generateRecommendationReasons,
  getMatchedPreferences
} from '../utils/scoring';

/**
 * Agent state for tracking recommendation sessions
 */
export interface AgentState {
  userId: string;
  sessionId: string;
  requestCount: number;
  lastRequest?: RecommendationRequest;
  lastRecommendations: string[];
}

/**
 * VibeCast Recommendation Agent
 *
 * An AI agent that solves the "45-minute decision problem" by providing
 * personalized entertainment recommendations based on user preferences,
 * mood, and available time.
 */
export class RecommendationAgent {
  private state: AgentState;
  private catalog = getContentCatalog();
  private userService = getUserProfileService();

  constructor(userId: string, sessionId: string) {
    this.state = {
      userId,
      sessionId,
      requestCount: 0,
      lastRecommendations: []
    };
  }

  /**
   * Get the current agent state
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Get recommendations based on request parameters
   */
  getRecommendations(request: RecommendationRequest): Recommendation[] {
    this.state.requestCount++;
    this.state.lastRequest = request;

    const profile = this.userService.getById(this.state.userId);
    if (!profile) {
      throw new Error(`User profile not found: ${this.state.userId}`);
    }

    // Get candidate content
    let candidates = this.catalog.search({
      genres: request.genres,
      platforms: request.platforms ?? profile.preferences.subscribedPlatforms,
      moods: request.mood ? [request.mood] : undefined,
      maxDuration: request.maxDuration
    });

    // Filter out watched content if requested
    if (request.excludeWatched) {
      candidates = candidates.filter(
        c => !this.userService.hasWatched(this.state.userId, c.id)
      );
    }

    // Filter out recently recommended content
    candidates = candidates.filter(
      c => !this.state.lastRecommendations.includes(c.id)
    );

    // Score and rank candidates
    const scored = candidates.map(content => ({
      content,
      score: this.calculateScore(content, profile, request)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top N
    const topCandidates = scored.slice(0, request.limit);

    // Build recommendations
    const recommendations = topCandidates.map(({ content, score }) =>
      this.buildRecommendation(content, score, profile, request)
    );

    // Update state
    this.state.lastRecommendations = recommendations.map(r => r.content.id);

    return recommendations;
  }

  /**
   * Calculate overall score for a content item
   */
  private calculateScore(
    content: ContentItem,
    profile: UserProfile,
    request: RecommendationRequest
  ): number {
    const preferenceScore = calculatePreferenceScore(
      content,
      profile.preferences
    );

    const moodScore = request.mood
      ? calculateMoodScore(content, request.mood)
      : 0.5;

    // Weighted combination
    const weights = {
      preference: 0.6,
      mood: 0.3,
      recency: 0.1
    };

    // Recency bonus (newer content gets slight boost)
    const currentYear = new Date().getFullYear();
    const recencyScore = Math.min(
      1,
      (content.releaseYear - 2010) / (currentYear - 2010)
    );

    return (
      weights.preference * preferenceScore +
      weights.mood * moodScore +
      weights.recency * recencyScore
    );
  }

  /**
   * Build a recommendation object from scored content
   */
  private buildRecommendation(
    content: ContentItem,
    score: number,
    profile: UserProfile,
    request: RecommendationRequest
  ): Recommendation {
    return {
      content,
      score,
      reasons: generateRecommendationReasons(
        content,
        profile.preferences,
        request.mood
      ),
      matchedPreferences: getMatchedPreferences(content, profile.preferences)
    };
  }

  /**
   * Get a quick recommendation based on current mood
   */
  quickPick(mood: string): Recommendation | null {
    const validMoods = [
      'relaxing', 'exciting', 'thought-provoking', 'heartwarming',
      'suspenseful', 'funny', 'scary', 'inspiring', 'nostalgic', 'adventurous'
    ];

    if (!validMoods.includes(mood)) {
      throw new Error(`Invalid mood: ${mood}. Valid moods: ${validMoods.join(', ')}`);
    }

    const recommendations = this.getRecommendations({
      mood: mood as RecommendationRequest['mood'],
      limit: 1,
      excludeWatched: true
    });

    return recommendations[0] ?? null;
  }

  /**
   * Reset the agent state for a new session
   */
  reset(): void {
    this.state = {
      userId: this.state.userId,
      sessionId: this.state.sessionId,
      requestCount: 0,
      lastRecommendations: []
    };
  }
}

/**
 * Factory function to create a recommendation agent
 */
export function createRecommendationAgent(
  userId: string,
  sessionId?: string
): RecommendationAgent {
  const sid = sessionId ?? `session-${Date.now()}`;
  return new RecommendationAgent(userId, sid);
}
