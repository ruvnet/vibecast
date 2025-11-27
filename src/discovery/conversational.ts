/**
 * VibeCast Pro - Conversational Discovery Interface
 *
 * Natural language interface for entertainment discovery.
 * "What do you feel like watching?" - solved with AI.
 */

import {
  DiscoveryContext,
  AggregatedRecommendation,
  getSwarmOrchestrator
} from '../agents/swarm';
import { getUserProfileService } from '../services/user-profile';
import { getVectorStore } from '../embeddings/vector-store';
import { getContentCatalog } from '../services/content-catalog';

/**
 * Conversation state
 */
interface ConversationState {
  userId: string;
  sessionId: string;
  history: ConversationTurn[];
  context: Partial<DiscoveryContext>;
  recommendations: AggregatedRecommendation[];
}

/**
 * A single turn in the conversation
 */
interface ConversationTurn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: Date;
}

/**
 * Discovery response
 */
export interface DiscoveryResponse {
  message: string;
  recommendations: AggregatedRecommendation[];
  followUpQuestions: string[];
  context: Partial<DiscoveryContext>;
}

/**
 * Parse user input to extract discovery context
 */
function parseUserInput(input: string): Partial<DiscoveryContext> {
  const context: Partial<DiscoveryContext> = {
    query: input
  };

  const lowerInput = input.toLowerCase();

  // Detect mood
  const moodPatterns: Record<string, string> = {
    'relax|chill|calm|unwind': 'relaxing',
    'excit|thrill|action|pump': 'exciting',
    'think|deep|meaning|profound': 'thought-provoking',
    'warm|sweet|feel.good|wholesome': 'heartwarming',
    'suspens|tense|edge': 'suspenseful',
    'fun|laugh|comed|hilarious': 'funny',
    'scar|horror|creep|fright': 'scary',
    'inspir|motivat|uplift': 'inspiring',
    'nostalg|classic|old': 'nostalgic',
    'adventur|explor|journey': 'adventurous'
  };

  for (const [pattern, mood] of Object.entries(moodPatterns)) {
    if (new RegExp(pattern).test(lowerInput)) {
      context.mood = mood;
      break;
    }
  }

  // Detect time constraints
  if (/quick|short|brief|30.min|under.an.hour/i.test(lowerInput)) {
    context.preferences = { ...context.preferences, maxDuration: 60 };
  } else if (/long|epic|marathon|all.day/i.test(lowerInput)) {
    context.preferences = { ...context.preferences, maxDuration: 300 };
  }

  // Detect social context
  if (/date|romantic|partner|spouse/i.test(lowerInput)) {
    context.signals = { ...context.signals, socialContext: 'couple' };
  } else if (/family|kid|child|parent/i.test(lowerInput)) {
    context.signals = { ...context.signals, socialContext: 'family' };
  } else if (/friend|group|party/i.test(lowerInput)) {
    context.signals = { ...context.signals, socialContext: 'friends' };
  } else if (/alone|solo|myself/i.test(lowerInput)) {
    context.signals = { ...context.signals, socialContext: 'alone' };
  }

  // Detect time of day context
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    context.signals = { ...context.signals, timeOfDay: 'morning' };
  } else if (hour >= 12 && hour < 17) {
    context.signals = { ...context.signals, timeOfDay: 'afternoon' };
  } else if (hour >= 17 && hour < 21) {
    context.signals = { ...context.signals, timeOfDay: 'evening' };
  } else {
    context.signals = { ...context.signals, timeOfDay: 'night' };
  }

  // Detect day of week
  const day = new Date().getDay();
  context.signals = {
    ...context.signals,
    dayOfWeek: (day === 0 || day === 6) ? 'weekend' : 'weekday'
  };

  return context;
}

/**
 * Generate follow-up questions based on context
 */
function generateFollowUps(context: Partial<DiscoveryContext>): string[] {
  const questions: string[] = [];

  if (!context.mood) {
    questions.push('What mood are you in right now?');
  }

  if (!context.signals?.socialContext) {
    questions.push('Are you watching alone or with others?');
  }

  if (!context.preferences?.maxDuration) {
    questions.push('How much time do you have?');
  }

  // Add discovery prompts
  questions.push(
    'Want something new or a classic?',
    'Any specific genres you\'re in the mood for?'
  );

  return questions.slice(0, 3);
}

