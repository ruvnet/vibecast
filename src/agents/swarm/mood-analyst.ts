/**
 * VibeCast Pro - Mood Analyst Agent
 *
 * Analyzes user's current mood from natural language and context.
 * Uses semantic understanding to map queries to mood categories.
 */

import {
  BaseAgent,
  DiscoveryContext,
  AgentResult,
  ContentRecommendation
} from './base-agent';
import { getContentCatalog } from '../../services/content-catalog';
import { getVectorStore, generateQueryEmbedding, cosineSimilarity, generateMoodEmbedding } from '../../embeddings/vector-store';
import type { Mood } from '../../types';

/**
 * Mood analysis result
 */
interface MoodAnalysis {
  primaryMood: Mood;
  secondaryMoods: Mood[];
  confidence: number;
  indicators: string[];
}

/**
 * Mood Analyst Agent - Specializes in understanding user mood
 */
export class MoodAnalystAgent extends BaseAgent {
  private static readonly MOODS: Mood[] = [
    'relaxing', 'exciting', 'thought-provoking', 'heartwarming',
    'suspenseful', 'funny', 'scary', 'inspiring', 'nostalgic', 'adventurous'
  ];

  constructor() {
    super('mood-analyst', 'Mood Analyst');
  }

  getDescription(): string {
    return 'Analyzes user mood from natural language queries and contextual signals to understand emotional preferences.';
  }

