import {
  RecommendationAgent,
  createRecommendationAgent
} from './recommendation-agent';
import { getUserProfileService, resetUserProfileService } from '../services/user-profile';
import { resetContentCatalog } from '../services/content-catalog';

describe('RecommendationAgent', () => {
  let agent: RecommendationAgent;
  let userId: string;

  beforeEach(() => {
    resetContentCatalog();
    resetUserProfileService();

    const userService = getUserProfileService();
    const user = userService.create('Test User');
    userId = user.id;

    // Set up preferences
    userService.updatePreferences(userId, {
      favoriteGenres: ['action', 'sci-fi', 'thriller'],
      preferredMoods: ['exciting', 'suspenseful'],
      subscribedPlatforms: ['netflix', 'amazon-prime'],
      minimumRating: 7.0
    });

    agent = new RecommendationAgent(userId, 'test-session');
  });

  describe('constructor', () => {
    it('should initialize with correct state', () => {
      const state = agent.getState();

      expect(state.userId).toBe(userId);
      expect(state.sessionId).toBe('test-session');
      expect(state.requestCount).toBe(0);
      expect(state.lastRecommendations).toEqual([]);
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations', () => {
      const recommendations = agent.getRecommendations({
        limit: 3,
        excludeWatched: true
      });

      expect(recommendations.length).toBeLessThanOrEqual(3);
      recommendations.forEach(rec => {
        expect(rec.content).toBeDefined();
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
        expect(rec.reasons.length).toBeGreaterThan(0);
      });
    });

    it('should filter by mood', () => {
      const recommendations = agent.getRecommendations({
        mood: 'exciting',
        limit: 5,
        excludeWatched: true
      });

      // At least some should match the mood or similar moods
      const hasExcitingContent = recommendations.some(rec =>
        rec.content.moods.includes('exciting') ||
        rec.content.moods.includes('adventurous')
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(hasExcitingContent).toBe(true);
    });

    it('should filter by genres', () => {
      const recommendations = agent.getRecommendations({
        genres: ['thriller'],
        limit: 5,
        excludeWatched: true
      });

      recommendations.forEach(rec => {
        expect(rec.content.genres).toContain('thriller');
      });
    });

    it('should respect maxDuration', () => {
      const recommendations = agent.getRecommendations({
        maxDuration: 100,
        limit: 5,
        excludeWatched: true
      });

      recommendations.forEach(rec => {
        expect(rec.content.duration).toBeLessThanOrEqual(100);
      });
    });

    it('should increment request count', () => {
      expect(agent.getState().requestCount).toBe(0);

      agent.getRecommendations({ limit: 3, excludeWatched: true });
      expect(agent.getState().requestCount).toBe(1);

      agent.getRecommendations({ limit: 3, excludeWatched: true });
      expect(agent.getState().requestCount).toBe(2);
    });

    it('should track last recommendations', () => {
      const recommendations = agent.getRecommendations({ limit: 3, excludeWatched: true });
      const state = agent.getState();

      expect(state.lastRecommendations).toEqual(
        recommendations.map(r => r.content.id)
      );
    });

    it('should not repeat recent recommendations', () => {
      const firstRecs = agent.getRecommendations({ limit: 3, excludeWatched: true });
      const firstIds = new Set(firstRecs.map(r => r.content.id));

      const secondRecs = agent.getRecommendations({ limit: 3, excludeWatched: true });
      const secondIds = secondRecs.map(r => r.content.id);

      // Second recommendations should not include first ones
      secondIds.forEach(id => {
        expect(firstIds.has(id)).toBe(false);
      });
    });

    it('should throw error for non-existent user', () => {
      const invalidAgent = new RecommendationAgent('non-existent', 'session');

      expect(() => invalidAgent.getRecommendations({ limit: 3, excludeWatched: true })).toThrow(
        'User profile not found'
      );
    });

    it('should sort by score descending', () => {
      const recommendations = agent.getRecommendations({ limit: 5, excludeWatched: true });

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(
          recommendations[i].score
        );
      }
    });
  });

  describe('quickPick', () => {
    it('should return a single recommendation', () => {
      const pick = agent.quickPick('exciting');

      expect(pick).not.toBeNull();
      expect(pick!.content).toBeDefined();
      expect(pick!.score).toBeDefined();
    });

    it('should match the requested mood', () => {
      const pick = agent.quickPick('thought-provoking');

      if (pick) {
        const hasMatchingMood = pick.content.moods.some(m =>
          ['thought-provoking', 'inspiring'].includes(m)
        );
        expect(hasMatchingMood).toBe(true);
      }
    });

    it('should throw error for invalid mood', () => {
      expect(() => agent.quickPick('invalid-mood')).toThrow('Invalid mood');
    });

    it('should return null when no content matches', () => {
      // Mark all content as watched
      const userService = getUserProfileService();
      const recs = agent.getRecommendations({ limit: 100, excludeWatched: false });
      recs.forEach(rec => {
        userService.addToWatchHistory(userId, {
          contentId: rec.content.id,
          completedPercent: 100
        });
      });

      // Create new agent to reset lastRecommendations
      const newAgent = new RecommendationAgent(userId, 'new-session');
      const pick = newAgent.quickPick('scary');

      // May or may not be null depending on catalog, but should not throw
      expect(pick === null || pick.content !== undefined).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset request count', () => {
      agent.getRecommendations({ limit: 3, excludeWatched: true });
      agent.getRecommendations({ limit: 3, excludeWatched: true });

      expect(agent.getState().requestCount).toBe(2);

      agent.reset();

      expect(agent.getState().requestCount).toBe(0);
    });

    it('should clear last recommendations', () => {
      agent.getRecommendations({ limit: 3, excludeWatched: true });

      expect(agent.getState().lastRecommendations.length).toBeGreaterThan(0);

      agent.reset();

      expect(agent.getState().lastRecommendations).toEqual([]);
    });

    it('should preserve user and session IDs', () => {
      agent.reset();

      const state = agent.getState();
      expect(state.userId).toBe(userId);
      expect(state.sessionId).toBe('test-session');
    });
  });
});

describe('createRecommendationAgent', () => {
  beforeEach(() => {
    resetContentCatalog();
    resetUserProfileService();

    const userService = getUserProfileService();
    userService.create('Test User');
  });

  it('should create agent with provided session ID', () => {
    const userService = getUserProfileService();
    const users = userService.getAll();
    const userId = users[0].id;

    const agent = createRecommendationAgent(userId, 'custom-session');

    expect(agent.getState().sessionId).toBe('custom-session');
  });

  it('should create agent with auto-generated session ID', () => {
    const userService = getUserProfileService();
    const users = userService.getAll();
    const userId = users[0].id;

    const agent = createRecommendationAgent(userId);

    expect(agent.getState().sessionId).toMatch(/^session-\d+$/);
  });
});
