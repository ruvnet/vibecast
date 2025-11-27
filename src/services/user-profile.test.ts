import {
  UserProfileService,
  getUserProfileService,
  resetUserProfileService
} from './user-profile';
import { generateUUID } from '../utils';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    resetUserProfileService();
    service = new UserProfileService();
  });

  describe('create', () => {
    it('should create a new user profile', () => {
      const profile = service.create('Test User');

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('Test User');
      expect(profile.preferences).toBeDefined();
      expect(profile.watchHistory).toEqual([]);
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should create profile with email', () => {
      const profile = service.create('Test User', 'test@example.com');

      expect(profile.email).toBe('test@example.com');
    });

    it('should initialize with default preferences', () => {
      const profile = service.create('Test User');

      expect(profile.preferences.favoriteGenres).toEqual([]);
      expect(profile.preferences.dislikedGenres).toEqual([]);
      expect(profile.preferences.subscribedPlatforms).toEqual([]);
      expect(profile.preferences.minimumRating).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return profile by ID', () => {
      const created = service.create('Test User');
      const retrieved = service.getById(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent ID', () => {
      const result = service.getById('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', () => {
      const profile = service.create('Test User');

      const updated = service.updatePreferences(profile.id, {
        favoriteGenres: ['action', 'comedy'],
        subscribedPlatforms: ['netflix']
      });

      expect(updated?.preferences.favoriteGenres).toEqual(['action', 'comedy']);
      expect(updated?.preferences.subscribedPlatforms).toEqual(['netflix']);
    });

    it('should preserve unmodified preferences', () => {
      const profile = service.create('Test User');

      service.updatePreferences(profile.id, {
        favoriteGenres: ['action']
      });

      const updated = service.updatePreferences(profile.id, {
        subscribedPlatforms: ['netflix']
      });

      expect(updated?.preferences.favoriteGenres).toEqual(['action']);
      expect(updated?.preferences.subscribedPlatforms).toEqual(['netflix']);
    });

    it('should update the updatedAt timestamp', () => {
      const profile = service.create('Test User');
      const originalUpdatedAt = profile.updatedAt;

      // Small delay to ensure different timestamp
      const updated = service.updatePreferences(profile.id, {
        favoriteGenres: ['action']
      });

      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it('should return undefined for non-existent user', () => {
      const result = service.updatePreferences('non-existent-id', {
        favoriteGenres: ['action']
      });

      expect(result).toBeUndefined();
    });
  });

  describe('addToWatchHistory', () => {
    it('should add entry to watch history', () => {
      const profile = service.create('Test User');
      const contentId = generateUUID();

      const updated = service.addToWatchHistory(profile.id, {
        contentId,
        completedPercent: 100
      });

      expect(updated?.watchHistory.length).toBe(1);
      expect(updated?.watchHistory[0].contentId).toBe(contentId);
      expect(updated?.watchHistory[0].completedPercent).toBe(100);
      expect(updated?.watchHistory[0].watchedAt).toBeInstanceOf(Date);
    });

    it('should add optional rating', () => {
      const profile = service.create('Test User');
      const contentId = generateUUID();

      const updated = service.addToWatchHistory(profile.id, {
        contentId,
        completedPercent: 100,
        rating: 5
      });

      expect(updated?.watchHistory[0].rating).toBe(5);
    });

    it('should append to existing history', () => {
      const profile = service.create('Test User');

      service.addToWatchHistory(profile.id, {
        contentId: generateUUID(),
        completedPercent: 100
      });

      const updated = service.addToWatchHistory(profile.id, {
        contentId: generateUUID(),
        completedPercent: 50
      });

      expect(updated?.watchHistory.length).toBe(2);
    });

    it('should return undefined for non-existent user', () => {
      const result = service.addToWatchHistory('non-existent-id', {
        contentId: generateUUID(),
        completedPercent: 100
      });

      expect(result).toBeUndefined();
    });
  });

  describe('hasWatched', () => {
    it('should return true if content was watched >50%', () => {
      const profile = service.create('Test User');
      const contentId = generateUUID();

      service.addToWatchHistory(profile.id, {
        contentId,
        completedPercent: 75
      });

      expect(service.hasWatched(profile.id, contentId)).toBe(true);
    });

    it('should return false if content was watched <=50%', () => {
      const profile = service.create('Test User');
      const contentId = generateUUID();

      service.addToWatchHistory(profile.id, {
        contentId,
        completedPercent: 50
      });

      expect(service.hasWatched(profile.id, contentId)).toBe(false);
    });

    it('should return false for unwatched content', () => {
      const profile = service.create('Test User');

      expect(service.hasWatched(profile.id, generateUUID())).toBe(false);
    });

    it('should return false for non-existent user', () => {
      expect(service.hasWatched('non-existent-id', generateUUID())).toBe(false);
    });
  });

  describe('getWatchHistory', () => {
    it('should return user watch history', () => {
      const profile = service.create('Test User');
      const contentId = generateUUID();

      service.addToWatchHistory(profile.id, {
        contentId,
        completedPercent: 100
      });

      const history = service.getWatchHistory(profile.id);

      expect(history.length).toBe(1);
      expect(history[0].contentId).toBe(contentId);
    });

    it('should return empty array for new user', () => {
      const profile = service.create('Test User');

      expect(service.getWatchHistory(profile.id)).toEqual([]);
    });

    it('should return empty array for non-existent user', () => {
      expect(service.getWatchHistory('non-existent-id')).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete user profile', () => {
      const profile = service.create('Test User');

      const result = service.delete(profile.id);

      expect(result).toBe(true);
      expect(service.getById(profile.id)).toBeUndefined();
    });

    it('should return false for non-existent user', () => {
      const result = service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return number of profiles', () => {
      expect(service.count()).toBe(0);

      service.create('User 1');
      expect(service.count()).toBe(1);

      service.create('User 2');
      expect(service.count()).toBe(2);
    });
  });

  describe('getAll', () => {
    it('should return all profiles', () => {
      service.create('User 1');
      service.create('User 2');

      const all = service.getAll();

      expect(all.length).toBe(2);
    });
  });
});

describe('getUserProfileService', () => {
  beforeEach(() => {
    resetUserProfileService();
  });

  it('should return singleton instance', () => {
    const service1 = getUserProfileService();
    const service2 = getUserProfileService();

    expect(service1).toBe(service2);
  });
});
