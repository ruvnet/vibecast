import { z } from 'zod';
import { GenreSchema, MoodSchema, StreamingPlatformSchema } from './content';

/**
 * User's viewing history entry
 */
export const WatchHistoryEntrySchema = z.object({
  contentId: z.string().uuid(),
  watchedAt: z.date(),
  completedPercent: z.number().min(0).max(100),
  rating: z.number().min(1).max(5).optional()
});

export type WatchHistoryEntry = z.infer<typeof WatchHistoryEntrySchema>;

/**
 * User preferences for content discovery
 */
export const UserPreferencesSchema = z.object({
  favoriteGenres: z.array(GenreSchema).default([]),
  dislikedGenres: z.array(GenreSchema).default([]),
  preferredMoods: z.array(MoodSchema).default([]),
  subscribedPlatforms: z.array(StreamingPlatformSchema).default([]),
  maxContentDuration: z.number().positive().optional(),
  preferredReleaseYearRange: z.object({
    min: z.number().min(1900),
    max: z.number().max(2030)
  }).optional(),
  minimumRating: z.number().min(0).max(10).default(0)
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Complete user profile for the recommendation engine
 */
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  preferences: UserPreferencesSchema,
  watchHistory: z.array(WatchHistoryEntrySchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Parameters for updating user preferences
 */
export const UpdatePreferencesRequestSchema = UserPreferencesSchema.partial();

export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
