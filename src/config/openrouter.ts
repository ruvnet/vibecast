import dotenv from 'dotenv';

dotenv.config();

export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export const openRouterConfig: OpenRouterConfig = {
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  model: process.env.KIMI_MODEL || 'moonshotai/kimi-k2-0905',
  maxTokens: 256000, // K2 0905 supports up to 256K tokens
  temperature: 0.7,
};

export function validateConfig(): boolean {
  if (!openRouterConfig.apiKey) {
    console.error('❌ OPENROUTER_API_KEY is not set in environment variables');
    return false;
  }
  return true;
}
