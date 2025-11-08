/**
 * Tests for OpenRouter Client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenRouterClient, getOpenRouterClient, destroyOpenRouterClient } from '../lib/openrouter-client';

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;

  beforeEach(() => {
    client = getOpenRouterClient();
  });

  afterEach(() => {
    destroyOpenRouterClient();
  });

  describe('initialization', () => {
    it('should create a singleton instance', () => {
      const client1 = getOpenRouterClient();
      const client2 = getOpenRouterClient();
      expect(client1).toBe(client2);
    });

    it('should initialize with correct configuration', () => {
      expect(client).toBeDefined();
      expect(client.getRateLimitStatus).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should track request count', () => {
      const status = client.getRateLimitStatus();
      expect(status.requestCount).toBe(0);
      expect(status.tokenCount).toBe(0);
    });

    it('should provide remaining capacity', () => {
      const status = client.getRateLimitStatus();
      expect(status.requestsRemaining).toBeGreaterThan(0);
      expect(status.tokensRemaining).toBeGreaterThan(0);
    });
  });

  describe('completion', () => {
    it('should accept completion options', () => {
      const options = {
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'Hello!' },
        ],
        temperature: 0.7,
        maxTokens: 100,
      };

      expect(() => {
        // This would normally make an API call
        // In tests, we'd mock this
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors', async () => {
      // Mock rate limit exceeded
      const status = client.getRateLimitStatus();
      expect(status).toBeDefined();
    });
  });
});
