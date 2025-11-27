# VibeCast

AI-powered entertainment discovery platform that solves the **45-minute decision problem** - the time people waste every night deciding what to watch.

Built for the **Agentics Foundation TV5 Hackathon** (Entertainment Discovery Track).

## The Problem

Every night, millions of people spend up to 45 minutes scrolling through streaming services trying to decide what to watch. With content fragmented across Netflix, Amazon Prime, Disney+, Hulu, and more, finding the perfect match for your mood is harder than ever.

## The Solution

VibeCast uses an AI recommendation agent that:
- Understands your **preferences** and **mood**
- Knows which **streaming platforms** you subscribe to
- Provides personalized recommendations with **confidence scores**
- Explains **why** each recommendation matches your vibe
- Learns from your **watch history**

## Quick Start

```bash
# Install dependencies
npm install

# Run the demo
npm start

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Demo Output

```
🎬 VibeCast - Entertainment Discovery Demo

📚 Content catalog loaded: 10 items
👤 Created user: Demo User
✅ User preferences updated
🤖 Recommendation agent initialized

🎯 Getting personalized recommendations...

1. Shadow Protocol
   Type: movie | Rating: 8.2/10
   Genres: thriller, action, crime
   Match score: 75.5%
   Why: Matches your favorite genre: thriller

⚡ Quick Pick for "thought-provoking" mood:
   "Cosmic Mysteries"
   Explore the mysteries of the universe...

✨ Demo complete! No more 45-minute decision paralysis.
```

## Architecture

```
src/
├── agents/                 # AI Agents
│   └── recommendation-agent.ts  # Core recommendation engine
├── services/              # Business Logic
│   ├── content-catalog.ts      # Content management
│   └── user-profile.ts         # User preferences & history
├── types/                 # TypeScript Types (Zod schemas)
│   ├── content.ts              # Content, genres, platforms, moods
│   └── user.ts                 # User profiles & preferences
├── utils/                 # Utilities
│   ├── scoring.ts              # Recommendation scoring algorithms
│   └── validation.ts           # Input validation helpers
└── index.ts               # Entry point & demo
```

## Features

### Mood-Based Discovery
- 10 mood categories: relaxing, exciting, thought-provoking, heartwarming, suspenseful, funny, scary, inspiring, nostalgic, adventurous
- Smart mood similarity matching

### Multi-Platform Support
- Netflix, Amazon Prime, Disney+, Hulu, HBO Max, Apple TV, Peacock, Paramount+, YouTube TV, Crunchyroll

### Intelligent Scoring
- Genre preference matching
- Platform availability filtering
- Rating thresholds
- Duration preferences
- Release year preferences
- Watch history exclusion

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run the demo |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type check without emitting |

## Test Coverage

```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   97.04 |    87.01 |     100 |   96.87 |
 recommendation-agent.ts  |     100 |      100 |     100 |     100 |
 content-catalog.ts       |     100 |      100 |     100 |     100 |
 user-profile.ts          |     100 |      100 |     100 |     100 |
--------------------------|---------|----------|---------|---------|
Tests:       93 passed, 93 total
```

## API Usage

```typescript
import {
  getUserProfileService,
  getContentCatalog,
  createRecommendationAgent
} from 'vibecast';

// Create a user
const userService = getUserProfileService();
const user = userService.create('John Doe');

// Set preferences
userService.updatePreferences(user.id, {
  favoriteGenres: ['sci-fi', 'thriller'],
  subscribedPlatforms: ['netflix', 'hbo-max'],
  preferredMoods: ['exciting', 'suspenseful']
});

// Get recommendations
const agent = createRecommendationAgent(user.id);
const recommendations = agent.getRecommendations({
  mood: 'exciting',
  limit: 5,
  excludeWatched: true
});

// Quick pick for when you can't decide
const quickPick = agent.quickPick('relaxing');
```

## Technologies

- **TypeScript** - Type-safe development
- **Zod** - Runtime validation & schema definition
- **Jest** - Testing framework
- **ESLint** - Code quality

## Hackathon Track

**Entertainment Discovery** - Solve the 45-minute decision problem and help users find what to watch across fragmented content platforms.

## License

MIT

---

Built with ❤️ for the Agentics Foundation TV5 Hackathon
