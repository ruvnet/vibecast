import {
  VectorStore,
  getVectorStore,
  resetVectorStore,
  generateContentEmbedding,
  generateMoodEmbedding,
  generateQueryEmbedding,
  cosineSimilarity
} from './vector-store';
import { getContentCatalog, resetContentCatalog } from '../services/content-catalog';
import type { ContentItem } from '../types';

describe('Vector Store', () => {
  beforeEach(() => {
    resetVectorStore();
    resetContentCatalog();
  });

  describe('generateContentEmbedding', () => {
    it('should generate embedding for content', () => {
      const content: ContentItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Movie',
        type: 'movie',
        genres: ['action', 'sci-fi'],
        moods: ['exciting'],
        platforms: ['netflix'],
        releaseYear: 2023,
        rating: 8.0,
        duration: 120,
        description: 'A test movie'
      };

      const embedding = generateContentEmbedding(content);

      expect(embedding).toHaveLength(20);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
      expect(embedding.every(v => !isNaN(v))).toBe(true);
    });

    it('should generate different embeddings for different content', () => {
      const action: ContentItem = {
        id: '1',
        title: 'Action Movie',
        type: 'movie',
        genres: ['action'],
        moods: ['exciting'],
        platforms: ['netflix'],
        releaseYear: 2023,
        rating: 8.0,
        duration: 120,
        description: 'Action!'
      };

      const comedy: ContentItem = {
        id: '2',
        title: 'Comedy Movie',
        type: 'movie',
        genres: ['comedy'],
        moods: ['funny'],
        platforms: ['netflix'],
        releaseYear: 2023,
        rating: 8.0,
        duration: 120,
        description: 'Funny!'
      };

      const actionEmb = generateContentEmbedding(action);
      const comedyEmb = generateContentEmbedding(comedy);

      // Should be different
      const areDifferent = actionEmb.some((v, i) => v !== comedyEmb[i]);
      expect(areDifferent).toBe(true);
    });
  });

  describe('generateMoodEmbedding', () => {
    it('should generate embedding for mood', () => {
      const embedding = generateMoodEmbedding('exciting');

      expect(embedding).toHaveLength(20);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should generate different embeddings for different moods', () => {
      const exciting = generateMoodEmbedding('exciting');
      const relaxing = generateMoodEmbedding('relaxing');

      const similarity = cosineSimilarity(exciting, relaxing);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('generateQueryEmbedding', () => {
    it('should generate embedding from natural language', () => {
      const embedding = generateQueryEmbedding('Something exciting and action-packed');

      expect(embedding).toHaveLength(20);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should reflect mood keywords', () => {
      const excitingQuery = generateQueryEmbedding('I want something exciting and action-packed');
      const relaxingQuery = generateQueryEmbedding('I want something calm and peaceful');

      const similarity = cosineSimilarity(excitingQuery, relaxingQuery);
      // Different moods should have less than perfect similarity
      expect(similarity).toBeLessThan(1.0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return lower value for different vectors', () => {
      const a = [1, 0, 0, 0, 0];
      const b = [0, 1, 0, 0, 0];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });

    it('should throw for vectors of different lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same length');
    });
  });

  describe('VectorStore', () => {
    let store: VectorStore;

    beforeEach(() => {
      store = new VectorStore();
    });

    it('should index content', () => {
      const catalog = getContentCatalog();
      const content = catalog.getAll()[0];

      store.index(content);

      expect(store.size()).toBe(1);
    });

    it('should index all content', () => {
      const catalog = getContentCatalog();

      store.indexAll(catalog.getAll());

      expect(store.size()).toBe(catalog.count());
    });

    it('should search by mood', () => {
      const catalog = getContentCatalog();
      store.indexAll(catalog.getAll());

      const results = store.searchByMood('exciting', 5);

      expect(results.length).toBeLessThanOrEqual(5);
      expect(results.every(r => r.similarity >= 0 && r.similarity <= 1)).toBe(true);
    });

    it('should search by query', () => {
      const catalog = getContentCatalog();
      store.indexAll(catalog.getAll());

      const results = store.searchByQuery('action movie', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should find similar content', () => {
      const catalog = getContentCatalog();
      store.indexAll(catalog.getAll());

      const content = catalog.getAll()[0];
      const similar = store.findSimilar(content.id, 3);

      expect(similar.length).toBeLessThanOrEqual(3);
      // Should not include the source content
      expect(similar.every(r => r.vector.contentId !== content.id)).toBe(true);
    });

    it('should get vector by content ID', () => {
      const catalog = getContentCatalog();
      const content = catalog.getAll()[0];
      store.index(content);

      const vector = store.getByContentId(content.id);

      expect(vector).toBeDefined();
      expect(vector?.contentId).toBe(content.id);
    });

    it('should clear the store', () => {
      const catalog = getContentCatalog();
      store.indexAll(catalog.getAll());

      expect(store.size()).toBeGreaterThan(0);

      store.clear();

      expect(store.size()).toBe(0);
    });
  });

  describe('getVectorStore', () => {
    it('should return singleton instance', () => {
      const store1 = getVectorStore();
      const store2 = getVectorStore();

      expect(store1).toBe(store2);
    });
  });
});
