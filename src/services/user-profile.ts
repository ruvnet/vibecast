import type { UserProfile, WatchHistoryEntry, UpdatePreferencesRequest } from '../types';
import { generateUUID } from '../utils';

/**
 * User profile management service
 */
export class UserProfileService {
  private profiles: Map<string, UserProfile> = new Map();

  /**
   * Create a new user profile
   */
  create(name: string, email?: string): UserProfile {
    const now = new Date();
    const profile: UserProfile = {
      id: generateUUID(),
      name,
      email,
      preferences: {
        favoriteGenres: [],
        dislikedGenres: [],
        preferredMoods: [],
        subscribedPlatforms: [],
        minimumRating: 0
      },
      watchHistory: [],
      createdAt: now,
      updatedAt: now
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  /**
   * Get a user profile by ID
   */
  getById(id: string): UserProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Update user preferences
   */
  updatePreferences(
    userId: string,
    updates: UpdatePreferencesRequest
  ): UserProfile | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return undefined;
    }

    profile.preferences = {
      ...profile.preferences,
      ...updates
    };
    profile.updatedAt = new Date();

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Add an entry to watch history
   */
  addToWatchHistory(
    userId: string,
    entry: Omit<WatchHistoryEntry, 'watchedAt'>
  ): UserProfile | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return undefined;
    }

    const historyEntry: WatchHistoryEntry = {
      ...entry,
      watchedAt: new Date()
    };

    profile.watchHistory.push(historyEntry);
    profile.updatedAt = new Date();

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Check if user has watched a specific content
   */
  hasWatched(userId: string, contentId: string): boolean {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return false;
    }

    return profile.watchHistory.some(
      entry => entry.contentId === contentId && entry.completedPercent > 50
    );
  }

  /**
   * Get user's watch history
   */
  getWatchHistory(userId: string): WatchHistoryEntry[] {
    const profile = this.profiles.get(userId);
    return profile?.watchHistory ?? [];
  }

  /**
   * Delete a user profile
   */
  delete(userId: string): boolean {
    return this.profiles.delete(userId);
  }

  /**
   * Get all profiles (for testing/admin)
   */
  getAll(): UserProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile count
   */
  count(): number {
    return this.profiles.size;
  }
}

// Singleton instance
let serviceInstance: UserProfileService | null = null;

/**
 * Get the user profile service instance
 */
export function getUserProfileService(): UserProfileService {
  if (!serviceInstance) {
    serviceInstance = new UserProfileService();
  }
  return serviceInstance;
}

/**
 * Reset the service (useful for testing)
 */
export function resetUserProfileService(): void {
  serviceInstance = null;
}
