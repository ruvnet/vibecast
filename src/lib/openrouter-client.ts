/**
 * OpenRouter API Client with DeepSeek Chat integration
 * Handles rate limiting, retries, error handling, and streaming
 */

import OpenAI from 'openai';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { EventEmitter } from 'eventemitter3';
import { appConfig } from '../config/index.js';
import type { Message } from '../types/index.js';

export interface CompletionOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface CompletionResult {
  content: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: string;
}

export class OpenRouterClient extends EventEmitter {
  private client: OpenAI;
  private queue: PQueue;
  private requestCount: number = 0;
  private tokenCount: number = 0;
  private resetInterval: NodeJS.Timeout;

  constructor() {
    super();

    // Initialize OpenAI client configured for OpenRouter
    this.client = new OpenAI({
      apiKey: appConfig.openRouter.apiKey,
      baseURL: appConfig.openRouter.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/vibecast/franchise-platform',
        'X-Title': 'Vibecast Franchise Platform',
      },
    });

    // Initialize rate limiting queue
    this.queue = new PQueue({
      concurrency: appConfig.agents.maxConcurrent,
      interval: 60000, // 1 minute
      intervalCap: appConfig.rateLimiting.requestsPerMinute,
    });

    // Reset rate limiting counters every minute
    this.resetInterval = setInterval(() => {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.emit('rate-limit-reset');
    }, 60000);

    if (appConfig.agents.enableLogging) {
      this.setupLogging();
    }
  }

  private setupLogging(): void {
    this.on('request-start', (data) => {
      console.log(`[OpenRouter] Request started: ${data.model}`);
    });

    this.on('request-complete', (data) => {
      console.log(
        `[OpenRouter] Request completed: ${data.tokensUsed.total} tokens used`
      );
    });

    this.on('request-error', (data) => {
      console.error(`[OpenRouter] Request failed: ${data.error.message}`);
    });

    this.on('stream-chunk', (data) => {
      console.log(`[OpenRouter] Stream chunk: ${data.content.length} chars`);
    });
  }

  /**
   * Execute a completion request with rate limiting and retry logic
   */
  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = appConfig.openRouter.model;

    // Check rate limits
    if (this.tokenCount >= appConfig.rateLimiting.tokensPerMinute) {
      throw new Error('Token rate limit exceeded. Please wait before making more requests.');
    }

    return this.queue.add(async () => {
      return pRetry(
        async () => {
          this.emit('request-start', { model, messageCount: options.messages.length });

          try {
            const response = await this.client.chat.completions.create({
              model,
              messages: options.messages as any,
              temperature: options.temperature ?? appConfig.modelDefaults.temperature,
              max_tokens: options.maxTokens ?? appConfig.modelDefaults.maxTokens,
              top_p: options.topP ?? appConfig.modelDefaults.topP,
              frequency_penalty:
                options.frequencyPenalty ?? appConfig.modelDefaults.frequencyPenalty,
              presence_penalty:
                options.presencePenalty ?? appConfig.modelDefaults.presencePenalty,
              stream: false,
            });

            const choice = response.choices[0];
            const usage = response.usage;

            if (!choice || !usage) {
              throw new Error('Invalid response from OpenRouter API');
            }

            const result: CompletionResult = {
              content: choice.message.content || '',
              model: response.model,
              tokensUsed: {
                prompt: usage.prompt_tokens,
                completion: usage.completion_tokens,
                total: usage.total_tokens,
              },
              finishReason: choice.finish_reason,
            };

            // Update rate limiting counters
            this.requestCount++;
            this.tokenCount += usage.total_tokens;

            this.emit('request-complete', result);

            return result;
          } catch (error: any) {
            this.emit('request-error', { error, model });
            throw error;
          }
        },
        {
          retries: appConfig.retry.maxRetries,
          minTimeout: appConfig.retry.initialDelayMs,
          maxTimeout: appConfig.retry.maxDelayMs,
          factor: appConfig.retry.backoffMultiplier,
          onFailedAttempt: (error) => {
            console.warn(
              `Request attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
            );
          },
        }
      );
    }) as Promise<CompletionResult>;
  }

  /**
   * Execute a streaming completion request
   */
  async *completeStream(
    options: CompletionOptions
  ): AsyncGenerator<string, CompletionResult, unknown> {
    const model = appConfig.openRouter.model;

    this.emit('request-start', { model, messageCount: options.messages.length, streaming: true });

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: options.messages as any,
        temperature: options.temperature ?? appConfig.modelDefaults.temperature,
        max_tokens: options.maxTokens ?? appConfig.modelDefaults.maxTokens,
        top_p: options.topP ?? appConfig.modelDefaults.topP,
        frequency_penalty:
          options.frequencyPenalty ?? appConfig.modelDefaults.frequencyPenalty,
        presence_penalty: options.presencePenalty ?? appConfig.modelDefaults.presencePenalty,
        stream: true,
      });

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          completionTokens += 1; // Approximate
          this.emit('stream-chunk', { content: delta.content });
          yield delta.content;
        }
      }

      // Approximate token counts for streaming
      promptTokens = this.estimateTokens(options.messages);
      this.requestCount++;
      this.tokenCount += promptTokens + completionTokens;

      const result: CompletionResult = {
        content: fullContent,
        model,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        finishReason: 'stop',
      };

      this.emit('request-complete', result);

      return result;
    } catch (error: any) {
      this.emit('request-error', { error, model });
      throw error;
    }
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokens(messages: Message[]): number {
    const text = messages.map((m) => m.content).join(' ');
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestCount: number;
    tokenCount: number;
    requestsRemaining: number;
    tokensRemaining: number;
  } {
    return {
      requestCount: this.requestCount,
      tokenCount: this.tokenCount,
      requestsRemaining: appConfig.rateLimiting.requestsPerMinute - this.requestCount,
      tokensRemaining: appConfig.rateLimiting.tokensPerMinute - this.tokenCount,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    clearInterval(this.resetInterval);
    this.queue.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let clientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!clientInstance) {
    clientInstance = new OpenRouterClient();
  }
  return clientInstance;
}

export function destroyOpenRouterClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}
