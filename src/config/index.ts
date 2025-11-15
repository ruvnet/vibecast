/**
 * Configuration management for the agent system
 */

import { config } from 'dotenv';
import { z } from 'zod';

config();

const ConfigSchema = z.object({
  // OpenRouter Configuration
  openRouter: z.object({
    apiKey: z.string().min(1, 'OpenRouter API key is required'),
    baseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
    model: z.string().default('deepseek/deepseek-chat'),
  }),

  // Agent Configuration
  agents: z.object({
    maxConcurrent: z.number().int().positive().default(5),
    timeoutMs: z.number().int().positive().default(30000),
    enableLogging: z.boolean().default(true),
  }),

  // Rate Limiting
  rateLimiting: z.object({
    requestsPerMinute: z.number().int().positive().default(60),
    tokensPerMinute: z.number().int().positive().default(100000),
  }),

  // Retry Configuration
  retry: z.object({
    maxRetries: z.number().int().nonnegative().default(3),
    initialDelayMs: z.number().int().positive().default(1000),
    maxDelayMs: z.number().int().positive().default(10000),
    backoffMultiplier: z.number().positive().default(2),
  }),

  // Model Parameters
  modelDefaults: z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(4096),
    topP: z.number().min(0).max(1).default(1),
    frequencyPenalty: z.number().min(-2).max(2).default(0),
    presencePenalty: z.number().min(-2).max(2).default(0),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const rawConfig = {
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-chat',
    },
    agents: {
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5', 10),
      timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10),
      enableLogging: process.env.ENABLE_AGENT_LOGGING !== 'false',
    },
    rateLimiting: {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60', 10),
      tokensPerMinute: parseInt(process.env.RATE_LIMIT_TOKENS_PER_MINUTE || '100000', 10),
    },
    retry: {
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      initialDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
      maxDelayMs: parseInt(process.env.MAX_RETRY_DELAY_MS || '10000', 10),
      backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2'),
    },
    modelDefaults: {
      temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '4096', 10),
      topP: parseFloat(process.env.MODEL_TOP_P || '1'),
      frequencyPenalty: parseFloat(process.env.MODEL_FREQUENCY_PENALTY || '0'),
      presencePenalty: parseFloat(process.env.MODEL_PRESENCE_PENALTY || '0'),
    },
  };

  return ConfigSchema.parse(rawConfig);
}

export const appConfig = loadConfig();

export function validateConfig(): void {
  try {
    ConfigSchema.parse(appConfig);
    console.log('✓ Configuration validated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }
    throw error;
  }
}
