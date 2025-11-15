/**
 * Proxy Client for Claude Code Web
 * Handles API calls through the proxy server
 */

import * as dotenv from 'dotenv';

dotenv.config();

export interface ProxyConfig {
  proxyUrl: string;
  proxyKey: string;
}

export interface ProxyRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

export interface ProxyResponse<T = any> {
  status: number;
  statusText: string;
  data: T;
  duration: number;
  headers: Record<string, string>;
}

export class ProxyClient {
  private proxyUrl: string;
  private proxyKey: string;

  constructor(config?: Partial<ProxyConfig>) {
    this.proxyUrl = config?.proxyUrl || process.env.CLAUDE_PROXY_URL || '';
    this.proxyKey = config?.proxyKey || process.env.CLAUDE_PROXY_KEY || '';

    if (!this.proxyUrl) {
      throw new Error('CLAUDE_PROXY_URL not configured');
    }
    if (!this.proxyKey) {
      throw new Error('CLAUDE_PROXY_KEY not configured');
    }
  }

  /**
   * Make a proxied API request
   */
  async request<T = any>(options: ProxyRequestOptions): Promise<ProxyResponse<T>> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: options.url,
          method: options.method || 'GET',
          headers: options.headers,
          body: options.body,
          key: this.proxyKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Proxy error: ${error.error || response.statusText}`);
      }

      const result = await response.json();
      return result as ProxyResponse<T>;
    } catch (error) {
      throw new Error(
        `Proxy request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Make multiple proxied requests in parallel (max 10)
   */
  async batch(requests: ProxyRequestOptions[]): Promise<ProxyResponse[]> {
    if (requests.length > 10) {
      throw new Error('Maximum 10 requests per batch');
    }

    const batchUrl = this.proxyUrl.replace('/route', '/batch');

    try {
      const response = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: requests.map((req) => ({
            url: req.url,
            method: req.method || 'GET',
            headers: req.headers,
            body: req.body,
          })),
          key: this.proxyKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.results;
    } catch (error) {
      throw new Error(
        `Batch request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check proxy health
   */
  async healthCheck(): Promise<{
    status: string;
    service: string;
    version: string;
    uptime: number;
  }> {
    const healthUrl = this.proxyUrl.replace('/route', '/health');

    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      return await response.json();
    } catch (error) {
      throw new Error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * OpenRouter API call through proxy
   */
  async openRouter(config: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    return this.request({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vibecast/franchise-manager',
        'X-Title': 'Vibecast Franchise Manager',
      },
      body: config,
    });
  }

  /**
   * Anthropic API call through proxy
   */
  async anthropic(config: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens: number;
    system?: string;
  }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    return this.request({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: config,
    });
  }
}

/**
 * Create a proxy client instance
 */
export function createProxyClient(config?: Partial<ProxyConfig>): ProxyClient {
  return new ProxyClient(config);
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!(process.env.CLAUDE_PROXY_URL && process.env.CLAUDE_PROXY_KEY);
}
