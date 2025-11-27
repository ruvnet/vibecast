import {
  SwarmOrchestrator,
  getSwarmOrchestrator,
  resetSwarmOrchestrator
} from './orchestrator';
import { getUserProfileService, resetUserProfileService } from '../../services/user-profile';
import { resetContentCatalog, getContentCatalog } from '../../services/content-catalog';
import { resetVectorStore, getVectorStore } from '../../embeddings/vector-store';
import type { DiscoveryContext } from './base-agent';

describe('SwarmOrchestrator', () => {
  let userId: string;

  beforeEach(() => {
    resetSwarmOrchestrator();
    resetUserProfileService();
    resetContentCatalog();
    resetVectorStore();

    // Create test user
    const userService = getUserProfileService();
    const user = userService.create('Test User');
    userId = user.id;

    // Set up preferences
    userService.updatePreferences(userId, {
      favoriteGenres: ['action', 'sci-fi'],
      preferredMoods: ['exciting'],
      subscribedPlatforms: ['netflix'],
      minimumRating: 7.0
    });

    // Index content
    const vectorStore = getVectorStore();
    const catalog = getContentCatalog();
    vectorStore.indexAll(catalog.getAll());
  });

  describe('constructor', () => {
    it('should initialize with default weights', () => {
      const orchestrator = new SwarmOrchestrator();
      const states = orchestrator.getAgentStates();

      expect(states).toHaveLength(4);
      expect(states.map(s => s.name)).toContain('Mood Analyst');
      expect(states.map(s => s.name)).toContain('Semantic Curator');
      expect(states.map(s => s.name)).toContain('Trend Spotter');
      expect(states.map(s => s.name)).toContain('Personalization Expert');
    });

    it('should accept custom weights', () => {
      const orchestrator = new SwarmOrchestrator({
        moodAnalyst: 0.5,
        semanticCurator: 0.5
      });

      // Should not throw
      expect(orchestrator).toBeDefined();
    });
  });

  describe('getAgentStates', () => {
    it('should return all agent states', () => {
      const orchestrator = new SwarmOrchestrator();
      const states = orchestrator.getAgentStates();

      expect(states).toHaveLength(4);
      states.forEach(state => {
        expect(state.id).toBeDefined();
        expect(state.name).toBeDefined();
        expect(state.status).toBe('idle');
      });
    });
  });

  describe('orchestrate', () => {
    it('should return aggregated recommendations', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        query: 'exciting action movie',
        constraints: {
          excludeWatched: true
        }
      };

      const result = await orchestrator.orchestrate(context, 5);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.orchestrationStrategy).toBeDefined();
    });

    it('should include agent contributions', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        mood: 'exciting'
      };

      const result = await orchestrator.orchestrate(context, 5);

      expect(result.agentContributions.size).toBeGreaterThan(0);
    });

    it('should aggregate scores from multiple agents', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        query: 'something exciting',
        mood: 'exciting'
      };

      const result = await orchestrator.orchestrate(context, 5);

      if (result.recommendations.length > 0) {
        const topRec = result.recommendations[0];
        expect(topRec.agentScores.size).toBeGreaterThan(0);
        expect(topRec.consensusLevel).toBeDefined();
      }
    });

    it('should handle mood-based discovery', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        mood: 'funny'
      };

      const result = await orchestrator.orchestrate(context, 5);

      expect(result.recommendations).toBeDefined();
    });

    it('should include reasons in recommendations', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        query: 'thriller'
      };

      const result = await orchestrator.orchestrate(context, 5);

      if (result.recommendations.length > 0) {
        expect(result.recommendations[0].reasons.length).toBeGreaterThan(0);
      }
    });
  });

  describe('quickRecommend', () => {
    it('should return single recommendation', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        mood: 'exciting'
      };

      const recommendation = await orchestrator.quickRecommend(context);

      if (recommendation) {
        expect(recommendation.contentId).toBeDefined();
        expect(recommendation.title).toBeDefined();
        expect(recommendation.finalScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('explainRecommendation', () => {
    it('should generate explanation string', async () => {
      const orchestrator = new SwarmOrchestrator();

      const context: DiscoveryContext = {
        userId,
        sessionId: 'test-session',
        mood: 'exciting'
      };

      const result = await orchestrator.orchestrate(context, 1);

      if (result.recommendations.length > 0) {
        const explanation = orchestrator.explainRecommendation(result.recommendations[0]);

        expect(explanation).toContain('Consensus');
        expect(explanation).toContain('Score');
        expect(explanation).toContain('Why this pick');
      }
    });
  });
});

describe('getSwarmOrchestrator', () => {
  beforeEach(() => {
    resetSwarmOrchestrator();
  });

  it('should return singleton instance', () => {
    const orch1 = getSwarmOrchestrator();
    const orch2 = getSwarmOrchestrator();

    expect(orch1).toBe(orch2);
  });
});
