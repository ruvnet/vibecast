/**
 * VibeCast Pro - Vector Store for Semantic Content Matching
 *
 * Uses vector embeddings to enable semantic search across content.
 * Powered by RuVector for the Agentics Foundation TV5 Hackathon.
 */

import type { ContentItem, Mood, Genre } from '../types';

/**
 * Simple vector representation (in production, use actual embeddings)
 */
export interface ContentVector {
  id: string;
  contentId: string;
  embedding: number[];
  metadata: {
    title: string;
    type: string;
    genres: string[];
    moods: string[];
  };
}

/**
 * Semantic dimension weights for content features
 */
const SEMANTIC_DIMENSIONS = {
  // Emotional dimensions
  intensity: 0,      // calm to intense
  valence: 1,        // negative to positive
  energy: 2,         // low to high
  tension: 3,        // relaxed to tense

  // Content dimensions
  complexity: 4,     // simple to complex
  realism: 5,        // fantasy to realistic
  pacing: 6,         // slow to fast
  darkness: 7,       // light to dark

  // Social dimensions
  social: 8,         // solitary to social viewing
  conversation: 9,   // low to high discussion potential

  // Temporal dimensions
  commitment: 10,    // short to long commitment
  serialized: 11,    // standalone to serialized

  // Genre influence (12-19)
  actionScore: 12,
  comedyScore: 13,
  dramaScore: 14,
  horrorScore: 15,
  scifiScore: 16,
  romanceScore: 17,
  thrillerScore: 18,
  documentaryScore: 19
} as const;

const VECTOR_SIZE = 20;

/**
 * Mood to semantic vector mapping
 */
const MOOD_VECTORS: Record<Mood, number[]> = {
  'relaxing': createVector({ intensity: 0.2, valence: 0.7, energy: 0.2, tension: 0.1, pacing: 0.3 }),
  'exciting': createVector({ intensity: 0.9, valence: 0.7, energy: 0.9, tension: 0.6, pacing: 0.9, actionScore: 0.8 }),
  'thought-provoking': createVector({ complexity: 0.9, realism: 0.7, conversation: 0.9, dramaScore: 0.7, documentaryScore: 0.6 }),
  'heartwarming': createVector({ valence: 0.9, energy: 0.5, social: 0.7, dramaScore: 0.6, comedyScore: 0.5 }),
  'suspenseful': createVector({ intensity: 0.8, tension: 0.9, pacing: 0.7, thrillerScore: 0.9 }),
  'funny': createVector({ valence: 0.9, energy: 0.7, tension: 0.1, comedyScore: 0.95 }),
  'scary': createVector({ intensity: 0.8, valence: 0.3, tension: 0.9, darkness: 0.9, horrorScore: 0.95 }),
  'inspiring': createVector({ valence: 0.9, energy: 0.7, complexity: 0.6, conversation: 0.8, documentaryScore: 0.5 }),
  'nostalgic': createVector({ valence: 0.7, energy: 0.4, social: 0.6, dramaScore: 0.5 }),
  'adventurous': createVector({ intensity: 0.8, energy: 0.8, pacing: 0.7, actionScore: 0.7, scifiScore: 0.5 })
};

/**
 * Genre to semantic influence mapping
 */
const GENRE_INFLUENCES: Partial<Record<Genre, Partial<Record<keyof typeof SEMANTIC_DIMENSIONS, number>>>> = {
  'action': { intensity: 0.9, energy: 0.9, pacing: 0.8, actionScore: 1.0 },
  'comedy': { valence: 0.8, tension: 0.2, comedyScore: 1.0 },
  'drama': { complexity: 0.7, realism: 0.7, dramaScore: 1.0 },
  'horror': { tension: 0.9, darkness: 0.9, horrorScore: 1.0 },
  'sci-fi': { complexity: 0.8, realism: 0.3, scifiScore: 1.0 },
  'romance': { valence: 0.7, social: 0.8, romanceScore: 1.0 },
  'thriller': { tension: 0.9, intensity: 0.8, thrillerScore: 1.0 },
  'documentary': { realism: 0.95, complexity: 0.7, conversation: 0.8, documentaryScore: 1.0 },
  'adventure': { energy: 0.8, intensity: 0.7, actionScore: 0.6 },
  'fantasy': { realism: 0.1, complexity: 0.6 },
  'mystery': { complexity: 0.8, tension: 0.7, thrillerScore: 0.5 },
  'animation': { realism: 0.3 },
  'family': { valence: 0.8, darkness: 0.1, social: 0.9 },
  'history': { realism: 0.9, complexity: 0.7, documentaryScore: 0.4 },
  'war': { intensity: 0.9, darkness: 0.8, realism: 0.8, dramaScore: 0.7 },
  'western': { realism: 0.6, actionScore: 0.5 },
  'crime': { darkness: 0.7, tension: 0.7, thrillerScore: 0.6 },
  'music': { valence: 0.7, energy: 0.6 }
};

