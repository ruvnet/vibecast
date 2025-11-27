import type { ContentItem, UserPreferences, Mood } from '../types';

/**
 * Calculate similarity score between user preferences and content
 */
export function calculatePreferenceScore(
  content: ContentItem,
  preferences: UserPreferences
): number {
  let score = 0;
  let maxScore = 0;

  // Genre matching (weight: 3)
  const genreWeight = 3;
  maxScore += genreWeight;
  const matchedFavoriteGenres = content.genres.filter(g =>
    preferences.favoriteGenres.includes(g)
  );
  const hasDislikedGenre = content.genres.some(g =>
    preferences.dislikedGenres.includes(g)
  );

  if (hasDislikedGenre) {
    score -= genreWeight; // Penalty for disliked genres
  } else if (matchedFavoriteGenres.length > 0) {
    score += genreWeight * (matchedFavoriteGenres.length / content.genres.length);
  }

  // Mood matching (weight: 2)
  const moodWeight = 2;
  if (preferences.preferredMoods.length > 0) {
    maxScore += moodWeight;
    const matchedMoods = content.moods.filter(m =>
      preferences.preferredMoods.includes(m)
    );
    if (matchedMoods.length > 0) {
      score += moodWeight * (matchedMoods.length / preferences.preferredMoods.length);
    }
  }

  // Platform availability (weight: 2)
  const platformWeight = 2;
  if (preferences.subscribedPlatforms.length > 0) {
    maxScore += platformWeight;
    const availableOnSubscribed = content.platforms.some(p =>
      preferences.subscribedPlatforms.includes(p)
    );
    if (availableOnSubscribed) {
      score += platformWeight;
    }
  }

  // Rating score (weight: 1)
  const ratingWeight = 1;
  maxScore += ratingWeight;
  if (content.rating >= preferences.minimumRating) {
    score += ratingWeight * (content.rating / 10);
  }

  // Duration preference (weight: 1)
  const durationWeight = 1;
  if (preferences.maxContentDuration) {
    maxScore += durationWeight;
    if (content.duration <= preferences.maxContentDuration) {
      score += durationWeight;
    }
  }

  // Release year preference (weight: 1)
  const yearWeight = 1;
  if (preferences.preferredReleaseYearRange) {
    maxScore += yearWeight;
    const { min, max } = preferences.preferredReleaseYearRange;
    if (content.releaseYear >= min && content.releaseYear <= max) {
      score += yearWeight;
    }
  }

  // Normalize to 0-1 range
  return maxScore > 0 ? Math.max(0, score / maxScore) : 0.5;
}

/**
 * Calculate mood-based score for content
 */
export function calculateMoodScore(
  content: ContentItem,
  targetMood: Mood
): number {
  if (content.moods.includes(targetMood)) {
    return 1.0;
  }

  // Define mood similarities
  const moodSimilarities: Record<Mood, Mood[]> = {
    'relaxing': ['heartwarming', 'nostalgic'],
    'exciting': ['adventurous', 'suspenseful'],
    'thought-provoking': ['inspiring'],
    'heartwarming': ['relaxing', 'inspiring', 'nostalgic'],
    'suspenseful': ['exciting', 'scary'],
    'funny': ['heartwarming'],
    'scary': ['suspenseful'],
    'inspiring': ['thought-provoking', 'heartwarming'],
    'nostalgic': ['heartwarming', 'relaxing'],
    'adventurous': ['exciting']
  };

  const similarMoods = moodSimilarities[targetMood] || [];
  const hasSimilarMood = content.moods.some(m => similarMoods.includes(m));

  return hasSimilarMood ? 0.5 : 0;
}

/**
 * Generate human-readable reasons for a recommendation
 */
export function generateRecommendationReasons(
  content: ContentItem,
  preferences: UserPreferences,
  requestedMood?: Mood
): string[] {
  const reasons: string[] = [];

  // Genre matches
  const matchedGenres = content.genres.filter(g =>
    preferences.favoriteGenres.includes(g)
  );
  if (matchedGenres.length > 0) {
    reasons.push(`Matches your favorite ${matchedGenres.length > 1 ? 'genres' : 'genre'}: ${matchedGenres.join(', ')}`);
  }

  // Mood match
  if (requestedMood && content.moods.includes(requestedMood)) {
    reasons.push(`Perfect for a ${requestedMood} mood`);
  }

  // High rating
  if (content.rating >= 8) {
    reasons.push(`Highly rated: ${content.rating}/10`);
  }

  // Available on subscribed platforms
  const availablePlatforms = content.platforms.filter(p =>
    preferences.subscribedPlatforms.includes(p)
  );
  if (availablePlatforms.length > 0) {
    reasons.push(`Available on ${availablePlatforms.join(', ')}`);
  }

  // Good duration fit
  if (preferences.maxContentDuration && content.duration <= preferences.maxContentDuration) {
    reasons.push(`Fits your time: ${content.duration} minutes`);
  }

  // Ensure at least one reason
  if (reasons.length === 0) {
    reasons.push('Based on your viewing patterns');
  }

  return reasons;
}

/**
 * Get matched preferences as a list of strings
 */
export function getMatchedPreferences(
  content: ContentItem,
  preferences: UserPreferences
): string[] {
  const matched: string[] = [];

  const matchedGenres = content.genres.filter(g =>
    preferences.favoriteGenres.includes(g)
  );
  matchedGenres.forEach(g => matched.push(`genre:${g}`));

  const matchedMoods = content.moods.filter(m =>
    preferences.preferredMoods.includes(m)
  );
  matchedMoods.forEach(m => matched.push(`mood:${m}`));

  const availablePlatforms = content.platforms.filter(p =>
    preferences.subscribedPlatforms.includes(p)
  );
  availablePlatforms.forEach(p => matched.push(`platform:${p}`));

  return matched;
}
