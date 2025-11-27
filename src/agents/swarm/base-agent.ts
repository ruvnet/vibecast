/**
 * VibeCast Pro - Base Agent Interface
 *
 * Foundation for the multi-agent recommendation swarm.
 * Powered by AgenticFlow for the Agentics Foundation TV5 Hackathon.
 */

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage {
  from: string;
  to: string;
  type: 'query' | 'response' | 'signal' | 'data';
  payload: unknown;
  timestamp: Date;
  correlationId: string;
}

/**
 * Agent state for tracking
 */
export interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'waiting' | 'error';
  lastActivity: Date;
  processedCount: number;
  errorCount: number;
}

/**
 * Agent result with confidence
 */
export interface AgentResult<T> {
  agentId: string;
  agentName: string;
  result: T;
  confidence: number;
  reasoning: string[];
  processingTime: number;
}

/**
 * Discovery context passed between agents
 */
export interface DiscoveryContext {
  userId: string;
  sessionId: string;
  query?: string;
  mood?: string;
  preferences?: {
    genres?: string[];
    platforms?: string[];
    maxDuration?: number;
  };
  constraints?: {
    excludeWatched?: boolean;
    excludeIds?: string[];
  };
  signals?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: 'weekday' | 'weekend';
    socialContext?: 'alone' | 'couple' | 'family' | 'friends';
  };
}

/**
 * Content recommendation from an agent
 */
export interface ContentRecommendation {
  contentId: string;
  title: string;
  score: number;
  reasons: string[];
  source: string;
}

/**
 * Base agent class for the recommendation swarm
 */
export abstract class BaseAgent {
  protected state: AgentState;

  constructor(id: string, name: string) {
    this.state = {
      id,
      name,
      status: 'idle',
      lastActivity: new Date(),
      processedCount: 0,
      errorCount: 0
    };
  }

  /**
   * Get agent state
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Process a discovery context and return recommendations
   */
  abstract process(context: DiscoveryContext): Promise<AgentResult<ContentRecommendation[]>>;

  /**
   * Get agent description
   */
  abstract getDescription(): string;

  /**
   * Update agent state
   */
  protected updateState(updates: Partial<AgentState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastActivity: new Date()
    };
  }

  /**
   * Record successful processing
   */
  protected recordSuccess(): void {
    this.state.processedCount++;
    this.state.status = 'idle';
    this.state.lastActivity = new Date();
  }

  /**
   * Record processing error
   */
  protected recordError(): void {
    this.state.errorCount++;
    this.state.status = 'error';
    this.state.lastActivity = new Date();
  }

  /**
   * Create an agent result
   */
  protected createResult<T>(
    result: T,
    confidence: number,
    reasoning: string[],
    startTime: number
  ): AgentResult<T> {
    return {
      agentId: this.state.id,
      agentName: this.state.name,
      result,
      confidence,
      reasoning,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Generate a correlation ID for message tracking
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
