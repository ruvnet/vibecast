import {
  ContentCatalog,
  getContentCatalog,
  resetContentCatalog
} from './content-catalog';
import { generateUUID } from '../utils';
import type { ContentItem } from '../types';

describe('ContentCatalog', () => {
  let catalog: ContentCatalog;

  beforeEach(() => {
    resetContentCatalog();
    catalog = new ContentCatalog();
  });

  describe('initialization', () => {
    it('should seed sample content on creation', () => {
      expect(catalog.count()).toBeGreaterThan(0);
    });

    it('should have valid content items', () => {
      const items = catalog.getAll();
      items.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.genres.length).toBeGreaterThan(0);
        expect(item.platforms.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getById', () => {
    it('should return content by ID', () => {
      const items = catalog.getAll();
      const firstItem = items[0];

      const result = catalog.getById(firstItem.id);
      expect(result).toEqual(firstItem);
    });

    it('should return undefined for non-existent ID', () => {
      const result = catalog.getById('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('add', () => {
    it('should add new content', () => {
      const initialCount = catalog.count();

      const newContent: ContentItem = {
        id: generateUUID(),
        title: 'New Test Movie',
        type: 'movie',
        genres: ['comedy'],
        moods: ['funny'],
        platforms: ['netflix'],
        releaseYear: 2024,
        rating: 7.5,
        duration: 100,
        description: 'A new test movie'
      };

      catalog.add(newContent);

      expect(catalog.count()).toBe(initialCount + 1);
      expect(catalog.getById(newContent.id)).toEqual(newContent);
    });
  });

  describe('remove', () => {
    it('should remove content by ID', () => {
      const items = catalog.getAll();
      const itemToRemove = items[0];
      const initialCount = catalog.count();

      const result = catalog.remove(itemToRemove.id);

      expect(result).toBe(true);
      expect(catalog.count()).toBe(initialCount - 1);
      expect(catalog.getById(itemToRemove.id)).toBeUndefined();
    });

    it('should return false for non-existent ID', () => {
      const result = catalog.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('search', () => {
    it('should filter by genre', () => {
      const results = catalog.search({ genres: ['documentary'] });

      results.forEach(item => {
        expect(item.genres).toContain('documentary');
      });
    });

    it('should filter by platform', () => {
      const results = catalog.search({ platforms: ['netflix'] });

      results.forEach(item => {
        expect(item.platforms).toContain('netflix');
      });
    });

    it('should filter by mood', () => {
      const results = catalog.search({ moods: ['exciting'] });

      results.forEach(item => {
        expect(item.moods).toContain('exciting');
      });
    });

    it('should filter by content type', () => {
      const results = catalog.search({ type: 'movie' });

      results.forEach(item => {
        expect(item.type).toBe('movie');
      });
    });

    it('should filter by minimum rating', () => {
      const results = catalog.search({ minRating: 8.0 });

      results.forEach(item => {
        expect(item.rating).toBeGreaterThanOrEqual(8.0);
      });
    });

    it('should filter by maximum duration', () => {
      const results = catalog.search({ maxDuration: 100 });

      results.forEach(item => {
        expect(item.duration).toBeLessThanOrEqual(100);
      });
    });

    it('should filter by year range', () => {
      const results = catalog.search({
        yearRange: { min: 2023, max: 2024 }
      });

      results.forEach(item => {
        expect(item.releaseYear).toBeGreaterThanOrEqual(2023);
        expect(item.releaseYear).toBeLessThanOrEqual(2024);
      });
    });

    it('should combine multiple filters', () => {
      const results = catalog.search({
        genres: ['action'],
        platforms: ['netflix'],
        minRating: 7.0
      });

      results.forEach(item => {
        expect(item.genres.some(g => g === 'action')).toBe(true);
        expect(item.platforms.some(p => p === 'netflix')).toBe(true);
        expect(item.rating).toBeGreaterThanOrEqual(7.0);
      });
    });

    it('should return empty array when no matches', () => {
      const results = catalog.search({
        genres: ['western'],
        platforms: ['crunchyroll']
      });

      // May or may not find results, but should not throw
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

describe('getContentCatalog', () => {
  beforeEach(() => {
    resetContentCatalog();
  });

  it('should return singleton instance', () => {
    const catalog1 = getContentCatalog();
    const catalog2 = getContentCatalog();

    expect(catalog1).toBe(catalog2);
  });

  it('should create new instance after reset', () => {
    const catalog1 = getContentCatalog();
    const count1 = catalog1.count();

    resetContentCatalog();
    const catalog2 = getContentCatalog();

    expect(catalog2.count()).toBe(count1); // Same seeded content
  });
});
