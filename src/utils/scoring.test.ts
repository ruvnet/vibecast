import {
  calculatePreferenceScore,
  calculateMoodScore,
  generateRecommendationReasons,
  getMatchedPreferences
} from './scoring';
import type { ContentItem, UserPreferences } from '../types';

describe('calculatePreferenceScore', () => {
  const baseContent: ContentItem = {
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

  const basePreferences: UserPreferences = {
    favoriteGenres: ['action', 'comedy'],
    dislikedGenres: ['horror'],
    preferredMoods: ['exciting', 'funny'],
    subscribedPlatforms: ['netflix', 'hulu'],
    minimumRating: 7.0
  };

  it('should return higher score for matching genres', () => {
    const score = calculatePreferenceScore(baseContent, basePreferences);
    expect(score).toBeGreaterThan(0.5);
  });

  it('should return lower score for disliked genres', () => {
    const horrorContent: ContentItem = {
      ...baseContent,
      genres: ['horror', 'thriller']
    };

    const score = calculatePreferenceScore(horrorContent, basePreferences);
    expect(score).toBeLessThan(0.5);
  });

  it('should boost score for available platforms', () => {
    const netflixContent: ContentItem = { ...baseContent, platforms: ['netflix'] };
    const otherContent: ContentItem = { ...baseContent, platforms: ['disney-plus'] };

    const netflixScore = calculatePreferenceScore(netflixContent, basePreferences);
    const otherScore = calculatePreferenceScore(otherContent, basePreferences);

    expect(netflixScore).toBeGreaterThan(otherScore);
  });

  it('should respect minimum rating preference', () => {
    const lowRatedContent = { ...baseContent, rating: 5.0 };
    const highRatedContent = { ...baseContent, rating: 9.0 };

    const lowScore = calculatePreferenceScore(lowRatedContent, basePreferences);
    const highScore = calculatePreferenceScore(highRatedContent, basePreferences);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should return normalized score between 0 and 1', () => {
    const score = calculatePreferenceScore(baseContent, basePreferences);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should handle empty preferences gracefully', () => {
    const emptyPrefs: UserPreferences = {
      favoriteGenres: [],
      dislikedGenres: [],
      preferredMoods: [],
      subscribedPlatforms: [],
      minimumRating: 0
    };

    const score = calculatePreferenceScore(baseContent, emptyPrefs);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('calculateMoodScore', () => {
  const content: ContentItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Movie',
    type: 'movie',
    genres: ['action'],
    moods: ['exciting', 'adventurous'],
    platforms: ['netflix'],
    releaseYear: 2023,
    rating: 8.0,
    duration: 120,
    description: 'A test movie'
  };

  it('should return 1.0 for exact mood match', () => {
    const score = calculateMoodScore(content, 'exciting');
    expect(score).toBe(1.0);
  });

  it('should return 0.5 for similar mood', () => {
    // 'suspenseful' is similar to 'exciting'
    const score = calculateMoodScore(content, 'suspenseful');
    expect(score).toBe(0.5);
  });

  it('should return 0 for unrelated mood', () => {
    const score = calculateMoodScore(content, 'relaxing');
    expect(score).toBe(0);
  });
});

describe('generateRecommendationReasons', () => {
  const content: ContentItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Movie',
    type: 'movie',
    genres: ['action', 'sci-fi'],
    moods: ['exciting'],
    platforms: ['netflix'],
    releaseYear: 2023,
    rating: 9.0,
    duration: 90,
    description: 'A test movie'
  };

  const preferences: UserPreferences = {
    favoriteGenres: ['action'],
    dislikedGenres: [],
    preferredMoods: ['exciting'],
    subscribedPlatforms: ['netflix'],
    minimumRating: 7.0,
    maxContentDuration: 120
  };

  it('should include genre match reason', () => {
    const reasons = generateRecommendationReasons(content, preferences);
    expect(reasons.some(r => r.toLowerCase().includes('genre'))).toBe(true);
  });

  it('should include mood match reason when mood is specified', () => {
    const reasons = generateRecommendationReasons(content, preferences, 'exciting');
    expect(reasons.some(r => r.toLowerCase().includes('mood'))).toBe(true);
  });

  it('should include high rating reason', () => {
    const reasons = generateRecommendationReasons(content, preferences);
    expect(reasons.some(r => r.includes('Highly rated'))).toBe(true);
  });

  it('should include platform availability reason', () => {
    const reasons = generateRecommendationReasons(content, preferences);
    expect(reasons.some(r => r.toLowerCase().includes('netflix'))).toBe(true);
  });

  it('should always return at least one reason', () => {
    const emptyPrefs: UserPreferences = {
      favoriteGenres: [],
      dislikedGenres: [],
      preferredMoods: [],
      subscribedPlatforms: [],
      minimumRating: 0
    };

    const reasons = generateRecommendationReasons(
      { ...content, rating: 5.0 },
      emptyPrefs
    );
    expect(reasons.length).toBeGreaterThan(0);
  });
});

describe('getMatchedPreferences', () => {
  const content: ContentItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Movie',
    type: 'movie',
    genres: ['action', 'sci-fi'],
    moods: ['exciting'],
    platforms: ['netflix', 'hulu'],
    releaseYear: 2023,
    rating: 8.0,
    duration: 120,
    description: 'A test movie'
  };

  it('should return matched genres', () => {
    const preferences: UserPreferences = {
      favoriteGenres: ['action', 'comedy'],
      dislikedGenres: [],
      preferredMoods: [],
      subscribedPlatforms: [],
      minimumRating: 0
    };

    const matched = getMatchedPreferences(content, preferences);
    expect(matched).toContain('genre:action');
    expect(matched).not.toContain('genre:comedy');
  });

  it('should return matched moods', () => {
    const preferences: UserPreferences = {
      favoriteGenres: [],
      dislikedGenres: [],
      preferredMoods: ['exciting', 'relaxing'],
      subscribedPlatforms: [],
      minimumRating: 0
    };

    const matched = getMatchedPreferences(content, preferences);
    expect(matched).toContain('mood:exciting');
    expect(matched).not.toContain('mood:relaxing');
  });

  it('should return matched platforms', () => {
    const preferences: UserPreferences = {
      favoriteGenres: [],
      dislikedGenres: [],
      preferredMoods: [],
      subscribedPlatforms: ['netflix', 'disney-plus'],
      minimumRating: 0
    };

    const matched = getMatchedPreferences(content, preferences);
    expect(matched).toContain('platform:netflix');
    expect(matched).not.toContain('platform:disney-plus');
  });

  it('should return empty array for no matches', () => {
    const preferences: UserPreferences = {
      favoriteGenres: ['horror'],
      dislikedGenres: [],
      preferredMoods: ['scary'],
      subscribedPlatforms: ['apple-tv'],
      minimumRating: 0
    };

    const matched = getMatchedPreferences(content, preferences);
    expect(matched).toEqual([]);
  });
});
