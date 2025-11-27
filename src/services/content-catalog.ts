import type { ContentItem, Genre, StreamingPlatform, Mood, ContentType } from '../types';
import { generateUUID } from '../utils';

/**
 * In-memory content catalog service
 * In production, this would connect to a database or external API
 */
export class ContentCatalog {
  private content: Map<string, ContentItem> = new Map();

  constructor() {
    this.seedSampleContent();
  }

  /**
   * Get content by ID
   */
  getById(id: string): ContentItem | undefined {
    return this.content.get(id);
  }

  /**
   * Get all content items
   */
  getAll(): ContentItem[] {
    return Array.from(this.content.values());
  }

  /**
   * Search content by various filters
   */
  search(filters: {
    genres?: Genre[];
    platforms?: StreamingPlatform[];
    moods?: Mood[];
    type?: ContentType;
    minRating?: number;
    maxDuration?: number;
    yearRange?: { min: number; max: number };
  }): ContentItem[] {
    let results = this.getAll();

    if (filters.genres && filters.genres.length > 0) {
      results = results.filter(c =>
        c.genres.some(g => filters.genres!.includes(g))
      );
    }

    if (filters.platforms && filters.platforms.length > 0) {
      results = results.filter(c =>
        c.platforms.some(p => filters.platforms!.includes(p))
      );
    }

    if (filters.moods && filters.moods.length > 0) {
      results = results.filter(c =>
        c.moods.some(m => filters.moods!.includes(m))
      );
    }

    if (filters.type) {
      results = results.filter(c => c.type === filters.type);
    }

    if (filters.minRating !== undefined) {
      results = results.filter(c => c.rating >= filters.minRating!);
    }

    if (filters.maxDuration !== undefined) {
      results = results.filter(c => c.duration <= filters.maxDuration!);
    }

    if (filters.yearRange) {
      results = results.filter(c =>
        c.releaseYear >= filters.yearRange!.min &&
        c.releaseYear <= filters.yearRange!.max
      );
    }

    return results;
  }

  /**
   * Add content to the catalog
   */
  add(content: ContentItem): void {
    this.content.set(content.id, content);
  }

  /**
   * Remove content from the catalog
   */
  remove(id: string): boolean {
    return this.content.delete(id);
  }

  /**
   * Get content count
   */
  count(): number {
    return this.content.size;
  }

  /**
   * Seed sample content for demonstration
   */
  private seedSampleContent(): void {
    const sampleContent: Omit<ContentItem, 'id'>[] = [
      {
        title: 'The Grand Adventure',
        type: 'movie',
        genres: ['adventure', 'action', 'fantasy'],
        moods: ['exciting', 'adventurous'],
        platforms: ['netflix', 'amazon-prime'],
        releaseYear: 2023,
        rating: 8.5,
        duration: 142,
        description: 'An epic journey through uncharted lands filled with wonder and danger.'
      },
      {
        title: 'Cosmic Mysteries',
        type: 'documentary',
        genres: ['documentary', 'sci-fi'],
        moods: ['thought-provoking', 'inspiring'],
        platforms: ['netflix', 'disney-plus'],
        releaseYear: 2024,
        rating: 9.1,
        duration: 95,
        description: 'Explore the mysteries of the universe in this stunning documentary series.'
      },
      {
        title: 'The Comfort Zone',
        type: 'tv-series',
        genres: ['comedy', 'drama'],
        moods: ['relaxing', 'funny', 'heartwarming'],
        platforms: ['hulu', 'peacock'],
        releaseYear: 2022,
        rating: 7.8,
        duration: 30,
        description: 'A heartwarming comedy about finding joy in everyday moments.'
      },
      {
        title: 'Shadow Protocol',
        type: 'movie',
        genres: ['thriller', 'action', 'crime'],
        moods: ['suspenseful', 'exciting'],
        platforms: ['amazon-prime', 'hbo-max'],
        releaseYear: 2024,
        rating: 8.2,
        duration: 118,
        description: 'A gripping thriller where nothing is as it seems.'
      },
      {
        title: 'Whispers in the Dark',
        type: 'movie',
        genres: ['horror', 'mystery', 'thriller'],
        moods: ['scary', 'suspenseful'],
        platforms: ['netflix', 'paramount-plus'],
        releaseYear: 2023,
        rating: 7.4,
        duration: 105,
        description: 'A chilling tale of secrets that refuse to stay buried.'
      },
      {
        title: 'Love in Bloom',
        type: 'movie',
        genres: ['romance', 'comedy', 'drama'],
        moods: ['heartwarming', 'funny', 'relaxing'],
        platforms: ['netflix', 'hulu'],
        releaseYear: 2024,
        rating: 7.2,
        duration: 108,
        description: 'A charming romantic comedy about second chances.'
      },
      {
        title: 'The Last Stand',
        type: 'movie',
        genres: ['war', 'drama', 'history'],
        moods: ['inspiring', 'thought-provoking'],
        platforms: ['apple-tv', 'amazon-prime'],
        releaseYear: 2023,
        rating: 8.8,
        duration: 165,
        description: 'A powerful war drama based on true events.'
      },
      {
        title: 'Animated Dreams',
        type: 'movie',
        genres: ['animation', 'family', 'adventure'],
        moods: ['heartwarming', 'adventurous', 'funny'],
        platforms: ['disney-plus', 'netflix'],
        releaseYear: 2024,
        rating: 8.0,
        duration: 98,
        description: 'A magical animated adventure for the whole family.'
      },
      {
        title: 'Code Breakers',
        type: 'tv-series',
        genres: ['drama', 'thriller', 'mystery'],
        moods: ['suspenseful', 'thought-provoking'],
        platforms: ['apple-tv', 'hbo-max'],
        releaseYear: 2023,
        rating: 8.6,
        duration: 55,
        description: 'A team of cryptographers race against time to prevent a global catastrophe.'
      },
      {
        title: 'Western Sunrise',
        type: 'movie',
        genres: ['western', 'drama', 'action'],
        moods: ['nostalgic', 'adventurous'],
        platforms: ['paramount-plus', 'amazon-prime'],
        releaseYear: 2022,
        rating: 7.6,
        duration: 135,
        description: 'A classic tale of redemption in the Wild West.'
      }
    ];

    sampleContent.forEach(item => {
      this.add({
        ...item,
        id: generateUUID()
      });
    });
  }
}

// Singleton instance
let catalogInstance: ContentCatalog | null = null;

/**
 * Get the content catalog instance
 */
export function getContentCatalog(): ContentCatalog {
  if (!catalogInstance) {
    catalogInstance = new ContentCatalog();
  }
  return catalogInstance;
}

/**
 * Reset the catalog (useful for testing)
 */
export function resetContentCatalog(): void {
  catalogInstance = null;
}