/**
 * Format recommendations as a conversational response
 */
function formatResponse(
  recommendations: AggregatedRecommendation[],
  context: Partial<DiscoveryContext>
): string {
  if (recommendations.length === 0) {
    return "I couldn't find anything matching that. Could you tell me more about what you're in the mood for?";
  }

  const lines: string[] = [];

  // Context acknowledgment
  if (context.mood) {
    lines.push(`Looking for something ${context.mood}? Perfect! Here's what I found:\n`);
  } else if (context.query) {
    lines.push(`Based on "${context.query}", here are my picks:\n`);
  } else {
    lines.push(`Here are my top recommendations for you:\n`);
  }

  // Top recommendations
  const topPicks = recommendations.slice(0, 5);
  topPicks.forEach((rec, index) => {
    const emoji = index === 0 ? '🌟' : '🎬';
    const consensus = rec.consensusLevel === 'strong' ? ' (highly recommended!)' : '';
    lines.push(`${emoji} ${index + 1}. "${rec.title}"${consensus}`);
    lines.push(`   ${rec.reasons[0] || 'Great pick for you'}`);
    lines.push('');
  });

  // Confidence message
  const strongCount = topPicks.filter(r => r.consensusLevel === 'strong').length;
  if (strongCount >= 3) {
    lines.push(`💯 I'm very confident about these picks!`);
  } else if (strongCount >= 1) {
    lines.push(`👍 Some solid options here.`);
  }

  return lines.join('\n');
}

/**
 * Conversational Discovery Engine
 */
export class ConversationalDiscovery {
  private sessions: Map<string, ConversationState> = new Map();

  constructor() {
    // Initialize vector store with content
    const vectorStore = getVectorStore();
    const catalog = getContentCatalog();
    if (vectorStore.size() === 0) {
      vectorStore.indexAll(catalog.getAll());
    }
  }

  /**
   * Start a new conversation session
   */
  startSession(userId: string): string {
    const sessionId = `session-${Date.now()}`;
    const state: ConversationState = {
      userId,
      sessionId,
      history: [],
      context: { userId, sessionId },
      recommendations: []
    };

    this.sessions.set(sessionId, state);

    return sessionId;
  }

  /**
   * Process a user message and get recommendations
   */
  async chat(sessionId: string, userMessage: string): Promise<DiscoveryResponse> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Record user turn
    state.history.push({
      role: 'user',
      message: userMessage,
      timestamp: new Date()
    });

    // Parse input to update context
    const parsedContext = parseUserInput(userMessage);
    state.context = {
      ...state.context,
      ...parsedContext,
      preferences: {
        ...state.context.preferences,
        ...parsedContext.preferences
      },
      signals: {
        ...state.context.signals,
        ...parsedContext.signals
      }
    };

    // Run orchestrated discovery
    const orchestrator = getSwarmOrchestrator();
    const result = await orchestrator.orchestrate(
      state.context as DiscoveryContext,
      5
    );

    state.recommendations = result.recommendations;

    // Generate response
    const message = formatResponse(result.recommendations, state.context);
    const followUpQuestions = generateFollowUps(state.context);

    // Record assistant turn
    state.history.push({
      role: 'assistant',
      message,
      timestamp: new Date()
    });

    return {
      message,
      recommendations: result.recommendations,
      followUpQuestions,
      context: state.context
    };
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): ConversationState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Quick discovery without maintaining session
   */
  async quickDiscover(userId: string, query: string): Promise<DiscoveryResponse> {
    const sessionId = this.startSession(userId);
    const response = await this.chat(sessionId, query);
    this.endSession(sessionId);
    return response;
  }
}

// Singleton instance
let discoveryInstance: ConversationalDiscovery | null = null;

/**
 * Get the conversational discovery instance
 */
export function getConversationalDiscovery(): ConversationalDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new ConversationalDiscovery();
  }
  return discoveryInstance;
}

/**
 * Reset the discovery engine
 */
export function resetConversationalDiscovery(): void {
  discoveryInstance = null;
}
