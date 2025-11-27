import { z } from 'zod';

/**
 * Content genres available across streaming platforms
 */
export const GenreSchema = z.enum([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'romance',
  'sci-fi',
  'thriller',
  'war',
  'western'
]);

export type Genre = z.infer<typeof GenreSchema>;

/**
 * Supported streaming platforms
 */
export const StreamingPlatformSchema = z.enum([
  'netflix',
  'amazon-prime',
  'disney-plus',
  'hulu',
  'hbo-max',
  'apple-tv',
  'peacock',
  'paramount-plus',
  'youtube-tv',
  'crunchyroll'
]);

export type StreamingPlatform = z.infer<typeof StreamingPlatformSchema>;

/**
 * Content type classification
 */
export const ContentTypeSchema = z.enum([
  'movie',
  'tv-series',
  'documentary',
  'short',
  'special'
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Mood/vibe categories for content discovery
 */
export const MoodSchema = z.enum([
  'relaxing',
  'exciting',
  'thought-provoking',
  'heartwarming',
  'suspenseful',
  'funny',
  'scary',
  'inspiring',
  'nostalgic',
  'adventurous'
]);

export type Mood = z.infer<typeof MoodSchema>;

/**
 * Entertainment content item
 */
export const ContentItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: ContentTypeSchema,
  genres: z.array(GenreSchema).min(1),
  moods: z.array(MoodSchema),
  platforms: z.array(StreamingPlatformSchema).min(1),
  releaseYear: z.number().min(1900).max(2030),
  rating: z.number().min(0).max(10),
  duration: z.number().positive().describe('Duration in minutes'),
  description: z.string(),
  posterUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional()
});

export type ContentItem = z.infer<typeof ContentItemSchema>;

/**
 * Content recommendation with confidence score
 */
export const RecommendationSchema = z.object({
  content: ContentItemSchema,
  score: z.number().min(0).max(1).describe('Recommendation confidence score'),
  reasons: z.array(z.string()).min(1).describe('Why this content is recommended'),
  matchedPreferences: z.array(z.string()).describe('Which user preferences matched')
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Recommendation request parameters
 */
export const RecommendationRequestSchema = z.object({
  mood: MoodSchema.optional(),
  genres: z.array(GenreSchema).optional(),
  maxDuration: z.number().positive().optional(),
  platforms: z.array(StreamingPlatformSchema).optional(),
  excludeWatched: z.boolean().default(true),
  limit: z.number().min(1).max(20).default(5)
});

export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
