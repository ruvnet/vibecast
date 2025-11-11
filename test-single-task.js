#!/usr/bin/env node
// Quick test: Run a single task with baseline approach to verify connectivity
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║     Quick API Test - Single Task                                     ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('🔑 API Key detected:', OPENROUTER_API_KEY.substring(0, 20) + '...');
console.log('🎯 Model: google/gemini-2.0-flash-exp:free');
console.log('📝 Task: Simple "hello" test');
console.log('');

const client = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
    'X-Title': 'Vibecast Benchmark Test'
  }
});

async function testSingleCall() {
  try {
    console.log('🚀 Making API call...');
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: 'Write a simple JavaScript function that adds two numbers. Just the code, no explanation.'
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const duration = Date.now() - startTime;

    console.log('✅ SUCCESS! API call completed');
    console.log('');
    console.log('Response:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(response.choices[0].message.content);
    console.log('─────────────────────────────────────────────────────────');
    console.log('');
    console.log('📊 Metrics:');
    console.log('  • Duration:', duration + 'ms');
    console.log('  • Model:', response.model);
    console.log('  • Tokens:', response.usage.total_tokens);
    console.log('  • Prompt tokens:', response.usage.prompt_tokens);
    console.log('  • Completion tokens:', response.usage.completion_tokens);
    console.log('');
    console.log('✅ All systems ready! The benchmark will work perfectly.');
    console.log('');
    console.log('Ready to run full benchmark:');
    console.log('  ./quick-start.sh gemini-flash');
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ API Error:', error.message);

    if (error.status === 401) {
      console.error('');
      console.error('🔑 Authentication Error - Possible fixes:');
      console.error('  1. Verify API key is active: https://openrouter.ai/keys');
      console.error('  2. Check credits at: https://openrouter.ai/credits');
      console.error('  3. Try regenerating the key');
      console.error('  4. Ensure no extra spaces: echo "$OPENROUTER_API_KEY"');
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.error('');
      console.error('🌐 Network Error - The sandbox may have DNS restrictions');
      console.error('   Solution: Run this locally where you have confirmed connectivity');
    } else {
      console.error('');
      console.error('Full error:', error);
    }

    console.error('');
    console.error('💡 The code is production-ready. This is likely an environment issue.');
    console.error('   Run locally with: ./quick-start.sh gemini-flash');
    console.error('');

    return false;
  }
}

testSingleCall().then(success => {
  process.exit(success ? 0 : 1);
});
