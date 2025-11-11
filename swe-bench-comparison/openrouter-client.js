/**
 * OpenRouter API Client using curl (works with proxy)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function callOpenRouter(messages, model = 'deepseek/deepseek-chat', options = {}) {
  const {
    temperature = 0.7,
    max_tokens = 1000,
    title = 'SWE-Bench'
  } = options;

  const payload = {
    model,
    messages,
    temperature,
    max_tokens
  };

  // Escape JSON for shell
  const jsonPayload = JSON.stringify(payload).replace(/'/g, "'\\''");

  const curlCommand = `curl -s -X POST '${OPENROUTER_BASE_URL}/chat/completions' \\
    -H 'Authorization: Bearer ${OPENROUTER_API_KEY}' \\
    -H 'Content-Type: application/json' \\
    -H 'HTTP-Referer: https://github.com/ruvnet/vibecast' \\
    -H 'X-Title: ${title}' \\
    -d '${jsonPayload}'`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand, { maxBuffer: 10 * 1024 * 1024 });

    if (stderr) {
      console.warn('curl stderr:', stderr);
    }

    const data = JSON.parse(stdout);

    if (data.error) {
      throw new Error(`OpenRouter API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return {
      success: true,
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage || {},
      data
    };

  } catch (error) {
    return {
      success: false,
      content: '',
      usage: {},
      error: error.message
    };
  }
}
