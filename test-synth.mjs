#!/usr/bin/env node

import { AgenticSynth } from '@ruvector/agentic-synth';

const schema = {
  type: 'object',
  properties: {
    ticker: { type: 'string', description: 'Stock ticker symbol' },
    price: { type: 'number', description: 'Current stock price' }
  },
  required: ['ticker', 'price']
};

async function testGemini() {
  console.log('\n🔍 Testing Gemini API...');
  console.log('API Key:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT SET');

  try {
    const generator = new AgenticSynth({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
    });

    const result = await generator.generate('structured', {
      schema,
      count: 1,
    });

    console.log('✅ Gemini test successful:', JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('❌ Gemini test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testOpenRouter() {
  console.log('\n🔍 Testing OpenRouter API...');
  console.log('API Key:', process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'NOT SET');

  try {
    const generator = new AgenticSynth({
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const result = await generator.generate('structured', {
      schema,
      count: 1,
    });

    console.log('✅ OpenRouter test successful:', JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('❌ OpenRouter test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run tests
await testGemini();
await testOpenRouter();