/**
 * Create a semantic vector with specified dimensions
 */
function createVector(dimensions: Partial<Record<keyof typeof SEMANTIC_DIMENSIONS, number>>): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0.5); // Default to neutral

  for (const [dim, value] of Object.entries(dimensions)) {
    const index = SEMANTIC_DIMENSIONS[dim as keyof typeof SEMANTIC_DIMENSIONS];
    if (index !== undefined) {
      vector[index] = value;
    }
  }

  return vector;
}

/**
 * Generate embedding vector for content
 */
export function generateContentEmbedding(content: ContentItem): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0.5);

  // Apply genre influences
  for (const genre of content.genres) {
    const influence = GENRE_INFLUENCES[genre];
    if (influence) {
      for (const [dim, value] of Object.entries(influence)) {
        const index = SEMANTIC_DIMENSIONS[dim as keyof typeof SEMANTIC_DIMENSIONS];
        if (index !== undefined) {
          // Blend genre influence
          vector[index] = (vector[index] + value) / 2;
        }
      }
    }
  }

  // Apply mood influences
  for (const mood of content.moods) {
    const moodVector = MOOD_VECTORS[mood];
    if (moodVector) {
      for (let i = 0; i < VECTOR_SIZE; i++) {
        vector[i] = (vector[i] + moodVector[i]) / 2;
      }
    }
  }

  // Adjust for content characteristics
  vector[SEMANTIC_DIMENSIONS.commitment] = Math.min(1, content.duration / 180);
  vector[SEMANTIC_DIMENSIONS.serialized] = content.type === 'tv-series' ? 0.9 : 0.2;

  // Rating influences quality perception
  const ratingNorm = content.rating / 10;
  vector[SEMANTIC_DIMENSIONS.complexity] *= (0.5 + ratingNorm * 0.5);

  return normalizeVector(vector);
}

/**
 * Generate embedding vector for a mood query
 */
export function generateMoodEmbedding(mood: Mood): number[] {
  return normalizeVector(MOOD_VECTORS[mood] || new Array(VECTOR_SIZE).fill(0.5));
}

/**
 * Generate embedding from natural language description
 */
export function generateQueryEmbedding(query: string): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0.5);
  const lowerQuery = query.toLowerCase();

  // Mood detection from text
  const moodKeywords: Record<string, Mood> = {
    'relax': 'relaxing', 'chill': 'relaxing', 'calm': 'relaxing', 'unwind': 'relaxing',
    'excit': 'exciting', 'thrill': 'exciting', 'action': 'exciting', 'adrenaline': 'exciting',
    'think': 'thought-provoking', 'deep': 'thought-provoking', 'meaningful': 'thought-provoking',
    'warm': 'heartwarming', 'feel-good': 'heartwarming', 'sweet': 'heartwarming', 'wholesome': 'heartwarming',
    'suspense': 'suspenseful', 'tense': 'suspenseful', 'edge': 'suspenseful',
    'funny': 'funny', 'laugh': 'funny', 'comedy': 'funny', 'hilarious': 'funny',
    'scary': 'scary', 'horror': 'scary', 'frighten': 'scary', 'creepy': 'scary',
    'inspir': 'inspiring', 'motivat': 'inspiring', 'uplift': 'inspiring',
    'nostalgic': 'nostalgic', 'classic': 'nostalgic', 'remember': 'nostalgic',
    'adventure': 'adventurous', 'explore': 'adventurous', 'journey': 'adventurous'
  };

  for (const [keyword, mood] of Object.entries(moodKeywords)) {
    if (lowerQuery.includes(keyword)) {
      const moodVector = MOOD_VECTORS[mood];
      for (let i = 0; i < VECTOR_SIZE; i++) {
        vector[i] = (vector[i] + moodVector[i]) / 2;
      }
    }
  }

  // Genre detection from text
  const genreKeywords: Record<string, Genre> = {
    'action': 'action', 'fight': 'action', 'explosion': 'action',
    'comedy': 'comedy', 'funny': 'comedy',
    'drama': 'drama', 'emotional': 'drama',
    'horror': 'horror', 'scary': 'horror',
    'sci-fi': 'sci-fi', 'space': 'sci-fi', 'future': 'sci-fi', 'robot': 'sci-fi',
    'romance': 'romance', 'love': 'romance', 'romantic': 'romance',
    'thriller': 'thriller', 'mystery': 'mystery',
    'documentary': 'documentary', 'real': 'documentary', 'true story': 'documentary'
  };

  for (const [keyword, genre] of Object.entries(genreKeywords)) {
    if (lowerQuery.includes(keyword)) {
      const influence = GENRE_INFLUENCES[genre];
      if (influence) {
        for (const [dim, value] of Object.entries(influence)) {
          const index = SEMANTIC_DIMENSIONS[dim as keyof typeof SEMANTIC_DIMENSIONS];
          if (index !== undefined) {
            vector[index] = (vector[index] + value) / 2;
          }
        }
      }
    }
  }

  // Time/duration preferences
  if (lowerQuery.includes('quick') || lowerQuery.includes('short')) {
    vector[SEMANTIC_DIMENSIONS.commitment] = 0.2;
  } else if (lowerQuery.includes('binge') || lowerQuery.includes('marathon')) {
    vector[SEMANTIC_DIMENSIONS.commitment] = 0.9;
    vector[SEMANTIC_DIMENSIONS.serialized] = 0.9;
  }

  // Social context
  if (lowerQuery.includes('date') || lowerQuery.includes('together') || lowerQuery.includes('friend')) {
    vector[SEMANTIC_DIMENSIONS.social] = 0.9;
  } else if (lowerQuery.includes('alone') || lowerQuery.includes('solo')) {
    vector[SEMANTIC_DIMENSIONS.social] = 0.2;
  }

  return normalizeVector(vector);
}

