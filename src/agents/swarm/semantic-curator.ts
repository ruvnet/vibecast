/**
 * VibeCast Pro - Semantic Curator Agent
 *
 * Uses vector embeddings for deep semantic understanding of content.
 * Finds hidden connections between content based on meaning, not just metadata.
 */

import {
  BaseAgent,
  DiscoveryContext,
  AgentResult,
  ContentRecommendation
} from './base-agent';
import { getContentCatalog } from '../../services/content-catalog';
import {
  getVectorStore,
  generateQueryEmbedding,
  cosineSimilarity
} from '../../embeddings/vector-store';

/**
 * Semantic Curator Agent - Deep content understanding
 */
export class SemanticCuratorAgent extends BaseAgent {
  constructor() {
    super('semantic-curator', 'Semantic Curator');
  }

  getDescription(): string {
    return 'Uses vector embeddings to find semantically similar content based on deep understanding of themes, tone, and narrative style.';
  }

  async process(context: DiscoveryContext): Promise<AgentResult<ContentRecommendation[]>> {
    const startTime = Date.now();
    this.updateState({ status: 'processing' });

    try {
      const vectorStore = getVectorStore();
      const catalog = getContentCatalog();

      // Initialize vector store if empty
      if (vectorStore.size() === 0) {
        vectorStore.indexAll(catalog.getAll());
      }

      const reasoning: string[] = [];
      let searchResults;

      if (context.query) {
        // Natural language semantic search
        reasoning.push(`Analyzing semantic meaning of: "${context.query}"`);
        searchResults = vectorStore.searchByQuery(context.query, 10);
        reasoning.push(`Found ${searchResults.length} semantically similar results`);
      } else if (context.mood) {
        // Mood-based semantic search
        reasoning.push(`Searching for content matching ${context.mood} mood`);
        searchResults = vectorStore.searchByMood(context.mood as 'relaxing' | 'exciting' | 'thought-provoking' | 'heartwarming' | 'suspenseful' | 'funny' | 'scary' | 'inspiring' | 'nostalgic' | 'adventurous', 10);
      } else {
        // Default broad search
        const defaultQuery = 'entertaining engaging quality content';
        searchResults = vectorStore.searchByQuery(defaultQuery, 10);
        reasoning.push('Using default quality-focused search');
      }

      // Calculate semantic coherence
      const similarities = searchResults.map(r => r.similarity);
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const coherenceConfidence = Math.min(1, avgSimilarity + 0.2);

      reasoning.push(`Semantic coherence score: ${(avgSimilarity * 100).toFixed(1)}%`);

      // Analyze semantic clusters
      const clusters = this.identifySemanticClusters(searchResults);
      if (clusters.size > 1) {
        reasoning.push(`Identified ${clusters.size} thematic clusters`);
      }

      // Convert to recommendations
      const recommendations: ContentRecommendation[] = searchResults.map((result, index) => {
        const content = catalog.getById(result.vector.contentId);
        const clusterInfo = this.getClusterInfo(result.vector.contentId, clusters);

        return {
          contentId: result.vector.contentId,
          title: content?.title || result.vector.metadata.title,
          score: result.similarity,
          reasons: [
            `Semantic similarity: ${(result.similarity * 100).toFixed(0)}%`,
            clusterInfo ? `Part of "${clusterInfo}" theme` : 'Unique thematic profile',
            content ? `Genres: ${content.genres.slice(0, 2).join(', ')}` : ''
          ].filter(r => r),
          source: this.state.name
        };
      });

      this.recordSuccess();

      return this.createResult(
        recommendations,
        coherenceConfidence,
        reasoning,
        startTime
      );
    } catch (error) {
      this.recordError();
      throw error;
    }
  }

  /**
   * Identify semantic clusters in results
   */
  private identifySemanticClusters(
    results: Array<{ vector: { contentId: string; embedding: number[] }; similarity: number }>
  ): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    const threshold = 0.85;

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const sim = cosineSimilarity(results[i].vector.embedding, results[j].vector.embedding);
        if (sim >= threshold) {
          // Find or create cluster
          let found = false;
          for (const [key, members] of clusters) {
            if (members.includes(results[i].vector.contentId)) {
              members.push(results[j].vector.contentId);
              found = true;
              break;
            }
          }
          if (!found) {
            const clusterName = `cluster-${clusters.size + 1}`;
            clusters.set(clusterName, [results[i].vector.contentId, results[j].vector.contentId]);
          }
        }
      }
    }

    return clusters;
  }

  /**
   * Get cluster info for a content item
   */
  private getClusterInfo(contentId: string, clusters: Map<string, string[]>): string | null {
    for (const [name, members] of clusters) {
      if (members.includes(contentId)) {
        return name;
      }
    }
    return null;
  }
}
