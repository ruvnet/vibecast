/**
 * Base Agent class providing core functionality for all specialized agents
 */

import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { getOpenRouterClient } from './openrouter-client.js';
import type {
  Message,
  AgentContext,
  AgentResponse,
  AgentConfig,
  AgentTask,
} from '../types/index.js';

export abstract class BaseAgent extends EventEmitter {
  protected id: string;
  protected config: AgentConfig;
  protected client = getOpenRouterClient();
  protected conversationHistory: Message[] = [];

  constructor(config: AgentConfig) {
    super();
    this.id = nanoid();
    this.config = config;
    this.initializeAgent();
  }

  protected initializeAgent(): void {
    // Add system prompt to conversation history
    this.conversationHistory.push({
      role: 'system',
      content: this.config.systemPrompt,
    });

    this.emit('agent-initialized', {
      agentId: this.id,
      role: this.config.role,
      name: this.config.name,
    });
  }

  /**
   * Process a task using the agent's specialized capabilities
   */
  async processTask(task: AgentTask, context?: AgentContext): Promise<AgentResponse> {
    this.emit('task-start', { task, agentId: this.id });

    try {
      const response = await this.execute(task.input, context);
      this.emit('task-complete', { task, response, agentId: this.id });
      return response;
    } catch (error: any) {
      this.emit('task-error', { task, error, agentId: this.id });
      throw error;
    }
  }

  /**
   * Execute the agent's primary function - must be implemented by subclasses
   */
  protected abstract execute(input: any, context?: AgentContext): Promise<AgentResponse>;

  /**
   * Send a message and get a response from the LLM
   */
  protected async sendMessage(
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      includeHistory?: boolean;
    }
  ): Promise<AgentResponse> {
    const messages: Message[] = options?.includeHistory
      ? [...this.conversationHistory, { role: 'user', content: userMessage }]
      : [this.conversationHistory[0], { role: 'user', content: userMessage }];

    const result = await this.client.complete({
      messages,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens,
    });

    // Update conversation history
    if (options?.includeHistory) {
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.content }
      );
    }

    return {
      content: result.content,
      tokensUsed: result.tokensUsed.total,
      metadata: {
        model: result.model,
        finishReason: result.finishReason,
      },
    };
  }

  /**
   * Send a message with streaming response
   */
  protected async *sendMessageStream(
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string, AgentResponse, unknown> {
    const messages: Message[] = [
      this.conversationHistory[0],
      { role: 'user', content: userMessage },
    ];

    let fullContent = '';
    const generator = this.client.completeStream({
      messages,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens,
    });

    for await (const chunk of generator) {
      fullContent += chunk;
      yield chunk;
    }

    return {
      content: fullContent,
      metadata: { streaming: true },
    };
  }

  /**
   * Clear conversation history (keep only system prompt)
   */
  clearHistory(): void {
    this.conversationHistory = [this.conversationHistory[0]];
    this.emit('history-cleared', { agentId: this.id });
  }

  /**
   * Get agent information
   */
  getInfo(): {
    id: string;
    role: string;
    name: string;
    description: string;
  } {
    return {
      id: this.id,
      role: this.config.role,
      name: this.config.name,
      description: this.config.description,
    };
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }
}