  /**
   * Analyze mood from context
   */
  analyzeMood(context: DiscoveryContext): MoodAnalysis {
    const indicators: string[] = [];
    const moodScores: Map<Mood, number> = new Map();

    // Initialize scores
    for (const mood of MoodAnalystAgent.MOODS) {
      moodScores.set(mood, 0);
    }

    // Analyze query if present
    if (context.query) {
      const queryLower = context.query.toLowerCase();
      const queryEmbedding = generateQueryEmbedding(context.query);

      // Compare to each mood's embedding
      for (const mood of MoodAnalystAgent.MOODS) {
        const moodEmbedding = generateMoodEmbedding(mood);
        const similarity = cosineSimilarity(queryEmbedding, moodEmbedding);
        moodScores.set(mood, (moodScores.get(mood) || 0) + similarity);
      }

      // Direct keyword detection
      const moodKeywords: Record<Mood, string[]> = {
        'relaxing': ['relax', 'chill', 'calm', 'easy', 'peaceful', 'unwind', 'cozy'],
        'exciting': ['exciting', 'thrilling', 'action', 'intense', 'adrenaline', 'fast'],
        'thought-provoking': ['think', 'deep', 'meaningful', 'philosophical', 'profound', 'cerebral'],
        'heartwarming': ['warm', 'sweet', 'touching', 'feel-good', 'wholesome', 'uplifting'],
        'suspenseful': ['suspense', 'tense', 'edge of seat', 'gripping', 'nail-biting'],
        'funny': ['funny', 'laugh', 'comedy', 'hilarious', 'humor', 'silly'],
        'scary': ['scary', 'horror', 'frightening', 'creepy', 'terrifying', 'spooky'],
        'inspiring': ['inspiring', 'motivating', 'uplifting', 'empowering', 'triumphant'],
        'nostalgic': ['nostalgic', 'classic', 'retro', 'throwback', 'remember'],
        'adventurous': ['adventure', 'explore', 'journey', 'quest', 'epic']
      };

      for (const [mood, keywords] of Object.entries(moodKeywords)) {
        for (const keyword of keywords) {
          if (queryLower.includes(keyword)) {
            moodScores.set(mood as Mood, (moodScores.get(mood as Mood) || 0) + 0.5);
            indicators.push(`Query contains "${keyword}" → ${mood}`);
          }
        }
      }
    }

    // Consider explicit mood if provided
    if (context.mood) {
      const explicitMood = context.mood as Mood;
      if (MoodAnalystAgent.MOODS.includes(explicitMood)) {
        moodScores.set(explicitMood, (moodScores.get(explicitMood) || 0) + 2.0);
        indicators.push(`Explicit mood specified: ${explicitMood}`);
      }
    }

    // Consider time of day signals
    if (context.signals?.timeOfDay) {
      switch (context.signals.timeOfDay) {
        case 'morning':
          moodScores.set('inspiring', (moodScores.get('inspiring') || 0) + 0.2);
          indicators.push('Morning → slight preference for inspiring');
          break;
        case 'evening':
          moodScores.set('relaxing', (moodScores.get('relaxing') || 0) + 0.2);
          indicators.push('Evening → slight preference for relaxing');
          break;
        case 'night':
          moodScores.set('scary', (moodScores.get('scary') || 0) + 0.1);
          moodScores.set('suspenseful', (moodScores.get('suspenseful') || 0) + 0.1);
          indicators.push('Night → slight preference for scary/suspenseful');
          break;
      }
    }

    // Consider social context
    if (context.signals?.socialContext) {
      switch (context.signals.socialContext) {
        case 'family':
          moodScores.set('heartwarming', (moodScores.get('heartwarming') || 0) + 0.3);
          moodScores.set('funny', (moodScores.get('funny') || 0) + 0.2);
          moodScores.set('scary', (moodScores.get('scary') || 0) - 0.3);
          indicators.push('Family viewing → heartwarming/funny preferred');
          break;
        case 'couple':
          moodScores.set('heartwarming', (moodScores.get('heartwarming') || 0) + 0.3);
          indicators.push('Couple viewing → romantic/heartwarming preferred');
          break;
        case 'friends':
          moodScores.set('funny', (moodScores.get('funny') || 0) + 0.2);
          moodScores.set('exciting', (moodScores.get('exciting') || 0) + 0.2);
          indicators.push('Friends viewing → funny/exciting preferred');
          break;
      }
    }

    // Sort moods by score
    const sortedMoods = Array.from(moodScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const primaryMood = sortedMoods[0][0];
    const primaryScore = sortedMoods[0][1];
    const secondaryMoods = sortedMoods
      .slice(1, 3)
      .filter(([_, score]) => score > 0)
      .map(([mood]) => mood);

    // Calculate confidence based on score differential
    const maxScore = Math.max(...Array.from(moodScores.values()));
    const avgScore = Array.from(moodScores.values()).reduce((a, b) => a + b, 0) / moodScores.size;
    const confidence = maxScore > 0 ? Math.min(1, (maxScore - avgScore) / maxScore + 0.3) : 0.5;

    return {
      primaryMood,
      secondaryMoods,
      confidence,
      indicators
    };
  }

  async process(context: DiscoveryContext): Promise<AgentResult<ContentRecommendation[]>> {
    const startTime = Date.now();
    this.updateState({ status: 'processing' });

    try {
      // Analyze mood
      const moodAnalysis = this.analyzeMood(context);

      // Get content matching the mood
      const vectorStore = getVectorStore();
      const catalog = getContentCatalog();

      // Initialize vector store if empty
      if (vectorStore.size() === 0) {
        vectorStore.indexAll(catalog.getAll());
      }

      // Search by primary mood
      const searchResults = vectorStore.searchByMood(moodAnalysis.primaryMood, 10);

      // Convert to recommendations
      const recommendations: ContentRecommendation[] = searchResults.map(result => {
        const content = catalog.getById(result.vector.contentId);
        return {
          contentId: result.vector.contentId,
          title: content?.title || result.vector.metadata.title,
          score: result.similarity * moodAnalysis.confidence,
          reasons: [
            `Matches your ${moodAnalysis.primaryMood} mood`,
            ...moodAnalysis.indicators.slice(0, 2)
          ],
          source: this.state.name
        };
      });

      this.recordSuccess();

      return this.createResult(
        recommendations,
        moodAnalysis.confidence,
        [
          `Identified primary mood: ${moodAnalysis.primaryMood}`,
          `Secondary moods: ${moodAnalysis.secondaryMoods.join(', ') || 'none'}`,
          ...moodAnalysis.indicators
        ],
        startTime
      );
    } catch (error) {
      this.recordError();
      throw error;
    }
  }
}