/**
 * Normalize a vector to unit length
 */
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(v => v / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Vector Store for content embeddings
 */
export class VectorStore {
  private vectors: Map<string, ContentVector> = new Map();

  /**
   * Index content item
   */
  index(content: ContentItem): ContentVector {
    const embedding = generateContentEmbedding(content);
    const vector: ContentVector = {
      id: `vec-${content.id}`,
      contentId: content.id,
      embedding,
      metadata: {
        title: content.title,
        type: content.type,
        genres: [...content.genres],
        moods: [...content.moods]
      }
    };

    this.vectors.set(vector.id, vector);
    return vector;
  }

  /**
   * Index multiple content items
   */
  indexAll(contents: ContentItem[]): void {
    for (const content of contents) {
      this.index(content);
    }
  }

  /**
   * Search by query embedding
   */
  search(queryEmbedding: number[], limit: number = 10): Array<{ vector: ContentVector; similarity: number }> {
    const results: Array<{ vector: ContentVector; similarity: number }> = [];

    for (const vector of this.vectors.values()) {
      const similarity = cosineSimilarity(queryEmbedding, vector.embedding);
      results.push({ vector, similarity });
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Search by mood
   */
  searchByMood(mood: Mood, limit: number = 10): Array<{ vector: ContentVector; similarity: number }> {
    const moodEmbedding = generateMoodEmbedding(mood);
    return this.search(moodEmbedding, limit);
  }

  /**
   * Search by natural language query
   */
  searchByQuery(query: string, limit: number = 10): Array<{ vector: ContentVector; similarity: number }> {
    const queryEmbedding = generateQueryEmbedding(query);
    return this.search(queryEmbedding, limit);
  }

  /**
   * Find similar content
   */
  findSimilar(contentId: string, limit: number = 5): Array<{ vector: ContentVector; similarity: number }> {
    const sourceVector = Array.from(this.vectors.values()).find(v => v.contentId === contentId);
    if (!sourceVector) {
      return [];
    }

    const results = this.search(sourceVector.embedding, limit + 1);
    // Filter out the source content itself
    return results.filter(r => r.vector.contentId !== contentId).slice(0, limit);
  }

  /**
   * Get vector by content ID
   */
  getByContentId(contentId: string): ContentVector | undefined {
    return Array.from(this.vectors.values()).find(v => v.contentId === contentId);
  }

  /**
   * Get store size
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * Clear the store
   */
  clear(): void {
    this.vectors.clear();
  }
}

// Singleton instance
let storeInstance: VectorStore | null = null;

/**
 * Get the vector store instance
 */
export function getVectorStore(): VectorStore {
  if (!storeInstance) {
    storeInstance = new VectorStore();
  }
  return storeInstance;
}

/**
 * Reset the vector store
 */
export function resetVectorStore(): void {
  storeInstance = null;
}
